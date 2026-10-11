/**
 * Scripted narrative events (GDD §11): eligibility, random entity binding, EventDef → Card conversion
 * (templating, auto previews, disabled reasons), probabilistic outcomes, Effect application,
 * EffectHelpers for custom effects, and scheduled follow-ups that carry their bindings.
 * Content functions are always called defensively so bad content can never crash a run.
 */
import { t, tr } from '../i18n';
import { eventNotes } from './advisors';
import { costBlock, makeCard, payCost } from './cards';
import {
  addEvidence,
  changeAdoptionTarget,
  changeCapability,
  changeCompanyRelation,
  changeMeter,
  changeResource,
  changeRisk,
  changeRivalTrust,
  confidenceScale,
  effectiveConfidence,
} from './changes';
import { getEvent, getEvents, getOutlets } from './content';
import { SOURCE_INFO } from './labels';
import { POLICIES, POLICY_ORDER } from './data/policies';
import { addLog, bumpStat, highlight } from './log';
import { getMods } from './modifiers';
import { previewEffect } from './preview';
import { currentEra, findCompany, findModel, findRival, leadingCompany, leadingRival } from './query';
import { rng } from './rng';
import { sourceOf } from './source';
import { removeModelContribution, resolveSituation, spawnSituation, stageFor } from './systems/situations';
import { fillTemplate, type TemplateCtx } from './template';
import type {
  AdvisorId,
  Card,
  CardContext,
  CardSource,
  Choice,
  Effect,
  EffectHelpers,
  EventChoiceDef,
  EventContext,
  EventDef,
  EventOutcomeDef,
  FollowUpDef,
  GameState,
  MeterId,
  PolicyId,
  SectorId,
  Stamp,
} from './types';
import { SECTORS, clamp } from './util';

// ───────────────────────────── Defensive content calls ─────────────────────────────

/** Content errors swallowed during play (inspected by tests/tools; never serialized). */
export const contentErrors: string[] = [];

function safeCall<T>(fn: () => T, fallback: T, where = 'content'): T {
  try {
    return fn();
  } catch (err) {
    if (contentErrors.length < 200) contentErrors.push(`${where}: ${err instanceof Error ? err.message : String(err)}`);
    return fallback;
  }
}

// ───────────────────────────── Context ─────────────────────────────

export function eventCtxFromCard(s: GameState, c: CardContext): EventContext {
  const ctx: EventContext = {};
  const model = findModel(s, c.modelId);
  const company = findCompany(s, c.companyId ?? model?.companyId);
  const rival = findRival(s, c.rivalId);
  const situation = c.situationId ? s.situations.find((x) => x.id === c.situationId) : undefined;
  const demand = c.demandId ? s.demands.find((d) => d.id === c.demandId) : undefined;
  if (company) ctx.company = company;
  if (model) ctx.model = model;
  if (rival) ctx.rival = rival;
  if (situation) ctx.situation = situation;
  if (demand) ctx.demand = demand;
  if (c.sector) ctx.sector = c.sector;
  return ctx;
}

export function cardCtxFromEvent(ctx: EventContext): CardContext {
  const c: CardContext = {};
  if (ctx.company) c.companyId = ctx.company.id;
  if (ctx.model) c.modelId = ctx.model.id;
  if (ctx.rival) c.rivalId = ctx.rival.id;
  if (ctx.situation) c.situationId = ctx.situation.id;
  if (ctx.demand) c.demandId = ctx.demand.id;
  if (ctx.sector) c.sector = ctx.sector;
  return c;
}

function tctx(ctx: EventContext): TemplateCtx {
  return { ...ctx };
}

// ───────────────────────────── Eligibility & binding ─────────────────────────────

function eligible(s: GameState, def: EventDef, relaxed = false): boolean {
  if (def.followUpOnly) return false;
  if (def.minTurn !== undefined && s.turn < def.minTurn) return false;
  if (def.maxTurn !== undefined && s.turn > def.maxTurn) return false;
  if (def.eras && def.eras.length && !def.eras.includes(currentEra(s))) return false;
  if (def.countries && def.countries.length && !def.countries.includes(s.countryId)) return false;
  if (def.stances && def.stances.length && !def.stances.includes(s.government.stance)) return false;
  const last = s.firedEvents[def.id];
  if (last !== undefined) {
    if (def.once !== false) return false;
    if (!relaxed && s.turn - last < (def.cooldown ?? 4)) return false;
  }
  return true;
}

