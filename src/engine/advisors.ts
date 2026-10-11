/**
 * Advisor notes (GDD §11). Each advisor has a deliberate bias; all numbers come from fogged
 * estimates, never hidden truth.
 */
import { getFlawFlavor, getStanceText } from './content';
import { PRIORITY_LABELS, STANCE_WEIGHTS, stanceOnDeployment, type Priority } from './data/stances';
import { bestRivalEstimate, companyCapEstimate, domesticCapEstimate, modelCapEstimate, rivalCapEstimate } from './fog';
import { SECTOR_INFO } from './labels';
import type { AIModel, AdvisorId, AdvisorNote, Confidence, Demand, EventContext, GameState, SectorId, Situation } from './types';
import { listJoin, lowerPhrase, round1 } from './util';

function note(advisor: AdvisorId, text: string): AdvisorNote {
  return { advisor, text };
}

export function topPriority(s: GameState): Priority {
  const w = STANCE_WEIGHTS[s.government.stance];
  return (Object.keys(w) as Priority[]).sort((a, b) => w[b] - w[a])[0];
}

function chiefOfStaffLine(s: GameState): string {
  const conf = Math.round(s.meters.confidence);
  const mood = conf >= 60 ? 'we have room to manoeuvre' : conf >= 35 ? 'we should pick our fights' : 'our position is fragile';
  return `Confidence is at ${conf}; ${mood}. The ${s.government.leaderTitle} cares most about ${lowerPhrase(PRIORITY_LABELS[topPriority(s)])}.`;
}

function intelligenceLine(s: GameState): string {
  const { rival, est } = bestRivalEstimate(s);
  const dom = domesticCapEstimate(s).est;
  if (!rival || !est) return 'Foreign programs are quiet for now.';
  const diff = round1(est.value - dom.value);
  const pos = diff > 0.3 ? `about ${diff} ahead of our best lab` : diff < -0.3 ? `about ${Math.abs(diff)} behind us` : 'neck and neck with us';
  return `${rival.name} is estimated at ${est.low}–${est.high} — ${pos}. Race tension stands at ${Math.round(s.tension)}.`;
}

function scientistGapLine(s: GameState, c: number): string {
  const gap = round1(c - s.safeguards);
  if (gap > 2) return `At ~${round1(c)} against safeguards of ${round1(s.safeguards)}, we are deploying far beyond what we can reliably control.`;
  if (gap > 0.8) return `Capability ~${round1(c)} versus safeguards ${round1(s.safeguards)}: the gap is real and growing.`;
  return `Our safeguards (${round1(s.safeguards)}) are roughly keeping pace with this system (~${round1(c)}).`;
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
    sci = `These are real findings: ${lowerPhrase(getFlawFlavor(model.flaw).name)}. Approving ${model.name} means knowingly deploying the problem.`;
  } else if (info.suspected) {
    sci = `An inconclusive warning at ${info.confidence} confidence. It might be noise — or the first sign of something. A deep evaluation would tell us more.`;
  } else if (info.confidence === 'low') {
    sci = `"No issues found" at low confidence means very little. ${scientistGapLine(s, cap)}`;
  } else {
    sci = `Our testing was reasonably thorough. ${scientistGapLine(s, cap)}`;
  }
  notes.push(note('scientist', sci));

  const sectors = Object.keys(info.gains) as SectorId[];
  const total = Math.round(sectors.reduce((t, k) => t + (info.gains[k] ?? 0), 0));
  const defense = model.sectors.includes('defense');
  if (defense) {
    notes.push(note('intelligence', `${intelligenceLine(s)} Deploying ${model.name} in defense would strengthen our hand.`));
  } else if (s.meters.confidence < 40) {
    const stance = stanceOnDeployment(s.government.stance, defense, model.sectors.includes('business'));
    notes.push(note('chief_of_staff', `The ${s.government.leaderTitle} ${stance.line}. ${chiefOfStaffLine(s)}`));
  } else {
    const prosperity = sectors.reduce((t, k) => t + (info.gains[k] ?? 0) * (k === 'business' ? 0.03 : k === 'infrastructure' ? 0.02 : 0.01), 0) * (0.6 + cap / 10);
    notes.push(
      note(
        'economist',
        `Approval adds about +${total} adoption across ${listJoin(sectors.map((k) => SECTOR_INFO[k].name))} — roughly +${round1(prosperity)} Prosperity per quarter once it ramps up. Restrictions leave that on the table.`,
      ),
    );
  }
  return notes;
}

