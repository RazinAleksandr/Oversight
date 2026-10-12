/**
 * Compact economy & society model (GDD §5) plus budget income/upkeep (GDD §9.1).
 * Every term is recorded as a named reason so the UI can explain each meter move.
 */
import { listJoinL, t } from '../../i18n';
import { adoptionStep } from '../adoption';
import { changeAdoptionTarget, changeMeter, changeResource, infraCap } from '../changes';
import { getCountry } from '../content';
import { PROGRAMS, PROGRAM_ORDER } from '../data/programs';
import { SECTOR_INFO } from '../labels';
import { highlight } from '../log';
import { flagNum, getMods, modSources } from '../modifiers';
import { avgDeployedC, currentEra, domesticBestC, hasPolicy, leadingRival } from '../query';
import type { GameState, Modifiers, SectorId } from '../types';
import { SECTORS, clamp } from '../util';
import type { TickCtx } from './tick';

export function computeIncome(s: GameState, mods: Modifiers = getMods(s)): number {
  const country = getCountry(s.countryId);
  const conf = s.meters.confidence;
  const confAdj = conf >= 60 ? 2 : conf < 30 ? -2 : 0;
  return Math.round((country.incomeBase + s.meters.economy / 10 - 7 + confAdj + mods.incomePerTurn + flagNum(s, 'incomeBonus')) * 10) / 10;
}

/** Upkeep for current program levels (the intro "Safety first" choice waives safety L1 for 2 quarters). */
export function programUpkeep(s: GameState): number {
  let total = 0;
  for (const id of PROGRAM_ORDER) {
    const lvl = s.programs[id] ?? 0;
    let cost = PROGRAMS[id].costs[lvl] ?? 0;
    if (id === 'safety' && flagNum(s, 'freeSafetyUntil') >= s.turn) cost = Math.max(0, cost - PROGRAMS.safety.costs[1]);
    total += cost;
  }
  return total;
}

/** Income in, upkeep out. Programs auto-downgrade (most expensive first) if the treasury can't cover them. */
export function applyBudget(s: GameState, tc: TickCtx): { income: number; upkeep: number } {
  const income = computeIncome(s);
  changeResource(s, 'budget', income, t('Quarterly income'));
  let upkeep = programUpkeep(s);
  const downgraded: string[] = [];
  while (upkeep > s.budget) {
    const candidates = PROGRAM_ORDER.filter((id) => (s.programs[id] ?? 0) > 0).sort(
      (a, b) => PROGRAMS[b].costs[s.programs[b]] - PROGRAMS[a].costs[s.programs[a]],
    );
    const id = candidates[0];
    if (!id) break;
    s.programs[id] -= 1;
    downgraded.push(PROGRAMS[id].short);
    upkeep = programUpkeep(s);
  }
  if (downgraded.length) {
    const msg = t('Treasury empty: programs cut ({programs})', { programs: listJoinL(downgraded) });
    tc.warnings.push(msg);
    highlight(s, msg, 'bad', 'budget');
  }
  if (upkeep > 0) changeResource(s, 'budget', -upkeep, t('Program upkeep'));
  s.income = computeIncome(s);
  return { income, upkeep };
}

function recordSources(s: GameState, meter: 'economy' | 'stability' | 'security' | 'confidence', key: keyof Modifiers): number {
  let total = 0;
  for (const src of modSources(s, key)) total += changeMeter(s, meter, src.value, src.label);
  return total;
}

