/**
 * Country emblems — four fictional heraldic shields sharing one silhouette so they sit well in a row.
 * Def-free (no gradients/clip ids): field divisions are clipped analytically to the shield outline,
 * so output is deterministic and safe to repeat anywhere on a page.
 */
import type { CountryId } from '../engine/types';
import { gearPoints, n, poly, polar, starPath, svgRoot, type Pt } from './util';

// ---------------------------------------------------------------- shield geometry (viewBox 0 0 100 100)

const SHIELD = 'M50 97C26 89 10 76 10 62V16Q10 6 20 6H80Q90 6 90 16V62C90 76 74 89 50 97Z';
const SHIELD_INNER = 'M50 90.6C30.5 83.8 16.2 73.4 16.2 61.2V18.4Q16.2 12.2 22.4 12.2H77.6Q83.8 12.2 83.8 18.4V61.2C83.8 73.4 69.5 83.8 50 90.6Z';
const GLOSS = 'M10 16Q10 6 20 6H80Q90 6 90 16V36C66 44 34 30 10 42Z';

/** Half-width of the shield at height y (only valid for y ≥ 16). */
function halfWidth(y: number): number {
  if (y <= 62) return 40;
  if (y >= 97) return 0;
  // right-hand Bézier: (90,62) (90,76) (74,89) (50,97)
  const bz = (t: number, a: number, b: number, c: number, d: number) =>
    (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (bz(mid, 62, 76, 89, 97) < y) lo = mid;
    else hi = mid;
  }
  return bz(lo, 90, 90, 74, 50) - 50;
}

/** Where the curve y=f(x) leaves the shield on one side (dir=+1 right, -1 left). */
function edgeX(f: (x: number) => number, dir: 1 | -1): number {
  let inside = 50;
  let outside = 50 + dir * 41;
  for (let i = 0; i < 28; i++) {
    const mid = (inside + outside) / 2;
    if (Math.abs(mid - 50) <= halfWidth(f(mid))) inside = mid;
    else outside = mid;
  }
  return inside;
}

/** Region of the shield between two curves top(x) < bot(x), clipped to the outline. */
function band(top: (x: number) => number, bot: ((x: number) => number) | null): string {
  const pts: Pt[] = [];
  const tl = edgeX(top, -1);
  const tr = edgeX(top, 1);
  const step = 2.5;
  for (let x = tl; x < tr; x += step) pts.push([x, top(x)]);
  pts.push([tr, top(tr)]);
  const edge = (y0: number, y1: number, dir: 1 | -1) => {
    const k = Math.max(2, Math.ceil(Math.abs(y1 - y0) / 3));
    for (let i = 1; i < k; i++) {
      const y = y0 + ((y1 - y0) * i) / k;
      pts.push([50 + dir * halfWidth(y), y]);
    }
  };
  if (!bot) {
    // down the right edge to the tip, up the left edge
    edge(top(tr), 97, 1);
    pts.push([50, 97]);
    edge(97, top(tl), -1);
    return poly(pts);
  }
  const bl = edgeX(bot, -1);
  const br = edgeX(bot, 1);
  edge(top(tr), bot(br), 1);
  for (let x = br; x > bl; x -= step) pts.push([x, bot(x)]);
  pts.push([bl, bot(bl)]);
  edge(bot(bl), top(tl), -1);
  return poly(pts);
}

const wave = (y0: number, amp: number, cycles: number, phase = 0) => (x: number) =>
  y0 + amp * Math.sin(((x - 10) / 80) * Math.PI * 2 * cycles + phase);

const fill = (d: string, color: string, extra = '') => `<path d="${d}" fill="${color}"${extra ? ' ' + extra : ''}/>`;

