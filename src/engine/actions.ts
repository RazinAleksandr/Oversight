/**
 * Department actions (GDD §7, §10): each action defines its cost, targets/options, disabled reasons,
 * preview and effect. `situation_response` takes targetId = situation id and optionId = response id;
 * `enact_policy` / `repeal_policy` take targetId = PolicyId.
 */
import { costBlock, payCost, pushInboxNow } from './cards';
import {
  confidenceScale,
  changeCapability,
  changeCompanyRelation,
  changeMeter,
  changeResource,
  changeRisk,
  changeRivalTrust,
} from './changes';
import { getFlawFlavor } from './content';
import { POLICIES, POLICY_ORDER } from './data/policies';
import { RESPONSE_INFO, type ResponseId } from './data/situations';
import { applyEffect } from './events';
import { confidenceFromIntel, rivalCapEstimate, traitLabel } from './fog';
import { dateLabel } from './labels';
import { addLog, bumpStat, highlight, trigger } from './log';
import { flagNum, getMods } from './modifiers';
import { pv, pvCap, pvConf, pvConfExact, pvDir, pvUnits } from './preview';
import { findCompany, findModel, findRival, leadingCompany, LIVE_STATUSES, publicSituations } from './query';
import { rng } from './rng';
import { discoverViolation } from './systems/companies';
import { detectionChance, perceivedDetectionChance } from './systems/deployment';
import { applyResponse, detect, modelPullCost, restrictModel, RESPONSE_ORDER, responseBlock, suspendModel, suspendReaction } from './systems/situations';
import { worldCard } from './systems/worldCards';
import { situationDisplayName } from './template';
import type { ActionId, ActionTarget, ActionView, Cost, EffectPreview, GameState, NewsItem, PolicyId, Stance, TabId } from './types';
import { clamp, lowerPhrase, possessive, round1 } from './util';

export interface ActionOutcome {
  ok: boolean;
  error?: string;
  title: string;
  text: string;
  success?: boolean;
  revealed?: string[];
  newCards?: number;
}

interface ActionDef {
  id: ActionId;
  category: ActionView['category'];
  tab: TabId;
  name: string;
  description: string;
  icon: string;
  cost: (s: GameState, targetId?: string) => Cost;
  targets?: (s: GameState) => ActionTarget[];
  options?: (s: GameState) => NonNullable<ActionView['options']>;
  /** Validation beyond cost; null = OK. */
  block?: (s: GameState, targetId?: string, optionId?: string) => string | null;
  preview: (s: GameState, targetId?: string) => EffectPreview[];
  perform: (s: GameState, targetId?: string, optionId?: string) => ActionOutcome;
  /** Costs are paid inside `perform` (situation responses). */
  selfPaid?: boolean;
}

const CAP1: Cost = { capacity: 1 };

// ───────────────────────────── Policy cost ─────────────────────────────

/** Strict check (rejects prototype keys like "constructor"). */
export function isPolicyId(id: unknown): id is PolicyId {
  return typeof id === 'string' && (POLICY_ORDER as string[]).includes(id);
}

/** Confidence cost of enacting a policy now (negative = the leader rewards it). */
export function policyCost(s: GameState, id: PolicyId): number {
  const support = POLICIES[id].support[s.government.stance] ?? 0;
  return scalePolitical(s, 4 - 3 * support);
}

export function repealCost(s: GameState, id: PolicyId): number {
  const support = POLICIES[id].support[s.government.stance] ?? 0;
  return scalePolitical(s, Math.max(-1, (4 + 3 * support) / 2));
}

/**
 * Positive political costs are scaled by country traits (Hanzhou: none; Commonwealth: −40%); gains are not.
 * The result is what the player actually loses (confidence volatility included) and is applied raw.
 */
function scalePolitical(s: GameState, raw: number): number {
  const base = raw <= 0 ? Math.max(-2, raw) : raw * Math.max(0, 1 + getMods(s).policyCostMult);
  return Math.round(base * confidenceScale(s));
}

function stanceConf(s: GameState, table: Partial<Record<Stance, number>>): number {
  return table[s.government.stance] ?? 0;
}

function enforcementConfidence(s: GameState): number {
  const v = stanceConf(s, { cautious: 3, populist: 3, accelerationist: -2, hawk: 0 });
  return s.countryId === 'hanzhou' ? Math.max(0, v) : v;
}

// ───────────────────────────── Target helpers ─────────────────────────────

function companyTargets(s: GameState, filter?: (id: string) => string | null): ActionTarget[] {
  return s.companies.map((c) => ({ id: c.id, label: c.name, sublabel: `Relation ${Math.round(c.relation)}`, disabled: filter ? filter(c.id) : null }));
}

function rivalTargets(s: GameState, filter?: (id: string) => string | null): ActionTarget[] {
  return s.rivals.map((r) => ({ id: r.id, label: r.name, sublabel: `Trust ${Math.round(r.trust)}`, disabled: filter ? filter(r.id) : null }));
}

function needCompany(s: GameState, id?: string): string | null {
  return findCompany(s, id) ? null : 'Choose a company';
}

function needRival(s: GameState, id?: string): string | null {
  return findRival(s, id) ? null : 'Choose a country';
}

function auditable(s: GameState, id: string): string | null {
  const m = findModel(s, id);
  if (!m) return 'Choose a model';
  if (!LIVE_STATUSES.has(m.status) || (m.status === 'rogue_deployed' && !s.flags[`rogueKnown:${m.id}`])) return 'Not deployed';
  if (m.flawKnown) return 'Flaw already confirmed';
  if (m.audited) return 'Already audited';
  return null;
}

