/**
 * Situations (GDD §8): hidden severity growth, stages, detection, the two-signal rule,
 * escalation warnings, stage cards, responses, catastrophes and resolution.
 */
import { costBlock, makeCard, payCost } from '../cards';
import { changeAdoptionTarget, changeCompanyRelation, changeMeter, changeResource, changeRisk, changeRivalTrust } from '../changes';
import { getAdvisor, getFlawFlavor, getOutlets, getSituationFlavor } from '../content';
import {
  CATASTROPHE_HITS,
  RESPONSE_INFO,
  SITUATION_BASE_GROWTH,
  SITUATION_ICON,
  SITUATION_SECTOR,
  type ResponseId,
} from '../data/situations';
import { SECTOR_INFO, STAGE_LABELS } from '../labels';
import { addLog, bumpStat, highlight, trigger } from '../log';
import { getMods } from '../modifiers';
import { lineUsed, markLineUsed } from '../news';
import { queueTip } from '../tips';
import { pv, pvConf, pvDir } from '../preview';
import { accordActive, currentEra, dependence, findCompany, findModel, findRival, globalFrontier, sectorAdoption } from '../query';
import { rng } from '../rng';
import { fillTemplate, situationDisplayName, type TemplateCtx } from '../template';
import type {
  AIModel,
  Card,
  Choice,
  CountryId,
  EffectPreview,
  EndingId,
  EvidenceLine,
  GameState,
  Modifiers,
  ResponseView,
  SectorId,
  Situation,
  SituationType,
} from '../types';
import { clamp, hashNoise, nextId } from '../util';
import type { TickCtx } from './tick';

export function stageFor(severity: number): 0 | 1 | 2 | 3 | 4 {
  if (severity >= 100) return 4;
  if (severity >= 70) return 3;
  if (severity >= 45) return 2;
  if (severity >= 20) return 1;
  return 0;
}

export interface SpawnOpts {
  severity?: number;
  companyId?: string;
  modelId?: string;
  rivalId?: CountryId;
  sector?: SectorId;
  detected?: boolean;
  growthMult?: number;
  origin?: string;
  originLogId?: string;
  noEarlyBoost?: boolean;
}

/** Stage as the player understands it (true stage once investigated or public). */
export function visibleStage(x: Situation): Situation['stage'] {
  if (x.causeKnown || x.stage >= 2 || x.resolved) return x.stage;
  return Math.min(x.stage, x.notifiedStage ?? x.stage) as Situation['stage'];
}

/**
 * Template context for situation text. Until the cause is known (`reveal` false) it carries no
 * company/model/rival, and the sector only once the situation is public.
 */
export function situationTemplateCtx(s: GameState, x: Situation, reveal = x.causeKnown): TemplateCtx {
  if (!reveal) {
    const fogged: TemplateCtx = { situation: x };
    const sector = x.stage >= 2 ? (x.source.sector ?? SITUATION_SECTOR[x.type] ?? undefined) : undefined;
    if (sector) fogged.sector = sector;
    return fogged;
  }
  const ctx: TemplateCtx = { situation: x };
  const model = findModel(s, x.source.modelId);
  const company = findCompany(s, x.source.companyId ?? model?.companyId);
  const rival = findRival(s, x.source.rivalId);
  if (model) ctx.model = model;
  if (company) ctx.company = company;
  if (rival) ctx.rival = rival;
  const sector = x.source.sector ?? SITUATION_SECTOR[x.type] ?? undefined;
  if (sector) ctx.sector = sector;
  return ctx;
}

export function spawnSituation(s: GameState, type: SituationType, opts: SpawnOpts = {}): Situation {
  const model = findModel(s, opts.modelId);
  const company = findCompany(s, opts.companyId ?? model?.companyId);
  const rival = findRival(s, opts.rivalId);
  let severity = clamp(opts.severity ?? 6, 0, 99);
  if (s.turn < 4) severity = Math.min(severity, 44);
  const x: Situation = {
    id: nextId(s, 's'),
    type,
    severity,
    growth: SITUATION_BASE_GROWTH[type],
    growthMult: opts.growthMult ?? 1,
    stage: stageFor(severity),
    detected: !!opts.detected,
    causeKnown: false,
    source: {},
    spawnedTurn: s.turn,
    signalsShown: 0,
    signalTurns: [],
    response: 'none',
    resolved: false,
    origin:
      opts.origin ??
      (model && company
        ? `${model.name} (${company.name})`
        : company
          ? `${company.name}`
          : rival
            ? `${rival.name}`
            : 'Unknown origin'),
    peakSeverity: severity,
  };
  if (company) x.source.companyId = company.id;
  if (model) x.source.modelId = model.id;
  if (rival) x.source.rivalId = rival.id;
  const sector = opts.sector ?? model?.sectors[0];
  if (sector) x.source.sector = sector;
  if (opts.originLogId) x.originLogId = opts.originLogId;
  if (opts.noEarlyBoost) x.noEarlyBoost = true;
  if (x.detected) {
    x.detectedTurn = s.turn;
    x.notifiedStage = x.stage;
    x.signalsShown = 1;
    x.signalTurns.push(s.turn);
    unlockThreats(s);
  }
  if (model && !model.situationId) model.situationId = x.id;
  s.situations.push(x);
  bumpStat(s, 'situations');
  return x;
}

