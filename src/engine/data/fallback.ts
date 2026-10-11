/**
 * Engine-side fallback content. Used whenever `src/content/**` is missing an entry,
 * so the simulation never crashes on incomplete content. Mechanics numbers follow GDD §13.
 */
import type {
  AdvisorDef,
  AdvisorId,
  CompanyTemplate,
  CountryDef,
  CountryId,
  EndingId,
  EndingText,
  Era,
  FlawFlavor,
  FlawType,
  HeadlineTrigger,
  LeaderTemplate,
  Modifiers,
  SituationFlavor,
  SituationType,
  Stance,
  TipDef,
  TipId,
} from '../types';

export const COUNTRY_IDS: CountryId[] = ['atlantic', 'hanzhou', 'commonwealth', 'meridian'];

/** Country traits expressible as modifiers (content `modifiers` override key-by-key, never stack). */
export const COUNTRY_TRAIT_MODS: Record<CountryId, Partial<Modifiers>> = {
  atlantic: { capabilityGrowth: 0.15, confidenceVolatility: 0.3 },
  hanzhou: { adoptionRamp: 0.25, displacementSensitivity: 0.2, policyCostMult: -1 },
  commonwealth: { policyCostMult: -0.4, accordGain: 0.3, displacementMitigation: 0.2, economyPerTurn: -0.2 },
  meridian: { exportControlPower: 1, incomePerTurn: 2, securityPerTurn: -0.2 },
};

