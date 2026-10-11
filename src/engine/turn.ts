/**
 * Quarter flow (GDD §1): first-turn setup and End Quarter —
 * upkeep → systems tick → failures → advance → unlocks/tips → new cards → news → report.
 */
import { MAX_INBOX, distributeCards } from './cards';
import { beginCapture, endCapture, visibleChanges } from './changes';
import { checkFailure, finishGame } from './endings';
import { dueFollowUps, drawRandomEvents } from './events';
import { riskEstimate } from './fog';
import { dateLabel } from './labels';
import { resetTurnLog, turnLog } from './log';
import { queueTip } from './tips';
import { flagNum, getMods, pruneTempMods } from './modifiers';
import { rng } from './rng';
import { generateNews } from './news';
import { findModel, shownTurn } from './query';
import { readyToRelease, tickCompanies } from './systems/companies';
import { DEPLOY_CARD, deploymentCard, dueDeepEvaluations, releaseModel } from './systems/deployment';
import { applyBudget, tickEconomy } from './systems/economy';
import {
  DEMAND_CARD,
  INSIST_CARD,
  createDemand,
  demandCard,
  demandDue,
  electionCard,
  electionDue,
  lastChanceCard,
  scheduleNextDemand,
  tickConfidence,
  tickDemands,
} from './systems/government';
import { introCard } from './systems/intro';
import { quietCard } from './systems/quiet';
import { tickRisk, tickSafeguards } from './systems/risk';
import { SITUATION_CARD, situationCard, tickSituations } from './systems/situations';
import { thresholdCard, thresholdReached } from './systems/threshold';
import { newTickCtx, type TickCtx, type WorldCardRequest } from './systems/tick';
import { tickWorld } from './systems/world';
import { WORLD_CARD_PREFIX, isMandatoryWorldCard, worldCard } from './systems/worldCards';
import type { Card, GameState, MeterChange, MeterId, NewsItem, TipId, TurnReport } from './types';
import { clockFor, currentWarnings } from './views';

const METERS: MeterId[] = ['confidence', 'economy', 'stability', 'security'];

const addTip = queueTip;

function snapshotHistory(s: GameState): void {
  for (const id of METERS) s.meterHistory[id].push(Math.round(s.meters[id] * 10) / 10);
  s.riskHistory.push(riskEstimate(s).estimate);
}

function refreshCapacity(s: GameState): void {
  // Base 2 actions per quarter; Evaluation & Oversight adds +1 at L2 and +2 at L3 (max 4).
  s.capacityMax = Math.max(1, 2 + Math.round(getMods(s).capacity));
  s.capacity = s.capacityMax;
}

/** Turn-1 inbox: intro card + a gentle first deployment request. */
export function startFirstTurn(s: GameState): void {
  refreshCapacity(s);
  snapshotHistory(s);
  const cards: Card[] = [introCard(s)];
  const teacher =
    s.companies.find((c) => c.archetype === 'bigtech') ??
    [...s.companies].filter((c) => c.archetype !== 'opensource').sort((a, b) => b.safety - a.safety)[0] ??
    s.companies[0];
  if (teacher) {
    const m = releaseModel(s, teacher, { teaching: true });
    cards.push(deploymentCard(s, m, false));
    addTip(s, 'first_deployment');
  }
  addTip(s, 'end_turn');
  distributeCards(s, cards);
}

// ───────────────────────────── Card generation ─────────────────────────────

/** Drops stale queued cards (lapsed requests, resolved situations, old routine events). */
function pruneQueue(s: GameState): void {
  s.queue = s.queue.filter((c) => {
    const age = s.turn - c.createdTurn;
    if (c.templateId === DEPLOY_CARD) {
      const m = findModel(s, c.ctx.modelId);
      if (!m || (m.status !== 'pending' && m.status !== 'evaluating')) return false;
      if (age > 2) {
        m.status = 'internal';
        return false;
      }
      return true;
    }
    if (c.templateId === SITUATION_CARD) {
      const x = s.situations.find((sx) => sx.id === c.ctx.situationId);
      return !!x && !x.resolved && age <= 1;
    }
    if (c.templateId === DEMAND_CARD || c.templateId === INSIST_CARD) {
      const d = s.demands.find((x) => x.id === c.ctx.demandId);
      if (!d || d.status !== 'offered') return false;
      if (age > 1) {
        d.status = 'refused';
        return false;
      }
      return true;
    }
    if (c.templateId.startsWith(WORLD_CARD_PREFIX)) return age <= 2;
    if (c.templateId.startsWith('sys:')) return age <= 2;
    return c.urgency === 'routine' ? age <= 2 : age <= 3;
  });
}