export function unlockThreats(s: GameState): void {
  if (!s.unlockedTabs.includes('threats')) {
    s.unlockedTabs.push('threats');
    s.flags.threatsTurn = s.turn;
    queueTip(s, 'threats');
  }
  queueTip(s, 'first_situation');
}

/** Capability and safeguards relevant to a situation's growth. */
function capabilityGap(s: GameState, x: Situation): { c: number; sg: number } {
  const model = findModel(s, x.source.modelId);
  if (model) return { c: model.capability, sg: s.safeguards };
  const rival = findRival(s, x.source.rivalId);
  if (rival) return { c: rival.capability, sg: rival.safeguards };
  const company = findCompany(s, x.source.companyId);
  if (company) return { c: company.capability, sg: s.safeguards };
  return { c: globalFrontier(s), sg: s.safeguards };
}

/** Expected severity change next quarter (no noise). Negative = receding. */
export function expectedGrowth(s: GameState, x: Situation, mods: Modifiers = getMods(s)): number {
  if (x.resolved) return 0;
  if (x.response === 'suspended' || x.response === 'shutdown') return -10;
  // With the cause known and no single model to pull, sustained containment makes the problem recede.
  if (x.response === 'contained' && x.causeKnown && !x.source.modelId) return -6;
  const { c, sg } = capabilityGap(s, x);
  // Safeguards that catch up with a restricted model let the problem fade.
  if (x.response === 'restricted' && sg >= c - 0.5 && x.type !== 'deceptive_model' && x.type !== 'model_escape') return -5;
  const gapF = 1 + 0.2 * Math.max(0, c - sg);
  const eraF = { emergence: 1, acceleration: 1.1, superhuman: 1.25, threshold: 1.35 }[currentEra(s)];
  const sector = SITUATION_SECTOR[x.type] ?? x.source.sector ?? null;
  const sectorF = 1 + sectorAdoption(s, sector) / 100;
  let modF = 1 + mods.incidentSeverity;
  if (x.type === 'infrastructure_failure') modF += mods.infraIncident;
  if (x.type === 'military_escalation') modF += mods.escalationGrowth;
  if (x.type === 'model_escape') modF += mods.escapeGrowth;
  let g = x.growth * gapF * eraF * sectorF * x.growthMult * (x.turnMult ?? 1) * Math.max(0.1, modF);
  if (x.type === 'military_escalation') g *= (0.7 + s.tension / 100) * (s.tension >= 90 ? 1.5 : 1);
  return g;
}

export function escalationExpected(s: GameState, x: Situation, mods?: Modifiers): boolean {
  if (x.resolved || !x.detected) return false;
  const g = expectedGrowth(s, x, mods);
  return g > 0 && stageFor(Math.min(100, x.severity + g)) > x.stage;
}

export function detect(s: GameState, x: Situation, tc: TickCtx | null): void {
  if (x.detected) return;
  x.detected = true;
  x.detectedTurn = s.turn;
  x.signalsShown += 1;
  x.signalTurns.push(s.turn);
  // A flaw the player already confirmed makes the cause obvious.
  if (findModel(s, x.source.modelId)?.flawKnown) x.causeKnown = true;
  unlockThreats(s);
  if (x.stage >= 2) trigger(s, 'situation_public', { situationId: x.id });
  highlight(s, `Threat detected: ${situationDisplayName(x)}`, 'bad', SITUATION_ICON[x.type]);
  tc?.situationCards.push({ situationId: x.id, reason: 'detected' });
}

const SIGNAL_THRESHOLDS = [12, 28, 50];

/** Fallback signal lines once a type's own lines are used up (never repeat a headline in a run). */
const FALLBACK_SIGNALS = [
  'Engineers swap notes about "{situation}"-like glitches nobody can reproduce',
  'Insurers quietly add a new exclusion for unexplained automated behaviour',
  'An anonymous forum post describes {situation} at an unnamed firm',
  'Help-desk tickets mentioning "AI did something odd" double in a quarter',
];

