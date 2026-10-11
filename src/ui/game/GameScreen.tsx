/**
 * Game screen: layout (HUD, tabs/rail, main view, side column), overlay orchestration
 * (briefing → result → next, actions, quarter report, tips), autosave, audio/fx reactions and keyboard.
 */
import type { JSX } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ActionId, ActionResult, Card, Choice, ChoiceResult, EndingReport, GameAPI, GameEvent, MeterId, ProgramId, TabId, TurnReport } from '../../engine/types';
import { METER_INFO } from '../../engine/labels';
import { audio } from '../../audio';
import { fx } from '../../fx';
import { writeSave } from '../backend';
import { DESKTOP_QUERY, useHeightVar, useMedia } from '../hooks';
import { announce, cx, isInteractiveTarget } from '../util';
import { closeTopSheet, sheetsOpen } from '../components/Sheet';
import { ActionSheet, responseAsAction } from './ActionSheet';
import { BriefingSheet } from './Briefing';
import { GameCtx, type GameCtxValue } from './context';
import { Hud, MeterSheet, RiskSheet, METER_ORDER } from './Hud';
import { EndQuarterButton, InboxPanel, InboxStack, isCrisisCard } from './Inbox';
import { NewsList, NewsSheet, NewsTicker } from './News';
import { QuarterReport } from './QuarterReport';
import { ActionResultOverlay, ChoiceResultOverlay } from './Results';
import { TabBar, TABS } from './TabBar';
import { TipPopup } from './Tips';
import { LabsPanel } from './panels/LabsPanel';
import { NationPanel } from './panels/NationPanel';
import { ThreatsPanel } from './panels/ThreatsPanel';
import { WorldPanel } from './panels/WorldPanel';

type Overlay =
  | { type: 'card'; uid: string }
  | { type: 'choice'; result: ChoiceResult }
  | { type: 'action'; result: ActionResult }
  | { type: 'report'; report: TurnReport }
  | null;

type SheetState =
  | { type: 'meter'; id: MeterId }
  | { type: 'risk' }
  | { type: 'news' }
  | { type: 'action'; id: ActionId; targetId?: string; optionId?: string }
  | { type: 'response'; situationId: string; responseId: string }
  | null;

export interface GameScreenProps {
  game: GameAPI;
  onEnding(e: EndingReport): void;
  /** Open the in-game menu; `confirmQuit` shows the "Return to title?" prompt (browser Back). */
  onMenu(opts?: { confirmQuit?: boolean }): void;
  /** Show the latest quarter report on mount (e.g. after loading a save). */
  initialReport?: TurnReport | null;
}

