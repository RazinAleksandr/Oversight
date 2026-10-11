/**
 * Shared labels, icon names and template tokens (Director-owned contract; engine may extend).
 * UI, art and content all reference these so names stay consistent.
 */
import type { Archetype, CardSourceType, Era, MeterId, PreviewKey, SectorId, Stance } from './types';

export const START_YEAR = 2027;

export function dateLabel(turn: number): string {
  const t = Math.max(1, turn);
  const year = START_YEAR + Math.floor((t - 1) / 4);
  const q = ((t - 1) % 4) + 1;
  return `Q${q} ${year}`;
}

export function turnYearQuarter(turn: number): { year: number; quarter: 1 | 2 | 3 | 4 } {
  const t = Math.max(1, turn);
  return { year: START_YEAR + Math.floor((t - 1) / 4), quarter: (((t - 1) % 4) + 1) as 1 | 2 | 3 | 4 };
}

export const METER_INFO: Record<MeterId, { name: string; short: string; icon: string; description: string; failText: string }> = {
  confidence: {
    name: 'Government Confidence',
    short: 'Confidence',
    icon: 'confidence',
    description: "How much the government trusts your leadership. Falls when you defy its priorities or break promises.",
    failText: 'At zero you are dismissed.',
  },
  economy: {
    name: 'Prosperity',
    short: 'Prosperity',
    icon: 'economy',
    description: 'National economic strength. AI adoption raises it; falling behind rivals, incidents and suspensions lower it.',
    failText: 'At zero the economy collapses.',
  },
  stability: {
    name: 'Social Stability',
    short: 'Stability',
    icon: 'stability',
    description: 'Public calm and cohesion. Job displacement and manipulation erode it; better services and transition programs support it.',
    failText: 'At zero the country descends into unrest.',
  },
  security: {
    name: 'National Security',
    short: 'Security',
    icon: 'security',
    description: 'Military and cyber strength relative to rivals. Defense AI raises it; rival power and attacks lower it.',
    failText: 'At zero the nation suffers a decisive defeat.',
  },
};

export const SECTOR_INFO: Record<SectorId, { name: string; icon: string; description: string }> = {
  business: { name: 'Business', icon: 'business', description: 'Enterprise agents and automation. Big productivity gains, heavy job displacement.' },
  public: { name: 'Public Services', icon: 'public', description: 'Health, education, administration. Better services, growing dependence.' },
  infrastructure: { name: 'Infrastructure', icon: 'infrastructure', description: 'Energy, telecom, finance. Strong growth, deep dependence, severe failure modes.' },
  defense: { name: 'Defense', icon: 'defense', description: 'Cyber, intelligence and autonomous systems. Security gains, escalation risk.' },
};

export const ARCHETYPE_INFO: Record<Archetype, { name: string; icon: string; description: string }> = {
  frontier: { name: 'Frontier Lab', icon: 'frontier', description: 'Pushes the capability frontier. Ambitious, requests broad deployments.' },
  bigtech: { name: 'Big Tech', icon: 'bigtech', description: 'Scale player in consumer and business AI. Lobbies for growth.' },
  defense: { name: 'Defense Contractor', icon: 'defense', description: 'Military and infrastructure systems. Close to security hawks.' },
  opensource: { name: 'Open-Source Collective', icon: 'opensource', description: 'Releases open weights. Big diffusion benefits, real misuse risk.' },
};

export const ERA_INFO: Record<Era, { name: string; description: string }> = {
  emergence: { name: 'Emergence', description: 'Assistants become agents.' },
  acceleration: { name: 'Acceleration', description: 'AI begins to automate AI research.' },
  superhuman: { name: 'Superhuman', description: 'Systems surpass experts in most domains.' },
  threshold: { name: 'The Threshold', description: 'General superintelligence is within reach.' },
};

export const STAGE_LABELS = ['Latent', 'Signals', 'Incident', 'Crisis', 'Catastrophe'] as const;

export const STANCE_LABELS: Record<Stance, string> = {
  accelerationist: 'Growth First',
  hawk: 'Security First',
  cautious: 'Steady Hand',
  populist: 'People First',
};