function emitSignal(s: GameState, x: Situation): void {
  const r = rng(s);
  const flavor = getSituationFlavor(x.type);
  const ctx = situationTemplateCtx(s, x);
  const fresh = flavor.signals.filter((line) => !lineUsed(s, line));
  const pool = fresh.length ? fresh : FALLBACK_SIGNALS.filter((line) => !lineUsed(s, line));
  const line = r.pick(pool.length ? pool : flavor.signals) ?? flavor.signals[0];
  markLineUsed(s, line);
  const text = fillTemplate(s, line, ctx);
  // The first signal is a news item; later ones come through intelligence or the department's telemetry.
  const advisor = x.type === 'military_escalation' || x.type === 'foreign_spillover' ? getAdvisor('intelligence') : getAdvisor('scientist');
  const outlet = x.signalsShown === 0 ? r.pick(getOutlets()) ?? 'Global Wire' : `${advisor.role} — internal note`;
  s.news.push({ turn: s.turn, outlet, text, tone: 'bad', signal: true, situationId: x.id, id: nextId(s, 'n') });
  x.signalsShown += 1;
  x.signalTurns.push(s.turn);
}

export function tickSituations(s: GameState, tc: TickCtx): void {
  const r = rng(s);
  const mods = getMods(s);
  for (const x of s.situations) {
    if (x.resolved) continue;
    const g = expectedGrowth(s, x, mods);
    x.turnMult = 1;
    if (g < 0) {
      x.severity = Math.max(0, x.severity + g);
      if (x.severity <= 0) {
        resolveSituation(s, x, x.response === 'none' || x.response === 'monitor' ? 'faded' : 'contained');
        continue;
      }
    } else {
      x.severity += g * r.range(0.8, 1.2);
    }
    if (s.turn < 4) x.severity = Math.min(x.severity, 44);
    if (!x.detected && x.signalsShown < 2) x.severity = Math.min(x.severity, 69);
    x.severity = clamp(x.severity, 0, 100);
    x.stage = stageFor(x.severity);
    x.peakSeverity = Math.max(x.peakSeverity ?? 0, x.severity);

    if (!x.detected && x.signalsShown < SIGNAL_THRESHOLDS.length && x.severity >= SIGNAL_THRESHOLDS[x.signalsShown]) {
      const last = x.signalTurns[x.signalTurns.length - 1] ?? -1;
      if (last < s.turn) emitSignal(s, x);
    }

    if (!x.detected) {
      const company = findCompany(s, x.source.companyId);
      const auto = x.severity >= (x.type === 'deceptive_model' ? 70 : 55);
      let p = 0;
      if (x.severity >= 20) {
        p = 0.15 + mods.earlyWarning;
        if (!x.noEarlyBoost && company && company.relation > 70) p += 0.15;
        if (x.type === 'deceptive_model') p *= 0.5;
        if (x.type === 'foreign_spillover') p *= 0.7; // it starts abroad, outside our telemetry
      }
      if (auto || r.chance(clamp(p, 0, 0.95))) detect(s, x, tc);
    } else if (x.stage > (x.notifiedStage ?? 0) && x.stage < 4) {
      tc.situationCards.push({ situationId: x.id, reason: 'stage' });
      if (x.stage >= 2) trigger(s, 'situation_public', { situationId: x.id });
      x.signalsShown += 1;
    }

    if (x.severity >= 100) catastrophe(s, x, tc);
  }
}

export function resolveSituation(s: GameState, x: Situation, outcome: NonNullable<Situation['outcome']>): void {
  if (x.resolved) return;
  x.resolved = true;
  x.resolvedTurn = s.turn;
  x.outcome = outcome;
  if (outcome !== 'catastrophe') {
    if (x.detected) {
      const ctx = situationTemplateCtx(s, x);
      highlight(s, fillTemplate(s, getSituationFlavor(x.type).resolvedText, ctx), 'good', SITUATION_ICON[x.type]);
    }
    bumpStat(s, 'situationsContained');
  }
}

export function setFailure(s: GameState, id: EndingId, cause: string): void {
  if (s.flags.pendingFailure) return;
  s.flags.pendingFailure = id;
  s.flags.failureCause = cause;
}

