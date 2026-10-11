/**
 * The single entry point for changing any meter or resource. It clamps, applies confidence volatility,
 * records a `MeterChange` (merged per quarter+reason to keep saves small) and feeds any active capture
 * buffers (used to report "what changed" for a single choice/action/turn).
 */
import { getMods } from './modifiers';
import type { CountryId, EvidenceToken, GameState, MeterChange, MeterId, PreviewKey, SectorId } from './types';
import { clamp, nextId } from './util';

const METERS: ReadonlySet<string> = new Set(['confidence', 'economy', 'stability', 'security']);

/** Keys whose values are hidden from the player; never surfaced in results/reports. */
export const HIDDEN_KEYS: ReadonlySet<PreviewKey> = new Set<PreviewKey>(['risk', 'capability']);

const captures = new WeakMap<GameState, MeterChange[][]>();

export function beginCapture(s: GameState): MeterChange[] {
  const buf: MeterChange[] = [];
  const stack = captures.get(s) ?? [];
  stack.push(buf);
  captures.set(s, stack);
  return buf;
}

export function endCapture(s: GameState, buf: MeterChange[]): MeterChange[] {
  const stack = captures.get(s);
  if (stack) {
    const i = stack.indexOf(buf);
    if (i >= 0) stack.splice(i, 1);
  }
  return buf;
}

/** Player-safe, merged copy of captured changes. */
export function visibleChanges(buf: MeterChange[]): MeterChange[] {
  const out: MeterChange[] = [];
  for (const c of buf) {
    if (HIDDEN_KEYS.has(c.key)) continue;
    const prev = out.find((o) => o.key === c.key && o.reason === c.reason);
    if (prev) prev.delta += c.delta;
    else out.push({ ...c });
  }
  return out.filter((c) => Math.abs(c.delta) >= 0.05);
}

function record(s: GameState, key: PreviewKey, delta: number, reason: string): void {
  if (Math.abs(delta) < 1e-6) return;
  const entry: MeterChange = { key, delta, reason, turn: s.turn };
  for (const buf of captures.get(s) ?? []) buf.push({ ...entry });
  // Merge with a recent identical record from the same quarter.
  const list = s.changes;
  for (let i = list.length - 1, n = 0; i >= 0 && n < 60; i--, n++) {
    const c = list[i];
    if (c.turn !== s.turn) break;
    if (c.key === key && c.reason === reason) {
      c.delta += delta;
      return;
    }
  }
  list.push(entry);
}

/** Multiplier applied to every confidence change (e.g. Atlantic "Polarized" ×1.3). */
export function confidenceScale(s: GameState): number {
  return Math.max(0, 1 + getMods(s).confidenceVolatility);
}

/** The confidence amount the player will actually feel; shown numbers use this and are applied raw. */
export function effectiveConfidence(s: GameState, v: number): number {
  return Math.round(v * confidenceScale(s) * 10) / 10;
}

/**
 * Changes one of the four national meters. Returns the applied delta.
 * Confidence changes are scaled by `confidenceVolatility` unless `raw` (used for resets).
 */
export function changeMeter(s: GameState, id: MeterId, delta: number, reason: string, raw = false): number {
  if (!Number.isFinite(delta) || delta === 0) return 0;
  let d = delta;
  if (id === 'confidence' && !raw) d *= 1 + getMods(s).confidenceVolatility;
  const before = s.meters[id];
  const after = clamp(before + d, 0, 100);
  const applied = after - before;
  s.meters[id] = after;
  record(s, id, applied, reason);
  return applied;
}

/** Hidden global risk; also tracked by source key for the debrief and failure typing. */
export function changeRisk(s: GameState, delta: number, reason: string, sourceKey = 'events'): number {
  if (!Number.isFinite(delta) || delta === 0) return 0;
  const before = s.risk;
  s.risk = clamp(before + delta, 0, 100);
  const applied = s.risk - before;
  if (applied > 0) {
    s.riskSources = s.riskSources ?? {};
    s.riskSources[sourceKey] = (s.riskSources[sourceKey] ?? 0) + applied;
  }
  record(s, 'risk', applied, reason);
  return applied;
}

