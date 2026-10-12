/**
 * OVERSIGHT — shared code contract.
 *
 * This file is the single source of truth shared by the engine, content, UI, art, fx and audio modules.
 * Rules for all contributors:
 *  - Do NOT rename or remove anything exported here. Adding optional fields is allowed (engine owner).
 *  - The UI must read hidden information ONLY via the fogged `GameView` returned by `GameAPI.view()`.
 *  - Design intent and numbers live in docs/GDD.md.
 */

// ───────────────────────────── IDs & enums ─────────────────────────────

export type CountryId = 'atlantic' | 'hanzhou' | 'commonwealth' | 'meridian';
export type MeterId = 'confidence' | 'economy' | 'stability' | 'security';
export type SectorId = 'business' | 'public' | 'infrastructure' | 'defense';
export type ProgramId = 'safety' | 'oversight' | 'compute' | 'workforce' | 'defense';
export type PolicyId =
  | 'mandatory_evals'
  | 'compute_licensing'
  | 'incident_reporting'
  | 'open_weights_ban'
  | 'liability_act'
  | 'infra_firewall'
  | 'ai_dividend'
  | 'kill_switch'
  | 'human_in_loop'
  | 'fast_track';
export type Stance = 'accelerationist' | 'hawk' | 'cautious' | 'populist';
export type Archetype = 'frontier' | 'bigtech' | 'defense' | 'opensource';
export type FlawType = 'scope_creep' | 'deceptive' | 'brittle' | 'manipulative' | 'jailbreakable' | 'power_seeking';
export type SituationType =
  | 'rogue_agents'
  | 'deceptive_model'
  | 'infrastructure_failure'
  | 'mass_manipulation'
  | 'cyber_misuse'
  | 'bio_misuse'
  | 'military_escalation'
  | 'model_escape'
  | 'foreign_spillover';
export type AdvisorId = 'chief_of_staff' | 'scientist' | 'economist' | 'intelligence';
export type Difficulty = 'analyst' | 'director' | 'doomer';
export type Era = 'emergence' | 'acceleration' | 'superhuman' | 'threshold';
export type TabId = 'inbox' | 'labs' | 'nation' | 'world' | 'threats';
export type Confidence = 'verified' | 'high' | 'medium' | 'low' | 'redacted';
export type Urgency = 'routine' | 'priority' | 'critical';
export type Tone = 'good' | 'neutral' | 'bad' | 'mixed';

export type EndingId =
  // failures
  | 'dismissed'
  | 'economic_collapse'
  | 'civil_unrest'
  | 'national_defeat'
  | 'loss_of_control'
  | 'catastrophe'
  | 'ai_war'
  // survival
  | 'governed_transition'
  | 'prosperous_pioneer'
  | 'hegemon'
  | 'safe_harbor'
  | 'fragile_future';

export type DemandKind =
  | 'growth_target'
  | 'deploy_sector'
  | 'approve_model'
  | 'match_rival'
  | 'budget_cut'
  | 'cover_up'
  | 'jobs_guarantee'
  | 'defense_program';

export type ActionId =
  | 'investigate_company'
  | 'audit_model'
  | 'investigate_situation'
  | 'situation_response'
  | 'safety_grant'
  | 'compute_contract'
  | 'enforcement'
  | 'brief_leader'
  | 'public_address'
  | 'enact_policy'
  | 'repeal_policy'
  | 'intel_assessment'
  | 'diplomatic_initiative'
  | 'research_partnership'
  | 'export_controls'
  | 'espionage'
  | 'sabotage'
  | 'talent_recruitment'
  /** (engine) chase a warning-sign headline: detection roll on whatever caused it */
  | 'follow_signal'
  /** (engine) restrict or suspend any deployed model directly (option 'restrict' | 'suspend') */
  | 'revoke_model';

export type CardKind =
  | 'deployment'
  | 'demand'
  | 'negotiation'
  | 'situation'
  | 'event'
  | 'election'
  | 'breakthrough'
  | 'treaty'
  | 'last_chance'
  | 'threshold'
  | 'intro';

export type CardSourceType = 'company' | 'government' | 'foreign' | 'intelligence' | 'public' | 'ai' | 'advisor' | 'media';

/** Keys that can appear in choice previews and in recorded changes. */
export type PreviewKey =
  | MeterId
  | 'budget'
  | 'income'
  | 'capacity'
  | 'evidence'
  | 'risk'
  | 'safeguards'
  | 'capability'
  | 'adoption'
  | 'displacement'
  | 'tension'
  | 'accord'
  | 'company'
  | 'rival';

// ───────────────────────────── Content definitions ─────────────────────────────
// (written by the content/narrative module, consumed by the engine)

