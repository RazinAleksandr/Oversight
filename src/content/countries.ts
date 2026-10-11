/**
 * Playable countries (also used as rivals). Numbers follow GDD §13.
 * All four are fictional archetypes — recognizable, never caricatured.
 */
import type { CountryDef, CountryId } from '../engine/types';

export const COUNTRY_ORDER: CountryId[] = ['atlantic', 'hanzhou', 'commonwealth', 'meridian'];

export const COUNTRIES: Record<CountryId, CountryDef> = {
  atlantic: {
    id: 'atlantic',
    name: 'Atlantic Federation',
    shortName: 'Atlantic',
    adjective: 'Atlantic',
    capital: 'Concord',
    leaderTitle: 'President',
    color: '#3b6fd8',
    color2: '#e0474c',
    tagline: 'You own the fastest engine on Earth. Nobody installed the brakes.',
    description:
      'A continental federation with the deepest capital markets on the planet and the labs everyone else is chasing. Its companies set the global pace and answer to shareholders first. Its politics swing hard, and every two years the ground can move under your desk.',
    strengths: [
      'Home of the world-leading frontier labs',
      'Most compute and private capital of any nation',
      'Strong military and cyber command',
      'Highest starting income',
    ],
    weaknesses: [
      'Labs are ambitious, secretive and well-lawyered',
      'Polarized politics: confidence swings harder',
      'Two elections in four years',
      'Thin starting safeguards for the capability you host',
    ],
    start: { confidence: 55, economy: 60, stability: 50, security: 65, budget: 20 },
    incomeBase: 16,
    compute: 1.3,
    labCapRange: [2.6, 3.0],
    startSafeguards: 1.8,
    stancePool: ['accelerationist', 'hawk', 'populist'],
    calendar: [
      { turn: 7, kind: 'election' },
      { turn: 13, kind: 'election' },
    ],
    traitPlus: { name: 'Frontier Powerhouse', text: 'Domestic AI capability grows 15% faster.' },
    traitMinus: {
      name: 'Polarized',
      text: 'Government confidence swings 30% harder in both directions, and domestic labs start more ambitious.',
    },
    modifiers: { capabilityGrowth: 0.15, confidenceVolatility: 0.3 },
    trust: { hanzhou: 30, commonwealth: 60, meridian: 62 },
    rival: { aggression: [0.45, 0.75], safetyStance: [0.25, 0.55], leadLab: 'Halcyon Labs' },
    intro: [
      '{leaderTitle} {leader} has signed the order creating the Federal Office for AI Readiness, and you are its first Director. Your office in {capital} still smells of fresh paint. Your inbox does not care.',
      'Three of the five most capable AI labs on Earth are headquartered within a day\'s drive of your desk. They are richer than most states, faster than any regulator, and they have already booked meetings with you for next week.',
      'The {leaderTitle} wants the Federation to stay in front. The public wants its jobs. The labs want a free hand. Somewhere between those demands is a version of 2030 everyone survives. Find it.',
    ],
  },

  hanzhou: {
    id: 'hanzhou',
    name: 'Hanzhou Republic',
    shortName: 'Hanzhou',
    adjective: 'Hanzhou',
    capital: 'Lingzhou',
    leaderTitle: 'Chairman',
    color: '#d6453d',
    color2: '#f0b429',
    tagline: 'When the state decides, the country moves. Make sure it moves the right way.',
    description:
      'A vast industrial republic with a disciplined state, world-class manufacturing and a population that adopts new tools at breathtaking speed. Its labs are talented but starved of the most advanced chips, and the rest of the world watches every move with suspicion.',
    strengths: [
      'Policies and enforcement cost no political capital',
      'AI adoption ramps up 25% faster',
      'Strong government confidence and social order',
      'Massive industrial base ready for automation',
    ],
    weaknesses: [
      'Chip-limited: lower compute, exposed to export controls',
      'Low trust from every foreign capital',
      'Job displacement hits stability harder',
      'Labs start behind the Atlantic frontier',
    ],
    start: { confidence: 65, economy: 55, stability: 60, security: 60, budget: 20 },
    incomeBase: 15,
    compute: 0.9,
    labCapRange: [2.2, 2.6],
    startSafeguards: 2.0,
    stancePool: ['hawk', 'accelerationist', 'cautious'],
    calendar: [{ turn: 9, kind: 'congress' }],
    traitPlus: {
      name: 'State Direction',
      text: 'Enacting policies and enforcement costs no confidence. AI adoption ramps up 25% faster.',
    },
    traitMinus: {
      name: 'Chip-Limited',
      text: 'Compute is scarce and vulnerable to foreign export controls. Rivals distrust you. Displacement hits stability 20% harder.',
    },
    modifiers: { adoptionRamp: 0.25, displacementSensitivity: 0.2, policyCostMult: -1 },
    trust: { atlantic: 25, commonwealth: 35, meridian: 22 },
    rival: { aggression: [0.5, 0.8], safetyStance: [0.3, 0.6], leadLab: 'Qiming Institute' },
    intro: [
      'The Standing Council has approved the National Directorate for Intelligent Systems, and {leaderTitle} {leader} has placed you at its head. In {capital}, an appointment like this is an honour and a warning at the same time.',
      'The factories along the eastern corridor are ready to automate. The labs are brilliant and hungry, but the chips they need are made abroad, by countries that would like to keep it that way.',
      'The Council expects results before the National Congress convenes. The world expects you to cut corners. Prove both of them wrong, and keep the Republic whole while the century changes shape.',
    ],
  },

  commonwealth: {
    id: 'commonwealth',
    name: 'European Commonwealth',
    shortName: 'Commonwealth',
    adjective: 'Commonwealth',
    capital: 'Aurelle',
    leaderTitle: 'Chancellor',
    color: '#e9b949',
    color2: '#2c4f9e',
    tagline: 'You write the rules the world will follow. If the economy survives you writing them.',
    description:
      'Twenty-seven member states bound by treaty, trade and long memory. The Commonwealth writes the regulations the rest of the world ends up copying, and its diplomats can get anyone to the table. Its labs, however, are a step behind, and its economy feels every step.',
    strengths: [
      'Policies cost 40% less political capital',
      'Accord diplomacy is 30% more effective',
      'Strong social safety net: displacement hurts less',
      'Highest stability and foreign trust',
    ],
    weaknesses: [
      'Domestic labs lag the frontier',
      'Prosperity drifts down each quarter',
      'Weak security posture at the start',
      'Chips and compute bought from abroad',
    ],
    start: { confidence: 60, economy: 55, stability: 65, security: 45, budget: 22 },
    incomeBase: 14,
    compute: 0.9,
    labCapRange: [1.8, 2.3],
    startSafeguards: 2.3,
    stancePool: ['cautious', 'populist', 'accelerationist'],
    calendar: [{ turn: 10, kind: 'election' }],
    traitPlus: {
      name: 'Regulatory Power',
      text: 'Policies cost 40% less confidence, accord progress is 30% faster, and workforce programs mitigate 20% more displacement.',
    },
    traitMinus: { name: 'Lagging Labs', text: 'Domestic labs start behind and prosperity drifts down 0.2 per quarter.' },
    modifiers: { policyCostMult: -0.4, accordGain: 0.3, displacementMitigation: 0.2, economyPerTurn: -0.2 },
    trust: { atlantic: 62, hanzhou: 48, meridian: 66 },
    rival: { aggression: [0.1, 0.35], safetyStance: [0.6, 0.9], leadLab: 'Aster Research' },
    intro: [
      'The Council of Ministers has created the Commonwealth Authority for Artificial Intelligence, and {leaderTitle} {leader} has asked you to lead it from {capital}. Twenty-seven governments will read every memo you sign.',
      'Your labs are good, but the frontier belongs to others. What the Commonwealth has instead is the power to set rules, and a diplomatic corps that can put rivals in the same room.',
      'The {leaderTitle} wants the Commonwealth to lead without falling behind. Regulation is your strongest instrument. Used carelessly, it is also the quickest way to watch your industry move abroad.',
    ],
  },

  meridian: {
    id: 'meridian',
    name: 'Meridian Republic',
    shortName: 'Meridian',
    adjective: 'Meridian',
    capital: 'Port Selan',
    leaderTitle: 'Prime Minister',
    color: '#1fb58f',
    color2: '#e6efe9',
    tagline: 'Every frontier model runs on chips you make. Every rival knows your address.',
    description:
      'An island republic of twenty million that manufactures most of the world\'s advanced AI chips. That makes Meridian rich, indispensable and permanently in someone\'s crosshairs. Its diplomacy is nimble and its labs are sharp, but its military would not last a week alone.',
    strengths: [
      'Silicon Shield: export controls are twice as effective',
      'Extra income from chip exports (+2 per quarter)',
      'Balanced, confident government at the start',
      'Fast, capable labs with privileged chip access',
    ],
    weaknesses: [
      'Small military: lowest starting security',
      'Rivals are more aggressive toward Meridian',
      'Security erodes a little every quarter',
      'Two elections in four years',
    ],
    start: { confidence: 60, economy: 62, stability: 60, security: 45, budget: 18 },
    incomeBase: 14,
    compute: 1.15,
    labCapRange: [2.0, 2.4],
    startSafeguards: 2.0,
    stancePool: ['cautious', 'hawk', 'accelerationist'],
    calendar: [
      { turn: 6, kind: 'election' },
      { turn: 12, kind: 'election' },
    ],
    traitPlus: {
      name: 'Silicon Shield',
      text: 'Your export controls hit twice as hard, and chip exports add +2 income per quarter.',
    },
    traitMinus: {
      name: 'Small Military',
      text: 'Rivals act more aggressively toward Meridian, and security drifts down 0.2 per quarter.',
    },
    modifiers: { exportControlPower: 1.0, incomePerTurn: 2, securityPerTurn: -0.2 },
    trust: { atlantic: 60, hanzhou: 30, commonwealth: 64 },
    rival: { aggression: [0.2, 0.45], safetyStance: [0.4, 0.7], leadLab: 'Sundial Labs' },
    intro: [
      '{leaderTitle} {leader} has created the Office of Strategic Computing in {capital} and handed you the keys. On the wall of your new office hangs a map of the strait. Someone has drawn the shipping lanes in red.',
      'The fabs on the eastern shore print the chips that every frontier model on Earth runs on. That is your leverage, your income, and the reason four navies keep ships within a day of your coast.',
      'The {leaderTitle} needs growth, allies and time. The great powers need your chips more than they need your opinion. Make them need both.',
    ],
  },
};
