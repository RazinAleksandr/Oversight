/** Pure derived values over GameState (no mutation, no RNG). */
import type { AIModel, Company, Era, GameState, Rival, SectorId } from './types';
import { avg } from './util';

export function activeCompanies(s: GameState): Company[] {
  return s.companies.filter((c) => c.status !== 'suspended');
}

/** Leading domestic company by true capability. */
export function leadingCompany(s: GameState): Company | undefined {
  let best: Company | undefined;
  for (const c of s.companies) if (!best || c.capability > best.capability) best = c;
  return best;
}

export function domesticBestC(s: GameState): number {
  return leadingCompany(s)?.capability ?? 0;
}

export function leadingRival(s: GameState): Rival | undefined {
  let best: Rival | undefined;
  for (const r of s.rivals) if (!best || r.capability > best.capability) best = r;
  return best;
}

export function bestRivalC(s: GameState): number {
  return leadingRival(s)?.capability ?? 0;
}

export function globalFrontier(s: GameState): number {
  return Math.max(domesticBestC(s), bestRivalC(s));
}

export function eraFor(c: number): Era {
  if (c >= 8.5) return 'threshold';
  if (c >= 6) return 'superhuman';
  if (c >= 3.5) return 'acceleration';
  return 'emergence';
}

export function currentEra(s: GameState): Era {
  return eraFor(globalFrontier(s));
}

export function avgCompanySafety(s: GameState): number {
  return avg(s.companies.map((c) => c.safety));
}

export function dependence(s: GameState): number {
  const a = s.adoption;
  return 0.35 * a.infrastructure + 0.3 * a.public + 0.25 * a.business + 0.1 * a.defense;
}

export const LIVE_STATUSES: ReadonlySet<AIModel['status']> = new Set(['deployed', 'limited', 'restricted', 'rogue_deployed']);

export function liveModels(s: GameState): AIModel[] {
  return s.models.filter((m) => LIVE_STATUSES.has(m.status));
}

export function avgDeployedC(s: GameState): number {
  const live = liveModels(s);
  return live.length ? avg(live.map((m) => m.capability)) : Math.max(1.5, domesticBestC(s) - 1);
}

export function findCompany(s: GameState, id: string | undefined): Company | undefined {
  return id ? s.companies.find((c) => c.id === id) : undefined;
}

export function findModel(s: GameState, id: string | undefined): AIModel | undefined {
  return id ? s.models.find((m) => m.id === id) : undefined;
}

export function findRival(s: GameState, id: string | undefined): Rival | undefined {
  return id ? s.rivals.find((r) => r.id === id) : undefined;
}

export function sectorAdoption(s: GameState, sector: SectorId | null | undefined): number {
  return sector ? s.adoption[sector] : 0;
}

export function openSituations(s: GameState) {
  return s.situations.filter((x) => !x.resolved);
}

export function publicSituations(s: GameState) {
  return s.situations.filter((x) => !x.resolved && x.detected && x.stage >= 2);
}

export function hasPolicy(s: GameState, id: GameState['policies'][number]): boolean {
  return s.policies.includes(id);
}

export function accordActive(s: GameState): boolean {
  return s.accord.signed && s.flags.accordJoined !== false;
}

export function avgTrust(s: GameState): number {
  return avg(s.rivals.map((r) => r.trust));
}

/**
 * The quarter shown to the player. The Threshold finale runs after the last quarter (turn = maxTurns + 1)
 * but is presented as the final quarter, so nothing ever reads "Q1 2031" or "17/16".
 */
export function shownTurn(s: GameState, turn: number = s.turn): number {
  return Math.min(turn, s.maxTurns);
}
