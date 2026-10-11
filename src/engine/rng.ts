/**
 * Deterministic seeded RNG (sfc32). The generator state lives in `GameState.rng`
 * so a serialized game resumes the exact same random sequence.
 */
import type { GameState } from './types';

export type RngState = [number, number, number, number];

/** Advances the sfc32 state in place and returns a float in [0, 1). */
export function sfc32Next(st: RngState): number {
  let [a, b, c, d] = st;
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  st[0] = a >>> 0; st[1] = b >>> 0; st[2] = c >>> 0; st[3] = d >>> 0;
  return (t >>> 0) / 4294967296;
}

/** Hashes a string to a 32-bit unsigned integer (FNV-1a + avalanche). */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16; h = Math.imul(h, 2246822507);
  h ^= h >>> 13; h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Expands a numeric seed into a well-mixed sfc32 state (splitmix32), then warms it up. */
export function seedState(seed: number): RngState {
  let x = (seed >>> 0) || 0x9e3779b9;
  const next = (): number => {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  const st: RngState = [next(), next(), next(), next()];
  for (let i = 0; i < 12; i++) sfc32Next(st);
  return st;
}

/** Seed for the daily challenge, derived from an ISO date string ("2026-10-11"). */
export function dailySeedFor(date: string): number {
  return hashString(`ai-taking-over/daily/${date}`) % 1_000_000_000;
}

/** Non-deterministic seed for a fresh run (time-based, never Math.random). */
let seedSalt = 0;
export function freshSeed(): number {
  seedSalt = (seedSalt + 1) >>> 0;
  return hashString(`${Date.now()}:${seedSalt}`) % 1_000_000_000;
}

/** Thin wrapper over the state-held generator with convenience helpers. */
export class Rng {
  constructor(private readonly s: GameState) {}

  float(): number {
    return sfc32Next(this.s.rng);
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.float();
  }
  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }
  chance(p: number): boolean {
    return this.float() < p;
  }
  /** Approximately normal noise with the given std-dev (sum of 3 uniforms). */
  noise(sd = 1): number {
    return (this.float() + this.float() + this.float() - 1.5) * 2 * sd;
  }
  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[Math.floor(this.float() * items.length)];
  }
  weightedPick<T>(items: readonly T[], weight: (t: T) => number): T | undefined {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return undefined;
    let r = this.float() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r < 0) return it;
    }
    return items[items.length - 1];
  }
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}

export function rng(s: GameState): Rng {
  return new Rng(s);
}