export interface CountryDef {
  id: CountryId;
  name: string; // "Atlantic Federation"
  shortName: string; // "Atlantic"
  adjective: string; // "Atlantic"
  capital: string;
  leaderTitle: string; // "President"
  color: string; // primary emblem color (hex)
  color2: string; // secondary emblem color (hex)
  tagline: string; // one-line pitch on the country select screen
  description: string; // 2–3 sentences
  strengths: string[]; // bullet lines for select screen
  weaknesses: string[];
  /** Mechanics (see GDD §13) */
  start: { confidence: number; economy: number; stability: number; security: number; budget: number };
  incomeBase: number;
  compute: number; // national compute multiplier (also used when this country is a rival)
  labCapRange: [number, number]; // starting capability range for domestic labs
  startSafeguards: number;
  stancePool: Stance[]; // possible leader stances
  calendar: { turn: number; kind: 'election' | 'congress' }[];
  traitPlus: { name: string; text: string };
  traitMinus: { name: string; text: string };
  /** Base modifiers always active for this country (when played). */
  modifiers: Partial<Modifiers>;
  /** Starting trust this country has toward each other country (when played or as rival), 0–100. */
  trust: Partial<Record<CountryId, number>>;
  /** As a rival: personality ranges */
  rival: { aggression: [number, number]; safetyStance: [number, number]; leadLab: string };
  /** Intro briefing paragraphs shown at game start (templated: {leader}, {leaderTitle}, ...). */
  intro: string[];
}

export interface CompanyTemplate {
  id: string; // unique across all countries, e.g. 'atl_prometheus'
  name: string; // "Prometheus Labs"
  archetype: Archetype;
  tagline: string; // "Building minds that build the future."
  description: string; // 1–2 sentences
  color: string; // brand hex
  modelStem: string; // "Atlas" → models "Atlas-4", "Atlas-5"
  startModelNumber: number; // e.g. 3 → first new model is "Atlas-4"
  /** Hidden trait ranges, randomized per run */
  safety: [number, number];
  transparency: [number, number];
  ambition: [number, number];
  compute: [number, number];
  ceo: string; // CEO name for flavor
}

export interface LeaderTemplate {
  name: string;
  /** Optional stance lock; if absent the stance is drawn from the country pool. */
  stance?: Stance;
  bio: string; // one line
}

export interface AdvisorDef {
  id: AdvisorId;
  name: string;
  role: string; // "Chief Scientist"
  bias: string; // one-line description of their bias, shown in UI
  portraitSeed: number;
}

/** Scripted narrative event (content). See GDD §11. */
export interface EventDef {
  id: string;
  title: string; // templated
  text: string; // templated, 40–110 words
  source: CardSourceType;
  sourceName?: string; // templated, e.g. "{company}", "Anonymous source", "The Morning Ledger"
  urgency?: Urgency;
  tags?: string[]; // 'ai' adds glitch styling; also 'crisis','politics','economy','world','labs','society','military'
  weight?: number | ((s: GameState, ctx: EventContext) => number); // default 1
  minTurn?: number;
  maxTurn?: number;
  eras?: Era[];
  countries?: CountryId[];
  stances?: Stance[]; // leader stance filter
  once?: boolean; // default true
  cooldown?: number; // turns, when once === false
  /** Only fires via followUp/schedule, never drawn randomly. */
  followUpOnly?: boolean;
  requires?: (s: GameState, ctx: EventContext) => boolean;
  bind?: EventBindings;
  evidence?: EvidenceLineDef[];
  choices: EventChoiceDef[]; // 2–4
  /** (engine) hand-written advisor notes (templated). When present, they replace engine-generated notes. */
  advice?: Partial<Record<AdvisorId, string>>;
}

export interface EventBindings {
  company?: (c: Company, s: GameState) => boolean;
  rival?: (r: Rival, s: GameState) => boolean;
  model?: (m: AIModel, s: GameState) => boolean;
  situation?: (x: Situation, s: GameState) => boolean;
  sector?: SectorId[];
}

export interface EvidenceLineDef {
  label: string; // templated
  value: string; // templated
  confidence: Confidence;
}

export interface EventChoiceDef {
  id: string;
  label: string; // templated, ≤ 48 chars
  hint?: string; // templated one-line consequence hint
  requires?: (s: GameState, ctx: EventContext) => boolean | string; // string = disabled reason
  cost?: Cost;
  effects?: Effect; // immediate
  /** Probabilistic outcome: exactly one is picked (chances normalized). */
  outcomes?: EventOutcomeDef[];
  showChance?: boolean; // show the first outcome's chance as a % on the button
  resultText?: string; // templated narrative shown after choosing (if no outcome text)
  followUp?: FollowUpDef | FollowUpDef[];
  /** Decision log entry for the debrief (templated). If set, the decision counts as a key moment. */
  log?: string;
  stamp?: Stamp;
  tone?: 'safe' | 'risky' | 'aggressive' | 'neutral';
}

export interface EventOutcomeDef {
  chance: number | ((s: GameState, ctx: EventContext) => number);
  effects?: Effect;
  text: string; // templated result narrative
  followUp?: FollowUpDef | FollowUpDef[];
  success?: boolean;
}

export interface FollowUpDef {
  event: string; // EventDef id
  delay: number | [number, number]; // turns
  chance?: number; // 0–1, default 1
}

export type Stamp = 'approved' | 'rejected' | 'deferred' | 'noted' | 'signed' | 'denied' | 'classified' | 'urgent';

