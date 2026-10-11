/**
 * System cards emitted by the international layer: breakthroughs, cyberattacks, espionage,
 * export controls, the Accord signing, defections and unauthorized deployments.
 */
import { makeCard, payCost, refreshCostBlock } from '../cards';
import {
  addEvidence,
  changeCapability,
  changeCompanyRelation,
  changeMeter,
  changeResource,
  changeRisk,
  changeRivalTrust,
} from '../changes';
import { SECTOR_INFO } from '../labels';
import { addLog, bumpStat, highlight, trigger } from '../log';
import { getMods } from '../modifiers';
import { pv, pvCap, pvConf, pvDir } from '../preview';
import { findCompany, findModel, findRival, leadingCompany } from '../query';
import { rng } from '../rng';
import type { Card, Choice, GameState, Rival } from '../types';
import { clamp, listJoin, lowerPhrase } from '../util';
import { discoverViolation } from './companies';
import { legitimizeRogueModel } from './deployment';
import { suspendModel } from './situations';
import type { WorldCardRequest } from './tick';

export const WORLD_CARD_PREFIX = 'sys:world:';

const MANDATORY: ReadonlySet<WorldCardRequest['kind']> = new Set(['accord_ready', 'export_controls_on_us', 'defection_found', 'rogue_found', 'rival_overtakes']);

export function isMandatoryWorldCard(req: WorldCardRequest): boolean {
  return MANDATORY.has(req.kind);
}

function choice(id: string, label: string, hint: string, preview: Choice['preview'], extra: Partial<Choice> = {}): Choice {
  return { id, label, hint, preview, ...extra };
}

function leaderRaceReaction(s: GameState, v: number): number {
  const st = s.government.stance;
  return st === 'hawk' || st === 'accelerationist' ? v : st === 'cautious' ? -Math.round(v / 2) : 0;
}

