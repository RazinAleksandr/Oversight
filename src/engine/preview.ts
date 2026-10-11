/**
 * Choice previews: icons for affected meters/resources with direction and magnitude (GDD §11).
 * Delayed/probabilistic consequences are never previewed — they only set `uncertain`.
 */
import { listJoinL, t } from '../i18n';
import { confidenceScale } from './changes';
import { SECTOR_INFO } from './labels';
import type { TemplateCtx } from './template';
import type { Effect, EffectPreview, GameState, MeterId, PreviewKey, SectorId } from './types';

export function magnitude(delta: number): 1 | 2 | 3 {
  const a = Math.abs(delta);
  return a <= 3 ? 1 : a <= 7 ? 2 : 3;
}

function capMagnitude(delta: number): 1 | 2 | 3 {
  const a = Math.abs(delta);
  return a <= 0.3 ? 1 : a <= 0.7 ? 2 : 3;
}

function dir(delta: number): 1 | -1 | 0 {
  return delta > 0 ? 1 : delta < 0 ? -1 : 0;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function pv(key: PreviewKey, delta: number, label?: string): EffectPreview {
  const p: EffectPreview = { key, dir: dir(delta), magnitude: magnitude(delta), amount: round1(delta) };
  if (label) p.label = label;
  return p;
}

/** Confidence preview for a raw (pre-volatility) change: shows what the player will actually feel. */
export function pvConf(s: GameState, rawDelta: number): EffectPreview {
  return pv('confidence', rawDelta * confidenceScale(s));
}

/** Confidence preview for an amount that is already effective (applied raw). */
export function pvConfExact(effectiveDelta: number): EffectPreview {
  return pv('confidence', effectiveDelta);
}

/** Small-unit resources (capacity, evidence, income): magnitude from a scaled delta, exact amount kept. */
export function pvUnits(key: PreviewKey, delta: number, scale = 3): EffectPreview {
  return { key, dir: dir(delta), magnitude: magnitude(delta * scale), amount: round1(delta) };
}

/** Adoption deltas are larger; chevrons scale so "with limits" shows fewer than full approval. */
export function adoptionMagnitude(delta: number): 1 | 2 | 3 {
  const a = Math.abs(delta);
  return a <= 8 ? 1 : a <= 18 ? 2 : 3;
}

export function pvAdoption(delta: number, label?: string): EffectPreview {
  const p: EffectPreview = { key: 'adoption', dir: dir(delta), magnitude: adoptionMagnitude(delta), amount: round1(delta) };
  if (label) p.label = label;
  return p;
}

/** Direction only: hidden quantities (risk, safeguards trend) never carry an exact amount. */
export function pvDir(key: PreviewKey, delta: number, label?: string): EffectPreview {
  const p: EffectPreview = { key, dir: dir(delta), magnitude: 1 };
  if (label) p.label = label;
  return p;
}

export function pvCap(delta: number, label?: string): EffectPreview {
  const p: EffectPreview = { key: 'capability', dir: dir(delta), magnitude: capMagnitude(delta) };
  if (label) p.label = label;
  return p;
}

/** Merge previews with the same key+label (summing is approximated by the larger magnitude). */
export function mergePreviews(list: EffectPreview[]): EffectPreview[] {
  const out: EffectPreview[] = [];
  for (const p of list) {
    if (p.dir === 0 && p.key !== 'risk') continue;
    const prev = out.find((o) => o.key === p.key && o.label === p.label);
    if (!prev) {
      out.push({ ...p });
      continue;
    }
    if (prev.amount !== undefined && p.amount !== undefined) {
      prev.amount = round1(prev.amount + p.amount);
      prev.dir = dir(prev.amount);
      prev.magnitude = prev.key === 'adoption' ? adoptionMagnitude(prev.amount) : magnitude(prev.amount);
      continue;
    }
    if (prev.dir === p.dir) prev.magnitude = Math.min(3, Math.max(prev.magnitude, p.magnitude) + (prev.magnitude === p.magnitude ? 1 : 0)) as 1 | 2 | 3;
    else if (p.magnitude > prev.magnitude) {
      prev.dir = p.dir;
      prev.magnitude = p.magnitude;
    }
    delete prev.amount;
  }
  return out;
}

/** Preview for a declarative Effect. `uncertain` is set for hidden/delayed/random parts. */
export function previewEffect(effect: Effect | undefined, ctx: TemplateCtx, confScale = 1): { preview: EffectPreview[]; uncertain: boolean } {
  const list: EffectPreview[] = [];
  let uncertain = false;
  if (!effect) return { preview: list, uncertain };
  if (effect.meters) {
    for (const k of Object.keys(effect.meters) as MeterId[]) {
      const v = effect.meters[k];
      if (typeof v === 'number' && v !== 0) list.push(pv(k, k === 'confidence' ? v * confScale : v));
    }
  }
  if (effect.budget) list.push(pv('budget', effect.budget));
  if (effect.income) list.push(pvUnits('income', effect.income, 2));
  if (effect.capacity) list.push(pvUnits('capacity', effect.capacity));
  if (effect.evidence) list.push(pvUnits('evidence', effect.evidence));
  if (effect.risk) list.push(pvDir('risk', effect.risk));
  if (effect.safeguards) list.push(pvDir('safeguards', effect.safeguards));
  if (effect.capability) list.push(pvCap(effect.capability, ctx.company?.name));
  if (effect.adoption) {
    const sectors = Object.keys(effect.adoption) as SectorId[];
    let total = 0;
    for (const sec of sectors) total += effect.adoption[sec] ?? 0;
    if (total !== 0) list.push(pvAdoption(total, listJoinL(sectors.map((x) => SECTOR_INFO[x]?.name ?? x))));
  }
  if (effect.displacement) list.push(pv('displacement', effect.displacement));
  if (effect.tension) list.push(pv('tension', effect.tension));
  if (effect.accord) list.push(pv('accord', effect.accord));
  if (effect.company) {
    if (effect.company.relation) list.push(pv('company', effect.company.relation, ctx.company?.name));
    if (effect.company.capability) list.push(pvCap(effect.company.capability, ctx.company?.name));
  }
  if (effect.rival) {
    if (effect.rival.trust) list.push(pv('rival', effect.rival.trust, ctx.rival?.name));
    if (effect.rival.capability) uncertain = true; // foreign capability is fogged
  }
  if (effect.allRivals) {
    if (effect.allRivals.trust) list.push(pv('rival', effect.allRivals.trust, t('All rivals')));
    if (effect.allRivals.capability || effect.allRivals.aggression) uncertain = true;
  }
  if (effect.situation || effect.custom || effect.model) uncertain = true;
  if (effect.company && (effect.company.safety || effect.company.transparency || effect.company.ambition)) uncertain = true;
  return { preview: mergePreviews(list), uncertain };
}