// ───────────────────────────── Definitions ─────────────────────────────

const ACTIONS: ActionDef[] = [
  {
    id: 'investigate_company',
    category: 'labs',
    tab: 'labs',
    name: 'Investigate company',
    description: 'Send inspectors in. Reveals true traits and capability; may uncover hidden violations (Evidence).',
    icon: 'investigate',
    cost: () => CAP1,
    targets: (s) => companyTargets(s),
    block: needCompany,
    preview: (s, t) => [pv('company', -3, findCompany(s, t)?.name)],
    perform: (s, t) => {
      const c = findCompany(s, t);
      if (!c) return { ok: false, error: 'Choose a company', title: '', text: '' };
      const r = rng(s);
      c.intel = 1;
      c.lastInvestigatedTurn = s.turn;
      c.knownTraits = { safety: true, transparency: true, ambition: true };
      changeCompanyRelation(s, c.id, -3, 'Investigation');
      bumpStat(s, 'investigations');
      const revealed = [
        `Safety culture: ${Math.round(c.safety)} (${traitLabel(c.safety)})`,
        `Transparency: ${Math.round(c.transparency)} (${traitLabel(c.transparency)})`,
        `Ambition: ${Math.round(c.ambition)} (${traitLabel(c.ambition)})`,
        `True capability: ${round1(c.capability)} (reported ${round1(c.reportedCapability)})`,
      ];
      let found = 0;
      for (const v of c.violations) {
        if (!v.discovered && r.chance(0.7)) {
          discoverViolation(s, c, v, 'investigation');
          revealed.push(`Violation: ${v.description}`);
          found++;
        }
      }
      for (const x of s.situations) {
        if (!x.resolved && !x.detected && x.source.companyId === c.id && !x.source.modelId && r.chance(0.7)) {
          x.detected = true;
          x.detectedTurn = s.turn;
          x.causeKnown = true;
          x.notifiedStage = x.stage;
          x.signalsShown += 1;
          x.firstActionTurn = x.firstActionTurn ?? s.turn;
          if (!s.unlockedTabs.includes('threats')) s.unlockedTabs.push('threats');
          revealed.push(`Concealed incident uncovered: ${situationDisplayName(x)}`);
        }
      }
      addLog(s, `Investigated ${c.name}${found ? ` — found ${found} violation${found > 1 ? 's' : ''}` : ''}.`, found > 0, found ? 'good' : 'neutral', { companyId: c.id });
      return { ok: true, title: `Investigation: ${c.name}`, text: found ? `Inspectors found ${found} hidden violation${found > 1 ? 's' : ''}.` : 'Inspectors found no hidden violations.', revealed };
    },
  },
  {
    id: 'audit_model',
    category: 'labs',
    tab: 'labs',
    name: 'Audit deployed model',
    description: 'A focused red-team audit of a model already in use. Much better odds of finding hidden flaws.',
    icon: 'audit',
    cost: () => CAP1,
    targets: (s) =>
      s.models
        .filter((m) => LIVE_STATUSES.has(m.status) && (m.status !== 'rogue_deployed' || !!s.flags[`rogueKnown:${m.id}`]))
        .map((m) => ({ id: m.id, label: m.name, sublabel: findCompany(s, m.companyId)?.name, disabled: auditable(s, m.id) })),
    block: (s, t) => auditable(s, t ?? ''),
    preview: () => [],
    perform: (s, t) => {
      const m = findModel(s, t);
      if (!m) return { ok: false, error: 'Choose a model', title: '', text: '' };
      bumpStat(s, 'audits');
      const d = Math.min(0.9, detectionChance(s, m, 0.3));
      const shownD = Math.min(0.9, perceivedDetectionChance(s, m, 0.3));
      const x = s.situations.find((sx) => sx.source.modelId === m.id && !sx.resolved);
      if (x) x.firstActionTurn = x.firstActionTurn ?? s.turn;
      if (m.flaw && rng(s).chance(d)) {
        m.flawKnown = true;
        m.evalDetected = true;
        m.suspected = false;
        const revealed = [`Flaw confirmed: ${getFlawFlavor(m.flaw).name}`];
        if (x) {
          if (!x.detected) {
            x.detected = true;
            x.detectedTurn = s.turn;
            x.notifiedStage = x.stage;
            x.signalsShown += 1;
            if (!s.unlockedTabs.includes('threats')) s.unlockedTabs.push('threats');
          }
          x.causeKnown = true;
          revealed.push(`Linked threat: ${situationDisplayName(x)} (${['Latent', 'Signals', 'Incident', 'Crisis', 'Catastrophe'][x.stage]})`);
        }
        addLog(s, `Audit of ${m.name} confirmed a hidden flaw.`, true, 'good', { modelId: m.id });
        return { ok: true, success: true, title: `Audit: ${m.name}`, text: `The audit found a real problem: ${getFlawFlavor(m.flaw).description}`, revealed };
      }
      m.audited = true;
      m.suspected = false;
      return { ok: true, success: true, title: `Audit: ${m.name}`, text: `No flaws found (audit confidence ${Math.round(shownD * 100)}%).`, revealed: [`Estimated detection power of this audit: ${Math.round(shownD * 100)}%`] };
    },
  },
  {
    id: 'follow_signal',
    category: 'threats',
    tab: 'threats',
    name: 'Follow a warning sign',
    description: 'Chase a strange report from the last three quarters. If something real is behind it, you may catch it early.',
    icon: 'news',
    cost: () => CAP1,
    targets: (s) =>
      recentSignals(s).map((n) => ({ id: n.id as string, label: n.text, sublabel: `${dateLabel(n.turn)} · ${n.outlet}`, disabled: followBlock(s, n.id) })),
    block: (s, t) => followBlock(s, t),
    preview: () => [],
    perform: (s, t) => {
      const n = s.news.find((x) => x.id === t);
      if (!n) return { ok: false, error: 'Choose a warning sign', title: '', text: '' };
      s.flags[`followed:${n.id}`] = s.turn;
      bumpStat(s, 'signalsFollowed');
      const x = s.situations.find((sx) => sx.id === n.situationId && !sx.resolved);
      if (!x) return { ok: true, success: false, title: 'A false lead', text: 'Your analysts run it down. Whatever caused it, there is nothing there now — a false lead.' };
      x.firstActionTurn = x.firstActionTurn ?? s.turn;
      const p = clamp(0.25 + getMods(s).earlyWarning + 0.35, 0, 0.95);
      if (x.detected || rng(s).chance(p)) {
        detect(s, x, null);
        return { ok: true, success: true, title: situationDisplayName(x), text: `The trail leads somewhere real: ${situationDisplayName(x)}. It is now on the Threats board.` };
      }
      return { ok: true, success: false, title: 'The trail goes cold', text: 'Your analysts find nothing conclusive — for now. If it is real, it will surface again.' };
    },
  },
  {
    id: 'revoke_model',
    category: 'labs',
    tab: 'labs',
    name: 'Restrict or suspend a model',
    description: 'Limit or pull a deployed model directly — with or without a detected threat. Costs scale with how much the economy uses it.',
    icon: 'respond',
    cost: () => ({}),
    targets: (s) =>
      s.models
        .filter((m) => revocable(s, m.id) === null || m.status === 'restricted')
        .map((m) => ({ id: m.id, label: m.name, sublabel: `${findCompany(s, m.companyId)?.name ?? ''}${m.flawKnown && m.flaw ? ' · flaw confirmed' : ''}`, disabled: revocable(s, m.id) })),
    options: () => [
      { id: 'restrict', label: 'Restrict', description: 'Tight limits: 30% of its adoption lost; any problem it causes slows sharply.', preview: [pv('economy', -2), pv('company', -8)] },
      { id: 'suspend', label: 'Suspend', description: 'Pull it from service entirely. Its problems recede; dependent users take the hit.', preview: [pv('economy', -5), pv('company', -20)] },
    ],
    block: (s, t, o) => {
      const base = revocable(s, t ?? '');
      if (o !== 'restrict' && o !== 'suspend') return base ?? 'Choose restrict or suspend';
      const m = findModel(s, t);
      if (o === 'restrict' && m?.status === 'restricted') return 'Already restricted';
      if (o === 'suspend' && m?.status === 'restricted') return null;
      return base;
    },
    preview: (s, t) => {
      const m = findModel(s, t);
      if (!m) return [];
      const cost = modelPullCost(m, 'suspend');
      return [pv(cost.meter, -cost.amount), pv('company', -20, findCompany(s, m.companyId)?.name), pvConf(s, suspendReaction(s, m))];
    },
    perform: (s, t, o) => {
      const m = findModel(s, t);
      if (!m) return { ok: false, error: 'Choose a model', title: '', text: '' };
      if (o === 'restrict') {
        restrictModel(s, m, `Restricted ${m.name}`);
        addLog(s, `Restricted ${m.name}${m.flawKnown && m.flaw ? ` after confirming its ${lowerPhrase(getFlawFlavor(m.flaw).name)}` : ''}.`, true, 'good', { modelId: m.id, companyId: m.companyId });
        return { ok: true, success: true, title: `Restricted: ${m.name}`, text: `${m.name} now runs under tight limits.` };
      }
      suspendModel(s, m, `Suspended ${m.name}`);
      addLog(s, `Suspended ${m.name}${m.flawKnown && m.flaw ? ` after confirming its ${lowerPhrase(getFlawFlavor(m.flaw).name)}` : ''}.`, true, 'good', { modelId: m.id, companyId: m.companyId });
      return { ok: true, success: true, title: `Suspended: ${m.name}`, text: `${m.name} is pulled from service.` };
    },
  },
  {
    id: 'investigate_situation',
    category: 'threats',
    tab: 'threats',
    name: 'Investigate situation',
    description: 'Trace a detected threat to its source and true stage. Unlocks targeted responses.',
    icon: 'investigate',
    cost: () => CAP1,
    targets: (s) =>
      s.situations
        .filter((x) => x.detected && !x.resolved)
        .map((x) => ({ id: x.id, label: situationDisplayName(x), disabled: x.causeKnown ? 'Cause already known' : null })),
    block: (s, t) => {
      const x = s.situations.find((sx) => sx.id === t);
      return x ? responseBlock(s, x, 'investigate') : 'Choose a situation';
    },
    preview: () => [],
    selfPaid: true,
    perform: (s, t) => {
      const x = s.situations.find((sx) => sx.id === t);
      if (!x) return { ok: false, error: 'Choose a situation', title: '', text: '' };
      return applyResponse(s, x, 'investigate');
    },
  },
  {
    id: 'situation_response',
    category: 'threats',
    tab: 'threats',
    name: 'Respond to situation',
    description: 'Monitor, contain, restrict or suspend the source, or use emergency powers.',
    icon: 'respond',
    cost: () => ({}),
    targets: (s) => s.situations.filter((x) => x.detected && !x.resolved).map((x) => ({ id: x.id, label: situationDisplayName(x) })),
    options: () =>
      RESPONSE_ORDER.map((id) => ({
        id,
        label: RESPONSE_INFO[id].label,
        description: RESPONSE_INFO[id].description,
        preview: [],
        cost: id === 'investigate' ? CAP1 : id === 'taskforce' ? { capacity: 1, budget: 3 } : undefined,
      })),
    block: (s, t, o) => {
      const x = s.situations.find((sx) => sx.id === t);
      if (!x) return 'Choose a situation';
      if (!o || !RESPONSE_ORDER.includes(o as ResponseId)) return 'Choose a response';
      return responseBlock(s, x, o as ResponseId);
    },
    preview: () => [],
    selfPaid: true,
    perform: (s, t, o) => {
      const x = s.situations.find((sx) => sx.id === t);
      if (!x) return { ok: false, error: 'Choose a situation', title: '', text: '' };
      return applyResponse(s, x, o as ResponseId);
    },
  },
  {
    id: 'safety_grant',
    category: 'labs',
    tab: 'labs',
    name: 'Safety grant',
    description: 'Fund a company\'s safety team. Raises its safety culture and goodwill.',
    icon: 'grant',
    cost: () => ({ capacity: 1, budget: 4 }),
    targets: (s) => companyTargets(s),
    block: needCompany,
    preview: (s, t) => [pv('budget', -4), pv('company', 5, findCompany(s, t)?.name)],
    perform: (s, t) => {
      const c = findCompany(s, t);
      if (!c) return { ok: false, error: 'Choose a company', title: '', text: '' };
      c.safety = clamp(c.safety + 10, 0, 100);
      changeCompanyRelation(s, c.id, 5, 'Safety grant');
      bumpStat(s, 'grants');
      return { ok: true, title: `Safety grant: ${c.name}`, text: `${c.name} expands its safety team with your funding.` };
    },
  },
  {
    id: 'compute_contract',
    category: 'labs',
    tab: 'labs',
    name: 'Compute contract',
    description: 'Give a company priority access to national compute. Faster progress, warmer relations.',
    icon: 'contract',
    cost: () => ({ capacity: 1, budget: 5 }),
    targets: (s) => companyTargets(s),
    block: needCompany,
    preview: (s, t) => {
      const p = [pv('budget', -5), pv('company', 8, findCompany(s, t)?.name), pvCap(0.3, findCompany(s, t)?.name)];
      const c = stanceConf(s, { accelerationist: 1, hawk: 1 });
      if (c) p.push(pvConf(s, c));
      return p;
    },
    perform: (s, t) => {
      const c = findCompany(s, t);
      if (!c) return { ok: false, error: 'Choose a company', title: '', text: '' };
      changeCapability(s, { companyId: c.id }, 0.3, 'Compute contract');
      changeCompanyRelation(s, c.id, 8, 'Compute contract');
      const conf = stanceConf(s, { accelerationist: 1, hawk: 1 });
      if (conf) changeMeter(s, 'confidence', conf, 'Backing a national champion');
      return { ok: true, title: `Compute contract: ${c.name}`, text: `${c.name} gets priority access to national compute.` };
    },
  },
  {
    id: 'enforcement',
    category: 'labs',
    tab: 'labs',
    name: 'Enforcement action',
    description: 'Use Evidence to sanction a company: more transparency, less recklessness, much less goodwill.',
    icon: 'enforce',
    cost: () => ({ capacity: 1, evidence: 1 }),
    targets: (s) => companyTargets(s, (id) => (s.companies.find((c) => c.id === id)?.status === 'sanctioned' ? 'Already sanctioned' : null)),
    block: (s, t) => {
      const c = findCompany(s, t);
      if (!c) return 'Choose a company';
      if (c.status === 'sanctioned') return 'Already sanctioned';
      return null;
    },
    preview: (s, t) => {
      const p = [pvUnits('evidence', -1), pv('company', -15, findCompany(s, t)?.name)];
      const conf = enforcementConfidence(s);
      if (conf) p.push(pvConf(s, conf));
      return p;
    },
    perform: (s, t) => {
      const c = findCompany(s, t);
      if (!c) return { ok: false, error: 'Choose a company', title: '', text: '' };
      changeCompanyRelation(s, c.id, -15, 'Enforcement action');
      c.transparency = clamp(c.transparency + 15, 0, 100);
      c.ambition = clamp(c.ambition - 10, 0, 100);
      c.status = 'sanctioned';
      c.sanctions += 1;
      s.flags[`sanctionTurn:${c.id}`] = s.turn;
      const conf = enforcementConfidence(s);
      if (conf) changeMeter(s, 'confidence', conf, conf > 0 ? 'Tough on reckless labs' : 'Attacking a national champion');
      bumpStat(s, 'enforcements');
      addLog(s, `Took enforcement action against ${c.name}.`, true, 'good', { companyId: c.id });
      return { ok: true, title: `Enforcement: ${c.name}`, text: `${c.name} is sanctioned. Its next quarters will be slower and more transparent.` };
    },
  },
  {
    id: 'brief_leader',
    category: 'politics',
    tab: 'inbox',
    name: 'Brief the leader',
    description: 'Walk the leader through your strategy. Restores confidence; diminishing returns if repeated.',
    icon: 'brief',
    cost: () => CAP1,
    preview: (s) => [pvConf(s, briefGain(s))],
    perform: (s) => {
      const g = briefGain(s);
      changeMeter(s, 'confidence', g, `Briefed the ${s.government.leaderTitle}`);
      s.government.briefCount += 1;
      s.flags.briefTurns = [...recentBriefTurns(s), s.turn].join(',');
      bumpStat(s, 'briefings');
      return { ok: true, title: `Briefing with ${s.government.leaderName}`, text: g >= 4 ? 'The briefing lands well.' : 'Polite nods. The novelty of your briefings is wearing off.' };
    },
  },
  {
    id: 'public_address',
    category: 'politics',
    tab: 'nation',
    name: 'Public address',
    description: 'Speak to the nation about AI. Calms the public; judged on how you handle any public crisis.',
    icon: 'address',
    cost: () => CAP1,
    preview: (s) => {
      const p = [pv('stability', addressGain(s))];
      const c = addressConfidence(s);
      if (c) p.push(pvConf(s, c));
      return p;
    },
    perform: (s) => {
      const g = addressGain(s);
      changeMeter(s, 'stability', g, 'Public address');
      const c = addressConfidence(s);
      if (c) changeMeter(s, 'confidence', c, c > 0 ? 'Seen handling the crisis' : 'Address raised awkward questions');
      s.flags.recentAddresses = flagNum(s, 'recentAddresses') + 1;
      bumpStat(s, 'addresses');
      return { ok: true, title: 'Public address', text: 'Your address reassures much of the country.' };
    },
  },
  {
    id: 'enact_policy',
    category: 'nation',
    tab: 'nation',
    name: 'Enact policy',
    description: 'Pass a law. Costs political capital unless the leader likes it.',
    icon: 'policy',
    cost: () => CAP1,
    targets: (s) =>
      POLICY_ORDER.map((id) => {
        const cost = policyCost(s, id);
        return {
          id,
          label: POLICIES[id].name,
          sublabel: cost > 0 ? `Confidence −${cost}` : cost < 0 ? `Confidence +${-cost}` : 'No political cost',
          disabled: s.policies.includes(id) ? 'Already in force' : cost > 0 && cost >= s.meters.confidence ? 'Not enough political capital' : null,
        };
      }),
    block: (s, t) => {
      if (!isPolicyId(t)) return 'Choose a policy';
      const id = t;
      if (s.policies.includes(id)) return 'Already in force';
      const cost = policyCost(s, id);
      if (cost > 0 && cost >= s.meters.confidence) return 'Not enough political capital';
      return null;
    },
    preview: (s, t) => {
      if (!isPolicyId(t)) return [];
      const cost = policyCost(s, t);
      return cost ? [pvConfExact(-cost)] : [];
    },
    perform: (s, t) => {
      const id = t as PolicyId;
      const def = POLICIES[id];
      const cost = policyCost(s, id);
      if (cost) changeMeter(s, 'confidence', -cost, cost > 0 ? `Political cost: ${def.name}` : `Leader applauds: ${def.name}`, true);
      s.policies.push(id);
      if (id === 'open_weights_ban') for (const c of s.companies) if (c.archetype === 'opensource') changeCompanyRelation(s, c.id, -20, 'Open-weights ban');
      if (def.onEnact) applyEffect(s, def.onEnact, {}, def.name);
      trigger(s, 'policy_enacted', {}, def.name);
      highlight(s, `New law: ${def.name}`, 'neutral', def.icon);
      addLog(s, `Enacted the ${def.name}.`, true, 'neutral');
      bumpStat(s, 'policies');
      return { ok: true, title: def.name, text: `The ${def.name} is now law.` };
    },
  },
  {
    id: 'repeal_policy',
    category: 'nation',
    tab: 'nation',
    name: 'Repeal policy',
    description: 'Strike a law from the books.',
    icon: 'policy',
    cost: () => CAP1,
    targets: (s) =>
      s.policies.map((id) => {
        const cost = repealCost(s, id);
        return { id, label: POLICIES[id].name, sublabel: cost > 0 ? `Confidence −${cost}` : cost < 0 ? `Confidence +${-cost}` : 'No political cost', disabled: null };
      }),
    block: (s, t) => (isPolicyId(t) && s.policies.includes(t) ? null : 'Not in force'),
    preview: (s, t) => {
      if (!isPolicyId(t)) return [];
      const cost = repealCost(s, t as PolicyId);
      return cost ? [pvConfExact(-cost)] : [];
    },
    perform: (s, t) => {
      const id = t as PolicyId;
      const cost = repealCost(s, id);
      if (cost) changeMeter(s, 'confidence', -cost, cost > 0 ? `Repealed ${POLICIES[id].name}` : `Leader welcomes repeal of ${POLICIES[id].name}`, true);
      s.policies = s.policies.filter((p) => p !== id);
      addLog(s, `Repealed the ${POLICIES[id].name}.`, false, 'neutral');
      return { ok: true, title: POLICIES[id].name, text: `The ${POLICIES[id].name} is repealed.` };
    },
  },
  {
    id: 'intel_assessment',
    category: 'world',
    tab: 'world',
    name: 'Intelligence assessment',
    description: 'Focus collection on one country. Sharper estimates; exposes treaty cheating.',
    icon: 'intelligence',
    cost: () => CAP1,
    targets: (s) => rivalTargets(s),
    block: needRival,
    preview: () => [],
    perform: (s, t) => {
      const rv = findRival(s, t);
      if (!rv) return { ok: false, error: 'Choose a country', title: '', text: '' };
      rv.intel = Math.max(rv.intel, 0.9);
      rv.estimateBias *= 0.4;
      s.riskBias *= 0.75;
      bumpStat(s, 'intel');
      const est = rivalCapEstimate(rv);
      const revealed = [`${rv.name} capability: ${est.low}–${est.high} (${confidenceFromIntel(rv.intel)} confidence)`];
      let newCards = 0;
      if (rv.defected && !s.flags[`defectionKnown:${rv.id}`]) {
        s.flags[`defectionKnown:${rv.id}`] = true;
        const card = worldCard(s, { kind: 'defection_found', rivalId: rv.id });
        if (card) {
          pushInboxNow(s, card);
          newCards++;
        }
        revealed.push(`${rv.name} is secretly violating the Accord`);
      }
      const spied = flagNum(s, `spiedOn:${rv.id}`);
      if (spied > 0) revealed.push(`${rv.name} has run ${spied} espionage operation${spied > 1 ? 's' : ''} against our labs`);
      return { ok: true, title: `Assessment: ${rv.name}`, text: `Analysts deliver a fresh assessment of ${rv.name}.`, revealed, newCards };
    },
  },
  {
    id: 'diplomatic_initiative',
    category: 'world',
    tab: 'world',
    name: 'Diplomatic initiative',
    description: 'Talks on AI safety. Builds trust and moves the Global Accord forward.',
    icon: 'diplomacy',
    cost: () => ({ capacity: 1, budget: 3 }),
    targets: (s) => rivalTargets(s),
    block: needRival,
    preview: (s, t) => {
      const p = [pv('budget', -3), pv('rival', 6, findRival(s, t)?.name), pv('tension', -4)];
      if (!s.accord.signed) p.push(pv('accord', accordGainFor(s)));
      return p;
    },
    perform: (s, t) => {
      const rv = findRival(s, t);
      if (!rv) return { ok: false, error: 'Choose a country', title: '', text: '' };
      changeRivalTrust(s, rv.id, 6, 'Diplomatic initiative');
      for (const o of s.rivals) if (o.id !== rv.id) changeRivalTrust(s, o.id, 2, 'Diplomatic initiative');
      changeResource(s, 'tension', -4, 'Diplomatic initiative');
      let text = `Talks with ${rv.name} make progress.`;
      if (!s.accord.signed) {
        changeResource(s, 'accord', accordGainFor(s), 'Diplomatic initiative');
        trigger(s, 'accord_progress');
      } else if (!rv.accordMember && rv.trust >= 40) {
        rv.accordMember = true;
        rv.defected = false;
        text = `${rv.name} agrees to join the Global Accord.`;
      }
      bumpStat(s, 'diplomacy');
      return { ok: true, title: `Diplomacy: ${rv.name}`, text };
    },
  },
  {
    id: 'research_partnership',
    category: 'world',
    tab: 'world',
    name: 'Research partnership',
    description: 'Joint safety research with a trusted partner. Lasting safeguards boost; they gain too.',
    icon: 'partnership',
    cost: () => ({ capacity: 1, budget: 3 }),
    targets: (s) => rivalTargets(s, (id) => partnershipBlock(s, id)),
    block: (s, t) => needRival(s, t) ?? partnershipBlock(s, t ?? ''),
    preview: (s, t) => {
      const p = [pv('budget', -3), pvDir('safeguards', 1), pv('rival', 5, findRival(s, t)?.name)];
      if (s.government.stance === 'hawk') p.push(pvConf(s, -2));
      return p;
    },
    perform: (s, t) => {
      const rv = findRival(s, t);
      if (!rv) return { ok: false, error: 'Choose a country', title: '', text: '' };
      rv.partnership = true;
      changeResource(s, 'safeguards', 0.3, `Partnership with ${rv.name}`);
      changeRivalTrust(s, rv.id, 5, 'Research partnership');
      changeCapability(s, { rivalId: rv.id }, 0.1, 'Research partnership');
      if (s.government.stance === 'hawk') changeMeter(s, 'confidence', -2, `Sharing research with ${rv.name}`);
      addLog(s, `Launched a research partnership with ${rv.name}.`, true, 'good', { rivalId: rv.id });
      return { ok: true, title: `Partnership: ${rv.name}`, text: `Joint safety labs open with ${rv.name}.` };
    },
  },
  {
    id: 'export_controls',
    category: 'world',
    tab: 'world',
    name: 'Export controls',
    description: 'Toggle chip export controls on all rivals: slows their progress, angers them, raises tension.',
    icon: 'export',
    cost: () => CAP1,
    preview: (s) => {
      const conf = s.exportControls ? stanceConf(s, { hawk: -2 }) : stanceConf(s, { hawk: 2, accelerationist: -1 });
      const p = s.exportControls ? [pv('tension', -3), pv('rival', 4, 'All rivals')] : [pv('tension', 6), pv('rival', -8, 'All rivals'), pvCap(-0.3, 'Rivals')];
      if (conf) p.push(pvConf(s, conf));
      return p;
    },
    perform: (s) => {
      s.exportControls = !s.exportControls;
      for (const rv of s.rivals) {
        rv.exportControlled = s.exportControls;
        changeRivalTrust(s, rv.id, s.exportControls ? -8 : 4, s.exportControls ? 'Export controls imposed' : 'Export controls lifted');
      }
      changeResource(s, 'tension', s.exportControls ? 6 : -3, s.exportControls ? 'Export controls imposed' : 'Export controls lifted');
      const conf = s.exportControls ? stanceConf(s, { hawk: 2, accelerationist: -1 }) : stanceConf(s, { hawk: -2 });
      if (conf) changeMeter(s, 'confidence', conf, s.exportControls ? 'Export controls' : 'Lifted export controls');
      addLog(s, s.exportControls ? 'Imposed chip export controls on all rivals.' : 'Lifted chip export controls.', true, 'mixed');
      return { ok: true, title: 'Export controls', text: s.exportControls ? 'Chip exports to rivals are now restricted.' : 'Export controls are lifted.' };
    },
  },
  {
    id: 'espionage',
    category: 'world',
    tab: 'world',
    name: 'Espionage',
    description: 'Steal research and get a precise read on a rival. 30% chance of being caught.',
    icon: 'espionage',
    cost: () => CAP1,
    targets: (s) => rivalTargets(s),
    block: needRival,
    preview: () => [pvCap(0.4, 'Our leading lab')],
    perform: (s, t) => {
      const rv = findRival(s, t);
      if (!rv) return { ok: false, error: 'Choose a country', title: '', text: '' };
      const r = rng(s);
      rv.intel = 1;
      rv.estimateBias = 0;
      const lead = leadingCompany(s);
      if (lead) changeCapability(s, { companyId: lead.id }, r.range(0.3, 0.5), 'Stolen research');
      bumpStat(s, 'espionage');
      const revealed = [`${rv.name} true capability: ${round1(rv.capability)}`, `${rv.name} safeguards: ${round1(rv.safeguards)}`];
      if (rv.defected) revealed.push(`${rv.name} is cheating on the Accord`);
      if (r.chance(0.3)) {
        changeRivalTrust(s, rv.id, -20, 'Espionage exposed');
        changeResource(s, 'tension', 10, 'Espionage exposed');
        if (s.government.stance !== 'hawk') changeMeter(s, 'confidence', -3, 'Espionage scandal');
        trigger(s, 'espionage', { rivalId: rv.id });
        addLog(s, `Our espionage against ${rv.name} was exposed.`, true, 'bad', { rivalId: rv.id });
        return { ok: true, success: true, title: `Espionage: ${rv.name}`, text: 'We got what we came for — but our agents were exposed.', revealed };
      }
      return { ok: true, success: true, title: `Espionage: ${rv.name}`, text: 'A clean operation. Their secrets are now ours.', revealed };
    },
  },
  {
    id: 'sabotage',
    category: 'world',
    tab: 'world',
    name: 'Cyber sabotage',
    description: 'Set back a rival\'s AI program. 40% chance of discovery and a dangerous escalation.',
    icon: 'sabotage',
    cost: () => ({ capacity: 1, budget: 2 }),
    targets: (s) => rivalTargets(s),
    block: needRival,
    preview: (s, t) => [pv('budget', -2), pvCap(-0.5, findRival(s, t)?.name), pvDir('risk', 1)],
    perform: (s, t) => {
      const rv = findRival(s, t);
      if (!rv) return { ok: false, error: 'Choose a country', title: '', text: '' };
      const r = rng(s);
      changeCapability(s, { rivalId: rv.id }, -r.range(0.4, 0.7), 'Sabotage');
      changeRisk(s, 1, 'Cyber sabotage', 'tension');
      bumpStat(s, 'sabotage');
      if (r.chance(0.4)) {
        changeRivalTrust(s, rv.id, -30, 'Sabotage discovered');
        changeResource(s, 'tension', 15, 'Sabotage discovered');
        rv.aggression = clamp(rv.aggression + 0.1, 0, 1);
        addLog(s, `Sabotaged ${possessive(rv.name)} AI program — and got caught.`, true, 'bad', { rivalId: rv.id });
        return { ok: true, success: true, title: `Sabotage: ${rv.name}`, text: `The attack worked, but ${rv.name} traced it back to us.` };
      }
      addLog(s, `Sabotaged ${possessive(rv.name)} AI program.`, true, 'mixed', { rivalId: rv.id });
      return { ok: true, success: true, title: `Sabotage: ${rv.name}`, text: `${rv.leadLab} suffers a mysterious setback.` };
    },
  },
  {
    id: 'talent_recruitment',
    category: 'world',
    tab: 'world',
    name: 'Talent recruitment',
    description: 'Lure top researchers from a rival. Boosts our labs and safety science; they resent it.',
    icon: 'recruit',
    cost: () => ({ capacity: 1, budget: 2 }),
    targets: (s) => rivalTargets(s),
    block: needRival,
    preview: (s, t) => [pv('budget', -2), pvCap(0.15, 'Our leading lab'), pvDir('safeguards', 1), pv('rival', -5, findRival(s, t)?.name)],
    perform: (s, t) => {
      const rv = findRival(s, t);
      if (!rv) return { ok: false, error: 'Choose a country', title: '', text: '' };
      const lead = leadingCompany(s);
      if (lead) changeCapability(s, { companyId: lead.id }, 0.15, 'Recruited researchers');
      changeResource(s, 'safeguards', 0.15, 'Recruited safety researchers');
      changeCapability(s, { rivalId: rv.id }, -0.1, 'Talent drain');
      changeRivalTrust(s, rv.id, -5, 'Talent poaching');
      return { ok: true, title: `Recruitment: ${rv.name}`, text: `A dozen leading researchers from ${rv.name} accept your offer.` };
    },
  },
];

