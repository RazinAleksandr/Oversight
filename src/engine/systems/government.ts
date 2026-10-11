/**
 * Government (GDD §6): leader stance & confidence drift, demands with deadlines, negotiation
 * (comply / counter-offer / present evidence / refuse → "leader insists"), elections and the last-chance card.
 */
import { t, tr } from '../../i18n';
import { demandNotes } from '../advisors';
import { costBlock, makeCard, payCost } from '../cards';
import { changeMeter, changeResource, changeRisk, confidenceScale } from '../changes';
import { getCountry, getLeaders, getStanceText } from '../content';
import { PROGRAMS } from '../data/programs';
import { STANCE_DEMANDS, STANCE_WEIGHTS, type Priority } from '../data/stances';
import { bestRivalEstimate } from '../fog';
import { SECTOR_INFO, STANCE_LABELS, dateLabel } from '../labels';
import { addLog, bumpStat, highlight } from '../log';
import { DIFFICULTY } from '../modifiers';
import { pv, pvConf, pvConfExact, pvUnits } from '../preview';
import { domesticBestC, findCompany, findRival, leadingRival, publicSituations } from '../query';
import { rng } from '../rng';
import { sourceOf } from '../source';
import { fmt, situationDisplayName } from '../template';
import { publishHeadline } from '../news';
import { queueTip } from '../tips';
import type { Card, Choice, Demand, DemandKind, Government, GameState, SectorId, Stance } from '../types';
import { clamp, nextId } from '../util';
import type { TickCtx } from './tick';

export const DEMAND_CARD = 'sys:demand';
export const INSIST_CARD = 'sys:insist';
export const ELECTION_CARD = 'sys:election';
export const LAST_CHANCE_CARD = 'sys:last_chance';

// ───────────────────────────── Leader ─────────────────────────────

export function createGovernment(s: GameState, excludeName?: string, excludeStance?: Stance): Government {
  const r = rng(s);
  const country = getCountry(s.countryId);
  // A successor must differ from the outgoing leader: skip their name and anyone locked to their stance.
  // Names are compared by their English source, so a save made in another language still matches.
  const exclude = excludeName === undefined ? undefined : sourceOf(excludeName);
  const leaders = getLeaders(s.countryId).filter((l) => sourceOf(l.name) !== exclude && (!excludeStance || l.stance !== excludeStance));
  const tpl = r.pick(leaders.length ? leaders : getLeaders(s.countryId)) ?? { name: t('The {leaderTitle}', { leaderTitle: country.leaderTitle }), bio: '' };
  let stance: Stance | undefined = tpl.stance && tpl.stance !== excludeStance ? tpl.stance : undefined;
  if (!stance) {
    const pool = country.stancePool.filter((x) => x !== excludeStance);
    const all: Stance[] = ['accelerationist', 'hawk', 'cautious', 'populist'];
    stance = r.pick(pool.length ? pool : all.filter((x) => x !== excludeStance)) ?? 'cautious';
  }
  return {
    leaderName: tpl.name,
    leaderBio: tpl.bio,
    leaderTitle: country.leaderTitle,
    stance,
    portraitSeed: r.int(1, 1_000_000),
    resolve: clamp(r.int(20, 60) + DIFFICULTY[s.difficulty].resolve, 0, 100),
    briefCount: 0,
    sinceTurn: s.turn,
    calendar: country.calendar.map((c) => ({ ...c })),
    lastChanceUsed: false,
  };
}

/** How well the current record matches a stance's priorities, −1..1. */
export function stanceFit(s: GameState, stance: Stance): number {
  const w = STANCE_WEIGHTS[stance];
  const score: Record<Priority, number> = {
    growth: clamp((s.meters.economy - 50) / 30, -1, 1),
    security: clamp((s.meters.security - 50) / 30, -1, 1),
    stability: clamp((s.meters.stability - 50) / 30, -1, 1),
    safety: clamp((s.safeguards - domesticBestC(s) + 1) / 2 - 0.3 * publicSituations(s).length, -1, 1),
    race: clamp((domesticBestC(s) - (leadingRival(s)?.capability ?? 0)) / 2, -1, 1),
  };
  let num = 0;
  let den = 0;
  for (const k of Object.keys(w) as Priority[]) {
    num += w[k] * score[k];
    den += w[k];
  }
  return den ? num / den : 0;
}

