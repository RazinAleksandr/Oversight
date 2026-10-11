/**
 * Advisor notes (GDD §11). Each advisor has a deliberate bias; all numbers come from fogged
 * estimates, never hidden truth.
 */
import { listJoinL, t, tr } from '../i18n';
import { getFlawFlavor, getStanceText } from './content';
import { PRIORITY_LABELS, STANCE_WEIGHTS, stanceOnDeployment, type Priority } from './data/stances';
import { bestRivalEstimate, companyCapEstimate, confidenceWord, domesticCapEstimate, modelCapEstimate, rivalCapEstimate } from './fog';
import { SECTOR_INFO } from './labels';
import type { AIModel, AdvisorId, AdvisorNote, Confidence, Demand, EventContext, GameState, SectorId, Situation } from './types';
import { midPhrase, round1 } from './util';

function note(advisor: AdvisorId, text: string): AdvisorNote {
  return { advisor, text };
}

export function topPriority(s: GameState): Priority {
  const w = STANCE_WEIGHTS[s.government.stance];
  return (Object.keys(w) as Priority[]).sort((a, b) => w[b] - w[a])[0];
}

function chiefOfStaffLine(s: GameState): string {
  const conf = Math.round(s.meters.confidence);
  const priority = midPhrase(PRIORITY_LABELS[topPriority(s)]);
  const p = { conf, leaderTitle: s.government.leaderTitle, priority };
  if (conf >= 60) return t('Confidence is at {conf}; we have room to manoeuvre. The {leaderTitle} cares most about {priority}.', p);
  if (conf >= 35) return t('Confidence is at {conf}; we should pick our fights. The {leaderTitle} cares most about {priority}.', p);
  return t('Confidence is at {conf}; our position is fragile. The {leaderTitle} cares most about {priority}.', p);
}

function intelligenceLine(s: GameState): string {
  const { rival, est } = bestRivalEstimate(s);
  const dom = domesticCapEstimate(s).est;
  if (!rival || !est) return t('Foreign programs are quiet for now.');
  const diff = round1(est.value - dom.value);
  const p = { rival: rival.name, low: est.low, high: est.high, diff: Math.abs(diff), tension: Math.round(s.tension) };
  if (diff > 0.3) return t('{rival} is estimated at {low}–{high} — about {diff} ahead of our best lab. Race tension stands at {tension}.', p);
  if (diff < -0.3) return t('{rival} is estimated at {low}–{high} — about {diff} behind us. Race tension stands at {tension}.', p);
  return t('{rival} is estimated at {low}–{high} — neck and neck with us. Race tension stands at {tension}.', p);
}

function scientistGapLine(s: GameState, c: number): string {
  const gap = round1(c - s.safeguards);
  const p = { cap: round1(c), safeguards: round1(s.safeguards) };
  if (gap > 2) return t('At ~{cap} against safeguards of {safeguards}, we are deploying far beyond what we can reliably control.', p);
  if (gap > 0.8) return t('Capability ~{cap} versus safeguards {safeguards}: the gap is real and growing.', p);
  return t('Our safeguards ({safeguards}) are roughly keeping pace with this system (~{cap}).', p);
}

export function deploymentNotes(
  s: GameState,
  model: AIModel,
  info: { gains: Partial<Record<SectorId, number>>; detected: boolean; suspected: boolean; confidence: Confidence },
): AdvisorNote[] {
  const notes: AdvisorNote[] = [];
  const cap = modelCapEstimate(s, model).value;
  let sci: string;
  if (info.detected && model.flaw) {
    sci = t('These are real findings: {flaw}. Approving {model} means knowingly deploying the problem.', { flaw: midPhrase(getFlawFlavor(model.flaw).name), model: model.name });
  } else if (info.suspected) {
    sci = t('An inconclusive warning at {confidence} confidence. It might be noise — or the first sign of something. A deep evaluation would tell us more.', { confidence: confidenceWord(info.confidence) });
  } else if (info.confidence === 'low') {
    sci = t('"No issues found" at low confidence means very little. {gap}', { gap: scientistGapLine(s, cap) });
  } else {
    sci = t('Our testing was reasonably thorough. {gap}', { gap: scientistGapLine(s, cap) });
  }
  notes.push(note('scientist', sci));

  const sectors = Object.keys(info.gains) as SectorId[];
  const total = Math.round(sectors.reduce((t, k) => t + (info.gains[k] ?? 0), 0));
  const defense = model.sectors.includes('defense');
  if (defense) {
    notes.push(note('intelligence', t('{intel} Deploying {model} in defense would strengthen our hand.', { intel: intelligenceLine(s), model: model.name })));
  } else if (s.meters.confidence < 40) {
    const stance = stanceOnDeployment(s.government.stance, defense, model.sectors.includes('business'));
    notes.push(note('chief_of_staff', t('The {leaderTitle} {stance}. {chief}', { leaderTitle: s.government.leaderTitle, stance: tr(stance.line), chief: chiefOfStaffLine(s) })));
  } else {
    const prosperity = sectors.reduce((t, k) => t + (info.gains[k] ?? 0) * (k === 'business' ? 0.03 : k === 'infrastructure' ? 0.02 : 0.01), 0) * (0.6 + cap / 10);
    notes.push(
      note(
        'economist',
        t('Approval adds about +{total} adoption across {sectors} — roughly +{prosperity} Prosperity per quarter once it ramps up. Restrictions leave that on the table.', {
          total,
          sectors: listJoinL(sectors.map((k) => SECTOR_INFO[k].name)),
          prosperity: round1(prosperity),
        }),
      ),
    );
  }
  return notes;
}