function catastrophe(s: GameState, x: Situation, tc: TickCtx): void {
  const flavor = getSituationFlavor(x.type);
  const ctx = situationTemplateCtx(s, x, true);
  x.severity = 100;
  x.stage = 4;
  x.detected = true;
  x.causeKnown = true;
  resolveSituation(s, x, 'catastrophe');
  bumpStat(s, 'catastrophes');
  tc.catastrophes.push(x.id);
  const title = fillTemplate(s, flavor.catastropheTitle, ctx);
  const text = fillTemplate(s, flavor.catastropheText, ctx);
  addLog(s, `${title}: ${text}`, true, 'bad', { situationId: x.id, modelId: x.source.modelId, companyId: x.source.companyId });
  highlight(s, `CATASTROPHE — ${title}`, 'bad', 'skull');
  s.news.push({ turn: s.turn, outlet: getOutlets()[0] ?? 'Global Wire', text: title, tone: 'bad', situationId: x.id });
  const hits = CATASTROPHE_HITS[x.type];
  for (const k of Object.keys(hits) as (keyof typeof hits)[]) changeMeter(s, k, hits[k] ?? 0, title);
  // The more the economy depends on AI, the harder a systemic failure hits it.
  const depHit = dependence(s) * (x.type === 'infrastructure_failure' ? 0.25 : x.type === 'rogue_agents' || x.type === 'cyber_misuse' ? 0.15 : 0);
  if (depHit > 0) changeMeter(s, 'economy', -depHit, `${title}: AI dependence`);
  changeRisk(s, 8, title, `situation:${x.type}`);
  changeResource(s, 'accord', 8, 'Wake-up call');
  const model = findModel(s, x.source.modelId);
  if (model && model.status !== 'suspended') {
    removeModelContribution(s, model, 1, title);
    model.status = 'suspended';
  }
  const c = model?.capability ?? capabilityGap(s, x).c;
  switch (x.type) {
    case 'rogue_agents':
      if (c >= 7) spawnSituation(s, 'model_escape', { severity: 50, detected: true, modelId: model?.id, companyId: x.source.companyId, origin: `Escaped during ${title}` });
      break;
    case 'deceptive_model':
      if (c >= 7) setFailure(s, 'loss_of_control', `${title}: ${x.origin}`);
      else spawnSituation(s, 'model_escape', { severity: 50, detected: true, modelId: model?.id, companyId: x.source.companyId, origin: `Escaped during ${title}` });
      break;
    case 'infrastructure_failure':
      changeAdoptionTarget(s, 'infrastructure', -20, title);
      s.adoption.infrastructure = Math.max(0, s.adoption.infrastructure - 10);
      break;
    case 'bio_misuse':
      setFailure(s, 'catastrophe', `${title}: ${x.origin}`);
      break;
    case 'military_escalation': {
      changeResource(s, 'tension', 25, title);
      const rivalMax = Math.max(...s.rivals.map((rv) => rv.capability));
      if (rivalMax >= 7 && s.tension >= 90 && rng(s).chance(0.5)) setFailure(s, 'ai_war', `${title} spiralled into open war`);
      break;
    }
    case 'model_escape':
      setFailure(s, 'loss_of_control', `${title}: ${x.origin}`);
      break;
    default:
      break;
  }
}

/** Removes (a share of) a model's adoption contribution from sector targets. */
export function removeModelContribution(s: GameState, model: AIModel, share: number, reason: string): void {
  for (const sector of Object.keys(model.contribution) as SectorId[]) {
    const amount = (model.contribution[sector] ?? 0) * share;
    if (amount <= 0) continue;
    changeAdoptionTarget(s, sector, -amount, reason);
    model.contribution[sector] = (model.contribution[sector] ?? 0) - amount;
  }
}

function contributionTotal(model: AIModel): number {
  let t = 0;
  for (const v of Object.values(model.contribution)) t += v ?? 0;
  return t;
}

/** Cost of pulling a model: scales with its own adoption; defense models cost Security instead of Prosperity. */
export function modelPullCost(model: AIModel, kind: 'restrict' | 'suspend'): { meter: 'economy' | 'security'; amount: number } {
  const contribution = contributionTotal(model);
  const meter = model.sectors[0] === 'defense' ? 'security' : 'economy';
  const amount = kind === 'suspend' ? 3 + contribution * 0.25 : clamp(1 + contribution * 0.08, 1, 4);
  return { meter, amount: Math.round(amount * 10) / 10 };
}

/** Leader reaction to pulling a model (shared by previews and effects). */
export function suspendReaction(s: GameState, model: AIModel): number {
  const stance = s.government.stance;
  return stance === 'accelerationist' ? -3 : stance === 'hawk' ? (model.sectors.includes('defense') ? -3 : -1) : stance === 'cautious' ? 2 : 1;
}

// ───────────────────────────── Responses ─────────────────────────────