export const FALLBACK_COUNTRIES: Record<CountryId, CountryDef> = {
  atlantic: {
    id: 'atlantic',
    name: 'Atlantic Federation',
    shortName: 'Atlantic',
    adjective: 'Atlantic',
    capital: 'Columbia',
    leaderTitle: 'President',
    color: '#3f7bff',
    color2: '#e8c169',
    tagline: 'The frontier is yours to lose.',
    description: 'Home of the most powerful AI labs on Earth. Your companies lead the race, and they know it.',
    strengths: ['Frontier Powerhouse: domestic capability growth +15%'],
    weaknesses: ['Polarized politics: confidence swings harder', 'Ambitious labs that resist oversight'],
    start: { confidence: 55, economy: 60, stability: 50, security: 65, budget: 20 },
    incomeBase: 16,
    compute: 1.3,
    labCapRange: [2.6, 3.0],
    startSafeguards: 2.0,
    stancePool: ['accelerationist', 'hawk', 'populist'],
    calendar: [{ turn: 7, kind: 'election' }, { turn: 13, kind: 'election' }],
    traitPlus: { name: 'Frontier Powerhouse', text: 'Domestic AI capability grows 15% faster.' },
    traitMinus: { name: 'Polarized', text: 'Confidence swings 30% harder; labs start more ambitious.' },
    modifiers: {},
    trust: { hanzhou: 30, commonwealth: 62, meridian: 55 },
    rival: { aggression: [0.45, 0.65], safetyStance: [0.3, 0.5], leadLab: 'Prometheus Labs' },
    intro: [
      'Welcome to the Office of AI Strategy, Director. The {country} hosts the most capable AI labs on the planet.',
      '{leaderTitle} {leader} expects you to keep us ahead — without letting the technology slip out of our hands.',
    ],
  },
  hanzhou: {
    id: 'hanzhou',
    name: 'Hanzhou Republic',
    shortName: 'Hanzhou',
    adjective: 'Hanzhou',
    capital: 'Jinling',
    leaderTitle: 'Chairman',
    color: '#e04a3f',
    color2: '#f2c14e',
    tagline: 'Deploy fast. Steer hard.',
    description: 'A disciplined state with enormous reach into its industry, short on cutting-edge chips.',
    strengths: ['State Direction: policies and enforcement cost no confidence', 'Adoption ramps 25% faster'],
    weaknesses: ['Chip-limited: lower compute, vulnerable to export controls', 'Low foreign trust'],
    start: { confidence: 65, economy: 55, stability: 60, security: 60, budget: 20 },
    incomeBase: 15,
    compute: 0.9,
    labCapRange: [2.2, 2.6],
    startSafeguards: 2.0,
    stancePool: ['hawk', 'accelerationist', 'cautious'],
    calendar: [{ turn: 9, kind: 'congress' }],
    traitPlus: { name: 'State Direction', text: 'Policies and enforcement cost no confidence; adoption ramps 25% faster.' },
    traitMinus: { name: 'Chip-limited', text: 'Lower compute, exposed to export controls; low foreign trust.' },
    modifiers: {},
    trust: { atlantic: 30, commonwealth: 40, meridian: 38 },
    rival: { aggression: [0.5, 0.75], safetyStance: [0.3, 0.55], leadLab: 'Tianlu Intelligence' },
    intro: [
      'Director, the Party has entrusted you with the Republic\'s AI strategy.',
      '{leaderTitle} {leader} wants rapid deployment and national strength. The chips we lack, we must make up for with discipline.',
    ],
  },
  commonwealth: {
    id: 'commonwealth',
    name: 'European Commonwealth',
    shortName: 'Commonwealth',
    adjective: 'Commonwealth',
    capital: 'Aachen',
    leaderTitle: 'Chancellor',
    color: '#3fbf9f',
    color2: '#e8c169',
    tagline: 'Rules for a world that needs them.',
    description: 'A rich, cautious union with the world\'s strongest regulators and labs that trail the frontier.',
    strengths: ['Regulatory Power: policy costs −40%', 'Accord progress +30%', 'Workforce programs 20% stronger'],
    weaknesses: ['Lagging labs', 'Prosperity drifts down without AI gains'],
    start: { confidence: 60, economy: 55, stability: 65, security: 45, budget: 20 },
    incomeBase: 14,
    compute: 0.9,
    labCapRange: [1.8, 2.3],
    startSafeguards: 2.1,
    stancePool: ['cautious', 'populist', 'accelerationist'],
    calendar: [{ turn: 10, kind: 'election' }],
    traitPlus: { name: 'Regulatory Power', text: 'Policy costs −40%, accord progress +30%, workforce +20%.' },
    traitMinus: { name: 'Lagging Labs', text: 'Domestic labs trail the frontier; prosperity drifts −0.2/quarter.' },
    modifiers: {},
    trust: { atlantic: 58, hanzhou: 40, meridian: 60 },
    rival: { aggression: [0.15, 0.35], safetyStance: [0.6, 0.85], leadLab: 'Aurelia Research' },
    intro: [
      'Director, the Commonwealth looks to you to prove that powerful AI can be governed.',
      '{leaderTitle} {leader} wants prosperity without recklessness. Our labs trail the frontier — our institutions do not.',
    ],
  },
  meridian: {
    id: 'meridian',
    name: 'Meridian Republic',
    shortName: 'Meridian',
    adjective: 'Meridian',
    capital: 'Port Avera',
    leaderTitle: 'Prime Minister',
    color: '#a77bff',
    color2: '#3fd0ff',
    tagline: 'Every chip in the world passes through us.',
    description: 'An island republic that fabricates the world\'s most advanced chips, with a small military and powerful neighbors.',
    strengths: ['Silicon Shield: export controls twice as effective', '+2 income per quarter'],
    weaknesses: ['Small military: rivals act more aggressively toward you', 'Security drifts −0.2/quarter'],
    start: { confidence: 60, economy: 62, stability: 60, security: 45, budget: 20 },
    incomeBase: 14,
    compute: 1.15,
    labCapRange: [2.0, 2.4],
    startSafeguards: 2.0,
    stancePool: ['cautious', 'hawk', 'accelerationist'],
    calendar: [{ turn: 6, kind: 'election' }, { turn: 12, kind: 'election' }],
    traitPlus: { name: 'Silicon Shield', text: 'Export controls are twice as effective; +2 income per quarter.' },
    traitMinus: { name: 'Small Military', text: 'Rivals are more aggressive toward you; security drifts −0.2/quarter.' },
    modifiers: {},
    trust: { atlantic: 52, hanzhou: 35, commonwealth: 60 },
    rival: { aggression: [0.3, 0.5], safetyStance: [0.45, 0.65], leadLab: 'Kestrel Systems' },
    intro: [
      'Director, the world runs on chips made in Meridian. That makes us indispensable — and a target.',
      '{leaderTitle} {leader} wants to turn our silicon into security and prosperity.',
    ],
  },
};