export function demandNotes(s: GameState, d: Demand, refuseCost: number): AdvisorNote[] {
  const notes: AdvisorNote[] = [
    note(
      'chief_of_staff',
      t('The {leaderTitle} expects this. Refusing outright costs about {refuse} confidence; a broken promise costs {penalty}. {chief}', {
        leaderTitle: s.government.leaderTitle,
        refuse: Math.round(refuseCost),
        penalty: d.penalty,
        chief: chiefOfStaffLine(s),
      }),
    ),
  ];
  switch (d.kind) {
    case 'growth_target':
    case 'budget_cut':
      notes.push(note('economist', t('Prosperity is {economy} and the treasury holds ${budget}B. Hitting the target means more deployment, not less.', { economy: Math.round(s.meters.economy), budget: Math.round(s.budget) })));
      break;
    case 'deploy_sector':
    case 'approve_model':
      notes.push(note('scientist', t('Promising deployments before we have evaluated them ties our hands. {gap}', { gap: scientistGapLine(s, domesticCapEstimate(s).est.value) })));
      break;
    case 'match_rival':
    case 'defense_program':
      notes.push(note('intelligence', intelligenceLine(s)));
      break;
    case 'jobs_guarantee':
      notes.push(note('economist', t('Job displacement is {value}. Workforce programs and slower business adoption are the levers.', { value: Math.round(s.displacement) })));
      break;
    case 'cover_up':
      notes.push(note('scientist', t('Burying a problem does not make it smaller. If this escalates, the cover-up becomes the story.')));
      break;
  }
  return notes;
}

export function situationNotes(s: GameState, x: Situation): AdvisorNote[] {
  const notes: AdvisorNote[] = [];
  if (!x.causeKnown) {
    notes.push(note('scientist', t('We do not know what is driving this yet. An investigation would identify the source and let us act precisely.')));
  } else if (x.stage >= 2) {
    notes.push(note('scientist', t('We know the source. Every quarter we wait, the problem grows — restriction slows it, suspension stops it.')));
  } else {
    notes.push(note('scientist', t('It is still early. Acting now is cheap; acting later will not be.')));
  }
  if (x.type === 'military_escalation' || x.type === 'foreign_spillover') {
    notes.push(note('intelligence', intelligenceLine(s)));
  } else {
    const dep = Math.round(0.35 * s.adoption.infrastructure + 0.3 * s.adoption.public + 0.25 * s.adoption.business + 0.1 * s.adoption.defense);
    notes.push(
      note(
        'economist',
        dep > 40
          ? t('AI dependence is at {dep}. Pulling systems now will hurt — a lot.', { dep })
          : t('AI dependence is at {dep}. Pulling systems now will hurt, but less than it will later.', { dep }),
      ),
    );
  }
  return notes;
}

/**
 * Engine notes for scripted events: only when they are about something the card is bound to
 * (a rival, a lab or model, or a detected situation). Otherwise the card carries no generic stat lines.
 */
export function eventNotes(s: GameState, tags: string[] | undefined, ctx: EventContext): AdvisorNote[] {
  const tagSet = new Set(tags ?? []);
  if (ctx.rival && (tagSet.has('world') || tagSet.has('military'))) {
    const est = rivalCapEstimate(ctx.rival);
    return [
      note(
        'intelligence',
        t('Our estimate puts {rival} at {low}–{high}. Trust between us stands at {trust}; race tension at {tension}.', {
          rival: ctx.rival.name,
          low: est.low,
          high: est.high,
          trust: Math.round(ctx.rival.trust),
          tension: Math.round(s.tension),
        }),
      ),
    ];
  }
  if (ctx.model || ctx.company) {
    const cap = ctx.model ? modelCapEstimate(s, ctx.model).value : ctx.company ? companyCapEstimate(ctx.company).value : 0;
    return [note('scientist', `${ctx.model ? ctx.model.name : ctx.company?.name}: ${scientistGapLine(s, cap)}`)];
  }
  if (ctx.situation?.detected && !ctx.situation.resolved) return situationNotes(s, ctx.situation).slice(0, 1);
  return [];
}

export function thresholdNotes(s: GameState, low: number, high: number): AdvisorNote[] {
  return [
    note('scientist', t('My honest estimate of keeping control: {low}–{high}%. Everything we did over the past years comes down to this.', { low, high })),
    note('chief_of_staff', t('The {leaderTitle} ({stance}) will back whatever we decide — this time.', { leaderTitle: s.government.leaderTitle, stance: getStanceText(s.government.stance).label })),
  ];
}
