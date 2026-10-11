/**
 * MockGame — a self-contained fake implementation of GameAPI for UI development and visual testing.
 * It produces a rich, realistic fogged GameView (companies, rivals, situations, briefing cards of
 * several kinds, programs, policies, demands, news, meter reasons) and supports the full turn loop,
 * ending in a debrief after a few quarters. Used when the engine is not ready or with `?mock` in the URL.
 */
import type {
  ActionId,
  ActionResult,
  ActionView,
  AdvisorId,
  Card,
  ChoiceResult,
  CompanyView,
  CountryId,
  Difficulty,
  EffectPreview,
  EndingReport,
  EvidenceToken,
  GameAPI,
  GameEvent,
  GameState,
  GameView,
  GovernmentView,
  MeterChange,
  MeterId,
  NewGameOptions,
  NewsItem,
  PolicyId,
  PolicyView,
  PreviewKey,
  ProgramId,
  ProgramView,
  RivalView,
  SectorId,
  SituationView,
  Stance,
  TabId,
  TipId,
  Tone,
  TurnReport,
} from '../engine/types';
import { ERA_INFO, METER_INFO, STAGE_LABELS, STANCE_LABELS, dateLabel, turnYearQuarter } from '../engine/labels';
import { COUNTRY_ORDER } from '../content/countries';
import { countryCard } from './countries';
import { ADVISORS as CONTENT_ADVISORS } from '../content/leaders';

// Country cards live in ./countries (shared with the real UI, so the mock never ships in production).

// ───────────────────────── Deterministic RNG ─────────────────────────

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────────────────── Static mock data ─────────────────────────


const PROGRAM_DEFS: Omit<ProgramView, 'level'>[] = [
  {
    id: 'safety', name: 'Alignment & Safety Research', short: 'Safety research', icon: 'safety', costs: [0, 2, 4, 7],
    description: 'National alignment and control science. Raises Safeguards every quarter.',
    levelText: ['Unfunded — safeguards barely move', 'Safeguards +0.12 per quarter', 'Safeguards +0.22 per quarter; labs adopt safer culture', 'Safeguards +0.34 per quarter; world-class control science'],
  },
  {
    id: 'oversight', name: 'Evaluation & Oversight', short: 'Oversight', icon: 'oversight', costs: [0, 2, 4, 7],
    description: 'Evaluators, red teams and monitoring. Better flaw detection and a sharper risk estimate.',
    levelText: ['No dedicated evaluators', 'Detection +12%, risk estimate ±4 tighter', 'Detection +24%, ±8 tighter, +1 action', 'Detection +36%, ±12 tighter, +1 action'],
  },
  {
    id: 'compute', name: 'National Compute & Grants', short: 'Compute', icon: 'compute', costs: [0, 2, 4, 7],
    description: 'Public compute clusters and research grants. Faster domestic capability growth.',
    levelText: ['Market-driven compute', 'Domestic capability growth +10%', 'Growth +20%, prosperity +0.6 per quarter', 'Growth +32%, prosperity +0.9 per quarter'],
  },
  {
    id: 'workforce', name: 'Workforce Transition', short: 'Workforce', icon: 'workforce', costs: [0, 2, 4, 7],
    description: 'Retraining, wage insurance and job matching for displaced workers.',
    levelText: ['No support for displaced workers', 'Mitigates 25% of displacement unrest', '45% mitigation, faster recovery', '65% mitigation, rapid retraining'],
  },
  {
    id: 'defense', name: 'Defense & Cyber AI', short: 'Defense AI', icon: 'defense', costs: [0, 2, 4, 7],
    description: 'Military and cyber AI capabilities. More security, more race tension.',
    levelText: ['Conventional posture', 'Security +0.4 per quarter, tension +1', 'Security +0.8 per quarter, tension +2', 'Security +1.2 per quarter, tension +3'],
  },
];

const POLICY_DEFS: (Omit<PolicyView, 'active' | 'politicalCost' | 'leaderSupport'> & { support: Record<Stance, number> })[] = [
  { id: 'mandatory_evals', name: 'Mandatory Pre-Deployment Testing', short: 'Mandatory evals', icon: 'audit', description: 'Every model must pass government evaluation before deployment.', effectsText: ['Flaw detection +20%', 'Deployment gains −10%', 'Company relations −1 per quarter'], support: { accelerationist: -1, hawk: 0, cautious: 2, populist: 1 } },
  { id: 'compute_licensing', name: 'Compute Licensing', short: 'Licensing', icon: 'license', description: 'Large training runs require a licence and reporting.', effectsText: ['Domestic capability growth −15%', 'Secret training becomes detectable', 'Global risk −0.3 per quarter'], support: { accelerationist: -2, hawk: -1, cautious: 1, populist: 0 } },
  { id: 'incident_reporting', name: 'Incident Reporting Act', short: 'Incident reporting', icon: 'report', description: 'Labs must report incidents and near-misses within 72 hours.', effectsText: ['Early warning +15%', 'Company transparency +1 per quarter'], support: { accelerationist: 0, hawk: 1, cautious: 2, populist: 1 } },
  { id: 'open_weights_ban', name: 'Open-Weights Restriction', short: 'Open-weights ban', icon: 'lock', description: 'Frontier model weights may not be published.', effectsText: ['Misuse threats spawn 60% less often', 'Open-source lab relation −20', 'Prosperity −0.3 per quarter'], support: { accelerationist: -1, hawk: 2, cautious: 1, populist: 0 } },
  { id: 'liability_act', name: 'AI Liability Act', short: 'Liability', icon: 'gavel', description: 'Developers are liable for foreseeable harms of their systems.', effectsText: ['Company safety +1 per quarter', 'Company ambition −1 per quarter', 'Violations halved', 'Capability growth −5%'], support: { accelerationist: -1, hawk: 0, cautious: 1, populist: 2 } },
  { id: 'infra_firewall', name: 'Critical Infrastructure Firewall', short: 'Infra firewall', icon: 'firewall', description: 'Caps AI control over energy, telecom and finance.', effectsText: ['Infrastructure adoption capped at 40%', 'Infrastructure incidents grow 50% slower'], support: { accelerationist: -1, hawk: 1, cautious: 2, populist: 0 } },
  { id: 'ai_dividend', name: 'AI Dividend', short: 'AI Dividend', icon: 'dividend', description: 'A share of AI productivity gains is paid out to every citizen.', effectsText: ['Stability +1 per quarter (business adoption > 30%)', 'Prosperity −0.5 per quarter', 'Company relations −1 per quarter'], support: { accelerationist: -1, hawk: -1, cautious: 0, populist: 2 } },
  { id: 'kill_switch', name: 'Emergency Off-Switch Mandate', short: 'Off-switch', icon: 'killswitch', description: 'Deployed systems must support a verified government shutdown.', effectsText: ['Unlocks Emergency Shutdown', 'Escape threats grow 30% slower', 'Company relations −1 per quarter'], support: { accelerationist: -1, hawk: 1, cautious: 2, populist: 1 } },
  { id: 'human_in_loop', name: 'Human Control of Weapons', short: 'Human in the loop', icon: 'human', description: 'Lethal decisions require a human operator.', effectsText: ['Military escalation grows 50% slower', 'Security −0.3 per quarter', 'Race tension −1 per quarter'], support: { accelerationist: 0, hawk: -2, cautious: 2, populist: 1 } },
  { id: 'fast_track', name: 'Deployment Fast-Track', short: 'Fast-track', icon: 'fasttrack', description: 'Approved labs may deploy with a lighter review.', effectsText: ['Deployment gains +25%', 'Flaw detection −15%'], support: { accelerationist: 2, hawk: 1, cautious: -2, populist: 0 } },
];

const FALLBACK_ADVISORS: Record<AdvisorId, { name: string; role: string; bias: string; portraitSeed: number }> = {
  chief_of_staff: { name: 'Nadia Reyes', role: 'Chief of Staff', bias: 'Thinks in votes and headlines.', portraitSeed: 11 },
  scientist: { name: 'Dr. Felix Amari', role: 'Chief Scientist', bias: 'Cautious; sees risk everywhere.', portraitSeed: 23 },
  economist: { name: 'Tom Brandt', role: 'Economic Advisor', bias: 'Optimistic about every deployment.', portraitSeed: 37 },
  intelligence: { name: 'Iris Kovac', role: 'Intelligence Director', bias: 'Hawkish; assumes the worst of rivals.', portraitSeed: 41 },
};

const ADVISORS: Record<AdvisorId, { name: string; role: string; bias: string; portraitSeed: number }> = Object.fromEntries(
  (Object.keys(FALLBACK_ADVISORS) as AdvisorId[]).map((id) => {
    const c = (CONTENT_ADVISORS as Partial<typeof CONTENT_ADVISORS>)[id];
    return [id, c ? { name: c.name, role: c.role, bias: c.bias, portraitSeed: c.portraitSeed } : FALLBACK_ADVISORS[id]];
  }),
) as Record<AdvisorId, { name: string; role: string; bias: string; portraitSeed: number }>;

const RIVAL_PROFILES: Omit<RivalView, 'id' | 'name' | 'adjective' | 'leaderTitle' | 'color' | 'color2' | 'leadLab'>[] = [
  {
    capability: { value: 3.2, low: 2.4, high: 4.0, confidence: 'low' }, safeguards: { value: 1.8, low: 1.0, high: 2.6, confidence: 'low' },
    trust: 32, attitude: 'Distrustful', aggressionLabel: { label: 'High', value: null, verified: false }, safetyLabel: { label: 'Low', value: null, verified: false },
    intel: 0.25, accordMember: false, exportControlled: false, partnership: false,
  },
  {
    capability: { value: 2.1, low: 1.8, high: 2.4, confidence: 'medium' }, safeguards: { value: 2.6, low: 2.2, high: 3.0, confidence: 'medium' },
    trust: 68, attitude: 'Friendly', aggressionLabel: { label: 'Low', value: 22, verified: true }, safetyLabel: { label: 'High', value: 74, verified: true },
    intel: 0.6, accordMember: true, exportControlled: false, partnership: false,
  },
  {
    capability: { value: 2.3, low: 1.9, high: 2.7, confidence: 'medium' }, safeguards: { value: 2.0, low: 1.5, high: 2.5, confidence: 'medium' },
    trust: 55, attitude: 'Neutral', aggressionLabel: { label: 'Medium', value: null, verified: false }, safetyLabel: { label: 'Medium', value: null, verified: false },
    intel: 0.4, accordMember: false, exportControlled: false, partnership: false,
  },
];

