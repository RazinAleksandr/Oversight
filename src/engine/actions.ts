/**
 * Department actions (GDD §7, §10): each action defines its cost, targets/options, disabled reasons,
 * preview and effect. `situation_response` takes targetId = situation id and optionId = response id;
 * `enact_policy` / `repeal_policy` take targetId = PolicyId.
 */
import { getLang, t, tp, tr } from '../i18n';
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
import { confidenceFromIntel, confidenceWord, rivalCapEstimate, traitLabel } from './fog';
import { STAGE_LABELS, dateLabel } from './labels';
import { addLog, bumpStat, highlight, trigger } from './log';
import { flagNum, getMods } from './modifiers';
import { sourceOf } from './source';
import { pv, pvCap, pvConf, pvConfExact, pvDir, pvUnits } from './preview';
import { findCompany, findModel, findRival, leadingCompany, LIVE_STATUSES, publicSituations } from './query';
import { rng } from './rng';
import { discoverViolation } from './systems/companies';
import { detectionChance, perceivedDetectionChance } from './systems/deployment';
import { applyResponse, detect, modelPullCost, restrictModel, RESPONSE_ORDER, responseBlock, suspendModel, suspendReaction } from './systems/situations';
import { worldCard } from './systems/worldCards';
import { fmt, situationDisplayName } from './template';
import type { ActionId, ActionTarget, ActionView, Cost, EffectPreview, GameState, NewsItem, PolicyId, Stance, TabId } from './types';
import { clamp, midPhrase, round1 } from './util';

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
  return s.companies.map((c) => ({ id: c.id, label: c.name, sublabel: t('Relation {value}', { value: Math.round(c.relation) }), disabled: filter ? filter(c.id) : null }));
}

function rivalTargets(s: GameState, filter?: (id: string) => string | null): ActionTarget[] {
  return s.rivals.map((r) => ({ id: r.id, label: r.name, sublabel: t('Trust {value}', { value: Math.round(r.trust) }), disabled: filter ? filter(r.id) : null }));
}

function needCompany(s: GameState, id?: string): string | null {
  return findCompany(s, id) ? null : t('Choose a company');
}

function needRival(s: GameState, id?: string): string | null {
  return findRival(s, id) ? null : t('Choose a country');
}

function auditable(s: GameState, id: string): string | null {
  const m = findModel(s, id);
  if (!m) return t('Choose a model');
  if (!LIVE_STATUSES.has(m.status) || (m.status === 'rogue_deployed' && !s.flags[`rogueKnown:${m.id}`])) return t('Not deployed');
  if (m.flawKnown) return t('Flaw already confirmed');
  if (m.audited) return t('Already audited');
  return null;
}

/** Trait levels as shown inside revealed lines (the views keep the English ids). */
function levelLabel(level: 'Low' | 'Medium' | 'High'): string {
  return level === 'Low' ? t('Low') : level === 'Medium' ? t('Medium') : t('High');
}

/** "Confidence −3" / "Confidence +2" / "No political cost" for policy targets. */
function politicalCostLabel(cost: number): string {
  return cost > 0 ? t('Confidence −{n}', { n: cost }) : cost < 0 ? t('Confidence +{n}', { n: -cost }) : t('No political cost');
}

// ───────────────────────────── Definitions ─────────────────────────────