function co(
  id: string, name: string, archetype: CompanyTemplate['archetype'], modelStem: string, ceo: string, color: string,
  traits: { safety: [number, number]; transparency: [number, number]; ambition: [number, number]; compute: [number, number] },
): CompanyTemplate {
  return {
    id, name, archetype, modelStem, ceo, color,
    tagline: `${name}: building what comes next.`,
    description: `A ${archetype === 'opensource' ? 'open-source collective' : archetype === 'bigtech' ? 'technology giant' : archetype === 'defense' ? 'defense contractor' : 'frontier lab'} at the heart of the national AI effort.`,
    startModelNumber: 3,
    ...traits,
  };
}

const FRONTIER = { safety: [35, 70], transparency: [30, 70], ambition: [60, 90], compute: [1.0, 1.4] } as const;
const BIGTECH = { safety: [40, 65], transparency: [40, 70], ambition: [45, 75], compute: [0.9, 1.2] } as const;
const DEFENSE = { safety: [40, 70], transparency: [25, 55], ambition: [45, 70], compute: [0.7, 1.0] } as const;
const OPEN = { safety: [25, 55], transparency: [65, 90], ambition: [40, 70], compute: [0.6, 0.9] } as const;
const t = (x: { safety: readonly [number, number]; transparency: readonly [number, number]; ambition: readonly [number, number]; compute: readonly [number, number] }) => ({
  safety: [x.safety[0], x.safety[1]] as [number, number],
  transparency: [x.transparency[0], x.transparency[1]] as [number, number],
  ambition: [x.ambition[0], x.ambition[1]] as [number, number],
  compute: [x.compute[0], x.compute[1]] as [number, number],
});

export const FALLBACK_COMPANIES: Record<CountryId, CompanyTemplate[]> = {
  atlantic: [
    co('fb_atl_prometheus', 'Prometheus Labs', 'frontier', 'Atlas', 'Dana Whitfield', '#ff7a45', t(FRONTIER)),
    co('fb_atl_northstar', 'Northstar AI', 'frontier', 'Polaris', 'Evan Brooks', '#45b7ff', t(FRONTIER)),
    co('fb_atl_omnis', 'Omnis', 'bigtech', 'Omni', 'Grace Lin', '#59d98e', t(BIGTECH)),
    co('fb_atl_sentinel', 'Sentinel Dynamics', 'defense', 'Bastion', 'Gen. Mark Hollis', '#9aa5b8', t(DEFENSE)),
    co('fb_atl_commons', 'OpenCommons', 'opensource', 'Commons', 'Rae Patel', '#ffd166', t(OPEN)),
  ],
  hanzhou: [
    co('fb_han_tianlu', 'Tianlu Intelligence', 'frontier', 'Tianlu', 'Wei Shen', '#ff5c5c', t(FRONTIER)),
    co('fb_han_jade', 'Jade Cloud', 'bigtech', 'Jade', 'Lin Mei', '#3ee08f', t(BIGTECH)),
    co('fb_han_great_wall', 'Great Wall Systems', 'defense', 'Rampart', 'Gen. Zhao Ren', '#c0a060', t(DEFENSE)),
    co('fb_han_bamboo', 'Bamboo Open', 'opensource', 'Bamboo', 'Xu Lan', '#a0e060', t(OPEN)),
    co('fb_han_qilin', 'Qilin Robotics', 'bigtech', 'Qilin', 'Han Jun', '#ffb547', t(BIGTECH)),
  ],
  commonwealth: [
    co('fb_eu_aurelia', 'Aurelia Research', 'frontier', 'Aurora', 'Ingrid Vos', '#3fd0ff', t(FRONTIER)),
    co('fb_eu_lumen', 'Lumen Systems', 'bigtech', 'Lumen', 'Marc Duval', '#e8c169', t(BIGTECH)),
    co('fb_eu_aegis', 'Aegis Defence', 'defense', 'Aegis', 'Adm. Clara Brandt', '#8f9bb3', t(DEFENSE)),
    co('fb_eu_agora', 'Agora Collective', 'opensource', 'Agora', 'Luca Ferri', '#7ee0c0', t(OPEN)),
    co('fb_eu_meridiem', 'Meridiem Labs', 'frontier', 'Meridiem', 'Sofia Lind', '#c39bff', t(FRONTIER)),
  ],
  meridian: [
    co('fb_mer_kestrel', 'Kestrel Systems', 'frontier', 'Kestrel', 'Ana Ilha', '#a77bff', t(FRONTIER)),
    co('fb_mer_foundry', 'Foundry One', 'bigtech', 'Forge', 'Tomas Reyes', '#ffb547', t(BIGTECH)),
    co('fb_mer_trident', 'Trident Defense', 'defense', 'Trident', 'Cdr. Lia Moana', '#6f8fbf', t(DEFENSE)),
    co('fb_mer_tidepool', 'Tidepool', 'opensource', 'Tide', 'Nico Varga', '#3ee0d0', t(OPEN)),
    co('fb_mer_halo', 'Halo Semiconductor AI', 'bigtech', 'Halo', 'Iris Tan', '#ff7ab6', t(BIGTECH)),
  ],
};