/** Binds random matching entities; null when a requested binding has no match. */
function bindEvent(s: GameState, def: EventDef): EventContext | null {
  const r = rng(s);
  const ctx: EventContext = {};
  const b = def.bind;
  if (b) {
    if (b.company) {
      const f = b.company;
      const list = s.companies.filter((c) => safeCall(() => f(c, s), false));
      const pick = r.pick(list);
      if (!pick) return null;
      ctx.company = pick;
    }
    if (b.rival) {
      const f = b.rival;
      const pick = r.pick(s.rivals.filter((x) => safeCall(() => f(x, s), false)));
      if (!pick) return null;
      ctx.rival = pick;
    }
    if (b.model) {
      const f = b.model;
      const list = s.models.filter((m) => (!ctx.company || m.companyId === ctx.company.id) && safeCall(() => f(m, s), false));
      const pick = r.pick(list);
      if (!pick) return null;
      ctx.model = pick;
      if (!ctx.company) {
        const c = findCompany(s, pick.companyId);
        if (c) ctx.company = c;
      }
    }
    if (b.situation) {
      const f = b.situation;
      const pick = r.pick(s.situations.filter((x) => safeCall(() => f(x, s), false)));
      if (!pick) return null;
      ctx.situation = pick;
    }
    if (b.sector && b.sector.length) ctx.sector = r.pick(b.sector);
  }
  if (def.requires && !safeCall(() => !!def.requires?.(s, ctx), false)) return null;
  return ctx;
}

function eventWeight(s: GameState, def: EventDef, ctx: EventContext): number {
  const w = def.weight;
  if (typeof w === 'number') return Math.max(0, w);
  if (typeof w === 'function') return Math.max(0, safeCall(() => w(s, ctx), 0));
  return 1;
}

// ───────────────────────────── Card building ─────────────────────────────

function defaultSource(s: GameState, def: EventDef, ctx: EventContext): CardSource {
  const name = def.sourceName ? fillTemplate(s, def.sourceName, tctx(ctx)) : undefined;
  switch (def.source) {
    case 'company':
      return { type: 'company', name: name ?? ctx.company?.name ?? t('Industry'), id: ctx.company?.id, color: ctx.company?.color };
    case 'foreign':
      return { type: 'foreign', name: name ?? ctx.rival?.name ?? t('Foreign Ministry'), id: ctx.rival?.id, color: ctx.rival?.color };
    case 'government':
      return { type: 'government', name: name ?? t('Office of the {leaderTitle}', { leaderTitle: s.government.leaderTitle }) };
    case 'intelligence':
      return { type: 'intelligence', name: name ?? t('Intelligence Directorate') };
    case 'public':
      return { type: 'public', name: name ?? t('Public') };
    case 'ai':
      return { type: 'ai', name: name ?? t('Unknown system') };
    case 'advisor':
      return { type: 'advisor', name: name ?? t('Advisor') };
    case 'media':
      return { type: 'media', name: name ?? getOutlets()[0] ?? t('The Press') };
    default:
      return { type: 'advisor', name: name ?? t('Briefing') };
  }
}

function outcomeChances(s: GameState, outcomes: EventOutcomeDef[], ctx: EventContext): number[] {
  const raw = outcomes.map((o) => {
    const c = typeof o.chance === 'function' ? safeCall(() => (o.chance as (s: GameState, c: EventContext) => number)(s, ctx), 0) : o.chance;
    return Number.isFinite(c) ? Math.max(0, c) : 0;
  });
  const total = raw.reduce((a, b) => a + b, 0);
  return total > 0 ? raw.map((c) => c / total) : raw.map(() => 1 / Math.max(1, raw.length));
}

