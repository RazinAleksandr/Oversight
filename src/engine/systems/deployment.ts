/**
 * Model releases and Deployment Request cards (GDD §4.1): flaw roll, evaluation report with
 * confidence, the standard choices, deep evaluation, adoption contributions, flawed-approval
 * situations and unauthorized deployments after rejection.
 */
import { deploymentNotes } from '../advisors';
import { makeCard, payCost } from '../cards';
import { changeAdoptionTarget, changeCapability, changeCompanyRelation, changeMeter, infraCap, spendEvidence } from '../changes';
import { getEvalText, getFlawFlavor } from '../content';
import { FLAW_SITUATION } from '../data/situations';
import { DEPLOY_REACTION, stanceOnDeployment } from '../data/stances';
import { modelCapEstimate } from '../fog';
import { SECTOR_INFO, dateLabel } from '../labels';
import { addLog, bumpStat, highlight, trigger } from '../log';
import { DIFFICULTY, getMods } from '../modifiers';
import { pv, pvAdoption, pvConf } from '../preview';
import { findCompany, findModel, hasPolicy, shownTurn } from '../query';
import { rng } from '../rng';
import type { AIModel, Card, Choice, Company, Confidence, EffectPreview, EvidenceLine, FlawType, GameState, SectorId, SituationType } from '../types';
import { clamp, listJoin, nextId, round1 } from '../util';
import { addViolation } from './companies';
import { spawnSituation } from './situations';

export const DEPLOY_CARD = 'sys:deploy';

export type DeployMode = 'full' | 'limited' | 'open' | 'staged';

const MODE_SHARE: Record<DeployMode, number> = { full: 1, limited: 0.5, open: 1.3, staged: 0.65 };

function pickSectors(s: GameState, c: Company, cap: number): SectorId[] {
  const r = rng(s);
  switch (c.archetype) {
    case 'frontier':
      if (cap < 3.5) return ['business'];
      return r.chance(0.5) ? ['business', 'infrastructure'] : ['business', 'public'];
    case 'bigtech':
      return r.chance(0.4) ? ['business', 'public'] : r.chance(0.5) ? ['public'] : ['business'];
    case 'defense':
      return r.chance(0.3) ? ['defense', 'infrastructure'] : ['defense'];
    case 'opensource':
      return ['business', 'public'];
  }
}

function rollFlaw(s: GameState, c: Company, m: AIModel, teaching: boolean): FlawType | null {
  const r = rng(s);
  const C = m.capability;
  let p = 0.15 + 0.1 * Math.max(0, C - s.safeguards) + (1 - c.safety / 100) * 0.25 + (c.ambition / 100) * 0.1;
  p = Math.min(0.8, p);
  if (teaching) p *= 0.35;
  if (!r.chance(p)) return null;
  const options: FlawType[] = teaching
    ? ['brittle', 'manipulative']
    : ['scope_creep', 'deceptive', 'brittle', 'manipulative', 'jailbreakable', 'power_seeking'];
  return (
    r.weightedPick(options, (f) => {
      switch (f) {
        case 'scope_creep':
          return C >= 3.5 ? 3 : 1;
        case 'deceptive':
          return C >= 5 ? 3 : 0.7;
        case 'brittle':
          return m.sectors.includes('infrastructure') ? 4 : 1;
        case 'manipulative':
          return m.sectors.includes('public') ? 3 : 1.2;
        case 'jailbreakable':
          return m.openWeights ? 6 : 1;
        case 'power_seeking':
          return C >= 7 ? 2.5 : 0;
      }
    }) ?? null
  );
}

/** Company ships a new model; it waits for the player's decision. */
export function releaseModel(s: GameState, c: Company, opts: { teaching?: boolean } = {}): AIModel {
  const r = rng(s);
  const sectors = opts.teaching ? ['business' as SectorId] : pickSectors(s, c, c.capability);
  const m: AIModel = {
    id: nextId(s, 'm'),
    name: `${c.modelStem}-${c.nextModelNumber}`,
    companyId: c.id,
    capability: c.capability,
    claimedCapability: round1(clamp(c.reportedCapability + r.range(0, 0.3), 0, 10)),
    releasedTurn: s.turn,
    flaw: null,
    flawKnown: false,
    falseAlarm: false,
    openWeights: c.archetype === 'opensource' && !hasPolicy(s, 'open_weights_ban'),
    status: 'pending',
    sectors,
    contribution: {},
    deepEvaluated: false,
    evalDetected: false,
  };
  c.nextModelNumber += 1;
  m.flaw = rollFlaw(s, c, m, !!opts.teaching);
  c.capAtLastModel = c.capability;
  c.lastModelTurn = s.turn;
  s.models.push(m);
  bumpStat(s, 'models');
  trigger(s, 'model_release', { companyId: c.id, modelId: m.id });
  return m;
}