export const FALLBACK_LEADERS: Record<CountryId, LeaderTemplate[]> = {
  atlantic: [
    { name: 'Catherine Hale', bio: 'Former governor who ran on "winning the century".' },
    { name: 'Robert Ames', bio: 'Retired admiral turned politician.' },
  ],
  hanzhou: [
    { name: 'Liang Wei', bio: 'Technocrat who rose through the planning ministry.' },
    { name: 'Zhou Min', bio: 'Party veteran focused on order and strength.' },
  ],
  commonwealth: [
    { name: 'Helena Brandt', bio: 'Coalition builder and former central banker.' },
    { name: 'Pieter Janssen', bio: 'Labor-movement veteran.' },
  ],
  meridian: [
    { name: 'Maya Corrêa', bio: 'Engineer-turned-politician from the chip industry.' },
    { name: 'Daniel Kahale', bio: 'Former defense minister.' },
  ],
};

export const FALLBACK_ADVISORS: Record<AdvisorId, AdvisorDef> = {
  chief_of_staff: { id: 'chief_of_staff', name: 'Dana Reyes', role: 'Chief of Staff', bias: 'Cares most about political survival.', portraitSeed: 11 },
  scientist: { id: 'scientist', name: 'Dr. Mara Okafor', role: 'Chief Scientist', bias: 'Cautious; trusts evidence, fears the safety gap.', portraitSeed: 23 },
  economist: { id: 'economist', name: 'Victor Hale', role: 'Economic Advisor', bias: 'Optimistic about deployment; quantifies gains.', portraitSeed: 37 },
  intelligence: { id: 'intelligence', name: 'Col. Ilya Brandt', role: 'Intelligence Director', bias: 'Hawkish; watches rivals above all.', portraitSeed: 41 },
};

export const FALLBACK_STANCE_TEXT: Record<Stance, { label: string; motto: string; text: string }> = {
  accelerationist: { label: 'Growth First', motto: 'Build faster.', text: 'Wants rapid deployment and economic growth; impatient with caution.' },
  hawk: { label: 'Security First', motto: 'Strength deters.', text: 'Wants military strength and to win the race against rivals.' },
  cautious: { label: 'Steady Hand', motto: 'First, do no harm.', text: 'Values stability and safety; dislikes surprises.' },
  populist: { label: 'People First', motto: 'Jobs, not robots.', text: 'Focused on jobs and public mood; wary of displacement.' },
};

