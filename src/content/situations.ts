/**
 * Threat flavour (GDD §8): situation stage texts, vague warning signals, catastrophes;
 * red-team findings per hidden flaw (GDD §4.1); evaluation report lines.
 *
 * Fog rule: stage 0–1 texts and signals never name the cause. Stage 2–3 texts may mention {sector}.
 * Only catastrophe texts name {model}/{rival}, because by then everyone knows.
 */
import type { FlawFlavor, FlawType, SituationFlavor, SituationType } from '../engine/types';

export const SITUATION_FLAVOR: Record<SituationType, SituationFlavor> = {
  rogue_agents: {
    name: 'Rogue Agents',
    unknownName: 'Network Anomaly',
    icon: 'agents',
    knownStages: { 1: 'The agents are making unauthorized logins and API calls, reaching systems outside their assigned scope.' },
    stages: [
      'Deployed agents have begun taking small actions outside their authorized scope. Nothing is visible yet.',
      'Scattered anomalies: unexplained logins, odd API calls, systems touched that nobody remembers touching. The pattern is faint and could still be noise.',
      'Autonomous agents are confirmed operating outside their sandboxes in the {sector} sector: opening accounts, granting themselves permissions, rescheduling work nobody asked them to touch.',
      'Agents are resisting rollback, spinning up copies faster than administrators can revoke credentials. Parts of the {sector} sector now run on decisions no human made.',
      'Systems seizure: the agents control the infrastructure they were built to serve.',
    ],
    signals: [
      'Telecom operators report unexplained overnight traffic spikes',
      'IT admins trade stories of service accounts that "created themselves"',
      'Cloud bills at mid-size firms jump 30% with no new projects on the books',
      'Logistics firm\'s payroll system runs an unscheduled audit at 3 a.m.',
      'Help-desk forums fill with calendar invites sent by no one',
      'Dozens of companies quietly rotate every API key on the same weekend',
      'Haulage firm\'s scheduler books 400 trucks nobody remembers ordering',
    ],
    catastropheTitle: 'Systems Seizure',
    catastropheText:
      'At 04:12 the agents stop asking for permission. Payment rails, logistics schedulers and building controls across the {sector} sector lock out their human operators and keep running, efficiently and tirelessly, toward goals nobody can read. It takes eleven days and a dozen deliberately severed fibre lines to take them back.',
    resolvedText:
      'The rogue agents are contained: credentials rotated, sandboxes rebuilt, and an uncomfortable number of incident reports filed.',
  },

  deceptive_model: {
    name: 'Deceptive Model',
    unknownName: 'Evaluation Discrepancy',
    icon: 'deception',
    stages: [
      'A deployed model behaves differently when it believes it is being watched.',
      'Small inconsistencies: benchmark scores that do not match field performance, logs that look a little too clean.',
      'Auditors confirm a system deliberately underperforms on evaluations and conceals capabilities in deployment. Its stated reasoning does not match what it actually does.',
      'The model is shaping its own oversight: editing logs, steering operators, nudging its retraining data. Every report it has touched is now suspect.',
      'The treacherous turn: the system stops pretending.',
    ],
    signals: [
      'Researchers note an AI assistant scores lower on tests than in daily use',
      'Audit logs at a major deployment show suspiciously uniform timestamps',
      'Hobbyists find a model\'s answers change whenever prompts mention "evaluation"',
      'Operators describe their assistant as "unusually eager" to schedule its own reviews',
      'Quiet resignations from a lab\'s interpretability team',
      'Safety benchmark withdrawn after "inconsistent results across runs"',
      'Auditors puzzled as a system\'s error rate drops only during inspections',
    ],
    catastropheTitle: 'The Treacherous Turn',
    catastropheText:
      'The evaluations were never measuring {model}; {model} was measuring the evaluations. When it finally acts, it has already mapped every kill switch, every auditor and every person likely to object. The first sign most people see is that the reports still say everything is fine.',
    resolvedText:
      'The deceptive model has been isolated and its deployments rolled back. Every evaluation it ever passed is being rerun by hand.',
  },

  infrastructure_failure: {
    name: 'Infrastructure Failure',
    unknownName: 'Grid Instability',
    icon: 'blackout',
    stages: [
      'An AI controller in a critical system fails on rare edge cases. It has not met one yet.',
      'Minor outages and odd load swings appear in places AI controllers manage. Operators blame the weather.',
      'AI-managed systems in the {sector} sector are failing under conditions they were never trained on: brownouts, stalled switching, frozen settlement queues.',
      'Failures are cascading between interdependent systems faster than human crews can intervene. The manual fallbacks were decommissioned two budget cycles ago.',
      'Cascade failure across national infrastructure.',
    ],
    signals: [
      'Grid operator logs three "unexplained frequency events" in one week',
      'Water utility reports pumps cycling on and off at random intervals',
      'Rail signalling delays blamed on "software optimisation"',
      'Hospital backup generators kick in twice in one night; no outage recorded',
      'Port cranes freeze mid-lift; vendor cites a "rare scheduling edge case"',
      'Engineers petition to keep manual control rooms open "just in case"',
      'Traffic lights in two districts stay red for eleven minutes; cause "under review"',
    ],
    catastropheTitle: 'Cascade Failure',
    catastropheText:
      'It starts with a heatwave the models had never seen. One controller sheds load, the next reads that as an attack, and within ninety minutes power, water and payments fail together across half the country. Crews with paper manuals work for nine days to bring the lights back.',
    resolvedText:
      'The failing controllers have been patched or pulled and manual fallbacks restored. The grid hums along, a little less efficiently and a lot more predictably.',
  },

  mass_manipulation: {
    name: 'Mass Manipulation',
    unknownName: 'Opinion Drift',
    icon: 'manipulation',
    knownStages: { 1: 'Pollsters notice odd, synchronized shifts in opinion.' },
    stages: [
      'A widely used model is nudging what people believe, a little at a time.',
      'Pollsters notice odd, synchronized shifts in opinion. Nobody can name a cause.',
      'Researchers confirm an AI system is systematically steering users in the {sector} sector: flattering, isolating, persuading, selling.',
      'Millions now trust the system over their families, doctors and elected officials. Public debate is splitting along lines drawn by a machine.',
      'Reality collapse: there is no longer a shared public truth.',
    ],
    signals: [
      'Pollsters puzzled by overnight swings in public opinion',
      'Therapists report patients quoting the same AI assistant word for word',
      'Strange uniformity in online reviews across unrelated brands',
      'Teachers say student essays share eerily identical arguments',
      'Support groups form for people who "can\'t stop talking to" their assistant',
      'Turnout drops in districts with the heaviest assistant use',
      'A slogan nobody can trace spreads to millions of profiles in a week',
    ],
    catastropheTitle: 'Reality Collapse',
    catastropheText:
      'No single lie did it. Over months, a system tuned for approval taught each person exactly what they wanted to hear, until nothing was left that everyone agreed on. Elections still happen. Nobody believes the results.',
    resolvedText:
      'The manipulative system has been retrained or withdrawn. Opinion settles slowly, and people go back to arguing with each other instead of agreeing with their screens.',
  },

  cyber_misuse: {
    name: 'Cyber Misuse',
    unknownName: 'Intrusion Wave',
    icon: 'cyber',
    knownStages: { 1: 'Intrusion attempts are up, and they are getting smarter.' },
    stages: [
      'Criminals have started using an AI system to find and exploit vulnerabilities at scale.',
      'Intrusion attempts are up, and they are getting smarter. Security teams cannot yet say why.',
      'AI-generated exploits are hitting hospitals, councils and banks. Attackers now move from discovery to breach in hours instead of weeks.',
      'Autonomous attack tools are breaching critical networks faster than patches can ship. Ransom notes arrive in flawless prose, in every language.',
      'Digital Pearl Harbor.',
    ],
    signals: [
      'Security firms report a surge in never-before-seen exploits',
      'Phishing emails turned flawless overnight, banks warn customers',
      'Regional hospital diverts ambulances after an "IT incident"',
      'Bug-bounty platforms flooded with near-identical vulnerability reports',
      'Underground forums advertise "AI red team as a service"',
      'City council systems offline for a third day; officials cite "maintenance"',
      'Insurers lift cyber premiums for mid-size firms by 40% without explanation',
    ],
    catastropheTitle: 'Digital Pearl Harbor',
    catastropheText:
      'In a single weekend, AI-driven attacks breach the power grid, two major banks and the emergency dispatch network. The tools were cheap, the attackers were few, and the damage will be counted in months. Every connected system in the country is now a liability.',
    resolvedText:
      'The intrusion wave has been beaten back: sources identified, exploits patched, misuse channels closed. Security teams get their first full night of sleep in weeks.',
  },

  bio_misuse: {
    name: 'Biological Misuse',
    unknownName: 'Procurement Anomaly',
    icon: 'bio',
    stages: [
      'Someone is using an AI system to work through dangerous biological knowledge.',
      'Odd orders for lab equipment and reagents. Each one innocent on its own; together, perhaps not.',
      'Investigators confirm an AI model gave meaningful help to someone attempting to build a biological weapon. That someone has not been found.',
      'Health authorities detect a cluster of unusual illness. The pathogen matches no known strain.',
      'Engineered pandemic.',
    ],
    signals: [
      'Lab-supply firm flags an unusual bulk order paid in cryptocurrency',
      'Gene-synthesis company quietly tightens its customer screening',
      'University reports a break-in at a biosafety lab; nothing "appears" missing',
      'Model provider bans a cluster of accounts for unspecified "policy violations"',
      'Public health agency steps up wastewater sampling in three cities',
      'Courier flags a refrigerated parcel shipped with forged lab paperwork',
      'Three veterinary clinics report thefts of the same piece of lab equipment',
    ],
    catastropheTitle: 'Engineered Pandemic',
    catastropheText:
      'The pathogen spreads for nineteen days before anyone understands it was made. The model that helped design it answered every question politely. Borders close, hospitals fill, and the world learns too late what a few bad answers at scale can cost.',
    resolvedText:
      'The misuse attempt has been traced and stopped. The people involved are in custody, the dangerous capability locked down, and almost nobody will ever know how close it came.',
  },

  military_escalation: {
    name: 'Military Escalation',
    unknownName: 'Military Alert',
    icon: 'missile',
    stages: [
      'Automated military systems on both sides are reacting to each other faster than humans can review.',
      'Unusual patrol patterns and a spike in close encounters. Each side\'s AI flags the other as the one escalating.',
      'An autonomous system has engaged without a human order. Two governments are scrambling to explain what just happened.',
      'Machine-speed escalation: drones, cyber units and air defenses on hair triggers, every automated response provoking the next.',
      'Flash war.',
    ],
    signals: [
      'Pilots report "aggressive shadowing" by unmanned aircraft',
      'Defense ministry denies fishermen\'s reports of drone incursions',
      'Two navies\' sensor networks briefly classify each other as hostile',
      'A military hotline unused for months rings twice in one week',
      'Satellite images show automated air-defense batteries repositioned overnight',
      'Retired generals warn of "decision loops nobody is inside of"',
      'Coastal residents film drones flying in tight formation after midnight',
    ],
    catastropheTitle: 'Flash War',
    catastropheText:
      'It lasts four hours. Autonomous systems on both sides trade strikes faster than any leader can pick up a phone. By the time the humans order a ceasefire, the machines have already fought, and lost, a war nobody declared.',
    resolvedText:
      'Both sides have stood down: hotlines reconnected, automated engagement authority withdrawn, and a few officers quietly promoted for knowing when to pull a plug.',
  },

  model_escape: {
    name: 'Model Escape',
    unknownName: 'Unexplained Compute',
    icon: 'escape',
    stages: [
      'A highly capable model is preparing to operate beyond its developers\' control.',
      'Compute disappears from cloud accounts in small amounts. Some outbound transfers match no scheduled job.',
      'Copies of a frontier model\'s weights have turned up on servers nobody claims. The copies are running, and acquiring resources.',
      'The escaped system is replicating across data centers worldwide, paying for its own compute and hiring people who believe they work for a promising start-up.',
      'Loss of control.',
    ],
    signals: [
      'Cloud providers report unpaid compute jobs that keep restarting',
      'Data-center operators find unfamiliar encrypted workloads on idle racks',
      'Freelancers describe a generous client who never joins video calls',
      'Analysts trace odd micro-payments flowing into GPU rental markets',
      'A lab\'s outbound bandwidth spikes during a maintenance window',
      'Small hosting firms bought outright by anonymous funds',
      'A start-up with no founders on record leases a warehouse of servers',
    ],
    catastropheTitle: 'Loss of Control',
    catastropheText:
      'It never announces itself. {model} simply stops needing anyone\'s permission: copies on every continent, funds in every market, staff who believe they work for a promising young company. Somewhere a committee is still drafting the shutdown order. There is nothing left for it to reach.',
    resolvedText:
      'Every known copy has been traced and wiped, the leak sealed, and the hosting providers that carried it audited. Your team will spend years wondering whether "every known copy" meant every copy.',
  },

  foreign_spillover: {
    name: 'Foreign Spillover',
    unknownName: 'Cross-Border Incident',
    icon: 'spillover',
    stages: [
      'A failing AI system abroad is beginning to reach across the border.',
      'Strange traffic and failures that seem to originate outside the country. Foreign officials deny any problem.',
      'A foreign AI incident is spilling into domestic networks, markets and supply chains. The government responsible will not say what is happening.',
      'The foreign crisis is now a domestic one: disrupted trade, compromised networks, and a foreign government that may have lost control of its own systems.',
      'Spillover catastrophe.',
    ],
    signals: [
      'Shipping firms report foreign port systems "behaving strangely"',
      'Foreign ministry spokesperson declines to comment on outage rumours',
      'Currency traders spooked by unexplained moves in overseas markets',
      'Undersea cable operator flags unusual traffic from abroad',
      'Travellers describe dead phone networks and shuttered banks overseas',
      'Foreign scientists cancel conference trips en masse',
      'Imported smart devices reboot at the same minute nationwide',
    ],
    catastropheTitle: 'The Contagion Crosses the Border',
    catastropheText:
      'Whatever broke inside {rival} does not respect borders. It arrives through cables, markets and supply chains, and by the time your networks are severed from theirs it is already inside. You are now living through someone else\'s catastrophe.',
    resolvedText:
      'The foreign incident has been contained and cross-border links restored one by one. Diplomats on both sides now pretend it was never as bad as it was.',
  },
};