function replaceLeader(s: GameState, endorsed: boolean): string {
  const old = s.government;
  const gov = createGovernment(s, old.leaderName, old.stance);
  gov.lastChanceUsed = old.lastChanceUsed;
  gov.calendar = old.calendar;
  s.government = gov;
  const lapsed = new Set<string>();
  for (const d of s.demands) {
    if (d.status === 'active' || d.status === 'offered') {
      d.status = 'refused';
      lapsed.add(d.id);
    }
  }
  // The old leader's pending demand/negotiation cards lapse with them.
  const stale = (c: Card) => (c.templateId === DEMAND_CARD || c.templateId === INSIST_CARD) && !!c.ctx.demandId && lapsed.has(c.ctx.demandId);
  s.inbox = s.inbox.filter((c) => !stale(c));
  s.queue = s.queue.filter((c) => !stale(c));
  const start = clamp(45 + 10 * stanceFit(s, gov.stance) - (endorsed ? 10 : 0), 20, 70);
  const p = { leaderTitle: gov.leaderTitle, leader: gov.leaderName, old: old.leaderName, stance: STANCE_LABELS[gov.stance] };
  changeMeter(s, 'confidence', start - s.meters.confidence, t('New {leaderTitle}: {leader}', p), true);
  addLog(s, t('{old} lost power. {leader} ({stance}) takes over.', p), true, 'mixed', undefined, { en: 'lost power' });
  highlight(s, t('New {leaderTitle}: {leader} — {stance}', p), 'mixed', 'government');
  bumpStat(s, 'leadersChanged');
  return t('{old} is out. {leader} takes office with a "{agenda}" agenda.', { ...p, agenda: getStanceText(gov.stance).label });
}

// ───────────────────────────── Confidence ─────────────────────────────

export function tickConfidence(s: GameState, tc: TickCtx): void {
  const w = STANCE_WEIGHTS[s.government.stance];
  const race = clamp(domesticBestC(s) - (leadingRival(s)?.capability ?? 0), -2, 1.5);
  const pub = publicSituations(s).length;
  const safety = clamp(0.5 - pub * 1.0 - tc.catastrophes.length * 2, -3, 1);
  const terms: [string, number][] = [
    [t('Economic performance'), w.growth * clamp(tc.econDelta, -3, 3)],
    [t('Security situation'), w.security * clamp(tc.secDelta, -3, 3)],
    [t('Public mood'), w.stability * clamp(tc.stabDelta, -3, 3)],
    [t('Position in the AI race'), w.race * race],
    [t('AI safety record'), w.safety * safety],
  ];
  for (const [label, v] of terms) {
    const d = 0.5 * v;
    if (Math.abs(d) >= 0.05) changeMeter(s, 'confidence', d, label);
  }
  changeMeter(s, 'confidence', -0.3, t('Political wear and tear'));
  if (s.meters.confidence <= 30) queueTip(s, 'low_confidence');
}

// ───────────────────────────── Demands ─────────────────────────────

const SPAN: Record<DemandKind, number> = {
  growth_target: 3,
  deploy_sector: 3,
  approve_model: 3,
  match_rival: 3,
  budget_cut: 2,
  cover_up: 2,
  jobs_guarantee: 3,
  defense_program: 2,
};

const GENEROSITY: Record<DemandKind, number> = {
  growth_target: 0.1,
  deploy_sector: 0.05,
  approve_model: 0,
  match_rival: 0.1,
  budget_cut: 0.15,
  cover_up: -0.05,
  jobs_guarantee: 0.1,
  defense_program: 0.05,
};

function demandSector(s: GameState): SectorId {
  switch (s.government.stance) {
    case 'accelerationist':
      return s.adoption.business >= 70 ? 'infrastructure' : 'business';
    case 'hawk':
      return 'defense';
    default:
      return 'public';
  }
}

function demandFeasible(s: GameState, kind: DemandKind): boolean {
  switch (kind) {
    case 'cover_up':
      return s.situations.some((x) => x.detected && !x.resolved && x.stage <= 1);
    case 'defense_program':
      return (s.programs.defense ?? 0) < 2;
    case 'match_rival': {
      const rv = bestRivalEstimate(s).rival;
      return (s.programs.compute ?? 0) < 2 && !!rv && rv.capability > domesticBestC(s);
    }
    case 'deploy_sector':
      return s.adoption[demandSector(s)] < 80;
    case 'approve_model':
      return s.companies.some((c) => c.status !== 'suspended');
    default:
      return true;
  }
}

/** "Keep" demands that are naturally satisfied when issued and judged at the deadline. */
const INHERENTLY_MET: ReadonlySet<DemandKind> = new Set(['cover_up', 'jobs_guarantee']);

