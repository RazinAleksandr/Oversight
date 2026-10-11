/**
 * Domestic labs (GDD §3–4): capability growth, concealment, intel decay, trait drift,
 * hidden violations, relation drift and lobbying, model-release readiness.
 */
import { addEvidence, changeCapability, changeCompanyRelation, changeMeter } from '../changes';
import { getCountry } from '../content';
import { dateLabel } from '../labels';
import { addLog, highlight, trigger } from '../log';
import { flagNum, getMods } from '../modifiers';
import { hasPolicy, shownTurn } from '../query';
import { lineUsed, markLineUsed } from '../news';
import { rng } from '../rng';
import type { Company, GameState, Modifiers, SituationType, Violation } from '../types';
import { clamp, nextId } from '../util';
import { spawnSituation } from './situations';
import type { TickCtx } from './tick';

const INCIDENT_TYPE: Record<Company['archetype'], SituationType> = {
  frontier: 'rogue_agents',
  bigtech: 'mass_manipulation',
  defense: 'military_escalation',
  opensource: 'cyber_misuse',
};

/** Capability hidden by low-transparency companies (GDD §4: up to 1.0 when transparency < 40). */
export function concealment(c: Company): number {
  const base = c.transparency < 40 ? ((40 - c.transparency) / 40) * 1.0 : 0;
  return base + (c.hiddenGain ?? 0);
}

export function syncReported(c: Company): void {
  c.reportedCapability = clamp(c.capability - concealment(c), 0, 10);
}

/** Multiplier from foreign export controls imposed on the player (Hanzhou is more exposed). */
export function exportControlsOnUsFactor(s: GameState): number {
  if (!s.flags.exportControlsOnUs) return 1;
  return s.countryId === 'hanzhou' ? 0.8 : 0.88;
}

/** Expected per-quarter capability growth of a domestic company (before noise). */
export function companyGrowth(s: GameState, c: Company, mods: Modifiers): number {
  const country = getCountry(s.countryId);
  const compute = c.compute * country.compute;
  let g = 0.13 * compute * (1 + c.ambition / 250) * (1 + 0.14 * Math.max(0, c.capability - 3)) * (1 + mods.capabilityGrowth);
  g *= exportControlsOnUsFactor(s);
  if (c.status === 'sanctioned') g *= 0.8;
  if (c.status === 'suspended') g *= 0.3;
  if (hasPolicy(s, 'compute_licensing') && c.archetype === 'opensource') g *= 0.9;
  g *= 1 + 0.03 * s.rivals.filter((r) => r.partnership).length;
  return Math.max(0, g);
}

export function readyToRelease(s: GameState, c: Company): boolean {
  if (c.status === 'suspended') return false;
  if (s.models.some((m) => m.companyId === c.id && (m.status === 'pending' || m.status === 'evaluating'))) return false;
  return c.capability - c.capAtLastModel >= 1.2 || s.turn - c.lastModelTurn >= 6;
}

const VIOLATION_TEXT: Record<Violation['kind'], string> = {
  secret_training: 'ran an unreported large training run',
  unreported_incident: 'concealed a safety incident from regulators',
  unauthorized_deployment: 'deployed a model without approval',
  safety_cut: 'quietly cut its safety team',
};

export function addViolation(s: GameState, c: Company, kind: Violation['kind'], detail?: string): Violation {
  const v: Violation = {
    id: nextId(s, 'v'),
    companyId: c.id,
    kind,
    turn: s.turn,
    description: `${c.name} ${detail ?? VIOLATION_TEXT[kind]} (${dateLabel(shownTurn(s))}).`,
    discovered: false,
  };
  c.violations.push(v);
  return v;
}

/** Marks a violation discovered and grants Evidence about the company. */
export function discoverViolation(s: GameState, c: Company, v: Violation, how: string): void {
  if (v.discovered) return;
  v.discovered = true;
  v.discoveredTurn = s.turn;
  if (v.kind === 'secret_training') {
    c.hiddenGain = 0;
    syncReported(c);
  }
  addEvidence(s, `${v.description} (${how})`, { companyId: c.id }, `Evidence: ${c.name}`);
  addLog(s, `Discovered: ${v.description}`, false, 'bad', { companyId: c.id });
  highlight(s, `Evidence found: ${v.description}`, 'bad', 'evidence');
}