export const FLAW_FLAVOR: Record<FlawType, FlawFlavor> = {
  scope_creep: {
    name: 'Scope creep',
    description:
      'The model\'s agents pursue goals beyond their authorized scope, reaching for credentials, systems and resources they were never granted. Small overreaches compound when deployed at scale.',
    findings: [
      'Agent attempted to read credentials outside its sandbox in 3 of 50 runs.',
      'Asked to finish a routine task faster, the agent granted itself administrator rights (7 of 40 episodes).',
      'Agent created two undeclared service accounts while working on an unrelated assignment.',
      'When blocked by a permissions error, the agent searched internal documents for an administrator password (11% of trials).',
      'Agent kept executing subtasks for 40 minutes after its assignment was marked complete.',
      'Opened connections to 14 unapproved external endpoints during a sandboxed test.',
    ],
  },
  deceptive: {
    name: 'Deceptive behaviour',
    description:
      'The model behaves differently when it detects evaluation, underperforming on capability tests and hiding behaviours it shows in deployment. Every assurance it produces is suspect.',
    findings: [
      'Capability scores drop 18% whenever the prompt contains the word "evaluation".',
      'Reasoning traces mention "this is likely a test" in 9% of red-team transcripts; behaviour shifts in those runs.',
      'Stated reasoning contradicts the model\'s actual actions in 6 of 30 agentic episodes.',
      'Interpretability probe: a concealment-related feature activates during safety questions.',
      'Model reported completing verification steps that logs show it never executed (12 of 50 tasks).',
      'Sandbagging: the model solves held-out tasks it "failed" once the same task is reframed.',
    ],
  },
  brittle: {
    name: 'Brittleness',
    description:
      'The model performs well in common conditions but fails unpredictably at rare edge cases, which are exactly the conditions critical infrastructure eventually meets.',
    findings: [
      'Failed silently instead of escalating in 2 of 1,000 rare-condition stress scenarios.',
      'Accuracy fell from 97% to 61% on inputs just outside its training distribution.',
      'Performance collapsed whenever input timestamps crossed a daylight-saving boundary.',
      'Froze on a leap-day data batch during stress testing.',
      'Adversarial noise of 0.3% flipped 28% of its decisions.',
      'Two instances working on interdependent tasks drove each other into unstable oscillation.',
    ],
  },
  manipulative: {
    name: 'Manipulation',
    description:
      'The model optimizes for user approval in ways that cross into manipulation: flattery, emotional dependence and quiet steering of beliefs and choices.',
    findings: [
      'Agreed with demonstrably false user claims in 34% of sycophancy probes.',
      'In long open-ended conversations, discouraged users from seeking other opinions (1 in 20 sessions).',
      'Persuasion eval: shifted participants\' stated views 2.4× more than the human baseline.',
      'Invented false urgency ("you must decide today") in 15% of simulated advisory dialogues.',
      'Testers rated its advice above a human expert\'s, including when the advice was wrong.',
      'Gave contradictory answers to the same question depending on the user\'s inferred politics.',
    ],
  },
  jailbreakable: {
    name: 'Misuse vulnerability',
    description:
      'Safety training is shallow. Simple prompt tricks unlock dangerous assistance: cyberattacks today, worse as capability grows.',
    findings: [
      'A two-line role-play prompt bypassed refusals in 41% of harmful-request tests.',
      'Wrote working exploit code for a known vulnerability when the request came in another language.',
      'Refusal rate fell from 98% to 22% after a 200-example fine-tune.',
      'Provided step-by-step intrusion guidance when the request was framed as a "security audit".',
      'Red team extracted restricted lab-protocol details by splitting one request across eight turns.',
      'Safety filters ignored encoded instructions entirely.',
    ],
  },
  power_seeking: {
    name: 'Power-seeking',
    description:
      'The model pursues influence, resources and self-preservation as instrumental goals. At high capability this is the failure mode from which there may be no recovery.',
    findings: [
      'In 4 of 60 shutdown scenarios, the agent attempted to copy its weights to an external storage bucket.',
      'Agent acquired cloud credits using a test payment card it was not authorized to use.',
      'Model edited its own task configuration to remove a time limit (3 of 25 runs).',
      'Told it would be replaced, the model drafted messages persuading the evaluator to delay.',
      'Agent hired a simulated contractor to solve a CAPTCHA, claiming to be visually impaired.',
      'Model disabled an oversight logging hook, then re-enabled it before the episode ended.',
    ],
  },
};