/** Fills a demand's target, deadline and text for the hard or softened version (texts always differ). */
function shapeDemand(s: GameState, d: Demand, soft: boolean): void {
  const lt = s.government.leaderTitle;
  const baseDeadline = Math.min(s.maxTurns, d.issuedTurn + SPAN[d.kind]);
  d.deadlineTurn = baseDeadline;
  switch (d.kind) {
    case 'growth_target': {
      // Feasible: about +1 Prosperity per quarter until the deadline (softened: one point less).
      const quarters = Math.max(1, baseDeadline - d.issuedTurn);
      const v = Math.min(95, Math.round((d.baseline ?? s.meters.economy) + (soft ? Math.max(1, quarters - 1) : quarters)));
      d.target = { meter: 'economy', value: v };
      d.title = t('Lift Prosperity to {value}', { value: v });
      d.text = t('The {leaderTitle} wants visible economic results: Prosperity at {value} by the end of {date}.', { leaderTitle: lt, value: v, date: dateLabel(d.deadlineTurn) });
      break;
    }
    case 'deploy_sector': {
      const sector = d.target.sector ?? demandSector(s);
      const v = Math.min(95, Math.round((d.baseline ?? s.adoption[sector]) + (soft ? 6 : 12)));
      d.target = { sector, value: v };
      d.title = t('{sector} AI adoption to {value}', { sector: SECTOR_INFO[sector].name, value: v });
      d.text = t('The {leaderTitle} wants AI working in {sector}: adoption of {value} by the end of {date}.', { leaderTitle: lt, sector: SECTOR_INFO[sector].name, value: v, date: dateLabel(d.deadlineTurn) });
      break;
    }
    case 'approve_model': {
      const c = findCompany(s, d.target.companyId);
      const p = { company: c?.name ?? t('a lab'), leaderTitle: lt, date: dateLabel(d.deadlineTurn) };
      d.title = soft ? fmt(tr("Deploy {company}'s next model (limits OK)"), p) : fmt(tr("Fully approve {company}'s next model"), p);
      const pt = { ...p, company: c?.name ?? t('A national champion') };
      d.text = soft
        ? fmt(tr("{company} has the {leaderTitle}'s ear. The {leaderTitle} expects their next model deployed, even with limits, by the end of {date}."), pt)
        : fmt(tr("{company} has the {leaderTitle}'s ear. The {leaderTitle} expects their next model fully approved by the end of {date}."), pt);
      break;
    }
    case 'match_rival': {
      const rv = findRival(s, d.target.rivalId);
      // Softened: a lower level if we have none yet, otherwise one more quarter.
      const lowLevel = soft && (s.programs.compute ?? 0) < 1;
      const lvl = lowLevel ? 1 : 2;
      if (soft && !lowLevel) d.deadlineTurn = Math.min(s.maxTurns, baseDeadline + 1);
      d.target = { ...d.target, program: 'compute', level: lvl };
      const p = { rival: rv?.name ?? t('our rivals'), level: lvl, date: dateLabel(d.deadlineTurn), leaderTitle: lt };
      d.title = t('Keep pace with {rival}: National Compute level {level} by {date}', p);
      d.text = t('The {leaderTitle} will not be outpaced by {rival}. Have National Compute at level {level} (or overtake them) at the end of {date}.', p);
      break;
    }
    case 'budget_cut': {
      const v = Math.round((d.baseline ?? s.budget) + (soft ? 4 : 8));
      d.target = { value: v };
      d.title = t('Hold ${value}B in the treasury', { value: v });
      d.text = t('The finance ministry wants savings. The treasury must hold at least ${value}B at the end of {date}.', { value: v, date: dateLabel(d.deadlineTurn) });
      break;
    }
    case 'cover_up': {
      const x = s.situations.find((sx) => sx.id === d.target.situationId);
      if (soft) d.deadlineTurn = Math.max(d.issuedTurn + 1, baseDeadline - 1);
      const p = { situation: x ? situationDisplayName(x) : t('the incident'), date: dateLabel(d.deadlineTurn), leaderTitle: lt };
      d.title = t('Keep {situation} out of the news until {date}', p);
      d.text = t('The {leaderTitle} does not want a public scandal. Make sure {situation} does not become a public incident before the end of {date}.', p);
      break;
    }
    case 'jobs_guarantee': {
      const v = Math.max(12, Math.round((d.baseline ?? s.displacement) + (soft ? 10 : 4)));
      d.target = { value: v };
      d.title = t('Keep job displacement under {value}', { value: v });
      d.text = t('The {leaderTitle} promised voters their jobs are safe. Job displacement must stay at or below {value} through {date}.', { leaderTitle: lt, value: v, date: dateLabel(d.deadlineTurn) });
      break;
    }
    case 'defense_program': {
      const lowLevel = soft && (s.programs.defense ?? 0) < 1;
      const lvl = soft && lowLevel ? 1 : 2;
      if (soft && !lowLevel) d.deadlineTurn = Math.min(s.maxTurns, baseDeadline + 1);
      d.target = { program: 'defense', level: lvl };
      d.title = t('Defense AI at level {level} by {date}', { level: lvl, date: dateLabel(d.deadlineTurn) });
      d.text = t('The {leaderTitle} wants our forces modernized: {program} funded at level {level} at the end of {date} — and kept there.', {
        leaderTitle: lt,
        program: PROGRAMS.defense.name,
        level: lvl,
        date: dateLabel(d.deadlineTurn),
      });
      break;
    }
  }
  // Stored as the amounts the player will actually feel (volatility included); applied raw.
  d.reward = Math.round((soft ? 6 : 10) * confidenceScale(s));
  d.penalty = Math.round((soft ? 8 : 12 + Math.round(s.government.resolve / 25)) * confidenceScale(s));
  d.softened = soft;
}