/** Declarative effect. Engine applies; UI previews visible parts. */
export interface Effect {
  meters?: Partial<Record<MeterId, number>>;
  budget?: number;
  income?: number; // permanent change to income per quarter
  capacity?: number; // this quarter only
  evidence?: number; // +N generic evidence (about bound company if any)
  risk?: number; // hidden global risk
  safeguards?: number;
  capability?: number; // applies to bound company, else domestic leading company
  adoption?: Partial<Record<SectorId, number>>; // change adoption *targets*
  displacement?: number;
  tension?: number;
  accord?: number;
  company?: { relation?: number; safety?: number; transparency?: number; ambition?: number; capability?: number; intel?: number };
  rival?: { trust?: number; capability?: number; safeguards?: number; aggression?: number; intel?: number };
  allRivals?: { trust?: number; capability?: number; aggression?: number };
  /** Spawn a new situation (source = bound model/company/rival) or modify the bound one. */
  situation?: {
    spawn?: SituationType;
    severity?: number; // spawn severity or delta for the bound situation
    detected?: boolean;
    growth?: number; // multiplier delta for bound situation
    resolve?: boolean;
  };
  /** Change status of bound model */
  model?: { status?: AIModel['status'] };
  /** (engine) enact or repeal a law as part of the effect (no capacity/political cost) */
  policy?: { enact?: PolicyId; repeal?: PolicyId };
  flags?: Record<string, boolean | number | string>;
  /** Escape hatch for anything else. Must be deterministic: use helpers.rand(). */
  custom?: (s: GameState, ctx: EventContext, h: EffectHelpers) => void;
}

export interface Cost {
  capacity?: number;
  budget?: number;
  evidence?: number;
  confidence?: number;
}

/** Entities bound to an event instance. */
export interface EventContext {
  company?: Company;
  rival?: Rival;
  model?: AIModel;
  situation?: Situation;
  sector?: SectorId;
  demand?: Demand;
}

/** Helpers passed to custom effects. */
export interface EffectHelpers {
  rand(): number; // deterministic 0..1
  meter(id: MeterId, delta: number, reason: string): void;
  risk(delta: number, reason: string): void;
  spawnSituation(type: SituationType, opts?: { severity?: number; companyId?: string; modelId?: string; rivalId?: CountryId; sector?: SectorId; detected?: boolean }): Situation;
  schedule(eventId: string, delay: number, ctx?: EventContext): void;
  log(text: string, key?: boolean): void;
  news(text: string): void;
  text(template: string): string; // resolve template tokens with current ctx
}

/** Flavor for each situation type (content). Templates may use {company} {model} {sector} {rival}. */
export interface SituationFlavor {
  name: string; // "Rogue Agents"
  unknownName: string; // before investigation: "Network Anomaly"
  icon: string; // art icon name
  /** Card/panel text per stage 0..4 */
  stages: [string, string, string, string, string];
  /** Vague warning headlines (pre-detection signals) */
  signals: string[];
  catastropheTitle: string;
  catastropheText: string;
  /** Text when contained/resolved */
  resolvedText: string;
}

/** Red-team evaluation lines per flaw (content). */
export interface FlawFlavor {
  name: string; // "Scope creep"
  findings: string[]; // shown when detected, e.g. "Agent attempted to read credentials outside its sandbox in 3/50 runs."
  description: string; // debrief explanation
}

export type HeadlineTrigger =
  | 'rival_breakthrough'
  | 'domestic_breakthrough'
  | 'model_release'
  | 'model_approved'
  | 'model_rejected'
  | 'economy_up'
  | 'economy_down'
  | 'stability_down'
  | 'jobs'
  | 'security_down'
  | 'adoption'
  | 'accord_progress'
  | 'accord_signed'
  | 'tension_high'
  | 'election'
  | 'situation_public'
  | 'policy_enacted'
  | 'espionage'
  | 'calm';

export interface HeadlineBank {
  generic: Record<Era, string[]>; // flavor headlines by era (templated)
  triggered: Record<HeadlineTrigger, string[]>; // templated; may use {company} {model} {rival} {sector} {policy}
  outlets: string[]; // news outlet names
}

export interface EndingText {
  title: string;
  subtitle: string;
  tone: Tone;
  epilogue: string[]; // 2–4 templated paragraphs
}

export type TipId =
  | 'welcome'
  | 'inbox'
  | 'labs'
  | 'nation'
  | 'world'
  | 'threats'
  | 'first_deployment'
  | 'first_demand'
  | 'first_situation'
  | 'risk_clock'
  | 'capacity'
  | 'evidence'
  | 'end_turn'
  | 'low_confidence';

export interface TipDef {
  title: string;
  text: string;
  advisor: AdvisorId;
}

// ───────────────────────────── Mechanics data (engine-owned) ─────────────────────────────