const OPTIONAL_WORLD_ORDER: WorldCardRequest['kind'][] = ['cyberattack', 'espionage_found'];

function generateCards(s: GameState, tc: TickCtx): void {
  pruneQueue(s);
  const mandatory: Card[] = [];
  for (const m of dueDeepEvaluations(s)) mandatory.push(deploymentCard(s, m, true));
  const election = electionDue(s);
  if (election) mandatory.push(electionCard(s, election));
  if (s.meters.confidence <= 15 && !s.government.lastChanceUsed) mandatory.push(lastChanceCard(s));
  const seenSituations = new Set<string>();
  for (const req of tc.situationCards) {
    if (seenSituations.has(req.situationId)) continue;
    const x = s.situations.find((sx) => sx.id === req.situationId);
    if (!x || x.resolved) continue;
    seenSituations.add(x.id);
    s.queue = s.queue.filter((c) => !(c.templateId === SITUATION_CARD && c.ctx.situationId === x.id));
    mandatory.push(situationCard(s, x, req.reason));
  }
  for (const req of tc.world.filter(isMandatoryWorldCard)) {
    const card = worldCard(s, req);
    if (card) mandatory.push(card);
  }
  // Narrative: a due follow-up, else one random scripted event, always gets a reserved inbox slot.
  const scripted = dueFollowUps(s);
  if (scripted.length === 0) scripted.push(...drawRandomEvents(s, 1));
  const reserved = scripted.shift();
  mandatory.push(...scripted);
  if (demandDue(s)) {
    const d = createDemand(s);
    if (d) {
      mandatory.push(demandCard(s, d));
      addTip(s, 'first_demand');
    }
    scheduleNextDemand(s);
  }

  const optional: Card[] = [];
  let slots = MAX_INBOX - (reserved ? 1 : 0) - s.queue.length - mandatory.length;
  // At most one new model release per quarter; companies that miss a slot simply wait.
  if (slots > 0) {
    const ready = s.companies.filter((c) => readyToRelease(s, c)).sort((a, b) => b.capability - b.capAtLastModel - (a.capability - a.capAtLastModel));
    const company = ready[0];
    if (company) {
      const m = releaseModel(s, company);
      optional.push(deploymentCard(s, m, false));
      addTip(s, 'first_deployment');
      slots--;
    }
  }
  if (slots > 0) {
    const worldReqs = tc.world.filter((w) => !isMandatoryWorldCard(w));
    for (const kind of OPTIONAL_WORLD_ORDER) {
      const req = worldReqs.find((w) => w.kind === kind);
      if (!req) continue;
      const card = worldCard(s, req);
      if (card) {
        optional.push(card);
        slots--;
      }
      break;
    }
  }
  if (slots > 0 && rng(s).chance(0.05)) optional.push(...drawRandomEvents(s, 1));
  distributeCards(s, [...mandatory, ...optional], reserved);
  // GDD §1: every quarter opens with at least one briefing.
  if (s.inbox.length === 0) {
    const fallback = drawRandomEvents(s, 1, true);
    distributeCards(s, fallback.length ? fallback : [quietCard(s)]);
  }
}

// ───────────────────────────── End Quarter ─────────────────────────────