function frame(field: string, charges: string, rim: string, pin: string): string {
  return (
    fill(SHIELD, '#000', 'opacity=".35" transform="translate(0 2.2)"') +
    fill(SHIELD, field) +
    charges +
    fill(GLOSS, '#fff', 'opacity=".07"') +
    `<path d="${SHIELD_INNER}" fill="none" stroke="${pin}" stroke-width="1.1" opacity=".55"/>` +
    `<path d="${SHIELD}" fill="none" stroke="${rim}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="${SHIELD}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width=".8" transform="translate(50 51.5) scale(1.05) translate(-50 -51.5)"/>`
  );
}

// ---------------------------------------------------------------- the four nations

function atlantic(): string {
  const navy = '#1b3264';
  const red = '#c8372d';
  const white = '#f3efe4';
  const w1 = wave(52, 2.2, 1.5);
  const w2 = wave(58.5, 2.2, 1.5);
  const w3 = wave(65, 2.2, 1.5);
  const w4 = wave(71.5, 2.2, 1.5);
  const charges =
    fill(band(w1, w2), white) +
    fill(band(w2, w3), red) +
    fill(band(w3, w4), white) +
    fill(band(w4, null), red) +
    // star with a thin halo ring
    `<circle cx="50" cy="31" r="17.5" fill="none" stroke="${white}" stroke-width="1.2" opacity=".35"/>` +
    fill(starPath(50, 31.6, 15.5, 6.3, 5), white) +
    // half-shading on the star's right facets for an engraved look
    fill(
      poly([[50, 31.6], polar(50, 31.6, 15.5, 0), polar(50, 31.6, 6.3, 36), polar(50, 31.6, 15.5, 72), polar(50, 31.6, 6.3, 108), polar(50, 31.6, 15.5, 144), polar(50, 31.6, 6.3, 180)]),
      '#9fb3d9',
      'opacity=".35"',
    ) +
    fill(starPath(22, 20, 3.2, 1.3, 5), white, 'opacity=".75"') +
    fill(starPath(78, 20, 3.2, 1.3, 5), white, 'opacity=".75"');
  return frame(navy, charges, '#e6e1d3', '#f3efe4');
}

function hanzhou(): string {
  const crimson = '#9c1a22';
  const gold = '#f0c24b';
  const cx = 50;
  const cy = 43;
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = i * 30 + 15;
    rays += poly([polar(cx, cy, 19, a - 4.5), polar(cx, cy, 29, a), polar(cx, cy, 19, a + 4.5)]);
  }
  const gear = poly(gearPoints(cx, cy, 20.5, 16.5, 12, 0.5, 0));
  const charges =
    // lower field deepens toward the tip
    fill(band(wave(66, 0, 1), null), '#7d121a') +
    fill(rays, gold, 'opacity=".8"') +
    fill(gear, gold) +
    `<circle cx="${cx}" cy="${cy}" r="12" fill="${crimson}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="12" fill="none" stroke="${gold}" stroke-width="1" opacity=".6" transform="translate(${cx} ${cy}) scale(.78) translate(${-cx} ${-cy})"/>` +
    `<circle cx="${cx}" cy="${cy}" r="5.6" fill="${gold}"/>` +
    // gold chevron + base band
    `<path d="M24 74 50 84 76 74" fill="none" stroke="${gold}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<path d="M30 68.5 50 76 70 68.5" fill="none" stroke="${gold}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" opacity=".7"/>`;
  return frame(crimson, charges, gold, gold);
}