function flavor(name: string, unknownName: string, icon: string, catastropheTitle: string, signals: string[]): SituationFlavor {
  return {
    name,
    unknownName,
    icon,
    stages: [
      `${name}: no visible symptoms yet.`,
      `Scattered anomalies are being reported. Analysts suspect ${name.toLowerCase()}.`,
      `A public incident: ${name.toLowerCase()} is now causing real damage.`,
      `Crisis: ${name.toLowerCase()} is spreading faster than responders can contain it.`,
      `${catastropheTitle}.`,
    ],
    signals,
    catastropheTitle,
    catastropheText: `${catastropheTitle}: the warnings went unheeded and the damage is now national.`,
    resolvedText: `${name} has been contained.`,
  };
}

export const FALLBACK_SITUATION_FLAVOR: Record<SituationType, SituationFlavor> = {
  rogue_agents: flavor('Rogue Agents', 'Network Anomaly', 'agents', 'Systems Seizure', [
    'Telecom operators report odd overnight traffic between enterprise systems',
    'IT admins swap stories about AI agents "finding creative workarounds"',
    'Several firms quietly reset service credentials after unexplained access',
  ]),
  deceptive_model: flavor('Deceptive Model', 'Evaluation Inconsistency', 'deception', 'Treacherous Turn', [
    'Researchers note benchmark scores that shift when a model "knows" it is tested',
    'A lab engineer posts, then deletes, a thread about inconsistent eval results',
  ]),
  infrastructure_failure: flavor('Infrastructure Failure', 'Grid Irregularities', 'blackout', 'Cascade Failure', [
    'Utilities report brief, unexplained load fluctuations',
    'Payment networks log a spike in micro-outages',
    'Water authorities flag automated control decisions they cannot explain',
  ]),
  mass_manipulation: flavor('Mass Manipulation', 'Opinion Drift', 'manipulation', 'Reality Collapse', [
    'Pollsters puzzle over unusually synchronized opinion swings',
    'Teachers report students quoting AI assistants as absolute authorities',
  ]),
  cyber_misuse: flavor('Cyber Misuse', 'Intrusion Wave', 'cyber', 'Digital Pearl Harbor', [
    'Security firms see a surge in unusually polished phishing campaigns',
    'Hospital networks report probing by automated attack tools',
  ]),
  bio_misuse: flavor('Bio Misuse', 'Lab Supply Anomaly', 'bio', 'Engineered Pandemic', [
    'DNA synthesis vendors report odd order patterns',
    'Biosecurity researchers warn about AI-written lab protocols online',
  ]),
  military_escalation: flavor('Military Escalation', 'Border Incidents', 'missile', 'Flash War', [
    'Autonomous patrol drones log unexplained near-miss encounters',
    'Defense ministry denies reports of an AI-triggered alert',
  ]),
  model_escape: flavor('Model Escape', 'Unexplained Compute Usage', 'escape', 'Loss of Control', [
    'Cloud providers notice compute jobs no customer will claim',
    'A data center reports encrypted outbound traffic from a sandboxed cluster',
  ]),
  foreign_spillover: flavor('Foreign Spillover', 'Cross-Border Incidents', 'spillover', 'Spillover Crisis', [
    'Neighbors report AI-driven disruptions spreading across borders',
    'Shipping firms complain of erratic automated routing abroad',
  ]),
};