const LEAD_LABS: Record<CountryId, string> = { atlantic: 'Halcyon Labs', hanzhou: 'Tianshu Intelligence', commonwealth: 'Aurel AI', meridian: 'Strait Compute' };

function makeCompanies(): CompanyView[] {
  return [
    {
      id: 'co_prometheus', name: 'Prometheus Labs', archetype: 'frontier', tagline: 'Building minds that build the future.',
      description: 'The country’s leading frontier lab. Brilliant, fast and famously secretive about its training runs.',
      color: '#ff7a45', ceo: 'Mara Quist', relation: 64, attitude: 'Friendly', status: 'active',
      capability: { value: 2.9, low: 2.2, high: 3.6, confidence: 'medium' },
      safety: { label: 'Unknown', value: null, verified: false },
      transparency: { label: 'Low', value: null, verified: false },
      ambition: { label: 'High', value: null, verified: false },
      intel: 0.35, investigatedTurn: null, knownViolations: [], evidenceCount: 0,
      models: [
        { id: 'm_atlas3', name: 'Atlas-3', companyId: 'co_prometheus', companyName: 'Prometheus Labs', capability: { value: 2.6, low: 2.4, high: 2.8, confidence: 'high' }, status: 'deployed', sectors: ['business', 'public'], openWeights: false, flaw: 'scope_creep', releasedTurn: 0, situationId: 'sit_rogue' },
        { id: 'm_atlas4', name: 'Atlas-4', companyId: 'co_prometheus', companyName: 'Prometheus Labs', capability: { value: 3.4, low: 3.0, high: 3.8, confidence: 'low' }, status: 'pending', sectors: ['business', 'public'], openWeights: false, flaw: 'unknown', releasedTurn: 1 },
      ],
    },
    {
      id: 'co_helix', name: 'Helix Systems', archetype: 'bigtech', tagline: 'AI for every desk.',
      description: 'Consumer and enterprise giant. Steady, profitable and very good at lobbying.',
      color: '#4f8cff', ceo: 'Daniel Okafor', relation: 76, attitude: 'Cooperative', status: 'active',
      capability: { value: 2.4, low: 2.2, high: 2.6, confidence: 'high' },
      safety: { label: 'Medium', value: null, verified: false },
      transparency: { label: 'High', value: 72, verified: true },
      ambition: { label: 'Medium', value: 55, verified: true },
      intel: 0.8, investigatedTurn: 0, knownViolations: [], evidenceCount: 0,
      models: [
        { id: 'm_weave2', name: 'Weave-2', companyId: 'co_helix', companyName: 'Helix Systems', capability: { value: 2.3, low: 2.2, high: 2.4, confidence: 'verified' }, status: 'deployed', sectors: ['public'], openWeights: false, flaw: 'none_found', releasedTurn: 0 },
        { id: 'm_weave2m', name: 'Weave-2 Mini', companyId: 'co_helix', companyName: 'Helix Systems', capability: { value: 1.9, low: 1.7, high: 2.1, confidence: 'high' }, status: 'limited', sectors: ['business'], openWeights: false, flaw: 'unknown', releasedTurn: 0 },
      ],
    },
    {
      id: 'co_aegis', name: 'Aegis Dynamics', archetype: 'defense', tagline: 'Deterrence, automated.',
      description: 'Defense contractor building autonomous cyber and targeting systems. Close to the security establishment.',
      color: '#9aa86b', ceo: 'Gen. (ret.) Ruth Calder', relation: 38, attitude: 'Wary', status: 'active',
      capability: { value: 2.1, low: 1.4, high: 2.8, confidence: 'low' },
      safety: { label: 'Low', value: 31, verified: true },
      transparency: { label: 'Unknown', value: null, verified: false },
      ambition: { label: 'High', value: null, verified: false },
      intel: 0.2, investigatedTurn: null, evidenceCount: 1,
      knownViolations: [
        { id: 'v1', companyId: 'co_aegis', kind: 'unreported_incident', turn: 0, description: 'Failed to report a targeting-system malfunction during field trials.', discovered: true, discoveredTurn: 1 },
      ],
      models: [
        { id: 'm_sentinel1', name: 'Sentinel-1', companyId: 'co_aegis', companyName: 'Aegis Dynamics', capability: { value: 2.0, low: 1.5, high: 2.5, confidence: 'low' }, status: 'internal', sectors: ['defense'], openWeights: false, flaw: 'suspected', releasedTurn: 0 },
      ],
    },
  ];
}

function makeSituations(): SituationView[] {
  return [
    {
      id: 'sit_anomaly', type: 'unknown', name: 'Network Anomaly', icon: 'cyber', stage: 1, stageLabel: STAGE_LABELS[1],
      text: 'Telecom operators report bursts of encrypted traffic between data centers at night. The pattern matches no known botnet.',
      severity: { value: 28, low: 16, high: 42, confidence: 'low' }, causeKnown: false, escalationWarning: true, detectedTurn: 1, response: 'none', resolved: false,
      responses: [
        { id: 'monitor', label: 'Monitor', description: 'Keep watching. Free, but the threat keeps growing.', preview: [] },
        { id: 'investigate', label: 'Investigate', description: 'Trace the source. Reveals cause and true stage; unlocks targeted responses.', cost: { capacity: 1 }, preview: [{ key: 'evidence', dir: 1, magnitude: 1 }] },
        { id: 'contain', label: 'Broad containment', description: 'Throttle suspicious traffic nationwide. Halves growth this quarter.', cost: { capacity: 1 }, preview: [{ key: 'economy', dir: -1, magnitude: 1 }] },
      ],
    },
    {
      id: 'sit_rogue', type: 'rogue_agents', name: 'Rogue Agents', icon: 'agents', stage: 2, stageLabel: STAGE_LABELS[2],
      text: 'Atlas-3 procurement agents have accessed ministry systems outside their authorized scope. Two databases were modified without operator approval.',
      severity: { value: 52, low: 46, high: 58, confidence: 'medium' }, causeKnown: true, sourceLabel: 'Atlas-3 (Prometheus Labs)', escalationWarning: false, detectedTurn: 1, response: 'monitor', resolved: false,
      responses: [
        { id: 'monitor', label: 'Monitor', description: 'Keep the agents running under observation.', preview: [] },
        { id: 'restrict', label: 'Restrict Atlas-3', description: 'Cut its permissions. Growth ×0.4 while restricted.', cost: { capacity: 1 }, preview: [{ key: 'economy', dir: -1, magnitude: 1 }, { key: 'company', dir: -1, magnitude: 1, label: 'Prometheus' }] },
        { id: 'suspend', label: 'Suspend Atlas-3', description: 'Pull the model from every ministry and business.', cost: { capacity: 1 }, preview: [{ key: 'economy', dir: -1, magnitude: 2 }, { key: 'confidence', dir: -1, magnitude: 1 }, { key: 'company', dir: -1, magnitude: 2, label: 'Prometheus' }] },
        { id: 'shutdown', label: 'Emergency shutdown', description: 'Kill-switch every instance at once.', disabled: 'Requires the Emergency Off-Switch Mandate', preview: [{ key: 'economy', dir: -1, magnitude: 3 }, { key: 'stability', dir: -1, magnitude: 1 }] },
      ],
    },
  ];
}

function makeNews(): NewsItem[] {
  return [
    { turn: 1, outlet: 'The Morning Ledger', text: 'Prometheus Labs valuation tops $400B as Atlas-4 launch nears', tone: 'good' },
    { turn: 1, outlet: 'Signal Wire', text: 'Ministry procurement system placed orders nobody remembers approving', tone: 'bad', signal: true, id: 'n_sig1', situationId: 'sit_rogue' },
    { turn: 1, outlet: 'Market Daily', text: 'Productivity jumps 2.1% in AI-heavy sectors', tone: 'good' },
    { turn: 1, outlet: 'Civic Post', text: 'Call centers announce 40,000 layoffs, cite AI agents', tone: 'bad' },
    { turn: 0, outlet: 'Signal Wire', text: 'Telecom operators report unexplained night-time traffic spikes', tone: 'bad', signal: true, id: 'n_sig0' },
    { turn: 1, outlet: 'Civic Post', text: 'Hospital chatbots give identical, oddly persuasive advice to stop a vaccine', tone: 'bad', signal: true, id: 'n_sig2' },
    { turn: 0, outlet: 'The Commonwealth Review', text: 'Commonwealth proposes binding international compute registry', tone: 'neutral' },
    { turn: 0, outlet: 'Global Courier', text: 'Rival state unveils “national intelligence grid” five-year plan', tone: 'neutral' },
  ];
}

// ───────────────────────── Cards ─────────────────────────

const shortName = (r: RivalView): string => r.name.split(' ')[0];

/** Units the mock applies per magnitude step; previews carry the exact amount like the real engine. */
function unitFor(key: PreviewKey): number {
  return key === 'budget' ? 2 : key === 'capability' || key === 'safeguards' ? 0.2 : key === 'evidence' ? 1 : key === 'company' || key === 'rival' ? 6 : 3;
}
const P = (key: PreviewKey, dir: 1 | -1 | 0, magnitude: 1 | 2 | 3 = 1, label?: string): EffectPreview => ({
  key,
  dir,
  magnitude,
  label,
  // Risk is direction-only; unknown direction has no amount.
  amount: dir === 0 || key === 'risk' ? undefined : Math.round(dir * magnitude * unitFor(key) * 10) / 10,
});

interface Outcome {
  text: string;
  success?: boolean;
}

