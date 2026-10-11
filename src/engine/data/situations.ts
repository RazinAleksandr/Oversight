/** Situation mechanics (GDD §8): growth bases, catastrophe consequences, response definitions. */
import type { FlawType, MeterId, SectorId, SituationType } from '../types';

export const SITUATION_BASE_GROWTH: Record<SituationType, number> = {
  rogue_agents: 7,
  deceptive_model: 5,
  infrastructure_failure: 6,
  mass_manipulation: 5,
  cyber_misuse: 8,
  bio_misuse: 7,
  military_escalation: 6,
  model_escape: 10,
  foreign_spillover: 8,
};

/** Sector whose adoption accelerates the situation. */
export const SITUATION_SECTOR: Record<SituationType, SectorId | null> = {
  rogue_agents: 'business',
  deceptive_model: null,
  infrastructure_failure: 'infrastructure',
  mass_manipulation: 'public',
  cyber_misuse: 'business',
  bio_misuse: null,
  military_escalation: 'defense',
  model_escape: null,
  foreign_spillover: null,
};

export const SITUATION_ICON: Record<SituationType, string> = {
  rogue_agents: 'agents',
  deceptive_model: 'deception',
  infrastructure_failure: 'blackout',
  mass_manipulation: 'manipulation',
  cyber_misuse: 'cyber',
  bio_misuse: 'bio',
  military_escalation: 'missile',
  model_escape: 'escape',
  foreign_spillover: 'spillover',
};

/** Risk "source family" a situation type feeds (decides the global failure type). */
export type RiskFamily = 'control' | 'misuse' | 'war';
export const SITUATION_FAMILY: Record<SituationType, RiskFamily> = {
  rogue_agents: 'control',
  deceptive_model: 'control',
  infrastructure_failure: 'control',
  mass_manipulation: 'control',
  cyber_misuse: 'misuse',
  bio_misuse: 'misuse',
  military_escalation: 'war',
  model_escape: 'control',
  foreign_spillover: 'control',
};

export const MISUSE_TYPES: SituationType[] = ['cyber_misuse', 'bio_misuse'];

/** Default situation produced by each flaw (sector/capability adjustments applied in deployment). */
export const FLAW_SITUATION: Record<FlawType, SituationType> = {
  scope_creep: 'rogue_agents',
  deceptive: 'deceptive_model',
  brittle: 'infrastructure_failure',
  manipulative: 'mass_manipulation',
  jailbreakable: 'cyber_misuse',
  power_seeking: 'model_escape',
};

/** Immediate meter hits when a situation reaches catastrophe (non-terminal cases). */
export const CATASTROPHE_HITS: Record<SituationType, Partial<Record<MeterId, number>>> = {
  rogue_agents: { economy: -15, stability: -8, security: -8, confidence: -12 },
  deceptive_model: { confidence: -12, security: -6 },
  infrastructure_failure: { economy: -18, stability: -10, confidence: -10 },
  mass_manipulation: { stability: -20, confidence: -8 },
  cyber_misuse: { security: -20, economy: -10, confidence: -8 },
  bio_misuse: { stability: -30, economy: -20 },
  military_escalation: { security: -30, stability: -8 },
  model_escape: { security: -20 },
  foreign_spillover: { economy: -10, stability: -8, security: -8 },
};

export type ResponseId = 'monitor' | 'investigate' | 'contain' | 'restrict' | 'suspend' | 'shutdown' | 'taskforce';

export const RESPONSE_INFO: Record<ResponseId, { label: string; description: string }> = {
  monitor: { label: 'Monitor', description: 'Keep watching. Free, but the situation keeps growing.' },
  investigate: { label: 'Investigate', description: 'Find the cause and true stage. Slows growth this quarter and unlocks targeted responses.' },
  contain: { label: 'Broad containment', description: 'Blunt measures: halve growth this quarter at an economic cost. Once the cause is known (and no single model is to blame), sustained containment makes it recede.' },
  restrict: { label: 'Restrict the model', description: 'Cut the source model\'s access. Growth ×0.4 while restricted; some adoption lost.' },
  suspend: { label: 'Suspend the model', description: 'Pull the source model entirely. The situation recedes, but dependent sectors take a hit.' },
  shutdown: { label: 'Emergency shutdown', description: 'Use the Off-Switch Mandate to end the crisis now, at a heavy cost.' },
  taskforce: { label: 'International task force', description: 'Pool resources with partners abroad to fight the spread.' },
};
