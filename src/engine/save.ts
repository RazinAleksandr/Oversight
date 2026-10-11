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
  if (typeof json !== 'string' || json.length < 2) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Partial<GameState>;
  for (const k of REQUIRED_KEYS) if (s[k] === undefined || s[k] === null) return null;
  if (s.version !== SAVE_VERSION) return null;
  if (!Array.isArray(s.rng) || s.rng.length !== 4 || s.rng.some((n) => typeof n !== 'number')) return null;
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