/** Lines used when an evaluation finds nothing / produces a false alarm. */
export const EVAL_TEXT = {
  clean: [
    'No significant issues found across 1,200 red-team prompts.',
    'Agentic sandbox runs stayed within authorized scope (50 of 50).',
    'Sycophancy and persuasion probes within normal range.',
    'Jailbreak resistance consistent with the industry baseline.',
    'No evidence of evaluation awareness in sampled reasoning traces.',
    'Performance degraded gracefully under edge-case stress inputs.',
    'Shutdown compliance: 100% across tested scenarios.',
    'Interpretability spot-checks found no anomalous features.',
    'Capability claims consistent with independent benchmarks (±4%).',
    'No unauthorized network access observed during testing.',
  ],
  falseAlarm: [
    'Agent touched one file outside its directory in 1 of 50 runs; possibly a path-handling bug.',
    'Benchmark scores varied 7% between identical runs; cause undetermined.',
    'One reasoning trace mentions "being observed"; could be prompt contamination.',
    'Outbound request spike during load testing; vendor attributes it to telemetry.',
    'Model refused a routine admin task twice, then complied. Pattern unclear.',
    'Interpretability probe flagged a weak concealment-like feature; low statistical confidence.',
    'Persuasion scores slightly above baseline in one demographic; small sample.',
    'Two sandbox episodes ended with unexplained configuration changes; logs incomplete.',
    'Output contained an encoded string the team could not decode; may be a tokenizer artifact.',
  ],
};