/** Generic resource changes (budget, capacity, safeguards, displacement, tension, accord, income). */
export function changeResource(
  s: GameState,
  key: 'budget' | 'capacity' | 'safeguards' | 'displacement' | 'tension' | 'accord' | 'income',
  delta: number,
  reason: string,
): number {
  if (!Number.isFinite(delta) || delta === 0) return 0;
  let applied = delta;
  switch (key) {
    case 'budget':
      s.budget += delta;
      break;
    case 'capacity': {
      const before = s.capacity;
      s.capacity = Math.max(0, s.capacity + delta);
      applied = s.capacity - before;
      break;
    }
    case 'safeguards': {
      const before = s.safeguards;
      s.safeguards = clamp(s.safeguards + delta, 0, 10);
      applied = s.safeguards - before;
      break;
    }
    case 'displacement': {
      const before = s.displacement;
      s.displacement = clamp(s.displacement + delta, 0, 100);
      applied = s.displacement - before;
      break;
    }
    case 'tension': {
      const before = s.tension;
      s.tension = clamp(s.tension + delta, 0, 100);
      applied = s.tension - before;
      break;
    }
    case 'accord': {
      if (s.accord.signed) return 0;
      const before = s.accord.progress;
      s.accord.progress = clamp(s.accord.progress + delta, 0, 100);
      applied = s.accord.progress - before;
      break;
    }
    case 'income': {
      const prev = s.flags.incomeBonus;
      s.flags.incomeBonus = (typeof prev === 'number' ? prev : 0) + delta;
      s.income += delta;
      break;
    }
  }
  record(s, key, applied, reason);
  return applied;
}

/** Adoption target in one sector (respects the infrastructure firewall cap). */
export function changeAdoptionTarget(s: GameState, sector: SectorId, delta: number, reason: string): number {
  if (!Number.isFinite(delta) || delta === 0) return 0;
  const cap = sector === 'infrastructure' ? infraCap(s) : 100;
  const before = s.adoptionTarget[sector];
  s.adoptionTarget[sector] = clamp(before + delta, 0, cap);
  const applied = s.adoptionTarget[sector] - before;
  record(s, 'adoption', applied, reason);
  return applied;
}

export function infraCap(s: GameState): number {
  const cap = getMods(s).infraAdoptionCap;
  return cap > 0 ? cap : 100;
}

export function changeCompanyRelation(s: GameState, companyId: string, delta: number, reason: string): number {
  const c = s.companies.find((x) => x.id === companyId);
  if (!c || !Number.isFinite(delta) || delta === 0) return 0;
  const before = c.relation;
  c.relation = clamp(c.relation + delta, 0, 100);
  const applied = c.relation - before;
  record(s, 'company', applied, `${c.name}: ${reason}`);
  return applied;
}

export function changeRivalTrust(s: GameState, rivalId: CountryId, delta: number, reason: string): number {
  const r = s.rivals.find((x) => x.id === rivalId);
  if (!r || !Number.isFinite(delta) || delta === 0) return 0;
  const before = r.trust;
  r.trust = clamp(r.trust + delta, 0, 100);
  const applied = r.trust - before;
  record(s, 'rival', applied, `${r.name}: ${reason}`);
  return applied;
}

/** Capability of a company or rival (hidden; recorded under the hidden 'capability' key). */
export function changeCapability(s: GameState, target: { companyId?: string; rivalId?: CountryId }, delta: number, reason: string): number {
  if (!Number.isFinite(delta) || delta === 0) return 0;
  if (target.companyId) {
    const c = s.companies.find((x) => x.id === target.companyId);
    if (!c) return 0;
    const before = c.capability;
    c.capability = clamp(c.capability + delta, 0, 10);
    const applied = c.capability - before;
    c.reportedCapability = clamp(c.reportedCapability + applied, 0, 10);
    record(s, 'capability', applied, `${c.name}: ${reason}`);
    return applied;
  }
  if (target.rivalId) {
    const r = s.rivals.find((x) => x.id === target.rivalId);
    if (!r) return 0;
    const before = r.capability;
    r.capability = clamp(r.capability + delta, 0, 10);
    const applied = r.capability - before;
    record(s, 'capability', applied, `${r.name}: ${reason}`);
    return applied;
  }
  return 0;
}

export function isMeter(key: string): key is MeterId {
  return METERS.has(key);
}

/** Adds an Evidence token (optionally about a company or rival). */
export function addEvidence(s: GameState, text: string, about: { companyId?: string; rivalId?: CountryId } = {}, reason = 'Evidence gathered'): EvidenceToken {
  const token: EvidenceToken = { id: nextId(s, 'e'), text, turn: s.turn };
  if (about.companyId) token.companyId = about.companyId;
  if (about.rivalId) token.rivalId = about.rivalId;
  s.evidence.push(token);
  record(s, 'evidence', 1, reason);
  return token;
}

/** Spends one Evidence token, preferring one about the given company/rival. */
export function spendEvidence(s: GameState, reason: string, prefer?: { companyId?: string; rivalId?: string }): boolean {
  if (s.evidence.length === 0) return false;
  let idx = -1;
  if (prefer?.companyId) idx = s.evidence.findIndex((e) => e.companyId === prefer.companyId);
  if (idx < 0 && prefer?.rivalId) idx = s.evidence.findIndex((e) => e.rivalId === prefer.rivalId);
  if (idx < 0) idx = s.evidence.findIndex((e) => !e.companyId && !e.rivalId);
  if (idx < 0) idx = 0;
  s.evidence.splice(idx, 1);
  record(s, 'evidence', -1, reason);
  return true;
}