/** Numeric modifiers aggregated from country traits, programs, policies, flags. All default 0. */
export interface Modifiers {
  detection: number; // additive to evaluation detection chance
  earlyWarning: number; // additive to situation detection chance
  riskUncertainty: number; // additive to risk-estimate half-width
  capabilityGrowth: number; // multiplier delta for domestic capability growth (e.g. -0.15)
  safeguardsGrowth: number; // additive per turn
  deploymentGain: number; // multiplier delta for adoption gained from deployments
  adoptionRamp: number; // multiplier delta for adoption approach speed
  displacementMitigation: number; // 0..1 reduces stability loss from displacement
  companyRelation: number; // per-turn drift to all company relations
  companySafety: number; // per-turn drift
  companyTransparency: number; // per-turn drift
  companyAmbition: number; // per-turn drift
  violationChance: number; // multiplier delta
  misuseSpawn: number; // multiplier delta
  incidentSeverity: number; // multiplier delta for all situation growth
  infraIncident: number; // multiplier delta for infrastructure_failure growth
  escalationGrowth: number; // multiplier delta for military_escalation growth
  escapeGrowth: number; // multiplier delta for model_escape growth
  infraAdoptionCap: number; // absolute cap if > 0
  riskPerTurn: number;
  economyPerTurn: number;
  stabilityPerTurn: number;
  securityPerTurn: number;
  confidencePerTurn: number;
  tensionPerTurn: number;
  incomePerTurn: number;
  capacity: number;
  policyCostMult: number; // multiplier delta for policy political cost
  accordGain: number; // multiplier delta
  exportControlPower: number; // multiplier delta
  confidenceVolatility: number; // multiplier delta on confidence changes
  displacementSensitivity: number; // multiplier delta
  killSwitch: number; // > 0 unlocks emergency shutdown
}

export interface ProgramDef {
  id: ProgramId;
  name: string;
  short: string;
  description: string;
  icon: string;
  costs: [number, number, number, number]; // upkeep per level
  /** Modifiers granted at each level (index = level) */
  levels: [Partial<Modifiers>, Partial<Modifiers>, Partial<Modifiers>, Partial<Modifiers>];
  levelText: [string, string, string, string];
}

export interface PolicyDef {
  id: PolicyId;
  name: string;
  short: string;
  description: string;
  icon: string;
  effectsText: string[]; // bullet lines for UI
  modifiers: Partial<Modifiers>;
  /** −2..+2 leader support by stance; political cost = max(0, 4 − support×3) */
  support: Record<Stance, number>;
  /** one-time effect on enactment */
  onEnact?: Effect;
}

// ───────────────────────────── Runtime state ─────────────────────────────

export interface Company {
  id: string;
  templateId: string;
  name: string;
  archetype: Archetype;
  tagline: string;
  description: string;
  color: string;
  ceo: string;
  modelStem: string;
  nextModelNumber: number;
  // hidden truth
  capability: number;
  reportedCapability: number;
  safety: number;
  transparency: number;
  ambition: number;
  compute: number;
  // relations & knowledge
  relation: number; // 0–100
  intel: number; // 0–1
  lastInvestigatedTurn: number | null;
  knownTraits: { safety: boolean; transparency: boolean; ambition: boolean };
  // model cadence
  capAtLastModel: number;
  lastModelTurn: number;
  violations: Violation[];
  status: 'active' | 'sanctioned' | 'suspended';
  sanctions: number;
  /** (engine) capability gained through unreported secret training, hidden from reports until discovered */
  hiddenGain?: number;
}

export interface Violation {
  id: string;
  companyId: string;
  kind: 'secret_training' | 'unreported_incident' | 'unauthorized_deployment' | 'safety_cut';
  turn: number;
  description: string;
  discovered: boolean;
  discoveredTurn?: number;
  /** (engine) the model of an unauthorized deployment */
  modelId?: string;
}

export interface AIModel {
  id: string;
  name: string;
  companyId: string;
  capability: number; // true
  claimedCapability: number;
  releasedTurn: number;
  flaw: FlawType | null; // hidden truth
  flawKnown: boolean; // player has confirmed the flaw
  falseAlarm: boolean; // evaluation produced an inconclusive warning on a clean model
  openWeights: boolean;
  status: 'pending' | 'evaluating' | 'deployed' | 'limited' | 'restricted' | 'suspended' | 'rejected' | 'internal' | 'rogue_deployed';
  sectors: SectorId[];
  contribution: Partial<Record<SectorId, number>>; // adoption target contributed
  situationId?: string;
  deepEvaluated: boolean;
  evalDetected: boolean; // the evaluation shown to the player detected the flaw
  decisionTurn?: number;
  decisionLogId?: string;
  /** (engine) the evaluation shown to the player raised an inconclusive warning (true for false alarms too) */
  suspected?: boolean;
  /** (engine) a deep evaluation or audit ran without finding anything */
  audited?: boolean;
  /** (engine) confidence label of the latest evaluation shown to the player */
  evalConfidence?: Confidence;
  lastCheckTurn?: number;
  lastCheckDetection?: number;
}

export interface Rival {
  id: CountryId;
  name: string;
  adjective: string;
  leaderTitle: string;
  color: string;
  color2: string;
  leadLab: string;
  // hidden truth
  capability: number;
  safeguards: number;
  aggression: number; // 0–1
  safetyStance: number; // 0–1
  compute: number;
  // knowledge
  intel: number; // 0–1
  estimateBias: number; // persistent error in capability estimate
  // relations
  trust: number; // 0–100 toward the player
  accordMember: boolean;
  defected: boolean;
  exportControlled: boolean;
  partnership: boolean;
}

export interface Government {
  leaderName: string;
  leaderBio: string;
  leaderTitle: string;
  stance: Stance;
  portraitSeed: number;
  resolve: number; // 0–100, how hard they push demands
  briefCount: number;
  sinceTurn: number;
  calendar: { turn: number; kind: 'election' | 'congress' }[];
  lastChanceUsed: boolean;
}

