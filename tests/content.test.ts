/**
 * Content validation: structure, coverage, template tokens, lengths and robustness of
 * content-side functions (weights, requires, bindings, custom effects) against a mock state.
 */
import { describe, it, expect } from 'vitest';
import type {
  AIModel,
  Archetype,
  AdvisorId,
  Company,
  CountryId,
  EndingId,
  Era,
  EventChoiceDef,
  EventContext,
  EventDef,
  EffectHelpers,
  Effect,
  FlawType,
  FollowUpDef,
  GameState,
  HeadlineTrigger,
  Modifiers,
  PolicyId,
  Rival,
  SituationType,
  Situation,
  Stance,
  TipId,
} from '../src/engine/types';
import { ICON_NAMES, TEMPLATE_TOKENS } from '../src/engine/labels';
import { EVENTS } from '../src/content/events';
import { COUNTRIES, COUNTRY_ORDER } from '../src/content/countries';
import { COMPANY_POOLS } from '../src/content/companies';
import { ADVISORS, LEADERS, STANCE_TEXT } from '../src/content/leaders';
import { EVAL_TEXT, FLAW_FLAVOR, SITUATION_FLAVOR } from '../src/content/situations';
import { HEADLINES } from '../src/content/headlines';
import { ENDINGS } from '../src/content/endings';
import { TIPS } from '../src/content/tips';

// ── exhaustive id lists (compile-time checked against the unions) ──────────
const keys = <K extends string>(o: Record<K, 1>): K[] => Object.keys(o) as K[];
const COUNTRY_IDS = keys<CountryId>({ atlantic: 1, hanzhou: 1, commonwealth: 1, meridian: 1 });
const SITUATIONS = keys<SituationType>({
  rogue_agents: 1, deceptive_model: 1, infrastructure_failure: 1, mass_manipulation: 1, cyber_misuse: 1,
  bio_misuse: 1, military_escalation: 1, model_escape: 1, foreign_spillover: 1,
});
const FLAWS = keys<FlawType>({ scope_creep: 1, deceptive: 1, brittle: 1, manipulative: 1, jailbreakable: 1, power_seeking: 1 });
const ENDING_IDS = keys<EndingId>({
  dismissed: 1, economic_collapse: 1, civil_unrest: 1, national_defeat: 1, loss_of_control: 1, catastrophe: 1, ai_war: 1,
  governed_transition: 1, prosperous_pioneer: 1, hegemon: 1, safe_harbor: 1, fragile_future: 1,
});
const TIP_IDS = keys<TipId>({
  welcome: 1, inbox: 1, labs: 1, nation: 1, world: 1, threats: 1, first_deployment: 1, first_demand: 1,
  first_situation: 1, risk_clock: 1, capacity: 1, evidence: 1, end_turn: 1, low_confidence: 1,
});
const TRIGGERS = keys<HeadlineTrigger>({
  rival_breakthrough: 1, domestic_breakthrough: 1, model_release: 1, model_approved: 1, model_rejected: 1,
  economy_up: 1, economy_down: 1, stability_down: 1, jobs: 1, security_down: 1, adoption: 1, accord_progress: 1,
  accord_signed: 1, tension_high: 1, election: 1, situation_public: 1, policy_enacted: 1, espionage: 1, calm: 1,
});
const ERAS = keys<Era>({ emergence: 1, acceleration: 1, superhuman: 1, threshold: 1 });
const STANCES = keys<Stance>({ accelerationist: 1, hawk: 1, cautious: 1, populist: 1 });
const ARCHETYPES = keys<Archetype>({ frontier: 1, bigtech: 1, defense: 1, opensource: 1 });
const ADVISOR_IDS = keys<AdvisorId>({ chief_of_staff: 1, scientist: 1, economist: 1, intelligence: 1 });
const MODIFIER_KEYS = keys<keyof Modifiers>({
  detection: 1, earlyWarning: 1, riskUncertainty: 1, capabilityGrowth: 1, safeguardsGrowth: 1, deploymentGain: 1,
  adoptionRamp: 1, displacementMitigation: 1, companyRelation: 1, companySafety: 1, companyTransparency: 1,
  companyAmbition: 1, violationChance: 1, misuseSpawn: 1, incidentSeverity: 1, infraIncident: 1, escalationGrowth: 1,
  escapeGrowth: 1, infraAdoptionCap: 1, riskPerTurn: 1, economyPerTurn: 1, stabilityPerTurn: 1, securityPerTurn: 1,
  confidencePerTurn: 1, tensionPerTurn: 1, incomePerTurn: 1, capacity: 1, policyCostMult: 1, accordGain: 1,
  exportControlPower: 1, confidenceVolatility: 1, displacementSensitivity: 1, killSwitch: 1,
});

