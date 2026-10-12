import { clamp } from './util';

/** Shared by settlement and conditional public forecasts. */
export function adoptionStep(current: number, target: number, rampModifier: number, cap = 100): number {
  const rate = clamp(0.4 * (1 + rampModifier), 0.1, 0.9);
  return clamp(Math.min(current + (target - current) * rate, cap), 0, 100);
}