function choiceDisabled(s: GameState, ch: EventChoiceDef, ctx: EventContext): string | null {
  if (ch.requires) {
    const res = safeCall<boolean | string>(() => ch.requires?.(s, ctx) ?? true, false);
    // Content returns English reasons from functions (not reachable by in-place localization).
    if (typeof res === 'string') return tr(res) || t('Not available');
    if (!res) return t('Not available');
  }
  return costBlock(s, ch.cost);
}

function buildChoice(s: GameState, ch: EventChoiceDef, ctx: EventContext): Choice {
  const tc = tctx(ctx);
  const { preview, uncertain } = previewEffect(ch.effects, tc, confidenceScale(s));
  const out: Choice = {
    id: ch.id,
    label: fillTemplate(s, ch.label, tc),
    preview,
    uncertain: uncertain || !!ch.outcomes?.length || !!ch.followUp,
    disabled: choiceDisabled(s, ch, ctx),
  };
  if (ch.hint) out.hint = fillTemplate(s, ch.hint, tc);
  if (ch.cost) {
    out.cost = { ...ch.cost };
    // Show the confidence the player will actually lose (volatility included).
    if (ch.cost.confidence) out.cost.confidence = effectiveConfidence(s, ch.cost.confidence);
  }
  if (ch.showChance && ch.outcomes?.length) out.chance = outcomeChances(s, ch.outcomes, ctx)[0];
  if (ch.stamp) out.stamp = ch.stamp;
  if (ch.tone) out.tone = ch.tone;
  return out;
}

export function buildEventCard(s: GameState, def: EventDef, ctx: EventContext): Card {
  const tc = tctx(ctx);
  const urgency = def.urgency ?? 'routine';
  const card = makeCard(s, {
    kind: 'event',
    templateId: def.id,
    title: fillTemplate(s, def.title, tc),
    body: fillTemplate(s, def.text, tc),
    source: defaultSource(s, def, ctx),
    urgency,
    choices: def.choices.map((ch) => buildChoice(s, ch, ctx)),
    ctx: cardCtxFromEvent(ctx),
  });
  if (def.tags?.length) card.tags = [...def.tags];
  const theme = def.tags?.map(tagLabel).find((x) => x !== undefined);
  const source = SOURCE_INFO[def.source]?.label ?? t('Briefing');
  card.subtitle = theme ? `${source} · ${theme}` : source;
  if (def.evidence?.length) {
    card.evidence = def.evidence.map((e) => ({ label: fillTemplate(s, e.label, tc), value: fillTemplate(s, e.value, tc), confidence: e.confidence }));
  }
  const advice = def.advice ? (Object.keys(def.advice) as AdvisorId[]).filter((a) => def.advice?.[a]) : [];
  const notes = advice.length
    ? advice.map((a) => ({ advisor: a, text: fillTemplate(s, def.advice?.[a], tc) }))
    : eventNotes(s, def.tags, ctx);
  if (notes.length) card.advisors = notes;
  s.firedEvents[def.id] = s.turn;
  return card;
}

export function refreshEventCard(s: GameState, card: Card): void {
  const def = getEvent(card.templateId);
  if (!def) return;
  const ctx = eventCtxFromCard(s, card.ctx);
  for (const ch of card.choices) {
    const d = def.choices.find((x) => x.id === ch.id);
    if (!d) continue;
    ch.disabled = choiceDisabled(s, d, ctx);
    if (d.showChance && d.outcomes?.length) ch.chance = outcomeChances(s, d.outcomes, ctx)[0];
  }
}

/** Theme shown in an event card's subtitle, for the tags that have one. */
function tagLabel(tag: string): string | undefined {
  switch (tag) {
    case 'labs':
      return t('Labs');
    case 'ai':
      return t('AI Systems');
    case 'society':
      return t('Society');
    case 'economy':
      return t('Economy');
    case 'politics':
      return t('Politics');
    case 'world':
      return t('World');
    case 'military':
      return t('Security');
    case 'crisis':
      return t('Crisis');
    default:
      return undefined;
  }
}

// ───────────────────────────── Selection ─────────────────────────────