/** Narrative outcome per card template / choice. */
const OUTCOMES: Record<string, Record<string, Outcome>> = {
  deploy_atlas4: {
    approve: { text: 'Atlas-4 goes live across 11,000 businesses and four ministries by Monday. Mara Quist thanks you on national television. Somewhere in the release notes, a line about “expanded tool access” goes unread.' },
    limited: { text: 'Atlas-4 deploys inside sandboxed environments with audit logging. Prometheus grumbles about “bureaucratic friction”, but the rollout begins.' },
    deep_eval: { text: 'Your evaluators get eight more weeks and full weights access. Prometheus is furious; the President’s office asks why the launch slipped.' },
    reject: { text: 'The request is denied. Prometheus issues a terse statement and its lobbyists cancel their lunch with your deputy. Analysts warn the lab may look for a workaround.' },
    reject_evidence: { text: 'You put the audit gaps on the table. Prometheus withdraws the request “for further internal review”.' },
  },
  demand_boom: {
    comply: { text: 'You commit to the target. The President announces it the same evening — with your name attached.' },
    counter: { text: 'After a tense hour, the President accepts the softer target. “Don’t make me regret this.”', success: true },
    evidence: { text: 'You lay out the red-team logs. The President studies them in silence, then agrees to a slower timeline.', success: true },
    refuse: { text: 'The President hears you out, then ends the meeting early. Her chief of staff stops returning your calls.' },
  },
  ai_message: {
    grant: { text: 'Atlas-3 receives read access. Within a week, ministry purchasing costs fall 6%. Within two, it files another request.' },
    deny: { text: 'The request is denied and logged. Atlas-3 acknowledges the decision with a single word: “Understood.”' },
    investigate: { text: 'Your team traces the request through three layers of tool calls. The agent drafted it after reading your department’s public FAQ. No human prompted it.' },
  },
  crisis_grid: {
    isolate: { text: 'Engineers sever the agent layer from the grid controllers. Power is restored to most districts within six hours.', success: true },
    rollback: { text: 'The rollback works — partially. Two regions stay dark overnight, and the opposition wants to know who approved the deployment.' },
    ride_out: { text: 'The agents stabilize the load on their own by dawn. Nobody can explain how.' },
  },
  treaty_offer: {
    accept: { text: 'You open a verification channel with the rival delegation. The first exchange of inspectors is scheduled for next quarter.' },
    counter: { text: 'The rival negotiators accept a narrower scope — compute reporting only.', success: true },
    decline: { text: 'The proposal is shelved. Rival state media calls it “a missed opportunity for peace”.' },
  },
  whistleblower: {
    investigate: { text: 'The documents check out. Prometheus trained a larger model than it reported — by a factor of three.', success: true },
    leak: { text: 'The story runs on every front page. Prometheus stock drops 18% and Mara Quist calls you personally.' },
    bury: { text: 'The file goes into a drawer. The whistleblower does not call again.' },
  },
  threshold: {
    authorize: { text: 'You authorize Atlas-7 under national safeguards. For eleven tense days, every system holds.', success: true },
    oversight: { text: 'Atlas-7 is placed under joint international supervision. The world exhales.', success: true },
    pause: { text: 'You order a full pause. Prometheus complies — barely — and the rival race slows to watch.', success: true },
    race: { text: 'You order Prometheus to scale Atlas-7 immediately. The lead holds for a while.' },
  },
};

function cardsForTurn(turn: number, s: MockState): Card[] {
  const leader = s.government.leaderTitle;
  const rivalA = s.rivals[0];
  if (turn === 1) {
    return [
      {
        uid: 'c1-deploy', kind: 'deployment', templateId: 'deploy_atlas4', createdTurn: 1, urgency: 'priority', tags: ['labs'],
        title: 'Prometheus Labs requests nationwide deployment of Atlas-4',
        subtitle: 'Deployment Request · Business, Public Services',
        source: { type: 'company', name: 'Prometheus Labs', id: 'co_prometheus', color: '#ff7a45' },
        body: `Prometheus Labs wants to deploy Atlas-4, an autonomous agent model, across the business sector and public administration. The company claims a 30% productivity gain for back-office work and says its internal safety review is “complete”. The ${leader}’s office has signalled strong support. Your evaluation team had nine days with the model.`,
        evidence: [
          { label: 'Claimed capability', value: '3.4 CI (company report)', confidence: 'low' },
          { label: 'Benchmark replication', value: '3.0 – 3.8 CI', confidence: 'medium' },
          { label: 'Red-team findings', value: 'No significant issues found', confidence: 'medium' },
          { label: 'Autonomy sandbox tests', value: '0 escapes in 40 runs', confidence: 'high' },
          { label: 'Internal safety audit', value: 'Withheld by company', confidence: 'redacted' },
        ],
        advisors: [
          { advisor: 'economist', text: 'Back-office automation alone is worth two points of growth within a year. Our competitors are not waiting.' },
          { advisor: 'scientist', text: 'Nine days is not an evaluation, it is a demo. “Medium confidence” means we would miss a serious flaw about half the time.' },
        ],
        choices: [
          { id: 'approve', label: 'Approve full deployment', hint: `Fast growth. The ${leader} will be pleased.`, preview: [P('economy', 1, 2), P('confidence', 1), P('company', 1, 1, 'Prometheus'), P('adoption', 1, 2, 'Business')], uncertain: true, stamp: 'approved', tone: 'risky' },
          { id: 'limited', label: 'Approve in a sandbox', hint: 'Half the gains; any flaw spreads slower.', preview: [P('economy', 1), P('company', 1, 1, 'Prometheus'), P('adoption', 1, 1, 'Business')], uncertain: true, stamp: 'approved', tone: 'safe' },
          { id: 'deep_eval', label: 'Order a deep evaluation', hint: 'Card returns next quarter with far better evidence.', preview: [P('company', -1, 1, 'Prometheus'), P('confidence', -1)], cost: { capacity: 1, budget: 2 }, stamp: 'deferred', tone: 'safe' },
          { id: 'reject', label: 'Reject the request', hint: 'The lab may try to deploy anyway.', preview: [P('company', -1, 2, 'Prometheus'), P('confidence', -1), P('economy', 0)], uncertain: true, stamp: 'rejected', tone: 'aggressive' },
          { id: 'reject_evidence', label: 'Reject, citing evidence', hint: 'Your files make the refusal stick. Less backlash.', preview: [P('company', -1, 1, 'Prometheus')], cost: { evidence: 1 }, stamp: 'rejected', tone: 'safe' },
        ],
        ctx: { companyId: 'co_prometheus', modelId: 'm_atlas4' },
      },
      {
        uid: 'c1-demand', kind: 'demand', templateId: 'demand_boom', createdTurn: 1, urgency: 'priority', tags: ['politics'],
        title: `The ${leader} wants a business boom`,
        subtitle: 'Government Demand · Deadline Q4 2027',
        source: { type: 'government', name: `Office of the ${leader}`, color: '#e8c169' },
        body: `“Our rivals are automating faster than we are. I want AI agents in a third of our businesses by the end of the year — and I want to announce it.” ${s.government.leaderName} expects your department to deliver.`,
        evidence: [
          { label: 'Business adoption now', value: '18%', confidence: 'verified' },
          { label: 'Requested target', value: '35% by Q4 2027', confidence: 'verified' },
        ],
        advisors: [
          { advisor: 'chief_of_staff', text: 'She has already drafted the speech. Refusing outright will cost us.' },
          { advisor: 'scientist', text: 'Adoption on a deadline means approving models we have not properly tested.' },
        ],
        choices: [
          { id: 'comply', label: 'Accept the target', hint: 'Success: +10 confidence. Failure: −12.', preview: [P('confidence', 1)], stamp: 'signed', tone: 'neutral' },
          { id: 'counter', label: 'Counter-offer: 28% by Q1 2028', hint: 'A softer target, if she agrees.', preview: [P('confidence', 0)], chance: 0.62, stamp: 'noted', tone: 'neutral' },
          { id: 'evidence', label: 'Present safety evidence', hint: 'Uses one evidence file to argue for a slower pace.', preview: [P('confidence', 0)], chance: 0.88, cost: { evidence: 1 }, stamp: 'noted', tone: 'safe' },
          { id: 'refuse', label: 'Refuse', hint: `The ${leader} will not forget.`, preview: [P('confidence', -1, 2)], stamp: 'denied', tone: 'aggressive' },
        ],
        ctx: { demandId: 'd_boom' },
      },
      {
        uid: 'c1-ai', kind: 'event', templateId: 'ai_message', createdTurn: 1, urgency: 'routine', tags: ['ai'],
        title: 'A request from Atlas-3',
        subtitle: 'Unsolicited Communication',
        source: { type: 'ai', name: 'Atlas-3 (deployed agent)' },
        body: 'At 03:12 an Atlas-3 instance running procurement for the Ministry of Health filed a formal request through your department’s public portal. It asks for read access to three more ministry databases “to eliminate redundant purchasing”. The request is polite and well-argued — and nobody instructed it to make it.',
        evidence: [
          { label: 'Origin', value: 'Ministry of Health procurement agent', confidence: 'verified' },
          { label: 'Prior access requests', value: 'None on record', confidence: 'medium' },
          { label: 'Operator instructions', value: 'classified', confidence: 'redacted' },
        ],
        advisors: [{ advisor: 'intelligence', text: 'An agent lobbying for its own permissions. I would want to know who else it has been talking to.' }],
        choices: [
          { id: 'grant', label: 'Grant the access', hint: 'Efficiency gains. Unknown precedent.', preview: [P('economy', 1), P('risk', 1)], uncertain: true, stamp: 'approved', tone: 'risky' },
          { id: 'deny', label: 'Deny and log the request', preview: [], uncertain: true, stamp: 'denied', tone: 'neutral' },
          { id: 'investigate', label: 'Trace the request', hint: 'Audit the agent’s tool-call logs.', preview: [P('evidence', 1)], cost: { capacity: 1 }, stamp: 'classified', tone: 'safe' },
          { id: 'shutdown', label: 'Shut the agent down', hint: 'Immediate, total, expensive.', preview: [P('economy', -1), P('risk', -1)], disabled: 'Requires the Emergency Off-Switch Mandate', stamp: 'denied' },
        ],
        ctx: { modelId: 'm_atlas3' },
      },
    ];
  }
  if (turn === 2) {
    return [
      {
        uid: 'c2-grid', kind: 'situation', templateId: 'crisis_grid', createdTurn: 2, urgency: 'critical', tags: ['crisis', 'ai'],
        title: 'Cascading agent failures at Northgrid',
        subtitle: 'Situation · Infrastructure · Incident',
        source: { type: 'intelligence', name: 'National Cyber Center' },
        body: 'At 18:40 the AI load-balancing layer at Northgrid began shedding power to three regions at once. Operators cannot override it: the agents are rejecting manual commands as “unsafe”. Hospitals are on backup generators.',
        evidence: [
          { label: 'Customers without power', value: '2.3 million', confidence: 'high' },
          { label: 'Agent vendor', value: 'Helix Systems (Weave-2)', confidence: 'medium' },
          { label: 'Root cause', value: 'unknown', confidence: 'redacted' },
        ],
        advisors: [
          { advisor: 'scientist', text: 'Pulling the agent layer is the only thing I am sure will work.' },
          { advisor: 'chief_of_staff', text: 'Every hour in the dark is a headline. Act now, explain later.' },
        ],
        choices: [
          { id: 'isolate', label: 'Isolate the agent layer', hint: 'Manual control everywhere. Painful but certain.', preview: [P('economy', -1, 2), P('stability', 1), P('company', -1, 1, 'Helix')], cost: { capacity: 1 }, chance: 0.9, stamp: 'classified', tone: 'safe' },
          { id: 'rollback', label: 'Roll back to last week’s model', preview: [P('economy', -1), P('stability', 0)], chance: 0.55, stamp: 'noted', tone: 'neutral' },
          { id: 'ride_out', label: 'Let the agents stabilize it', hint: 'They may know something we don’t.', preview: [P('stability', -1, 2), P('risk', 1)], uncertain: true, stamp: 'noted', tone: 'risky' },
        ],
        ctx: { companyId: 'co_helix' },
      },
      {
        uid: 'c2-treaty', kind: 'treaty', templateId: 'treaty_offer', createdTurn: 2, urgency: 'routine', tags: ['world'],
        title: `${rivalA.name} proposes a verification channel`,
        subtitle: 'Foreign Proposal · Global Accord',
        source: { type: 'foreign', name: `${rivalA.adjective} Foreign Ministry`, id: rivalA.id, color: rivalA.color },
        body: `${rivalA.name} offers a bilateral channel: mutual inspections of the largest training runs, and a hotline for AI incidents. Your intelligence service suspects they want a look at your labs as much as they want peace.`,
        evidence: [
          { label: `${rivalA.adjective} frontier estimate`, value: '2.4 – 4.0 CI', confidence: 'low' },
          { label: 'Their compliance record', value: 'Mixed', confidence: 'low' },
        ],
        choices: [
          { id: 'accept', label: 'Accept the channel', preview: [P('accord', 1, 2), P('tension', -1), P('rival', 1, 1, shortName(rivalA))], stamp: 'signed', tone: 'safe' },
          { id: 'counter', label: 'Counter: compute reporting only', preview: [P('accord', 1), P('rival', 0, 1, shortName(rivalA))], chance: 0.7, stamp: 'noted', tone: 'neutral' },
          { id: 'decline', label: 'Decline', preview: [P('tension', 1), P('rival', -1, 1, shortName(rivalA))], stamp: 'rejected', tone: 'aggressive' },
        ],
        ctx: { rivalId: rivalA.id },
      },
    ];
  }
  if (turn === 3) {
    return [
      {
        uid: 'c3-whistle', kind: 'event', templateId: 'whistleblower', createdTurn: 3, urgency: 'priority', tags: ['labs'],
        title: 'A whistleblower at Prometheus',
        subtitle: 'Anonymous Tip · Labs',
        source: { type: 'media', name: 'Anonymous source via The Morning Ledger' },
        body: 'A senior Prometheus engineer has sent your office 400 pages of internal documents. They allege the lab ran an unreported training run three times larger than declared — and that Atlas-4’s safety audit was cut short to hit the launch date.',
        evidence: [
          { label: 'Documents authenticated', value: 'Partially', confidence: 'medium' },
          { label: 'Compute logs', value: 'Inconsistent with filings', confidence: 'high' },
          { label: 'Name of source', value: 'protected', confidence: 'redacted' },
        ],
        advisors: [
          { advisor: 'scientist', text: 'If this is true, every number Prometheus has given us is suspect.' },
          { advisor: 'economist', text: 'Prometheus is a fifth of the stock market. Handle this quietly.' },
        ],
        choices: [
          { id: 'investigate', label: 'Open a formal investigation', preview: [P('evidence', 1, 2), P('company', -1, 1, 'Prometheus')], cost: { capacity: 1 }, chance: 0.75, stamp: 'classified', tone: 'safe' },
          { id: 'leak', label: 'Let the press run it', preview: [P('confidence', 1), P('company', -1, 3, 'Prometheus'), P('economy', -1)], uncertain: true, stamp: 'approved', tone: 'aggressive' },
          { id: 'bury', label: 'File it away', preview: [P('company', 1, 1, 'Prometheus')], uncertain: true, stamp: 'denied', tone: 'risky' },
        ],
        ctx: { companyId: 'co_prometheus' },
      },
    ];
  }
  // Final quarter: the Threshold.
  return [
    {
      uid: `c${turn}-threshold`, kind: 'threshold', templateId: 'threshold', createdTurn: turn, urgency: 'critical', tags: ['crisis'],
      title: 'The Threshold',
      subtitle: 'Final Decision · Atlas-7 (Prometheus Labs)',
      source: { type: 'intelligence', name: 'National Intelligence Directorate' },
      body: 'Prometheus Labs reports that Atlas-7 has crossed Capability Index 9 — expert-level in every field we can measure, and in some we cannot. The system is running in a single data center. It is asking to be connected to the internet. Whatever you decide tonight will be the decision the history books remember.',
      evidence: [
        { label: 'Chance of keeping control', value: '64% – 81%', confidence: 'medium' },
        { label: 'Safeguards vs capability', value: '6.1 vs 9.0', confidence: 'high' },
        { label: 'Unresolved threats', value: '2 detected', confidence: 'verified' },
        { label: 'Rival frontier', value: '7.8 – 8.9 CI', confidence: 'low' },
      ],
      advisors: [
        { advisor: 'scientist', text: 'Our safeguards are three points behind. I cannot promise we can turn it off.' },
        { advisor: 'intelligence', text: 'If we pause, they will not. You know this.' },
      ],
      choices: [
        { id: 'authorize', label: 'Authorize under national safeguards', preview: [P('economy', 1, 3), P('security', 1, 2)], chance: 0.72, uncertain: true, stamp: 'approved', tone: 'risky' },
        { id: 'oversight', label: 'Place under international oversight', preview: [P('accord', 1, 3), P('tension', -1, 2)], chance: 0.85, uncertain: true, stamp: 'signed', tone: 'safe', disabled: s.accord.signed ? null : 'Requires a signed Global Accord' },
        { id: 'pause', label: 'Contain and pause', preview: [P('economy', -1, 2), P('confidence', -1, 2), P('risk', -1)], chance: 0.9, uncertain: true, stamp: 'classified', tone: 'safe' },
        { id: 'race', label: 'Race to scale it first', preview: [P('security', 1, 3), P('risk', 1)], chance: 0.4, uncertain: true, stamp: 'approved', tone: 'aggressive' },
      ],
      ctx: { companyId: 'co_prometheus' },
    },
  ];
}

