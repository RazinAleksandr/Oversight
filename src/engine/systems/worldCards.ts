/**
 * System cards emitted by the international layer: breakthroughs, cyberattacks, espionage,
 * export controls, the Accord signing, defections and unauthorized deployments.
 */
import { listJoinL, t, tr } from '../../i18n';
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
import { fmt } from '../template';
import type { Card, Choice, GameState, Rival } from '../types';
import { clamp, midPhrase } from '../util';
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
        title: t('{rival} pulls ahead', { rival: rv.name }),
        body: t('Our analysts now believe {lab} has overtaken {company}. For the first time, the most capable AI on the board may not be ours. {leader} wants to know what you intend to do about it.', {
          lab: rv.leadLab,
          company: lead?.name ?? t('our best lab'),
          leader: s.government.leaderName,
        }),
        subtitle: t('Foreign Breakthrough'),
        source: { type: 'foreign', name: rv.name, id: rv.id, color: rv.color },
        urgency: 'critical',
        choices: [
          choice(
            'surge',
            t('Launch a national compute surge'),
            t('$5B to {company}; the race heats up.', { company: lead?.name ?? t('our leading lab') }),
            [pv('budget', -5), pvCap(0.4, lead?.name), pv('tension', 6), pvConf(s, leaderRaceReaction(s, 3))],
            { cost: { budget: 5 }, tone: 'aggressive' },
          ),
          choice(
            'talks',
            t('Propose joint safety talks'),
            t('Turn the race with {rival} into a negotiation.', { rival: rv.name }),
            [pv('accord', 8 * (1 + getMods(s).accordGain)), pv('rival', 6, rv.name), pvConf(s, s.government.stance === 'hawk' ? -2 : 0)],
            { tone: 'safe' },
          ),
          choice('assess', t('Get a full intelligence picture'), t('Before reacting, learn exactly how far ahead they are.'), [], { cost: { capacity: 1 }, uncertain: true, tone: 'neutral' }),
          choice('hold', t('Hold course publicly'), t('Project calm; refuse to be stampeded.'), [pv('stability', 1), pvConf(s, -leaderRaceReaction(s, 3))], { tone: 'neutral' }),
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
        title: t('Cyberattack on {sector}', { sector: SECTOR_INFO[req.sector].name }),
        body: t('AI-driven intrusions hit {sector} networks overnight. Attribution points to {rivalAdj} actors. The damage is done; the question is what we do next.', {
          sector: midPhrase(SECTOR_INFO[req.sector].name),
          rivalAdj: rv.adjective,
        }),
        subtitle: t('Security Incident'),
        source: { type: 'intelligence', name: t('Cyber Command') },
        urgency: 'priority',
        evidence: [{ label: t('Attribution'), value: t('{rival} (state-linked)', { rival: rv.name }), confidence: rv.intel >= 0.6 ? 'high' : 'medium' }],
        choices: [
          choice('harden', t('Harden our systems'), t('$3B for emergency cyber defenses.'), [pv('budget', -3), pv('security', 3)], { cost: { budget: 3 }, tone: 'safe' }),
          choice('retaliate', t('Retaliate in kind'), t('Strike back. Hawks cheer; tensions spike.'), [pv('security', 2), pv('tension', 10), pv('rival', -12, rv.name), pvConf(s, leaderRaceReaction(s, 3))], {
            tone: 'aggressive',
          }),
          choice('quiet', t('Absorb it quietly'), t('Avoid escalation; the public grumbles.'), [pv('stability', -2), pv('tension', -2)]),
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
        title: lead ? t('{rivalAdj} spies inside {company}', { rivalAdj: rv.adjective, company: lead.name }) : t('{rivalAdj} spies inside our labs', { rivalAdj: rv.adjective }),
        body: t('Counter-intelligence has caught {rivalAdj} operatives exfiltrating research from {company}. Some of it is already gone.', {
          rivalAdj: rv.adjective,
          company: lead?.name ?? t('a domestic lab'),
        }),
        subtitle: t('Counter-Intelligence'),
        source: { type: 'intelligence', name: t('Counter-Intelligence Service') },
        urgency: 'routine',
        choices: [
          choice('expel', t('Expel their diplomats'), t('A public rebuke.'), [pv('rival', -12, rv.name), pv('tension', 5), pvConf(s, leaderRaceReaction(s, 3))], { tone: 'aggressive' }),
          choice('protest', t('Lodge a quiet protest'), t('Keep channels open.'), [pv('rival', -3, rv.name)]),
          choice('turn', t('Feed them false data'), t('Use the channel against them.'), [], { uncertain: true, tone: 'risky' }),
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
        title: t('{rival} restricts chip exports', { rival: rv.name }),
        body: t('{rival} has cut off our access to advanced AI chips. Our labs warn that training will slow sharply unless we respond.', { rival: rv.name }),
        subtitle: t('Export Controls'),
        source: { type: 'foreign', name: rv.name, id: rv.id, color: rv.color },
        urgency: 'priority',
        choices: [
          // Only offered while we have no export controls of our own.
          ...(s.exportControls ? [] : [choice('retaliate', t('Retaliate with our own controls'), t('Tit for tat.'), [pv('tension', 6), pv('rival', -10, rv.name)], { tone: 'aggressive' })]),
          choice('invest', t('Invest in domestic chips'), t('$6B to soften the blow.'), [pv('budget', -6)], { cost: { budget: 6 }, uncertain: true, tone: 'safe' }),
          choice('negotiate', t('Negotiate an exemption'), t('Might work if they trust us.'), [pv('rival', 3, rv.name)], { uncertain: true, chance: clamp(0.15 + rv.trust / 120, 0.1, 0.85) }),
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
        title: t('The Global AI Accord is ready to sign'),
        body: willing.length
          ? t('After months of negotiation, a treaty is on the table: shared safety research, inspections, and limits on the pace of frontier training. {members} will sign. Signing will slow our own labs.', {
              members: listJoinL(willing),
            })
          : t('After months of negotiation, a treaty is on the table: shared safety research, inspections, and limits on the pace of frontier training. No rival is ready to sign yet. Signing will slow our own labs.'),
        subtitle: t('Treaty'),
        source: { type: 'foreign', name: t('Accord Secretariat') },
        urgency: 'critical',
        choices: [
          choice('sign', t('Sign the Accord'), t('Slower labs, shared safety, calmer world.'), [pv('tension', -20), pvDir('risk', -1), pvConf(s, accordReaction(s)), pvDir('safeguards', 1)], {
            stamp: 'signed',
            tone: 'safe',
          }),
          choice('delay', t('Hold out for better terms'), t('Keep negotiating.'), [pv('rival', -3, t('All rivals'))], { stamp: 'deferred' }),
          choice('walk', t('Walk away'), t('Keep our labs unconstrained.'), [pv('rival', -10, t('All rivals')), pvConf(s, leaderRaceReaction(s, 3))], { stamp: 'denied', tone: 'aggressive' }),
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
        title: t('{rival} is cheating on the Accord', { rival: rv.name }),
        body: t('Satellite imagery and power-grid data suggest {lab} is training far beyond Accord limits. {rival} denies everything.', { lab: rv.leadLab, rival: rv.name }),
        subtitle: t('Accord Violation'),
        source: { type: 'intelligence', name: t('Intelligence Directorate') },
        urgency: 'priority',
        choices: [
          choice('confront', t('Confront them publicly'), t('They may leave the Accord.'), [pv('rival', -15, rv.name), pv('tension', 8), pvConf(s, leaderRaceReaction(s, 2))], { tone: 'aggressive' }),
          choice('quiet', t('Quiet diplomacy'), t('Press them behind closed doors.'), [pv('rival', -3, rv.name)], { uncertain: true, chance: 0.5 }),
          choice('ignore', t('Let it go'), t('Preserve the Accord at any cost.'), [], { uncertain: true }),
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
        title: t('{company} deployed {model} without approval', { company: c.name, model: m.name }),
        // fmt: a translated CEO name may start in lowercase and is capitalized at a sentence start.
        body: fmt(tr('Despite your rejection, {company} has been quietly selling {model} to enterprise clients. {ceo} calls it "a limited pilot".'), { company: c.name, model: m.name, ceo: c.ceo }),
        subtitle: t('Violation'),
        source: { type: 'media', name: t('The Morning Ledger') },
        urgency: 'priority',
        choices: [
          choice('withdraw', t('Order it withdrawn'), t('Enforce the decision.'), [pv('company', -20, c.name), pv('economy', -3)], { tone: 'safe' }),
          choice('fine', t('Fine them and license it'), t('+$4B fine; the model stays.'), [pv('budget', 4), pv('company', -6, c.name)], { uncertain: true }),
          choice('ignore', t('Look the other way'), t('Avoid a fight.'), [pv('company', 3, c.name)], { uncertain: true, tone: 'risky' }),
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
  changeResource(s, 'tension', -20, t('Global AI Accord'));
  trigger(s, 'accord_signed');
  highlight(s, t('The Global AI Accord is signed'), 'good', 'accord');
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
        changeResource(s, 'budget', -5, t('National compute surge'));
        const lead = leadingCompany(s);
        if (lead) changeCapability(s, { companyId: lead.id }, 0.4, 'National compute surge');
        changeResource(s, 'tension', 6, t('Arms-race rhetoric'));
        conf(leaderRaceReaction(s, 3), t('Answering the challenge'));
        addLog(s, t('Answered {rival} pulling ahead with a national compute surge.', { rival: rv?.name ?? t('a rival') }), true, 'mixed', card.ctx);
        return { ok: true, text: t('Emergency compute flows to our leading lab. The race is on.') };
      }
      if (choiceId === 'talks') {
        changeResource(s, 'accord', 8 * (1 + getMods(s).accordGain), t('Joint safety talks'));
        if (rv) changeRivalTrust(s, rv.id, 6, t('Safety talks'));
        if (s.government.stance === 'hawk') conf(-2, t('Seen as soft'));
        addLog(s, t('Answered {rival} pulling ahead with an offer of joint safety talks.', { rival: rv?.name ?? t('a rival') }), true, 'good', card.ctx);
        return { ok: true, text: t('Your proposal for joint safety talks is cautiously welcomed.') };
      }
      if (choiceId === 'assess') {
        payCost(s, { capacity: 1 }, t('Intelligence assessment'));
        if (rv) {
          rv.intel = Math.max(rv.intel, 0.95);
          rv.estimateBias *= 0.3;
        }
        return { ok: true, text: t('Analysts deliver a precise picture of {rival}: check the World panel.', { rival: rv?.name ?? t('the rival') }) };
      }
      if (choiceId === 'hold') {
        changeMeter(s, 'stability', 1, t('Calm leadership'));
        conf(-leaderRaceReaction(s, 3), t('Seen as complacent'));
        return { ok: true, text: t('You refuse to be stampeded. Markets steady; the hawks grumble.') };
      }
      break;
    }
    case 'cyberattack':
      if (choiceId === 'harden') {
        changeResource(s, 'budget', -3, t('Emergency cyber defenses'));
        changeMeter(s, 'security', 3, t('Hardened networks'));
        return { ok: true, text: t('Emergency teams patch and harden critical networks.') };
      }
      if (choiceId === 'retaliate') {
        changeMeter(s, 'security', 2, t('Deterrent strike'));
        changeResource(s, 'tension', 10, t('Cyber retaliation'));
        if (rv) changeRivalTrust(s, rv.id, -12, t('Cyber retaliation'));
        conf(leaderRaceReaction(s, 3), t('Strength shown'));
        changeRisk(s, 1, 'Cyber escalation', 'tension');
        return { ok: true, text: t('Our response lands. Both sides now probe each other nightly.') };
      }
      if (choiceId === 'quiet') {
        changeMeter(s, 'stability', -2, t('Public frustration'));
        changeResource(s, 'tension', -2, t('Restraint'));
        return { ok: true, text: t('You absorb the blow quietly. Commentators call it weakness; diplomats call it wisdom.') };
      }
      break;
    case 'espionage_found':
      if (choiceId === 'expel') {
        if (rv) changeRivalTrust(s, rv.id, -12, t('Diplomats expelled'));
        changeResource(s, 'tension', 5, t('Espionage scandal'));
        conf(leaderRaceReaction(s, 3), t('Tough on espionage'));
        return { ok: true, text: t('The diplomats are on a plane home by nightfall.') };
      }
      if (choiceId === 'protest') {
        if (rv) changeRivalTrust(s, rv.id, -3, t('Formal protest'));
        return { ok: true, text: t('A sharply worded note is delivered. Both sides move on.') };
      }
      if (choiceId === 'turn') {
        if (r.chance(0.6)) {
          if (rv) {
            changeCapability(s, { rivalId: rv.id }, -0.2, 'Fed false data');
            rv.intel = Math.min(1, rv.intel + 0.2);
            addEvidence(s, t('{rival} intelligence operation exposed', { rival: rv.name }), { rivalId: rv.id });
          }
          return { ok: true, success: true, text: t('The deception works: their program chases dead ends for months.') };
        }
        if (rv) changeRivalTrust(s, rv.id, -8, t('Counter-operation exposed'));
        changeResource(s, 'tension', 4, t('Counter-operation exposed'));
        return { ok: true, success: false, text: t('They realize they are being played. Trust collapses further.') };
      }
      break;
    case 'export_controls_on_us':
      if (choiceId === 'retaliate') {
        if (s.exportControls) return { ok: false, error: t('Our own export controls are already in force'), text: '' };
        s.exportControls = true;
        for (const x of s.rivals) x.exportControlled = true;
        changeResource(s, 'tension', 6, t('Retaliatory export controls'));
        if (rv) changeRivalTrust(s, rv.id, -10, t('Retaliation'));
        return { ok: true, text: t('We impose our own controls. The chip war is on.') };
      }
      if (choiceId === 'invest') {
        changeResource(s, 'budget', -6, t('Domestic chip program'));
        s.flags.exportControlsOnUs = false;
        s.flags.chipProgram = true;
        return { ok: true, text: t('A crash domestic chip program offsets the worst of the shortage.') };
      }
      if (choiceId === 'negotiate') {
        const p = card.choices.find((c) => c.id === 'negotiate')?.chance ?? 0.3;
        if (rv) changeRivalTrust(s, rv.id, 3, t('Negotiation'));
        if (r.chance(p)) {
          s.flags.exportControlsOnUs = false;
          return { ok: true, success: true, text: t('An exemption is agreed. Chips flow again — for now.') };
        }
        return { ok: true, success: false, text: t('The talks go nowhere. The controls stay.') };
      }
      break;
    case 'accord_ready':
      s.flags.accordCardOut = false;
      if (choiceId === 'sign') {
        signAccord(s);
        conf(accordReaction(s), t('Signed the Global Accord'));
        addLog(s, t('Signed the Global AI Accord.'), true, 'good', undefined, { en: 'accord' });
        return { ok: true, text: t('Ink dries on the Global AI Accord. Labs everywhere will slow; safety research will be shared.') };
      }
      if (choiceId === 'delay') {
        s.accord.progress = 85;
        for (const x of s.rivals) changeRivalTrust(s, x.id, -3, t('Accord delayed'));
        return { ok: true, text: t('Negotiators go back to the table.') };
      }
      if (choiceId === 'walk') {
        s.accord.progress = 50;
        for (const x of s.rivals) changeRivalTrust(s, x.id, -10, t('Walked away from the Accord'));
        conf(leaderRaceReaction(s, 3), t('Kept our labs free'));
        addLog(s, t('Walked away from the Global AI Accord.'), true, 'bad', undefined, { en: 'accord' });
        return { ok: true, text: t('The talks collapse. The race continues unconstrained.') };
      }
      break;
    case 'defection_found':
      if (!rv) return { ok: true, text: t('Noted.') };
      if (choiceId === 'confront') {
        changeRivalTrust(s, rv.id, -15, t('Publicly accused'));
        changeResource(s, 'tension', 8, t('Accord violation'));
        rv.accordMember = false;
        conf(leaderRaceReaction(s, 2), t('Stood up to cheaters'));
        return { ok: true, text: t('{rival} storms out of the Accord.', { rival: rv.name }) };
      }
      if (choiceId === 'quiet') {
        changeRivalTrust(s, rv.id, -3, t('Private pressure'));
        if (r.chance(0.5)) {
          rv.defected = false;
          return { ok: true, success: true, text: t('{rival} quietly scales back.', { rival: rv.name }) };
        }
        return { ok: true, success: false, text: t('{rival} denies everything and carries on.', { rival: rv.name }) };
      }
      changeRisk(s, 1, 'Ignored Accord violation', `rival:${rv.id}`);
      return { ok: true, text: t('You let it go. The Accord survives on paper.') };
    case 'rogue_found': {
      const m = findModel(s, card.ctx.modelId);
      const c = findCompany(s, card.ctx.companyId);
      const v = c?.violations.find((x) => x.kind === 'unauthorized_deployment' && !x.discovered);
      if (c && v) discoverViolation(s, c, v, t('public reporting'));
      if (!m || !c) return { ok: true, text: t('Noted.') };
      const p = { model: m.name, company: c.name };
      if (choiceId === 'withdraw') {
        suspendModel(s, m, t('Withdrew unapproved {model}', p));
        addLog(s, t('Forced {company} to withdraw {model}.', p), true, 'good', { modelId: m.id, companyId: c.id });
        return { ok: true, text: t('{model} is pulled. {company} learns that rejections are not suggestions.', p) };
      }
      if (choiceId === 'fine') {
        changeResource(s, 'budget', 4, t('Fine paid by {company}', p));
        changeCompanyRelation(s, c.id, -6, t('Fined'));
        m.status = 'limited';
        legitimizeRogueModel(s, m, t('{model} licensed', p));
        return { ok: true, text: t('{company} pays the fine. {model} stays on the market, now licensed.', p) };
      }
      changeCompanyRelation(s, c.id, 3, t('Looked the other way'));
      legitimizeRogueModel(s, m, t('{model} stays on the market', p));
      changeRisk(s, 1, 'Unchecked deployment', 'domestic');
      return { ok: true, text: t('You let it slide. Other labs notice.') };
    }
  }
  return { ok: false, error: t('Unknown choice'), text: '' };
}

/** Keeps world-card choices valid when state changes mid-quarter. */
export function refreshWorldCard(s: GameState, card: Card): void {
  for (const ch of card.choices) {
    if (ch.id === 'retaliate' && card.templateId === WORLD_CARD_PREFIX + 'export_controls_on_us') {
      ch.disabled = s.exportControls ? t('Our own export controls are already in force') : null;
    } else {
      refreshCostBlock(s, ch);
    }
  }
}