const SITUATION_ICONS: Record<SituationType, string> = {
  rogue_agents: 'agents', deceptive_model: 'deception', infrastructure_failure: 'blackout', mass_manipulation: 'manipulation',
  cyber_misuse: 'cyber', bio_misuse: 'bio', military_escalation: 'missile', model_escape: 'escape', foreign_spillover: 'spillover',
};

// ── template helpers ───────────────────────────────────────────
const TOKENS = new Set<string>(TEMPLATE_TOKENS);
/** Headlines may additionally use {policy} (see HeadlineBank docs in types.ts). */
const HEADLINE_TOKENS = new Set<string>([...TEMPLATE_TOKENS, 'policy']);

function badTokens(text: string | undefined, allowed: Set<string> = TOKENS): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const m of text.matchAll(/\{([^}]*)\}/g)) if (!allowed.has(m[1])) out.push(m[0]);
  // stray braces
  const stripped = text.replace(/\{[a-zA-Z]+\}/g, '');
  if (/[{}]/.test(stripped)) out.push('stray brace');
  return out;
}
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const asArray = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

function eventTexts(e: EventDef): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [
    { where: 'title', text: e.title },
    { where: 'text', text: e.text },
  ];
  if (e.sourceName) out.push({ where: 'sourceName', text: e.sourceName });
  for (const ev of e.evidence ?? []) out.push({ where: 'evidence', text: ev.label }, { where: 'evidence', text: ev.value });
  for (const c of e.choices) {
    out.push({ where: `${c.id}.label`, text: c.label });
    if (c.hint) out.push({ where: `${c.id}.hint`, text: c.hint });
    if (c.resultText) out.push({ where: `${c.id}.resultText`, text: c.resultText });
    if (c.log) out.push({ where: `${c.id}.log`, text: c.log });
    for (const o of c.outcomes ?? []) out.push({ where: `${c.id}.outcome`, text: o.text });
  }
  return out;
}

function followUpsOf(c: EventChoiceDef): FollowUpDef[] {
  return [...asArray(c.followUp), ...(c.outcomes ?? []).flatMap((o) => asArray(o.followUp))];
}