function taskforceEligible(s: GameState, x: Situation): boolean {
  return x.type === 'model_escape' || x.type === 'foreign_spillover' || x.type === 'bio_misuse' || x.type === 'cyber_misuse';
}

function taskforcePartner(s: GameState): boolean {
  return accordActive(s) || s.rivals.some((r) => r.trust >= 60);
}

export function responseCost(id: ResponseId): { capacity?: number; budget?: number } | undefined {
  if (id === 'investigate') return { capacity: 1 };
  if (id === 'taskforce') return { capacity: 1, budget: 3 };
  return undefined;
}

/** Why a response is unavailable (null = available). */
export function responseBlock(s: GameState, x: Situation, id: ResponseId): string | null {
  if (x.resolved) return 'Already resolved';
  if (!x.detected) return 'Not detected';
  const model = findModel(s, x.source.modelId);
  const once = id !== 'monitor' && id !== 'investigate';
  if (once && x.lastResponseTurn === s.turn) return 'Already acted on this quarter';
  switch (id) {
    case 'monitor':
      return null;
    case 'investigate':
      if (x.causeKnown) return 'Cause already known';
      break;
    case 'contain':
      if (x.response === 'suspended' || x.response === 'shutdown') return 'Already being shut down';
      if (x.response === 'contained' && x.causeKnown && !x.source.modelId) return 'Already contained';
      break;
    case 'restrict':
      if (!x.causeKnown) return 'Cause unknown — investigate first';
      if (!model) return 'No single model to restrict';
      if (x.response === 'restricted' || x.response === 'suspended') return 'Already restricted';
      break;
    case 'suspend':
      if (!x.causeKnown) return 'Cause unknown — investigate first';
      if (!model) return 'No single model to suspend';
      if (x.response === 'suspended') return 'Already suspended';
      break;
    case 'shutdown':
      if (getMods(s).killSwitch <= 0) return 'Requires the Emergency Off-Switch Mandate';
      if (visibleStage(x) < 3) return 'Only available in a crisis';
      break;
    case 'taskforce':
      if (!x.causeKnown && x.stage < 2) return 'Identify the threat first';
      if (!taskforceEligible(s, x)) return 'Not an international threat';
      if (!taskforcePartner(s)) return 'Needs the Accord or a partner with trust ≥ 60';
      if (x.response === 'taskforce') return 'Task force already deployed';
      break;
  }
  return costBlock(s, responseCost(id));
}

function responsePreview(s: GameState, x: Situation, id: ResponseId): { preview: EffectPreview[]; uncertain: boolean } {
  const model = findModel(s, x.source.modelId);
  switch (id) {
    case 'monitor':
      return { preview: [], uncertain: true };
    case 'investigate':
      return { preview: [], uncertain: true };
    case 'contain':
      return { preview: [pv('economy', -3)], uncertain: true };
    case 'restrict':
    case 'suspend': {
      // Before investigation nothing about the source may show: generic preview, "Unknown source".
      if (!x.causeKnown || !model) return { preview: [pv('economy', id === 'suspend' ? -5 : -2), pv('company', id === 'suspend' ? -20 : -8, 'Unknown source')], uncertain: true };
      const cost = modelPullCost(model, id);
      const prev: EffectPreview[] = [pv(cost.meter, -cost.amount), pv('company', id === 'suspend' ? -20 : -8, findCompany(s, model.companyId)?.name)];
      if (id === 'suspend') prev.push(pvConf(s, suspendReaction(s, model)));
      return { preview: prev, uncertain: id === 'restrict' };
    }
    case 'shutdown':
      return { preview: [pv('economy', -8), pv('stability', -4), pvDir('risk', -1)], uncertain: false };
    case 'taskforce':
      return { preview: [pv('tension', -5), pv('rival', 5, 'Partners')], uncertain: true };
  }
}


export const RESPONSE_ORDER: ResponseId[] = ['monitor', 'investigate', 'contain', 'restrict', 'suspend', 'shutdown', 'taskforce'];

export function responseViews(s: GameState, x: Situation): ResponseView[] {
  return RESPONSE_ORDER.map((id) => {
    const { preview } = responsePreview(s, x, id);
    const v: ResponseView = { id, label: RESPONSE_INFO[id].label, description: RESPONSE_INFO[id].description, preview, disabled: responseBlock(s, x, id) };
    const cost = responseCost(id);
    if (cost) v.cost = cost;
    return v;
  });
}

export interface ResponseOutcome {
  ok: boolean;
  error?: string;
  title: string;
  text: string;
  revealed?: string[];
}