function aggregateReasons(buf: MeterChange[], key: MeterId): { reason: string; delta: number }[] {
  const agg = new Map<string, number>();
  for (const c of buf) if (c.key === key) agg.set(c.reason, (agg.get(c.reason) ?? 0) + c.delta);
  return [...agg.entries()]
    .map(([reason, delta]) => ({ reason, delta: Math.round(delta * 10) / 10 }))
    .filter((r) => Math.abs(r.delta) >= 0.1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function trackMaxima(s: GameState): void {
  s.stats.maxSafety = Math.max(s.stats.maxSafety ?? 0, s.programs.safety ?? 0);
  s.stats.maxWorkforce = Math.max(s.stats.maxWorkforce ?? 0, s.programs.workforce ?? 0);
  s.stats.maxDefense = Math.max(s.stats.maxDefense ?? 0, s.programs.defense ?? 0);
  s.stats.maxOversight = Math.max(s.stats.maxOversight ?? 0, s.programs.oversight ?? 0);
}

function sanitizeNews(s: GameState, items: NewsItem[]): NewsItem[] {
  return items.map((n) => {
    if (!n.situationId) return { ...n };
    const x = s.situations.find((sx) => sx.id === n.situationId);
    if (x?.detected) return { ...n };
    const { situationId: _hidden, ...rest } = n;
    return rest;
  });
}

export function endTurnImpl(s: GameState): TurnReport {
  const fromTurn = s.turn;
  const meterFrom = { ...s.meters };
  const budgetFrom = s.budget;
  const riskFrom = riskEstimate(s).estimate;
  const newsStart = s.news.length;
  const buf = beginCapture(s);
  const tc = newTickCtx();
  trackMaxima(s);

  const { income, upkeep } = applyBudget(s, tc);
  tickCompanies(s, tc);
  tickWorld(s, tc);
  tickSafeguards(s);
  tickEconomy(s, tc);
  tickSituations(s, tc);
  tickRisk(s);
  tickConfidence(s, tc);
  tickDemands(s);
  generateNews(s, tc, fromTurn);
  endCapture(s, buf);

  const highlights = [...turnLog(s).highlights];
  const failure = checkFailure(s);
  if (failure) finishGame(s, failure.id, failure.cause);

  if (!s.gameOver) {
    s.turn += 1;
    resetTurnLog(s);
    pruneTempMods(s);
    refreshCapacity(s);
    s.flags.recentAddresses = Math.max(0, flagNum(s, 'recentAddresses') - 0.5);
    snapshotHistory(s);
    unlockTabs(s);
    if (thresholdReached(s) || fromTurn >= s.maxTurns) {
      s.queue = [];
      s.inbox = [thresholdCard(s)];
    } else {
      generateCards(s, tc);
    }
    if (s.evidence.length > 0) addTip(s, 'evidence');
  }

  const vis = visibleChanges(buf);
  const meters = {} as TurnReport['meters'];
  for (const id of METERS) meters[id] = { from: Math.round(meterFrom[id]), to: Math.round(s.meters[id]), reasons: aggregateReasons(vis, id) };
  const riskTo = riskEstimate(s).estimate;
  const report: TurnReport = {
    fromTurn,
    toTurn: shownTurn(s),
    dateLabel: dateLabel(shownTurn(s)),
    meters,
    budget: { from: Math.round(budgetFrom * 10) / 10, to: Math.round(s.budget * 10) / 10, income, upkeep },
    risk: { from: riskFrom, to: riskTo, trend: riskTo - riskFrom > 1 ? 'up' : riskTo - riskFrom < -1 ? 'down' : 'flat', clock: clockFor(riskTo).clock },
    headlines: sanitizeNews(s, s.news.slice(newsStart)),
    highlights,
    warnings: [...new Set([...tc.warnings, ...currentWarnings(s)])],
    newCards: s.inbox.length,
    gameOver: s.gameOver,
  };
  s.lastReport = report;
  return report;
}

function unlockTabs(s: GameState): void {
  const unlock = (tab: GameState['unlockedTabs'][number], tip: TipId) => {
    if (!s.unlockedTabs.includes(tab)) {
      s.unlockedTabs.push(tab);
      addTip(s, tip);
    }
  };
  if (s.turn >= 2) {
    unlock('nation', 'nation');
    addTip(s, 'risk_clock');
    addTip(s, 'capacity');
  }
  if (s.turn >= 3) unlock('world', 'world');
  if (s.turn >= 4) unlock('threats', 'threats');
}

