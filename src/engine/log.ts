/** Decision log, quarter highlights and headline triggers. */
import type { CardContext, GameState, HeadlineTrigger, LogEntry, Tone, TurnLog } from './types';
import { cloneCtx, nextId } from './util';

export function turnLog(s: GameState): TurnLog {
  if (!s.turnLog) s.turnLog = { triggers: [], highlights: [] };
  return s.turnLog;
}

export function resetTurnLog(s: GameState): void {
  s.turnLog = { triggers: [], highlights: [] };
}

export function trigger(s: GameState, t: HeadlineTrigger, ctx: CardContext = {}, policy?: string): void {
  const entry: TurnLog['triggers'][number] = { trigger: t, ctx: cloneCtx(ctx) };
  if (policy) entry.policy = policy;
  turnLog(s).triggers.push(entry);
}

export function highlight(s: GameState, text: string, tone: Tone, icon?: string): void {
  const h: TurnLog['highlights'][number] = { text, tone };
  if (icon) h.icon = icon;
  turnLog(s).highlights.push(h);
}

/** Adds a decision-log entry. `key` marks it as a decisive-moment candidate for the debrief. */
export function addLog(s: GameState, text: string, key: boolean, tone?: Tone, refs?: CardContext): LogEntry {
  const entry: LogEntry = { id: nextId(s, 'l'), turn: s.turn, text, key };
  if (tone) entry.tone = tone;
  if (refs) entry.refs = cloneCtx(refs);
  s.log.push(entry);
  return entry;
}

export function bumpStat(s: GameState, key: string, by = 1): void {
  s.stats[key] = (s.stats[key] ?? 0) + by;
}
