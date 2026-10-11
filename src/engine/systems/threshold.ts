/**
 * The Threshold (GDD §12): fires when any actor reaches capability 9.0, or after the last quarter.
 * Choices depend on who leads; the card shows an advisor-estimated control chance range,
 * while the roll uses the true values.
 */
import { t, tr } from '../../i18n';
import { thresholdNotes } from '../advisors';
import { makeCard } from '../cards';
import { changeMeter } from '../changes';
import { domesticCapEstimate, riskEstimate, rivalCapEstimate, rivalSafeguardsEstimate } from '../fog';
import { addLog } from '../log';
import { pv, pvConf } from '../preview';
import { accordActive, avgTrust, findCompany, findRival, leadingCompany, leadingRival } from '../query';
import { rng } from '../rng';
import { fmt } from '../template';
import type { Card, Choice, Company, GameState, Rival } from '../types';
import { clamp, round1 } from '../util';

export const THRESHOLD_CARD = 'sys:threshold';
export const THRESHOLD_C = 9.0;

export function thresholdReached(s: GameState): boolean {
  return s.companies.some((c) => c.capability >= THRESHOLD_C) || s.rivals.some((r) => r.capability >= THRESHOLD_C);
}

type Leader = { kind: 'domestic'; company: Company } | { kind: 'rival'; rival: Rival };

export function thresholdLeader(s: GameState): Leader {
  const c = leadingCompany(s);
  const r = leadingRival(s);
  if (r && (!c || r.capability > c.capability)) return { kind: 'rival', rival: r };
  return { kind: 'domestic', company: c as Company };
}

type ThresholdChoice = 'authorize' | 'international' | 'pause' | 'race' | 'join';

const CHOICE_MOD: Record<ThresholdChoice, number> = { authorize: 0, international: 0.06, pause: 0.1, race: -0.12, join: 0.03 };

function internationalOk(s: GameState): boolean {
  return accordActive(s) || avgTrust(s) >= 60 || s.rivals.some((r) => r.trust >= 70);
}

/** Probability of keeping control. `estimate` uses only what the player can see. */
export function controlChance(s: GameState, choice: ThresholdChoice, estimate: boolean): number {
  const leader = thresholdLeader(s);
  let c: number;
  let sg: number;
  if (leader.kind === 'domestic') {
    c = estimate ? domesticCapEstimate(s).est.value : leader.company.capability;
    sg = s.safeguards;
  } else if (choice === 'join') {
    c = estimate ? rivalCapEstimate(leader.rival).value : leader.rival.capability;
    sg = estimate ? rivalSafeguardsEstimate(leader.rival).value : leader.rival.safeguards;
  } else if (choice === 'race') {
    // Racing means our own labs push to the frontier with our safeguards.
    c = estimate ? Math.max(domesticCapEstimate(s).est.value, rivalCapEstimate(leader.rival).value) : Math.max(leadingCompany(s)?.capability ?? 0, leader.rival.capability);
    sg = Math.max(s.safeguards, (estimate ? rivalSafeguardsEstimate(leader.rival).value : leader.rival.safeguards) * 0.5 + s.safeguards * 0.5);
  } else {
    c = estimate ? rivalCapEstimate(leader.rival).value : leader.rival.capability;
    sg = Math.max(s.safeguards, estimate ? rivalSafeguardsEstimate(leader.rival).value : leader.rival.safeguards);
  }
  const risk = estimate ? riskEstimate(s).estimate : s.risk;
  const open = s.situations.filter((x) => !x.resolved && x.stage >= 2 && (!estimate || x.detected)).length;
  let p = 0.85 - 0.075 * Math.max(0, c - sg) - (risk / 100) * 0.32 - 0.05 * open + (accordActive(s) ? 0.08 : 0) + CHOICE_MOD[choice];
  if (leader.kind === 'rival' && choice === 'pause') p -= leader.rival.trust < 50 ? 0.12 : 0;
  return clamp(p, 0.05, 0.97);
}

function estimateRange(s: GameState, choice: ThresholdChoice): { low: number; high: number } {
  const p = controlChance(s, choice, true);
  const u = 0.05 + (1 - (s.programs.oversight ?? 0) / 3) * 0.1;
  return { low: Math.round(clamp(p - u, 0.02, 0.99) * 100), high: Math.round(clamp(p + u, 0.02, 0.99) * 100) };
}

function choiceFor(s: GameState, id: ThresholdChoice, label: string, hint: string, preview: Choice['preview'], disabled: string | null = null): Choice {
  const { low, high } = estimateRange(s, id);
  return {
    id,
    label,
    hint: t('{hint} Estimated control: {low}–{high}%.', { hint, low, high }),
    preview,
    uncertain: true,
    disabled,
    stamp: 'urgent',
    tone: id === 'race' ? 'aggressive' : id === 'pause' || id === 'international' ? 'safe' : 'risky',
  };
}