/** Warning-sign headlines from the last three quarters (follow_signal targets). */
function recentSignals(s: GameState): NewsItem[] {
  return s.news.filter((n) => n.signal && n.id && n.turn >= s.turn - 3);
}

function followBlock(s: GameState, id: string | undefined): string | null {
  const n = id ? s.news.find((x) => x.id === id && x.signal) : undefined;
  if (!n) return 'Choose a warning sign';
  if (n.turn < s.turn - 3) return 'The trail has gone cold';
  if (s.flags[`followed:${n.id}`] !== undefined) return 'Already followed';
  const x = s.situations.find((sx) => sx.id === n.situationId);
  if (x?.detected && !x.resolved) return 'Already on the Threats board';
  return null;
}

/** Why a model cannot be restricted/suspended directly (null = it can). */
function revocable(s: GameState, id: string): string | null {
  const m = findModel(s, id);
  if (!m) return 'Choose a model';
  if (m.status === 'rogue_deployed' && !s.flags[`rogueKnown:${m.id}`]) return 'Not deployed';
  if (m.status === 'restricted') return null;
  if (m.status !== 'deployed' && m.status !== 'limited' && m.status !== 'rogue_deployed') return 'Not deployed';
  return null;
}

/** Briefings within the last 3 quarters (including this one). */
function recentBriefTurns(s: GameState): number[] {
  const raw = s.flags.briefTurns;
  const list = typeof raw === 'string' && raw ? raw.split(',').map(Number) : [];
  return list.filter((t) => t >= s.turn - 2);
}