export interface Demand {
  id: string;
  kind: DemandKind;
  title: string;
  text: string;
  status: 'offered' | 'active' | 'met' | 'failed' | 'refused';
  issuedTurn: number;
  deadlineTurn: number;
  target: {
    meter?: MeterId;
    sector?: SectorId;
    value?: number;
    rivalId?: CountryId;
    companyId?: string;
    modelId?: string;
    program?: ProgramId;
    level?: number;
    situationId?: string;
  };
  baseline?: number;
  reward: number; // confidence on success
  penalty: number; // confidence on failure
  softened: boolean;
}

export interface Situation {
  id: string;
  type: SituationType;
  severity: number; // hidden 0–100
  growth: number; // base growth per turn
  growthMult: number; // response multiplier (1 = none)
  stage: 0 | 1 | 2 | 3 | 4;
  detected: boolean;
  detectedTurn?: number;
  causeKnown: boolean;
  source: { companyId?: string; modelId?: string; rivalId?: CountryId; sector?: SectorId };
  spawnedTurn: number;
  signalsShown: number;
  signalTurns: number[];
  response: 'none' | 'monitor' | 'contained' | 'restricted' | 'suspended' | 'shutdown' | 'taskforce';
  responseTurn?: number;
  resolved: boolean;
  resolvedTurn?: number;
  outcome?: 'contained' | 'catastrophe' | 'faded';
  origin: string; // human-readable cause for the debrief
  originLogId?: string;
  /** (engine) one-turn growth multiplier from responses taken this quarter (reset each tick) */
  turnMult?: number;
  /** (engine) first turn the player investigated/responded (for "acted on" in the debrief) */
  firstActionTurn?: number;
  /** (engine) turn of the last response, to limit one response per situation per quarter */
  lastResponseTurn?: number;
  /** (engine) highest stage the player has been notified about */
  notifiedStage?: number;
  /** (engine) peak severity reached */
  peakSeverity?: number;
  /** (engine) unreported company incident: no early-detection boosts */
  noEarlyBoost?: boolean;
}

export interface EvidenceToken {
  id: string;
  companyId?: string;
  rivalId?: CountryId;
  text: string;
  turn: number;
}

export interface ScheduledEvent {
  eventId: string;
  turn: number;
  ctx: CardContext;
}

export interface LogEntry {
  id: string;
  turn: number;
  text: string;
  key: boolean; // decisive-moment candidate
  tone?: Tone;
  refs?: CardContext;
  /** (engine) debrief weight from the English source; set only for translated text */
  w?: number;
  /** (engine) explicit debrief title; set only for translated text */
  title?: string;
}

export interface NewsItem {
  turn: number;
  outlet: string;
  text: string;
  tone: Tone;
  signal?: boolean; // a (possibly vague) warning sign
  situationId?: string;
  /** (engine) stable id for signal items (target of the 'follow_signal' action) */
  id?: string;
}

export interface MeterChange {
  key: PreviewKey;
  delta: number;
  reason: string;
  turn: number;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  volume: number; // 0–1
  reducedMotion: boolean;
  textSpeed: 'instant' | 'fast' | 'normal';
}

export interface GameState {
  version: number;
  seed: number;
  rng: [number, number, number, number]; // sfc32 state
  difficulty: Difficulty;
  dailySeed: boolean;
  countryId: CountryId;
  turn: number; // 1..16
  maxTurns: number; // 16
  meters: Record<MeterId, number>;
  meterHistory: Record<MeterId, number[]>; // value at start of each turn
  changes: MeterChange[]; // all recorded changes (for explain panels & debrief)
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
  risk: number; // hidden truth
  riskBias: number;
  riskHistory: number[]; // displayed estimates per turn
  tension: number;
  accord: { progress: number; signed: boolean; signedTurn?: number };
  companies: Company[];
  models: AIModel[];
  rivals: Rival[];
  government: Government;
  demands: Demand[];
  situations: Situation[];
  inbox: Card[];
  queue: Card[]; // overflow cards for next turns
  scheduled: ScheduledEvent[];
  firedEvents: Record<string, number>; // eventId → last turn fired
  flags: Record<string, boolean | number | string>;
  log: LogEntry[];
  news: NewsItem[];
  unlockedTabs: TabId[];
  tipsShown: TipId[];
  pendingTips: TipId[];
  stats: Record<string, number>; // counters: approvals, rejections, investigations...
  idCounter: number;
  gameOver: boolean;
  ending: EndingReport | null;
  thresholdFired: boolean;
  /** (engine) cumulative hidden risk by source key, for the debrief and failure typing */
  riskSources?: Record<string, number>;
  /** (engine) things that happened during the current quarter (feeds news & the quarter report) */
  turnLog?: TurnLog;
  /** (engine) the most recent quarter report (lets the UI re-open it after a reload) */
  lastReport?: TurnReport | null;
  /** (engine) tips waiting to be released gradually into `pendingTips` */
  tipBacklog?: TipId[];
  /** (engine) hashes of one-off text lines already shown this run (signals, breakthroughs) */
  usedLines?: number[];
}