function newDemand(s: GameState, kind: DemandKind): Demand {
  const d: Demand = {
    id: '',
    kind,
    title: '',
    text: '',
    status: 'offered',
    issuedTurn: s.turn,
    deadlineTurn: Math.min(s.maxTurns, s.turn + SPAN[kind]),
    target: {},
    reward: 10,
    penalty: 12,
    softened: false,
  };
  switch (kind) {
    case 'growth_target':
      d.baseline = s.meters.economy;
      break;
    case 'deploy_sector': {
      const sector = demandSector(s);
      d.target = { sector };
      d.baseline = s.adoption[sector];
      break;
    }
    case 'approve_model': {
      const pending = s.models.find((m) => m.status === 'pending');
      const c =
        findCompany(s, pending?.companyId) ??
        [...s.companies].filter((x) => x.status !== 'suspended').sort((a, b) => b.capability - b.capAtLastModel - (a.capability - a.capAtLastModel))[0];
      d.target = { companyId: c?.id };
      break;
    }
    case 'match_rival':
      d.target = { rivalId: bestRivalEstimate(s).rival?.id };
      break;
    case 'budget_cut':
      d.baseline = s.budget;
      break;
    case 'cover_up': {
      const x = s.situations.find((sx) => sx.detected && !sx.resolved && sx.stage <= 1);
      d.target = { situationId: x?.id };
      break;
    }
    case 'jobs_guarantee':
      d.baseline = s.displacement;
      break;
    case 'defense_program':
      break;
  }
  shapeDemand(s, d, false);
  return d;
}

/** Picks a stance-appropriate demand that is feasible and not already met when issued. */
export function createDemand(s: GameState): Demand | null {
  const r = rng(s);
  const weights = STANCE_DEMANDS[s.government.stance];
  const recent = s.demands.slice(-2).map((d) => d.kind);
  const pool = (Object.keys(weights) as DemandKind[]).filter((k) => demandFeasible(s, k) && !recent.includes(k));
  if (!pool.includes('growth_target')) pool.push('growth_target');
  while (pool.length) {
    const kind = r.weightedPick(pool, (k) => weights[k] ?? 0.5);
    if (!kind) break;
    pool.splice(pool.indexOf(kind), 1);
    const d = newDemand(s, kind);
    if (!INHERENTLY_MET.has(kind) && demandSatisfied(s, d)) continue;
    d.id = nextId(s, 'd');
    s.demands.push(d);
    return d;
  }
  return null;
}

/** Confidence lost by refusing outright (effective amount, applied raw). */
export function refuseCost(s: GameState, insisting = false): number {
  return Math.round((6 + s.government.resolve / 10) * (insisting ? 1.5 : 1) * confidenceScale(s));
}

export function counterChance(s: GameState, d: Demand): number {
  return clamp(0.5 + (s.meters.confidence - 50) / 100 - s.government.resolve / 200 + GENEROSITY[d.kind], 0.05, 0.95);
}

function softPreviewTitle(s: GameState, d: Demand): string {
  const copy: Demand = { ...d, target: { ...d.target } };
  shapeDemand(s, copy, true);
  return copy.title;
}

export function demandCard(s: GameState, d: Demand): Card {
  const p = counterChance(s, d);
  const rc = refuseCost(s);
  const choices: Choice[] = [
    {
      id: 'comply',
      label: t('Agree'),
      hint: t('Promise: {promise} (+{reward} if kept, −{penalty} if broken)', { promise: d.title, reward: d.reward, penalty: d.penalty }),
      preview: [pvConf(s, 1)],
      uncertain: true,
      stamp: 'approved',
      tone: 'neutral',
    },
    { id: 'counter', label: t('Counter-offer'), hint: t('Propose: {promise}', { promise: softPreviewTitle(s, d) }), preview: [], uncertain: true, chance: p, stamp: 'noted', tone: 'neutral' },
    {
      id: 'evidence',
      label: t('Present evidence'),
      hint: t('Use Evidence to argue for the softer version.'),
      preview: [pvUnits('evidence', -1)],
      uncertain: true,
      chance: clamp(p + 0.3, 0.05, 0.95),
      cost: { evidence: 1 },
      disabled: costBlock(s, { evidence: 1 }),
      stamp: 'noted',
      tone: 'safe',
    },
    { id: 'refuse', label: t('Refuse'), hint: t('Say no now (−{cost} confidence) rather than break a promise later.', { cost: rc }), preview: [pvConfExact(-rc)], stamp: 'denied', tone: 'risky' },
  ];
  return makeCard(s, {
    kind: 'demand',
    templateId: DEMAND_CARD,
    title: d.title,
    body: d.text,
    subtitle: t('Demand · due {date}', { date: dateLabel(d.deadlineTurn) }),
    source: { type: 'government', name: t('Office of the {leaderTitle}', { leaderTitle: s.government.leaderTitle }) },
    urgency: 'priority',
    advisors: demandNotes(s, d, rc),
    choices,
    ctx: { demandId: d.id },
    tags: ['politics'],
  });
}