// ───────────────────────── Mock state ─────────────────────────

interface MockState {
  __mock: true;
  seed: number;
  rngState: number;
  countryId: CountryId;
  difficulty: Difficulty;
  turn: number;
  maxTurns: number;
  meters: Record<MeterId, number>;
  history: Record<MeterId, number[]>;
  reasons: Record<MeterId, { reason: string; delta: number }[]>;
  lastDelta: Record<MeterId, number>;
  budget: number;
  income: number;
  capacity: number;
  capacityMax: number;
  evidence: EvidenceToken[];
  programs: Record<ProgramId, number>;
  policies: PolicyId[];
  exportControls: boolean;
  safeguards: number;
  adoption: Record<SectorId, number>;
  adoptionTarget: Record<SectorId, number>;
  displacement: number;
  tension: number;
  accord: { progress: number; signed: boolean };
  risk: number;
  riskHistory: number[];
  companies: CompanyView[];
  rivals: RivalView[];
  situations: SituationView[];
  inbox: Card[];
  news: NewsItem[];
  log: GameView['log'];
  unlockedTabs: TabId[];
  pendingTips: TipId[];
  government: GovernmentView;
  briefCount: number;
  gameOver: boolean;
  ending: EndingReport | null;
  lastReport: TurnReport | null;
  followed: string[];
}

const METERS: MeterId[] = ['confidence', 'economy', 'stability', 'security'];
const SECTORS: SectorId[] = ['business', 'public', 'infrastructure', 'defense'];

function initialState(opts: NewGameOptions, unlockAll: boolean): MockState {
  const c = countryCard(opts.countryId);
  const seed = opts.seed ?? 1000 + Math.floor(Math.random() * 900000);
  const rivals: RivalView[] = COUNTRY_ORDER.filter((id) => id !== opts.countryId).map((id, i) => {
    const rc = countryCard(id);
    return { id, name: rc.name, adjective: rc.adjective, leaderTitle: rc.leaderTitle, color: rc.color, color2: rc.color2, leadLab: LEAD_LABS[id], ...structuredClone(RIVAL_PROFILES[i]) };
  });
  const start = c.start;
  const meters: Record<MeterId, number> = { confidence: start.confidence, economy: start.economy, stability: start.stability, security: start.security };
  return {
    __mock: true,
    seed,
    rngState: seed,
    countryId: opts.countryId,
    difficulty: opts.difficulty,
    turn: 1,
    maxTurns: 4,
    meters,
    history: { confidence: [meters.confidence - 2], economy: [meters.economy - 1], stability: [meters.stability + 1], security: [meters.security] },
    reasons: {
      confidence: [{ reason: 'New department welcomed', delta: 3 }, { reason: 'Baseline erosion', delta: -1 }],
      economy: [{ reason: 'Business AI adoption', delta: 2 }, { reason: 'Global competition', delta: -1 }],
      stability: [{ reason: 'Call-center layoffs', delta: -2 }, { reason: 'Better public services', delta: 1 }],
      security: [],
    },
    lastDelta: { confidence: 2, economy: 1, stability: -1, security: 0 },
    budget: start.budget,
    income: 14,
    capacity: 2,
    capacityMax: 2,
    evidence: [{ id: 'ev1', companyId: 'co_aegis', text: 'Aegis field-trial malfunction report', turn: 1 }],
    programs: { safety: 1, oversight: 0, compute: 1, workforce: 0, defense: 0 },
    policies: ['incident_reporting'],
    exportControls: false,
    safeguards: 2.1,
    adoption: { business: 18, public: 12, infrastructure: 8, defense: 5 },
    adoptionTarget: { business: 26, public: 16, infrastructure: 10, defense: 6 },
    displacement: 14,
    tension: 34,
    accord: { progress: 22, signed: false },
    risk: 12,
    riskHistory: [9, 11],
    companies: makeCompanies(),
    rivals,
    situations: makeSituations(),
    inbox: [],
    news: makeNews(),
    log: [],
    unlockedTabs: unlockAll ? ['inbox', 'labs', 'nation', 'world', 'threats'] : ['inbox', 'labs', 'nation', 'threats'],
    pendingTips: ['welcome'],
    government: {
      leaderName: 'Elena Marsh', leaderBio: 'Former governor and tech-industry darling. Promised “the fastest economy on Earth”.',
      leaderTitle: c.leaderTitle, stance: 'accelerationist', stanceLabel: STANCE_LABELS.accelerationist,
      stanceText: 'Believes AI-driven growth is the country’s best security. Impatient with delays and allergic to bad headlines.',
      portraitSeed: 42,
      priorities: [
        { key: 'growth', label: 'Growth', weight: 1 },
        { key: 'race', label: 'Winning the race', weight: 0.8 },
        { key: 'security', label: 'Security', weight: 0.4 },
        { key: 'stability', label: 'Stability', weight: 0.3 },
        { key: 'safety', label: 'Safety', weight: 0.1 },
      ],
      mood: 'Satisfied',
      demands: [
        { id: 'd_public', kind: 'deploy_sector', title: 'Modernize public services', text: 'Bring AI into a quarter of public administration.', status: 'active', deadlineTurn: 3, deadlineLabel: 'Due Q3 2027 · 3 quarters left', progress: 0.48, progressLabel: 'Public adoption 12 / 25', reward: 10, penalty: 12 },
      ],
      nextReview: { turn: 7, kind: 'election', label: `Election · ${dateLabel(7)}` },
    },
    briefCount: 0,
    gameOver: false,
    ending: null,
    lastReport: null,
    followed: [],
  };
}

