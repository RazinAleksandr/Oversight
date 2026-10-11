/**
 * Public engine entry: the `Game` class implementing `GameAPI`.
 * All mutations go through here; each emits `{type:'change'}` plus a specific event.
 * Invalid input never throws — methods return `{ ok: false, error }` instead.
 */
import { t } from '../i18n';
import { getActionViews, performActionImpl } from './actions';
import { beginCapture, endCapture, visibleChanges } from './changes';
import { checkFailure, computeScores, finishGame, survivalEnding } from './endings';
import { addLog } from './log';
import { dismissTipImpl, releaseTip } from './tips';
import { settleAllDemands } from './systems/government';
import { PROGRAMS, PROGRAM_ORDER } from './data/programs';
import { refreshCard, resolveCard } from './resolve';
import { deserializeState, serializeState } from './save';
import { createInitialState } from './state';
import { endTurnImpl, startFirstTurn } from './turn';
import type {
  ActionId,
  ActionResult,
  ChoiceResult,
  GameAPI,
  GameEvent,
  GameState,
  GameView,
  NewGameOptions,
  ProgramId,
  TipId,
  TurnReport,
} from './types';
import { buildView, clockFor, currentWarnings } from './views';
import { dateLabel } from './labels';
import { riskEstimate } from './fog';
import { shownTurn } from './query';

export const ENGINE_READY = true;

export class Game implements GameAPI {
  private s: GameState;
  private readonly listeners = new Set<(e: GameEvent) => void>();

  constructor(state: GameState) {
    this.s = state;
  }

  get state(): GameState {
    return this.s;
  }