export function applyResponse(s: GameState, x: Situation, id: ResponseId): ResponseOutcome {
  const block = responseBlock(s, x, id);
  const name = situationDisplayName(x);
  if (block) return { ok: false, error: block, title: name, text: block };
  const model = findModel(s, x.source.modelId);
  const company = findCompany(s, x.source.companyId ?? model?.companyId);
  const reason = `${RESPONSE_INFO[id].label}: ${name}`;
  payCost(s, responseCost(id), reason);
  if (id !== 'monitor') x.firstActionTurn = x.firstActionTurn ?? s.turn;
  if (id !== 'monitor' && id !== 'investigate') x.lastResponseTurn = s.turn;
  switch (id) {
    case 'monitor':
      if (x.response === 'none') x.response = 'monitor';
      return { ok: true, title: name, text: 'Your analysts will keep watching. The situation continues to develop.' };
    case 'investigate': {
      x.causeKnown = true;
      x.turnMult = (x.turnMult ?? 1) * 0.9;
      bumpStat(s, 'investigations');
      const revealed: string[] = [`True stage: ${STAGE_LABELS[x.stage]}`];
      if (model) {
        model.flawKnown = model.flaw !== null;
        revealed.push(`Source: ${model.name} (${company?.name ?? 'unknown'})`);
        if (model.flaw) revealed.push(`Flaw: ${getFlawFlavor(model.flaw).name}`);
      } else if (company) {
        revealed.push(`Source: ${company.name} — an unreported incident`);
      } else if (x.source.rivalId) {
        revealed.push(`Source: spillover from ${findRival(s, x.source.rivalId)?.name ?? 'abroad'}`);
      }
      revealed.push(`Type: ${getSituationFlavor(x.type).name}`);
      addLog(s, `Investigated ${getSituationFlavor(x.type).name} — traced to ${x.origin}.`, false, 'neutral', { situationId: x.id, modelId: model?.id });
      return { ok: true, title: getSituationFlavor(x.type).name, text: `Investigation complete. ${revealed.join('. ')}.`, revealed };
    }
    case 'contain':
      x.turnMult = (x.turnMult ?? 1) * 0.5;
      if (x.response === 'none' || x.response === 'monitor' || (x.causeKnown && !x.source.modelId)) x.response = 'contained';
      changeMeter(s, 'economy', -3, `Broad containment: ${name}`);
      if (x.causeKnown && !x.source.modelId) return { ok: true, title: name, text: 'Targeted containment is in place. With the source known, the problem should now recede.' };
      return { ok: true, title: name, text: 'Blunt containment measures slow the spread this quarter, at a cost to business.' };
    case 'restrict': {
      if (!model) return { ok: false, error: 'No model', title: name, text: 'No model' };
      restrictModel(s, model, `Restricted ${model.name}`);
      addLog(s, `Restricted ${model.name} to contain ${getSituationFlavor(x.type).name}.`, true, 'good', { situationId: x.id, modelId: model.id, companyId: company?.id });
      return { ok: true, title: name, text: `${model.name} now runs under tight restrictions. Growth of the problem slows sharply.` };
    }
    case 'suspend': {
      if (!model) return { ok: false, error: 'No model', title: name, text: 'No model' };
      suspendModel(s, model, `Suspended ${model.name}`);
      addLog(s, `Suspended ${model.name} to stop ${getSituationFlavor(x.type).name}.`, true, 'good', { situationId: x.id, modelId: model.id, companyId: company?.id });
      return { ok: true, title: name, text: `${model.name} is pulled from service. The situation will recede — dependent businesses feel the shock.` };
    }
    case 'shutdown':
      changeMeter(s, 'economy', -8, `Emergency shutdown: ${name}`);
      changeMeter(s, 'stability', -4, `Emergency shutdown: ${name}`);
      x.response = 'shutdown';
      if (model) {
        removeModelContribution(s, model, 1, `Emergency shutdown of ${model.name}`);
        model.status = 'suspended';
      }
      resolveSituation(s, x, 'contained');
      changeRisk(s, -2, 'Emergency shutdown', 'response');
      addLog(s, `Used the emergency off-switch on ${name}.`, true, 'good', { situationId: x.id, modelId: model?.id });
      return { ok: true, title: name, text: 'The off-switch works. Systems go dark; the crisis ends — expensively.' };
    case 'taskforce': {
      x.severity = Math.max(0, x.severity - 20);
      x.stage = stageFor(x.severity);
      x.growthMult *= 0.5;
      x.response = 'taskforce';
      changeResource(s, 'tension', -5, 'International task force');
      for (const r of s.rivals) if (r.accordMember || r.trust >= 60) changeRivalTrust(s, r.id, 5, 'Joint task force');
      addLog(s, `Formed an international task force against ${name}.`, true, 'good', { situationId: x.id });
      return { ok: true, title: name, text: 'Partners pool experts and compute. The threat is pushed back.' };
    }
  }
}