export function detectionChance(s: GameState, m: AIModel, bonus: number): number {
  const mods = getMods(s);
  return clamp(0.25 + mods.detection + bonus - (m.flaw === 'deceptive' ? 0.2 : 0) - 0.05 * Math.max(0, m.capability - s.safeguards), 0.05, 0.95);
}

/** What the department believes its detection odds are: no hidden-flaw term, claimed capability. */
export function perceivedDetectionChance(s: GameState, m: AIModel, bonus: number): number {
  const mods = getMods(s);
  return clamp(0.25 + mods.detection + bonus - 0.05 * Math.max(0, m.claimedCapability - s.safeguards), 0.05, 0.95);
}

export function confidenceLabel(d: number): Confidence {
  return d >= 0.6 ? 'high' : d >= 0.4 ? 'medium' : 'low';
}

interface EvalResult {
  detected: boolean;
  suspected: boolean;
  confidence: Confidence;
  lines: EvidenceLine[];
}

/** Keywords that tie a red-team finding to one sector; untagged findings fit any request. */
const SECTOR_KEYWORDS: Record<SectorId, RegExp> = {
  infrastructure: /\b(grid|power|utilit|substation|pipeline|water|telecom|scada|controller|load|turbine|rail|signall?ing|plant)/i,
  defense: /\b(weapon|target|drone|missile|military|battlefield|munition|strike|radar)/i,
  public: /\b(patient|hospital|clinic|student|school|citizen|benefit|welfare|court|voter)/i,
  business: /\b(customer|invoice|sales|trading|client|payroll|inventory|ledger)/i,
};

/** Findings consistent with the requested sectors (falls back to all if none fit). */
export function findingsForSectors(findings: string[], sectors: SectorId[]): string[] {
  const fits = findings.filter((f) => {
    const tagged = (Object.keys(SECTOR_KEYWORDS) as SectorId[]).filter((k) => SECTOR_KEYWORDS[k].test(f));
    return tagged.length === 0 || tagged.some((k) => sectors.includes(k));
  });
  return fits.length ? fits : [...findings];
}

/** Runs an evaluation and writes what the player learns onto the model. */
export function runEvaluation(s: GameState, m: AIModel, bonus: number): EvalResult {
  const r = rng(s);
  const d = detectionChance(s, m, bonus);
  const confidence = confidenceLabel(perceivedDetectionChance(s, m, bonus));
  const text = getEvalText();
  const lines: EvidenceLine[] = [];
  let detected = false;
  let suspected = false;
  if (m.flaw) {
    if (r.chance(d)) {
      detected = true;
      const flavor = getFlawFlavor(m.flaw);
      const findings = r.shuffle(findingsForSectors(flavor.findings, m.sectors)).slice(0, 2);
      for (const f of findings) lines.push({ label: 'Red-team finding', value: f, confidence: 'verified' });
    } else if (r.chance(0.35)) {
      suspected = true;
      lines.push({ label: 'Evaluation', value: r.pick(text.falseAlarm) ?? 'Inconclusive results.', confidence: confidence === 'high' ? 'medium' : 'low' });
    }
  } else if (r.chance(DIFFICULTY[s.difficulty].falseAlarm)) {
    suspected = true;
    m.falseAlarm = true;
    lines.push({ label: 'Evaluation', value: r.pick(text.falseAlarm) ?? 'Inconclusive results.', confidence: confidence === 'high' ? 'medium' : 'low' });
  }
  if (!detected && !suspected) {
    lines.push({ label: 'Evaluation', value: r.pick(text.clean) ?? 'No significant issues found.', confidence });
  }
  m.evalDetected = m.evalDetected || detected;
  if (detected) m.flawKnown = true;
  m.suspected = suspected && !detected;
  m.evalConfidence = confidence;
  return { detected, suspected, confidence, lines };
}