/** Action definitions in the current language (built lazily so every label goes through t()). */
function buildActions(): ActionDef[] {
  return [
    {
      id: 'investigate_company',
      category: 'labs',
      tab: 'labs',
      name: t('Investigate company'),
      description: t('Send inspectors in. Reveals true traits and capability; may uncover hidden violations (Evidence).'),
      icon: 'investigate',
      cost: () => CAP1,
      targets: (s) => companyTargets(s),
      block: needCompany,
      preview: (s, tg) => [pv('company', -3, findCompany(s, tg)?.name)],
      perform: (s, tg) => {
        const c = findCompany(s, tg);
        if (!c) return { ok: false, error: t('Choose a company'), title: '', text: '' };
        const r = rng(s);
        c.intel = 1;
        c.lastInvestigatedTurn = s.turn;
        c.knownTraits = { safety: true, transparency: true, ambition: true };
        changeCompanyRelation(s, c.id, -3, t('Investigation'));
        bumpStat(s, 'investigations');
        const revealed = [
          t('Safety culture: {value} ({level})', { value: Math.round(c.safety), level: levelLabel(traitLabel(c.safety)) }),
          t('Transparency: {value} ({level})', { value: Math.round(c.transparency), level: levelLabel(traitLabel(c.transparency)) }),
          t('Ambition: {value} ({level})', { value: Math.round(c.ambition), level: levelLabel(traitLabel(c.ambition)) }),
          t('True capability: {value} (reported {reported})', { value: round1(c.capability), reported: round1(c.reportedCapability) }),
        ];
        let found = 0;
        for (const v of c.violations) {
          if (!v.discovered && r.chance(0.7)) {
            discoverViolation(s, c, v, t('investigation'));
            revealed.push(t('Violation: {violation}', { violation: v.description }));
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
            revealed.push(t('Concealed incident uncovered: {situation}', { situation: situationDisplayName(x) }));
          }
        }
        addLog(
          s,
          found ? tp(found, 'Investigated {company} — found {n} violation.', 'Investigated {company} — found {n} violations.', { company: c.name }) : t('Investigated {company}.', { company: c.name }),
          found > 0,
          found ? 'good' : 'neutral',
          { companyId: c.id },
        );
        return {
          ok: true,
          title: t('Investigation: {company}', { company: c.name }),
          text: found ? tp(found, 'Inspectors found {n} hidden violation.', 'Inspectors found {n} hidden violations.') : t('Inspectors found no hidden violations.'),
          revealed,
        };
      },
    },
    {
      id: 'audit_model',
      category: 'labs',
      tab: 'labs',
      name: t('Audit deployed model'),
      description: t('A focused red-team audit of a model already in use. Much better odds of finding hidden flaws.'),
      icon: 'audit',
      cost: () => CAP1,
      targets: (s) =>
        s.models
          .filter((m) => LIVE_STATUSES.has(m.status) && (m.status !== 'rogue_deployed' || !!s.flags[`rogueKnown:${m.id}`]))
          .map((m) => ({ id: m.id, label: m.name, sublabel: findCompany(s, m.companyId)?.name, disabled: auditable(s, m.id) })),
      block: (s, tg) => auditable(s, tg ?? ''),
      preview: () => [],
      perform: (s, tg) => {
        const m = findModel(s, tg);
        if (!m) return { ok: false, error: t('Choose a model'), title: '', text: '' };
        bumpStat(s, 'audits');
        const d = Math.min(0.9, detectionChance(s, m, 0.3));
        const shownD = Math.min(0.9, perceivedDetectionChance(s, m, 0.3));
        m.lastCheckTurn = s.turn;
        m.lastCheckDetection = shownD;
        const x = s.situations.find((sx) => sx.source.modelId === m.id && !sx.resolved);
        if (x) x.firstActionTurn = x.firstActionTurn ?? s.turn;
        if (m.flaw && rng(s).chance(d)) {
          m.flawKnown = true;
          m.evalDetected = true;
          m.suspected = false;
          const revealed = [t('Flaw confirmed: {flaw}', { flaw: getFlawFlavor(m.flaw).name })];
          if (x) {
            if (!x.detected) {
              x.detected = true;
              x.detectedTurn = s.turn;
              x.notifiedStage = x.stage;
              x.signalsShown += 1;
              if (!s.unlockedTabs.includes('threats')) s.unlockedTabs.push('threats');
            }
            x.causeKnown = true;
            revealed.push(t('Linked threat: {situation} ({stage})', { situation: situationDisplayName(x), stage: STAGE_LABELS[x.stage] }));
          }
          addLog(s, t('Audit of {model} confirmed a hidden flaw.', { model: m.name }), true, 'good', { modelId: m.id });
          return { ok: true, success: true, title: t('Audit: {model}', { model: m.name }), text: t('The audit found a real problem: {flaw}', { flaw: getFlawFlavor(m.flaw).description }), revealed };
        }
        m.audited = true;
        m.suspected = false;
        const pct = Math.round(shownD * 100);
        return {
          ok: true,
          success: true,
          title: t('Audit: {model}', { model: m.name }),
          text: t('No flaws found (audit confidence {pct}%).', { pct }),
          revealed: [t('Estimated detection power of this audit: {pct}%', { pct })],
        };
      },
    },
    {
      id: 'follow_signal',
      category: 'threats',
      tab: 'threats',
      name: t('Follow a warning sign'),
      description: t('Chase a strange report from the last three quarters. If something real is behind it, you may catch it early.'),
      icon: 'news',
      cost: () => CAP1,
      targets: (s) =>
        recentSignals(s).map((n) => ({ id: n.id as string, label: n.text, sublabel: `${dateLabel(n.turn)} · ${n.outlet}`, disabled: followBlock(s, n.id) })),
      block: (s, tg) => followBlock(s, tg),
      preview: () => [],
      perform: (s, tg) => {
        const n = s.news.find((x) => x.id === tg);
        if (!n) return { ok: false, error: t('Choose a warning sign'), title: '', text: '' };
        s.flags[`followed:${n.id}`] = s.turn;
        bumpStat(s, 'signalsFollowed');
        const x = s.situations.find((sx) => sx.id === n.situationId && !sx.resolved);
        if (!x) return { ok: true, success: false, title: t('A false lead'), text: t('Your analysts run it down. Whatever caused it, there is nothing there now — a false lead.') };
        x.firstActionTurn = x.firstActionTurn ?? s.turn;
        const p = clamp(0.25 + getMods(s).earlyWarning + 0.35, 0, 0.95);
        if (x.detected || rng(s).chance(p)) {
          detect(s, x, null);
          return { ok: true, success: true, title: situationDisplayName(x), text: t('The trail leads somewhere real: {situation}. It is now on the Threats board.', { situation: situationDisplayName(x) }) };
        }
        return { ok: true, success: false, title: t('The trail goes cold'), text: t('Your analysts find nothing conclusive — for now. If it is real, it will surface again.') };
      },
    },
    {
      id: 'revoke_model',
      category: 'labs',
      tab: 'labs',
      name: t('Restrict or suspend a model'),
      description: t('Limit or pull a deployed model directly — with or without a detected threat. Costs scale with how much the economy uses it.'),
      icon: 'respond',
      cost: () => ({}),
      targets: (s) =>
        s.models
          .filter((m) => revocable(s, m.id) === null || m.status === 'restricted')
          .map((m) => ({
            id: m.id,
            label: m.name,
            sublabel: `${findCompany(s, m.companyId)?.name ?? ''}${m.flawKnown && m.flaw ? t(' · flaw confirmed') : ''}`,
            disabled: revocable(s, m.id),
          })),
      options: () => [
        { id: 'restrict', label: t('Restrict'), description: t('Tight limits: 30% of its adoption lost; any problem it causes slows sharply.'), preview: [pv('economy', -2), pv('company', -8)] },
        { id: 'suspend', label: t('Suspend'), description: t('Pull it from service entirely. Its problems recede; dependent users take the hit.'), preview: [pv('economy', -5), pv('company', -20)] },
      ],
      block: (s, tg, o) => {
        const base = revocable(s, tg ?? '');
        if (o !== 'restrict' && o !== 'suspend') return base ?? t('Choose restrict or suspend');
        const m = findModel(s, tg);
        if (o === 'restrict' && m?.status === 'restricted') return t('Already restricted');
        if (o === 'suspend' && m?.status === 'restricted') return null;
        return base;
      },
      preview: (s, tg) => {
        const m = findModel(s, tg);
        if (!m) return [];
        const cost = modelPullCost(m, 'suspend');
        return [pv(cost.meter, -cost.amount), pv('company', -20, findCompany(s, m.companyId)?.name), pvConf(s, suspendReaction(s, m))];
      },
      perform: (s, tg, o) => {
        const m = findModel(s, tg);
        if (!m) return { ok: false, error: t('Choose a model'), title: '', text: '' };
        const flaw = m.flawKnown && m.flaw ? midPhrase(getFlawFlavor(m.flaw).name) : null;
        const refs = { modelId: m.id, companyId: m.companyId };
        if (o === 'restrict') {
          restrictModel(s, m, t('Restricted {model}', { model: m.name }));
          addLog(s, flaw ? t('Restricted {model} after confirming its {flaw}.', { model: m.name, flaw }) : t('Restricted {model}.', { model: m.name }), true, 'good', refs, { en: 'restricted' });
          return { ok: true, success: true, title: t('Restricted: {model}', { model: m.name }), text: t('{model} now runs under tight limits.', { model: m.name }) };
        }
        suspendModel(s, m, t('Suspended {model}', { model: m.name }));
        addLog(s, flaw ? t('Suspended {model} after confirming its {flaw}.', { model: m.name, flaw }) : t('Suspended {model}.', { model: m.name }), true, 'good', refs, { en: 'suspended' });
        return { ok: true, success: true, title: t('Suspended: {model}', { model: m.name }), text: t('{model} is pulled from service.', { model: m.name }) };
      },
    },
    {
      id: 'investigate_situation',
      category: 'threats',
      tab: 'threats',
      name: t('Investigate situation'),
      description: t('Trace a detected threat to its source and true stage. Unlocks targeted responses.'),
      icon: 'investigate',
      cost: () => CAP1,
      targets: (s) =>
        s.situations
          .filter((x) => x.detected && !x.resolved)
          .map((x) => ({ id: x.id, label: situationDisplayName(x), disabled: x.causeKnown ? t('Cause already known') : null })),
      block: (s, tg) => {
        const x = s.situations.find((sx) => sx.id === tg);
        return x ? responseBlock(s, x, 'investigate') : t('Choose a situation');
      },
      preview: () => [],
      selfPaid: true,
      perform: (s, tg) => {
        const x = s.situations.find((sx) => sx.id === tg);
        if (!x) return { ok: false, error: t('Choose a situation'), title: '', text: '' };
        return applyResponse(s, x, 'investigate');
      },
    },
    {
      id: 'situation_response',
      category: 'threats',
      tab: 'threats',
      name: t('Respond to situation'),
      description: t('Monitor, contain, restrict or suspend the source, or use emergency powers.'),
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
      block: (s, tg, o) => {
        const x = s.situations.find((sx) => sx.id === tg);
        if (!x) return t('Choose a situation');
        if (!o || !RESPONSE_ORDER.includes(o as ResponseId)) return t('Choose a response');
        return responseBlock(s, x, o as ResponseId);
      },
      preview: () => [],
      selfPaid: true,
      perform: (s, tg, o) => {
        const x = s.situations.find((sx) => sx.id === tg);
        if (!x) return { ok: false, error: t('Choose a situation'), title: '', text: '' };
        return applyResponse(s, x, o as ResponseId);
      },
    },
    {
      id: 'safety_grant',
      category: 'labs',
      tab: 'labs',
      name: t('Safety grant'),
      description: t("Fund a company's safety team. Raises its safety culture and goodwill."),
      icon: 'grant',
      cost: () => ({ capacity: 1, budget: 4 }),
      targets: (s) => companyTargets(s),
      block: needCompany,
      preview: (s, tg) => [pv('budget', -4), pv('company', 5, findCompany(s, tg)?.name)],
      perform: (s, tg) => {
        const c = findCompany(s, tg);
        if (!c) return { ok: false, error: t('Choose a company'), title: '', text: '' };
        c.safety = clamp(c.safety + 10, 0, 100);
        changeCompanyRelation(s, c.id, 5, t('Safety grant'));
        bumpStat(s, 'grants');
        return { ok: true, title: t('Safety grant: {company}', { company: c.name }), text: t('{company} expands its safety team with your funding.', { company: c.name }) };
      },
    },
    {
      id: 'compute_contract',
      category: 'labs',
      tab: 'labs',
      name: t('Compute contract'),
      description: t('Give a company priority access to national compute. Faster progress, warmer relations.'),
      icon: 'contract',
      cost: () => ({ capacity: 1, budget: 5 }),
      targets: (s) => companyTargets(s),
      block: needCompany,
      preview: (s, tg) => {
        const p = [pv('budget', -5), pv('company', 8, findCompany(s, tg)?.name), pvCap(0.3, findCompany(s, tg)?.name)];
        const c = stanceConf(s, { accelerationist: 1, hawk: 1 });
        if (c) p.push(pvConf(s, c));
        return p;
      },
      perform: (s, tg) => {
        const c = findCompany(s, tg);
        if (!c) return { ok: false, error: t('Choose a company'), title: '', text: '' };
        changeCapability(s, { companyId: c.id }, 0.3, 'Compute contract');
        changeCompanyRelation(s, c.id, 8, t('Compute contract'));
        const conf = stanceConf(s, { accelerationist: 1, hawk: 1 });
        if (conf) changeMeter(s, 'confidence', conf, t('Backing a national champion'));
        return { ok: true, title: t('Compute contract: {company}', { company: c.name }), text: t('{company} gets priority access to national compute.', { company: c.name }) };
      },
    },
    {
      id: 'enforcement',
      category: 'labs',
      tab: 'labs',
      name: t('Enforcement action'),
      description: t('Use Evidence to sanction a company: more transparency, less recklessness, much less goodwill.'),
      icon: 'enforce',
      cost: () => ({ capacity: 1, evidence: 1 }),
      targets: (s) => companyTargets(s, (id) => (s.companies.find((c) => c.id === id)?.status === 'sanctioned' ? t('Already sanctioned') : null)),
      block: (s, tg) => {
        const c = findCompany(s, tg);
        if (!c) return t('Choose a company');
        if (c.status === 'sanctioned') return t('Already sanctioned');
        return null;
      },
      preview: (s, tg) => {
        const p = [pvUnits('evidence', -1), pv('company', -15, findCompany(s, tg)?.name)];
        const conf = enforcementConfidence(s);
        if (conf) p.push(pvConf(s, conf));
        return p;
      },
      perform: (s, tg) => {
        const c = findCompany(s, tg);
        if (!c) return { ok: false, error: t('Choose a company'), title: '', text: '' };
        changeCompanyRelation(s, c.id, -15, t('Enforcement action'));
        c.transparency = clamp(c.transparency + 15, 0, 100);
        c.ambition = clamp(c.ambition - 10, 0, 100);
        c.status = 'sanctioned';
        c.sanctions += 1;
        s.flags[`sanctionTurn:${c.id}`] = s.turn;
        const conf = enforcementConfidence(s);
        if (conf) changeMeter(s, 'confidence', conf, conf > 0 ? t('Tough on reckless labs') : t('Attacking a national champion'));
        bumpStat(s, 'enforcements');
        addLog(s, t('Took enforcement action against {company}.', { company: c.name }), true, 'good', { companyId: c.id });
        return { ok: true, title: t('Enforcement: {company}', { company: c.name }), text: t('{company} is sanctioned. Its next quarters will be slower and more transparent.', { company: c.name }) };
      },
    },
    {
      id: 'brief_leader',
      category: 'politics',
      tab: 'inbox',
      name: t('Brief the leader'),
      description: t('Walk the leader through your strategy. Restores confidence; diminishing returns if repeated.'),
      icon: 'brief',
      cost: () => CAP1,
      preview: (s) => [pvConf(s, briefGain(s))],
      perform: (s) => {
        const g = briefGain(s);
        changeMeter(s, 'confidence', g, t('Briefed the {leaderTitle}', { leaderTitle: s.government.leaderTitle }));
        s.government.briefCount += 1;
        s.flags.briefTurns = [...recentBriefTurns(s), s.turn].join(',');
        bumpStat(s, 'briefings');
        return {
          ok: true,
          title: t('Briefing with {leader}', { leader: s.government.leaderName }),
          text: g >= 4 ? t('The briefing lands well.') : t('Polite nods. The novelty of your briefings is wearing off.'),
        };
      },
    },
    {
      id: 'public_address',
      category: 'politics',
      tab: 'nation',
      name: t('Public address'),
      description: t('Speak to the nation about AI. Calms the public; judged on how you handle any public crisis.'),
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
        changeMeter(s, 'stability', g, t('Public address'));
        const c = addressConfidence(s);
        if (c) changeMeter(s, 'confidence', c, c > 0 ? t('Seen handling the crisis') : t('Address raised awkward questions'));
        s.flags.recentAddresses = flagNum(s, 'recentAddresses') + 1;
        bumpStat(s, 'addresses');
        return { ok: true, title: t('Public address'), text: t('Your address reassures much of the country.') };
      },
    },
    {
      id: 'enact_policy',
      category: 'nation',
      tab: 'nation',
      name: t('Enact policy'),
      description: t('Pass a law. Costs political capital unless the leader likes it.'),
      icon: 'policy',
      cost: () => CAP1,
      targets: (s) =>
        POLICY_ORDER.map((id) => {
          const cost = policyCost(s, id);
          return {
            id,
            label: POLICIES[id].name,
            sublabel: politicalCostLabel(cost),
            disabled: s.policies.includes(id) ? t('Already in force') : cost > 0 && cost >= s.meters.confidence ? t('Not enough political capital') : null,
          };
        }),
      block: (s, tg) => {
        if (!isPolicyId(tg)) return t('Choose a policy');
        const id = tg;
        if (s.policies.includes(id)) return t('Already in force');
        const cost = policyCost(s, id);
        if (cost > 0 && cost >= s.meters.confidence) return t('Not enough political capital');
        return null;
      },
      preview: (s, tg) => {
        if (!isPolicyId(tg)) return [];
        const cost = policyCost(s, tg);
        return cost ? [pvConfExact(-cost)] : [];
      },
      perform: (s, tg) => {
        const id = tg as PolicyId;
        const def = POLICIES[id];
        const cost = policyCost(s, id);
        if (cost) changeMeter(s, 'confidence', -cost, cost > 0 ? t('Political cost: {policy}', { policy: def.name }) : t('Leader applauds: {policy}', { policy: def.name }), true);
        s.policies.push(id);
        if (id === 'open_weights_ban') for (const c of s.companies) if (c.archetype === 'opensource') changeCompanyRelation(s, c.id, -20, t('Open-weights ban'));
        if (def.onEnact) applyEffect(s, def.onEnact, {}, def.name);
        trigger(s, 'policy_enacted', {}, def.name);
        highlight(s, t('New law: {policy}', { policy: def.name }), 'neutral', def.icon);
        addLog(s, t('Enacted the {policy}.', { policy: def.name }), true, 'neutral', undefined, { en: sourceOf(def.name) });
        bumpStat(s, 'policies');
        return { ok: true, title: def.name, text: t('The {policy} is now law.', { policy: def.name }) };
      },
    },
    {
      id: 'repeal_policy',
      category: 'nation',
      tab: 'nation',
      name: t('Repeal policy'),
      description: t('Strike a law from the books.'),
      icon: 'policy',
      cost: () => CAP1,
      targets: (s) =>
        s.policies.map((id) => {
          const cost = repealCost(s, id);
          return { id, label: POLICIES[id].name, sublabel: politicalCostLabel(cost), disabled: null };
        }),
      block: (s, tg) => (isPolicyId(tg) && s.policies.includes(tg) ? null : t('Not in force')),
      preview: (s, tg) => {
        if (!isPolicyId(tg)) return [];
        const cost = repealCost(s, tg as PolicyId);
        return cost ? [pvConfExact(-cost)] : [];
      },
      perform: (s, tg) => {
        const id = tg as PolicyId;
        const cost = repealCost(s, id);
        const policy = POLICIES[id].name;
        if (cost) changeMeter(s, 'confidence', -cost, cost > 0 ? t('Repealed {policy}', { policy }) : t('Leader welcomes repeal of {policy}', { policy }), true);
        s.policies = s.policies.filter((p) => p !== id);
        addLog(s, t('Repealed the {policy}.', { policy }), false, 'neutral');
        return { ok: true, title: policy, text: t('The {policy} is repealed.', { policy }) };
      },
    },
    {
      id: 'intel_assessment',
      category: 'world',
      tab: 'world',
      name: t('Intelligence assessment'),
      description: t('Focus collection on one country. Sharper estimates; exposes treaty cheating.'),
      icon: 'intelligence',
      cost: () => CAP1,
      targets: (s) => rivalTargets(s),
      block: needRival,
      preview: () => [],
      perform: (s, tg) => {
        const rv = findRival(s, tg);
        if (!rv) return { ok: false, error: t('Choose a country'), title: '', text: '' };
        rv.intel = Math.max(rv.intel, 0.9);
        rv.estimateBias *= 0.4;
        s.riskBias *= 0.75;
        bumpStat(s, 'intel');
        const est = rivalCapEstimate(rv);
        const revealed = [t('{rival} capability: {low}–{high} ({confidence} confidence)', { rival: rv.name, low: est.low, high: est.high, confidence: confidenceWord(confidenceFromIntel(rv.intel)) })];
        let newCards = 0;
        if (rv.defected && !s.flags[`defectionKnown:${rv.id}`]) {
          s.flags[`defectionKnown:${rv.id}`] = true;
          const card = worldCard(s, { kind: 'defection_found', rivalId: rv.id });
          if (card) {
            pushInboxNow(s, card);
            newCards++;
          }
          revealed.push(t('{rival} is secretly violating the Accord', { rival: rv.name }));
        }
        const spied = flagNum(s, `spiedOn:${rv.id}`);
        if (spied > 0) revealed.push(tp(spied, '{rival} has run {n} espionage operation against our labs', '{rival} has run {n} espionage operations against our labs', { rival: rv.name }));
        return { ok: true, title: t('Assessment: {rival}', { rival: rv.name }), text: t('Analysts deliver a fresh assessment of {rival}.', { rival: rv.name }), revealed, newCards };
      },
    },
    {
      id: 'diplomatic_initiative',
      category: 'world',
      tab: 'world',
      name: t('Diplomatic initiative'),
      description: t('Talks on AI safety. Builds trust and moves the Global Accord forward.'),
      icon: 'diplomacy',
      cost: () => ({ capacity: 1, budget: 3 }),
      targets: (s) => rivalTargets(s),
      block: needRival,
      preview: (s, tg) => {
        const p = [pv('budget', -3), pv('rival', 6, findRival(s, tg)?.name), pv('tension', -4)];
        if (!s.accord.signed) p.push(pv('accord', accordGainFor(s)));
        return p;
      },
      perform: (s, tg) => {
        const rv = findRival(s, tg);
        if (!rv) return { ok: false, error: t('Choose a country'), title: '', text: '' };
        const why = t('Diplomatic initiative');
        changeRivalTrust(s, rv.id, 6, why);
        for (const o of s.rivals) if (o.id !== rv.id) changeRivalTrust(s, o.id, 2, why);
        changeResource(s, 'tension', -4, why);
        let text = t('Talks with {rival} make progress.', { rival: rv.name });
        if (!s.accord.signed) {
          changeResource(s, 'accord', accordGainFor(s), why);
          trigger(s, 'accord_progress');
        } else if (!rv.accordMember && rv.trust >= 40) {
          rv.accordMember = true;
          rv.defected = false;
          text = t('{rival} agrees to join the Global Accord.', { rival: rv.name });
        }
        bumpStat(s, 'diplomacy');
        return { ok: true, title: t('Diplomacy: {rival}', { rival: rv.name }), text };
      },
    },
    {
      id: 'research_partnership',
      category: 'world',
      tab: 'world',
      name: t('Research partnership'),
      description: t('Joint safety research with a trusted partner. Lasting safeguards boost; they gain too.'),
      icon: 'partnership',
      cost: () => ({ capacity: 1, budget: 3 }),
      targets: (s) => rivalTargets(s, (id) => partnershipBlock(s, id)),
      block: (s, tg) => needRival(s, tg) ?? partnershipBlock(s, tg ?? ''),
      preview: (s, tg) => {
        const p = [pv('budget', -3), pvDir('safeguards', 1), pv('rival', 5, findRival(s, tg)?.name)];
        if (s.government.stance === 'hawk') p.push(pvConf(s, -2));
        return p;
      },
      perform: (s, tg) => {
        const rv = findRival(s, tg);
        if (!rv) return { ok: false, error: t('Choose a country'), title: '', text: '' };
        rv.partnership = true;
        changeResource(s, 'safeguards', 0.3, t('Partnership with {rival}', { rival: rv.name }));
        changeRivalTrust(s, rv.id, 5, t('Research partnership'));
        changeCapability(s, { rivalId: rv.id }, 0.1, 'Research partnership');
        if (s.government.stance === 'hawk') changeMeter(s, 'confidence', -2, t('Sharing research with {rival}', { rival: rv.name }));
        addLog(s, t('Launched a research partnership with {rival}.', { rival: rv.name }), true, 'good', { rivalId: rv.id });
        return { ok: true, title: t('Partnership: {rival}', { rival: rv.name }), text: t('Joint safety labs open with {rival}.', { rival: rv.name }) };
      },
    },
    {
      id: 'export_controls',
      category: 'world',
      tab: 'world',
      name: t('Export controls'),
      description: t('Toggle chip export controls on all rivals: slows their progress, angers them, raises tension.'),
      icon: 'export',
      cost: () => CAP1,
      preview: (s) => {
        const conf = s.exportControls ? stanceConf(s, { hawk: -2 }) : stanceConf(s, { hawk: 2, accelerationist: -1 });
        const p = s.exportControls ? [pv('tension', -3), pv('rival', 4, t('All rivals'))] : [pv('tension', 6), pv('rival', -8, t('All rivals')), pvCap(-0.3, t('Rivals'))];
        if (conf) p.push(pvConf(s, conf));
        return p;
      },
      perform: (s) => {
        s.exportControls = !s.exportControls;
        for (const rv of s.rivals) {
          rv.exportControlled = s.exportControls;
          changeRivalTrust(s, rv.id, s.exportControls ? -8 : 4, s.exportControls ? t('Export controls imposed') : t('Export controls lifted'));
        }
        changeResource(s, 'tension', s.exportControls ? 6 : -3, s.exportControls ? t('Export controls imposed') : t('Export controls lifted'));
        const conf = s.exportControls ? stanceConf(s, { hawk: 2, accelerationist: -1 }) : stanceConf(s, { hawk: -2 });
        if (conf) changeMeter(s, 'confidence', conf, s.exportControls ? t('Export controls') : t('Lifted export controls'));
        addLog(s, s.exportControls ? t('Imposed chip export controls on all rivals.') : t('Lifted chip export controls.'), true, 'mixed');
        return { ok: true, title: t('Export controls'), text: s.exportControls ? t('Chip exports to rivals are now restricted.') : t('Export controls are lifted.') };
      },
    },
    {
      id: 'espionage',
      category: 'world',
      tab: 'world',
      name: t('Espionage'),
      description: t('Steal research and get a precise read on a rival. 30% chance of being caught.'),
      icon: 'espionage',
      cost: () => CAP1,
      targets: (s) => rivalTargets(s),
      block: needRival,
      preview: () => [pvCap(0.4, t('Our leading lab'))],
      perform: (s, tg) => {
        const rv = findRival(s, tg);
        if (!rv) return { ok: false, error: t('Choose a country'), title: '', text: '' };
        const r = rng(s);
        rv.intel = 1;
        rv.estimateBias = 0;
        const lead = leadingCompany(s);
        if (lead) changeCapability(s, { companyId: lead.id }, r.range(0.3, 0.5), 'Stolen research');
        bumpStat(s, 'espionage');
        const revealed = [
          t('{rival} true capability: {value}', { rival: rv.name, value: round1(rv.capability) }),
          t('{rival} safeguards: {value}', { rival: rv.name, value: round1(rv.safeguards) }),
        ];
        if (rv.defected) revealed.push(t('{rival} is cheating on the Accord', { rival: rv.name }));
        const title = t('Espionage: {rival}', { rival: rv.name });
        if (r.chance(0.3)) {
          changeRivalTrust(s, rv.id, -20, t('Espionage exposed'));
          changeResource(s, 'tension', 10, t('Espionage exposed'));
          if (s.government.stance !== 'hawk') changeMeter(s, 'confidence', -3, t('Espionage scandal'));
          trigger(s, 'espionage', { rivalId: rv.id });
          addLog(s, t('Our espionage against {rival} was exposed.', { rival: rv.name }), true, 'bad', { rivalId: rv.id });
          return { ok: true, success: true, title, text: t('We got what we came for — but our agents were exposed.'), revealed };
        }
        return { ok: true, success: true, title, text: t('A clean operation. Their secrets are now ours.'), revealed };
      },
    },
    {
      id: 'sabotage',
      category: 'world',
      tab: 'world',
      name: t('Cyber sabotage'),
      description: t("Set back a rival's AI program. 40% chance of discovery and a dangerous escalation."),
      icon: 'sabotage',
      cost: () => ({ capacity: 1, budget: 2 }),
      targets: (s) => rivalTargets(s),
      block: needRival,
      preview: (s, tg) => [pv('budget', -2), pvCap(-0.5, findRival(s, tg)?.name), pvDir('risk', 1)],
      perform: (s, tg) => {
        const rv = findRival(s, tg);
        if (!rv) return { ok: false, error: t('Choose a country'), title: '', text: '' };
        const r = rng(s);
        changeCapability(s, { rivalId: rv.id }, -r.range(0.4, 0.7), 'Sabotage');
        changeRisk(s, 1, 'Cyber sabotage', 'tension');
        bumpStat(s, 'sabotage');
        const title = t('Sabotage: {rival}', { rival: rv.name });
        if (r.chance(0.4)) {
          changeRivalTrust(s, rv.id, -30, t('Sabotage discovered'));
          changeResource(s, 'tension', 15, t('Sabotage discovered'));
          rv.aggression = clamp(rv.aggression + 0.1, 0, 1);
          addLog(s, fmt(tr("Sabotaged {rival}'s AI program — and got caught."), { rival: rv.name }), true, 'bad', { rivalId: rv.id });
          return { ok: true, success: true, title, text: t('The attack worked, but {rival} traced it back to us.', { rival: rv.name }) };
        }
        addLog(s, fmt(tr("Sabotaged {rival}'s AI program."), { rival: rv.name }), true, 'mixed', { rivalId: rv.id });
        return { ok: true, success: true, title, text: t('{lab} suffers a mysterious setback.', { lab: rv.leadLab }) };
      },
    },
    {
      id: 'talent_recruitment',
      category: 'world',
      tab: 'world',
      name: t('Talent recruitment'),
      description: t('Lure top researchers from a rival. Boosts our labs and safety science; they resent it.'),
      icon: 'recruit',
      cost: () => ({ capacity: 1, budget: 2 }),
      targets: (s) => rivalTargets(s),
      block: needRival,
      preview: (s, tg) => [pv('budget', -2), pvCap(0.15, t('Our leading lab')), pvDir('safeguards', 1), pv('rival', -5, findRival(s, tg)?.name)],
      perform: (s, tg) => {
        const rv = findRival(s, tg);
        if (!rv) return { ok: false, error: t('Choose a country'), title: '', text: '' };
        const lead = leadingCompany(s);
        if (lead) changeCapability(s, { companyId: lead.id }, 0.15, 'Recruited researchers');
        changeResource(s, 'safeguards', 0.15, t('Recruited safety researchers'));
        changeCapability(s, { rivalId: rv.id }, -0.1, 'Talent drain');
        changeRivalTrust(s, rv.id, -5, t('Talent poaching'));
        return { ok: true, title: t('Recruitment: {rival}', { rival: rv.name }), text: t('A dozen leading researchers from {rival} accept your offer.', { rival: rv.name }) };
      },
    },
  ];
}