/** +4, halved for every briefing in the last 3 quarters: farming yields +4, +2, +1. */
function briefGain(s: GameState): number {
  return Math.max(1, Math.round(4 * Math.pow(0.5, recentBriefTurns(s).length)));
}

function addressGain(s: GameState): number {
  return clamp(Math.round(4 - 1.5 * flagNum(s, 'recentAddresses')), 1, 4);
}

function addressConfidence(s: GameState): number {
  const pub = publicSituations(s);
  if (!pub.length) return 0;
  return pub.every((x) => x.response !== 'none' && x.response !== 'monitor') ? 2 : -2;
}

function accordGainFor(s: GameState): number {
  return Math.round(8 * (1 + getMods(s).accordGain));
}

function partnershipBlock(s: GameState, id: string): string | null {
  const rv = findRival(s, id);
  if (!rv) return 'Choose a country';
  if (rv.partnership) return 'Partnership already active';
  if (rv.trust < 50) return 'Requires trust ≥ 50';
  return null;
}

const BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

const TAB_LABEL: Record<TabId, string> = { inbox: 'Inbox', labs: 'Labs', nation: 'Nation', world: 'World', threats: 'Threats' };

function tabBlock(s: GameState, def: ActionDef): string | null {
  return s.unlockedTabs.includes(def.tab) ? null : `Unlocks with the ${TAB_LABEL[def.tab]} tab`;
}