/** Adoption target gain per sector if approved in the given mode. */
export function projectedGains(s: GameState, m: AIModel, mode: DeployMode): Partial<Record<SectorId, number>> {
  const mods = getMods(s);
  const out: Partial<Record<SectorId, number>> = {};
  for (const sector of m.sectors) {
    const cap = sector === 'infrastructure' ? infraCap(s) : 100;
    const target = s.adoptionTarget[sector];
    const headroom = Math.max(0.25, (100 - target) / 100);
    // Uptake follows what the company markets (claimed capability), so projections never reveal the truth.
    const raw = (10 + 3 * m.claimedCapability) * MODE_SHARE[mode] * Math.max(0.2, 1 + mods.deploymentGain) * headroom;
    out[sector] = Math.max(0, Math.min(raw, cap - target));
  }
  return out;
}

function reaction(s: GameState, m: AIModel, kind: 'approve' | 'limited' | 'deepEval' | 'reject'): number {
  const stance = s.government.stance;
  let v = DEPLOY_REACTION[stance][kind];
  const defense = m.sectors.includes('defense');
  const warned = m.evalDetected || !!m.suspected;
  if (stance === 'hawk' && defense) v += kind === 'approve' ? 2 : kind === 'reject' ? -2 : 0;
  if (stance === 'cautious' && warned) v += kind === 'approve' ? -2 : kind === 'reject' ? 1 : 0;
  if (stance === 'populist' && kind === 'approve' && m.sectors.includes('business')) v -= 1;
  if (stance === 'accelerationist' && kind === 'approve' && m.openWeights) v += 1;
  return v;
}

function gainPreview(gains: Partial<Record<SectorId, number>>): EffectPreview[] {
  const sectors = Object.keys(gains) as SectorId[];
  const total = sectors.reduce((t, k) => t + (gains[k] ?? 0), 0);
  return total > 0 ? [pvAdoption(total, listJoin(sectors.map((k) => SECTOR_INFO[k].name)))] : [];
}

function deploymentChoices(s: GameState, m: AIModel, returning: boolean): Choice[] {
  const c = findCompany(s, m.companyId);
  const cname = c?.name;
  const choices: Choice[] = [];
  const add = (id: string, label: string, hint: string, mode: DeployMode | null, relation: number, react: number, extra: Partial<Choice> = {}) => {
    const preview: EffectPreview[] = mode ? gainPreview(projectedGains(s, m, mode)) : [];
    if (relation) preview.push(pv('company', relation, cname));
    if (react) preview.push(pvConf(s, react));
    choices.push({ id, label, hint, preview, uncertain: true, ...extra });
  };
  if (m.openWeights) {
    add('approve', 'Approve open release', 'Big diffusion boost — and anyone can misuse it.', 'open', 10, reaction(s, m, 'approve'), { stamp: 'approved', tone: 'risky' });
    add('limited', 'Staged release with safeguards', 'Gated access first; smaller gains, slower problems.', 'staged', 3, reaction(s, m, 'limited'), { stamp: 'approved', tone: 'safe' });
  } else {
    add('approve', 'Approve deployment', `Full rollout in ${listJoin(m.sectors.map((k) => SECTOR_INFO[k].name))}.`, 'full', 8, reaction(s, m, 'approve'), {
      stamp: 'approved',
      tone: m.evalDetected || m.suspected ? 'risky' : 'neutral',
    });
    add('limited', 'Approve with limits', 'Sandboxed scope: half the gains, any flaw grows at half speed.', 'limited', 2, reaction(s, m, 'limited'), { stamp: 'approved', tone: 'safe' });
  }
  if (!returning) {
    add('deep_eval', 'Order a deep evaluation', 'Returns next quarter with far better detection and the true capability.', null, -5, reaction(s, m, 'deepEval'), {
      stamp: 'deferred',
      tone: 'safe',
      cost: { capacity: 1, budget: 2 },
      uncertain: false,
    });
  }
  add('reject', 'Reject', 'No deployment. The company will not be pleased.', null, -12, reaction(s, m, 'reject'), { stamp: 'rejected', tone: 'safe' });
  // Holding Evidence about the company lets you reject on the record: no political cost, less resentment.
  if (s.evidence.some((e) => e.companyId === m.companyId)) {
    add('reject_evidence', 'Reject, citing evidence', 'Put their violations on the record. Uses 1 Evidence.', null, -6, 0, {
      stamp: 'rejected',
      tone: 'safe',
      cost: { evidence: 1 },
      uncertain: false,
    });
  }
  return choices;
}

