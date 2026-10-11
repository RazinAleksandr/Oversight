/** Decision log, quarter highlights and headline triggers. */
import { getLang } from '../i18n';
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

/**
 * Debrief weight of a key decision, from keywords in its *English* text (see endings.ts).
 * Translated lines carry the weight of their English source in `LogEntry.w` instead.
 */
export function debriefWeight(english: string): number {
  const t = english.toLowerCase();
  let weight = 3;
  if (t.includes('accord')) weight = 9;
  if (t.includes('threshold')) weight = 12;
  if (t.includes('broke a promise') || t.includes('lost power')) weight = 6;
  if (t.includes('suspended') || t.includes('restricted') || t.includes('off-switch')) weight = 7;
  return weight;
}

/**
 * Adds a decision-log entry. `key` marks it as a decisive-moment candidate for the debrief.
 * `meta.en` is the English source of a translated line (debrief keywords are matched in English) and
 * `meta.title` an explicit debrief title; both are stored only when the game runs in another language.
 */
export function addLog(s: GameState, text: string, key: boolean, tone?: Tone, refs?: CardContext, meta?: { en?: string; title?: string }): LogEntry {
  const entry: LogEntry = { id: nextId(s, 'l'), turn: s.turn, text, key };
  if (tone) entry.tone = tone;
  if (refs) entry.refs = cloneCtx(refs);
  if (meta && getLang() !== 'en') {
    if (key && meta.en) entry.w = debriefWeight(meta.en);
    if (meta.title) entry.title = meta.title;
  }
  s.log.push(entry);
  return entry;
}

export function bumpStat(s: GameState, key: string, by = 1): void {
  s.stats[key] = (s.stats[key] ?? 0) + by;
}