/**
 * Draws up to `count` eligible random scripted events (weighted, without replacement).
 * `relaxed` ignores cooldowns of repeatable events (used so a quarter never opens empty).
 */
export function drawRandomEvents(s: GameState, count: number, relaxed = false): Card[] {
  if (count <= 0) return [];
  const r = rng(s);
  const candidates: { def: EventDef; ctx: EventContext; w: number }[] = [];
  for (const def of getEvents()) {
    if (!eligible(s, def, relaxed)) continue;
    const ctx = bindEvent(s, def);
    if (!ctx) continue;
    const w = eventWeight(s, def, ctx);
    if (w > 0) candidates.push({ def, ctx, w });
  }
  const cards: Card[] = [];
  for (let i = 0; i < count && candidates.length; i++) {
    const pick = r.weightedPick(candidates, (c) => c.w);
    if (!pick) break;
    candidates.splice(candidates.indexOf(pick), 1);
    cards.push(buildEventCard(s, pick.def, pick.ctx));
  }
  return cards;
}

/** Scheduled follow-ups that are due this quarter. */
export function dueFollowUps(s: GameState): Card[] {
  const due = s.scheduled.filter((x) => x.turn <= s.turn);
  s.scheduled = s.scheduled.filter((x) => x.turn > s.turn);
  const cards: Card[] = [];
  for (const sch of due) {
    const def = getEvent(sch.eventId);
    if (!def) continue;
    const ctx = eventCtxFromCard(s, sch.ctx);
    cards.push(buildEventCard(s, def, ctx));
  }
  return cards;
}

export function scheduleFollowUps(s: GameState, followUp: FollowUpDef | FollowUpDef[] | undefined, ctx: EventContext): void {
  if (!followUp) return;
  const r = rng(s);
  for (const f of Array.isArray(followUp) ? followUp : [followUp]) {
    if (!f || typeof f.event !== 'string') continue;
    if (f.chance !== undefined && !r.chance(f.chance)) continue;
    const delay = Array.isArray(f.delay) ? r.int(Math.min(f.delay[0], f.delay[1]), Math.max(f.delay[0], f.delay[1])) : f.delay;
    s.scheduled.push({ eventId: f.event, turn: s.turn + Math.max(1, Math.round(delay || 1)), ctx: cardCtxFromEvent(ctx) });
  }
}

// ───────────────────────────── Effects ─────────────────────────────

function enactPolicyFree(s: GameState, id: PolicyId, reason: string): void {
  if (!(POLICY_ORDER as string[]).includes(id) || s.policies.includes(id)) return;
  s.policies.push(id);
  if (id === 'open_weights_ban') for (const c of s.companies) if (c.archetype === 'opensource') changeCompanyRelation(s, c.id, -20, t('Open-weights ban'));
  const on = POLICIES[id].onEnact;
  if (on) applyEffect(s, on, {}, reason);
  highlight(s, t('New law: {policy}', { policy: POLICIES[id].name }), 'neutral', 'policy');
}