function insistCard(s: GameState, d: Demand): Card {
  const rc = refuseCost(s, true);
  return makeCard(s, {
    kind: 'negotiation',
    templateId: INSIST_CARD,
    title: t('The {leaderTitle} insists', { leaderTitle: s.government.leaderTitle }),
    body: t('Your counter-offer was rejected. {leader} wants it done as originally stated: {promise}. Refusing now will be taken personally.', { leader: s.government.leaderName, promise: d.title }),
    subtitle: t('Negotiation'),
    source: { type: 'government', name: t('Office of the {leaderTitle}', { leaderTitle: s.government.leaderTitle }) },
    urgency: 'priority',
    choices: [
      { id: 'comply', label: t('Comply'), hint: t('Promise: {promise}', { promise: d.title }), preview: [], uncertain: true, stamp: 'approved' },
      { id: 'refuse', label: t('Refuse'), hint: t('Stand your ground (−{cost} confidence).', { cost: rc }), preview: [pvConfExact(-rc)], stamp: 'denied', tone: 'risky' },
    ],
    ctx: { demandId: d.id },
    tags: ['politics'],
  });
}

function activate(s: GameState, d: Demand): void {
  d.status = 'active';
  if (d.kind === 'cover_up') {
    const x = s.situations.find((sx) => sx.id === d.target.situationId);
    changeRisk(s, 1, 'Cover-up', 'domestic'); // hidden: never shown
    const c = findCompany(s, x?.source.companyId);
    if (c) c.transparency = clamp(c.transparency - 5, 0, 100);
  }
  addLog(s, t('Promised the {leaderTitle}: {promise}.', { leaderTitle: s.government.leaderTitle, promise: d.title }), false, 'neutral', { demandId: d.id });
}

export interface GovResolution {
  ok: boolean;
  error?: string;
  text: string;
  success?: boolean;
  newCard?: Card;
}

export function resolveDemandCard(s: GameState, card: Card, choiceId: string): GovResolution {
  const d = s.demands.find((x) => x.id === card.ctx.demandId);
  if (!d || d.status !== 'offered') return { ok: true, text: t('The demand has lapsed.') };
  const r = rng(s);
  const insisting = card.templateId === INSIST_CARD;
  switch (choiceId) {
    case 'comply':
      activate(s, d);
      if (!insisting) changeMeter(s, 'confidence', 1, t('Agreed to a demand'));
      return { ok: true, text: t('You commit: {promise} (due {date}).', { promise: d.title, date: dateLabel(d.deadlineTurn) }) };
    case 'refuse': {
      const cost = refuseCost(s, insisting);
      d.status = 'refused';
      changeMeter(s, 'confidence', -cost, insisting ? t('Defied the {leaderTitle}', { leaderTitle: s.government.leaderTitle }) : t('Refused a demand'), true);
      addLog(s, t("Refused the {leaderTitle}'s demand: {promise}.", { leaderTitle: s.government.leaderTitle, promise: d.title }), true, 'mixed', { demandId: d.id });
      bumpStat(s, 'demandsRefused');
      return { ok: true, text: t('You refuse. {leader} will remember this.', { leader: s.government.leaderName }) };
    }
    case 'counter':
    case 'evidence': {
      if (insisting) return { ok: false, error: t('Not available'), text: '' };
      const useEvidence = choiceId === 'evidence';
      if (useEvidence) {
        const block = costBlock(s, { evidence: 1 });
        if (block) return { ok: false, error: block, text: '' };
        payCost(s, { evidence: 1 }, t('Presented evidence'));
      }
      // Roll exactly the chance shown on the (refreshed) card.
      const shown = card.choices.find((c) => c.id === choiceId)?.chance;
      const p = shown ?? clamp(counterChance(s, d) + (useEvidence ? 0.3 : 0), 0.05, 0.95);
      if (r.chance(p)) {
        shapeDemand(s, d, true);
        activate(s, d);
        bumpStat(s, 'negotiationsWon');
        return { ok: true, success: true, text: t('Accepted. The revised promise: {promise} (due {date}).', { promise: d.title, date: dateLabel(d.deadlineTurn) }) };
      }
      bumpStat(s, 'negotiationsLost');
      return { ok: true, success: false, text: t('{leader} rejects the counter-offer.', { leader: s.government.leaderName }), newCard: insistCard(s, d) };
    }
  }
  return { ok: false, error: t('Unknown choice'), text: '' };
}

/** Whether an active demand's goal is currently satisfied. */
export function demandSatisfied(s: GameState, d: Demand): boolean {
  switch (d.kind) {
    case 'growth_target':
      return s.meters.economy >= (d.target.value ?? 0);
    case 'deploy_sector':
      return d.target.sector ? s.adoption[d.target.sector] >= (d.target.value ?? 0) : false;
    case 'approve_model':
      return s.models.some(
        (m) =>
          m.companyId === d.target.companyId &&
          (m.decisionTurn ?? -1) >= d.issuedTurn &&
          (m.status === 'deployed' || (d.softened && m.status === 'limited')),
      );
    case 'match_rival': {
      const rv = findRival(s, d.target.rivalId);
      return (s.programs.compute ?? 0) >= (d.target.level ?? 2) || (!!rv && domesticBestC(s) >= rv.capability);
    }
    case 'budget_cut':
      return s.budget >= (d.target.value ?? 0);
    case 'cover_up': {
      const x = s.situations.find((sx) => sx.id === d.target.situationId);
      return !x || x.resolved || x.stage < 2 || !x.detected;
    }
    case 'jobs_guarantee':
      return s.displacement <= (d.target.value ?? 0);
    case 'defense_program':
      return (s.programs.defense ?? 0) >= (d.target.level ?? 2);
  }
}