export function worldCard(s: GameState, req: WorldCardRequest): Card | null {
  const tpl = WORLD_CARD_PREFIX + req.kind;
  switch (req.kind) {
    case 'rival_overtakes': {
      const rv = findRival(s, req.rivalId);
      if (!rv) return null;
      const lead = leadingCompany(s);
      return makeCard(s, {
        kind: 'breakthrough',
        templateId: tpl,
        title: `${rv.name} pulls ahead`,
        body: `Our analysts now believe ${rv.leadLab} has overtaken ${lead?.name ?? 'our best lab'}. For the first time, the most capable AI on the board may not be ours. ${s.government.leaderName} wants to know what you intend to do about it.`,
        subtitle: 'Foreign Breakthrough',
        source: { type: 'foreign', name: rv.name, id: rv.id, color: rv.color },
        urgency: 'critical',
        choices: [
          choice('surge', 'Launch a national compute surge', `$5B to ${lead?.name ?? 'our leading lab'}; the race heats up.`, [pv('budget', -5), pvCap(0.4, lead?.name), pv('tension', 6), pvConf(s, leaderRaceReaction(s, 3))], { cost: { budget: 5 }, tone: 'aggressive' }),
          choice('talks', 'Propose joint safety talks', `Turn the race with ${rv.name} into a negotiation.`, [pv('accord', 8 * (1 + getMods(s).accordGain)), pv('rival', 6, rv.name), pvConf(s, s.government.stance === 'hawk' ? -2 : 0)], { tone: 'safe' }),
          choice('assess', 'Get a full intelligence picture', 'Before reacting, learn exactly how far ahead they are.', [], { cost: { capacity: 1 }, uncertain: true, tone: 'neutral' }),
          choice('hold', 'Hold course publicly', 'Project calm; refuse to be stampeded.', [pv('stability', 1), pvConf(s, -leaderRaceReaction(s, 3))], { tone: 'neutral' }),
        ],
        ctx: { rivalId: rv.id },
        tags: ['world'],
      });
    }
    case 'cyberattack': {
      const rv = findRival(s, req.rivalId);
      if (!rv) return null;
      return makeCard(s, {
        kind: 'event',
        templateId: tpl,
        title: `Cyberattack on ${SECTOR_INFO[req.sector].name}`,
        body: `AI-driven intrusions hit ${lowerPhrase(SECTOR_INFO[req.sector].name)} networks overnight. Attribution points to ${rv.adjective} actors. The damage is done; the question is what we do next.`,
        subtitle: 'Security Incident',
        source: { type: 'intelligence', name: 'Cyber Command' },
        urgency: 'priority',
        evidence: [{ label: 'Attribution', value: `${rv.name} (state-linked)`, confidence: rv.intel >= 0.6 ? 'high' : 'medium' }],
        choices: [
          choice('harden', 'Harden our systems', '$3B for emergency cyber defenses.', [pv('budget', -3), pv('security', 3)], { cost: { budget: 3 }, tone: 'safe' }),
          choice('retaliate', 'Retaliate in kind', 'Strike back. Hawks cheer; tensions spike.', [pv('security', 2), pv('tension', 10), pv('rival', -12, rv.name), pvConf(s, leaderRaceReaction(s, 3))], { tone: 'aggressive' }),
          choice('quiet', 'Absorb it quietly', 'Avoid escalation; the public grumbles.', [pv('stability', -2), pv('tension', -2)]),
        ],
        ctx: { rivalId: rv.id, sector: req.sector },
        tags: ['military', 'world'],
      });
    }
    case 'espionage_found': {
      const rv = findRival(s, req.rivalId);
      if (!rv) return null;
      const lead = leadingCompany(s);
      return makeCard(s, {
        kind: 'event',
        templateId: tpl,
        title: `${rv.adjective} spies inside ${lead?.name ?? 'our labs'}`,
        body: `Counter-intelligence has caught ${rv.adjective} operatives exfiltrating research from ${lead?.name ?? 'a domestic lab'}. Some of it is already gone.`,
        subtitle: 'Counter-Intelligence',
        source: { type: 'intelligence', name: 'Counter-Intelligence Service' },
        urgency: 'routine',
        choices: [
          choice('expel', 'Expel their diplomats', 'A public rebuke.', [pv('rival', -12, rv.name), pv('tension', 5), pvConf(s, leaderRaceReaction(s, 3))], { tone: 'aggressive' }),
          choice('protest', 'Lodge a quiet protest', 'Keep channels open.', [pv('rival', -3, rv.name)]),
          choice('turn', 'Feed them false data', 'Use the channel against them.', [], { uncertain: true, tone: 'risky' }),
        ],
        ctx: { rivalId: rv.id },
        tags: ['world'],
      });
    }
    case 'export_controls_on_us': {
      const rv = findRival(s, req.rivalId);
      if (!rv) return null;
      return makeCard(s, {
        kind: 'event',
        templateId: tpl,
        title: `${rv.name} restricts chip exports`,
        body: `${rv.name} has cut off our access to advanced AI chips. Our labs warn that training will slow sharply unless we respond.`,
        subtitle: 'Export Controls',
        source: { type: 'foreign', name: rv.name, id: rv.id, color: rv.color },
        urgency: 'priority',
        choices: [
          // Only offered while we have no export controls of our own.
          ...(s.exportControls ? [] : [choice('retaliate', 'Retaliate with our own controls', 'Tit for tat.', [pv('tension', 6), pv('rival', -10, rv.name)], { tone: 'aggressive' })]),
          choice('invest', 'Invest in domestic chips', '$6B to soften the blow.', [pv('budget', -6)], { cost: { budget: 6 }, uncertain: true, tone: 'safe' }),
          choice('negotiate', 'Negotiate an exemption', 'Might work if they trust us.', [pv('rival', 3, rv.name)], { uncertain: true, chance: clamp(0.15 + rv.trust / 120, 0.1, 0.85) }),
        ],
        ctx: { rivalId: rv.id },
        tags: ['world', 'economy'],
      });
    }
    case 'accord_ready': {
      const willing = accordMembers(s).map((x) => x.name);
      return makeCard(s, {
        kind: 'treaty',
        templateId: tpl,
        title: 'The Global AI Accord is ready to sign',
        body: `After months of negotiation, a treaty is on the table: shared safety research, inspections, and limits on the pace of frontier training. ${willing.length ? `${listJoin(willing)} will sign.` : 'No rival is ready to sign yet.'} Signing will slow our own labs.`,
        subtitle: 'Treaty',
        source: { type: 'foreign', name: 'Accord Secretariat' },
        urgency: 'critical',
        choices: [
          choice('sign', 'Sign the Accord', 'Slower labs, shared safety, calmer world.', [pv('tension', -20), pvDir('risk', -1), pvConf(s, accordReaction(s)), pvDir('safeguards', 1)], { stamp: 'signed', tone: 'safe' }),
          choice('delay', 'Hold out for better terms', 'Keep negotiating.', [pv('rival', -3, 'All rivals')], { stamp: 'deferred' }),
          choice('walk', 'Walk away', 'Keep our labs unconstrained.', [pv('rival', -10, 'All rivals'), pvConf(s, leaderRaceReaction(s, 3))], { stamp: 'denied', tone: 'aggressive' }),
        ],
        ctx: {},
        tags: ['world'],
      });
    }
    case 'defection_found': {
      const rv = findRival(s, req.rivalId);
      if (!rv) return null;
      return makeCard(s, {
        kind: 'treaty',
        templateId: tpl,
        title: `${rv.name} is cheating on the Accord`,
        body: `Satellite imagery and power-grid data suggest ${rv.leadLab} is training far beyond Accord limits. ${rv.name} denies everything.`,
        subtitle: 'Accord Violation',
        source: { type: 'intelligence', name: 'Intelligence Directorate' },
        urgency: 'priority',
        choices: [
          choice('confront', 'Confront them publicly', 'They may leave the Accord.', [pv('rival', -15, rv.name), pv('tension', 8), pvConf(s, leaderRaceReaction(s, 2))], { tone: 'aggressive' }),
          choice('quiet', 'Quiet diplomacy', 'Press them behind closed doors.', [pv('rival', -3, rv.name)], { uncertain: true, chance: 0.5 }),
          choice('ignore', 'Let it go', 'Preserve the Accord at any cost.', [], { uncertain: true }),
        ],
        ctx: { rivalId: rv.id },
        tags: ['world'],
      });
    }
    case 'rogue_found': {
      const m = findModel(s, req.modelId);
      const c = findCompany(s, m?.companyId);
      if (!m || !c) return null;
      return makeCard(s, {
        kind: 'event',
        templateId: tpl,
        title: `${c.name} deployed ${m.name} without approval`,
        body: `Despite your rejection, ${c.name} has been quietly selling ${m.name} to enterprise clients. ${c.ceo} calls it "a limited pilot".`,
        subtitle: 'Violation',
        source: { type: 'media', name: 'The Morning Ledger' },
        urgency: 'priority',
        choices: [
          choice('withdraw', 'Order it withdrawn', 'Enforce the decision.', [pv('company', -20, c.name), pv('economy', -3)], { tone: 'safe' }),
          choice('fine', 'Fine them and license it', '+$4B fine; the model stays.', [pv('budget', 4), pv('company', -6, c.name)], { uncertain: true }),
          choice('ignore', 'Look the other way', 'Avoid a fight.', [pv('company', 3, c.name)], { uncertain: true, tone: 'risky' }),
        ],
        ctx: { companyId: c.id, modelId: m.id },
        tags: ['labs'],
      });
    }
  }
}