export function getActionViews(s: GameState): ActionView[] {
  return ACTIONS.map((def) => {
    const cost = def.cost(s);
    const view: ActionView = {
      id: def.id,
      category: def.category,
      name: def.name,
      description: def.description,
      icon: def.icon,
      cost,
      disabled: s.gameOver ? 'Game over' : tabBlock(s, def) ?? costBlock(s, cost),
      preview: def.targets ? [] : def.preview(s),
    };
    if (def.targets) {
      // Actions with options are validated per option at perform time; targets only carry their own reason.
      view.targets = def.targets(s).map((t) => ({ ...t, disabled: t.disabled ?? (def.options ? null : def.block?.(s, t.id)) ?? costBlock(s, def.cost(s, t.id)) }));
      if (!view.disabled && view.targets.length === 0) view.disabled = 'No valid targets';
    }
    if (def.options) view.options = def.options(s);
    if (def.id === 'situation_response' && view.options) {
      view.options = view.options.map((o) => ({ ...o, disabled: costBlock(s, o.cost) }));
    }
    return view;
  });
}

/** Validates and performs an action. Never throws for bad input. */
export function performActionImpl(s: GameState, id: ActionId, targetId?: string, optionId?: string): ActionOutcome {
  const def = BY_ID.get(id);
  if (!def) return { ok: false, error: 'Unknown action', title: '', text: '' };
  if (s.gameOver) return { ok: false, error: 'The game is over', title: def.name, text: '' };
  const tb = tabBlock(s, def);
  if (tb) return { ok: false, error: tb, title: def.name, text: '' };
  if (def.targets && !targetId) return { ok: false, error: 'This action needs a target', title: def.name, text: '' };
  const block = def.block?.(s, targetId, optionId);
  if (block) return { ok: false, error: block, title: def.name, text: '' };
  if (!def.selfPaid) {
    const cost = def.cost(s, targetId);
    const cb = costBlock(s, cost);
    if (cb) return { ok: false, error: cb, title: def.name, text: '' };
    payCost(s, cost, def.name, { companyId: targetId, rivalId: targetId });
  }
  const out = def.perform(s, targetId, optionId);
  if (out.ok) bumpStat(s, 'actions');
  return out;
}

