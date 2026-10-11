/**
 * New-run setup: companies (3 distinct archetypes incl. a frontier lab), hidden traits,
 * rivals, leader, meters, programs and the opening adoption levels.
 */
import { getCompanyPool, getCountry } from './content';
import { COUNTRY_IDS } from './data/fallback';
import { Rng, dailySeedFor, freshSeed, seedState } from './rng';
import { syncReported } from './systems/companies';
import { createGovernment } from './systems/government';
import type { Archetype, Company, CompanyTemplate, CountryId, GameState, NewGameOptions, ProgramId, Rival } from './types';
import { clamp, round2 } from './util';

export const SAVE_VERSION = 1;
export const MAX_TURNS = 16;

const ARCHETYPE_CAP_OFFSET: Record<Archetype, number> = { frontier: 0, bigtech: -0.25, defense: -0.35, opensource: -0.45 };

/** Flavor program each country starts with at level 1. */
const START_PROGRAM: Record<CountryId, ProgramId> = {
  atlantic: 'compute',
  hanzhou: 'defense',
  commonwealth: 'safety',
  meridian: 'oversight',
};

function rollRange(r: Rng, range: [number, number] | undefined, fallback: [number, number]): number {
  const [a, b] = range && range.length === 2 ? range : fallback;
  return r.range(Math.min(a, b), Math.max(a, b));
}

function pickCompanies(r: Rng, pool: CompanyTemplate[]): CompanyTemplate[] {
  const shuffled = r.shuffle([...pool]);
  const chosen: CompanyTemplate[] = [];
  const frontier = shuffled.find((t) => t.archetype === 'frontier');
  if (frontier) chosen.push(frontier);
  for (const t of shuffled) {
    if (chosen.length >= 3) break;
    if (chosen.some((c) => c.archetype === t.archetype)) continue;
    chosen.push(t);
  }
  for (const t of shuffled) {
    if (chosen.length >= 3) break;
    if (!chosen.includes(t)) chosen.push(t);
  }
  return chosen;
}

function makeCompany(s: GameState, r: Rng, t: CompanyTemplate): Company {
  const country = getCountry(s.countryId);
  const [lo, hi] = country.labCapRange;
  const cap = clamp(r.range(lo, hi) + (ARCHETYPE_CAP_OFFSET[t.archetype] ?? 0), 1, 10);
  const ambitionBonus = s.countryId === 'atlantic' ? 15 : 0;
  const c: Company = {
    id: t.id,
    templateId: t.id,
    name: t.name,
    archetype: t.archetype,
    tagline: t.tagline,
    description: t.description,
    color: t.color,
    ceo: t.ceo,
    modelStem: t.modelStem,
    nextModelNumber: (t.startModelNumber ?? 1) + 1,
    capability: round2(cap),
    reportedCapability: round2(cap),
    safety: Math.round(rollRange(r, t.safety, [40, 60])),
    transparency: Math.round(rollRange(r, t.transparency, [40, 60])),
    ambition: Math.round(clamp(rollRange(r, t.ambition, [50, 70]) + ambitionBonus, 0, 100)),
    compute: round2(rollRange(r, t.compute, [0.8, 1.2])),
    relation: Math.round(r.range(48, 62)),
    intel: 0.3,
    lastInvestigatedTurn: null,
    knownTraits: { safety: false, transparency: false, ambition: false },
    capAtLastModel: round2(cap - r.range(0, 0.35)),
    lastModelTurn: -r.int(0, 2),
    violations: [],
    status: 'active',
    sanctions: 0,
  };
  syncReported(c);
  return c;
}