// ── mock state for robustness checks ──────────────────────────
function mockCompany(id: string, archetype: Archetype, over: Partial<Company> = {}): Company {
  return {
    id, templateId: id, name: `Test ${id}`, archetype, tagline: '', description: '', color: '#888888', ceo: 'Test CEO',
    modelStem: 'Test', nextModelNumber: 4, capability: 3, reportedCapability: 2.8, safety: 50, transparency: 45,
    ambition: 65, compute: 1, relation: 50, intel: 0.3, lastInvestigatedTurn: null,
    knownTraits: { safety: false, transparency: false, ambition: false }, capAtLastModel: 3, lastModelTurn: 1,
    violations: [], status: 'active', sanctions: 0, ...over,
  };
}
function mockRival(id: CountryId, over: Partial<Rival> = {}): Rival {
  return {
    id, name: COUNTRIES[id]?.name ?? id, adjective: id, leaderTitle: 'Leader', color: '#888888', color2: '#444444',
    leadLab: 'Lab', capability: 3.2, safeguards: 2, aggression: 0.6, safetyStance: 0.4, compute: 1, intel: 0.3,
    estimateBias: 0, trust: 40, accordMember: false, defected: false, exportControlled: false, partnership: false, ...over,
  };
}
function mockModel(over: Partial<AIModel> = {}): AIModel {
  return {
    id: 'm1', name: 'Test-4', companyId: 'c1', capability: 3.5, claimedCapability: 3.3, releasedTurn: 2, flaw: 'scope_creep',
    flawKnown: false, falseAlarm: false, openWeights: false, status: 'deployed', sectors: ['business', 'infrastructure'],
    contribution: { business: 12 }, deepEvaluated: false, evalDetected: false, ...over,
  };
}
function mockSituation(over: Partial<Situation> = {}): Situation {
  return {
    id: 'x1', type: 'rogue_agents', severity: 30, growth: 7, growthMult: 1, stage: 1, detected: true, causeKnown: false,
    source: { companyId: 'c1', modelId: 'm1' }, spawnedTurn: 3, signalsShown: 1, signalTurns: [4], response: 'none',
    resolved: false, origin: 'test', ...over,
  };
}
function mockState(turn: number, cap: number, countryId: CountryId = 'atlantic'): GameState {
  const companies = [
    mockCompany('c1', 'frontier', { capability: cap }),
    mockCompany('c2', 'bigtech', { capability: cap - 0.5, transparency: 70, relation: 70 }),
    mockCompany('c3', 'opensource', { capability: cap - 0.8, safety: 35, relation: 30 }),
  ];
  const rivals = COUNTRY_IDS.filter((c) => c !== countryId).map((id, i) => mockRival(id, { capability: cap + 0.2 * i, trust: 30 + 20 * i }));
  return {
    version: 1, seed: 1, rng: [1, 2, 3, 4], difficulty: 'director', dailySeed: false, countryId, turn, maxTurns: 16,
    meters: { confidence: 50, economy: 55, stability: 45, security: 50 },
    meterHistory: { confidence: [50], economy: [55], stability: [45], security: [50] },
    changes: [], budget: 15, income: 14, capacity: 3, capacityMax: 3,
    evidence: [{ id: 'e1', companyId: 'c1', text: 'Evidence', turn: 2 }],
    programs: { safety: 1, oversight: 1, compute: 1, workforce: 0, defense: 1 },
    policies: ['incident_reporting'], exportControls: false, safeguards: 2.5,
    adoption: { business: 35, public: 20, infrastructure: 25, defense: 15 },
    adoptionTarget: { business: 45, public: 25, infrastructure: 30, defense: 20 },
    displacement: 25, risk: 30, riskBias: 2, riskHistory: [20, 25], tension: 45,
    accord: { progress: 30, signed: false },
    companies, models: [mockModel(), mockModel({ id: 'm2', name: 'Open-2', companyId: 'c3', openWeights: true, flaw: null })],
    rivals,
    government: {
      leaderName: 'Leader', leaderBio: '', leaderTitle: 'President', stance: 'accelerationist', portraitSeed: 1, resolve: 50,
      briefCount: 0, sinceTurn: 1, calendar: [{ turn: 7, kind: 'election' }, { turn: 13, kind: 'election' }], lastChanceUsed: false,
    },
    demands: [], situations: [mockSituation(), mockSituation({ id: 'x2', type: 'cyber_misuse', detected: false })],
    inbox: [], queue: [], scheduled: [], firedEvents: {}, flags: {}, log: [], news: [],
    unlockedTabs: ['inbox', 'labs'], tipsShown: [], pendingTips: [], stats: {}, idCounter: 10,
    gameOver: false, ending: null, thresholdFired: false,
  };
}
function mockHelpers(): EffectHelpers & { calls: string[] } {
  let seed = 7;
  const calls: string[] = [];
  return {
    calls,
    rand: () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    },
    meter: (id, d, r) => void calls.push(`meter:${id}:${d}:${r}`),
    risk: (d, r) => void calls.push(`risk:${d}:${r}`),
    spawnSituation: (type, opts) => mockSituation({ id: 'spawned', type, severity: opts?.severity ?? 10 }),
    schedule: (id) => void calls.push(`schedule:${id}`),
    log: (t) => void calls.push(`log:${t}`),
    news: (t) => void calls.push(`news:${t}`),
    text: (t) => t,
  };
}

const ALL_IDS = new Set(EVENTS.map((e) => e.id));