  subscribe(listener: (e: GameEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(e: GameEvent): void {
    for (const l of [...this.listeners]) {
      try {
        l(e);
      } catch {
        // A faulty listener must never break the simulation.
      }
    }
  }

  view(): GameView {
    return buildView(this.s);
  }

  /** Ends the run if a failure condition holds. */
  private checkGameOver(): void {
    if (this.s.gameOver) return;
    const f = checkFailure(this.s);
    if (f) finishGame(this.s, f.id, f.cause);
  }

  resolveChoice(cardUid: string, choiceId: string): ChoiceResult {
    const s = this.s;
    const fail = (error: string, title = ''): ChoiceResult => ({ ok: false, error, cardUid, choiceId, title, text: '', changes: [], newCards: 0, gameOver: s.gameOver });
    if (s.gameOver) return fail(t('The game is over'));
    const card = s.inbox.find((c) => c.uid === cardUid);
    if (!card) return fail(t('Card not found'));
    refreshCard(s, card);
    const choice = card.choices.find((c) => c.id === choiceId);
    if (!choice) return fail(t('Unknown choice'), card.title);
    if (choice.disabled) return fail(choice.disabled, card.title);

    const buf = beginCapture(s);
    const res = resolveCard(s, card, choiceId);
    if (!res.ok) {
      endCapture(s, buf);
      return fail(res.error ?? t('Not possible'), card.title);
    }
    s.inbox = s.inbox.filter((c) => c.uid !== cardUid);
    for (const nc of [...res.newCards].reverse()) s.inbox.unshift(nc);

    if (res.thresholdEnd) {
      // Promises still pending at the end are judged now (they count toward legitimacy).
      if (res.thresholdEnd.success) settleAllDemands(s);
      const failure = checkFailure(s);
      if (failure) finishGame(s, failure.id, failure.cause);
      else if (res.thresholdEnd.success) finishGame(s, survivalEnding(s, computeScores(s)));
      else finishGame(s, res.thresholdEnd.failureId ?? 'loss_of_control', res.text);
    } else {
      this.checkGameOver();
    }
    const changes = visibleChanges(endCapture(s, buf));
    const result: ChoiceResult = {
      ok: true,
      cardUid,
      choiceId,
      title: res.title ?? card.title,
      text: res.text,
      changes,
      newCards: res.newCards.length,
      gameOver: s.gameOver,
    };
    if (res.success !== undefined) result.success = res.success;
    const stamp = res.stamp ?? choice.stamp;
    if (stamp) result.stamp = stamp;
    if (res.newCards[0]) result.nextCardUid = res.newCards[0].uid;
    if (!s.gameOver) releaseTip(s);
    this.emit({ type: 'choice', result });
    if (s.gameOver && s.ending) this.emit({ type: 'gameover', ending: s.ending });
    this.emit({ type: 'change' });
    return result;
  }

  getActions() {
    return getActionViews(this.s);
  }

  performAction(actionId: ActionId, targetId?: string, optionId?: string): ActionResult {
    const s = this.s;
    if (s.gameOver) return { ok: false, error: t('The game is over'), title: '', text: '', changes: [], newCards: 0, gameOver: true };
    const buf = beginCapture(s);
    const out = performActionImpl(s, actionId, targetId, optionId);
    if (out.ok) this.checkGameOver();
    const changes = visibleChanges(endCapture(s, buf));
    const result: ActionResult = {
      ok: out.ok,
      title: out.title,
      text: out.text,
      changes,
      newCards: out.newCards ?? 0,
      gameOver: s.gameOver,
    };
    if (out.error) result.error = out.error;
    if (out.success !== undefined) result.success = out.success;
    if (out.revealed) result.revealed = out.revealed;
    if (out.ok) {
      if (!s.gameOver) releaseTip(s);
      this.emit({ type: 'action', result });
      if (s.gameOver && s.ending) this.emit({ type: 'gameover', ending: s.ending });
      this.emit({ type: 'change' });
    }
    return result;
  }

  setProgramLevel(id: ProgramId, level: number): { ok: boolean; reason?: string } {
    const s = this.s;
    if (s.gameOver) return { ok: false, reason: t('The game is over') };
    if (!PROGRAM_ORDER.includes(id)) return { ok: false, reason: t('Unknown program') };
    const def = PROGRAMS[id];
    if (!Number.isInteger(level) || level < 0 || level > 3) return { ok: false, reason: t('Level must be 0–3') };
    if (!s.unlockedTabs.includes('nation') && level > (s.programs[id] ?? 0)) return { ok: false, reason: t('Programs unlock next quarter') };
    const current = s.programs[id] ?? 0;
    if (level === current) return { ok: true };
    if (level > current && def.costs[level] > s.budget) return { ok: false, reason: t('Not enough budget for this level') };
    s.programs[id] = level;
    addLog(s, t('{program} set to level {level}.', { program: def.name, level }), false, 'neutral');
    this.emit({ type: 'change' });
    return { ok: true };
  }

  dismissTip(id: TipId): void {
    const s = this.s;
    dismissTipImpl(s, id);
    this.emit({ type: 'change' });
  }

  canEndTurn(): boolean {
    return !this.s.gameOver && this.s.inbox.length === 0;
  }

  endTurn(): TurnReport {
    const s = this.s;
    if (!this.canEndTurn()) return this.noopReport(s.gameOver ? t('The game is over') : t('Resolve all briefings first'));
    const report = endTurnImpl(s);
    this.emit({ type: 'turn', report });
    if (s.gameOver && s.ending) this.emit({ type: 'gameover', ending: s.ending });
    this.emit({ type: 'change' });
    return report;
  }

  private noopReport(warning: string): TurnReport {
    const s = this.s;
    const r = riskEstimate(s).estimate;
    const meters = {} as TurnReport['meters'];
    for (const id of ['confidence', 'economy', 'stability', 'security'] as const) {
      meters[id] = { from: Math.round(s.meters[id]), to: Math.round(s.meters[id]), reasons: [] };
    }
    return {
      fromTurn: shownTurn(s),
      toTurn: shownTurn(s),
      dateLabel: dateLabel(shownTurn(s)),
      meters,
      budget: { from: s.budget, to: s.budget, income: 0, upkeep: 0 },
      risk: { from: r, to: r, trend: 'flat', clock: clockFor(r).clock },
      headlines: [],
      highlights: [],
      warnings: [warning, ...currentWarnings(s)],
      newCards: s.inbox.length,
      gameOver: s.gameOver,
    };
  }

  serialize(): string {
    return serializeState(this.s);
  }
}

export function newGame(opts: NewGameOptions): Game {
  const s = createInitialState(opts);
  startFirstTurn(s);
  return new Game(s);
}

export function loadGame(json: string): Game | null {
  const s = deserializeState(json);
  return s ? new Game(s) : null;
}
