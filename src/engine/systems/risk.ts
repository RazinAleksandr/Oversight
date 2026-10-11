/**
 * Hidden global risk (GDD §2.2, §7) and national safeguards growth (GDD §3).
 * Risk sources are tallied in `state.riskSources` for the debrief and failure typing.
 */
import { changeResource, changeRisk } from '../changes';
import { SAFETY_PROGRAM_GROWTH } from '../data/programs';
import { DIFFICULTY, modSources } from '../modifiers';
import { accordActive, avgCompanySafety, leadingCompany } from '../query';
import { rng } from '../rng';
import type { GameState } from '../types';
import { clamp } from '../util';

export function safeguardsGrowth(s: GameState): { label: string; value: number }[] {
  const lvl = s.programs.safety ?? 0;
  const parts: { label: string; value: number }[] = [
    { label: 'Baseline safety science', value: 0.05 },
    { label: 'Industry safety work', value: (avgCompanySafety(s) / 100) * 0.08 },
  ];
  if (lvl > 0) parts.push({ label: 'Alignment & Safety Research program', value: SAFETY_PROGRAM_GROWTH[lvl] });
  if (accordActive(s)) parts.push({ label: 'Global Accord research sharing', value: 0.08 });
  const partners = s.rivals.filter((r) => r.partnership).length;
  if (partners) parts.push({ label: 'Research partnerships', value: 0.03 * partners });
  for (const src of modSources(s, 'safeguardsGrowth')) parts.push(src);
  return parts;
}

export function tickSafeguards(s: GameState): void {
  for (const p of safeguardsGrowth(s)) changeResource(s, 'safeguards', p.value, p.label);
}

export function tickRisk(s: GameState): void {
  const diff = DIFFICULTY[s.difficulty].riskGrowth;
  const add = (v: number, reason: string, key: string) => {
    if (v > 0) changeRisk(s, v * diff, reason, key);
    else if (v < 0) changeRisk(s, v, reason, key);
  };

  // Domestic frontier: capability outpacing national safeguards, scaled by lab recklessness.
  const lead = leadingCompany(s);
  if (lead) {
    const gap = lead.capability - s.safeguards - 0.5;
    if (gap > 0) add(0.6 * gap * (0.5 + lead.ambition / 100), 'Domestic frontier outpacing safeguards', 'domestic');
    else if (gap < -0.5) add(Math.max(-1.2, 0.4 * (gap + 0.5)), 'Safety research ahead of capability', 'domestic');
  }
  // Rivals.
  for (const r of s.rivals) {
    const gap = r.capability - r.safeguards - 0.5;
    if (gap > 0) add(0.6 * gap * (0.5 + r.aggression), `${r.name} racing ahead of its safeguards`, `rival:${r.id}`);
  }
  // Race tension.
  if (s.tension > 50) add((s.tension - 50) * 0.04, 'Race tension', 'tension');
  // Open situations.
  for (const x of s.situations) {
    if (x.resolved || x.stage < 1) continue;
    add(x.stage * 0.4, `Situation: ${x.type}`, `situation:${x.type}`);
  }
  if (accordActive(s)) add(-0.8, 'Global Accord', 'accord');
  for (const src of modSources(s, 'riskPerTurn')) add(src.value, src.label, 'policy');

  // The estimate's persistent bias shrinks as oversight improves.
  const lvl = s.programs.oversight ?? 0;
  s.riskBias = clamp(s.riskBias * (0.97 - 0.07 * lvl) + rng(s).noise(0.6), -15, 15);
}
