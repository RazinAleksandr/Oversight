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
import { DESKTOP_QUERY, useMedia } from '../hooks';
import { announce, cx, isInteractiveTarget } from '../util';
import { closeTopSheet, sheetsOpen } from '../components/Sheet';
import { ActionSheet, responseAsAction } from './ActionSheet';
import { CompanyInspector, PilotOutcome } from './CompanyInspector';
import { DeploymentWorkspace } from './DeploymentWorkspace';
import { newTask, readTask, writeTask, type TaskDraft } from './taskDraft';
import { GameCtx, type GameCtxValue } from './context';
import { MeterSheet, RiskSheet, METER_ORDER } from './Hud';
import { isCrisisCard } from './Inbox';
import { CommandBar, CommandNav, QuarterAgenda, NationalStatus } from './CommandShell';
import { NewsSheet } from './News';
import { QuarterReport } from './QuarterReport';
import { ActionResultOverlay, ChoiceResultOverlay } from './Results';
import { TABS } from './TabBar';
import { AdvisorHelp } from './Tips';
import { GuidedCoach } from '../components/GuidedCoach';
import { deriveGuide, readGuide, startGuide, writeGuide, type GuideProgress } from './playGuide';
import { LabsPanel } from './panels/LabsPanel';
import { NationPanel } from './panels/NationPanel';
import { ThreatsPanel } from './panels/ThreatsPanel';
import { WorldPanel } from './panels/WorldPanel';

type Overlay =
  | { type: 'card'; uid: string }
  | { type: 'choice'; result: ChoiceResult; pilot?: boolean }
  | { type: 'action'; result: ActionResult; returnToCard?: string }
  | { type: 'report'; report: TurnReport }
  | null;

type SheetState =
  | { type: 'meter'; id: MeterId }
  | { type: 'risk' }
  | { type: 'status' }
  | { type: 'tip' }
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
  guideRequest?: number;
  guideSuspended?: boolean;
}

function managementSections(route?: TaskDraft['management']): Record<string,string> {
  if (!route) return {};
  const sections: Record<string,string> = {};
  if (route.section) sections[route.tab] = route.section;
  if (route.target) {
    const key = route.tab === 'labs' ? 'company' : route.tab === 'threats' ? 'threat' : route.tab === 'world' ? 'rival' : route.section === 'government' ? 'demand' : route.section === 'programs' ? 'program' : 'policy';
    sections[key] = route.target;
    if (route.tab === 'world') sections.world = route.target;
  }
  return sections;
}

