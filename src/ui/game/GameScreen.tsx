/**
 * Game screen: layout (HUD, tabs/rail, main view, side column), overlay orchestration
 * (briefing → result → next, actions, quarter report, tips), autosave, audio/fx reactions and keyboard.
 */
import type { JSX } from 'preact';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ActionId, ActionResult, Card, Choice, ChoiceResult, EndingReport, GameAPI, GameEvent, MeterId, ProgramId, TabId, TurnReport } from '../../engine/types';
import { METER_INFO } from '../../engine/labels';
import { t } from '../../i18n';
import { audio } from '../../audio';
import { fx } from '../../fx';
import { clearPending, readPending, writeSave, type SavedOverlay } from '../backend';
import { DESKTOP_QUERY, useHeightVar, useMedia } from '../hooks';
import { announce, cx, isInteractiveTarget } from '../util';
import { closeTopSheet, sheetsOpen } from '../components/Sheet';
import { ActionSheet, responseAsAction } from './ActionSheet';
import { BriefingSheet } from './Briefing';
import { GameCtx, type GameCtxValue } from './context';
import { Hud, MeterSheet, RiskSheet, METER_ORDER } from './Hud';
import { EndQuarterButton, InboxPanel, InboxStack, isCrisisCard } from './Inbox';
import { NewsList, NewsSheet } from './News';
import { QuarterReport } from './QuarterReport';
import { ActionResultOverlay, ChoiceResultOverlay } from './Results';
import { TabBar, TABS } from './TabBar';
import { TipPopup } from './Tips';
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
  const [sections, setSections] = useState<Record<string, string>>({});
  const scrollPositions = useRef<Partial<Record<TabId, number>>>({});
  const [overlay, setOverlay] = useState<Overlay>(() => initialReport ? { type: 'report', report: initialReport } : readPending());
  const [sheet, setSheet] = useState<SheetState>(null);
  const [fresh, setFresh] = useState<TabId[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const desktop = useMedia(DESKTOP_QUERY);
  const hudRef = useHeightVar<HTMLElement>('--hud-h');
  const mainRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => { mainRef.current?.scrollTo({ top: scrollPositions.current[tab] ?? 0 }); }, [tab]);
  const pendingEnding = useRef<EndingReport | null>(null);
  /** True from End Quarter until the report is dismissed: blocks re-entry (double taps, key repeat). */
  const turnBusy = useRef(overlay?.type === 'report');

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
      announce(t('New section unlocked: {tabs}', { tabs: added.map((id) => TABS.find((x) => x.id === id)?.label ?? id).join(', ') }));
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
        announce(t('{meter} is critical', { meter: METER_INFO[id].name }));
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

  const save = (pending: SavedOverlay | null = null) => writeSave(game, pending);

  const goTab = useCallback((t: TabId) => {
    audio.play('tab');
    setTab(t);
    setFresh((f) => f.filter((x) => x !== t && !(t === 'nation' && x === 'labs') && !(t === 'inbox' && x === 'threats')));
  }, []);

  const openCard = useCallback((uid: string) => {
    clearPending();
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
      toast(r.error ?? t('That choice is not available.'));
      return;
    }
    save({ type: 'choice', result: r });
    announce(`${card.title}: ${ch.label}. ${r.text}`);
    setTab('inbox');
    mainRef.current?.scrollTo({ top: 0 });
    setOverlay({ type: 'choice', result: r });
  };

  const afterChoice = (r: ChoiceResult, toDesk = false) => {
    clearPending();
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
      toast(r.error ?? t('That action is not available right now.'));
      return;
    }
    save({ type: 'action', result: r });
    announce(`${r.title}. ${r.text}`);
    mainRef.current?.scrollTo({ top: 0 });
    setOverlay({ type: 'action', result: r });
  };

  const setProgram = (id: ProgramId, level: number) => {
    const r = game.setProgramLevel(id, level);
    if (!r.ok) {
      audio.play('fail', { volume: 0.5 });
      toast(r.reason ?? t('Cannot change that program now.'));
      return;
    }
    setOverlay(null);
    save();
  };

  const endQuarter = useCallback(() => {
    if (turnBusy.current) return;
    if (!game.canEndTurn()) {
      toast(t('Resolve every briefing before ending the quarter.'));
      return;
    }
    turnBusy.current = true;
    const report = game.endTurn();
    save({ type: 'report', report });
    setSheet(null);
    setOverlay({ type: 'report', report });
    announce(t('Quarter ended. {date} begins.', { date: report.dateLabel }));
  }, [game]);

  const afterReport = () => {
    clearPending();
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
    sections,
    selectSection: (panel, section) => {
      setSections(s => ({ ...s, [panel]: section }));
      mainRef.current?.scrollTo({ top: 0 });
    },
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
  const tip = !overlay && !sheet ? view.pendingTips.find(id =>
    ['welcome', 'inbox', 'capacity', 'end_turn', 'low_confidence', 'risk_clock'].includes(id) ? tab === 'inbox' :
    id === 'labs' || id === 'first_deployment' ? tab === 'labs' :
    id === 'nation' || id === 'first_demand' ? tab === 'nation' :
    id === 'world' ? tab === 'world' : id === 'threats' || id === 'first_situation' || id === 'evidence' ? tab === 'threats' : false) : undefined;
  const inlineChoice = overlay?.type === 'choice' && !overlay.result.gameOver && !overlay.result.nextCardUid;
  const inlineAction = overlay?.type === 'action' && !overlay.result.gameOver;

  const panel =
    tab === 'labs' ? <NationPanel companies /> : tab === 'nation' ? <NationPanel /> : tab === 'world' ? <WorldPanel /> : tab === 'threats' ? <ThreatsPanel /> : <InboxPanel />;

  const openCardObj = overlay?.type === 'card' ? view.inbox.find((c) => c.uid === overlay.uid) : undefined;

  return (
    <GameCtx.Provider value={ctx}>
      <div class={cx('game', desktop ? 'game--desktop' : 'game--phone', tip && 'has-tip')} data-country={view.country.id}>
        <Hud hudRef={hudRef} onMeter={(id) => setSheet({ type: 'meter', id })} onRisk={() => setSheet({ type: 'risk' })} onMenu={() => onMenu()} />
        <TabBar tab={tab} onTab={goTab} fresh={fresh} />
        <main class="main" id="main" ref={mainRef} role="tabpanel" aria-labelledby={`tab-${tab === 'labs' ? 'nation' : tab === 'threats' ? 'inbox' : tab}`} key={tab} onScroll={() => { scrollPositions.current[tab] = mainRef.current?.scrollTop ?? 0; }}>
          {(tab === 'inbox' || tab === 'threats') && <nav class="desk-nav" aria-label={t('Desk')}>
            <button type="button" class={cx('btn', tab === 'inbox' && 'btn--accent')} onClick={() => goTab('inbox')}>{t('Briefings')}</button>
            {view.unlockedTabs.includes('threats') && <button type="button" class={cx('btn', tab === 'threats' && 'btn--accent')} data-panel="threats" onClick={() => goTab('threats')}>{t('Threats')} · {view.situations.filter(s => !s.resolved).length}</button>}
            <button type="button" class="btn" onClick={() => setSheet({ type: 'news' })}>{t('News')}</button>
          </nav>}
          {inlineChoice && overlay?.type === 'choice' && <ChoiceResultOverlay inline result={overlay.result} remaining={view.inbox.length} onNext={() => afterChoice(overlay.result)} onDesk={() => { clearPending(); setOverlay(null); }} />}
          {inlineAction && overlay?.type === 'action' && <ActionResultOverlay inline result={overlay.result} onClose={() => { clearPending(); setOverlay(null); }} />}
          {panel}
          {tip && <TipPopup id={tip} onDismiss={() => { game.dismissTip(tip); save(); }} />}
        </main>
        {desktop ? (
          <aside class="side" aria-label={t('Desk')}>
            {tab !== 'inbox' && <InboxStack />}
            <div class="side__end">
              <EndQuarterButton wide />
            </div>
            <section class="side__news" aria-label={t('News')}>
              <h2 class="side__title">
                <span class="live-dot" aria-hidden="true" /> {t('News')}
              </h2>
              <NewsList news={view.news} limit={14} />
            </section>
          </aside>
        ) : tab === 'inbox' && (
          <div class="endbar">
            <EndQuarterButton wide />
          </div>
        )}

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
                subject={t('Threat: {name} ({stage})', { name: s.name, stage: s.stageLabel })}
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
        {overlay?.type === 'choice' && !inlineChoice && (
          <ChoiceResultOverlay result={overlay.result} remaining={view.inbox.length} onNext={() => afterChoice(overlay.result)} onDesk={() => afterChoice(overlay.result, true)} />
        )}
        {overlay?.type === 'action' && !inlineAction && (
          <ActionResultOverlay
            result={overlay.result}
            onClose={() => {
              clearPending();
              if (!finishIfOver()) setOverlay(null);
            }}
          />
        )}
        {overlay?.type === 'report' && <QuarterReport report={overlay.report} onContinue={afterReport} />}
      </div>
    </GameCtx.Provider>
  );
}