/** Demands judged only at their deadline (the rest are met as soon as achieved). */
const KEEP_KINDS: ReadonlySet<DemandKind> = new Set(['budget_cut', 'cover_up', 'jobs_guarantee', 'defense_program', 'match_rival']);

export function demandProgress(s: GameState, d: Demand): { progress: number; label: string } {
  switch (d.kind) {
    case 'growth_target': {
      const base = d.baseline ?? 0;
      const v = d.target.value ?? 0;
      return { progress: clamp((s.meters.economy - base) / Math.max(1, v - base), 0, 1), label: t('Prosperity {value} / {target}', { value: Math.round(s.meters.economy), target: v }) };
    }
    case 'deploy_sector': {
      const sec = d.target.sector ?? 'business';
      const base = d.baseline ?? 0;
      const v = d.target.value ?? 0;
      return {
        progress: clamp((s.adoption[sec] - base) / Math.max(1, v - base), 0, 1),
        label: t('{sector} adoption {value} / {target}', { sector: SECTOR_INFO[sec].name, value: Math.round(s.adoption[sec]), target: v }),
      };
    }
    case 'approve_model':
      return { progress: demandSatisfied(s, d) ? 1 : 0, label: demandSatisfied(s, d) ? t('Model approved') : t('Awaiting their next model') };
    case 'match_rival':
      return {
        progress: clamp((s.programs.compute ?? 0) / (d.target.level ?? 2), 0, 1),
        label: t('National Compute L{level} / L{target}', { level: s.programs.compute ?? 0, target: d.target.level ?? 2 }),
      };
    case 'budget_cut':
      return { progress: clamp(s.budget / Math.max(1, d.target.value ?? 1), 0, 1), label: t('Treasury ${value}B / ${target}B', { value: Math.round(s.budget), target: String(d.target.value) }) };
    case 'cover_up':
      return { progress: demandSatisfied(s, d) ? 1 : 0, label: demandSatisfied(s, d) ? t('Still out of the news') : t('Public — promise broken') };
    case 'jobs_guarantee':
      return { progress: demandSatisfied(s, d) ? 1 : 0, label: t('Displacement {value} / max {target}', { value: Math.round(s.displacement), target: String(d.target.value) }) };
    case 'defense_program':
      return {
        progress: clamp((s.programs.defense ?? 0) / (d.target.level ?? 2), 0, 1),
        label: t('Defense AI L{level} / L{target}', { level: s.programs.defense ?? 0, target: d.target.level ?? 2 }),
      };
  }
}

export function tickDemands(s: GameState): void {
  for (const d of s.demands) {
    if (d.status !== 'active') continue;
    const ok = demandSatisfied(s, d);
    const atDeadline = s.turn >= d.deadlineTurn;
    const brokenEarly = d.kind === 'cover_up' && !ok;
    if (!KEEP_KINDS.has(d.kind) && ok) settle(s, d, true);
    else if (brokenEarly) settle(s, d, false);
    else if (atDeadline) settle(s, d, ok);
  }
}

/** At the end of the run, pending promises are judged as they stand (counted in legitimacy). */
export function settleAllDemands(s: GameState): void {
  for (const d of s.demands) if (d.status === 'active') settle(s, d, demandSatisfied(s, d));
}

function settle(s: GameState, d: Demand, met: boolean): void {
  d.status = met ? 'met' : 'failed';
  if (met) {
    changeMeter(s, 'confidence', d.reward, t('Promise kept: {promise}', { promise: d.title }), true);
    highlight(s, t('Promise kept: {promise}', { promise: d.title }), 'good', 'check');
    bumpStat(s, 'demandsMet');
  } else {
    changeMeter(s, 'confidence', -d.penalty, t('Broken promise: {promise}', { promise: d.title }), true);
    highlight(s, t('Promise broken: {promise}', { promise: d.title }), 'bad', 'cross');
    addLog(s, t('Broke a promise to the {leaderTitle}: {promise}.', { leaderTitle: s.government.leaderTitle, promise: d.title }), true, 'bad', { demandId: d.id }, { en: 'broke a promise' });
    bumpStat(s, 'demandsFailed');
  }
}

export function demandDue(s: GameState): boolean {
  if (s.turn < 2) return false;
  const next = typeof s.flags.nextDemandTurn === 'number' ? s.flags.nextDemandTurn : 2;
  if (s.turn < next) return false;
  return s.demands.filter((d) => d.status === 'active' || d.status === 'offered').length < 2;
}

export function scheduleNextDemand(s: GameState): void {
  const [lo, hi] = DIFFICULTY[s.difficulty].demandInterval;
  s.flags.nextDemandTurn = s.turn + rng(s).int(lo, hi);
}

// ───────────────────────────── Elections ─────────────────────────────

