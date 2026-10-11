/**
 * Small UI helpers: class joining, number formatting, polarity of preview keys, screen-reader announcements.
 */
import type { Confidence, Cost, PreviewKey, Tone } from '../engine/types';

export const cx = (...xs: (string | false | null | undefined | 0)[]): string => xs.filter(Boolean).join(' ');

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const MINUS = '−';

/** "+3", "−2", "±0" */
export function signed(n: number, digits = 0): string {
  const r = Number(n.toFixed(digits));
  if (r === 0) return '±0';
  return (r > 0 ? '+' : MINUS) + Math.abs(r).toFixed(digits);
}

export function money(n: number, withSign = false): string {
  const r = Math.round(n);
  const sign = r < 0 ? MINUS : withSign && r > 0 ? '+' : '';
  return `${sign}$${Math.abs(r)}B`;
}

export const one = (n: number): string => n.toFixed(1);

/** Keys whose change is formatted with one decimal. */
const DECIMAL_KEYS = new Set<PreviewKey>(['capability', 'safeguards']);

/** Format a recorded change for display: budget as money, capability with decimals, others as integers. */
export function changeText(key: PreviewKey, delta: number): string {
  if (key === 'budget' || key === 'income') return money(delta, true);
  return signed(delta, DECIMAL_KEYS.has(key) ? 1 : 0);
}

/**
 * +1: an increase is good for the player, −1: an increase is bad, 0: ambiguous.
 * Chips are coloured by (direction × polarity), so "Risk ▲" is red and "Tension ▼" is green.
 */
export const POLARITY: Record<PreviewKey, 1 | -1 | 0> = {
  confidence: 1,
  economy: 1,
  stability: 1,
  security: 1,
  budget: 1,
  income: 1,
  capacity: 1,
  evidence: 1,
  risk: -1,
  safeguards: 1,
  capability: 0,
  adoption: 1,
  displacement: -1,
  tension: -1,
  accord: 1,
  company: 1,
  rival: 1,
};

export type Valence = 'good' | 'bad' | 'neutral';

export function valence(key: PreviewKey, delta: number): Valence {
  const v = Math.sign(delta) * POLARITY[key];
  return v > 0 ? 'good' : v < 0 ? 'bad' : 'neutral';
}

export function toneClass(t: Tone | undefined): string {
  return t === 'good' ? 'good' : t === 'bad' ? 'bad' : t === 'mixed' ? 'warn' : 'neutral';
}

export const CONF_LABEL: Record<Confidence, string> = {
  verified: 'Verified',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  redacted: 'Redacted',
};

export function hasCost(c?: Cost): boolean {
  return !!c && !!(c.capacity || c.budget || c.evidence || c.confidence);
}

/** Polite announcement for screen readers via the #sr-live region. */
export function announce(text: string): void {
  const el = document.getElementById('sr-live');
  if (!el) return;
  el.textContent = '';
  window.setTimeout(() => {
    el.textContent = text;
  }, 40);
}

/** Deterministic small hash for stable pseudo-random visuals (redaction bar widths etc.). */
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Today's daily-run seed, e.g. 20261011. */
export function dailySeed(d = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** True when the event target is an interactive control that handles Space/Enter itself. */
export function isInteractiveTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return !!t.closest('button, a, input, select, textarea, [role="switch"], [role="slider"], [contenteditable="true"]');
}

/** Hue (0–360) of a #rrggbb colour — used to tint leader portrait backdrops with the country colour. */
export function hueOf(hex: string): number | undefined {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return undefined;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}