export function tickEconomy(s: GameState, tc: TickCtx): void {
  const mods = getMods(s);

  // Defense program pushes defense adoption up (cap 80).
  const defLvl = s.programs.defense ?? 0;
  if (defLvl > 0 && s.adoptionTarget.defense < 80) {
    changeAdoptionTarget(s, 'defense', Math.min(4 * defLvl, 80 - s.adoptionTarget.defense), t('{program} program', { program: PROGRAMS.defense.name }));
  }
  // Adoption ramps 40% of the way toward targets each quarter.
  const cap = infraCap(s);
  if (s.adoptionTarget.infrastructure > cap) s.adoptionTarget.infrastructure = cap;
  for (const sector of SECTORS) {
    const before = s.adoption[sector];
    s.adoption[sector] = adoptionStep(before, s.adoptionTarget[sector], mods.adoptionRamp, sector === 'infrastructure' ? cap : 100);
    tc.adoptionDelta[sector] = s.adoption[sector] - before;
  }

  // Displacement.
  const d = tc.adoptionDelta;
  const automation = 0.5 * Math.max(0, d.business) + 0.25 * Math.max(0, d.public) + 0.04 * s.adoption.business;
  changeResource(s, 'displacement', automation, t('AI automation of jobs'));
  const decay = 2 * (1 + (s.programs.workforce ?? 0));
  changeResource(s, 'displacement', -decay, (s.programs.workforce ?? 0) > 0 ? t('Workforce transition') : t('Labor market adjusts'));

  // Prosperity.
  const econBefore = s.meters.economy;
  const softcap = clamp((110 - s.meters.economy) / 60, 0.2, 1.2);
  const capF = 0.6 + avgDeployedC(s) / 10;
  const gains: [SectorId, number][] = [
    ['business', 0.037 * s.adoption.business],
    ['infrastructure', 0.026 * s.adoption.infrastructure],
    ['public', 0.014 * s.adoption.public],
  ];
  for (const [sector, g] of gains) {
    const v = g * capF * softcap;
    if (v > 0.02) changeMeter(s, 'economy', v, t('{sector} AI productivity', { sector: SECTOR_INFO[sector].name }));
  }
  // Standing still costs more as the world economy reorganizes around AI.
  const competition = { emergence: 0.3, acceleration: 0.4, superhuman: 0.5, threshold: 0.6 }[currentEra(s)];
  changeMeter(s, 'economy', -competition, t('Global competition'));
  const rival = leadingRival(s);
  const behind = rival ? Math.max(0, rival.capability - domesticBestC(s)) : 0;
  if (rival && behind > 0.05) changeMeter(s, 'economy', -0.45 * behind, t('Falling behind {rival}', { rival: rival.name }));
  if (s.meters.stability < 30) changeMeter(s, 'economy', -(30 - s.meters.stability) * 0.06, t('Unrest disrupts business'));
  // A weak economy feeds on itself: investors flee once prosperity is low.
  if (s.meters.economy < 25) changeMeter(s, 'economy', -(25 - s.meters.economy) * 0.08, t('Capital flight'));
  if (s.displacement > 0) changeMeter(s, 'economy', -s.displacement * 0.01, t('Displaced workers'));
  recordSources(s, 'economy', 'economyPerTurn');
  if (s.exportControls) changeMeter(s, 'economy', s.countryId === 'meridian' ? -0.5 : -0.3, t('Lost chip exports'));
  tc.econDelta = s.meters.economy - econBefore;

  // Stability.
  const stabBefore = s.meters.stability;
  const unrest = s.displacement * 0.09 * (1 - mods.displacementMitigation) * (1 + mods.displacementSensitivity);
  if (unrest > 0.02) changeMeter(s, 'stability', -unrest, t('Job displacement'));
  changeMeter(s, 'stability', 0.012 * s.adoption.public, t('Better public services'));
  if (Math.abs(tc.econDelta) > 0.1) changeMeter(s, 'stability', 0.1 * tc.econDelta, tc.econDelta > 0 ? t('Economic optimism') : t('Economic anxiety'));
  if (tc.econDelta > 1.5 && !hasPolicy(s, 'ai_dividend')) changeMeter(s, 'stability', -1, t('Unequal AI gains'));
  if (hasPolicy(s, 'ai_dividend') && s.adoption.business > 30) changeMeter(s, 'stability', 1, t('AI Dividend payments'));
  if (s.meters.economy < 30) changeMeter(s, 'stability', -(30 - s.meters.economy) * 0.05, t('Economic hardship'));
  changeMeter(s, 'stability', (55 - s.meters.stability) * 0.015, t('Social resilience'));
  recordSources(s, 'stability', 'stabilityPerTurn');
  tc.stabDelta = s.meters.stability - stabBefore;

  // Security: balance of power with the strongest rival.
  const secBefore = s.meters.security;
  const ourPower = domesticBestC(s) * (0.5 + s.adoption.defense / 100);
  let strongest = rival;
  let rivalPower = 0;
  for (const r of s.rivals) {
    const aggr = r.accordMember && !r.defected ? r.aggression * 0.7 : r.aggression;
    const p = r.capability * (0.5 + aggr / 2);
    if (p > rivalPower) {
      rivalPower = p;
      strongest = r;
    }
  }
  const balance = clamp(0.35 * (ourPower - 0.9 * rivalPower), -2.5, 2);
  if (Math.abs(balance) > 0.02) {
    const reason = balance >= 0 ? t('Military AI edge') : strongest ? t('Power gap vs {rival}', { rival: strongest.name }) : t('Power gap vs rivals');
    changeMeter(s, 'security', balance, reason);
  }
  recordSources(s, 'security', 'securityPerTurn');
  tc.secDelta = s.meters.security - secBefore;

  recordSources(s, 'confidence', 'confidencePerTurn');
}