function commonwealth(): string {
  const blue = '#183a85';
  const gold = '#f2c14e';
  const cx = 50;
  const cy = 45;
  let dots = '';
  for (let i = 0; i < 12; i++) {
    const [x, y] = polar(cx, cy, 25, i * 30);
    dots += `<circle cx="${n(x)}" cy="${n(y)}" r="2.9"/>`;
  }
  const column =
    `<g fill="${gold}">` +
    `<rect x="38.5" y="28" width="23" height="2.8" rx=".6"/>` + // abacus
    `<rect x="41" y="30.8" width="18" height="3.2"/>` + // echinus
    `<circle cx="41.6" cy="33.4" r="2.6"/><circle cx="58.4" cy="33.4" r="2.6"/>` + // volutes
    `<rect x="44.2" y="34" width="11.6" height="20.5"/>` + // shaft
    `<rect x="42" y="54.5" width="16" height="2.6" rx=".5"/>` +
    `<rect x="39.5" y="57.1" width="21" height="3.2" rx=".6"/>` +
    `</g>` +
    `<circle cx="41.6" cy="33.4" r="1" fill="${blue}"/><circle cx="58.4" cy="33.4" r="1" fill="${blue}"/>` +
    `<path d="M47.1 35.5v17.5M50 35.5v17.5M52.9 35.5v17.5" stroke="${blue}" stroke-width="1.1" opacity=".75"/>`;
  const charges =
    fill(band(wave(70, 0, 1), null), '#122d6a') +
    `<circle cx="${cx}" cy="${cy}" r="25" fill="none" stroke="${gold}" stroke-width=".6" opacity=".35"/>` +
    `<g fill="${gold}">${dots}</g>` +
    column +
    `<path d="M34 77h32" stroke="${gold}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`;
  return frame(blue, charges, gold, gold);
}

function meridian(): string {
  const teal = '#0f7f7b';
  const sea = '#0a5b60';
  const white = '#f1f7f5';
  const traces: string[] = [];
  const pads: Pt[] = [];
  // circuit-trace meridians fanning up from the island like lines of longitude
  const tr = (pts: Pt[]) => {
    traces.push(poly(pts, false));
    pads.push(pts[pts.length - 1]);
  };
  tr([[50, 50], [50, 17]]);
  tr([[43, 51], [43, 33], [36, 26], [36, 20]]);
  tr([[57, 51], [57, 33], [64, 26], [64, 20]]);
  tr([[36, 54], [36, 44], [26, 34], [26, 28]]);
  tr([[64, 54], [64, 44], [74, 34], [74, 28]]);
  const charges =
    // sun arc behind
    `<path d="M20 60.5a30 30 0 0 1 60 0Z" fill="${white}" opacity=".07"/>` +
    `<path d="M20 60.5a30 30 0 0 1 60 0M30 60.5a20 30 0 0 1 40 0" fill="none" stroke="${white}" stroke-width="1" opacity=".28"/>` +
    `<path d="M22.8 48h54.4" stroke="${white}" stroke-width="1" opacity=".18"/>` +
    `<path d="${traces.join('')}" fill="none" stroke="${white}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>` +
    pads.map(([x, y]) => `<circle cx="${n(x)}" cy="${n(y)}" r="2.3" fill="${teal}" stroke="${white}" stroke-width="1.6"/>`).join('') +
    // sea below the horizon
    fill(band(wave(60, 0, 1), null), sea) +
    // island
    fill('M27 60.5C31 55.5 37 52 43 52.5c2.5-3.5 7-5.5 11.5-4.5 6.5 1.3 12.5 6 18.5 12.5Z', white) +
    `<path d="M22 67.5c4.7-2.4 9.3-2.4 14 0s9.3 2.4 14 0 9.3-2.4 14 0 9.3 2.4 14 0" fill="none" stroke="${white}" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>` +
    `<path d="M31 75c3.8-2 7.6-2 11.4 0s7.6 2 11.4 0 7.6-2 11.4 0" fill="none" stroke="${white}" stroke-width="1.4" stroke-linecap="round" opacity=".35"/>`;
  return frame(teal, charges, '#e4f1ee', white);
}

function generic(): string {
  return frame('#1d2740', fill(starPath(50, 45, 16, 6.5, 5), '#7f8ba3'), '#7f8ba3', '#7f8ba3');
}

const EMBLEMS: Record<string, () => string> = { atlantic, hanzhou, commonwealth, meridian };
const cache = new Map<string, string>();

export function countryEmblem(id: CountryId, size = 64): string {
  let inner = cache.get(id);
  if (!inner) {
    inner = (EMBLEMS[id] ?? generic)();
    cache.set(id, inner);
  }
  return svgRoot(size, size, '0 0 100 100', inner, `aria-hidden="true" data-emblem="${id}"`);
}