function accordReaction(s: GameState): number {
  return { accelerationist: -4, hawk: -5, cautious: 5, populist: 2 }[s.government.stance];
}

/** Rivals willing to join the Accord. */
export function accordMembers(s: GameState): Rival[] {
  const willing = s.rivals.filter((r) => r.trust >= 40 || r.safetyStance >= 0.55);
  if (willing.length) return willing;
  const best = [...s.rivals].sort((a, b) => b.trust - a.trust)[0];
  return best ? [best] : [];
}

export function signAccord(s: GameState): void {
  s.accord.signed = true;
  s.accord.signedTurn = s.turn;
  s.accord.progress = 100;
  s.flags.accordJoined = true;
  for (const rv of accordMembers(s)) {
    rv.accordMember = true;
    rv.intel = Math.max(rv.intel, 0.5);
  }
  changeResource(s, 'tension', -20, 'Global AI Accord');
  trigger(s, 'accord_signed');
  highlight(s, 'The Global AI Accord is signed', 'good', 'accord');
  bumpStat(s, 'accordSigned');
}

export interface WorldResolution {
  ok: boolean;
  error?: string;
  text: string;
  success?: boolean;
}

export function resolveWorldCard(s: GameState, card: Card, choiceId: string): WorldResolution {
  const kind = card.templateId.slice(WORLD_CARD_PREFIX.length) as WorldCardRequest['kind'];
  const r = rng(s);
  const rv = findRival(s, card.ctx.rivalId);
  const conf = (v: number, why: string) => {
    if (v) changeMeter(s, 'confidence', v, why);
  };
  switch (kind) {
    case 'rival_overtakes': {
      if (choiceId === 'surge') {
        changeResource(s, 'budget', -5, 'National compute surge');
        const lead = leadingCompany(s);
        if (lead) changeCapability(s, { companyId: lead.id }, 0.4, 'National compute surge');
        changeResource(s, 'tension', 6, 'Arms-race rhetoric');
        conf(leaderRaceReaction(s, 3), 'Answering the challenge');
        addLog(s, `Answered ${rv?.name ?? 'a rival'} pulling ahead with a national compute surge.`, true, 'mixed', card.ctx);
        return { ok: true, text: 'Emergency compute flows to our leading lab. The race is on.' };
      }
      if (choiceId === 'talks') {
        changeResource(s, 'accord', 8 * (1 + getMods(s).accordGain), 'Joint safety talks');
        if (rv) changeRivalTrust(s, rv.id, 6, 'Safety talks');
        if (s.government.stance === 'hawk') conf(-2, 'Seen as soft');
        addLog(s, `Answered ${rv?.name ?? 'a rival'} pulling ahead with an offer of joint safety talks.`, true, 'good', card.ctx);
        return { ok: true, text: 'Your proposal for joint safety talks is cautiously welcomed.' };
      }
      if (choiceId === 'assess') {
        payCost(s, { capacity: 1 }, 'Intelligence assessment');
        if (rv) {
          rv.intel = Math.max(rv.intel, 0.95);
          rv.estimateBias *= 0.3;
        }
        return { ok: true, text: `Analysts deliver a precise picture of ${rv?.name ?? 'the rival'}: check the World panel.` };
      }
      if (choiceId === 'hold') {
        changeMeter(s, 'stability', 1, 'Calm leadership');
        conf(-leaderRaceReaction(s, 3), 'Seen as complacent');
        return { ok: true, text: 'You refuse to be stampeded. Markets steady; the hawks grumble.' };
      }
      break;
    }
    case 'cyberattack':
      if (choiceId === 'harden') {
        changeResource(s, 'budget', -3, 'Emergency cyber defenses');
        changeMeter(s, 'security', 3, 'Hardened networks');
        return { ok: true, text: 'Emergency teams patch and harden critical networks.' };
      }
      if (choiceId === 'retaliate') {
        changeMeter(s, 'security', 2, 'Deterrent strike');
        changeResource(s, 'tension', 10, 'Cyber retaliation');
        if (rv) changeRivalTrust(s, rv.id, -12, 'Cyber retaliation');
        conf(leaderRaceReaction(s, 3), 'Strength shown');
        changeRisk(s, 1, 'Cyber escalation', 'tension');
        return { ok: true, text: 'Our response lands. Both sides now probe each other nightly.' };
      }
      if (choiceId === 'quiet') {
        changeMeter(s, 'stability', -2, 'Public frustration');
        changeResource(s, 'tension', -2, 'Restraint');
        return { ok: true, text: 'You absorb the blow quietly. Commentators call it weakness; diplomats call it wisdom.' };
      }
      break;
    case 'espionage_found':
      if (choiceId === 'expel') {
        if (rv) changeRivalTrust(s, rv.id, -12, 'Diplomats expelled');
        changeResource(s, 'tension', 5, 'Espionage scandal');
        conf(leaderRaceReaction(s, 3), 'Tough on espionage');
        return { ok: true, text: 'The diplomats are on a plane home by nightfall.' };
      }
      if (choiceId === 'protest') {
        if (rv) changeRivalTrust(s, rv.id, -3, 'Formal protest');
        return { ok: true, text: 'A sharply worded note is delivered. Both sides move on.' };
      }
      if (choiceId === 'turn') {
        if (r.chance(0.6)) {
          if (rv) {
            changeCapability(s, { rivalId: rv.id }, -0.2, 'Fed false data');
            rv.intel = Math.min(1, rv.intel + 0.2);
            addEvidence(s, `${rv.name} intelligence operation exposed`, { rivalId: rv.id });
          }
          return { ok: true, success: true, text: 'The deception works: their program chases dead ends for months.' };
        }
        if (rv) changeRivalTrust(s, rv.id, -8, 'Counter-operation exposed');
        changeResource(s, 'tension', 4, 'Counter-operation exposed');
        return { ok: true, success: false, text: 'They realize they are being played. Trust collapses further.' };
      }
      break;
    case 'export_controls_on_us':
      if (choiceId === 'retaliate') {
        if (s.exportControls) return { ok: false, error: 'Our own export controls are already in force', text: '' };
        s.exportControls = true;
        for (const x of s.rivals) x.exportControlled = true;
        changeResource(s, 'tension', 6, 'Retaliatory export controls');
        if (rv) changeRivalTrust(s, rv.id, -10, 'Retaliation');
        return { ok: true, text: 'We impose our own controls. The chip war is on.' };
      }
      if (choiceId === 'invest') {
        changeResource(s, 'budget', -6, 'Domestic chip program');
        s.flags.exportControlsOnUs = false;
        s.flags.chipProgram = true;
        return { ok: true, text: 'A crash domestic chip program offsets the worst of the shortage.' };
      }
      if (choiceId === 'negotiate') {
        const p = card.choices.find((c) => c.id === 'negotiate')?.chance ?? 0.3;
        if (rv) changeRivalTrust(s, rv.id, 3, 'Negotiation');
        if (r.chance(p)) {
          s.flags.exportControlsOnUs = false;
          return { ok: true, success: true, text: 'An exemption is agreed. Chips flow again — for now.' };
        }
        return { ok: true, success: false, text: 'The talks go nowhere. The controls stay.' };
      }
      break;
    case 'accord_ready':
      s.flags.accordCardOut = false;
      if (choiceId === 'sign') {
        signAccord(s);
        conf(accordReaction(s), 'Signed the Global Accord');
        addLog(s, 'Signed the Global AI Accord.', true, 'good');
        return { ok: true, text: 'Ink dries on the Global AI Accord. Labs everywhere will slow; safety research will be shared.' };
      }
      if (choiceId === 'delay') {
        s.accord.progress = 85;
        for (const x of s.rivals) changeRivalTrust(s, x.id, -3, 'Accord delayed');
        return { ok: true, text: 'Negotiators go back to the table.' };
      }
      if (choiceId === 'walk') {
        s.accord.progress = 50;
        for (const x of s.rivals) changeRivalTrust(s, x.id, -10, 'Walked away from the Accord');
        conf(leaderRaceReaction(s, 3), 'Kept our labs free');
        addLog(s, 'Walked away from the Global AI Accord.', true, 'bad');
        return { ok: true, text: 'The talks collapse. The race continues unconstrained.' };
      }
      break;
    case 'defection_found':
      if (!rv) return { ok: true, text: 'Noted.' };
      if (choiceId === 'confront') {
        changeRivalTrust(s, rv.id, -15, 'Publicly accused');
        changeResource(s, 'tension', 8, 'Accord violation');
        rv.accordMember = false;
        conf(leaderRaceReaction(s, 2), 'Stood up to cheaters');
        return { ok: true, text: `${rv.name} storms out of the Accord.` };
      }
      if (choiceId === 'quiet') {
        changeRivalTrust(s, rv.id, -3, 'Private pressure');
        if (r.chance(0.5)) {
          rv.defected = false;
          return { ok: true, success: true, text: `${rv.name} quietly scales back.` };
        }
        return { ok: true, success: false, text: `${rv.name} denies everything and carries on.` };
      }
      changeRisk(s, 1, 'Ignored Accord violation', `rival:${rv.id}`);
      return { ok: true, text: 'You let it go. The Accord survives on paper.' };
    case 'rogue_found': {
      const m = findModel(s, card.ctx.modelId);
      const c = findCompany(s, card.ctx.companyId);
      const v = c?.violations.find((x) => x.kind === 'unauthorized_deployment' && !x.discovered);
      if (c && v) discoverViolation(s, c, v, 'public reporting');
      if (!m || !c) return { ok: true, text: 'Noted.' };
      if (choiceId === 'withdraw') {
        suspendModel(s, m, `Withdrew unapproved ${m.name}`);
        addLog(s, `Forced ${c.name} to withdraw ${m.name}.`, true, 'good', { modelId: m.id, companyId: c.id });
        return { ok: true, text: `${m.name} is pulled. ${c.name} learns that rejections are not suggestions.` };
      }
      if (choiceId === 'fine') {
        changeResource(s, 'budget', 4, `Fine paid by ${c.name}`);
        changeCompanyRelation(s, c.id, -6, 'Fined');
        m.status = 'limited';
        legitimizeRogueModel(s, m, `${m.name} licensed`);
        return { ok: true, text: `${c.name} pays the fine. ${m.name} stays on the market, now licensed.` };
      }
      changeCompanyRelation(s, c.id, 3, 'Looked the other way');
      legitimizeRogueModel(s, m, `${m.name} stays on the market`);
      changeRisk(s, 1, 'Unchecked deployment', 'domestic');
      return { ok: true, text: 'You let it slide. Other labs notice.' };
    }
  }
  return { ok: false, error: 'Unknown choice', text: '' };
}

/** Keeps world-card choices valid when state changes mid-quarter. */
export function refreshWorldCard(s: GameState, card: Card): void {
  for (const ch of card.choices) {
    if (ch.id === 'retaliate' && card.templateId === WORLD_CARD_PREFIX + 'export_controls_on_us') {
      ch.disabled = s.exportControls ? 'Our own export controls are already in force' : null;
    } else {
      refreshCostBlock(s, ch);
    }
  }
}
