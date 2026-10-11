/**
 * One-time onboarding tips (GDD §1 progressive reveal), each in an advisor's voice. ≤ 45 words.
 */
import type { TipDef, TipId } from '../engine/types';

export const TIPS: Record<TipId, TipDef> = {
  welcome: {
    title: 'Welcome, Director',
    advisor: 'chief_of_staff',
    text: 'Sixteen quarters until the end of 2030. Keep all four meters above zero, keep the {leaderTitle} on side, and keep the risk clock away from midnight. Lose any one of those and we are done.',
  },
  inbox: {
    title: 'Your Inbox',
    advisor: 'chief_of_staff',
    text: 'Each quarter brings briefing cards: requests, crises, demands. Every card needs a decision before the quarter can end. Chevrons show likely effects; a "?" means consequences you cannot see yet. Read the advisor notes, but remember our biases.',
  },
  labs: {
    title: 'Reading the Labs',
    advisor: 'scientist',
    text: 'Company reports are claims, not facts. Capability shows as a range: the wider it is, the less we know. Investigate a company to verify its traits and catch hidden violations. Intel fades, so recheck the labs that worry you.',
  },
  nation: {
    title: 'Programs and Policies',
    advisor: 'economist',
    text: 'Programs are funding levels with upkeep every quarter: safety, oversight, compute, workforce, defense. Policies are laws; enacting one costs an action and some political capital, then it works every quarter. Watch the budget: upkeep adds up fast.',
  },
  world: {
    title: 'The World Stage',
    advisor: 'intelligence',
    text: 'Three rivals are racing us. Watch their estimated capability, their trust in us, and Race Tension: at 100 it becomes open conflict. Diplomacy builds the Global Accord, which slows everyone and adds inspections. Espionage works, until it is caught.',
  },
  threats: {
    title: 'Threats',
    advisor: 'scientist',
    text: 'Threats grow quietly before anyone notices; a vague headline is often the first warning. Investigate to learn the cause, then restrict, suspend or contain. Acting early is cheap. Acting at crisis stage costs far more, if it still works.',
  },
  first_deployment: {
    title: 'Deployment Requests',
    advisor: 'scientist',
    text: 'Our evaluation lists findings and a confidence level. "No issues found" at Low confidence means very little. Approve for growth, limit to a sandbox, order a deep evaluation, or reject. Approved flaws surface later, usually at the worst time.',
  },
  first_demand: {
    title: 'Orders from the Top',
    advisor: 'chief_of_staff',
    text: 'The {leaderTitle} wants results by a deadline. Comply, counter-offer for a softer target, present Evidence to improve your odds, or refuse and pay in confidence. A promise you accept and then break costs more than refusing would have.',
  },
  first_situation: {
    title: 'A Threat Is Confirmed',
    advisor: 'scientist',
    text: 'We know something is wrong, not necessarily what. Investigating reveals the cause and true stage and unlocks targeted responses. Broad containment buys time without answers. If the panel says escalation is expected next quarter, believe it.',
  },
  risk_clock: {
    title: 'The Risk Clock',
    advisor: 'scientist',
    text: 'This clock is global AI risk as minutes to midnight. The hand is our estimate; the shaded arc is our uncertainty. Oversight funding and a signed accord narrow it. The true value stays hidden, and midnight ends everything.',
  },
  capacity: {
    title: 'Department Actions',
    advisor: 'chief_of_staff',
    text: 'The pips are your actions this quarter. Investigations, policies, diplomacy and briefings each cost one. They refill every quarter, so unused actions are wasted. Oversight funding at higher levels gives us more hands.',
  },
  evidence: {
    title: 'Evidence',
    advisor: 'intelligence',
    text: 'Investigations can turn up hard proof of violations. Evidence lets you take enforcement action against a company and strengthens your counter-offers to the {leaderTitle}. Proof is scarce. Spend it where it changes the outcome.',
  },
  end_turn: {
    title: 'End the Quarter',
    advisor: 'chief_of_staff',
    text: 'Inbox clear? Then end the quarter. Labs train, rivals move, threats grow and the budget pays out. You will get a report of what changed and why. Check program funding first: upkeep is charged at quarter end.',
  },
  low_confidence: {
    title: 'You Are Losing the Room',
    advisor: 'chief_of_staff',
    text: 'Confidence is low. At zero, you are out. Brief the {leaderTitle}, deliver on a promise, or concede something visible. Being right will not save you if nobody is listening anymore.',
  },
};