export function GameScreen({ game, onEnding, onMenu, initialReport, guideRequest = 0, guideSuspended = false }: GameScreenProps): JSX.Element {
  const [version, setVersion] = useState(0);
  const [guide, setGuide] = useState<GuideProgress | null>(() => readGuide(game.view()));
  const guideRequestSeen = useRef(guideRequest);
  const updateGuide = (next: GuideProgress | null) => { writeGuide(next); setGuide(next); };
  useEffect(() => {
    if (guideRequest > guideRequestSeen.current) {
      guideRequestSeen.current = guideRequest;
      updateGuide(startGuide(game.view()));
    }
  }, [guideRequest]);
  const initialTask = useRef(readTask(game.view()));
  const [tab, setTab] = useState<TabId>(() => initialTask.current?.active && initialTask.current.route === 'management' ? initialTask.current.management?.tab ?? 'inbox' : 'inbox');
  const [sections, setSections] = useState<Record<string, string>>(() => managementSections(initialTask.current?.management));
  const scrollPositions = useRef<Partial<Record<TabId, number>>>({});
  const [task, setTask] = useState<TaskDraft | null>(initialTask.current);
  const taskRef = useRef(task);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const updateTask = useCallback((next: TaskDraft | null, defer = false) => {
    taskRef.current = next;
    setTask(next);
    clearTimeout(draftTimer.current);
    if (defer) draftTimer.current = setTimeout(() => writeTask(taskRef.current), 250);
    else writeTask(next);
  }, []);
  useEffect(() => {
    const flush = () => { clearTimeout(draftTimer.current); writeTask(taskRef.current); };
    const visibility = () => { if (document.hidden) flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    // Do not rewrite an old run's draft while a new/imported game is mounting.
    return () => { clearTimeout(draftTimer.current); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const [overlay, setOverlay] = useState<Overlay>(() => initialReport ? { type: 'report', report: initialReport }
    : readPending() ?? (initialTask.current?.active && initialTask.current.route !== 'management' ? { type: 'card', uid: initialTask.current.uid } : null));
  const choiceBusy = useRef(false);
  const investigationBusy = useRef(false);
  const actionBusy = useRef(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [fresh, setFresh] = useState<TabId[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const desktop = useMedia(DESKTOP_QUERY);
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
    choiceBusy.current = false;
    investigationBusy.current = false;
    setInspectionError(null);
    const current = game.view();
    const card = current.inbox.find(c => c.uid === uid);
    if (card) {
      const previous = taskRef.current;
      updateTask(previous?.uid === uid && previous.turn === current.turn
        ? { ...previous, active: true, route: 'decision' } : newTask(current, uid));
    } else if (taskRef.current) updateTask({ ...taskRef.current, active: false });
    setSheet(null);
    setOverlay({ type: 'card', uid });
  }, [game, updateTask]);

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
    if (choiceBusy.current) return;
    choiceBusy.current = true;
    const r = game.resolveChoice(card.uid, ch.id);
    if (!r.ok) {
      choiceBusy.current = false;
      audio.play('fail', { volume: 0.5 });
      toast(r.error ?? t('That choice is not available.'));
      return;
    }
    if (guide) updateGuide({ ...guide, lastDecisionKind: card.kind });
    const pilot = true;
    if (taskRef.current?.uid === card.uid) updateTask(null);
    save({ type: 'choice', result: r, ...(pilot ? { pilot: true } : {}) });
    announce(`${card.title}: ${ch.label}. ${r.text}`);
    setTab('inbox');
    mainRef.current?.scrollTo({ top: 0 });
    setOverlay({ type: 'choice', result: r, pilot });
  };

  const afterChoice = (r: ChoiceResult, toDesk = false) => {
    clearPending();
    if (finishIfOver()) return;
    const v = game.view();
    if (r.nextCardUid && v.inbox.some((c) => c.uid === r.nextCardUid)) return openCard(r.nextCardUid);
    if (!toDesk && v.inbox.length) return openCard(v.inbox[0].uid);
    setOverlay(null);
    if (tab !== 'inbox' && !desktop) setTab('inbox');
  };

  function openManagement(nextTab: TabId, section?: string, target?: string) {
    if (!game.view().unlockedTabs.includes(nextTab)) return;
    const management = { tab: nextTab, section, target };
    if (overlay?.type === 'card' && taskRef.current) updateTask({ ...taskRef.current, active: true, route: 'management', management });
    setSections(s => ({ ...s, ...managementSections(management) }));
    setSheet(null); setOverlay(null); goTab(nextTab);
  }

  const perform = (id: ActionId, targetId?: string, optionId?: string) => {
    if (actionBusy.current) return;
    actionBusy.current = true;
    const r = game.performAction(id, targetId, optionId);
    setSheet(null);
    if (!r.ok) {
      actionBusy.current = false;
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

  const returnToDecision = (uid: string) => {
    clearPending();
    investigationBusy.current = false;
    setInspectionError(null);
    if (finishIfOver()) { updateTask(null); return; }
    const current = game.view();
    const card = current.inbox.find(c => c.uid === uid);
    if (!card) {
      updateTask(null);
      setOverlay(null);
      toast(t('This decision has already been resolved.'));
      return;
    }
    const previous = taskRef.current;
    updateTask(previous?.uid === uid ? { ...previous, route: 'decision', active: true } : newTask(current, uid));
    setOverlay({ type: 'card', uid });
  };

  const investigateForDecision = (uid: string, companyId: string) => {
    if (investigationBusy.current) return;
    investigationBusy.current = true;
    // Revalidate the current task and its bound target immediately before mutation.
    const current = game.view();
    const card = current.inbox.find(c => c.uid === uid && c.kind === 'deployment');
    const model = current.models.find(m => m.id === card?.ctx.modelId);
    if (!card || model?.companyId !== companyId) {
      investigationBusy.current = false;
      returnToDecision(uid);
      return;
    }
    const r = game.performAction('investigate_company', companyId);
    if (!r.ok) {
      investigationBusy.current = false;
      setInspectionError(r.error ?? t('That action is not available right now.'));
      announce(r.error ?? t('That action is not available right now.'));
      return;
    }
    save({ type: 'action', result: r, returnToCard: uid });
    if (taskRef.current) updateTask({ ...taskRef.current, route: 'decision' });
    announce(`${r.title}. ${r.text}`);
    setOverlay({ type: 'action', result: r, returnToCard: uid });
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
    updateTask(null);
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
    openAction: (id, targetId, optionId) => { actionBusy.current = false; setSheet({ type: 'action', id, targetId, optionId }); },
    openResponse: (situationId, responseId) => { actionBusy.current = false; setSheet({ type: 'response', situationId, responseId }); },
    setProgram,
    goTab,
    openManagement,
    endQuarter,
    toast,
    openNews: () => setSheet({ type: 'news' }),
  };

  // Tips show only when nothing else demands attention.
  const tip = !overlay ? view.pendingTips.find(id =>
    ['welcome', 'inbox', 'capacity', 'end_turn', 'low_confidence', 'risk_clock'].includes(id) ? tab === 'inbox' :
    id === 'labs' || id === 'first_deployment' ? tab === 'labs' :
    id === 'nation' || id === 'first_demand' ? tab === 'nation' :
    id === 'world' ? tab === 'world' : id === 'threats' || id === 'first_situation' || id === 'evidence' ? tab === 'threats' : false) : undefined;
  const inlineChoice = false;
  const inlineAction = false;

  const panel =
    tab === 'labs' ? <LabsPanel /> : tab === 'nation' ? <NationPanel /> : tab === 'world' ? <WorldPanel /> : tab === 'threats' ? <ThreatsPanel /> : <QuarterAgenda />;

  const openCardObj = overlay?.type === 'card' ? view.inbox.find((c) => c.uid === overlay.uid) : undefined;
  const guideStep = guide ? deriveGuide({ view, guide,
    route: sheet ? 'other' : overlay?.type === 'report' ? 'report' : overlay?.type === 'choice' ? 'result'
      : overlay?.type === 'card' && task?.route === 'decision' ? (task.reading.pane === 'options' ? 'options' : 'brief')
      : !overlay && tab === 'inbox' ? 'agenda' : 'other',
    card: openCardObj, selectedId: task?.selectedId,
    suspended: guideSuspended || !!sheet,
  }) : null;


  return (
    <GameCtx.Provider value={ctx}>
      <div class={cx('game command-game', desktop ? 'game--desktop' : 'game--phone')} data-country={view.country.id}>
        <CommandBar onStatus={() => setSheet({type:'status'})} onRisk={() => setSheet({type:'risk'})} onMenu={() => onMenu()} onHelp={tip?()=>setSheet({type:'tip'}):undefined} />
        <CommandNav tab={tab} onTab={goTab} />
        <main class="main command-main" id="main" ref={mainRef} role="tabpanel" aria-labelledby={`tab-${tab}`} onScroll={() => { scrollPositions.current[tab] = mainRef.current?.scrollTop ?? 0; }}>
          {task?.active && task.route === 'management' && <div class="command-return"><button type="button" data-return-task onClick={() => returnToDecision(task.uid)}>← {t('Return to decision')}</button><span>{view.inbox.find(c=>c.uid===task.uid)?.title}</span></div>}
          {panel}
        </main>

        {toastMsg && (
          <div class="toast" role="status">
            {toastMsg}
          </div>
        )}

        {/* Sheets */}
        {sheet?.type === 'tip' && tip && <AdvisorHelp id={tip} onClose={()=>setSheet(null)} onDismiss={()=>{game.dismissTip(tip);save();setSheet(null);}}/>}
        {sheet?.type === 'status' && <NationalStatus onClose={() => setSheet(null)} onMeter={id => setSheet({type:'meter',id})} />}
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
        {openCardObj && task?.uid === openCardObj.uid && (
          task.route === 'company' && openCardObj.kind === 'deployment' ? <CompanyInspector card={openCardObj} error={inspectionError}
            onReturn={() => returnToDecision(openCardObj.uid)}
            onInvestigate={companyId => investigateForDecision(openCardObj.uid, companyId)} />
          : <DeploymentWorkspace key={openCardObj.uid} card={openCardObj} selectedId={task.selectedId}
              reading={task.reading}
              onReadingChange={reading => { if (taskRef.current) updateTask({ ...taskRef.current, reading }, true); }}
              onSelect={selectedId => { if (taskRef.current) updateTask({ ...taskRef.current, selectedId }); }}
              onInspect={() => { investigationBusy.current = false; setInspectionError(null); if (taskRef.current) updateTask({ ...taskRef.current, route: 'company' }); }}
              onClose={() => { if (taskRef.current) updateTask({ ...taskRef.current, active: false }); setOverlay(null); }}
              onManage={openManagement}
              onChoose={ch => choose(openCardObj, ch)} />
        )}
        {overlay?.type === 'choice' && overlay.pilot && <PilotOutcome result={overlay.result} remaining={view.inbox.length}
          onNext={() => afterChoice(overlay.result)} onDesk={() => afterChoice(overlay.result, true)} />}
        {overlay?.type === 'choice' && !overlay.pilot && !inlineChoice && (
          <ChoiceResultOverlay result={overlay.result} remaining={view.inbox.length} onNext={() => afterChoice(overlay.result)} onDesk={() => afterChoice(overlay.result, true)} />
        )}
        {overlay?.type === 'action' && overlay.returnToCard && <PilotOutcome investigation result={overlay.result}
          onNext={() => returnToDecision(overlay.returnToCard!)} />}
        {overlay?.type === 'action' && !overlay.returnToCard && !inlineAction && (
          <ActionResultOverlay
            result={overlay.result}
            onClose={() => {
              clearPending();
              if (!finishIfOver()) setOverlay(null);
            }}
          />
        )}
        {overlay?.type === 'report' && <QuarterReport report={overlay.report} onContinue={afterReport} onManage={(tab,section,target)=>{ afterReport(); openManagement(tab,section,target); }} />}
        {guide && guideStep && <GuidedCoach stepId={guideStep.id} title={guideStep.title} body={guideStep.body}
          target={guideStep.target} onSkip={() => updateGuide(null)}
          onNext={guideStep.ack ? () => updateGuide(guideStep.ack === 'welcome' ? { ...guide, welcomed: true } : { ...guide, completed: true }) : undefined}
          nextLabel={guideStep.ack === 'finish' ? t('Keep playing') : t('Show me where to start')}
        />}

      </div>
    </GameCtx.Provider>
  );
}