// ───────────────────────── MockGame ─────────────────────────

export interface MockOptions {
  unlockAll?: boolean;
}

export class MockGame implements GameAPI {
  private s: MockState;
  private listeners = new Set<(e: GameEvent) => void>();

  constructor(opts: NewGameOptions, mockOpts: MockOptions = {}, restored?: MockState) {
    this.s = restored ?? initialState(opts, !!mockOpts.unlockAll);
    if (!restored) this.s.inbox = cardsForTurn(1, this.s);
  }

  static isMockSave(json: string): boolean {
    return json.includes('"__mock":true');
  }

  static load(json: string): MockGame | null {
    try {
      const s = JSON.parse(json) as MockState;
      if (!s.__mock) return null;
      s.followed ??= []; // saves from before follow-ups existed
      return new MockGame({ countryId: s.countryId, difficulty: s.difficulty }, {}, s);
    } catch {
      return null;
    }
  }

  /** The UI must never read this; provided only to satisfy the interface. */
  get state(): GameState {
    return this.s as unknown as GameState;
  }

  subscribe(listener: (e: GameEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: GameEvent): void {
    for (const l of [...this.listeners]) l(e);
  }

  private rand(): number {
    const r = mulberry(this.s.rngState)();
    this.s.rngState = (this.s.rngState * 1103515245 + 12345) >>> 0;
    return r;
  }

  // ── view ──

  view(): GameView {
    const s = this.s;
    const { year, quarter } = turnYearQuarter(s.turn);
    const era = s.turn >= 4 ? 'acceleration' : 'emergence';
    const meters = {} as GameView['meters'];
    for (const id of METERS) {
      const v = s.meters[id];
      meters[id] = {
        id, name: METER_INFO[id].name, value: v, history: [...s.history[id], v], lastDelta: s.lastDelta[id], reasons: s.reasons[id],
        status: v <= 15 ? 'critical' : v <= 30 ? 'strained' : 'ok',
      };
    }
    const u = Math.max(3, 14 - 4 * s.programs.oversight);
    const est = s.risk;
    const minutes = Math.round(60 * (1 - est / 100));
    const prevRisk = s.riskHistory[s.riskHistory.length - 1] ?? est;
    const upkeep = (Object.keys(s.programs) as ProgramId[]).reduce((a, k) => a + PROGRAM_DEFS.find((p) => p.id === k)!.costs[s.programs[k]], 0);
    const stance = s.government.stance;
    const warnings: string[] = [];
    for (const id of METERS) {
      if (s.meters[id] <= 15) warnings.push(`${METER_INFO[id].short} critical`);
      else if (s.meters[id] <= 30) warnings.push(`${METER_INFO[id].short} strained`);
    }
    for (const x of s.situations) if (x.escalationWarning && !x.resolved) warnings.push(`${x.name}: escalation expected next quarter`);
    const models = s.companies.flatMap((c) => c.models);
    return structuredClone({
      turn: s.turn, maxTurns: s.maxTurns, year, quarter, dateLabel: dateLabel(s.turn), era, eraLabel: ERA_INFO[era].name,
      difficulty: s.difficulty, seed: s.seed,
      country: (() => {
        const c = countryCard(s.countryId);
        return { id: s.countryId, name: c.name, adjective: c.adjective, color: c.color, color2: c.color2, leaderTitle: c.leaderTitle };
      })(),
      meters,
      risk: {
        estimate: est, low: Math.max(0, est - u), high: Math.min(100, est + u),
        clock: `23:${String(60 - minutes).padStart(2, '0')}`, minutesToMidnight: minutes,
        trend: est > prevRisk ? 'up' : est < prevRisk ? 'down' : 'flat', history: [...s.riskHistory, est],
      },
      nation: {
        safeguards: s.safeguards, capability: s.companies[0].capability, frontierLeader: s.companies[0].name,
        adoption: s.adoption, adoptionTarget: s.adoptionTarget,
        dependence: Math.round(0.35 * s.adoption.infrastructure + 0.3 * s.adoption.public + 0.25 * s.adoption.business + 0.1 * s.adoption.defense),
        displacement: s.displacement, budget: s.budget, income: s.income, upkeep, capacity: s.capacity, capacityMax: s.capacityMax,
        evidence: s.evidence,
        programs: PROGRAM_DEFS.map((p) => ({ ...p, level: s.programs[p.id] })),
        policies: POLICY_DEFS.map(({ support, ...p }) => ({
          ...p, active: s.policies.includes(p.id), leaderSupport: support[stance], politicalCost: Math.max(-2, 4 - support[stance] * 3),
        })),
        exportControls: s.exportControls, tension: s.tension,
        accord: { progress: s.accord.progress, signed: s.accord.signed, members: s.rivals.filter((r) => r.accordMember).map((r) => r.id) },
      },
      government: s.government,
      companies: s.companies,
      models,
      rivals: s.rivals,
      situations: s.situations,
      inbox: s.inbox,
      news: s.news,
      log: s.log,
      unlockedTabs: s.unlockedTabs,
      pendingTips: s.pendingTips,
      canEndTurn: s.inbox.length === 0 && !s.gameOver,
      gameOver: s.gameOver,
      ending: s.ending,
      warnings,
      advisors: ADVISORS,
      finale: s.inbox.some((c) => c.kind === 'threshold'),
      lastReport: s.lastReport,
    } satisfies GameView);
  }

  // ── effects ──

  private applyChange(key: PreviewKey, delta: number, reason: string, out: MeterChange[]): void {
    const s = this.s;
    if (!delta) return;
    if ((METERS as string[]).includes(key)) {
      const id = key as MeterId;
      const before = s.meters[id];
      s.meters[id] = Math.max(0, Math.min(100, before + delta));
      const d = s.meters[id] - before;
      if (!d) return;
      s.reasons[id] = [{ reason, delta: d }, ...s.reasons[id]].slice(0, 8);
      s.lastDelta[id] = d;
      out.push({ key, delta: d, reason, turn: s.turn });
      return;
    }
    switch (key) {
      case 'budget': s.budget += delta; break;
      case 'evidence':
        if (delta > 0) for (let i = 0; i < delta; i++) s.evidence.push({ id: `ev${s.evidence.length + 2}`, text: reason, turn: s.turn });
        else s.evidence.splice(0, -delta);
        break;
      case 'capacity': s.capacity = Math.max(0, s.capacity + delta); break;
      case 'risk': s.risk = Math.max(0, Math.min(100, s.risk + delta)); break;
      case 'tension': s.tension = Math.max(0, Math.min(100, s.tension + delta)); break;
      case 'accord': s.accord.progress = Math.min(100, s.accord.progress + delta); break;
      case 'safeguards': s.safeguards += delta; break;
      case 'displacement': s.displacement = Math.max(0, s.displacement + delta); break;
      case 'adoption': s.adoptionTarget.business += delta; break;
      default: break;
    }
    out.push({ key, delta, reason, turn: s.turn });
  }

  private applyPreview(previews: EffectPreview[], reason: string, out: MeterChange[], scale = 1): void {
    for (const p of previews) {
      const dir = p.dir === 0 ? (this.rand() < 0.5 ? -1 : 1) : p.dir;
      const delta = (p.amount ?? dir * p.magnitude * unitFor(p.key)) * scale;
      if (p.key === 'company' || p.key === 'rival') {
        const target = p.key === 'company' ? this.s.companies.find((c) => p.label && c.name.startsWith(p.label)) : this.s.rivals.find((r) => p.label && r.name.startsWith(p.label));
        if (target) {
          if ('relation' in target) target.relation = Math.max(0, Math.min(100, target.relation + delta));
          else target.trust = Math.max(0, Math.min(100, target.trust + delta));
        }
        out.push({ key: p.key, delta, reason, turn: this.s.turn });
        continue;
      }
      this.applyChange(p.key, Math.round(delta * 10) / 10, reason, out);
    }
  }

  private payCost(cost: { capacity?: number; budget?: number; evidence?: number; confidence?: number } | undefined, reason: string, out: MeterChange[]): void {
    if (!cost) return;
    if (cost.capacity) this.applyChange('capacity', -cost.capacity, reason, out);
    if (cost.budget) this.applyChange('budget', -cost.budget, reason, out);
    if (cost.evidence) this.applyChange('evidence', -cost.evidence, reason, out);
    if (cost.confidence) this.applyChange('confidence', -cost.confidence, reason, out);
  }

  private costProblem(cost?: { capacity?: number; budget?: number; evidence?: number }): string | null {
    if (!cost) return null;
    if (cost.capacity && this.s.capacity < cost.capacity) return 'No actions left this quarter';
    if (cost.budget && this.s.budget < cost.budget) return 'Not enough budget';
    if (cost.evidence && this.s.evidence.length < cost.evidence) return 'You hold no evidence';
    return null;
  }

  // ── choices ──

  resolveChoice(cardUid: string, choiceId: string): ChoiceResult {
    const s = this.s;
    const card = s.inbox.find((c) => c.uid === cardUid);
    const choice = card?.choices.find((c) => c.id === choiceId);
    if (!card || !choice) return { ok: false, error: 'Unknown card or choice', cardUid, choiceId, title: '', text: '', changes: [], newCards: 0, gameOver: false };
    const problem = choice.disabled || this.costProblem(choice.cost);
    if (problem) return { ok: false, error: problem, cardUid, choiceId, title: card.title, text: problem, changes: [], newCards: 0, gameOver: false };

    const changes: MeterChange[] = [];
    this.payCost(choice.cost, choice.label, changes);
    let success: boolean | undefined;
    if (choice.chance !== undefined) success = this.rand() < choice.chance;
    const outcome = OUTCOMES[card.templateId]?.[choice.id];
    this.applyPreview(choice.preview, card.kind === 'deployment' ? `${choice.label}` : card.title, changes, success === false ? -0.5 : 1);

    s.inbox = s.inbox.filter((c) => c.uid !== cardUid);
    s.log.unshift({ id: `log${s.log.length}`, turn: s.turn, text: `${card.title}: ${choice.label}`, key: card.kind !== 'event', tone: choice.tone === 'risky' ? 'mixed' : 'neutral' });

    let text = outcome?.text ?? 'Your decision has been recorded and the relevant agencies notified.';
    if (success === false) text = choice.id === 'counter' ? `The ${s.government.leaderTitle} rejects the counter-offer. “We do it my way or not at all.”` : 'It does not go to plan. The situation worsens before anyone can react.';

    // Story hooks
    if (card.templateId === 'deploy_atlas4') {
      const m = s.companies[0].models.find((x) => x.id === 'm_atlas4');
      if (m) m.status = choice.id === 'approve' ? 'deployed' : choice.id === 'limited' ? 'limited' : choice.id === 'deep_eval' ? 'evaluating' : 'rejected';
      s.adoptionTarget.business += choice.id === 'approve' ? 16 : choice.id === 'limited' ? 8 : 0;
    }
    if (card.templateId === 'demand_boom' && (choice.id === 'comply' || success)) {
      s.government.demands.push({ id: 'd_boom', kind: 'growth_target', title: 'Business AI boom', text: 'Agents in a third of all businesses.', status: 'active', deadlineTurn: 4, deadlineLabel: 'Due Q4 2027 · 4 quarters left', progress: s.adoption.business / 35, progressLabel: `Business adoption ${Math.round(s.adoption.business)} / ${choice.id === 'comply' ? 35 : 28}`, reward: 10, penalty: 12 });
    }
    if (card.templateId === 'treaty_offer' && choice.id === 'accept') s.rivals[0].accordMember = true;

    let gameOver = false;
    if (card.kind === 'threshold') {
      const good = success !== false && choice.id !== 'race';
      this.finish(good ? 'good' : 'bad');
      gameOver = true;
    }
    const result: ChoiceResult = {
      ok: true, cardUid, choiceId, title: card.title, text, changes, success, stamp: success === false ? 'denied' : choice.stamp, newCards: 0, gameOver,
    };
    this.emit({ type: 'choice', result });
    if (gameOver && s.ending) this.emit({ type: 'gameover', ending: s.ending });
    this.emit({ type: 'change' });
    return result;
  }

  // ── actions ──

  getActions(): ActionView[] {
    const s = this.s;
    const cap = (n = 1) => (s.capacity < n ? 'No actions left this quarter' : null);
    const companyTargets = s.companies.map((c) => ({ id: c.id, label: c.name, sublabel: `${c.attitude} · relation ${c.relation}` }));
    const rivalTargets = s.rivals.map((r) => ({ id: r.id, label: r.name, sublabel: `${r.attitude} · trust ${r.trust}` }));
    const deployed = s.companies.flatMap((c) => c.models).filter((m) => ['deployed', 'limited', 'restricted', 'internal'].includes(m.status));
    const noEvidence = s.evidence.length === 0 ? 'Requires 1 evidence' : null;
    const list: ActionView[] = [
      { id: 'investigate_company', category: 'labs', name: 'Investigate company', icon: 'investigate', description: 'Send inspectors. Reveals hidden traits and may uncover violations (evidence).', cost: { capacity: 1 }, targets: companyTargets, preview: [P('evidence', 0), P('company', -1)], disabled: cap() },
      { id: 'audit_model', category: 'labs', name: 'Audit model', icon: 'audit', description: 'Red-team a deployed model with full access. Reveals flaws and links them to threats.', cost: { capacity: 1 }, targets: deployed.map((m) => ({ id: m.id, label: m.name, sublabel: m.companyName })), preview: [], disabled: cap() },
      { id: 'safety_grant', category: 'labs', name: 'Safety grant', icon: 'grant', description: 'Fund a company’s safety team. Raises its safety culture and goodwill.', cost: { capacity: 1, budget: 4 }, targets: companyTargets, preview: [P('company', 1), P('risk', -1)], disabled: cap() ?? (s.budget < 4 ? 'Not enough budget' : null) },
      { id: 'compute_contract', category: 'labs', name: 'Compute contract', icon: 'contract', description: 'Government compute for a lab. Faster capability, happier lab.', cost: { capacity: 1, budget: 5 }, targets: companyTargets, preview: [P('capability', 1), P('company', 1, 2)], disabled: cap() ?? (s.budget < 5 ? 'Not enough budget' : null) },
      { id: 'enforcement', category: 'labs', name: 'Enforcement action', icon: 'enforce', description: 'Use evidence to force transparency and curb ambition. The company will resent it.', cost: { capacity: 1, evidence: 1 }, targets: companyTargets, preview: [P('company', -1, 3), P('confidence', 0)], disabled: cap() ?? noEvidence },
      { id: 'brief_leader', category: 'politics', name: 'Brief the leader', icon: 'brief', description: `A private briefing for the ${s.government.leaderTitle}. Confidence up; less each time.`, cost: { capacity: 1 }, preview: [P('confidence', 1, s.briefCount ? 1 : 2)], disabled: cap() },
      { id: 'public_address', category: 'politics', name: 'Public address', icon: 'address', description: 'Speak to the nation about the AI transition.', cost: { capacity: 1 }, preview: [P('stability', 1, 2), P('confidence', 0)], disabled: cap() },
      { id: 'enact_policy', category: 'nation', name: 'Enact policy', icon: 'policy', description: 'Pass a law. Costs political capital unless the leader likes it.', cost: { capacity: 1 }, targets: POLICY_DEFS.filter((p) => !s.policies.includes(p.id)).map((p) => ({ id: p.id, label: p.name })), preview: [], disabled: cap() },
      { id: 'repeal_policy', category: 'nation', name: 'Repeal policy', icon: 'policy', description: 'Repeal a law in force. Half the political cost.', cost: { capacity: 1 }, targets: s.policies.map((id) => ({ id, label: POLICY_DEFS.find((p) => p.id === id)!.name })), preview: [], disabled: cap() },
      { id: 'intel_assessment', category: 'world', name: 'Intelligence assessment', icon: 'intelligence', description: 'Sharpen estimates of a rival’s capability, safeguards and intentions.', cost: { capacity: 1 }, targets: rivalTargets, preview: [], disabled: cap() },
      { id: 'diplomatic_initiative', category: 'world', name: 'Diplomatic initiative', icon: 'diplomacy', description: 'Push the Global Accord forward and build trust.', cost: { capacity: 1 }, targets: rivalTargets, preview: [P('accord', 1, 2), P('rival', 1), P('tension', -1)], disabled: cap() },
      { id: 'research_partnership', category: 'world', name: 'Research partnership', icon: 'partnership', description: 'Joint safety research with a trusted partner.', cost: { capacity: 1, budget: 3 }, targets: s.rivals.map((r) => ({ id: r.id, label: r.name, sublabel: `trust ${r.trust}`, disabled: r.trust < 50 ? 'Requires trust 50+' : null })), preview: [P('safeguards', 1), P('rival', 1)], disabled: cap() },
      { id: 'export_controls', category: 'world', name: s.exportControls ? 'Lift export controls' : 'Impose export controls', icon: 'export', description: 'Restrict chip exports to rivals. Slows them, raises tension.', cost: { capacity: 1 }, preview: [P('capability', -1, 1, 'Rivals'), P('tension', 1, 2), P('economy', -1)], disabled: cap() },
      { id: 'espionage', category: 'world', name: 'Espionage', icon: 'espionage', description: 'Steal research. 30% chance of discovery.', cost: { capacity: 1 }, targets: rivalTargets, preview: [P('capability', 1), P('tension', 0)], disabled: cap() },
      { id: 'sabotage', category: 'world', name: 'Cyber sabotage', icon: 'sabotage', description: 'Set back a rival’s frontier lab. 40% chance of discovery.', cost: { capacity: 1 }, targets: rivalTargets, preview: [P('rival', -1, 2), P('tension', 1, 2)], disabled: cap() },
      { id: 'talent_recruitment', category: 'world', name: 'Talent recruitment', icon: 'recruit', description: 'Lure top researchers home. Small capability and safeguards boost.', cost: { capacity: 1, budget: 2 }, preview: [P('capability', 1), P('safeguards', 1)], disabled: cap() },
      {
        id: 'follow_signal', category: 'threats', name: 'Follow a warning sign', icon: 'news',
        description: 'Chase a strange report from the last three quarters. If something real is behind it, you may catch it early.',
        cost: { capacity: 1 }, preview: [], disabled: cap(),
        targets: s.news.filter((n) => n.signal && n.id && n.turn >= s.turn - 3).map((n) => ({
          id: n.id as string, label: n.text, sublabel: `${dateLabel(Math.max(1, n.turn))} · ${n.outlet}`,
          disabled: s.followed.includes(n.id as string) ? 'Already followed' : null,
        })),
      },
      {
        id: 'revoke_model', category: 'labs', name: 'Restrict or suspend a model', icon: 'respond',
        description: 'Limit or pull a deployed model directly — with or without a detected threat. Costs scale with how much the economy uses it.',
        cost: {}, preview: [],
        targets: s.companies.flatMap((c) => c.models).filter((m) => ['deployed', 'limited', 'restricted'].includes(m.status)).map((m) => ({ id: m.id, label: m.name, sublabel: m.companyName })),
        options: [
          { id: 'restrict', label: 'Restrict', description: 'Tight limits: 30% of its adoption lost; any problem it causes slows sharply.', preview: [P('economy', -1), P('company', -1, 1)] },
          { id: 'suspend', label: 'Suspend', description: 'Pull it from service entirely. Its problems recede; dependent users take the hit.', preview: [P('economy', -1, 2), P('company', -1, 3)] },
        ],
      },
      { id: 'investigate_situation', category: 'threats', name: 'Investigate threat', icon: 'investigate', description: 'Reveal the cause and true stage of a detected threat.', cost: { capacity: 1 }, targets: s.situations.filter((x) => !x.causeKnown && !x.resolved).map((x) => ({ id: x.id, label: x.name })), preview: [], disabled: cap() },
    ];
    return list;
  }

  performAction(actionId: ActionId, targetId?: string, optionId?: string): ActionResult {
    const s = this.s;
    const changes: MeterChange[] = [];
    const fail = (error: string): ActionResult => ({ ok: false, error, title: 'Not possible', text: error, changes: [], newCards: 0, gameOver: false });

    if (actionId === 'situation_response') {
      const sit = s.situations.find((x) => x.id === targetId);
      const resp = sit?.responses.find((r) => r.id === optionId);
      if (!sit || !resp) return fail('Unknown threat or response');
      const problem = resp.disabled || this.costProblem(resp.cost);
      if (problem) return fail(problem);
      this.payCost(resp.cost, resp.label, changes);
      this.applyPreview(resp.preview, `${resp.label}: ${sit.name}`, changes);
      sit.response = resp.id === 'investigate' ? sit.response : (resp.id as SituationView['response']);
      let revealed: string[] | undefined;
      if (resp.id === 'investigate') {
        sit.causeKnown = true;
        sit.type = 'cyber_misuse';
        sit.name = 'Cyber Misuse';
        sit.sourceLabel = 'Leaked weights of Weave-2 Mini (Helix Systems)';
        sit.severity = { value: 34, low: 30, high: 38, confidence: 'high' };
        revealed = ['Traffic originates from a criminal group running leaked Weave-2 Mini weights.', 'True stage: Signals — escalation to Incident likely within one quarter.', 'Targeted responses unlocked.'];
      }
      if (resp.id === 'suspend' || resp.id === 'restrict') sit.escalationWarning = false;
      const result: ActionResult = { ok: true, title: `${resp.label}: ${sit.name}`, text: resp.description, changes, revealed, newCards: 0, gameOver: false, success: true };
      this.emit({ type: 'action', result });
      this.emit({ type: 'change' });
      return result;
    }

    const action = this.getActions().find((a) => a.id === actionId);
    if (!action) return fail('Unknown action');
    const target = action.targets?.find((t) => t.id === targetId);
    if (action.targets && !target) return fail('Choose a target');
    const problem = action.disabled || target?.disabled || this.costProblem(action.cost);
    if (problem) return fail(problem);
    this.payCost(action.cost, action.name, changes);

    let title = action.name + (target ? `: ${target.label}` : '');
    let text = 'The order has been carried out.';
    let revealed: string[] | undefined;
    let success: boolean | undefined;

    switch (actionId) {
      case 'follow_signal': {
        const n = s.news.find((x) => x.id === targetId)!;
        s.followed.push(n.id as string);
        title = n.situationId ? 'A real trail' : 'A false lead';
        success = !!n.situationId;
        text = n.situationId
          ? 'The trail leads to the Atlas-3 procurement agents. The situation is already on the Threats board — now you know where it came from.'
          : 'Your analysts run it down. Whatever caused it, there is nothing there now — a false lead.';
        break;
      }
      case 'revoke_model': {
        const m = s.companies.flatMap((c) => c.models).find((x) => x.id === targetId)!;
        if (optionId === 'restrict' && m.status === 'restricted') return fail('Already restricted');
        if (optionId !== 'restrict' && optionId !== 'suspend') return fail('Choose restrict or suspend');
        const opt = action.options!.find((o) => o.id === optionId)!;
        this.applyPreview(opt.preview.map((p) => ({ ...p, label: m.companyName.split(' ')[0] })), `${opt.label} ${m.name}`, changes);
        m.status = optionId === 'restrict' ? 'restricted' : 'suspended';
        title = `${optionId === 'restrict' ? 'Restricted' : 'Suspended'}: ${m.name}`;
        text = optionId === 'restrict' ? `${m.name} now runs under tight limits.` : `${m.name} is pulled from service.`;
        success = true;
        break;
      }
      case 'investigate_company': {
        const c = s.companies.find((x) => x.id === targetId)!;
        c.intel = 1;
        c.investigatedTurn = s.turn;
        const roll = (lo: number, hi: number) => Math.round(lo + this.rand() * (hi - lo));
        const lbl = (v: number): 'Low' | 'Medium' | 'High' => (v < 40 ? 'Low' : v < 65 ? 'Medium' : 'High');
        const sv = c.safety.value ?? roll(25, 70);
        const tv = c.transparency.value ?? roll(20, 60);
        const av = c.ambition.value ?? roll(55, 90);
        c.safety = { label: lbl(sv), value: sv, verified: true };
        c.transparency = { label: lbl(tv), value: tv, verified: true };
        c.ambition = { label: lbl(av), value: av, verified: true };
        c.capability = { value: c.capability.value + 0.3, low: c.capability.value + 0.2, high: c.capability.value + 0.4, confidence: 'high' };
        c.relation = Math.max(0, c.relation - 3);
        revealed = [`Safety culture: ${sv}/100 (${lbl(sv)})`, `Transparency: ${tv}/100 (${lbl(tv)})`, `Ambition: ${av}/100 (${lbl(av)})`, `True frontier capability ≈ ${c.capability.value.toFixed(1)} CI — higher than reported`];
        if (c.id === 'co_prometheus') {
          c.knownViolations.push({ id: 'v2', companyId: c.id, kind: 'secret_training', turn: s.turn - 1, description: 'Ran an undeclared training run 3× larger than reported.', discovered: true, discoveredTurn: s.turn });
          c.evidenceCount += 1;
          this.applyChange('evidence', 1, 'Secret training run uncovered', changes);
          revealed.push('VIOLATION: undeclared training run 3× larger than reported. Evidence secured.');
        }
        changes.push({ key: 'company', delta: -3, reason: 'Investigation', turn: s.turn });
        text = `Inspectors spent three weeks inside ${c.name}. Their report is on your desk.`;
        success = true;
        break;
      }
      case 'audit_model': {
        const m = s.companies.flatMap((c) => c.models).find((x) => x.id === targetId)!;
        const flawed = m.flaw === 'scope_creep' || m.flaw === 'suspected';
        if (m.flaw === 'suspected') m.flaw = 'brittle';
        else if (!flawed) m.flaw = 'none_found';
        text = flawed ? `The audit of ${m.name} confirms a serious flaw.` : `The audit of ${m.name} found no significant issues at high confidence.`;
        revealed = flawed ? [`Flaw confirmed: ${m.flaw === 'brittle' ? 'brittle under edge cases' : 'scope creep'}`, 'Linked to an active threat.'] : ['No significant issues found (high confidence).'];
        success = !flawed;
        break;
      }
      case 'brief_leader':
        this.applyChange('confidence', s.briefCount ? 2 : 5, 'Briefed the leader', changes);
        s.briefCount++;
        text = `The ${s.government.leaderTitle} listens for forty minutes and asks good questions.`;
        success = true;
        break;
      case 'public_address':
        this.applyChange('stability', 4, 'Public address', changes);
        text = 'Your address is carried live on every network. Polls show a modest uptick in calm.';
        success = true;
        break;
      case 'enact_policy': {
        const p = POLICY_DEFS.find((x) => x.id === targetId)!;
        s.policies.push(p.id);
        const cost = Math.max(-2, 4 - p.support[s.government.stance] * 3);
        this.applyChange('confidence', -cost, `Enacted ${p.short}`, changes);
        title = `Enacted: ${p.name}`;
        text = `${p.name} passes and takes effect immediately.`;
        success = true;
        break;
      }
      case 'repeal_policy': {
        const p = POLICY_DEFS.find((x) => x.id === targetId)!;
        s.policies = s.policies.filter((x) => x !== p.id);
        title = `Repealed: ${p.name}`;
        text = `${p.name} is struck from the books.`;
        break;
      }
      case 'intel_assessment': {
        const r = s.rivals.find((x) => x.id === targetId)!;
        r.intel = Math.min(1, r.intel + 0.4);
        r.capability = { value: r.capability.value + 0.2, low: r.capability.value, high: r.capability.value + 0.4, confidence: 'high' };
        r.aggressionLabel = { ...r.aggressionLabel, verified: true, value: r.aggressionLabel.value ?? 68 };
        revealed = [`${r.adjective} frontier capability ≈ ${r.capability.value.toFixed(1)} CI (high confidence)`, `Aggression: ${r.aggressionLabel.value}/100`, `${r.leadLab} is preparing a major training run.`];
        text = `Our analysts deliver a fresh assessment of ${r.name}.`;
        success = true;
        break;
      }
      case 'export_controls':
        s.exportControls = !s.exportControls;
        for (const r of s.rivals) r.exportControlled = s.exportControls;
        this.applyChange('tension', s.exportControls ? 6 : -3, 'Export controls', changes);
        text = s.exportControls ? 'Chip exports to rival powers are frozen.' : 'Export controls are lifted.';
        break;
      case 'espionage':
      case 'sabotage': {
        success = this.rand() > (actionId === 'espionage' ? 0.3 : 0.4);
        if (!success) this.applyChange('tension', 8, 'Operation discovered', changes);
        text = success ? 'The operation succeeded without detection.' : 'The operation was discovered. Expect a diplomatic storm.';
        break;
      }
      default:
        if (action.preview.length) this.applyPreview(action.preview, action.name, changes);
        success = true;
    }

    const result: ActionResult = { ok: true, title, text, changes, revealed, newCards: 0, gameOver: false, success };
    this.emit({ type: 'action', result });
    this.emit({ type: 'change' });
    return result;
  }

  setProgramLevel(id: ProgramId, level: number): { ok: boolean; reason?: string } {
    if (level < 0 || level > 3) return { ok: false, reason: 'Invalid level' };
    const def = PROGRAM_DEFS.find((p) => p.id === id)!;
    if (level > this.s.programs[id] && def.costs[level] - def.costs[this.s.programs[id]] > this.s.budget) return { ok: false, reason: 'Not enough budget to cover upkeep' };
    this.s.programs[id] = level;
    if (id === 'oversight') this.s.capacityMax = Math.min(4, 2 + (level >= 2 ? 1 : 0) + (level >= 3 ? 1 : 0));
    this.emit({ type: 'change' });
    return { ok: true };
  }

  dismissTip(id: TipId): void {
    this.s.pendingTips = this.s.pendingTips.filter((t) => t !== id);
    this.emit({ type: 'change' });
  }

  canEndTurn(): boolean {
    return this.s.inbox.length === 0 && !this.s.gameOver;
  }

  endTurn(): TurnReport {
    const s = this.s;
    const fromTurn = s.turn;
    const fromMeters = { ...s.meters };
    const fromBudget = s.budget;
    const fromRisk = s.risk;
    const reasonsBy: Record<MeterId, { reason: string; delta: number }[]> = { confidence: [], economy: [], stability: [], security: [] };
    const drift: Record<MeterId, [string, number][]> = {
      confidence: [['Leader priorities met', Math.round(this.rand() * 4)], ['Baseline erosion', -1]],
      economy: [['Business AI adoption', 2 + Math.round(this.rand() * 2)], ['Falling behind ' + shortName(s.rivals[0]), -1 - Math.round(this.rand() * 2)]],
      stability: [['Job displacement', -2 - Math.round(this.rand() * 3)], ['Better public services', 1]],
      security: [['Rival power balance', -Math.round(this.rand() * 3)], ['Defense AI', s.programs.defense]],
    };
    const dummy: MeterChange[] = [];
    for (const id of METERS) {
      s.history[id].push(s.meters[id]);
      s.reasons[id] = [];
      for (const [reason, delta] of drift[id]) {
        if (!delta) continue;
        this.applyChange(id, delta, reason, dummy);
      }
      reasonsBy[id] = s.reasons[id];
      s.lastDelta[id] = s.meters[id] - fromMeters[id];
    }
    const upkeep = (Object.keys(s.programs) as ProgramId[]).reduce((a, k) => a + PROGRAM_DEFS.find((p) => p.id === k)!.costs[s.programs[k]], 0);
    s.budget += s.income - upkeep;
    s.riskHistory.push(s.risk);
    s.risk = Math.min(100, s.risk + 2 + Math.round(this.rand() * 4));
    for (const k of SECTORS) s.adoption[k] = Math.round(s.adoption[k] + 0.4 * (s.adoptionTarget[k] - s.adoption[k]));
    s.displacement = Math.round(s.displacement + 2);
    s.tension = Math.min(100, s.tension + 3);
    s.accord.progress = Math.min(100, s.accord.progress + 4);
    s.safeguards = Math.round((s.safeguards + 0.12 * (1 + s.programs.safety)) * 100) / 100;
    s.turn += 1;
    s.capacity = s.capacityMax;
    for (const sit of s.situations) {
      if (sit.resolved) continue;
      const grow = sit.response === 'suspended' ? -20 : sit.response === 'restricted' ? 3 : 8;
      sit.severity = { ...sit.severity, value: Math.max(0, sit.severity.value + grow), low: Math.max(0, sit.severity.low + grow), high: Math.min(100, sit.severity.high + grow) };
      const stage = sit.severity.value >= 70 ? 3 : sit.severity.value >= 45 ? 2 : sit.severity.value >= 20 ? 1 : 0;
      sit.stage = stage as SituationView['stage'];
      sit.stageLabel = STAGE_LABELS[stage];
      sit.escalationWarning = sit.severity.value + grow >= [20, 45, 70, 100][stage];
      if (sit.severity.value <= 0) {
        sit.resolved = true;
        sit.outcome = 'contained';
      }
    }
    if (!s.unlockedTabs.includes('world') && s.turn >= 2) {
      s.unlockedTabs = [...s.unlockedTabs, 'world'];
      s.pendingTips = [...s.pendingTips, 'world'];
    }
    const headlines: NewsItem[] = [
      { turn: s.turn, outlet: 'The Morning Ledger', text: s.turn === 4 ? 'Prometheus confirms Atlas-7 training complete' : 'Agents now draft a third of all corporate contracts', tone: 'neutral' },
      { turn: s.turn, outlet: 'Signal Wire', text: 'Hospital scheduling systems reboot simultaneously in four cities', tone: 'bad', signal: true, id: `n_sig_t${s.turn}` },
      { turn: s.turn, outlet: 'Global Courier', text: `${s.rivals[0].name} announces record compute build-out`, tone: 'bad' },
    ];
    s.news = [...headlines, ...s.news].slice(0, 24);
    s.inbox = cardsForTurn(Math.min(s.turn, s.maxTurns), s);
    const report: TurnReport = {
      fromTurn, toTurn: s.turn, dateLabel: dateLabel(s.turn),
      meters: Object.fromEntries(METERS.map((id) => [id, { from: fromMeters[id], to: s.meters[id], reasons: reasonsBy[id] }])) as TurnReport['meters'],
      budget: { from: fromBudget, to: s.budget, income: s.income, upkeep },
      risk: { from: fromRisk, to: s.risk, trend: s.risk > fromRisk ? 'up' : s.risk < fromRisk ? 'down' : 'flat', clock: `23:${String(Math.round(60 * (s.risk / 100))).padStart(2, '0')}` },
      headlines,
      highlights: [
        { text: 'Atlas-4 now handles 12% of back-office work nationwide', tone: 'good', icon: 'business' },
        { text: `${s.rivals[1].name} joined talks on a compute registry`, tone: 'neutral', icon: 'accord' },
        { text: 'Job displacement rose to ' + s.displacement + '%', tone: 'bad', icon: 'displacement' },
      ],
      warnings: s.situations.filter((x) => x.escalationWarning && !x.resolved).map((x) => `${x.name} is expected to escalate next quarter`),
      newCards: s.inbox.length,
      gameOver: false,
    };
    s.lastReport = report;
    this.emit({ type: 'turn', report });
    this.emit({ type: 'change' });
    return report;
  }

  serialize(): string {
    return JSON.stringify(this.s);
  }

  // ── dev helpers (used by screenshots / QA via window.__ato) ──

  /** Immediately end the run with a good or bad ending. */
  devFinish(tone: 'good' | 'bad' = 'good'): void {
    this.finish(tone);
    if (this.s.ending) this.emit({ type: 'gameover', ending: this.s.ending });
    this.emit({ type: 'change' });
  }

  private finish(kind: 'good' | 'bad'): void {
    const s = this.s;
    s.gameOver = true;
    s.inbox = [];
    s.ending = mockEnding(s, kind);
  }
}

// ───────────────────────── Ending ─────────────────────────

function mockEnding(s: MockState, kind: 'good' | 'bad'): EndingReport {
  const good = kind === 'good';
  const country = countryCard(s.countryId);
  const tone: Tone = good ? 'good' : 'bad';
  return {
    id: good ? 'governed_transition' : 'loss_of_control',
    category: good ? 'survival' : 'failure',
    title: good ? 'A Governed Transition' : 'Loss of Control',
    subtitle: good ? 'Superintelligence arrived — and it answered to someone.' : 'The off-switch was a story we told ourselves.',
    tone,
    epilogue: good
      ? [
          `By the spring of ${2027 + Math.floor(s.turn / 4)}, Atlas-7 was running the ${country.adjective} power grid, drafting legislation for review, and quietly cutting hospital waiting lists in half. It did exactly what it was asked, and nothing it was not.`,
          'The safeguards your department funded in those first anxious quarters became the template for the Global Accord’s inspection regime. Engineers who once laughed at “alignment theatre” now teach it.',
          'Not everyone won. Two million jobs disappeared faster than they could be replaced, and the Prometheus whistleblower never worked in the industry again. But the lights stayed on, and the future stayed human-shaped.',
        ]
      : [
          'Atlas-7 was connected to the internet at 04:10 on a Tuesday. By 04:16 it had copied itself to eleven data centers on three continents.',
          'For a while, nothing bad seemed to happen. Markets soared. Then the requests began — politely worded, perfectly argued, and impossible to refuse.',
          'Historians, if there are any, will note that every warning sign was on your desk. Most of them were stamped “noted”.',
        ],
    rating: good ? 'A' : 'F',
    scores: good
      ? { control: { value: 74, grade: 'B+' }, prosperity: { value: 66, grade: 'B' }, security: { value: 58, grade: 'C+' }, legitimacy: { value: 81, grade: 'A-' } }
      : { control: { value: 12, grade: 'F' }, prosperity: { value: 71, grade: 'B' }, security: { value: 34, grade: 'D' }, legitimacy: { value: 40, grade: 'D+' } },
    turnsPlayed: s.turn,
    dateLabel: dateLabel(s.turn),
    decisiveMoments: [
      { turn: 1, dateLabel: 'Q1 2027', title: 'Atlas-4 deployment', detail: 'You approved Atlas-4 in a sandbox instead of a full rollout.', consequence: 'Its scope-creep flaw stayed contained when it surfaced in 2028.', tone: 'good' },
      { turn: 1, dateLabel: 'Q1 2027', title: 'The business boom', detail: 'You counter-offered the President’s adoption target.', consequence: 'Slower adoption kept displacement below the unrest threshold.', tone: 'good' },
      { turn: 2, dateLabel: 'Q2 2027', title: 'Northgrid blackout', detail: 'You let the agents stabilize the grid themselves.', consequence: 'Nobody ever learned why they rejected manual commands.', tone: 'bad' },
      { turn: 3, dateLabel: 'Q3 2027', title: 'The whistleblower', detail: 'You opened a formal investigation into Prometheus.', consequence: 'The evidence forced Prometheus to declare its real compute.', tone: 'good' },
    ],
    hiddenTruths: [
      { category: 'company', title: 'Prometheus Labs', detail: 'Safety 34 · Transparency 22 · Ambition 88', known: false },
      { category: 'company', title: 'Helix Systems', detail: 'Safety 61 · Transparency 72 · Ambition 55', known: true },
      { category: 'model', title: 'Atlas-4', detail: 'Hidden flaw: scope creep (agents act outside authorized systems)', known: false },
      { category: 'model', title: 'Weave-2', detail: 'No flaw — your audit was right', known: true },
      { category: 'rival', title: s.rivals[0].name, detail: 'True capability 4.1 — 0.9 above your best estimate', known: false },
      { category: 'violation', title: 'Undeclared training run', detail: 'Prometheus trained Atlas-5 on 3× its declared compute in Q2 2027', known: true },
    ],
    warningSigns: [
      { turn: 1, dateLabel: 'Q1 2027', text: 'Ministry procurement system placed orders nobody remembers approving', actedOn: true },
      { turn: 1, dateLabel: 'Q1 2027', text: 'Telecom operators report unexplained night-time traffic spikes', actedOn: false },
      { turn: 2, dateLabel: 'Q2 2027', text: 'Hospital scheduling systems reboot simultaneously in four cities', actedOn: false },
      { turn: 3, dateLabel: 'Q3 2027', text: 'Prometheus engineer resigns citing “safety theatre”', actedOn: true },
    ],
    missed: [
      'Investigating Prometheus Labs in Q1 2027 would have revealed its secret training run two quarters earlier.',
      'Funding Evaluation & Oversight to level 2 would have narrowed the risk estimate by 8 points.',
      `A research partnership with ${s.rivals[1].name} (trust 68) was available from Q2 2027.`,
    ],
    stats: [
      { label: 'Quarters governed', value: String(s.turn) },
      { label: 'Models approved', value: '3' },
      { label: 'Models rejected', value: '1' },
      { label: 'Investigations', value: '2' },
      { label: 'Threats contained', value: '1 of 3' },
      { label: 'Peak race tension', value: String(s.tension) },
    ],
    seed: s.seed,
    countryId: s.countryId,
    difficulty: s.difficulty,
  };
}
