/** Conditional public forecasts. Never tick the simulation or consume its RNG. */
import type { Demand, DemandView, GameState } from './types';
import { computeIncome, programUpkeep } from './systems/economy';
import { adoptionStep } from './adoption';
import { infraCap } from './changes';
import { getMods } from './modifiers';

export function demandForecast(s: GameState, d: Demand): DemandView['forecast'] {
  if (!['active', 'offered'].includes(d.status) || !['budget_cut', 'defense_program', 'deploy_sector'].includes(d.kind)) return undefined;
  const quarters = Math.max(1, d.deadlineTurn - s.turn + 1);
  const income = computeIncome(s);
  let budget = s.budget;
  let fundingGap = false;
  for (let i = 0; i < quarters; i++) {
    // Account for the known expiry of free safety upkeep without modifying the save.
    budget += income - programUpkeep({ ...s, turn: s.turn + i });
    if (budget < 0) fundingGap = true;
  }
  if (d.kind === 'deploy_sector') {
    const sector = d.target.sector;
    if (!sector) return undefined;
    let projected = s.adoption[sector], order = s.adoptionTarget[sector];
    const cap = sector === 'infrastructure' ? infraCap(s) : 100;
    const ramp = getMods(s).adoptionRamp;
    for (let i = 0; i < quarters; i++) {
      if (sector === 'defense' && s.programs.defense > 0 && order < 80) order += Math.min(4 * s.programs.defense, 80 - order);
      if (sector === 'infrastructure') order = Math.min(order, cap);
      projected = adoptionStep(projected, order, ramp, cap);
    }
    return { metric: 'adoption', current: s.adoption[sector], target: d.target.value ?? 0,
      projected: fundingGap ? null : projected, quarters, currentOrder: s.adoptionTarget[sector] };
  }
  return {
    metric: d.kind === 'budget_cut' ? 'budget' : 'defense',
    current: d.kind === 'budget_cut' ? s.budget : s.programs.defense,
    target: d.kind === 'budget_cut' ? d.target.value ?? 0 : d.target.level ?? 2,
    projected: fundingGap ? null : d.kind === 'budget_cut' ? budget : s.programs.defense,
    quarters,
  };
}