/** Warning-sign headlines from the last three quarters (follow_signal targets). */
function recentSignals(s: GameState): NewsItem[] {
  return s.news.filter((n) => n.signal && n.id && n.turn >= s.turn - 3);
}

function followBlock(s: GameState, id: string | undefined): string | null {
  const n = id ? s.news.find((x) => x.id === id && x.signal) : undefined;
  if (!n) return t('Choose a warning sign');
  if (n.turn < s.turn - 3) return t('The trail has gone cold');
  if (s.flags[`followed:${n.id}`] !== undefined) return t('Already followed');
  const x = s.situations.find((sx) => sx.id === n.situationId);
  if (x?.detected && !x.resolved) return t('Already on the Threats board');
  return null;
}

/** Why a model cannot be restricted/suspended directly (null = it can). */
function revocable(s: GameState, id: string): string | null {
  const m = findModel(s, id);
  if (!m) return t('Choose a model');
  if (m.status === 'rogue_deployed' && !s.flags[`rogueKnown:${m.id}`]) return t('Not deployed');
  if (m.status === 'restricted') return null;
  if (m.status !== 'deployed' && m.status !== 'limited' && m.status !== 'rogue_deployed') return t('Not deployed');
  return null;
}

/** Briefings within the last 3 quarters (including this one). */
function recentBriefTurns(s: GameState): number[] {
  const raw = s.flags.briefTurns;
  const list = typeof raw === 'string' && raw ? raw.split(',').map(Number) : [];
  return list.filter((turn) => turn >= s.turn - 2);
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
  if (!rv) return t('Choose a country');
  if (rv.partnership) return t('Partnership already active');
  if (rv.trust < 50) return t('Requires trust ≥ 50');
  return null;
}

