/**
 * Content access layer: every read of `src/content/**` goes through here so missing or partial
 * content falls back to engine defaults instead of crashing the simulation.
 */
import { COMPANY_POOLS } from '../content/companies';
import { COUNTRIES } from '../content/countries';
import { ENDINGS } from '../content/endings';
import { EVENTS } from '../content/events/index';
import { HEADLINES } from '../content/headlines';
import { ADVISORS, LEADERS, STANCE_TEXT } from '../content/leaders';
import { EVAL_TEXT, FLAW_FLAVOR, SITUATION_FLAVOR } from '../content/situations';
import { TIPS } from '../content/tips';
import {
  COUNTRY_TRAIT_MODS,
  FALLBACK_ADVISORS,
  FALLBACK_COMPANIES,
  FALLBACK_COUNTRIES,
  FALLBACK_ENDINGS,
  FALLBACK_EVAL_TEXT,
  FALLBACK_FLAW_FLAVOR,
  FALLBACK_HEADLINES,
  FALLBACK_LEADERS,
  FALLBACK_SITUATION_FLAVOR,
  FALLBACK_STANCE_TEXT,
  FALLBACK_TIPS,
} from './data/fallback';
import type {
  AdvisorDef,
  AdvisorId,
  CompanyTemplate,
  CountryDef,
  CountryId,
  EndingId,
  EndingText,
  Era,
  EventDef,
  FlawFlavor,
  FlawType,
  HeadlineTrigger,
  LeaderTemplate,
  Modifiers,
  SituationFlavor,
  SituationType,
  Stance,
  TipDef,
  TipId,
} from './types';

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function nonEmptyArray<T>(v: unknown): v is T[] {
  return Array.isArray(v) && v.length > 0;
}

function isRange(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number';
}

/** Country definition merged over the fallback (content wins field-by-field when valid). */
export function getCountry(id: CountryId): CountryDef {
  const fb = FALLBACK_COUNTRIES[id];
  const c = (COUNTRIES as Partial<Record<CountryId, CountryDef>>)[id];
  if (!isObj(c)) return fb;
  const start = isObj(c.start) ? { ...fb.start, ...c.start } : fb.start;
  return {
    ...fb,
    ...c,
    id,
    start: {
      confidence: num(start.confidence, fb.start.confidence),
      economy: num(start.economy, fb.start.economy),
      stability: num(start.stability, fb.start.stability),
      security: num(start.security, fb.start.security),
      budget: num(start.budget, fb.start.budget),
    },
    incomeBase: num(c.incomeBase, fb.incomeBase),
    compute: num(c.compute, fb.compute),
    labCapRange: isRange(c.labCapRange) ? c.labCapRange : fb.labCapRange,
    startSafeguards: num(c.startSafeguards, fb.startSafeguards),
    stancePool: nonEmptyArray<Stance>(c.stancePool) ? c.stancePool : fb.stancePool,
    calendar: Array.isArray(c.calendar) ? c.calendar : fb.calendar,
    traitPlus: isObj(c.traitPlus) ? c.traitPlus : fb.traitPlus,
    traitMinus: isObj(c.traitMinus) ? c.traitMinus : fb.traitMinus,
    modifiers: isObj(c.modifiers) ? c.modifiers : {},
    trust: isObj(c.trust) ? { ...fb.trust, ...c.trust } : fb.trust,
    rival: isObj(c.rival)
      ? {
          aggression: isRange(c.rival.aggression) ? c.rival.aggression : fb.rival.aggression,
          safetyStance: isRange(c.rival.safetyStance) ? c.rival.safetyStance : fb.rival.safetyStance,
          leadLab: typeof c.rival.leadLab === 'string' && c.rival.leadLab ? c.rival.leadLab : fb.rival.leadLab,
        }
      : fb.rival,
    intro: nonEmptyArray<string>(c.intro) ? c.intro : fb.intro,
    strengths: Array.isArray(c.strengths) ? c.strengths : fb.strengths,
    weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses : fb.weaknesses,
  };
}

/** Country modifiers: engine trait defaults, overridden key-by-key by content (never stacked). */
export function getCountryModifiers(id: CountryId): Partial<Modifiers> {
  return { ...COUNTRY_TRAIT_MODS[id], ...getCountry(id).modifiers };
}

function num(v: unknown, fb: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fb;
}

export function getCompanyPool(id: CountryId): CompanyTemplate[] {
  const pool = (COMPANY_POOLS as Partial<Record<CountryId, CompanyTemplate[]>>)[id];
  const valid = Array.isArray(pool)
    ? pool.filter((t) => isObj(t) && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.archetype === 'string')
    : [];
  // Need at least 3 distinct archetypes including a frontier lab; otherwise top up from fallback.
  const archetypes = new Set(valid.map((t) => t.archetype));
  if (valid.length >= 3 && archetypes.size >= 3 && archetypes.has('frontier')) return valid;
  const merged = [...valid];
  for (const t of FALLBACK_COMPANIES[id]) {
    if (!merged.some((m) => m.archetype === t.archetype)) merged.push(t);
  }
  return merged;
}