/** (engine) per-quarter scratch log, reset when a new quarter opens. */
export interface TurnLog {
  triggers: { trigger: HeadlineTrigger; ctx: CardContext; policy?: string }[];
  highlights: { text: string; tone: Tone; icon?: string }[];
}

// ───────────────────────────── Cards & choices ─────────────────────────────

export interface CardSource {
  type: CardSourceType;
  name: string; // "Prometheus Labs", "Office of the President", "Anonymous"
  id?: string; // company id / country id / advisor id
  color?: string;
}

export interface EvidenceLine {
  label: string;
  value: string;
  confidence: Confidence;
}

export interface AdvisorNote {
  advisor: AdvisorId;
  text: string;
}

export interface CardContext {
  companyId?: string;
  modelId?: string;
  rivalId?: CountryId;
  situationId?: string;
  demandId?: string;
  sector?: SectorId;
}

export interface EffectPreview {
  key: PreviewKey;
  dir: 1 | -1 | 0; // 0 = unknown direction
  magnitude: 1 | 2 | 3;
  label?: string; // e.g. company or rival name, sector
  /** (engine) exact signed amount that will be applied, when it is known and not hidden */
  amount?: number;
}

export interface Choice {
  id: string;
  label: string;
  hint?: string;
  preview: EffectPreview[];
  uncertain?: boolean; // has hidden/delayed consequences
  cost?: Cost;
  chance?: number; // 0–1, shown as % when present
  disabled?: string | null;
  stamp?: Stamp;
  tone?: 'safe' | 'risky' | 'aggressive' | 'neutral';
}

export interface Card {
  uid: string;
  kind: CardKind;
  templateId: string; // EventDef id or system template id
  title: string;
  body: string;
  source: CardSource;
  urgency: Urgency;
  evidence?: EvidenceLine[];
  advisors?: AdvisorNote[];
  choices: Choice[];
  ctx: CardContext;
  createdTurn: number;
  tags?: string[];
  /** Optional subtitle line, e.g. "Deployment Request · Business sector" */
  subtitle?: string;
}

export interface ChoiceResult {
  ok: boolean;
  error?: string;
  cardUid: string;
  choiceId: string;
  title: string;
  text: string; // outcome narrative
  changes: MeterChange[]; // what changed immediately
  success?: boolean; // for gambles/negotiations
  stamp?: Stamp;
  newCards: number; // cards added to the inbox as a direct result
  gameOver: boolean;
  /** (engine) uid of a card created by this choice that should be shown next (e.g. "the leader insists") */
  nextCardUid?: string;
}

export interface ActionTarget {
  id: string;
  label: string;
  sublabel?: string;
  disabled?: string | null;
}

export interface ActionView {
  id: ActionId;
  category: 'labs' | 'nation' | 'world' | 'threats' | 'politics';
  name: string;
  description: string;
  icon: string;
  cost: Cost;
  targets?: ActionTarget[]; // if the action needs a target
  options?: { id: string; label: string; description?: string; preview: EffectPreview[]; cost?: Cost; disabled?: string | null }[];
  disabled?: string | null;
  preview: EffectPreview[];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  title: string;
  text: string;
  changes: MeterChange[];
  success?: boolean;
  revealed?: string[]; // lines of newly revealed info
  newCards: number;
  gameOver: boolean;
}

// ───────────────────────────── Fogged views (UI reads these only) ─────────────────────────────

export interface Estimate {
  value: number;
  low: number;
  high: number;
  confidence: Exclude<Confidence, 'redacted'>;
}

export interface TraitView {
  label: 'Low' | 'Medium' | 'High' | 'Unknown';
  value: number | null; // exact only if verified
  verified: boolean;
}

export interface ModelView {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  capability: Estimate;
  status: AIModel['status'];
  sectors: SectorId[];
  openWeights: boolean;
  flaw: FlawType | 'unknown' | 'none_found' | 'suspected';
  releasedTurn: number;
  lastCheck?: { turn: number; confidence?: Confidence; detection?: number };
  situationId?: string; // only if the link is known to the player
}

export interface CompanyView {
  id: string;
  name: string;
  archetype: Archetype;
  tagline: string;
  description: string;
  color: string;
  ceo: string;
  relation: number;
  attitude: 'Cooperative' | 'Friendly' | 'Wary' | 'Hostile';
  status: Company['status'];
  capability: Estimate;
  safety: TraitView;
  transparency: TraitView;
  ambition: TraitView;
  intel: number;
  investigatedTurn: number | null;
  models: ModelView[];
  knownViolations: Violation[];
  evidenceCount: number;
}

export interface RivalView {
  id: CountryId;
  name: string;
  adjective: string;
  leaderTitle: string;
  color: string;
  color2: string;
  leadLab: string;
  capability: Estimate;
  safeguards: Estimate;
  trust: number;
  attitude: 'Ally' | 'Friendly' | 'Neutral' | 'Distrustful' | 'Hostile';
  aggressionLabel: TraitView;
  safetyLabel: TraitView;
  intel: number;
  accordMember: boolean;
  exportControlled: boolean;
  partnership: boolean;
}

export interface ResponseView {
  id: string; // 'monitor' | 'investigate' | 'restrict' | 'suspend' | 'contain' | 'shutdown' | 'taskforce'
  label: string;
  description: string;
  cost?: Cost;
  preview: EffectPreview[];
  disabled?: string | null;
}

