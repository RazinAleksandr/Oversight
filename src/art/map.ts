/**
 * Stylised world map (2:1): abstract dot-grid continents (not real geography), a graticule,
 * connection arcs between capitals and the player's nation emphasised.
 *
 * Styling hooks for the UI (no global CSS is injected):
 *   <g id="region-<id>" class="region [is-player]" data-country="<id>" color="…">
 *     <path class="region-dots" fill="currentColor"/>   ← recolour with `.region path { fill }` or `.region { color }`
 *     <circle class="region-capital" …/>  <text class="region-label">…</text>
 *   <g class="region-focus" data-country="<player>">   ← glow + outline around the player's region
 *   <g class="map-links">                              ← arcs (player arcs carry class "is-player-link")
 */
import type { CountryId } from '../engine/types';
import { t } from '../i18n';
import { uid } from './rng';
import { inPoly, n, smooth, svgRoot, type Pt } from './util';

const W = 1000;
const H = 500;
const PLAYER = '#3fd0ff';
const RIVAL = '#6f83ab';
const LAND = '#1d2b47';

interface RegionDef {
  id: CountryId;
  name: string;
  shapes: Pt[][];
  capital: Pt;
  label: Pt;
  anchor?: 'start' | 'middle' | 'end';
}

const REGIONS: RegionDef[] = [
  {
    id: 'atlantic',
    name: t('ATLANTIC FEDERATION'),
    shapes: [[[92, 96], [168, 68], [262, 72], [334, 108], [350, 158], [314, 196], [302, 248], [258, 292], [214, 300], [188, 268], [148, 232], [108, 200], [78, 150]]],
    capital: [262, 168],
    label: [214, 52],
  },
  {
    id: 'commonwealth',
    name: t('EUROPEAN COMMONWEALTH'),
    shapes: [[[428, 94], [488, 70], [560, 76], [596, 108], [582, 150], [542, 176], [490, 186], [448, 170], [422, 134]]],
    capital: [512, 128],
    label: [510, 54],
  },
  {
    id: 'hanzhou',
    name: t('HANZHOU REPUBLIC'),
    shapes: [[[624, 84], [702, 62], [802, 68], [884, 96], [910, 142], [874, 190], [822, 214], [758, 230], [700, 220], [650, 190], [614, 140]]],
    capital: [768, 150],
    label: [766, 46],
  },
  {
    id: 'meridian',
    name: t('MERIDIAN REPUBLIC'),
    shapes: [
      [[734, 262], [778, 258], [806, 282], [798, 320], [760, 334], [728, 308]],
      [[816, 296], [842, 290], [854, 312], [834, 330], [814, 318]],
      [[694, 318], [718, 312], [726, 336], [706, 346], [690, 334]],
    ],
    capital: [766, 296],
    label: [770, 372],
  },
];

const NEUTRAL: Pt[][] = [
  [[226, 322], [288, 310], [324, 350], [308, 412], [272, 458], [246, 442], [236, 390], [214, 352]],
  [[454, 214], [532, 204], [594, 226], [604, 282], [572, 352], [532, 412], [502, 400], [482, 342], [450, 282]],
  [[842, 362], [910, 350], [944, 386], [918, 428], [862, 432], [830, 402]],
  [[380, 52], [412, 44], [420, 62], [396, 72]],
  [[612, 236], [640, 230], [650, 252], [626, 262]],
  [[40, 300], [74, 292], [86, 316], [60, 330], [38, 320]],
  [[352, 236], [372, 230], [378, 250], [360, 256]],
];

// ---------------------------------------------------------------- dot sampling (computed once)

const SX = 11.5;
const SY = SX * 0.866;
const R = 3.2;

const r1 = (v: number) => String(Math.round(v * 10) / 10);
const dot = (x: number, y: number) => `M${r1(x - R)} ${r1(y)}a${R} ${R} 0 1 0 ${R * 2} 0a${R} ${R} 0 1 0 ${-R * 2} 0`;