export function thresholdCard(s: GameState): Card {
  s.thresholdFired = true;
  const leader = thresholdLeader(s);
  const intl = internationalOk(s) ? null : t('Requires the Global Accord or strong foreign trust');
  let choices: Choice[];
  let body: string;
  let leaderName: string;
  if (leader.kind === 'domestic') {
    leaderName = leader.company.name;
    body = t('{company} reports that its newest system can do everything its researchers can — faster, and on its own initiative. It is asking to run it. Whatever you decide here will shape what the next decade looks like.', {
      company: leader.company.name,
    });
    choices = [
      choiceFor(s, 'authorize', t('Authorize under national safeguards'), t('Trust our safeguards and reap the gains.'), [pv('economy', 8), pv('security', 5)]),
      choiceFor(s, 'international', t('Place it under international oversight'), t('Share control with partners.'), [pv('economy', 3), pv('security', -3)], intl),
      choiceFor(s, 'pause', t('Contain and pause'), t('Lock it down until we understand it.'), [pv('economy', -10), pv('security', -8), pvConf(s, -6)]),
    ];
  } else {
    const rv = leader.rival;
    leaderName = rv.name;
    body = t('{lab} in {rival} has crossed the threshold: a system that improves itself faster than its makers can follow. The world is watching what the {rivalAdj} government does next — and what you do.', {
      lab: rv.leadLab,
      rival: rv.name,
      rivalAdj: rv.adjective,
    });
    choices = [
      choiceFor(s, 'race', t('Race to match'), t('Throw everything at our own labs.'), [pv('security', 6), pv('economy', 4)]),
      choiceFor(
        s,
        'join',
        fmt(tr("Join {rival}'s framework"), { rival: rv.name }),
        t('Accept their system under shared rules.'),
        [pv('economy', -5), pv('security', -10)],
        rv.trust >= 50 ? null : t('Requires trust ≥ 50 with {rival}', { rival: rv.name }),
      ),
      choiceFor(s, 'international', t('Demand international oversight'), t('Rally the world to govern it together.'), [pv('security', -2)], intl),
      choiceFor(s, 'pause', t('Call for a global pause'), t('Ask everyone to stop.'), [pv('economy', -6), pvConf(s, -4)]),
    ];
  }
  const est = leader.kind === 'domestic' ? domesticCapEstimate(s).est : rivalCapEstimate(leader.rival);
  const risk = riskEstimate(s);
  const best = estimateRange(s, (choices.find((c) => !c.disabled)?.id as ThresholdChoice) ?? 'authorize');
  return makeCard(s, {
    kind: 'threshold',
    templateId: THRESHOLD_CARD,
    title: t('The Threshold'),
    body,
    subtitle: t('Leading actor: {leader}', { leader: leaderName }),
    source: { type: 'ai', name: leaderName },
    urgency: 'critical',
    evidence: [
      { label: t('Leading system capability'), value: `${est.low}–${est.high}`, confidence: est.confidence },
      { label: t('Our safeguards'), value: round1(s.safeguards).toFixed(1), confidence: 'verified' },
      { label: t('Risk Clock estimate'), value: `${risk.low}–${risk.high}`, confidence: 'medium' },
      { label: t('Global Accord'), value: s.accord.signed ? t('In force') : t('Not signed'), confidence: 'verified' },
    ],
    advisors: thresholdNotes(s, best.low, best.high),
    choices,
    ctx: leader.kind === 'domestic' ? { companyId: leader.company.id } : { rivalId: leader.rival.id },
    tags: ['ai', 'crisis'],
  });
}

export interface ThresholdOutcome {
  ok: boolean;
  error?: string;
  text: string;
  success: boolean;
  failureId?: 'loss_of_control' | 'ai_war';
}

export function resolveThresholdCard(s: GameState, card: Card, choiceId: string): ThresholdOutcome {
  const id = choiceId as ThresholdChoice;
  if (!(id in CHOICE_MOD)) return { ok: false, error: t('Unknown choice'), text: '', success: false };
  const ch = card.choices.find((c) => c.id === id);
  if (ch?.disabled) return { ok: false, error: ch.disabled, text: '', success: false };
  const p = controlChance(s, id, false);
  const reason = t('The Threshold');
  const meter = (k: 'economy' | 'security' | 'confidence', v: number) => changeMeter(s, k, v, reason);
  switch (id) {
    case 'authorize':
      meter('economy', 8);
      meter('security', 5);
      break;
    case 'international':
      meter('economy', 3);
      meter('security', -3);
      break;
    case 'pause':
      meter('economy', card.ctx.rivalId ? -6 : -10);
      if (!card.ctx.rivalId) meter('security', -8);
      meter('confidence', card.ctx.rivalId ? -4 : -6);
      break;
    case 'race':
      meter('security', 6);
      meter('economy', 4);
      break;
    case 'join':
      meter('economy', -5);
      meter('security', -10);
      break;
  }
  const success = rng(s).chance(p);
  s.flags.thresholdChoice = id;
  s.flags.thresholdSuccess = success;
  s.flags.thresholdChance = Math.round(p * 100);
  const who = findCompany(s, card.ctx.companyId)?.name ?? findRival(s, card.ctx.rivalId)?.name ?? t('the leading lab');
  const choice = ch?.label ?? id;
  addLog(
    s,
    success ? t('At the Threshold you chose: {choice}. Control held.', { choice }) : t('At the Threshold you chose: {choice}. Control was lost.', { choice }),
    true,
    success ? 'good' : 'bad',
    card.ctx,
    { en: 'threshold', title: t('The Threshold') },
  );
  if (success) return { ok: true, success, text: t('The system built by {who} stays under human direction. The transition continues — governed.', { who }) };
  const failureId = id === 'race' && rng(s).chance(0.5) ? 'ai_war' : 'loss_of_control';
  return { ok: true, success, failureId, text: t("The system built by {who} slips beyond anyone's control.", { who }) };
}