export interface SituationView {
  id: string;
  type: SituationType | 'unknown';
  name: string;
  icon: string;
  stage: 0 | 1 | 2 | 3 | 4;
  stageLabel: string; // "Signals", "Incident", "Crisis"...
  text: string;
  severity: Estimate; // rough, fogged
  causeKnown: boolean;
  sourceLabel?: string; // e.g. "Atlas-4 (Prometheus Labs)" when known
  escalationWarning: boolean; // "escalation expected next quarter"
  detectedTurn?: number;
  response: Situation['response'];
  responses: ResponseView[];
  resolved: boolean;
  outcome?: Situation['outcome'];
}

export interface RiskView {
  estimate: number; // 0–100
  low: number;
  high: number;
  clock: string; // "23:41"
  minutesToMidnight: number;
  trend: 'up' | 'down' | 'flat';
  history: number[];
}

export interface DemandView {
  id: string;
  kind: DemandKind;
  title: string;
  text: string;
  status: Demand['status'];
  deadlineTurn: number;
  deadlineLabel: string;
  progress: number; // 0–1
  progressLabel: string; // "Prosperity 58 / 62"
  forecast?: { metric: 'budget' | 'defense' | 'adoption'; current: number; target: number; projected: number | null; quarters: number; currentOrder?: number };
  reward: number;
  penalty: number;
}

export interface GovernmentView {
  leaderName: string;
  leaderBio: string;
  leaderTitle: string;
  stance: Stance;
  stanceLabel: string;
  stanceText: string;
  portraitSeed: number;
  priorities: { key: 'growth' | 'security' | 'stability' | 'safety' | 'race'; label: string; weight: number }[];
  mood: 'Supportive' | 'Satisfied' | 'Impatient' | 'Hostile';
  demands: DemandView[];
  nextReview?: { turn: number; kind: 'election' | 'congress'; label: string };
}

export interface ProgramView {
  id: ProgramId;
  name: string;
  short: string;
  description: string;
  icon: string;
  level: number;
  costs: [number, number, number, number];
  levelText: [string, string, string, string];
}

export interface PolicyView {
  id: PolicyId;
  name: string;
  short: string;
  description: string;
  icon: string;
  effectsText: string[];
  active: boolean;
  politicalCost: number; // confidence cost now (negative = gain)
  leaderSupport: number; // −2..+2
}

export interface NationView {
  safeguards: number;
  capability: Estimate; // domestic frontier (from reports + intel)
  frontierLeader: string; // name of the leading domestic company
  adoption: Record<SectorId, number>;
  adoptionTarget: Record<SectorId, number>;
  dependence: number;
  displacement: number;
  budget: number;
  income: number;
  upkeep: number;
  capacity: number;
  capacityMax: number;
  evidence: EvidenceToken[];
  programs: ProgramView[];
  policies: PolicyView[];
  exportControls: boolean;
  tension: number;
  accord: { progress: number; signed: boolean; members: CountryId[] };
}

export interface MeterView {
  id: MeterId;
  name: string;
  value: number;
  history: number[];
  lastDelta: number;
  reasons: { reason: string; delta: number }[]; // last quarter + this quarter so far
  status: 'ok' | 'strained' | 'critical';
}

export interface GameView {
  turn: number;
  maxTurns: number;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  dateLabel: string; // "Q1 2027"
  era: Era;
  eraLabel: string;
  difficulty: Difficulty;
  seed: number;
  country: { id: CountryId; name: string; adjective: string; color: string; color2: string; leaderTitle: string };
  meters: Record<MeterId, MeterView>;
  risk: RiskView;
  nation: NationView;
  government: GovernmentView;
  companies: CompanyView[];
  models: ModelView[];
  rivals: RivalView[];
  situations: SituationView[]; // detected only
  inbox: Card[];
  news: NewsItem[]; // most recent first
  log: LogEntry[];
  unlockedTabs: TabId[];
  pendingTips: TipId[];
  tipsShown?: TipId[];
  canEndTurn: boolean;
  gameOver: boolean;
  ending: EndingReport | null;
  warnings: string[]; // current persistent warnings ("Confidence critical")
  /** (engine) advisor names/roles (content with engine fallbacks) */
  advisors?: Record<AdvisorId, { name: string; role: string; bias: string; portraitSeed: number }>;
  /** (engine) true while the Threshold finale card is in play (turn may be maxTurns + 1) */
  finale?: boolean;
  /** (engine) the latest quarter report, if any */
  lastReport?: TurnReport | null;
}

export interface TurnReport {
  fromTurn: number;
  toTurn: number;
  dateLabel: string; // new quarter label
  meters: Record<MeterId, { from: number; to: number; reasons: { reason: string; delta: number }[] }>;
  budget: { from: number; to: number; income: number; upkeep: number };
  risk: { from: number; to: number; trend: 'up' | 'down' | 'flat'; clock: string };
  headlines: NewsItem[];
  highlights: { text: string; tone: Tone; icon?: string }[];
  warnings: string[];
  newCards: number;
  gameOver: boolean;
}

