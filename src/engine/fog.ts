/**
 * Fog of war: the only place that turns hidden truth into player-visible estimates.
 * Views and advisor notes must use these instead of reading hidden fields directly.
 */
import { getMods } from './modifiers';
import { findCompany } from './query';
import type { AIModel, Company, Estimate, GameState, Rival, TraitView } from './types';
import { clamp, hashNoise, round1 } from './util';

export function confidenceFromIntel(intel: number): Estimate['confidence'] {
  if (intel >= 0.95) return 'verified';
  if (intel >= 0.7) return 'high';
  if (intel >= 0.45) return 'medium';
  return 'low';
}

function estimate(value: number, u: number, conf: Estimate['confidence'], max = 10): Estimate {
  const v = round1(clamp(value, 0, max));
  return { value: v, low: round1(clamp(v - u, 0, max)), high: round1(clamp(v + u, 0, max)), confidence: conf };
}

/** Company capability as the department understands it (reports corrected by intel). */
export function companyCapEstimate(c: Company): Estimate {
  const value = c.reportedCapability + (c.capability - c.reportedCapability) * c.intel;
  return estimate(value, (1 - c.intel) * 1.5, confidenceFromIntel(c.intel));
}

export function modelCapEstimate(s: GameState, m: AIModel): Estimate {
  if (m.deepEvaluated || m.audited) return estimate(m.capability, 0, 'verified');
  const c = findCompany(s, m.companyId);
  const intel = c?.intel ?? 0.3;
  const value = m.claimedCapability + (m.capability - m.claimedCapability) * intel * 0.5;
  return estimate(value, (1 - intel) * 1.5, confidenceFromIntel(intel));
}

export function rivalCapEstimate(r: Rival): Estimate {
  return estimate(r.capability + r.estimateBias * (1 - r.intel), 0.3 + (1 - r.intel) * 2, confidenceFromIntel(r.intel));
}

export function rivalSafeguardsEstimate(r: Rival): Estimate {
  return estimate(r.safeguards - r.estimateBias * 0.5 * (1 - r.intel), 0.3 + (1 - r.intel) * 1.5, confidenceFromIntel(r.intel));
}

export function riskUncertainty(s: GameState): number {
  return Math.max(3, 18 + getMods(s).riskUncertainty - (s.accord.signed ? 4 : 0));
}

export function riskEstimate(s: GameState): { estimate: number; low: number; high: number } {
  const est = Math.round(clamp(s.risk + s.riskBias, 0, 100));
  const u = riskUncertainty(s);
  return { estimate: est, low: Math.round(clamp(est - u, 0, 100)), high: Math.round(clamp(est + u, 0, 100)) };
}

export function traitLabel(v: number): 'Low' | 'Medium' | 'High' {
  return v < 40 ? 'Low' : v < 67 ? 'Medium' : 'High';
}

export function traitView(c: Company, trait: 'safety' | 'transparency' | 'ambition'): TraitView {
  const truth = c[trait];
  if (c.knownTraits[trait]) return { label: traitLabel(truth), value: Math.round(truth), verified: true };
  if (c.intel >= 0.4 || c.relation > 70) {
    const noisy = truth + hashNoise(`${c.id}:${trait}`) * 20;
    return { label: traitLabel(noisy), value: null, verified: false };
  }
  return { label: 'Unknown', value: null, verified: false };
}

export function rivalTraitView(r: Rival, trait: 'aggression' | 'safetyStance'): TraitView {
  const truth = r[trait] * 100;
  if (r.intel >= 0.85) return { label: traitLabel(truth), value: Math.round(truth), verified: true };
  if (r.intel >= 0.35) return { label: traitLabel(truth + hashNoise(`${r.id}:${trait}`) * 22), value: null, verified: false };
  return { label: 'Unknown', value: null, verified: false };
}

/** Domestic frontier as the player sees it. */
export function domesticCapEstimate(s: GameState): { est: Estimate; leader: Company | undefined } {
  let best: Company | undefined;
  let bestEst: Estimate | undefined;
  for (const c of s.companies) {
    const e = companyCapEstimate(c);
    if (!bestEst || e.value > bestEst.value) {
      best = c;
      bestEst = e;
    }
  }
  return { est: bestEst ?? estimate(0, 0, 'low'), leader: best };
}

export function bestRivalEstimate(s: GameState): { rival: Rival | undefined; est: Estimate | undefined } {
  let rival: Rival | undefined;
  let est: Estimate | undefined;
  for (const r of s.rivals) {
    const e = rivalCapEstimate(r);
    if (!est || e.value > est.value) {
      rival = r;
      est = e;
    }
  }
  return { rival, est };
}