export function demandNotes(s: GameState, d: Demand, refuseCost: number): AdvisorNote[] {
  const notes: AdvisorNote[] = [
    note('chief_of_staff', `The ${s.government.leaderTitle} expects this. Refusing outright costs about ${Math.round(refuseCost)} confidence; a broken promise costs ${d.penalty}. ${chiefOfStaffLine(s)}`),
  ];
  switch (d.kind) {
    case 'growth_target':
    case 'budget_cut':
      notes.push(note('economist', `Prosperity is ${Math.round(s.meters.economy)} and the treasury holds $${Math.round(s.budget)}B. Hitting the target means more deployment, not less.`));
      break;
    case 'deploy_sector':
    case 'approve_model':
      notes.push(note('scientist', `Promising deployments before we have evaluated them ties our hands. ${scientistGapLine(s, domesticCapEstimate(s).est.value)}`));
      break;
    case 'match_rival':
    case 'defense_program':
      notes.push(note('intelligence', intelligenceLine(s)));
      break;
    case 'jobs_guarantee':
      notes.push(note('economist', `Job displacement is ${Math.round(s.displacement)}. Workforce programs and slower business adoption are the levers.`));
      break;
    case 'cover_up':
      notes.push(note('scientist', 'Burying a problem does not make it smaller. If this escalates, the cover-up becomes the story.'));
      break;
  }
  return notes;
}

export function situationNotes(s: GameState, x: Situation): AdvisorNote[] {
  const notes: AdvisorNote[] = [];
  if (!x.causeKnown) {
    notes.push(note('scientist', 'We do not know what is driving this yet. An investigation would identify the source and let us act precisely.'));
  } else if (x.stage >= 2) {
    notes.push(note('scientist', 'We know the source. Every quarter we wait, the problem grows — restriction slows it, suspension stops it.'));
  } else {
    notes.push(note('scientist', 'It is still early. Acting now is cheap; acting later will not be.'));
  }
  if (x.type === 'military_escalation' || x.type === 'foreign_spillover') {
    notes.push(note('intelligence', intelligenceLine(s)));
  } else {
    const dep = Math.round(0.35 * s.adoption.infrastructure + 0.3 * s.adoption.public + 0.25 * s.adoption.business + 0.1 * s.adoption.defense);
    notes.push(note('economist', `AI dependence is at ${dep}. Pulling systems now will hurt${dep > 40 ? ' — a lot' : ', but less than it will later'}.`));
  }
  return notes;
}

/**
 * Engine notes for scripted events: only when they are about something the card is bound to
 * (a rival, a lab or model, or a detected situation). Otherwise the card carries no generic stat lines.
 */
export function eventNotes(s: GameState, tags: string[] | undefined, ctx: EventContext): AdvisorNote[] {
  const t = new Set(tags ?? []);
  if (ctx.rival && (t.has('world') || t.has('military'))) {
    const est = rivalCapEstimate(ctx.rival);
    return [note('intelligence', `Our estimate puts ${ctx.rival.name} at ${est.low}–${est.high}. Trust between us stands at ${Math.round(ctx.rival.trust)}; race tension at ${Math.round(s.tension)}.`)];
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
    note('scientist', `My honest estimate of keeping control: ${low}–${high}%. Everything we did over the past years comes down to this.`),
    note('chief_of_staff', `The ${s.government.leaderTitle} (${getStanceText(s.government.stance).label}) will back whatever we decide — this time.`),
  ];
}
