/** Leader stance mechanics (GDD §6). */
import type { Stance } from '../types';

export type Priority = 'growth' | 'security' | 'stability' | 'safety' | 'race';

export const PRIORITY_LABELS: Record<Priority, string> = {
  growth: 'Economic growth',
  security: 'National security',
  stability: 'Social stability',
  safety: 'AI safety',
  race: 'Winning the AI race',
};

export const STANCE_WEIGHTS: Record<Stance, Record<Priority, number>> = {
  accelerationist: { growth: 1.0, race: 0.8, security: 0.4, stability: 0.3, safety: 0.1 },
  hawk: { security: 1.0, race: 1.0, growth: 0.5, stability: 0.3, safety: 0.2 },
  cautious: { stability: 0.8, safety: 0.8, growth: 0.5, security: 0.5, race: 0.2 },
  populist: { stability: 1.0, growth: 0.6, security: 0.4, safety: 0.4, race: 0.3 },
};

/** Confidence reaction to deployment decisions, by stance. */
export const DEPLOY_REACTION: Record<Stance, { approve: number; limited: number; deepEval: number; reject: number }> = {
  accelerationist: { approve: 3, limited: 1, deepEval: -3, reject: -5 },
  hawk: { approve: 1, limited: 0, deepEval: -3, reject: -3 },
  cautious: { approve: -1, limited: 1, deepEval: 1, reject: 1 },
  populist: { approve: 0, limited: 1, deepEval: 0, reject: 0 },
};

/** How each stance phrases its view on a deployment request. */
export function stanceOnDeployment(stance: Stance, defense: boolean, business: boolean): { line: string; lean: 1 | 0 | -1 } {
  switch (stance) {
    case 'accelerationist':
      return { line: 'wants it approved quickly — growth cannot wait', lean: 1 };
    case 'hawk':
      return defense
        ? { line: 'strongly supports it: our forces need this edge', lean: 1 }
        : { line: 'supports it if it keeps us ahead of our rivals', lean: 1 };
    case 'cautious':
      return { line: 'wants a careful evaluation before anything is deployed', lean: -1 };
    case 'populist':
      return business
        ? { line: 'worries about what it will do to jobs', lean: 0 }
        : { line: 'wants to know how ordinary people will benefit', lean: 0 };
  }
}

/** Demand kinds each stance favours (weights). */
export const STANCE_DEMANDS: Record<Stance, Partial<Record<import('../types').DemandKind, number>>> = {
  accelerationist: { growth_target: 3, deploy_sector: 3, approve_model: 3, match_rival: 2, budget_cut: 1 },
  hawk: { defense_program: 3, match_rival: 3, deploy_sector: 2, cover_up: 1, approve_model: 1 },
  cautious: { jobs_guarantee: 2, budget_cut: 2, growth_target: 2, cover_up: 1, deploy_sector: 1 },
  populist: { jobs_guarantee: 3, growth_target: 2, cover_up: 2, budget_cut: 1, deploy_sector: 1 },
};