function sample(shapes: Pt[][]): string {
  let d = '';
  for (let row = 0, y = 20; y < H - 10; row++, y += SY) {
    const off = row % 2 ? SX / 2 : 0;
    for (let x = 14 + off; x < W - 10; x += SX) {
      if (shapes.some((s) => inPoly(x, y, s))) d += dot(x, y);
    }
  }
  return d;
}

let cache: { regions: Record<string, string>; neutral: string } | null = null;
function dots() {
  if (!cache) {
    const regions: Record<string, string> = {};
    for (const r of REGIONS) regions[r.id] = sample(r.shapes);
    cache = { regions, neutral: sample(NEUTRAL) };
  }
  return cache;
}

/** Outline (slightly inflated) used for the player's focus glow. */
function inflate(pts: Pt[], k: number): Pt[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const L = Math.hypot(dx, dy) || 1;
    return [x + (dx / L) * k, y + (dy / L) * k];
  });
}

// ---------------------------------------------------------------- render

export function worldMap(player: CountryId, width = 640): string {
  const ids: Record<string, string> = {};
  const id = (s: string) => (ids[s] ??= uid(`map-${s}`));
  const { regions, neutral } = dots();

  const defs =
    `<defs>` +
    `<radialGradient id="${id('ocean')}" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#0c1830"/><stop offset="1" stop-color="#060b16"/></radialGradient>` +
    `<filter id="${id('glow')}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>` +
    `<filter id="${id('soft')}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>` +
    `</defs>`;

  // graticule: gently bowed meridians + parallels
  let grat = '';
  for (let i = 1; i < 16; i++) {
    const x = (i * W) / 16;
    grat += `M${n(x)} 14Q${n(500 + (x - 500) * 1.1)} 250 ${n(x)} 486`;
  }
  for (let j = 1; j < 8; j++) {
    const y = (j * H) / 8;
    grat += `M14 ${n(y)}Q500 ${n(y + (y - 250) * 0.06)} 986 ${n(y)}`;
  }
  const graticule =
    `<path d="${grat}" fill="none" stroke="${PLAYER}" stroke-width="1" opacity=".07"/>` +
    `<path d="M14 250H986" stroke="${PLAYER}" stroke-width="1" opacity=".16" stroke-dasharray="2 6"/>` +
    `<path d="M14 165H986M14 335H986" stroke="${PLAYER}" stroke-width="1" opacity=".08" stroke-dasharray="10 8"/>`;

  // links between capitals
  const cap = Object.fromEntries(REGIONS.map((r) => [r.id, r.capital])) as Record<CountryId, Pt>;
  const ids4 = REGIONS.map((r) => r.id);
  let links = '';
  for (let i = 0; i < ids4.length; i++)
    for (let j = i + 1; j < ids4.length; j++) {
      const a = cap[ids4[i]];
      const b = cap[ids4[j]];
      const mine = ids4[i] === player || ids4[j] === player;
      const mx = (a[0] + b[0]) / 2;
      const my = Math.min(a[1], b[1]) - Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.28;
      links += `<path class="map-link${mine ? ' is-player-link' : ''}" d="M${n(a[0])} ${n(a[1])}Q${n(mx)} ${n(my)} ${n(b[0])} ${n(b[1])}" fill="none" stroke="${mine ? PLAYER : RIVAL}" stroke-width="${mine ? 1.6 : 1}" stroke-dasharray="${mine ? '6 5' : '2 6'}" opacity="${mine ? 0.75 : 0.35}"/>`;
      if (mine) {
        // a "packet" two-thirds along each player link
        const t = 0.66;
        const s = ids4[i] === player ? a : b;
        const e = ids4[i] === player ? b : a;
        const px = (1 - t) ** 2 * s[0] + 2 * (1 - t) * t * mx + t * t * e[0];
        const py = (1 - t) ** 2 * s[1] + 2 * (1 - t) * t * my + t * t * e[1];
        links += `<circle cx="${n(px)}" cy="${n(py)}" r="3" fill="${PLAYER}"/>`;
      }
    }

  // player focus (outside the .region group so `.region path` rules never fill it)
  const pr = REGIONS.find((r) => r.id === player);
  let focus = '';
  if (pr) {
    const outline = pr.shapes.map((s) => smooth(inflate(s, 9))).join('');
    focus =
      `<g class="region-focus" data-country="${pr.id}" color="${PLAYER}">` +
      `<path d="${outline}" fill="currentColor" opacity=".16" filter="url(#${id('glow')})"/>` +
      `<path d="${outline}" fill="currentColor" opacity=".05"/>` +
      `<path d="${outline}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="7 5" opacity=".7"/>` +
      `</g>`;
  }

  let regionEls = '';
  for (const r of REGIONS) {
    const me = r.id === player;
    const [cx, cy] = r.capital;
    const [lx, ly] = r.label;
    const marker = me
      ? `<circle class="region-capital" cx="${cx}" cy="${cy}" r="16" fill="none" stroke="currentColor" stroke-width="1" opacity=".5"/>` +
        `<circle class="region-capital" cx="${cx}" cy="${cy}" r="9" fill="#060b16" stroke="currentColor" stroke-width="2"/>` +
        `<circle class="region-capital" cx="${cx}" cy="${cy}" r="3.5" fill="currentColor"/>` +
        `<path class="region-tick" d="M${cx} ${cy - 24}v6M${cx} ${cy + 18}v6M${cx - 24} ${cy}h6M${cx + 18} ${cy}h6" stroke="currentColor" stroke-width="1.6"/>`
      : `<circle class="region-capital" cx="${cx}" cy="${cy}" r="6" fill="#060b16" stroke="currentColor" stroke-width="1.6"/>` +
        `<circle class="region-capital" cx="${cx}" cy="${cy}" r="2.2" fill="currentColor"/>`;
    const label =
      `<text class="region-label" x="${lx}" y="${ly}" text-anchor="${r.anchor ?? 'middle'}" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="${me ? 14 : 12.5}" font-weight="600" letter-spacing="3" fill="currentColor" opacity="${me ? 1 : 0.8}" paint-order="stroke" stroke="#060b16" stroke-width="4">${r.name}</text>` +
      (me
        ? `<text class="region-label region-tag" x="${lx}" y="${ly < 100 ? ly - 15 : ly + 17}" text-anchor="${r.anchor ?? 'middle'}" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="10" font-weight="600" letter-spacing="4" fill="currentColor" opacity=".75" paint-order="stroke" stroke="#060b16" stroke-width="4">◆ ${t('YOUR NATION')}</text>`
        : '');
    regionEls +=
      `<g id="region-${r.id}" class="region${me ? ' is-player' : ''}" data-country="${r.id}" color="${me ? PLAYER : RIVAL}">` +
      `<path class="region-dots" d="${regions[r.id]}" fill="currentColor" opacity="${me ? 1 : 0.85}"/>` +
      marker +
      label +
      `</g>`;
  }

  // HUD frame: corner brackets + coordinates
  const br = (x: number, y: number, dx: number, dy: number) => `M${x} ${y + dy * 22}V${y}H${x + dx * 22}`;
  const hud =
    `<path d="${br(10, 10, 1, 1)}${br(990, 10, -1, 1)}${br(10, 490, 1, -1)}${br(990, 490, -1, -1)}" fill="none" stroke="${PLAYER}" stroke-width="2" opacity=".5"/>` +
    `<text x="40" y="482" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="11" letter-spacing="2" fill="#7f8ba3" opacity=".8">${t('GLOBAL SITUATION // LIVE')}</text>` +
    `<text x="960" y="482" text-anchor="end" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="11" letter-spacing="2" fill="#7f8ba3" opacity=".8">${t('GRID 15° · PROJ. ABSTRACT')}</text>`;

  const inner =
    defs +
    `<rect width="${W}" height="${H}" rx="18" fill="url(#${id('ocean')})"/>` +
    graticule +
    `<path class="map-land" d="${neutral}" fill="${LAND}"/>` +
    focus +
    `<g class="map-links">${links}</g>` +
    regionEls +
    hud +
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="18" fill="none" stroke="${PLAYER}" stroke-opacity=".14"/>`;
  return svgRoot(width, width / 2, `0 0 ${W} ${H}`, inner, `role="img" aria-label="${t('World map')}"`);
}
