/** Save/load: versioned JSON of the full GameState (which holds the RNG state). */
import { SAVE_VERSION } from './state';
import type { GameState } from './types';

export function serializeState(s: GameState): string {
  return JSON.stringify(s);
}

const REQUIRED_KEYS: (keyof GameState)[] = [
  'version', 'seed', 'rng', 'difficulty', 'countryId', 'turn', 'meters', 'companies', 'rivals', 'government',
  'inbox', 'queue', 'situations', 'models', 'programs', 'policies', 'flags', 'stats', 'adoption', 'adoptionTarget',
];

/** Parses and validates a save; returns null on any problem. */
export function deserializeState(json: string): GameState | null {
  if (typeof json !== 'string' || json.length < 2 || json.length > 8 * 1024 * 1024) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const safeTree = (value: unknown, depth = 0): boolean => {
    if (depth > 40) return false;
    if (typeof value === 'number') return Number.isFinite(value);
    if (value === null || typeof value !== 'object') return true;
    return Object.entries(value).every(([key, child]) => !['__proto__', 'constructor', 'prototype'].includes(key) && safeTree(child, depth + 1));
  };
  if (!safeTree(raw)) return null;
  const s = raw as Partial<GameState>;
  for (const k of REQUIRED_KEYS) if (s[k] === undefined || s[k] === null) return null;
  if (s.version !== SAVE_VERSION) return null;
  if (!['atlantic', 'hanzhou', 'commonwealth', 'meridian'].includes(s.countryId!) || !['analyst', 'director', 'doomer'].includes(s.difficulty!)) return null;
  const numbers: (keyof GameState)[] = ['seed', 'turn', 'maxTurns', 'budget', 'income', 'capacity', 'capacityMax', 'safeguards', 'displacement', 'risk', 'riskBias', 'tension', 'idCounter'];
  if (numbers.some(k => typeof s[k] !== 'number' || !Number.isFinite(s[k]))) return null;
  if (!Number.isInteger(s.turn) || s.turn! < 1 || s.turn! > s.maxTurns! + 1 || s.maxTurns !== 16) return null;
  if (typeof s.gameOver !== 'boolean') return null;
  const numericRecord = (v: unknown, keys: string[]) => !!v && typeof v === 'object' && keys.every(k => typeof (v as Record<string, unknown>)[k] === 'number');
  if (!numericRecord(s.meters, ['confidence', 'economy', 'stability', 'security']) || !numericRecord(s.programs, ['safety', 'oversight', 'compute', 'workforce', 'defense'])) return null;
  if (Object.values(s.programs!).some(v => !Number.isInteger(v) || v < 0 || v > 3)) return null;
  for (const record of [s.flags, s.stats]) if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  if (!Array.isArray(s.policies) || s.policies.some(p => typeof p !== 'string')) return null;
  for (const v of [s.adoption, s.adoptionTarget]) if (!numericRecord(v, ['business', 'public', 'infrastructure', 'defense'])) return null;
  if (!s.accord || typeof s.accord.progress !== 'number' || typeof s.accord.signed !== 'boolean') return null;
  if (!s.government || !['accelerationist', 'hawk', 'cautious', 'populist'].includes(s.government.stance) || !Array.isArray(s.government.calendar)) return null;
  for (const key of ['companies', 'rivals', 'models', 'situations', 'inbox', 'queue'] as const) {
    if (!Array.isArray(s[key]) || s[key]!.some(x => !x || typeof x !== 'object')) return null;
  }
  for (const c of [...s.inbox!, ...s.queue!]) {
    if (typeof c.uid !== 'string' || typeof c.templateId !== 'string' || typeof c.title !== 'string' || typeof c.body !== 'string' || !c.source || !c.ctx || !Array.isArray(c.choices)) return null;
    if (c.choices.some(ch => !ch || typeof ch.id !== 'string' || typeof ch.label !== 'string' || !Array.isArray(ch.preview))) return null;
  }
  if (!Array.isArray(s.rng) || s.rng.length !== 4 || s.rng.some((n) => !Number.isInteger(n))) return null;
  if (!Array.isArray(s.companies) || !Array.isArray(s.rivals) || !Array.isArray(s.inbox)) return null;
  const full = s as GameState;
  full.changes = Array.isArray(full.changes) ? full.changes : [];
  full.news = Array.isArray(full.news) ? full.news : [];
  full.log = Array.isArray(full.log) ? full.log : [];
  full.scheduled = Array.isArray(full.scheduled) ? full.scheduled : [];
  full.evidence = Array.isArray(full.evidence) ? full.evidence : [];
  full.demands = Array.isArray(full.demands) ? full.demands : [];
  full.firedEvents = full.firedEvents ?? {};
  full.pendingTips = Array.isArray(full.pendingTips) ? full.pendingTips : [];
  full.tipBacklog = Array.isArray(full.tipBacklog) ? full.tipBacklog : [];
  full.tipsShown = Array.isArray(full.tipsShown) ? full.tipsShown : [];
  full.unlockedTabs = Array.isArray(full.unlockedTabs) ? full.unlockedTabs : ['inbox', 'labs'];
  full.meterHistory = full.meterHistory ?? { confidence: [], economy: [], stability: [], security: [] };
  full.riskHistory = Array.isArray(full.riskHistory) ? full.riskHistory : [];
  return full;
}