/** Restricts a model: 30% of its adoption lost; any problem it causes grows at ×0.25 and eases by 5. */
export function restrictModel(s: GameState, model: AIModel, reason: string): void {
  if (model.status === 'restricted' || model.status === 'suspended') return;
  const cost = modelPullCost(model, 'restrict');
  removeModelContribution(s, model, 0.3, reason);
  model.status = 'restricted';
  changeMeter(s, cost.meter, -cost.amount, reason);
  const company = findCompany(s, model.companyId);
  if (company) changeCompanyRelation(s, company.id, -8, reason);
  const x = s.situations.find((sx) => sx.source.modelId === model.id && !sx.resolved);
  if (x && x.response !== 'suspended' && x.response !== 'restricted') {
    x.growthMult *= 0.25;
    x.severity = Math.max(0, x.severity - 5);
    x.stage = stageFor(x.severity);
    x.response = 'restricted';
    x.lastResponseTurn = s.turn;
    x.firstActionTurn = x.firstActionTurn ?? s.turn;
  }
}

/** Pulls a model from service: removes its adoption, pays the shock, leader & company react; its problem recedes. */
export function suspendModel(s: GameState, model: AIModel, reason: string): void {
  if (model.status === 'suspended') return;
  const cost = modelPullCost(model, 'suspend');
  removeModelContribution(s, model, 1, reason);
  model.status = 'suspended';
  changeMeter(s, cost.meter, -cost.amount, reason);
  const company = findCompany(s, model.companyId);
  if (company) changeCompanyRelation(s, company.id, -20, reason);
  const react = suspendReaction(s, model);
  changeMeter(s, 'confidence', react, react >= 0 ? 'Leader backs decisive action' : 'Leader dislikes the suspension');
  const x = s.situations.find((sx) => sx.source.modelId === model.id && !sx.resolved);
  if (x && x.response !== 'suspended') {
    x.severity = Math.max(0, x.severity - 25);
    x.stage = stageFor(x.severity);
    x.response = 'suspended';
    x.lastResponseTurn = s.turn;
    x.firstActionTurn = x.firstActionTurn ?? s.turn;
  }
}

// ───────────────────────────── Cards ─────────────────────────────

export const SITUATION_CARD = 'sys:situation';

function situationChoiceIds(s: GameState, x: Situation): ResponseId[] {
  const ids: ResponseId[] = ['monitor'];
  if (!x.causeKnown) {
    ids.push('investigate', 'contain');
  } else if (findModel(s, x.source.modelId)) {
    ids.push('restrict', 'suspend');
  } else {
    ids.push('contain');
  }
  if (visibleStage(x) >= 3 && getMods(s).killSwitch > 0) ids.push('shutdown');
  else if (taskforceEligible(s, x) && taskforcePartner(s)) ids.push('taskforce');
  else if (x.causeKnown && !ids.includes('contain')) ids.push('contain');
  return ids.slice(0, 4);
}

export function situationChoices(s: GameState, x: Situation): Choice[] {
  return situationChoiceIds(s, x).map((id) => {
    const { preview, uncertain } = responsePreview(s, x, id);
    const ch: Choice = {
      id,
      label: RESPONSE_INFO[id].label,
      hint: RESPONSE_INFO[id].description,
      preview,
      uncertain,
      disabled: responseBlock(s, x, id),
      tone: id === 'monitor' ? 'risky' : id === 'investigate' ? 'neutral' : 'safe',
      stamp: id === 'monitor' ? 'noted' : id === 'investigate' ? 'classified' : 'urgent',
    };
    const cost = responseCost(id);
    if (cost) ch.cost = cost;
    // Investigation can't be "blocked" by a pending response on the same quarter; monitor is always possible.
    if (id === 'monitor') ch.disabled = null;
    return ch;
  });
}

export function severityEstimate(s: GameState, x: Situation): { low: number; high: number; value: number } {
  const u = x.causeKnown ? 6 : Math.max(6, 16 - 3 * (s.programs.oversight ?? 0));
  // Until investigated, the estimate is off-center by a stable (per quarter) error.
  const err = x.causeKnown ? 0 : hashNoise(`${x.id}:${s.turn}`) * u * 0.7;
  const center = clamp(Math.round((x.severity + err) / 5) * 5, 0, 100);
  return { value: center, low: clamp(center - u, 0, 100), high: clamp(center + u, 0, 100) };
}

