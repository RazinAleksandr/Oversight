/**
 * GameView construction (GDD §2.2, §4): everything the UI may see, fogged.
 * Never exposes hidden truth: true risk, traits, flaws of unconfirmed models, undetected situations.
 */
import { getAdvisor, getCountry, getStanceText } from './content';
import { POLICIES, POLICY_ORDER } from './data/policies';
import { PROGRAMS, PROGRAM_ORDER } from './data/programs';
import { SITUATION_ICON } from './data/situations';
import { PRIORITY_LABELS, STANCE_WEIGHTS, type Priority } from './data/stances';
import {
  companyCapEstimate,
  domesticCapEstimate,
  modelCapEstimate,
  riskEstimate,
  rivalCapEstimate,
  rivalSafeguardsEstimate,
  rivalTraitView,
  traitView,
} from './fog';
import { ERA_INFO, METER_INFO, STAGE_LABELS, STANCE_LABELS, dateLabel, turnYearQuarter } from './labels';
import { getMods } from './modifiers';
import { currentEra, dependence, findCompany, findModel, shownTurn } from './query';
import { policyCost } from './actions';
import { refreshCard } from './resolve';
import { computeIncome, programUpkeep } from './systems/economy';
import { demandProgress, demandSatisfied } from './systems/government';
import { escalationExpected, responseViews, severityEstimate, situationText, visibleStage } from './systems/situations';
import { situationDisplayName } from './template';
import type {
  AIModel,
  AdvisorId,
  Card,
  CardContext,
  Company,
  CompanyView,
  DemandView,
  GameState,
  GameView,
  GovernmentView,
  LogEntry,
  MeterId,
  MeterView,
  ModelView,
  NewsItem,
  Rival,
  RivalView,
  RiskView,
  Situation,
  SituationView,
} from './types';
import { deepClone, round1 } from './util';

const METERS: MeterId[] = ['confidence', 'economy', 'stability', 'security'];

export function clockFor(estimate: number): { clock: string; minutes: number } {
  const minutes = Math.max(0, Math.round(60 * (1 - estimate / 100)));
  if (minutes <= 0) return { clock: '00:00', minutes: 0 };
  return { clock: `23:${String(60 - minutes).padStart(2, '0')}`, minutes };
}

function meterStatus(v: number): MeterView['status'] {
  return v <= 15 ? 'critical' : v <= 30 ? 'strained' : 'ok';
}