export function applyEffect(s: GameState, e: Effect | undefined, ctx: EventContext, reason: string): void {
  if (!e) return;
  const mods = getMods(s);
  if (e.meters) for (const k of Object.keys(e.meters) as MeterId[]) changeMeter(s, k, e.meters[k] ?? 0, reason);
  if (e.budget) changeResource(s, 'budget', e.budget, reason);
  if (e.income) changeResource(s, 'income', e.income, reason);
  if (e.capacity) changeResource(s, 'capacity', e.capacity, reason);
  if (e.evidence) {
    if (e.evidence > 0) for (let i = 0; i < e.evidence; i++) addEvidence(s, reason, { companyId: ctx.company?.id, rivalId: ctx.rival?.id }, reason);
  }
  if (e.risk) changeRisk(s, e.risk, reason, 'events');
  if (e.safeguards) changeResource(s, 'safeguards', e.safeguards, reason);
  if (e.capability) {
    const c = ctx.company ?? leadingCompany(s);
    if (c) changeCapability(s, { companyId: c.id }, e.capability, reason);
  }
  if (e.adoption) for (const sec of Object.keys(e.adoption) as SectorId[]) if (SECTORS.includes(sec)) changeAdoptionTarget(s, sec, e.adoption[sec] ?? 0, reason);
  if (e.displacement) changeResource(s, 'displacement', e.displacement, reason);
  if (e.tension) changeResource(s, 'tension', e.tension, reason);
  if (e.accord) changeResource(s, 'accord', e.accord > 0 ? e.accord * (1 + mods.accordGain) : e.accord, reason);
  if (e.company) {
    const c = ctx.company ?? leadingCompany(s);
    if (c) {
      const ce = e.company;
      if (ce.relation) changeCompanyRelation(s, c.id, ce.relation, reason);
      if (ce.safety) c.safety = clamp(c.safety + ce.safety, 0, 100);
      if (ce.transparency) c.transparency = clamp(c.transparency + ce.transparency, 0, 100);
      if (ce.ambition) c.ambition = clamp(c.ambition + ce.ambition, 0, 100);
      if (ce.capability) changeCapability(s, { companyId: c.id }, ce.capability, reason);
      if (ce.intel) {
        c.intel = clamp(c.intel + ce.intel, 0, 1);
        if (ce.intel > 0) c.lastInvestigatedTurn = c.lastInvestigatedTurn ?? s.turn;
      }
    }
  }
  if (e.rival) {
    const rv = ctx.rival ?? leadingRival(s);
    if (rv) {
      const re = e.rival;
      if (re.trust) changeRivalTrust(s, rv.id, re.trust, reason);
      if (re.capability) changeCapability(s, { rivalId: rv.id }, re.capability, reason);
      if (re.safeguards) rv.safeguards = clamp(rv.safeguards + re.safeguards, 0, 10);
      if (re.aggression) rv.aggression = clamp(rv.aggression + re.aggression, 0, 1);
      if (re.intel) rv.intel = clamp(rv.intel + re.intel, 0, 1);
    }
  }
  if (e.allRivals) {
    for (const rv of s.rivals) {
      if (e.allRivals.trust) changeRivalTrust(s, rv.id, e.allRivals.trust, reason);
      if (e.allRivals.capability) changeCapability(s, { rivalId: rv.id }, e.allRivals.capability, reason);
      if (e.allRivals.aggression) rv.aggression = clamp(rv.aggression + e.allRivals.aggression, 0, 1);
    }
  }
  if (e.situation) applySituationEffect(s, e.situation, ctx);
  if (e.model?.status && ctx.model) {
    const m = ctx.model;
    const st = e.model.status;
    if (st === 'suspended' || st === 'rejected' || st === 'internal') removeModelContribution(s, m, 1, reason);
    else if (st === 'restricted') removeModelContribution(s, m, 0.3, reason);
    m.status = st;
  }
  if (e.policy?.enact) enactPolicyFree(s, e.policy.enact, reason);
  if (e.policy?.repeal) s.policies = s.policies.filter((p) => p !== e.policy?.repeal);
  if (e.flags) for (const k of Object.keys(e.flags)) s.flags[k] = e.flags[k];
  if (e.custom) {
    const custom = e.custom;
    safeCall(() => custom(s, ctx, makeHelpers(s, ctx)), undefined);
  }
}

function applySituationEffect(s: GameState, se: NonNullable<Effect['situation']>, ctx: EventContext): void {
  if (se.spawn) {
    spawnSituation(s, se.spawn, {
      severity: se.severity,
      detected: se.detected,
      companyId: ctx.company?.id,
      modelId: ctx.model?.id,
      rivalId: ctx.rival?.id,
      sector: ctx.sector,
    });
    return;
  }
  const x = ctx.situation;
  if (!x || x.resolved) return;
  if (se.severity) {
    x.severity = clamp(x.severity + se.severity, 0, 99);
    x.stage = stageFor(x.severity);
  }
  if (se.growth) x.growthMult = Math.max(0.1, x.growthMult + se.growth);
  if (se.detected && !x.detected) {
    x.detected = true;
    x.detectedTurn = s.turn;
    x.notifiedStage = x.stage;
    x.signalsShown += 1;
    x.signalTurns.push(s.turn);
    if (!s.unlockedTabs.includes('threats')) s.unlockedTabs.push('threats');
  }
  if (se.resolve || (se.severity && x.severity <= 0)) resolveSituation(s, x, 'contained');
}

