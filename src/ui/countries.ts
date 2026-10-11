/**
 * Country cards for the new-game screen and the debrief, read from content with a placeholder fallback.
 * Kept separate from the mock so production bundles never include MockGame.
 */
import type { CountryDef, CountryId } from '../engine/types';
import { COUNTRIES } from '../content/countries';

export type CountryCard = Pick<
  CountryDef,
  'id' | 'name' | 'shortName' | 'adjective' | 'leaderTitle' | 'color' | 'color2' | 'tagline' | 'description' | 'strengths' | 'weaknesses' | 'traitPlus' | 'traitMinus' | 'start'
>;

export const PLACEHOLDER_COUNTRIES: Record<CountryId, CountryCard> = {
  atlantic: {
    id: 'atlantic', name: 'Atlantic Federation', shortName: 'Atlantic', adjective: 'Atlantic', leaderTitle: 'President',
    color: '#3b6fd8', color2: '#e0474c', tagline: 'You own the fastest engine on Earth. Nobody installed the brakes.',
    description: 'Home of the labs everyone else is chasing.',
    strengths: ['World-leading frontier labs', 'Most compute and capital'], weaknesses: ['Ambitious, secretive labs', 'Polarized politics'],
    traitPlus: { name: 'Frontier Powerhouse', text: 'Domestic AI capability grows 15% faster.' },
    traitMinus: { name: 'Polarized', text: 'Confidence swings 30% harder.' },
    start: { confidence: 55, economy: 60, stability: 50, security: 65, budget: 20 },
  },
  hanzhou: {
    id: 'hanzhou', name: 'Hanzhou Republic', shortName: 'Hanzhou', adjective: 'Hanzhou', leaderTitle: 'Chairman',
    color: '#d8433b', color2: '#f2c14e', tagline: 'Deploy at the speed of the state.', description: 'A directed economy built to deploy fast.',
    strengths: ['State direction', 'Fast adoption'], weaknesses: ['Chip-limited', 'Low foreign trust'],
    traitPlus: { name: 'State Direction', text: 'Policies cost no confidence; adoption ramps faster.' },
    traitMinus: { name: 'Chip-limited', text: 'Vulnerable to export controls.' },
    start: { confidence: 65, economy: 55, stability: 60, security: 60, budget: 18 },
  },
  commonwealth: {
    id: 'commonwealth', name: 'European Commonwealth', shortName: 'Commonwealth', adjective: 'Commonwealth', leaderTitle: 'Chancellor',
    color: '#3f8f7a', color2: '#e8c169', tagline: 'Write the rules the world will live by.', description: 'Regulatory superpower with lagging labs.',
    strengths: ['Regulatory power', 'Trusted diplomacy'], weaknesses: ['Lagging labs', 'Slow growth'],
    traitPlus: { name: 'Regulatory Power', text: 'Policies cost 40% less; accord progress +30%.' },
    traitMinus: { name: 'Lagging Labs', text: 'Prosperity drifts down each quarter.' },
    start: { confidence: 60, economy: 55, stability: 65, security: 45, budget: 18 },
  },
  meridian: {
    id: 'meridian', name: 'Meridian Republic', shortName: 'Meridian', adjective: 'Meridian', leaderTitle: 'Prime Minister',
    color: '#8a5cf6', color2: '#3fd0ff', tagline: 'The world runs on your chips.', description: 'Small island state at the heart of the chip supply chain.',
    strengths: ['Silicon Shield', 'Extra income'], weaknesses: ['Small military', 'Security pressure'],
    traitPlus: { name: 'Silicon Shield', text: 'Export controls are twice as powerful; +2 income.' },
    traitMinus: { name: 'Small Military', text: 'Rivals are more aggressive toward you.' },
    start: { confidence: 60, economy: 62, stability: 60, security: 45, budget: 18 },
  },
};

export function countryCard(id: CountryId): CountryCard {
  const real = (COUNTRIES as Partial<Record<CountryId, CountryDef>>)[id];
  return real ?? PLACEHOLDER_COUNTRIES[id];
}

