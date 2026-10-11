/**
 * Aggregates numeric modifiers from country traits, programs, policies, difficulty and temporary flags.
 * Temporary modifiers live in `state.flags` as `tm|<key>|<untilTurn>` → value so they serialize cleanly.
 */
import { t } from '../i18n';
import { getCountry, getCountryModifiers } from './content';
import { POLICIES } from './data/policies';
import { PROGRAMS } from './data/programs';
import type { Difficulty, GameState, Modifiers, ProgramId } from './types';

export function zeroMods(): Modifiers {
  return {
    detection: 0,
    earlyWarning: 0,
    riskUncertainty: 0,
    capabilityGrowth: 0,
    safeguardsGrowth: 0,
    deploymentGain: 0,
    adoptionRamp: 0,
    displacementMitigation: 0,
    companyRelation: 0,
    companySafety: 0,
    companyTransparency: 0,
    companyAmbition: 0,
    violationChance: 0,
    misuseSpawn: 0,
    incidentSeverity: 0,
    infraIncident: 0,
    escalationGrowth: 0,
    escapeGrowth: 0,
    infraAdoptionCap: 0,
    riskPerTurn: 0,
    economyPerTurn: 0,
    stabilityPerTurn: 0,
    securityPerTurn: 0,
    confidencePerTurn: 0,
    tensionPerTurn: 0,
    incomePerTurn: 0,
    capacity: 0,
    policyCostMult: 0,
    accordGain: 0,
    exportControlPower: 0,
    confidenceVolatility: 0,
    displacementSensitivity: 0,
    killSwitch: 0,
  };
}

/** Difficulty changes signal clarity and pressure (GDD §14), never hidden stats. */
export const DIFFICULTY: Record<Difficulty, {
  mods: Partial<Modifiers>;
  demandInterval: [number, number];
  riskGrowth: number;
  falseAlarm: number;
  /** added to the leader's resolve (harder negotiations, costlier refusals) */
  resolve: number;
}> = {
  analyst: { mods: { detection: 0.1, riskUncertainty: -3, earlyWarning: 0.05, incidentSeverity: 0.05 }, demandInterval: [4, 4], riskGrowth: 0.75, falseAlarm: 0.1, resolve: -10 },
  director: { mods: { incidentSeverity: 0.2 }, demandInterval: [3, 4], riskGrowth: 1.0, falseAlarm: 0.15, resolve: 0 },
  doomer: { mods: { detection: -0.1, incidentSeverity: 0.35 }, demandInterval: [2, 3], riskGrowth: 1.3, falseAlarm: 0.25, resolve: 15 },
};

function addInto(target: Modifiers, src: Partial<Modifiers>, scale = 1): void {
  for (const k of Object.keys(src) as (keyof Modifiers)[]) {
    const v = src[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (k === 'infraAdoptionCap') {
      // Caps take the tightest positive value instead of summing.
      if (v > 0) target.infraAdoptionCap = target.infraAdoptionCap > 0 ? Math.min(target.infraAdoptionCap, v) : v;
      continue;
    }
    target[k] += v * scale;
  }
}

export function getMods(s: GameState): Modifiers {
  const m = zeroMods();
  addInto(m, getCountryModifiers(s.countryId));
  for (const id of Object.keys(s.programs) as ProgramId[]) {
    const lvl = Math.max(0, Math.min(3, Math.round(s.programs[id] ?? 0)));
    const def = PROGRAMS[id];
    if (!def || lvl === 0) continue;
    addInto(m, def.levels[lvl]);
  }
  for (const pid of s.policies) {
    const def = POLICIES[pid];
    if (def) addInto(m, def.modifiers);
  }
  addInto(m, DIFFICULTY[s.difficulty]?.mods ?? {});
  for (const key of Object.keys(s.flags)) {
    if (!key.startsWith('tm|')) continue;
    const [, modKey, until] = key.split('|');
    if (Number(until) < s.turn) continue;
    const v = s.flags[key];
    if (typeof v === 'number' && modKey in m) addInto(m, { [modKey]: v } as Partial<Modifiers>);
  }
  m.displacementMitigation = Math.min(0.85, Math.max(0, m.displacementMitigation));
  return m;
}

/** Adds a temporary modifier active through `turns` quarters (including the current one). */
export function addTempMod(s: GameState, key: keyof Modifiers, value: number, turns: number): void {
  const k = `tm|${key}|${s.turn + Math.max(0, turns - 1)}`;
  const prev = s.flags[k];
  s.flags[k] = (typeof prev === 'number' ? prev : 0) + value;
}

/** Drops expired temporary modifiers. */
export function pruneTempMods(s: GameState): void {
  for (const key of Object.keys(s.flags)) {
    if (!key.startsWith('tm|')) continue;
    const until = Number(key.split('|')[2]);
    if (until < s.turn) delete s.flags[key];
  }
}

/** Number flag helper. */
export function flagNum(s: GameState, key: string, fallback = 0): number {
  const v = s.flags[key];
  return typeof v === 'number' ? v : fallback;
}

/** Breaks one modifier key down by source, for human-readable change reasons. */
export function modSources(s: GameState, key: keyof Modifiers): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = [];
  const countryVal = getCountryModifiers(s.countryId)[key];
  if (typeof countryVal === 'number' && countryVal !== 0) {
    const c = getCountry(s.countryId);
    out.push({ label: countryVal > 0 ? c.traitPlus.name : c.traitMinus.name, value: countryVal });
  }
  for (const id of Object.keys(s.programs) as ProgramId[]) {
    const lvl = Math.max(0, Math.min(3, Math.round(s.programs[id] ?? 0)));
    const v = PROGRAMS[id]?.levels[lvl]?.[key];
    if (typeof v === 'number' && v !== 0) out.push({ label: t('{program} program', { program: PROGRAMS[id].name }), value: v });
  }
  for (const pid of s.policies) {
    const v = POLICIES[pid]?.modifiers[key];
    if (typeof v === 'number' && v !== 0) out.push({ label: POLICIES[pid].name, value: v });
  }
  let temp = 0;
  for (const k of Object.keys(s.flags)) {
    if (!k.startsWith('tm|')) continue;
    const [, modKey, until] = k.split('|');
    const v = s.flags[k];
    if (modKey === key && Number(until) >= s.turn && typeof v === 'number') temp += v;
  }
  if (temp !== 0) out.push({ label: t('Recent events'), value: temp });
  return out;
}