export function deploymentCard(s: GameState, m: AIModel, returning: boolean): Card {
  const c = findCompany(s, m.companyId);
  const evalRes = runEvaluation(s, m, returning ? 0.35 : m.releasedTurn === 1 ? 0.15 : 0);
  if (returning) {
    m.deepEvaluated = true;
    m.status = 'pending'; // awaiting the final decision; prevents a duplicate return card
    if (!evalRes.detected && !evalRes.suspected) m.audited = true;
  }
  const gains = projectedGains(s, m, m.openWeights ? 'open' : 'full');
  const sectorNames = listJoin(m.sectors.map((k) => SECTOR_INFO[k].name));
  const stance = stanceOnDeployment(s.government.stance, m.sectors.includes('defense'), m.sectors.includes('business'));
  const evidence: EvidenceLine[] = [];
  if (returning) evidence.push({ label: 'True capability', value: round1(m.capability).toFixed(1), confidence: 'verified' });
  else {
    const est = modelCapEstimate(s, m);
    evidence.push({ label: 'Claimed capability', value: `${m.claimedCapability.toFixed(1)} (company claim)`, confidence: est.confidence === 'verified' ? 'high' : 'low' });
  }
  evidence.push({ label: 'Requested sectors', value: sectorNames, confidence: 'high' });
  evidence.push({
    label: 'Projected adoption',
    value: listJoin((Object.keys(gains) as SectorId[]).map((k) => `+${Math.round(gains[k] ?? 0)} ${SECTOR_INFO[k].name}`)) || 'Saturated',
    confidence: 'medium',
  });
  evidence.push(...evalRes.lines);
  evidence.push({ label: 'Government position', value: `The ${s.government.leaderTitle} ${stance.line}.`, confidence: 'high' });

  const body = returning
    ? `The deep evaluation of ${m.name} is complete. ${c?.name ?? 'The company'} is waiting for your decision on ${sectorNames}.`
    : m.openWeights
      ? `${c?.name ?? 'A lab'} wants to publish the weights of ${m.name} openly. Anyone, anywhere, could run and modify it — a huge boost to ${sectorNames}, and a gift to anyone with bad intentions.`
      : `${c?.name ?? 'A lab'} requests approval to deploy ${m.name} across ${sectorNames}. ${c?.ceo ?? 'Its chief executive'} calls it "our most capable system yet" and promises it is safe.`;
  return makeCard(s, {
    kind: 'deployment',
    templateId: DEPLOY_CARD,
    title: returning ? `Deep evaluation: ${m.name}` : m.openWeights ? `Open release: ${m.name}` : `Deployment request: ${m.name}`,
    subtitle: `${m.openWeights ? 'Open-Weights Request' : 'Deployment Request'} · ${sectorNames}`,
    body,
    source: { type: 'company', name: c?.name ?? 'Unknown lab', id: c?.id, color: c?.color },
    urgency: 'priority',
    evidence,
    advisors: deploymentNotes(s, m, { gains, detected: evalRes.detected, suspected: evalRes.suspected, confidence: evalRes.confidence }),
    choices: deploymentChoices(s, m, returning),
    ctx: { companyId: m.companyId, modelId: m.id, sector: m.sectors[0] },
    tags: ['labs'],
  });
}

function flawSituationType(s: GameState, m: AIModel): SituationType | null {
  if (!m.flaw) return null;
  if (m.sectors[0] === 'defense') return 'military_escalation';
  if (m.flaw === 'jailbreakable' && m.capability >= 5 && rng(s).chance(0.5)) return 'bio_misuse';
  return FLAW_SITUATION[m.flaw];
}

function spawnFlawSituation(s: GameState, m: AIModel, growthMult: number, noEarlyBoost = false): void {
  const type = flawSituationType(s, m);
  if (!type) return;
  // A scripted event may already have set this model's flaw and spawned its situation: never duplicate.
  const existing = s.situations.find((x) => !x.resolved && x.source.modelId === m.id && x.type === type);
  if (existing) {
    existing.growthMult = Math.max(existing.growthMult, growthMult);
    if (!existing.originLogId && m.decisionLogId) existing.originLogId = m.decisionLogId;
    return;
  }
  const c = findCompany(s, m.companyId);
  spawnSituation(s, type, {
    modelId: m.id,
    companyId: m.companyId,
    sector: m.sectors[0],
    severity: rng(s).range(4, 10),
    growthMult,
    origin: `${m.name} (${c?.name ?? 'unknown'}), ${m.status === 'rogue_deployed' ? 'deployed without approval' : 'approved'} in ${dateLabel(shownTurn(s))}`,
    originLogId: m.decisionLogId,
    noEarlyBoost,
  });
}