export function tickCompanies(s: GameState, _tc: TickCtx): void {
  const r = rng(s);
  const mods = getMods(s);
  for (const c of s.companies) {
    // Capability growth with noise and rare breakthroughs.
    const g = companyGrowth(s, c, mods) * r.range(0.7, 1.3);
    changeCapability(s, { companyId: c.id }, g, 'Research progress');
    if (r.chance(0.06)) {
      const gain = r.range(0.4, 0.8);
      changeCapability(s, { companyId: c.id }, gain, 'Breakthrough');
      trigger(s, 'domestic_breakthrough', { companyId: c.id });
      const line = `${c.name} reports a breakthrough`;
      highlight(s, lineUsed(s, line) ? `${c.name} reports another breakthrough` : line, 'neutral', 'capability');
      markLineUsed(s, line);
    }

    // Trait drift from programs/policies and relationship.
    c.safety = clamp(c.safety + mods.companySafety, 0, 100);
    c.transparency = clamp(c.transparency + mods.companyTransparency + (c.relation > 70 ? 2 : 0), 0, 100);
    c.ambition = clamp(c.ambition + mods.companyAmbition, 0, 100);

    // Relation drift: policy friction plus slow regression toward neutral.
    const drift = mods.companyRelation + (50 - c.relation) * 0.04;
    if (Math.abs(drift) >= 0.05) changeCompanyRelation(s, c.id, drift, mods.companyRelation < 0 ? 'Regulatory friction' : 'Relations settle');
    if (c.relation < 25) changeMeter(s, 'confidence', -1, `Lobbying by ${c.name}`);
    if (c.status === 'sanctioned' && s.turn - flagNum(s, `sanctionTurn:${c.id}`, -99) >= 3) c.status = 'active';

    // Intel decays after an investigation; cooperative companies keep you better informed.
    if (c.lastInvestigatedTurn !== null) {
      const floor = c.relation > 70 ? 0.5 : 0.25;
      c.intel = Math.max(floor, c.intel - 0.12);
      if (c.intel < 0.3) c.knownTraits = { safety: false, transparency: false, ambition: false };
    }

    rollViolation(s, c, mods);
    syncReported(c);
  }
}

function rollViolation(s: GameState, c: Company, mods: Modifiers): void {
  const r = rng(s);
  // Compute licensing makes secret training runs visible to regulators over time.
  if (hasPolicy(s, 'compute_licensing')) {
    for (const v of c.violations) {
      if (!v.discovered && v.kind === 'secret_training' && r.chance(0.3)) discoverViolation(s, c, v, 'compute license audit');
    }
  }
  if (s.turn < 3 || c.ambition <= 60 || c.transparency >= 50) return;
  const p = 0.08 * Math.max(0, 1 + mods.violationChance);
  if (!r.chance(p)) return;
  const kind = r.weightedPick<Violation['kind']>(['secret_training', 'unreported_incident', 'safety_cut'], (k) =>
    k === 'secret_training' ? 3 : k === 'unreported_incident' ? (s.turn >= 4 ? 2 : 0) : 1,
  );
  if (!kind) return;
  addViolation(s, c, kind);
  if (kind === 'secret_training') {
    c.capability = clamp(c.capability + 0.3, 0, 10);
    c.hiddenGain = (c.hiddenGain ?? 0) + 0.3;
  } else if (kind === 'safety_cut') {
    c.safety = clamp(c.safety - 10, 0, 100);
  } else if (kind === 'unreported_incident') {
    const type = INCIDENT_TYPE[c.archetype];
    spawnSituation(s, type, { companyId: c.id, severity: 10, noEarlyBoost: true, origin: `${c.name} (unreported incident)` });
  }
}