export interface EndingReport {
  id: EndingId;
  category: 'failure' | 'survival';
  title: string;
  subtitle: string;
  tone: Tone;
  epilogue: string[];
  rating: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  scores: Record<'control' | 'prosperity' | 'security' | 'legitimacy', { value: number; grade: string }>;
  turnsPlayed: number;
  dateLabel: string;
  decisiveMoments: { turn: number; dateLabel: string; title: string; detail: string; consequence?: string; tone: Tone }[];
  hiddenTruths: { category: 'company' | 'model' | 'rival' | 'violation'; title: string; detail: string; known: boolean }[];
  warningSigns: { turn: number; dateLabel: string; text: string; actedOn: boolean }[];
  missed: string[];
  stats: { label: string; value: string }[];
  seed: number;
  countryId: CountryId;
  difficulty: Difficulty;
}

// ───────────────────────────── Engine API ─────────────────────────────

export interface NewGameOptions {
  countryId: CountryId;
  difficulty: Difficulty;
  seed?: number; // random if absent
  dailySeed?: boolean;
}

export type GameEvent =
  | { type: 'change' }
  | { type: 'choice'; result: ChoiceResult }
  | { type: 'action'; result: ActionResult }
  | { type: 'turn'; report: TurnReport }
  | { type: 'gameover'; ending: EndingReport };

/** Implemented by `Game` in src/engine/game.ts. */
export interface GameAPI {
  readonly state: GameState;
  subscribe(listener: (e: GameEvent) => void): () => void;
  /** Full fogged snapshot for rendering. Cheap enough to call on every change. */
  view(): GameView;
  resolveChoice(cardUid: string, choiceId: string): ChoiceResult;
  getActions(): ActionView[];
  performAction(actionId: ActionId, targetId?: string, optionId?: string): ActionResult;
  setProgramLevel(id: ProgramId, level: number): { ok: boolean; reason?: string };
  /** Mark a tip as seen. */
  dismissTip(id: TipId): void;
  canEndTurn(): boolean;
  endTurn(): TurnReport;
  serialize(): string;
}

// ───────────────────────────── Presentation module contracts ─────────────────────────────

export type SfxId =
  | 'click'
  | 'hover'
  | 'open'
  | 'close'
  | 'card_in'
  | 'card_out'
  | 'approve'
  | 'reject'
  | 'stamp'
  | 'alert'
  | 'critical'
  | 'success'
  | 'fail'
  | 'turn'
  | 'type'
  | 'coin'
  | 'negotiate'
  | 'glitch'
  | 'reveal'
  | 'tab'
  | 'unlock'
  | 'ending_good'
  | 'ending_bad';

/** src/audio/index.ts default export `audio` implements this. */
export interface AudioAPI {
  /** Call on the first user gesture (pointerup/keydown). Safe to call repeatedly. */
  unlock(): void;
  play(id: SfxId, opts?: { volume?: number; pitch?: number }): void;
  /** 0 = calm, 1 = imminent catastrophe. Smoothly morphs the ambient music. */
  setTension(t: number): void;
  startMusic(): void;
  stopMusic(): void;
  setSoundEnabled(on: boolean): void;
  setMusicEnabled(on: boolean): void;
  setVolume(v: number): void;
  /** Ending stinger + mood */
  setMood(mood: 'menu' | 'game' | 'ending_good' | 'ending_bad'): void;
}

/** src/fx/index.ts default export `fx` implements this. All functions must no-op gracefully under reduced motion. */
export interface FxAPI {
  setReducedMotion(on: boolean): void;
  shake(intensity?: number, ms?: number): void;
  flash(color?: string, ms?: number): void;
  vignette(color: string, ms?: number): void;
  burst(x: number, y: number, opts?: { color?: string; count?: number; spread?: number }): void;
  floatText(x: number, y: number, text: string, color?: string): void;
  tweenNumber(el: HTMLElement, from: number, to: number, ms?: number, format?: (n: number) => string): void;
  glitch(el: HTMLElement, ms?: number): void;
  pulse(el: HTMLElement, color?: string): void;
  typewriter(el: HTMLElement, text: string, cps?: number, onTick?: () => void): { skip(): void; done: Promise<void> };
  /** Animated full-screen background canvas (neural grid). */
  startBackground(canvas: HTMLCanvasElement): void;
  setBackgroundTension(t: number): void;
  stopBackground(): void;
  /** Elements under `root` that carry data-fx="reveal" fade/slide in sequentially. */
  staggerIn(root: HTMLElement, selector?: string, stepMs?: number): void;
}

/** src/art/index.ts exports. SVG returned as strings (inline-safe, no external refs). */
export interface ArtAPI {
  icon(name: string, size?: number): string;
  iconNames(): string[];
  countryEmblem(id: CountryId, size?: number): string;
  companyLogo(seed: number, color: string, archetype: Archetype, size?: number): string;
  portrait(seed: number, opts?: { size?: number; role?: 'leader' | 'advisor' | 'ceo' | 'rival'; hue?: number }): string;
  gameLogo(width?: number): string;
  endingArt(tone: Tone, width?: number): string;
  /** Stylized abstract world map with 4 regions; each region group has id `region-<CountryId>` and class `region`
   * so the UI can highlight the player and color rivals. `player` is drawn emphasized. */
  worldMap(player: CountryId, width?: number): string;
}
