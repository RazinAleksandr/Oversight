/** Small pure helpers shared across the engine. */
import { hashString } from './rng';
import type { CardContext, GameState, SectorId } from './types';

export const SECTORS: SectorId[] = ['business', 'public', 'infrastructure', 'defense'];

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function sum(values: number[]): number {
  let t = 0;
  for (const v of values) t += v;
  return t;
}

export function avg(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

/** Sequential unique id with a prefix, stored in state so it survives save/load. */
export function nextId(s: GameState, prefix: string): string {
  s.idCounter += 1;
  return `${prefix}${s.idCounter}`;
}

/** Deterministic pseudo-noise in [-1, 1] derived from a string (no RNG consumption; used by views). */
export function hashNoise(key: string): number {
  return (hashString(key) / 4294967295) * 2 - 1;
}

export function signed(v: number, digits = 0): string {
  const r = digits ? v.toFixed(digits) : String(Math.round(v));
  return v >= 0 ? `+${r}` : r;
}

/** Lowercases a common-noun phrase for mid-sentence use, keeping acronyms ("Winning the AI race" → "winning the AI race"). */
export function lowerPhrase(text: string): string {
  return text
    .split(' ')
    .map((w) => (/^[A-Z0-9]{2,}/.test(w) ? w : w.toLowerCase()))
    .join(' ');
}

/** True when a word takes "an" (vowel sound), with the common exceptions ("a European", "a unique"). */
export function takesAn(word: string): boolean {
  if (/^(eu|uni|use|usu|ure|one|once)/i.test(word)) return false;
  if (/^(hour|honest|honou?r|heir)/i.test(word)) return true;
  return /^[aeiou]/i.test(word) || /^[FHLMNRSX](\b|[^a-z])/.test(word);
}

/** English possessive: "Lumen's", "Monsoon Commons'". */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function cloneCtx(ctx: CardContext): CardContext {
  const out: CardContext = {};
  if (ctx.companyId) out.companyId = ctx.companyId;
  if (ctx.modelId) out.modelId = ctx.modelId;
  if (ctx.rivalId) out.rivalId = ctx.rivalId;
  if (ctx.situationId) out.situationId = ctx.situationId;
  if (ctx.demandId) out.demandId = ctx.demandId;
  if (ctx.sector) out.sector = ctx.sector;
  return out;
}

export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