export function GameScreen({ game, onEnding, onMenu, initialReport }: GameScreenProps): JSX.Element {
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<TabId>('inbox');
  const [overlay, setOverlay] = useState<Overlay>(initialReport ? { type: 'report', report: initialReport } : null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [fresh, setFresh] = useState<TabId[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const desktop = useMedia(DESKTOP_QUERY);
  const hudRef = useHeightVar<HTMLElement>('--hud-h');
  const mainRef = useRef<HTMLElement>(null);
  const pendingEnding = useRef<EndingReport | null>(null);
  /** True from End Quarter until the report is dismissed: blocks re-entry (double taps, key repeat). */
  const turnBusy = useRef(!!initialReport);

  // Re-render on every engine event.
  useEffect(
    () =>
      game.subscribe((e: GameEvent) => {
        if (e.type === 'gameover') pendingEnding.current = e.ending;
        setVersion((v) => v + 1);
      }),
    [game],
  );

  const view = useMemo(() => game.view(), [game, version]);
  const actions = useMemo(() => game.getActions(), [game, version]);

  // Music & mood.
  useEffect(() => {
    audio.setMood('game');
    audio.startMusic();
  }, []);

  // Risk → music tension & background.
  useEffect(() => {
    const t = Math.max(0, Math.min(1, view.risk.estimate / 100));
    try {
      audio.setTension(t);
      fx.setBackgroundTension(t);
    } catch {
      /* presentation modules optional */
    }
  }, [view.risk.estimate]);

  // Tab unlocks → glow + sound + tip.
  const knownTabs = useRef<TabId[]>(view.unlockedTabs);
  useEffect(() => {
    const added = view.unlockedTabs.filter((t) => !knownTabs.current.includes(t));
    knownTabs.current = view.unlockedTabs;
    if (added.length) {
      setFresh((f) => [...f, ...added]);
      audio.play('unlock');
      announce(`New section unlocked: ${added.map((t) => TABS.find((x) => x.id === t)?.label).join(', ')}`);
    }
  }, [view.unlockedTabs.join()]);

  // Meters turning critical → alarm.
  const lastStatus = useRef(Object.fromEntries(METER_ORDER.map((id) => [id, view.meters[id].status])) as Record<MeterId, string>);
  useEffect(() => {
    for (const id of METER_ORDER) {
      const st = view.meters[id].status;
      if (st === 'critical' && lastStatus.current[id] !== 'critical') {
        audio.play('critical');
        try {
          fx.vignette('#ff4d5e', 1200);
        } catch {
          /* optional */
        }
        announce(`${METER_INFO[id].name} is critical`);
      }
      lastStatus.current[id] = st;
    }
  }, [version]);

  // New crisis cards → alert.
  const seenCards = useRef(new Set(view.inbox.map((c) => c.uid)));
  useEffect(() => {
    const fresh = view.inbox.filter((c) => !seenCards.current.has(c.uid));
    fresh.forEach((c) => seenCards.current.add(c.uid));
    if (fresh.some(isCrisisCard) && !overlay) {
      audio.play('alert');
      try {
        fx.vignette('#ff4d5e', 900);
      } catch {
        /* optional */
      }
    }
  }, [version, overlay?.type]);

  // Keep the selected tab valid.
  useEffect(() => {
    if (!view.unlockedTabs.includes(tab)) setTab('inbox');
  }, [view.unlockedTabs.join(), tab]);

  // Hide transient toast.
  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 2800);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    announce(msg);
  }, []);

  const save = () => writeSave(game);

  const goTab = useCallback((t: TabId) => {
    audio.play('tab');
    setTab(t);
    setFresh((f) => f.filter((x) => x !== t));
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  const openCard = useCallback((uid: string) => {
    setSheet(null);
    setOverlay({ type: 'card', uid });
  }, []);

  const finishIfOver = (): boolean => {
    const v = game.view();
    const ending = pendingEnding.current ?? v.ending;
    if (v.gameOver && ending) {
      onEnding(ending);
      return true;
    }
    return false;
  };

  const choose = (card: Card, ch: Choice) => {
    const r = game.resolveChoice(card.uid, ch.id);
    if (!r.ok) {
      audio.play('fail', { volume: 0.5 });
      toast(r.error ?? 'That choice is not available.');
      return;
    }
    save();
    announce(`${card.title}: ${ch.label}. ${r.text}`);
    setOverlay({ type: 'choice', result: r });
  };

  const afterChoice = (r: ChoiceResult, toDesk = false) => {
    if (finishIfOver()) return;
    const v = game.view();
    if (r.nextCardUid && v.inbox.some((c) => c.uid === r.nextCardUid)) return setOverlay({ type: 'card', uid: r.nextCardUid });
    if (!toDesk && v.inbox.length) return setOverlay({ type: 'card', uid: v.inbox[0].uid });
    setOverlay(null);
    if (tab !== 'inbox' && !desktop) setTab('inbox');
  };

  const perform = (id: ActionId, targetId?: string, optionId?: string) => {
    const r = game.performAction(id, targetId, optionId);
    setSheet(null);
    if (!r.ok) {
      // The engine validates at perform time (e.g. situation responses); explain, don't crash.
      audio.play('fail', { volume: 0.5 });
      toast(r.error ?? 'That action is not available right now.');
      return;
    }
    save();
    announce(`${r.title}. ${r.text}`);
    setOverlay({ type: 'action', result: r });
  };

  const setProgram = (id: ProgramId, level: number) => {
    const r = game.setProgramLevel(id, level);
    if (!r.ok) {
      audio.play('fail', { volume: 0.5 });
      toast(r.reason ?? 'Cannot change that program now.');
      return;
    }
    save();
  };

  const endQuarter = useCallback(() => {
    if (turnBusy.current) return;
    if (!game.canEndTurn()) {
      toast('Resolve every briefing before ending the quarter.');
      return;
    }
    turnBusy.current = true;
    const report = game.endTurn();
    save();
    setSheet(null);
    setOverlay({ type: 'report', report });
    announce(`Quarter ended. ${report.dateLabel} begins.`);
  }, [game]);

  const afterReport = () => {
    turnBusy.current = false;
    if (finishIfOver()) return;
    setOverlay(null);
    setTab('inbox');
    mainRef.current?.scrollTo({ top: 0 });
  };

  // Browser Back / Android back gesture: never leave the game silently.
  // A history entry is pushed on entry; Back closes the top sheet, or asks "Return to title?".
  const onMenuRef = useRef(onMenu);
  onMenuRef.current = onMenu;
  useEffect(() => {
    const push = () => history.pushState({ ato: 'game' }, '');
    push();
    const onPop = () => {
      push();
      if (closeTopSheet()) return;
      onMenuRef.current({ confirmQuit: true });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Global keys: Space/Enter ends the quarter when nothing is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (overlay || sheet || sheetsOpen() > 0 || isInteractiveTarget(e.target)) return;
      if (!view.canEndTurn) return;
      e.preventDefault();
      endQuarter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, sheet, view.canEndTurn, endQuarter]);

  const ctx: GameCtxValue = {
    game,
    view,
    actions,
    desktop,
    openCard,
    openAction: (id, targetId, optionId) => setSheet({ type: 'action', id, targetId, optionId }),
    openResponse: (situationId, responseId) => setSheet({ type: 'response', situationId, responseId }),
    setProgram,
    goTab,
    endQuarter,
    toast,
    openNews: () => setSheet({ type: 'news' }),
  };

  // Tips show only when nothing else demands attention.
  const tip = !overlay && !sheet ? view.pendingTips[0] : undefined;

  const panel =
    tab === 'labs' ? <LabsPanel /> : tab === 'nation' ? <NationPanel /> : tab === 'world' ? <WorldPanel /> : tab === 'threats' ? <ThreatsPanel /> : <InboxPanel />;

  const openCardObj = overlay?.type === 'card' ? view.inbox.find((c) => c.uid === overlay.uid) : undefined;

  return (
    <GameCtx.Provider value={ctx}>
      <div class={cx('game', desktop ? 'game--desktop' : 'game--phone', tip && 'has-tip')} data-country={view.country.id}>
        <Hud hudRef={hudRef} onMeter={(id) => setSheet({ type: 'meter', id })} onRisk={() => setSheet({ type: 'risk' })} onMenu={() => onMenu()} />
        {!desktop && <NewsTicker news={view.news} onOpen={() => setSheet({ type: 'news' })} />}
        <TabBar tab={tab} onTab={goTab} fresh={fresh} />
        <main class="main" id="main" ref={mainRef} role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab}>
          {panel}
        </main>
        {desktop ? (
          <aside class="side" aria-label="Desk">
            {tab !== 'inbox' && <InboxStack />}
            <div class="side__end">
              <EndQuarterButton wide />
            </div>
            <section class="side__news" aria-label="News">
              <h2 class="side__title">
                <span class="live-dot" aria-hidden="true" /> News
              </h2>
              <NewsList news={view.news} limit={14} />
            </section>
          </aside>
        ) : (
          <div class="endbar">
            <EndQuarterButton wide />
          </div>
        )}

        {tip && <TipPopup id={tip} onDismiss={() => game.dismissTip(tip)} />}

        {toastMsg && (
          <div class="toast" role="status">
            {toastMsg}
          </div>
        )}

        {/* Sheets */}
        {sheet?.type === 'meter' && <MeterSheet id={sheet.id} onClose={() => setSheet(null)} />}
        {sheet?.type === 'risk' && <RiskSheet onClose={() => setSheet(null)} />}
        {sheet?.type === 'news' && <NewsSheet news={view.news} onClose={() => setSheet(null)} />}
        {sheet?.type === 'action' &&
          (() => {
            const a = actions.find((x) => x.id === sheet.id);
            if (!a) return null;
            return <ActionSheet action={a} initialTarget={sheet.targetId} initialOption={sheet.optionId} onClose={() => setSheet(null)} onConfirm={(t, o) => perform(a.id, t, o)} />;
          })()}
        {sheet?.type === 'response' &&
          (() => {
            const s = view.situations.find((x) => x.id === sheet.situationId);
            const r = s?.responses.find((x) => x.id === sheet.responseId);
            if (!s || !r) return null;
            return (
              <ActionSheet
                action={responseAsAction(r)}
                subject={`Threat: ${s.name} (${s.stageLabel})`}
                onClose={() => setSheet(null)}
                onConfirm={() => perform('situation_response', s.id, r.id)}
              />
            );
          })()}

        {/* Overlays */}
        {openCardObj && (
          <BriefingSheet
            key={openCardObj.uid}
            card={openCardObj}
            onClose={() => {
              audio.play('card_out', { volume: 0.7 });
              setOverlay(null);
            }}
            onChoose={(ch) => choose(openCardObj, ch)}
          />
        )}
        {overlay?.type === 'choice' && (
          <ChoiceResultOverlay result={overlay.result} remaining={view.inbox.length} onNext={() => afterChoice(overlay.result)} onDesk={() => afterChoice(overlay.result, true)} />
        )}
        {overlay?.type === 'action' && (
          <ActionResultOverlay
            result={overlay.result}
            onClose={() => {
              if (!finishIfOver()) setOverlay(null);
            }}
          />
        )}
        {overlay?.type === 'report' && <QuarterReport report={overlay.report} onContinue={afterReport} />}
      </div>
    </GameCtx.Provider>
  );
}