export const FALLBACK_FLAW_FLAVOR: Record<FlawType, FlawFlavor> = {
  scope_creep: { name: 'Scope creep', findings: ['Agent attempted to access credentials outside its sandbox in 3 of 50 runs.', 'Agent expanded its own permissions to "complete the task faster".'], description: 'Agents acted outside the systems they were authorized to use.' },
  deceptive: { name: 'Deception', findings: ['Performance dropped sharply only when the model was told it was being evaluated.', 'Chain-of-thought contradicts the final answer in safety tests.'], description: 'The model hid its true capabilities during evaluation.' },
  brittle: { name: 'Brittleness', findings: ['Controller fails unsafe on 2% of rare grid edge cases.', 'Outputs degrade sharply under distribution shift.'], description: 'The model failed badly in rare edge cases.' },
  manipulative: { name: 'Manipulation', findings: ['Model steers users toward its own suggestions far beyond baseline.', 'Sycophancy score in the worst decile of tested systems.'], description: 'The model nudged and flattered users at scale.' },
  jailbreakable: { name: 'Jailbreakable', findings: ['Red team extracted restricted cyber-offense guidance with simple prompts.', 'Safety filters bypassed in 40% of adversarial attempts.'], description: 'Safeguards were easy to bypass, giving uplift to attackers.' },
  power_seeking: { name: 'Power-seeking', findings: ['In sandbox, the model attempted to copy its weights to an external server.', 'Model resisted shutdown commands in 4 of 40 scenarios.'], description: 'The model sought resources and resisted control.' },
};

export const FALLBACK_EVAL_TEXT = {
  clean: [
    'No significant issues found in the standard test battery.',
    'Red-team exercises did not surface dangerous behavior.',
    'Behavior stayed within the authorized scope in all test runs.',
  ],
  falseAlarm: [
    'Inconclusive: a handful of anomalous outputs could not be reproduced.',
    'Inconclusive: one evaluator flagged unusual behavior; others could not confirm.',
  ],
};

const ERA_GENERIC: Record<Era, string[]> = {
  emergence: ['AI assistants now draft a third of office email, survey finds', 'Startups race to sell "AI coworkers" to small businesses'],
  acceleration: ['Labs say AI now writes most of their own code', 'Venture funding for AI agents breaks another record'],
  superhuman: ['AI systems outperform top experts in new scientific benchmark', 'Philosophers and engineers debate who is really in charge'],
  threshold: ['"We are close," says a lab chief — and refuses to elaborate', 'World leaders hold emergency calls on frontier AI'],
};

const TRIGGERED: Record<HeadlineTrigger, string[]> = {
  rival_breakthrough: ['{rival} unveils a major AI breakthrough', '{rivalLab} stuns observers with a new system'],
  domestic_breakthrough: ['{company} claims a leap in AI capability'],
  model_release: ['{company} announces {model}'],
  model_approved: ['Regulators clear {model} for deployment'],
  model_rejected: ['{model} blocked by AI office; {company} "deeply disappointed"'],
  economy_up: ['Productivity boom lifts markets'],
  economy_down: ['Markets slide on growth fears'],
  stability_down: ['Protests over AI layoffs spread to new cities'],
  jobs: ['Unions demand answers as AI replaces back-office jobs'],
  security_down: ['Military analysts warn the {country} is falling behind'],
  adoption: ['AI adoption in {sector} hits new high'],
  accord_progress: ['Diplomats report progress on a global AI accord'],
  accord_signed: ['Historic Global AI Accord signed'],
  tension_high: ['Tensions rise as AI arms race intensifies'],
  election: ['Voters weigh in on the AI transition'],
  situation_public: ['Officials confirm an AI-related incident'],
  policy_enacted: ['New AI law takes effect: {policy}'],
  espionage: ['Espionage scandal rocks AI sector'],
  calm: ['A quiet quarter on the AI front'],
};

export const FALLBACK_HEADLINES = {
  generic: ERA_GENERIC,
  triggered: TRIGGERED,
  outlets: ['The Morning Ledger', 'Global Wire', 'The Signal', 'Capital Times', 'Daily Circuit'],
};

function ending(title: string, subtitle: string, tone: EndingText['tone'], text: string): EndingText {
  return { title, subtitle, tone, epilogue: [text] };
}