// ═════════════════════════════ EVENTS ═════════════════════════════
describe('events', () => {
  it('has at least 75 scripted events', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(75);
  });

  it('has unique ids', () => {
    const seen = new Set<string>();
    const dupes = EVENTS.map((e) => e.id).filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    expect(dupes).toEqual([]);
  });

  it('has 2–4 choices with unique ids, short labels and hints', () => {
    const problems: string[] = [];
    for (const e of EVENTS) {
      if (e.choices.length < 2 || e.choices.length > 4) problems.push(`${e.id}: ${e.choices.length} choices`);
      const ids = e.choices.map((c) => c.id);
      if (new Set(ids).size !== ids.length) problems.push(`${e.id}: duplicate choice ids`);
      for (const c of e.choices) {
        if (c.label.length > 48) problems.push(`${e.id}.${c.id}: label ${c.label.length} chars`);
        if (c.hint && c.hint.length > 80) problems.push(`${e.id}.${c.id}: hint ${c.hint.length} chars`);
        if (c.outcomes) {
          if (c.outcomes.length < 2) problems.push(`${e.id}.${c.id}: single outcome`);
          for (const o of c.outcomes) if (typeof o.chance === 'number' && o.chance <= 0) problems.push(`${e.id}.${c.id}: chance ≤ 0`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('gives every choice its own result text (resultText or outcome texts), kept short', () => {
    const problems: string[] = [];
    for (const e of EVENTS)
      for (const c of e.choices) {
        const hasOutcomes = !!c.outcomes?.length;
        if (!c.resultText?.trim() && !hasOutcomes) problems.push(`${e.id}.${c.id}: no resultText`);
        if (c.resultText && words(c.resultText) > 50) problems.push(`${e.id}.${c.id}: resultText ${words(c.resultText)} words`);
        for (const o of c.outcomes ?? []) {
          if (!o.text?.trim()) problems.push(`${e.id}.${c.id}: empty outcome text`);
          else if (words(o.text) > 60) problems.push(`${e.id}.${c.id}: outcome ${words(o.text)} words`);
        }
      }
    expect(problems).toEqual([]);
  });

  it('has body text of 40–110 words and a title', () => {
    const problems = EVENTS.filter((e) => !e.title || words(e.text) < 40 || words(e.text) > 110).map(
      (e) => `${e.id}: ${words(e.text)} words`,
    );
    expect(problems).toEqual([]);
  });

  it('only uses known template tokens', () => {
    const problems: string[] = [];
    for (const e of EVENTS) for (const t of eventTexts(e)) for (const b of badTokens(t.text)) problems.push(`${e.id} ${t.where}: ${b}`);
    expect(problems).toEqual([]);
  });

  it('has valid followUp targets, and every followUpOnly event is reachable', () => {
    const referenced = new Set<string>();
    const problems: string[] = [];
    for (const e of EVENTS)
      for (const c of e.choices)
        for (const f of followUpsOf(c)) {
          referenced.add(f.event);
          if (!ALL_IDS.has(f.event)) problems.push(`${e.id}.${c.id} → missing ${f.event}`);
          if (f.event === e.id) problems.push(`${e.id}.${c.id} → self`);
          const d = Array.isArray(f.delay) ? f.delay : [f.delay, f.delay];
          if (d[0] < 1 || d[1] < d[0] || d[1] > 6) problems.push(`${e.id}.${c.id}: bad delay ${f.delay}`);
          if (f.chance !== undefined && (f.chance <= 0 || f.chance > 1)) problems.push(`${e.id}.${c.id}: bad chance`);
        }
    for (const e of EVENTS) if (e.followUpOnly && !referenced.has(e.id)) problems.push(`${e.id}: followUpOnly but unreferenced`);
    expect(problems).toEqual([]);
  });

  it('has at least 6 multi-part arcs', () => {
    const byId = new Map(EVENTS.map((e) => [e.id, e]));
    const roots = EVENTS.filter(
      (e) => !e.followUpOnly && e.choices.some((c) => followUpsOf(c).some((f) => byId.get(f.event)?.followUpOnly)),
    );
    expect(roots.length).toBeGreaterThanOrEqual(6);
  });

  it('uses valid enums for eras, countries, stances, sources and urgency', () => {
    const problems: string[] = [];
    const sources = ['company', 'government', 'foreign', 'intelligence', 'public', 'ai', 'advisor', 'media'];
    for (const e of EVENTS) {
      for (const x of e.eras ?? []) if (!ERAS.includes(x)) problems.push(`${e.id}: era ${x}`);
      for (const x of e.countries ?? []) if (!COUNTRY_IDS.includes(x)) problems.push(`${e.id}: country ${x}`);
      for (const x of e.stances ?? []) if (!STANCES.includes(x)) problems.push(`${e.id}: stance ${x}`);
      if (!sources.includes(e.source)) problems.push(`${e.id}: source ${e.source}`);
      if (e.urgency && !['routine', 'priority', 'critical'].includes(e.urgency)) problems.push(`${e.id}: urgency`);
      if (e.minTurn !== undefined && e.maxTurn !== undefined && e.minTurn > e.maxTurn) problems.push(`${e.id}: min>max turn`);
      if (e.bind?.sector) for (const s of e.bind.sector) if (!['business', 'public', 'infrastructure', 'defense'].includes(s)) problems.push(`${e.id}: sector ${s}`);
    }
    expect(problems).toEqual([]);
  });

  it('covers every era with a healthy pool of random events', () => {
    for (const era of ERAS) {
      const pool = EVENTS.filter((e) => !e.followUpOnly && (!e.eras || e.eras.includes(era)));
      expect(pool.length, era).toBeGreaterThanOrEqual(12);
    }
  });

  it('has at least 2 country-specific events per country', () => {
    for (const id of COUNTRY_IDS) {
      const n = EVENTS.filter((e) => e.countries?.includes(id)).length;
      expect(n, id).toBeGreaterThanOrEqual(2);
    }
  });

  it('has AI-originated events and logged key decisions', () => {
    expect(EVENTS.filter((e) => e.tags?.includes('ai')).length).toBeGreaterThanOrEqual(8);
    const logged = EVENTS.flatMap((e) => e.choices).filter((c) => c.log).length;
    expect(logged).toBeGreaterThanOrEqual(60);
  });

  it('content functions run safely on mock states, with and without bindings', () => {
    const states = [mockState(1, 2.5, 'atlantic'), mockState(8, 5.5, 'hanzhou'), mockState(14, 8.2, 'meridian')];
    for (const s of states) {
      const full: EventContext = {
        company: s.companies[0],
        rival: s.rivals[0],
        model: s.models[0],
        situation: s.situations[0],
        sector: 'business',
      };
      for (const ctx of [{} as EventContext, full]) {
        for (const e of EVENTS) {
          const where = `${e.id} (turn ${s.turn}, ctx ${Object.keys(ctx).length})`;
          expect(() => {
            if (typeof e.weight === 'function') {
              const w = e.weight(s, ctx);
              if (!Number.isFinite(w) || w < 0) throw new Error(`bad weight ${w}`);
            }
            e.requires?.(s, ctx);
            for (const c of s.companies) e.bind?.company?.(c, s);
            for (const r of s.rivals) e.bind?.rival?.(r, s);
            for (const m of s.models) e.bind?.model?.(m, s);
            for (const x of s.situations) e.bind?.situation?.(x, s);
            for (const c of e.choices) {
              c.requires?.(s, ctx);
              const effects: (Effect | undefined)[] = [c.effects, ...(c.outcomes ?? []).map((o) => o.effects)];
              for (const o of c.outcomes ?? []) {
                const p = typeof o.chance === 'function' ? o.chance(s, ctx) : o.chance;
                if (!Number.isFinite(p) || p < 0) throw new Error(`bad chance ${p}`);
              }
              for (const eff of effects) {
                if (eff?.custom) {
                  const clone = structuredClone(s);
                  const cctx: EventContext = Object.keys(ctx).length
                    ? { company: clone.companies[0], rival: clone.rivals[0], model: clone.models[0], situation: clone.situations[0], sector: 'business' }
                    : {};
                  eff.custom(clone, cctx, mockHelpers());
                }
              }
            }
          }, where).not.toThrow();
        }
      }
    }
  });

  it('enacts and repeals only real policies', () => {
    const POLICIES = keys<PolicyId>({
      mandatory_evals: 1, compute_licensing: 1, incident_reporting: 1, open_weights_ban: 1, liability_act: 1,
      infra_firewall: 1, ai_dividend: 1, kill_switch: 1, human_in_loop: 1, fast_track: 1,
    });
    const bad: string[] = [];
    for (const e of EVENTS)
      for (const c of e.choices)
        for (const eff of [c.effects, ...(c.outcomes ?? []).map((o) => o.effects)]) {
          const pol = eff?.policy;
          if (pol?.enact && !POLICIES.includes(pol.enact)) bad.push(`${e.id}.${c.id}: ${pol.enact}`);
          if (pol?.repeal && !POLICIES.includes(pol.repeal)) bad.push(`${e.id}.${c.id}: ${pol.repeal}`);
        }
    expect(bad).toEqual([]);
  });

  it('only uses entity tokens the event binds (follow-ups inherit every parent binding)', () => {
    type Slot = 'company' | 'model' | 'rival' | 'sector' | 'situation';
    const byId = new Map(EVENTS.map((e) => [e.id, e]));
    const parents = new Map<string, EventDef[]>();
    for (const e of EVENTS)
      for (const c of e.choices) for (const f of followUpsOf(c)) parents.set(f.event, [...(parents.get(f.event) ?? []), e]);
    const own = (e: EventDef): Set<Slot> => {
      const b = new Set<Slot>();
      if (e.bind?.company) b.add('company');
      if (e.bind?.model) b.add('model').add('company'); // the engine binds a model's company too
      if (e.bind?.rival) b.add('rival');
      if (e.bind?.sector?.length) b.add('sector');
      if (e.bind?.situation) b.add('situation');
      return b;
    };
    const memo = new Map<string, Set<Slot>>();
    const bound = (e: EventDef, stack: string[] = []): Set<Slot> => {
      if (memo.has(e.id)) return memo.get(e.id)!;
      let b = own(e);
      if (e.followUpOnly) {
        const ps = (parents.get(e.id) ?? []).filter((p) => !stack.includes(p.id));
        if (ps.length) {
          const sets = ps.map((p) => bound(p, [...stack, e.id]));
          const inter = new Set<Slot>([...sets[0]].filter((x) => sets.every((st) => st.has(x))));
          b = new Set([...b, ...inter]);
        }
      }
      memo.set(e.id, b);
      return b;
    };
    const need: Record<string, Slot> = {
      company: 'company', ceo: 'company', model: 'model', rival: 'rival', rivalAdj: 'rival', rivalLab: 'rival',
      rivalLeaderTitle: 'rival', sector: 'sector', situation: 'situation',
    };
    const problems: string[] = [];
    for (const e of EVENTS) {
      const b = bound(e);
      for (const t of eventTexts(e))
        for (const m of t.text.matchAll(/\{(\w+)\}/g)) {
          const slot = need[m[1]];
          if (slot && !b.has(slot)) problems.push(`${e.id} ${t.where}: {${m[1]}} unbound`);
        }
    }
    expect([...new Set(problems)]).toEqual([]);
    expect(byId.size).toBe(EVENTS.length);
  });

  it('never reuses the same sentence in two different events', () => {
    const owner = new Map<string, string>();
    const dupes: string[] = [];
    for (const e of EVENTS) {
      const texts = [e.text, ...e.choices.flatMap((c) => [c.hint ?? '', c.resultText ?? '', ...(c.outcomes ?? []).map((o) => o.text)])];
      const mine = new Set<string>();
      for (const t of texts)
        for (const raw of t.split(/(?<=[.!?])\s+/)) {
          const sent = raw.trim().toLowerCase();
          if (words(sent) < 6 || mine.has(sent)) continue;
          mine.add(sent);
          const prev = owner.get(sent);
          if (prev && prev !== e.id) dupes.push(`${prev} / ${e.id}: ${sent}`);
          else owner.set(sent, e.id);
        }
    }
    expect(dupes).toEqual([]);
  });

  it('keeps effect magnitudes within sane bounds', () => {
    const problems: string[] = [];
    const check = (id: string, eff?: Effect) => {
      if (!eff) return;
      for (const [k, v] of Object.entries(eff.meters ?? {})) if (Math.abs(v as number) > 15) problems.push(`${id}: meter ${k} ${v}`);
      if (eff.risk !== undefined && Math.abs(eff.risk) > 10) problems.push(`${id}: risk ${eff.risk}`);
      if (eff.budget !== undefined && Math.abs(eff.budget) > 15) problems.push(`${id}: budget ${eff.budget}`);
      if (eff.capability !== undefined && Math.abs(eff.capability) > 1) problems.push(`${id}: capability ${eff.capability}`);
      if (eff.safeguards !== undefined && Math.abs(eff.safeguards) > 0.8) problems.push(`${id}: safeguards ${eff.safeguards}`);
    };
    for (const e of EVENTS)
      for (const c of e.choices) {
        check(`${e.id}.${c.id}`, c.effects);
        for (const o of c.outcomes ?? []) check(`${e.id}.${c.id}.outcome`, o.effects);
      }
    expect(problems).toEqual([]);
  });
});

// ═════════════════════════════ COUNTRIES ═════════════════════════════
describe('countries', () => {
  it('defines all four countries in order', () => {
    expect([...COUNTRY_ORDER].sort()).toEqual([...COUNTRY_IDS].sort());
    for (const id of COUNTRY_IDS) expect(COUNTRIES[id]?.id).toBe(id);
  });

  it('has sane mechanics and valid modifier keys', () => {
    for (const id of COUNTRY_IDS) {
      const c = COUNTRIES[id];
      for (const v of Object.values(c.start)) expect(v).toBeGreaterThan(0);
      expect(c.labCapRange[0]).toBeLessThanOrEqual(c.labCapRange[1]);
      expect(c.stancePool.length).toBeGreaterThanOrEqual(3);
      for (const k of Object.keys(c.modifiers)) expect(MODIFIER_KEYS, `${id}.${k}`).toContain(k);
      expect(Object.keys(c.trust)).not.toContain(id);
      expect(Object.keys(c.trust).length).toBe(3);
      for (const r of [c.rival.aggression, c.rival.safetyStance]) {
        expect(r[0]).toBeGreaterThanOrEqual(0);
        expect(r[1]).toBeLessThanOrEqual(1);
        expect(r[0]).toBeLessThanOrEqual(r[1]);
      }
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.color2).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('has 2–3 intro paragraphs and bullets with valid tokens', () => {
    for (const id of COUNTRY_IDS) {
      const c = COUNTRIES[id];
      expect(c.intro.length).toBeGreaterThanOrEqual(2);
      expect(c.intro.length).toBeLessThanOrEqual(3);
      expect(c.strengths.length).toBeGreaterThanOrEqual(3);
      expect(c.weaknesses.length).toBeGreaterThanOrEqual(3);
      for (const t of [...c.intro, c.tagline, c.description]) expect(badTokens(t), t).toEqual([]);
    }
  });
});

// ═════════════════════════════ COMPANIES ═════════════════════════════
describe('companies', () => {
  const all = COUNTRY_IDS.flatMap((id) => COMPANY_POOLS[id] ?? []);
  const prefix: Record<CountryId, string> = { atlantic: 'atl_', hanzhou: 'han_', commonwealth: 'com_', meridian: 'mer_' };

  it('has 5 templates per country covering all archetypes', () => {
    for (const id of COUNTRY_IDS) {
      const pool = COMPANY_POOLS[id];
      expect(pool.length, id).toBe(5);
      for (const a of ARCHETYPES) expect(pool.some((t) => t.archetype === a), `${id} ${a}`).toBe(true);
      for (const t of pool) expect(t.id.startsWith(prefix[id]), t.id).toBe(true);
    }
  });

  it('has unique ids, names and model stems', () => {
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
    expect(new Set(all.map((t) => t.name)).size).toBe(all.length);
    expect(new Set(all.map((t) => t.modelStem)).size).toBe(all.length);
  });

  it('has ordered trait ranges within bounds', () => {
    for (const t of all) {
      for (const r of [t.safety, t.transparency, t.ambition]) {
        expect(r[0], t.id).toBeGreaterThanOrEqual(0);
        expect(r[1], t.id).toBeLessThanOrEqual(100);
        expect(r[0], t.id).toBeLessThanOrEqual(r[1]);
      }
      expect(t.compute[0]).toBeGreaterThanOrEqual(0.6);
      expect(t.compute[1]).toBeLessThanOrEqual(1.4);
      expect(t.compute[0]).toBeLessThanOrEqual(t.compute[1]);
      expect(t.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.startModelNumber).toBeGreaterThanOrEqual(1);
      expect(t.ceo.length).toBeGreaterThan(3);
    }
  });

  it('names each country rival lead lab after one of its own companies', () => {
    for (const id of COUNTRY_IDS) expect(COMPANY_POOLS[id].map((t) => t.name)).toContain(COUNTRIES[id].rival.leadLab);
  });
});

// ═════════════════════════════ LEADERS & ADVISORS ═════════════════════════════
describe('leaders and advisors', () => {
  it('has 5 leaders per country, locked stances drawn from the country pool', () => {
    for (const id of COUNTRY_IDS) {
      expect(LEADERS[id].length, id).toBe(5);
      for (const l of LEADERS[id]) {
        if (l.stance) expect(COUNTRIES[id].stancePool, `${id} ${l.name}`).toContain(l.stance);
        expect(l.bio.length).toBeGreaterThan(10);
      }
      expect(LEADERS[id].some((l) => l.stance)).toBe(true);
      expect(LEADERS[id].some((l) => !l.stance)).toBe(true);
    }
  });

  it('defines all advisors and stance texts', () => {
    for (const id of ADVISOR_IDS) expect(ADVISORS[id]?.id).toBe(id);
    for (const s of STANCES) {
      expect(STANCE_TEXT[s].label.length).toBeGreaterThan(0);
      expect(STANCE_TEXT[s].motto.length).toBeGreaterThan(0);
      expect(STANCE_TEXT[s].text.length).toBeGreaterThan(0);
    }
  });
});

// ═════════════════════════════ SITUATIONS & FLAWS ═════════════════════════════
describe('situations and flaws', () => {
  it('covers every situation type with icons, stages and signals', () => {
    for (const t of SITUATIONS) {
      const f = SITUATION_FLAVOR[t];
      expect(f, t).toBeDefined();
      expect(f.icon).toBe(SITUATION_ICONS[t]);
      expect((ICON_NAMES as readonly string[]).includes(f.icon)).toBe(true);
      expect(f.stages.length).toBe(5);
      expect(f.signals.length).toBeGreaterThanOrEqual(6);
      expect(f.signals.length).toBeLessThanOrEqual(8);
      expect(new Set(f.signals).size).toBe(f.signals.length);
      for (const x of [f.name, f.unknownName, ...f.stages, ...f.signals, f.catastropheTitle, f.catastropheText, f.resolvedText])
        expect(badTokens(x), `${t}: ${x}`).toEqual([]);
    }
  });

  it('covers every flaw with 5–7 findings', () => {
    for (const t of FLAWS) {
      const f = FLAW_FLAVOR[t];
      expect(f, t).toBeDefined();
      expect(f.findings.length).toBeGreaterThanOrEqual(5);
      expect(f.findings.length).toBeLessThanOrEqual(7);
      for (const x of [f.name, f.description, ...f.findings]) expect(badTokens(x), `${t}: ${x}`).toEqual([]);
    }
  });

  it('never repeats a signal headline across situation types', () => {
    const all = SITUATIONS.flatMap((t) => SITUATION_FLAVOR[t].signals);
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps flaw findings sector-neutral (they can appear on any deployment)', () => {
    const sectorWords = /\b(grid|power plant|hospital|patient|doctor|bank|invoic\w*|sales|retail|factory|missile|drone|battlefield|router|classroom|school)\b/i;
    const bad = FLAWS.flatMap((t) => FLAW_FLAVOR[t].findings.filter((f) => sectorWords.test(f)).map((f) => `${t}: ${f}`));
    expect(bad).toEqual([]);
  });

  it('has enough clean and false-alarm evaluation lines', () => {
    expect(EVAL_TEXT.clean.length).toBeGreaterThanOrEqual(8);
    expect(EVAL_TEXT.falseAlarm.length).toBeGreaterThanOrEqual(8);
    for (const x of [...EVAL_TEXT.clean, ...EVAL_TEXT.falseAlarm]) expect(badTokens(x), x).toEqual([]);
  });
});

// ═════════════════════════════ HEADLINES ═════════════════════════════
describe('headlines', () => {
  it('has ≥15 generic headlines per era', () => {
    for (const era of ERAS) expect(HEADLINES.generic[era].length, era).toBeGreaterThanOrEqual(15);
  });
  it('has ≥5 headlines per trigger', () => {
    for (const t of TRIGGERS) expect(HEADLINES.triggered[t]?.length ?? 0, t).toBeGreaterThanOrEqual(5);
  });
  it('has ≥10 unique outlets', () => {
    expect(new Set(HEADLINES.outlets).size).toBeGreaterThanOrEqual(10);
  });
  it('uses only known tokens', () => {
    const all = [...ERAS.flatMap((e) => HEADLINES.generic[e]), ...TRIGGERS.flatMap((t) => HEADLINES.triggered[t] ?? [])];
    const bad = all.flatMap((h) => badTokens(h, HEADLINE_TOKENS).map((b) => `${h}: ${b}`));
    expect(bad).toEqual([]);
    const policyUsers = all.filter((h) => h.includes('{policy}'));
    for (const h of policyUsers) expect(HEADLINES.triggered.policy_enacted).toContain(h);
  });
});

// ═════════════════════════════ ENDINGS & TIPS ═════════════════════════════
describe('headline context rules', () => {
  // Tokens the engine binds for each trigger (see news.ts / systems): anything else would print a generic fallback.
  const BOUND: Partial<Record<HeadlineTrigger, string[]>> = {
    rival_breakthrough: ['rival', 'rivalAdj', 'rivalLab', 'rivalLeaderTitle'],
    espionage: ['rival', 'rivalAdj', 'rivalLab', 'rivalLeaderTitle'],
    domestic_breakthrough: ['company', 'ceo'],
    model_release: ['company', 'ceo', 'model'],
    model_approved: ['company', 'ceo', 'model'],
    model_rejected: ['company', 'ceo', 'model'],
    adoption: ['sector'],
    situation_public: ['situation', 'sector'],
    policy_enacted: ['policy'],
  };
  const CONTEXTUAL = ['rival', 'rivalAdj', 'rivalLab', 'rivalLeaderTitle', 'company', 'ceo', 'model', 'sector', 'situation', 'policy'];
  it('only uses contextual tokens the trigger actually binds', () => {
    const bad: string[] = [];
    for (const t of TRIGGERS)
      for (const h of HEADLINES.triggered[t]) {
        for (const m of h.matchAll(/\{(\w+)\}/g)) if (CONTEXTUAL.includes(m[1]) && !(BOUND[t] ?? []).includes(m[1])) bad.push(`${t}: ${h}`);
      }
    expect(bad).toEqual([]);
  });
  it('does not assume who leads the race or which side spied', () => {
    const assumes = /claims? the lead|tops every|world's most capable|falling behind|losing the (ai )?race|cannot match|widening .*gap|stealing ai secrets for/i;
    const bad = TRIGGERS.flatMap((t) => HEADLINES.triggered[t].filter((h) => assumes.test(h)).map((h) => `${t}: ${h}`));
    expect(bad).toEqual([]);
  });
  it('has no duplicate headlines anywhere in the bank', () => {
    const all = [...ERAS.flatMap((e) => HEADLINES.generic[e]), ...TRIGGERS.flatMap((t) => HEADLINES.triggered[t])];
    const seen = new Set<string>();
    const dupes = all.filter((h) => (seen.has(h) ? true : (seen.add(h), false)));
    expect(dupes).toEqual([]);
  });
});

describe('endings', () => {
  it('covers all endings with 2–4 epilogue paragraphs', () => {
    for (const id of ENDING_IDS) {
      const e = ENDINGS[id];
      expect(e, id).toBeDefined();
      expect(e.epilogue.length).toBeGreaterThanOrEqual(2);
      expect(e.epilogue.length).toBeLessThanOrEqual(4);
      expect(['good', 'neutral', 'bad', 'mixed']).toContain(e.tone);
      for (const t of [e.title, e.subtitle, ...e.epilogue]) expect(badTokens(t), `${id}: ${t}`).toEqual([]);
    }
  });
});

describe('tips', () => {
  it('covers all tips, ≤ 45 words, valid advisors', () => {
    for (const id of TIP_IDS) {
      const t = TIPS[id];
      expect(t, id).toBeDefined();
      expect(words(t.text), id).toBeLessThanOrEqual(45);
      expect(ADVISOR_IDS).toContain(t.advisor);
      expect(badTokens(t.text)).toEqual([]);
      expect(badTokens(t.title)).toEqual([]);
    }
  });
});