/** Sentences that only make sense while the cause is still a mystery. */
const UNKNOWN_CAUSE = /(cannot yet|can't yet|not yet (?:clear|known|say)|no one knows|nobody knows|unknown (?:cause|source|origin)|unclear (?:why|what|who|how)|is unclear|remains unclear)/i;

/** Player-facing description: the stage text, updated once the cause is known. */
export function situationText(s: GameState, x: Situation): string {
  const flavor = getSituationFlavor(x.type);
  const ctx = situationTemplateCtx(s, x);
  if (x.resolved && x.outcome !== 'catastrophe') return fillTemplate(s, flavor.resolvedText, ctx);
  const text = fillTemplate(s, flavor.stages[visibleStage(x)], ctx);
  if (!x.causeKnown) return text;
  const model = findModel(s, x.source.modelId);
  const company = findCompany(s, x.source.companyId ?? model?.companyId);
  const source = model ? `${model.name}${company ? ` (${company.name})` : ''}` : x.origin;
  const kept = (text.match(/[^.!?]+[.!?]+["”']?\s*/g) ?? [text]).filter((sentence) => !UNKNOWN_CAUSE.test(sentence)).join('').trim();
  return `Traced to ${source}. ${kept}`.trim();
}

export function situationCard(s: GameState, x: Situation, reason: 'detected' | 'stage'): Card {
  const ctx = situationTemplateCtx(s, x);
  const name = situationDisplayName(x);
  const model = findModel(s, x.source.modelId);
  const est = severityEstimate(s, x);
  const evidence: EvidenceLine[] = [
    { label: 'Stage', value: STAGE_LABELS[x.stage], confidence: x.causeKnown ? 'verified' : 'medium' },
    { label: 'Estimated severity', value: `${est.low}–${est.high}`, confidence: x.causeKnown ? 'high' : 'low' },
    {
      label: 'Suspected source',
      value: x.causeKnown ? (model ? `${model.name}${ctx.company ? ` (${ctx.company.name})` : ''}` : x.origin) : 'Unknown',
      confidence: x.causeKnown ? 'verified' : 'redacted',
    },
  ];
  const sectorKnown = x.source.sector && (x.causeKnown || x.stage >= 2);
  if (sectorKnown && x.source.sector) evidence.push({ label: 'Sector', value: SECTOR_INFO[x.source.sector].name, confidence: 'high' });
  if (escalationExpected(s, x)) evidence.push({ label: 'Projection', value: 'Escalation expected next quarter', confidence: 'medium' });
  x.notifiedStage = Math.max(x.notifiedStage ?? 0, x.stage);
  const urgency = x.stage >= 3 ? 'critical' : x.stage >= 2 ? 'priority' : 'priority';
  const title = reason === 'detected' ? `Threat detected: ${name}` : `${name} escalates: ${STAGE_LABELS[x.stage]}`;
  const body = situationText(s, x);
  return makeCard(s, {
    kind: 'situation',
    templateId: SITUATION_CARD,
    title,
    body,
    subtitle: `Threat · ${STAGE_LABELS[x.stage]}`,
    source: { type: x.type === 'foreign_spillover' || x.type === 'military_escalation' ? 'intelligence' : 'advisor', name: getAdvisor(x.type === 'military_escalation' ? 'intelligence' : 'scientist').role },
    urgency,
    evidence,
    choices: situationChoices(s, x),
    ctx: { situationId: x.id, ...(model && x.causeKnown ? { modelId: model.id } : {}), ...(sectorKnown && x.source.sector ? { sector: x.source.sector } : {}) },
    tags: x.type === 'model_escape' || x.type === 'deceptive_model' ? ['ai', 'crisis'] : ['crisis'],
  });
}

/** Re-evaluates a situation card's choices (situation may have changed mid-quarter). */
export function refreshSituationCard(s: GameState, card: Card): void {
  const x = s.situations.find((sx) => sx.id === card.ctx.situationId);
  if (!x) return;
  card.choices = situationChoices(s, x);
}

export function resolveSituationCard(s: GameState, card: Card, choiceId: string): ResponseOutcome {
  const x = s.situations.find((sx) => sx.id === card.ctx.situationId);
  if (!x) return { ok: true, title: card.title, text: 'The situation has already passed.' };
  if (x.resolved) return { ok: true, title: card.title, text: 'The situation is already over.' };
  const id = choiceId as ResponseId;
  if (!RESPONSE_ORDER.includes(id)) return { ok: false, error: 'Unknown response', title: card.title, text: '' };
  return applyResponse(s, x, id);
}