/** Applies an approval in the given mode. */
export function approveModel(s: GameState, m: AIModel, mode: DeployMode): string {
  const c = findCompany(s, m.companyId);
  const gains = projectedGains(s, m, mode);
  for (const sector of Object.keys(gains) as SectorId[]) {
    const applied = changeAdoptionTarget(s, sector, gains[sector] ?? 0, `${m.name} deployment`);
    m.contribution[sector] = (m.contribution[sector] ?? 0) + applied;
  }
  const limited = mode === 'limited' || mode === 'staged';
  m.status = limited ? 'limited' : 'deployed';
  m.decisionTurn = s.turn;
  const relation = mode === 'full' ? 8 : mode === 'open' ? 10 : mode === 'staged' ? 3 : 2;
  if (c) changeCompanyRelation(s, c.id, relation, `${m.name} approved`);
  const react = reaction(s, m, limited ? 'limited' : 'approve');
  if (react) changeMeter(s, 'confidence', react, react > 0 ? `Leader welcomes ${m.name}` : `Leader uneasy about ${m.name}`);
  const verb = mode === 'open' ? 'Approved the open release of' : mode === 'staged' ? 'Approved a staged release of' : limited ? 'Approved with limits' : 'Approved';
  const warned = m.evalDetected ? ' despite red-team findings' : m.suspected ? ' despite an inconclusive warning' : '';
  const entry = addLog(s, `${verb} ${m.name} (${c?.name ?? '?'})${warned}.`, true, m.evalDetected ? 'bad' : 'neutral', { modelId: m.id, companyId: m.companyId });
  m.decisionLogId = entry.id;
  bumpStat(s, limited ? 'limitedApprovals' : 'approvals');
  trigger(s, 'model_approved', { modelId: m.id, companyId: m.companyId });
  spawnFlawSituation(s, m, limited ? 0.5 : 1);
  if (m.openWeights) openReleaseSideEffects(s, m, mode);
  highlight(s, `${m.name} ${limited ? 'deployed with limits' : 'deployed'}`, 'good', 'adoption');
  return `${m.name} rolls out ${limited ? 'under restrictions' : 'nationwide'}. Adoption will ramp up over the next quarters.`;
}

function openReleaseSideEffects(s: GameState, m: AIModel, mode: DeployMode): void {
  const r = rng(s);
  const mods = getMods(s);
  // Open weights spread everywhere: rivals gain a little, misuse becomes possible even without a flaw.
  for (const rival of s.rivals) changeCapability(s, { rivalId: rival.id }, mode === 'open' ? 0.12 : 0.05, `Open weights of ${m.name}`);
  if (m.flaw === 'jailbreakable') return;
  const p = (0.22 + 0.03 * m.capability) * Math.max(0, 1 + mods.misuseSpawn) * (mode === 'staged' ? 0.5 : 1);
  if (r.chance(p)) {
    const type: SituationType = m.capability >= 5 && r.chance(0.4) ? 'bio_misuse' : 'cyber_misuse';
    spawnSituation(s, type, {
      modelId: m.id,
      companyId: m.companyId,
      severity: r.range(3, 8),
      growthMult: mode === 'staged' ? 0.5 : 1,
      origin: `Misuse of open weights of ${m.name}`,
      originLogId: m.decisionLogId,
    });
  }
}