export function getLeaders(id: CountryId): LeaderTemplate[] {
  const list = (LEADERS as Partial<Record<CountryId, LeaderTemplate[]>>)[id];
  return nonEmptyArray<LeaderTemplate>(list) ? list : FALLBACK_LEADERS[id];
}

export function getAdvisor(id: AdvisorId): AdvisorDef {
  const a = (ADVISORS as Partial<Record<AdvisorId, AdvisorDef>>)[id];
  return isObj(a) && typeof a.name === 'string' ? { ...FALLBACK_ADVISORS[id], ...a } : FALLBACK_ADVISORS[id];
}

export function getStanceText(stance: Stance): { label: string; motto: string; text: string } {
  const t = (STANCE_TEXT as Partial<Record<Stance, { label: string; motto: string; text: string }>>)[stance];
  return isObj(t) && typeof t.text === 'string' ? { ...FALLBACK_STANCE_TEXT[stance], ...t } : FALLBACK_STANCE_TEXT[stance];
}

export function getSituationFlavor(type: SituationType): SituationFlavor {
  const f = (SITUATION_FLAVOR as Partial<Record<SituationType, SituationFlavor>>)[type];
  const fb = FALLBACK_SITUATION_FLAVOR[type];
  if (!isObj(f)) return fb;
  return {
    ...fb,
    ...f,
    stages: Array.isArray(f.stages) && f.stages.length === 5 ? f.stages : fb.stages,
    signals: nonEmptyArray<string>(f.signals) ? f.signals : fb.signals,
  };
}

export function getFlawFlavor(type: FlawType): FlawFlavor {
  const f = (FLAW_FLAVOR as Partial<Record<FlawType, FlawFlavor>>)[type];
  const fb = FALLBACK_FLAW_FLAVOR[type];
  if (!isObj(f)) return fb;
  return { ...fb, ...f, findings: nonEmptyArray<string>(f.findings) ? f.findings : fb.findings };
}

export function getEvalText(): { clean: string[]; falseAlarm: string[] } {
  const e = EVAL_TEXT as Partial<typeof FALLBACK_EVAL_TEXT> | undefined;
  return {
    clean: nonEmptyArray<string>(e?.clean) ? e.clean : FALLBACK_EVAL_TEXT.clean,
    falseAlarm: nonEmptyArray<string>(e?.falseAlarm) ? e.falseAlarm : FALLBACK_EVAL_TEXT.falseAlarm,
  };
}

export function getHeadlinesFor(trigger: HeadlineTrigger): string[] {
  const list = isObj(HEADLINES) && isObj(HEADLINES.triggered) ? HEADLINES.triggered[trigger] : undefined;
  return nonEmptyArray<string>(list) ? list : FALLBACK_HEADLINES.triggered[trigger];
}

export function getGenericHeadlines(era: Era): string[] {
  const list = isObj(HEADLINES) && isObj(HEADLINES.generic) ? HEADLINES.generic[era] : undefined;
  return nonEmptyArray<string>(list) ? list : FALLBACK_HEADLINES.generic[era];
}

export function getOutlets(): string[] {
  const list = isObj(HEADLINES) ? HEADLINES.outlets : undefined;
  return nonEmptyArray<string>(list) ? list : FALLBACK_HEADLINES.outlets;
}

export function getEndingText(id: EndingId): EndingText {
  const e = (ENDINGS as Partial<Record<EndingId, EndingText>>)[id];
  const fb = FALLBACK_ENDINGS[id];
  if (!isObj(e)) return fb;
  return { ...fb, ...e, epilogue: nonEmptyArray<string>(e.epilogue) ? e.epilogue : fb.epilogue };
}

export function getTip(id: TipId): TipDef {
  const t = (TIPS as Partial<Record<TipId, TipDef>>)[id];
  return isObj(t) && typeof t.text === 'string' ? t : FALLBACK_TIPS[id];
}

/** All scripted events with a valid shape (ids unique; first wins). */
let eventCache: { src: EventDef[]; list: EventDef[]; byId: Map<string, EventDef> } | null = null;
function eventIndex(): { list: EventDef[]; byId: Map<string, EventDef> } {
  const src = Array.isArray(EVENTS) ? EVENTS : [];
  if (eventCache && eventCache.src === src && eventCache.list.length <= src.length) return eventCache;
  const byId = new Map<string, EventDef>();
  const list: EventDef[] = [];
  for (const e of src) {
    if (!isObj(e) || typeof e.id !== 'string' || !Array.isArray(e.choices) || e.choices.length === 0) continue;
    if (byId.has(e.id)) continue;
    byId.set(e.id, e);
    list.push(e);
  }
  eventCache = { src, list, byId };
  return eventCache;
}

export function getEvents(): EventDef[] {
  return eventIndex().list;
}

export function getEvent(id: string): EventDef | undefined {
  return eventIndex().byId.get(id);
}