export function meterReasons(s: GameState, key: MeterId, fromTurn: number): { reason: string; delta: number }[] {
  const agg = new Map<string, number>();
  for (const c of s.changes) {
    if (c.key !== key || c.turn < fromTurn) continue;
    agg.set(c.reason, (agg.get(c.reason) ?? 0) + c.delta);
  }
  return [...agg.entries()]
    .map(([reason, delta]) => ({ reason, delta: round1(delta) }))
    .filter((r) => Math.abs(r.delta) >= 0.1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function meterViews(s: GameState): Record<MeterId, MeterView> {
  const out = {} as Record<MeterId, MeterView>;
  for (const id of METERS) {
    const hist = s.meterHistory[id];
    const value = Math.round(s.meters[id]);
    // Change since the start of the previous quarter: includes the last tick and this quarter's decisions so far.
    const base = hist.length >= 2 ? hist[hist.length - 2] : hist[0] ?? s.meters[id];
    const lastDelta = Math.round(s.meters[id] - base);
    out[id] = {
      id,
      name: METER_INFO[id].name,
      value,
      history: hist.map((v) => Math.round(v)),
      lastDelta,
      reasons: meterReasons(s, id, s.turn - 1),
      status: meterStatus(value),
    };
  }
  return out;
}

function riskView(s: GameState): RiskView {
  const est = riskEstimate(s);
  const { clock, minutes } = clockFor(est.estimate);
  const prev = s.riskHistory.length >= 2 ? s.riskHistory[s.riskHistory.length - 2] : est.estimate;
  const d = est.estimate - prev;
  return { estimate: est.estimate, low: est.low, high: est.high, clock, minutesToMidnight: minutes, trend: d > 1 ? 'up' : d < -1 ? 'down' : 'flat', history: [...s.riskHistory] };
}

export function modelFlawView(m: AIModel): ModelView['flaw'] {
  if (m.flawKnown && m.flaw) return m.flaw;
  if (m.suspected) return 'suspected';
  if (m.audited || m.deepEvaluated) return 'none_found';
  return 'unknown';
}

function modelView(s: GameState, m: AIModel): ModelView {
  const c = findCompany(s, m.companyId);
  // An unapproved deployment is hidden truth until it surfaces.
  const status = m.status === 'rogue_deployed' && !s.flags[`rogueKnown:${m.id}`] ? 'rejected' : m.status;
  const v: ModelView = {
    id: m.id,
    name: m.name,
    companyId: m.companyId,
    companyName: c?.name ?? 'Unknown',
    capability: modelCapEstimate(s, m),
    status,
    sectors: [...m.sectors],
    openWeights: m.openWeights,
    flaw: modelFlawView(m),
    releasedTurn: m.releasedTurn,
  };
  const x = s.situations.find((sx) => sx.source.modelId === m.id && sx.detected && sx.causeKnown);
  if (x) v.situationId = x.id;
  return v;
}

function attitude(rel: number): CompanyView['attitude'] {
  return rel >= 70 ? 'Cooperative' : rel >= 50 ? 'Friendly' : rel >= 25 ? 'Wary' : 'Hostile';
}

function companyView(s: GameState, c: Company): CompanyView {
  return {
    id: c.id,
    name: c.name,
    archetype: c.archetype,
    tagline: c.tagline,
    description: c.description,
    color: c.color,
    ceo: c.ceo,
    relation: Math.round(c.relation),
    attitude: attitude(c.relation),
    status: c.status,
    capability: companyCapEstimate(c),
    safety: traitView(c, 'safety'),
    transparency: traitView(c, 'transparency'),
    ambition: traitView(c, 'ambition'),
    intel: round1(c.intel),
    investigatedTurn: c.lastInvestigatedTurn,
    models: s.models.filter((m) => m.companyId === c.id).map((m) => modelView(s, m)),
    knownViolations: c.violations.filter((v) => v.discovered).map((v) => ({ ...v })),
    evidenceCount: s.evidence.filter((e) => e.companyId === c.id).length,
  };
}

function rivalView(r: Rival): RivalView {
  const t = r.trust;
  return {
    id: r.id,
    name: r.name,
    adjective: r.adjective,
    leaderTitle: r.leaderTitle,
    color: r.color,
    color2: r.color2,
    leadLab: r.leadLab,
    capability: rivalCapEstimate(r),
    safeguards: rivalSafeguardsEstimate(r),
    trust: Math.round(t),
    attitude: t >= 75 ? 'Ally' : t >= 55 ? 'Friendly' : t >= 40 ? 'Neutral' : t >= 25 ? 'Distrustful' : 'Hostile',
    aggressionLabel: rivalTraitView(r, 'aggression'),
    safetyLabel: rivalTraitView(r, 'safetyStance'),
    intel: round1(r.intel),
    accordMember: r.accordMember,
    exportControlled: r.exportControlled,
    partnership: r.partnership,
  };
}

function situationView(s: GameState, x: Situation): SituationView {
  const typeKnown = x.causeKnown || x.stage >= 2;
  const stage = visibleStage(x);
  const sev = severityEstimate(s, x);
  const model = findModel(s, x.source.modelId);
  const company = findCompany(s, x.source.companyId ?? model?.companyId);
  const v: SituationView = {
    id: x.id,
    type: typeKnown ? x.type : 'unknown',
    name: situationDisplayName(x),
    icon: typeKnown ? SITUATION_ICON[x.type] : 'warning',
    stage,
    stageLabel: STAGE_LABELS[stage],
    text: situationText(s, x),
    severity: { value: sev.value, low: sev.low, high: sev.high, confidence: x.causeKnown ? 'high' : 'low' },
    causeKnown: x.causeKnown,
    escalationWarning: escalationExpected(s, x),
    response: x.response,
    responses: x.resolved ? [] : responseViews(s, x),
    resolved: x.resolved,
  };
  if (x.causeKnown) v.sourceLabel = model ? `${model.name} (${company?.name ?? 'unknown'})` : x.origin;
  if (x.detectedTurn !== undefined) v.detectedTurn = x.detectedTurn;
  if (x.outcome) v.outcome = x.outcome;
  return v;
}

const SETTLED_LABEL: Partial<Record<DemandView['status'], string>> = {
  met: 'Promise kept',
  failed: 'Promise broken',
  refused: 'Refused',
};

function demandView(s: GameState, d: GameState['demands'][number]): DemandView {
  const live = demandProgress(s, d);
  const settled = SETTLED_LABEL[d.status];
  const progress = settled ? (d.status === 'met' ? 1 : 0) : live.progress;
  const label = settled ?? live.label;
  const left = d.deadlineTurn - s.turn;
  return {
    id: d.id,
    kind: d.kind,
    title: d.title,
    text: d.text,
    status: d.status,
    deadlineTurn: d.deadlineTurn,
    deadlineLabel: d.status === 'active' ? (left <= 0 ? `Due this quarter (${dateLabel(d.deadlineTurn)})` : `Due ${dateLabel(d.deadlineTurn)} · ${left + 1} quarters left`) : dateLabel(d.deadlineTurn),
    progress,
    progressLabel: label,
    reward: d.reward,
    penalty: d.penalty,
  };
}

function governmentView(s: GameState): GovernmentView {
  const g = s.government;
  const w = STANCE_WEIGHTS[g.stance];
  const conf = s.meters.confidence;
  const next = g.calendar.filter((c) => c.turn > s.turn || (c.turn === s.turn && !s.flags[`reviewDone:${c.turn}`])).sort((a, b) => a.turn - b.turn)[0];
  const view: GovernmentView = {
    leaderName: g.leaderName,
    leaderBio: g.leaderBio,
    leaderTitle: g.leaderTitle,
    stance: g.stance,
    stanceLabel: getStanceText(g.stance).label || STANCE_LABELS[g.stance],
    stanceText: getStanceText(g.stance).text,
    portraitSeed: g.portraitSeed,
    priorities: (Object.keys(w) as Priority[]).sort((a, b) => w[b] - w[a]).map((k) => ({ key: k, label: PRIORITY_LABELS[k], weight: w[k] })),
    mood: conf >= 65 ? 'Supportive' : conf >= 45 ? 'Satisfied' : conf >= 25 ? 'Impatient' : 'Hostile',
    demands: s.demands.filter((d) => d.status === 'active' || d.status === 'offered' || d.deadlineTurn >= s.turn - 1).map((d) => demandView(s, d)),
  };
  if (next) view.nextReview = { turn: next.turn, kind: next.kind, label: `${next.kind === 'congress' ? 'Party Congress' : 'Election'} · ${dateLabel(next.turn)}` };
  return view;
}

/** Strips links to situations the player has not detected. */
function sanitizeCtx(s: GameState, ctx: CardContext): CardContext {
  if (!ctx.situationId) return ctx;
  const x = s.situations.find((sx) => sx.id === ctx.situationId);
  if (x?.detected) return ctx;
  const { situationId: _hidden, ...rest } = ctx;
  return rest;
}

/** Copy of a card with up-to-date availability (views never mutate state). */
function cardView(s: GameState, card: Card): Card {
  const copy = deepClone(card);
  refreshCard(s, copy);
  copy.ctx = sanitizeCtx(s, copy.ctx);
  copy.createdTurn = shownTurn(s, copy.createdTurn);
  return copy;
}

function newsView(s: GameState, n: NewsItem): NewsItem {
  if (!n.situationId) return { ...n, turn: shownTurn(s, n.turn) };
  const x = s.situations.find((sx) => sx.id === n.situationId);
  if (x?.detected) return { ...n, turn: shownTurn(s, n.turn) };
  const { situationId: _hidden, ...rest } = n;
  return { ...rest, turn: shownTurn(s, n.turn) };
}

function logView(s: GameState, l: LogEntry): LogEntry {
  const turn = shownTurn(s, l.turn);
  return l.refs ? { ...l, turn, refs: sanitizeCtx(s, l.refs) } : { ...l, turn };
}

export function currentWarnings(s: GameState): string[] {
  const w: string[] = [];
  for (const id of METERS) {
    const v = s.meters[id];
    if (v <= 15) w.push(`${METER_INFO[id].name} critical (${Math.round(v)}) — ${METER_INFO[id].failText}`);
    else if (v <= 30) w.push(`${METER_INFO[id].name} strained (${Math.round(v)})`);
  }
  if (s.meters.confidence <= 30) w.push(`The ${s.government.leaderTitle} is losing patience with you.`);
  if (programUpkeep(s) > s.budget + computeIncome(s)) w.push('The treasury cannot cover program upkeep — programs will be cut.');
  const risk = riskEstimate(s);
  if (risk.estimate >= 70) w.push('The Risk Clock is close to midnight.');
  for (const x of s.situations) if (escalationExpected(s, x)) w.push(`⚠ ${situationDisplayName(x)}: escalation expected next quarter`);
  for (const d of s.demands) if (d.status === 'active' && d.deadlineTurn === s.turn && !demandSatisfied(s, d)) w.push(`Promise due this quarter: ${d.title}`);
  if (s.tension >= 80) w.push('Race tension is near the breaking point.');
  return w;
}

export function advisorRoster(): NonNullable<GameView['advisors']> {
  const ids: AdvisorId[] = ['chief_of_staff', 'scientist', 'economist', 'intelligence'];
  const out = {} as NonNullable<GameView['advisors']>;
  for (const id of ids) {
    const a = getAdvisor(id);
    out[id] = { name: a.name, role: a.role, bias: a.bias, portraitSeed: a.portraitSeed };
  }
  return out;
}

export function buildView(s: GameState): GameView {
  const country = getCountry(s.countryId);
  const turnShown = shownTurn(s);
  const { year, quarter } = turnYearQuarter(turnShown);
  const era = currentEra(s);
  const mods = getMods(s);
  const dom = domesticCapEstimate(s);
  const inbox = s.inbox.map((c) => cardView(s, c));
  return {
    turn: turnShown,
    maxTurns: s.maxTurns,
    year,
    quarter,
    dateLabel: dateLabel(turnShown),
    era,
    eraLabel: ERA_INFO[era].name,
    difficulty: s.difficulty,
    seed: s.seed,
    country: { id: country.id, name: country.name, adjective: country.adjective, color: country.color, color2: country.color2, leaderTitle: s.government.leaderTitle },
    meters: meterViews(s),
    risk: riskView(s),
    nation: {
      safeguards: round1(s.safeguards),
      capability: dom.est,
      frontierLeader: dom.leader?.name ?? '—',
      adoption: { business: Math.round(s.adoption.business), public: Math.round(s.adoption.public), infrastructure: Math.round(s.adoption.infrastructure), defense: Math.round(s.adoption.defense) },
      adoptionTarget: {
        business: Math.round(s.adoptionTarget.business),
        public: Math.round(s.adoptionTarget.public),
        infrastructure: Math.round(s.adoptionTarget.infrastructure),
        defense: Math.round(s.adoptionTarget.defense),
      },
      dependence: Math.round(dependence(s)),
      displacement: Math.round(s.displacement),
      budget: round1(s.budget),
      income: computeIncome(s, mods),
      upkeep: programUpkeep(s),
      capacity: s.capacity,
      capacityMax: s.capacityMax,
      evidence: s.evidence.map((e) => ({ ...e })),
      programs: PROGRAM_ORDER.map((id) => ({
        id,
        name: PROGRAMS[id].name,
        short: PROGRAMS[id].short,
        description: PROGRAMS[id].description,
        icon: PROGRAMS[id].icon,
        level: s.programs[id] ?? 0,
        costs: [...PROGRAMS[id].costs] as [number, number, number, number],
        levelText: [...PROGRAMS[id].levelText] as [string, string, string, string],
      })),
      policies: POLICY_ORDER.map((id) => ({
        id,
        name: POLICIES[id].name,
        short: POLICIES[id].short,
        description: POLICIES[id].description,
        icon: POLICIES[id].icon,
        effectsText: [...POLICIES[id].effectsText],
        active: s.policies.includes(id),
        politicalCost: policyCost(s, id),
        leaderSupport: POLICIES[id].support[s.government.stance] ?? 0,
      })),
      exportControls: s.exportControls,
      tension: Math.round(s.tension),
      accord: { progress: Math.round(s.accord.progress), signed: s.accord.signed, members: s.rivals.filter((r) => r.accordMember).map((r) => r.id) },
    },
    government: governmentView(s),
    companies: s.companies.map((c) => companyView(s, c)),
    models: s.models.map((m) => modelView(s, m)),
    rivals: s.rivals.map(rivalView),
    situations: s.situations.filter((x) => x.detected).map((x) => situationView(s, x)),
    inbox,
    news: s.news.slice(-40).reverse().map((n) => newsView(s, n)),
    log: s.log.slice().reverse().map((l) => logView(s, l)),
    unlockedTabs: [...s.unlockedTabs],
    pendingTips: [...s.pendingTips],
    canEndTurn: !s.gameOver && s.inbox.length === 0,
    gameOver: s.gameOver,
    ending: s.ending,
    warnings: currentWarnings(s),
    advisors: advisorRoster(),
    finale: s.inbox.some((c) => c.kind === 'threshold'),
    lastReport: s.lastReport ?? null,
  };
}