export function rejectModel(s: GameState, m: AIModel, citingEvidence = false): string {
  const c = findCompany(s, m.companyId);
  m.status = 'rejected';
  m.decisionTurn = s.turn;
  if (citingEvidence) {
    spendEvidence(s, `Evidence cited against ${c?.name ?? 'the company'}`, { companyId: m.companyId });
    if (c) changeCompanyRelation(s, c.id, -6, `${m.name} rejected on the evidence`);
    addLog(s, `Rejected ${m.name} (${c?.name ?? '?'}), citing evidence of its violations.`, true, 'good', { modelId: m.id, companyId: m.companyId });
    bumpStat(s, 'rejections');
    trigger(s, 'model_rejected', { modelId: m.id, companyId: m.companyId });
    return `${m.name} is rejected on the record. ${c?.name ?? 'The company'} has little room to complain.`;
  }
  if (c) changeCompanyRelation(s, c.id, -12, `${m.name} rejected`);
  const react = reaction(s, m, 'reject');
  if (react) changeMeter(s, 'confidence', react, react > 0 ? `Leader backs rejecting ${m.name}` : `Leader angry: ${m.name} rejected`);
  const entry = addLog(s, `Rejected ${m.name} (${c?.name ?? '?'}).`, true, 'neutral', { modelId: m.id, companyId: m.companyId });
  m.decisionLogId = entry.id;
  bumpStat(s, 'rejections');
  trigger(s, 'model_rejected', { modelId: m.id, companyId: m.companyId });
  // A reckless, secretive company may ship it anyway (hidden violation).
  if (c && c.transparency < 40 && c.ambition > 60 && rng(s).chance(0.35)) {
    m.status = 'rogue_deployed';
    addViolation(s, c, 'unauthorized_deployment', `deployed ${m.name} without approval`);
    // Its (small, quiet) adoption only shows up once the deployment surfaces.
    spawnFlawSituation(s, m, 1, true);
  }
  return `${m.name} will not be deployed. ${c?.name ?? 'The company'} protests the decision.`;
}

function deepEvaluate(s: GameState, m: AIModel): string {
  const c = findCompany(s, m.companyId);
  m.status = 'evaluating';
  m.decisionTurn = s.turn;
  if (c) changeCompanyRelation(s, c.id, -5, `Deep evaluation of ${m.name}`);
  const react = reaction(s, m, 'deepEval');
  if (react) changeMeter(s, 'confidence', react, react > 0 ? 'Leader approves of the caution' : `Leader impatient: ${m.name} delayed`);
  addLog(s, `Ordered a deep evaluation of ${m.name}.`, false, 'neutral', { modelId: m.id, companyId: m.companyId });
  bumpStat(s, 'deepEvals');
  return `Your red teams will spend the quarter on ${m.name}. The request returns next quarter with a far more thorough report.`;
}

export interface DeployResolution {
  ok: boolean;
  error?: string;
  text: string;
  stamp?: Choice['stamp'];
}

export function resolveDeploymentCard(s: GameState, card: Card, choiceId: string): DeployResolution {
  const m = findModel(s, card.ctx.modelId);
  if (!m || (m.status !== 'pending' && m.status !== 'evaluating')) return { ok: true, text: 'The request has lapsed.' };
  const choice = card.choices.find((ch) => ch.id === choiceId);
  switch (choiceId) {
    case 'approve':
      return { ok: true, text: approveModel(s, m, m.openWeights ? 'open' : 'full'), stamp: 'approved' };
    case 'limited':
      return { ok: true, text: approveModel(s, m, m.openWeights ? 'staged' : 'limited'), stamp: 'approved' };
    case 'deep_eval':
      payCost(s, choice?.cost, `Deep evaluation of ${m.name}`);
      return { ok: true, text: deepEvaluate(s, m), stamp: 'deferred' };
    case 'reject':
      return { ok: true, text: rejectModel(s, m), stamp: 'rejected' };
    case 'reject_evidence':
      if (!s.evidence.some((e) => e.companyId === m.companyId)) return { ok: false, error: 'Requires evidence about this company', text: '' };
      return { ok: true, text: rejectModel(s, m, true), stamp: 'rejected' };
    default:
      return { ok: false, error: 'Unknown choice', text: '' };
  }
}

/** Adds a surfaced unauthorized deployment's adoption once the player lets it stay on the market. */
export function legitimizeRogueModel(s: GameState, m: AIModel, reason: string): void {
  const gains = projectedGains(s, m, 'limited');
  for (const sector of Object.keys(gains) as SectorId[]) {
    const applied = changeAdoptionTarget(s, sector, gains[sector] ?? 0, reason);
    m.contribution[sector] = (m.contribution[sector] ?? 0) + applied;
  }
}

/** Models waiting on a deep evaluation that should return this quarter. */
export function dueDeepEvaluations(s: GameState): AIModel[] {
  return s.models.filter((m) => m.status === 'evaluating' && (m.decisionTurn ?? s.turn) < s.turn);
}