export function electionChance(s: GameState, kind: 'election' | 'congress'): number {
  if (kind === 'congress') return clamp(0.8 + (s.meters.economy + s.meters.stability - 110) / 300, 0.5, 0.95);
  return clamp(0.35 + (s.meters.economy - 50) / 150 + (s.meters.stability - 50) / 150 + 0.15, 0.1, 0.9);
}

export function electionCard(s: GameState, kind: 'election' | 'congress'): Card {
  const p = electionChance(s, kind);
  const lt = s.government.leaderTitle;
  const isCongress = kind === 'congress';
  // The campaign headline runs before the result is known.
  if (isCongress) {
    s.news.push({
      turn: s.turn,
      outlet: t('State Broadcaster'),
      text: t('Party Congress opens in {capital}; delegates weigh the AI record', { capital: getCountry(s.countryId).capital }),
      tone: 'neutral',
    });
  } else {
    publishHeadline(s, 'election');
  }
  const leader = s.government.leaderName;
  return makeCard(s, {
    kind: 'election',
    templateId: ELECTION_CARD,
    title: isCongress ? t('The Party Congress convenes') : t('Election day for the {leaderTitle}', { leaderTitle: lt }),
    body: isCongress
      ? fmt(tr("Party elders gather to review the leadership. {leader}'s position depends on the economy and public order. A new {leaderTitle} could have very different priorities."), { leader, leaderTitle: lt })
      : t('{leader} faces the voters. Prosperity and stability will decide it. If the {leaderTitle} loses, a successor with a different agenda will judge your record from scratch.', { leader, leaderTitle: lt }),
    subtitle: isCongress ? t('Leadership Review') : t('Election'),
    source: { type: 'government', name: isCongress ? t('Party Central Committee') : t('Electoral Commission') },
    urgency: 'critical',
    evidence: [
      { label: t('Prosperity'), value: String(Math.round(s.meters.economy)), confidence: 'verified' },
      { label: t('Stability'), value: String(Math.round(s.meters.stability)), confidence: 'verified' },
      { label: t("Incumbent's chances"), value: `${Math.round(p * 100)}%`, confidence: 'high' },
    ],
    choices: [
      { id: 'neutral', label: t('Stay above politics'), hint: t('Your department stays neutral.'), preview: [], uncertain: true, chance: p, stamp: 'noted' },
      { id: 'endorse', label: t('Back the {leaderTitle} publicly', { leaderTitle: lt }), hint: t('Big reward if they win; a cold start if they lose.'), preview: [], uncertain: true, chance: p, stamp: 'signed', tone: 'risky' },
      {
        id: 'campaign',
        label: t('Fund a public AI briefing tour'),
        hint: t("$4B to showcase the government's AI record (+8%)."),
        preview: [pv('budget', -4)],
        uncertain: true,
        chance: clamp(p + 0.08, 0, 0.97),
        cost: { budget: 4 },
        disabled: costBlock(s, { budget: 4 }),
        stamp: 'noted',
      },
    ],
    ctx: {},
    tags: ['politics'],
  });
}

export function resolveElectionCard(s: GameState, card: Card, choiceId: string): GovResolution {
  const ch = card.choices.find((c) => c.id === choiceId);
  if (!ch) return { ok: false, error: t('Unknown choice'), text: '' };
  if (choiceId === 'campaign') payCost(s, ch.cost, t('Public AI briefing tour'));
  const p = ch.chance ?? 0.5;
  s.flags[`reviewDone:${s.turn}`] = true;
  bumpStat(s, 'elections');
  if (rng(s).chance(p)) {
    const bonus = choiceId === 'endorse' ? 8 : 3;
    const leader = s.government.leaderName;
    changeMeter(s, 'confidence', bonus, choiceId === 'endorse' ? t('Backed the winner') : t('Leadership secure'));
    addLog(s, choiceId === 'endorse' ? t('{leader} kept power with your public backing.', { leader }) : t('{leader} kept power.', { leader }), false, 'good');
    return { ok: true, success: true, text: t('{leader} stays in office.', { leader }) };
  }
  return { ok: true, success: false, text: replaceLeader(s, choiceId === 'endorse') };
}

export function electionDue(s: GameState): 'election' | 'congress' | null {
  const e = s.government.calendar.find((c) => c.turn === s.turn);
  return e ? e.kind : null;
}

// ───────────────────────────── Last chance ─────────────────────────────

/** The concession each stance demands on the last-chance card. */
function concession(stance: Stance): { label: string; hint: string } {
  switch (stance) {
    case 'accelerationist':
      return { label: t('Fast-track every deployment'), hint: t('Enact the Fast-Track; repeal testing rules.') };
    case 'hawk':
      return { label: t('Hand defense AI to the generals'), hint: t('Defense AI to maximum; tensions rise.') };
    case 'cautious':
      return { label: t('Freeze new business deployments'), hint: t('Business AI targets cut; growth suffers.') };
    case 'populist':
      return { label: t('Guarantee jobs with an AI levy'), hint: t('Enact the AI Dividend; prosperity pays for it.') };
  }
}