export function makeHelpers(s: GameState, ctx: EventContext): EffectHelpers {
  return {
    rand: () => rng(s).float(),
    // Strings passed by content functions are English: translate them at the sink.
    meter: (id, delta, reason) => {
      changeMeter(s, id, delta, tr(reason));
    },
    risk: (delta, reason) => {
      changeRisk(s, delta, reason, 'events');
    },
    spawnSituation: (type, opts) =>
      spawnSituation(s, type, {
        severity: opts?.severity,
        companyId: opts?.companyId,
        modelId: opts?.modelId,
        rivalId: opts?.rivalId,
        sector: opts?.sector,
        detected: opts?.detected,
      }),
    schedule: (eventId, delay, c) => {
      s.scheduled.push({ eventId, turn: s.turn + Math.max(1, Math.round(delay)), ctx: cardCtxFromEvent(c ?? ctx) });
    },
    log: (text, key) => {
      addLog(s, tr(text), !!key, undefined, undefined, { en: sourceOf(text) });
    },
    news: (text) => {
      s.news.push({ turn: s.turn, outlet: rng(s).pick(getOutlets()) ?? t('Global Wire'), text: tr(text), tone: 'neutral' });
    },
    text: (template) => fillTemplate(s, template, tctx(ctx)),
  };
}

// ───────────────────────────── Resolution ─────────────────────────────

export interface EventResolution {
  ok: boolean;
  error?: string;
  text: string;
  success?: boolean;
  stamp?: Stamp;
}

export function resolveEventCard(s: GameState, card: Card, choiceId: string): EventResolution {
  const def = getEvent(card.templateId);
  if (!def) return { ok: true, text: t('Noted.') };
  const ch = def.choices.find((c) => c.id === choiceId);
  if (!ch) return { ok: false, error: t('Unknown choice'), text: '' };
  const ctx = eventCtxFromCard(s, card.ctx);
  const blocked = choiceDisabled(s, ch, ctx);
  if (blocked) return { ok: false, error: blocked, text: '' };
  const tc = tctx(ctx);
  const reason = card.title.length > 48 ? `${card.title.slice(0, 45)}…` : card.title;
  // Odds are fixed before anything changes, so the roll matches the % shown on the card.
  const chances = ch.outcomes?.length ? outcomeChances(s, ch.outcomes, ctx) : [];
  payCost(s, ch.cost, reason, { companyId: ctx.company?.id, rivalId: ctx.rival?.id });
  applyEffect(s, ch.effects, ctx, reason);
  let text = ch.resultText ? fillTemplate(s, ch.resultText, tc) : '';
  let success: boolean | undefined;
  if (ch.outcomes?.length) {
    const r = rng(s).float();
    let acc = 0;
    let picked = ch.outcomes[ch.outcomes.length - 1];
    for (let i = 0; i < ch.outcomes.length; i++) {
      acc += chances[i];
      if (r < acc) {
        picked = ch.outcomes[i];
        break;
      }
    }
    applyEffect(s, picked.effects, ctx, reason);
    text = fillTemplate(s, picked.text, tc) || text;
    success = picked.success;
    scheduleFollowUps(s, picked.followUp, ctx);
  }
  scheduleFollowUps(s, ch.followUp, ctx);
  if (ch.log) {
    const tone = ch.tone === 'safe' ? 'good' : ch.tone === 'risky' || ch.tone === 'aggressive' ? 'mixed' : 'neutral';
    addLog(s, fillTemplate(s, ch.log, tc), true, success === false ? 'bad' : tone, card.ctx, { en: sourceOf(ch.log) });
  }
  bumpStat(s, 'eventsResolved');
  const fallback = t('{choice}. Your order goes out.', { choice: fillTemplate(s, ch.label, tc).replace(/[.!]$/, '') });
  return { ok: true, text: text || fallback, success, stamp: ch.stamp };
}
