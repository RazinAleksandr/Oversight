/**
 * Deterministic randomness for procedural art (no Math.random anywhere in src/art).
 * Same seed → same picture.
 */

/** FNV-1a 32-bit hash; used to turn strings / mixed inputs into seeds. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mixes an integer seed so that neighbouring seeds (1, 2, 3...) diverge immediately. */
export function mixSeed(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = mixSeed(seed) || 1;
  }
  /** mulberry32 step → [0, 1) */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  /** Picks by weight: [[value, weight], ...] */
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [v, w] of items) {
      r -= w;
      if (r <= 0) return v;
    }
    return items[items.length - 1][0];
  }
}

let idCounter = 0;
/**
 * Unique id for <defs> (gradients, filters, clip paths) so several SVGs on one page never clash.
 * Only the large one-off illustrations use defs; icons/emblems/logos/portraits are def-free and
 * therefore byte-for-byte deterministic.
 */
export function uid(prefix: string): string {
  idCounter = (idCounter + 1) % 0x7fffffff;
  return `ato-${prefix}-${idCounter.toString(36)}`;
}