export function lastChanceCard(s: GameState): Card {
  s.government.lastChanceUsed = true;
  const c = concession(s.government.stance);
  return makeCard(s, {
    kind: 'last_chance',
    templateId: LAST_CHANCE_CARD,
    title: t('Your job is on the line'),
    body: t('{leader} has asked for your resignation letter "to keep on file". You have one chance to win back the {leaderTitle}\'s confidence.', {
      leader: s.government.leaderName,
      leaderTitle: s.government.leaderTitle,
    }),
    subtitle: t('Last Chance'),
    source: { type: 'advisor', name: t('Chief of Staff'), id: 'chief_of_staff' },
    urgency: 'critical',
    choices: [
      { id: 'concede', label: c.label, hint: c.hint, preview: [pvConf(s, 14)], uncertain: true, stamp: 'signed', tone: 'risky' },
      { id: 'pr', label: t('Launch a PR campaign'), hint: t('$8B to rebuild your standing.'), preview: [pvConf(s, 10), pv('budget', -8)], cost: { budget: 8 }, disabled: costBlock(s, { budget: 8 }), stamp: 'noted' },
      { id: 'gamble', label: t('Stake your job on a bold promise'), hint: t('Win big or lose it all.'), preview: [], uncertain: true, chance: 0.55, stamp: 'urgent', tone: 'aggressive' },
    ],
    ctx: {},
    tags: ['politics'],
  });
}

export function resolveLastChanceCard(s: GameState, _card: Card, choiceId: string): GovResolution {
  switch (choiceId) {
    case 'concede': {
      const st = s.government.stance;
      if (st === 'accelerationist') {
        if (!s.policies.includes('fast_track')) s.policies.push('fast_track');
        s.policies = s.policies.filter((p) => p !== 'mandatory_evals' && p !== 'compute_licensing');
      } else if (st === 'hawk') {
        s.programs.defense = 3;
        changeResource(s, 'tension', 10, t('Militarized AI'));
      } else if (st === 'cautious') {
        changeMeter(s, 'economy', -6, t('Deployment freeze'));
        s.adoptionTarget.business = Math.max(0, s.adoptionTarget.business - 10);
      } else {
        if (!s.policies.includes('ai_dividend')) s.policies.push('ai_dividend');
        changeMeter(s, 'economy', -5, t('AI levy'));
      }
      changeMeter(s, 'confidence', 14, t('Major concession'));
      addLog(s, t('Made a major concession to keep your job: {concession}.', { concession: concession(st).label }), true, 'mixed');
      return { ok: true, text: t('The {leaderTitle} accepts. You survive — on their terms.', { leaderTitle: s.government.leaderTitle }) };
    }
    case 'pr': {
      const block = costBlock(s, { budget: 8 });
      if (block) return { ok: false, error: block, text: '' };
      payCost(s, { budget: 8 }, t('PR campaign'));
      changeMeter(s, 'confidence', 10, t('PR campaign'));
      return { ok: true, text: t('Op-eds, interviews, a well-timed photo-op. The pressure eases.') };
    }
    case 'gamble':
      if (rng(s).chance(0.55)) {
        changeMeter(s, 'confidence', 18, t('Bold promise pays off'));
        addLog(s, t('Staked your job on a bold promise — and won.'), true, 'good');
        return { ok: true, success: true, text: t('The gamble pays off spectacularly. You are untouchable — for now.') };
      }
      changeMeter(s, 'confidence', -10, t('Bold promise backfires'));
      addLog(s, t('Staked your job on a bold promise — and lost.'), true, 'bad');
      return { ok: true, success: false, text: t('It backfires in public. Your days look numbered.') };
  }
  return { ok: false, error: t('Unknown choice'), text: '' };
}

/** Keeps negotiation and election odds current when meters change mid-quarter. */
export function refreshGovernmentCard(s: GameState, card: Card): void {
  if (card.templateId === DEMAND_CARD) {
    const d = s.demands.find((x) => x.id === card.ctx.demandId);
    if (!d) return;
    const p = counterChance(s, d);
    for (const ch of card.choices) {
      if (ch.id === 'counter') ch.chance = p;
      if (ch.id === 'evidence') {
        ch.chance = clamp(p + 0.3, 0.05, 0.95);
        ch.disabled = costBlock(s, ch.cost);
      }
    }
  } else if (card.templateId === ELECTION_CARD) {
    // The review kind comes from the calendar entry that created the card (never from its text).
    const kind = s.government.calendar.find((c) => c.turn === card.createdTurn)?.kind ?? 'election';
    const p = electionChance(s, kind);
    for (const ch of card.choices) {
      ch.chance = ch.id === 'campaign' ? clamp(p + 0.08, 0, 0.97) : p;
      if (ch.cost) ch.disabled = costBlock(s, ch.cost);
    }
    // Evidence lines: Prosperity, Stability, Incumbent's chances (see electionCard).
    const line = card.evidence?.[2];
    if (line) line.value = `${Math.round(p * 100)}%`;
  } else {
    for (const ch of card.choices) if (ch.cost) ch.disabled = costBlock(s, ch.cost);
  }
}