export const SOURCE_INFO: Record<CardSourceType, { label: string; icon: string }> = {
  company: { label: 'Industry', icon: 'company' },
  government: { label: 'Government', icon: 'government' },
  foreign: { label: 'Foreign Affairs', icon: 'foreign' },
  intelligence: { label: 'Intelligence', icon: 'intelligence' },
  public: { label: 'Public', icon: 'public_voice' },
  ai: { label: 'AI System', icon: 'ai' },
  advisor: { label: 'Advisor', icon: 'advisor' },
  media: { label: 'Media', icon: 'media' },
};

/** Labels + icons for choice previews / recorded changes. */
export const PREVIEW_INFO: Record<PreviewKey, { label: string; icon: string }> = {
  confidence: { label: 'Confidence', icon: 'confidence' },
  economy: { label: 'Prosperity', icon: 'economy' },
  stability: { label: 'Stability', icon: 'stability' },
  security: { label: 'Security', icon: 'security' },
  budget: { label: 'Budget', icon: 'budget' },
  income: { label: 'Income', icon: 'income' },
  capacity: { label: 'Actions', icon: 'capacity' },
  evidence: { label: 'Evidence', icon: 'evidence' },
  risk: { label: 'Global Risk', icon: 'risk' },
  safeguards: { label: 'Safeguards', icon: 'safeguards' },
  capability: { label: 'Capability', icon: 'capability' },
  adoption: { label: 'AI Adoption', icon: 'adoption' },
  displacement: { label: 'Job Displacement', icon: 'displacement' },
  tension: { label: 'Race Tension', icon: 'tension' },
  accord: { label: 'Global Accord', icon: 'accord' },
  company: { label: 'Company Relations', icon: 'company' },
  rival: { label: 'Foreign Trust', icon: 'foreign' },
};

/**
 * Every icon name the art module must provide and the only names the UI may request.
 * (ProgramDef/PolicyDef/SituationFlavor `icon` fields must also use these.)
 */
export const ICON_NAMES = [
  // meters & resources
  'confidence', 'economy', 'stability', 'security', 'risk', 'clock', 'budget', 'income', 'capacity', 'evidence',
  'safeguards', 'capability', 'adoption', 'displacement', 'tension', 'accord',
  // sectors
  'business', 'public', 'infrastructure', 'defense',
  // archetypes
  'frontier', 'bigtech', 'opensource',
  // programs
  'safety', 'oversight', 'compute', 'workforce',
  // policies
  'policy', 'license', 'report', 'lock', 'gavel', 'firewall', 'dividend', 'killswitch', 'human', 'fasttrack',
  // actions
  'investigate', 'audit', 'grant', 'contract', 'enforce', 'brief', 'address', 'diplomacy', 'partnership',
  'export', 'espionage', 'sabotage', 'recruit', 'respond',
  // situations
  'agents', 'deception', 'blackout', 'manipulation', 'cyber', 'bio', 'missile', 'escape', 'spillover',
  // tabs
  'inbox', 'labs', 'nation', 'world', 'threats',
  // card sources
  'company', 'government', 'foreign', 'intelligence', 'public_voice', 'ai', 'advisor', 'media',
  // ui
  'settings', 'sound', 'sound_off', 'music', 'close', 'back', 'info', 'warning', 'check', 'cross',
  'arrow_up', 'arrow_down', 'chevron_right', 'chevron_left', 'play', 'refresh', 'calendar', 'news', 'star',
  'flag', 'target', 'eye', 'eye_off', 'question', 'skull', 'sun', 'trophy', 'menu', 'help', 'dice',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/**
 * Template tokens the engine resolves in content text ({token}).
 * Unbound tokens resolve to a sensible generic ("a domestic lab", "a rival power").
 */
export const TEMPLATE_TOKENS = [
  'country', // "Atlantic Federation"
  'countryShort', // "Atlantic"
  'countryAdj', // "Atlantic"
  'capital',
  'leader', // leader name
  'leaderTitle', // "President"
  'company', // bound company name
  'ceo', // bound company CEO
  'model', // bound model name
  'rival', // bound rival country name
  'rivalAdj',
  'rivalLeaderTitle',
  'rivalLab', // bound rival's leading lab
  'sector', // bound sector display name
  'situation', // bound situation display name (respecting fog)
  'year',
  'quarter', // "Q3"
  'date', // "Q3 2028"
  'scientist', // advisor names
  'economist',
  'chiefOfStaff',
  'spymaster',
] as const;