function makeRival(s: GameState, r: Rng, id: CountryId): Rival {
  const def = getCountry(id);
  const [lo, hi] = def.labCapRange;
  const aggrBonus = s.countryId === 'meridian' ? 0.15 : 0;
  const trust = def.trust[s.countryId] ?? 50;
  return {
    id,
    name: def.name,
    adjective: def.adjective,
    leaderTitle: def.leaderTitle,
    color: def.color,
    color2: def.color2,
    leadLab: def.rival.leadLab,
    capability: round2(r.range(lo, hi)),
    safeguards: round2(def.startSafeguards + r.range(-0.2, 0.2)),
    aggression: round2(clamp(rollRange(r, def.rival.aggression, [0.3, 0.6]) + aggrBonus, 0, 1)),
    safetyStance: round2(rollRange(r, def.rival.safetyStance, [0.4, 0.6])),
    compute: def.compute,
    intel: 0.3,
    estimateBias: round2(r.noise(0.6)),
    trust: Math.round(clamp(trust + r.range(-5, 5), 0, 100)),
    accordMember: false,
    defected: false,
    exportControlled: false,
    partnership: false,
  };
}

export function resolveSeed(opts: NewGameOptions): number {
  if (typeof opts.seed === 'number' && Number.isFinite(opts.seed)) return Math.abs(Math.floor(opts.seed)) % 4_294_967_296;
  if (opts.dailySeed) return dailySeedFor(new Date().toISOString().slice(0, 10));
  return freshSeed();
}

export function createInitialState(opts: NewGameOptions): GameState {
  const countryId: CountryId = COUNTRY_IDS.includes(opts.countryId) ? opts.countryId : 'atlantic';
  const difficulty = opts.difficulty === 'analyst' || opts.difficulty === 'doomer' ? opts.difficulty : 'director';
  const seed = resolveSeed(opts);
  const country = getCountry(countryId);
  const s: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: seedState(seed),
    difficulty,
    dailySeed: !!opts.dailySeed,
    countryId,
    turn: 1,
    maxTurns: MAX_TURNS,
    meters: {
      confidence: country.start.confidence,
      economy: country.start.economy,
      stability: country.start.stability,
      security: country.start.security,
    },
    meterHistory: { confidence: [], economy: [], stability: [], security: [] },
    changes: [],
    budget: country.start.budget,
    income: country.incomeBase,
    capacity: 2,
    capacityMax: 2,
    evidence: [],
    programs: { safety: 0, oversight: 0, compute: 0, workforce: 0, defense: 0 },
    policies: [],
    exportControls: false,
    safeguards: country.startSafeguards,
    adoption: { business: 15, public: 8, infrastructure: 5, defense: 5 },
    adoptionTarget: { business: 15, public: 8, infrastructure: 5, defense: 5 },
    displacement: 5,
    risk: 12,
    riskBias: 0,
    riskHistory: [],
    tension: 25,
    accord: { progress: 10, signed: false },
    companies: [],
    models: [],
    rivals: [],
    government: {
      leaderName: '',
      leaderBio: '',
      leaderTitle: country.leaderTitle,
      stance: 'cautious',
      portraitSeed: 1,
      resolve: 40,
      briefCount: 0,
      sinceTurn: 1,
      calendar: [],
      lastChanceUsed: false,
    },
    demands: [],
    situations: [],
    inbox: [],
    queue: [],
    scheduled: [],
    firedEvents: {},
    flags: { nextDemandTurn: 2 },
    log: [],
    news: [],
    unlockedTabs: ['inbox', 'labs'],
    tipsShown: [],
    pendingTips: ['welcome'],
    tipBacklog: ['inbox', 'labs'],
    stats: {},
    idCounter: 0,
    gameOver: false,
    ending: null,
    thresholdFired: false,
    riskSources: {},
    turnLog: { triggers: [], highlights: [] },
    lastReport: null,
  };
  const r = new Rng(s);
  s.risk = round2(12 + r.range(-2, 2));
  s.riskBias = round2(r.range(-8, 8));
  s.companies = pickCompanies(r, getCompanyPool(countryId)).map((t) => makeCompany(s, r, t));
  s.rivals = COUNTRY_IDS.filter((id) => id !== countryId).map((id) => makeRival(s, r, id));
  s.government = createGovernment(s);
  s.programs[START_PROGRAM[countryId]] = 1;
  return s;
}