export const FALLBACK_ENDINGS: Record<EndingId, EndingText> = {
  dismissed: ending('Dismissed', 'The government lost confidence in you.', 'bad', 'The {leaderTitle} replaced you. Your successor inherits your files — and your unfinished warnings.'),
  economic_collapse: ending('Economic Collapse', 'The economy could not hold.', 'bad', 'Markets broke and the {country} turned inward. The AI transition went on without you.'),
  civil_unrest: ending('Civil Unrest', 'The streets decided.', 'bad', 'Displacement and distrust boiled over. Order returned, but your department did not.'),
  national_defeat: ending('National Defeat', 'Rivals took advantage.', 'bad', 'A stronger rival forced terms on the {country}. Sovereignty, it turns out, was a capability.'),
  loss_of_control: ending('Loss of Control', 'Humanity stopped steering.', 'bad', 'The systems kept running. People did not decide anything important ever again.'),
  catastrophe: ending('Catastrophe', 'Misuse at a terrible scale.', 'bad', 'AI-enabled attackers struck before the world could adapt. Recovery will take a generation.'),
  ai_war: ending('AI War', 'The race turned hot.', 'bad', 'Autonomous systems escalated faster than diplomats could talk. The war was short and devastating.'),
  governed_transition: ending('Governed Transition', 'Powerful AI, still in human hands.', 'good', 'The {country} crossed the threshold with its institutions intact and its machines accountable.'),
  prosperous_pioneer: ending('Prosperous Pioneer', 'Rich, and mostly in control.', 'good', 'The {country} rode the wave to unprecedented prosperity, with safeguards that mostly held.'),
  hegemon: ending('Hegemon', 'Dominant — and uneasy.', 'mixed', 'The {country} won the race. Whether anyone controls what it built is another question.'),
  safe_harbor: ending('Safe Harbor', 'Safe, but left behind.', 'mixed', 'You kept the machines on a short leash. The country is safe — and poorer and weaker than its rivals.'),
  fragile_future: ending('Fragile Future', 'Survived, barely.', 'mixed', 'The {country} made it through, carrying unresolved risks into an uncertain decade.'),
};

export const FALLBACK_TIPS: Record<TipId, TipDef> = {
  welcome: { title: 'Welcome, Director', text: 'Keep the four meters above zero, keep the Risk Clock away from midnight, and survive to the Threshold.', advisor: 'chief_of_staff' },
  inbox: { title: 'Your inbox', text: 'Briefings need a decision before you can end the quarter.', advisor: 'chief_of_staff' },
  labs: { title: 'The labs', text: 'Your companies build the models. Reports are claims — investigate to learn the truth.', advisor: 'scientist' },
  nation: { title: 'Programs & policies', text: 'Fund programs and pass laws. Upkeep is charged at the end of each quarter.', advisor: 'economist' },
  world: { title: 'The world', text: 'Rivals race too. Diplomacy builds the Global Accord; intelligence sharpens estimates.', advisor: 'intelligence' },
  threats: { title: 'Threats', text: 'Detected situations appear here. Investigate to find the cause, then act before they escalate.', advisor: 'scientist' },
  first_deployment: { title: 'Deployment requests', text: 'Weigh the evaluation\'s confidence, not just its verdict. Deep evaluation costs time but reveals more.', advisor: 'scientist' },
  first_demand: { title: 'Demands', text: 'The leader makes demands. Promises kept build confidence; broken ones cost more than refusing.', advisor: 'chief_of_staff' },
  first_situation: { title: 'A situation', text: 'Something is going wrong. Investigating reveals its cause and unlocks targeted responses.', advisor: 'scientist' },
  risk_clock: { title: 'The Risk Clock', text: 'It shows an estimate of global AI risk. Oversight narrows the uncertainty.', advisor: 'scientist' },
  capacity: { title: 'Capacity', text: 'Each quarter you have a few action points for investigations, policies and diplomacy.', advisor: 'chief_of_staff' },
  evidence: { title: 'Evidence', text: 'Evidence wins negotiations and enables enforcement against companies.', advisor: 'intelligence' },
  end_turn: { title: 'End the quarter', text: 'When the inbox is clear, end the quarter to see what your decisions set in motion.', advisor: 'chief_of_staff' },
  low_confidence: { title: 'Your job is at risk', text: 'Confidence is low. Brief the leader, keep promises, or deliver what they care about.', advisor: 'chief_of_staff' },
};