let cache: { lang: string; list: ActionDef[]; byId: Map<ActionId, ActionDef> } | null = null;

function actionDefs(): { list: ActionDef[]; byId: Map<ActionId, ActionDef> } {
  const lang = getLang();
  if (!cache || cache.lang !== lang) {
    const list = buildActions();
    cache = { lang, list, byId: new Map(list.map((a) => [a.id, a])) };
  }
  return cache;
}

function tabBlock(s: GameState, def: ActionDef): string | null {
  if (s.unlockedTabs.includes(def.tab)) return null;
  switch (def.tab) {
    case 'inbox':
      return t('Unlocks with the Inbox tab');
    case 'labs':
      return t('Unlocks with the Labs tab');
    case 'nation':
      return t('Unlocks with the Nation tab');
    case 'world':
      return t('Unlocks with the World tab');
    case 'threats':
      return t('Unlocks with the Threats tab');
  }
}

export function getActionViews(s: GameState): ActionView[] {
  return actionDefs().list.map((def) => {
    const cost = def.cost(s);
    const view: ActionView = {
      id: def.id,
      category: def.category,
      name: def.name,
      description: def.description,
      icon: def.icon,
      cost,
      disabled: s.gameOver ? t('Game over') : tabBlock(s, def) ?? costBlock(s, cost),
      preview: def.targets ? [] : def.preview(s),
    };
    if (def.targets) {
      // Actions with options are validated per option at perform time; targets only carry their own reason.
      view.targets = def.targets(s).map((tg) => ({ ...tg, disabled: tg.disabled ?? (def.options ? null : def.block?.(s, tg.id)) ?? costBlock(s, def.cost(s, tg.id)) }));
      if (!view.disabled && view.targets.length === 0) view.disabled = t('No valid targets');
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
  const def = actionDefs().byId.get(id);
  if (!def) return { ok: false, error: t('Unknown action'), title: '', text: '' };
  if (s.gameOver) return { ok: false, error: t('The game is over'), title: def.name, text: '' };
  const tb = tabBlock(s, def);
  if (tb) return { ok: false, error: tb, title: def.name, text: '' };
  if (def.targets && !targetId) return { ok: false, error: t('This action needs a target'), title: def.name, text: '' };
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

