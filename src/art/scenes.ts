/**
 * Ending illustrations (16:9): layered city skylines over water, lit per tone.
 *   good    → dawn, golden light, a complete and calm network over the city
 *   mixed   → dusk, a flickering half-working grid
 *   bad     → red-lit skyline, smoke, broken network, glitch bars
 *   neutral → night, moon, calm blue lights
 * Deterministic per tone; <defs> ids are unique per call.
 */
import type { Tone } from '../engine/types';
import { Rng, uid } from './rng';
import { n, svgRoot, type Pt } from './util';

const W = 1600;
const H = 900;
const HORIZON = 640;

interface ToneCfg {
  seed: number;
  sky: [number, string][];
  sun?: { x: number; y: number; r: number; core: string; glow: string; glowOp: number };
  moon?: { x: number; y: number; r: number };
  stars: number;
  layers: [string, string, string]; // far, mid, near building colors
  windows: string[];
  windowDensity: number;
  water: [string, string];
  haze: string;
  hazeOp: number;
  net: { color: string; node: string; op: number; mode: 'solid' | 'flicker' | 'broken' | 'calm' };
}

const TONES: Record<Tone, ToneCfg> = {
  good: {
    seed: 11,
    sky: [[0, '#16233f'], [0.3, '#34406e'], [0.55, '#8a5d86'], [0.75, '#e08a73'], [0.9, '#ffc27a'], [1, '#ffe3a8']],
    sun: { x: 1010, y: 610, r: 64, core: '#fff4d6', glow: '#ffcf7a', glowOp: 0.75 },
    stars: 18,
    layers: ['#8a6a86', '#4a3a5c', '#211b31'],
    windows: ['#ffd88a', '#ffe9b8', '#9fe7ff'],
    windowDensity: 0.22,
    water: ['#c98a7e', '#1c1a33'],
    haze: '#ffc98a',
    hazeOp: 0.55,
    net: { color: '#d9f6ff', node: '#ffffff', op: 0.55, mode: 'solid' },
  },
  mixed: {
    seed: 23,
    sky: [[0, '#0c1230'], [0.35, '#2a2350'], [0.62, '#6b3658'], [0.82, '#c4583c'], [1, '#f19052']],
    sun: { x: 420, y: 668, r: 58, core: '#ffd2a0', glow: '#ff8a4a', glowOp: 0.6 },
    stars: 40,
    layers: ['#5a3550', '#2c2340', '#141327'],
    windows: ['#ffb547', '#3fd0ff', '#ffd27a'],
    windowDensity: 0.3,
    water: ['#5a2f45', '#0c0f22'],
    haze: '#ff8a4a',
    hazeOp: 0.45,
    net: { color: '#ffb547', node: '#ffd27a', op: 0.6, mode: 'flicker' },
  },
  bad: {
    seed: 37,
    sky: [[0, '#0d0306'], [0.35, '#2a060c'], [0.65, '#651019'], [0.88, '#b3261f'], [1, '#e2462a']],
    stars: 0,
    layers: ['#4a0f15', '#22080d', '#0b0507'],
    windows: ['#ff4d5e', '#ff7a3d', '#ffb547'],
    windowDensity: 0.12,
    water: ['#5e1216', '#070204'],
    haze: '#ff5a3a',
    hazeOp: 0.6,
    net: { color: '#ff4d5e', node: '#ff8a95', op: 0.7, mode: 'broken' },
  },
  neutral: {
    seed: 51,
    sky: [[0, '#040812'], [0.45, '#0a1530'], [0.85, '#14284c'], [1, '#1d3a63']],
    moon: { x: 1230, y: 170, r: 44 },
    stars: 140,
    layers: ['#1a2a48', '#111d36', '#0a1224'],
    windows: ['#3fd0ff', '#9fdcff', '#ffd88a'],
    windowDensity: 0.26,
    water: ['#13284a', '#03060d'],
    haze: '#3fd0ff',
    hazeOp: 0.22,
    net: { color: '#3fd0ff', node: '#bff0ff', op: 0.45, mode: 'calm' },
  },
};

// ---------------------------------------------------------------- skyline

interface Layer {
  path: string;
  tips: Pt[];
  windows: string[]; // path per window colour
  beacons: Pt[];
}

function skyline(r: Rng, opts: { minH: number; maxH: number; minW: number; maxW: number; gap: number; windows?: { colors: string[]; density: number } }): Layer {
  let d = '';
  const tips: Pt[] = [];
  const beacons: Pt[] = [];
  const win: string[] = opts.windows ? opts.windows.colors.map(() => '') : [];
  let x = -30 + r.range(0, 40);
  while (x < W + 30) {
    const w = r.range(opts.minW, opts.maxW);
    // taller towers cluster near the centre of the frame
    const centre = 1 - Math.abs(x + w / 2 - W * 0.55) / (W * 0.75);
    const h = opts.minH + (opts.maxH - opts.minH) * Math.pow(r.next(), 1.4) * (0.55 + 0.6 * centre);
    const top = HORIZON - h;
    d += `M${n(x)} ${HORIZON}V${n(top)}H${n(x + w)}V${HORIZON}Z`;
    const kind = r.int(0, 6);
    const cx = x + w / 2;
    if (kind === 0 && w > 40) {
      const h2 = r.range(18, 50);
      d += `M${n(x + w * 0.18)} ${n(top)}V${n(top - h2)}H${n(x + w * 0.82)}V${n(top)}Z`;
      const h3 = r.range(10, 30);
      d += `M${n(x + w * 0.34)} ${n(top - h2)}V${n(top - h2 - h3)}H${n(x + w * 0.66)}V${n(top - h2)}Z`;
      tips.push([cx, top - h2 - h3]);
    } else if (kind === 1) {
      const sp = r.range(30, 90);
      d += `M${n(cx - w * 0.14)} ${n(top)}L${n(cx)} ${n(top - sp)}L${n(cx + w * 0.14)} ${n(top)}Z`;
      tips.push([cx, top - sp]);
    } else if (kind === 2) {
      const ah = r.range(28, 70);
      d += `M${n(cx - 1.4)} ${n(top)}V${n(top - ah)}H${n(cx + 1.4)}V${n(top)}Z`;
      tips.push([cx, top - ah]);
      beacons.push([cx, top - ah]);
    } else if (kind === 3) {
      const s = r.range(16, 44) * (r.chance(0.5) ? 1 : -1);
      d += s > 0 ? `M${n(x)} ${n(top)}L${n(x + w)} ${n(top - s)}V${n(top)}Z` : `M${n(x)} ${n(top + s)}L${n(x + w)} ${n(top)}H${n(x)}Z`;
      tips.push([s > 0 ? x + w : x, top - Math.abs(s)]);
    } else if (kind === 4 && w > 36) {
      const rr = w * 0.32;
      d += `M${n(cx - rr)} ${n(top)}A${n(rr)} ${n(rr * 0.8)} 0 0 1 ${n(cx + rr)} ${n(top)}Z`;
      tips.push([cx, top - rr * 0.8]);
    } else {
      tips.push([cx, top]);
    }
    // windows
    if (opts.windows && w > 22 && h > 40) {
      const cols = Math.floor((w - 8) / 9);
      const rows = Math.floor((h - 14) / 13);
      const ox = x + (w - cols * 9) / 2 + 2.5;
      const density = opts.windows.density * r.range(0.4, 1.6);
      const ci = r.int(0, opts.windows.colors.length - 1);
      for (let row = 0; row < rows; row++) {
        const floorLit = r.chance(0.12);
        for (let col = 0; col < cols; col++) {
          if (!(floorLit ? r.chance(0.8) : r.chance(density))) continue;
          const c = r.chance(0.85) ? ci : r.int(0, opts.windows.colors.length - 1);
          win[c] += `M${n(ox + col * 9)} ${n(top + 10 + row * 13)}h4v6h-4z`;
        }
      }
    }
    x += w + r.range(0, opts.gap);
  }
  return { path: d, tips, windows: win, beacons };
}

// ---------------------------------------------------------------- network overlay

function network(r: Rng, cfg: ToneCfg, tips: Pt[], gl: (s: string) => string): string {
  // pick the highest rooftops plus a few floating relay nodes in the sky
  const nodes: Pt[] = [...tips].sort((a, b) => a[1] - b[1]).slice(0, 16);
  for (let i = 0; i < 5; i++) nodes.push([120 + (i + r.range(0.1, 0.9)) * ((W - 240) / 5), r.range(220, 340)]);
  nodes.sort((a, b) => a[0] - b[0]);
  const edges: [Pt, Pt][] = [];
  for (let i = 0; i < nodes.length; i++) {
    const dists = nodes.map((q, j) => [j, Math.hypot(q[0] - nodes[i][0], q[1] - nodes[i][1])] as [number, number]).filter(([j]) => j > i);
    dists.sort((a, b) => a[1] - b[1]);
    for (const [j, dd] of dists.slice(0, 2)) if (dd < 420) edges.push([nodes[i], nodes[j]]);
  }
  const { color, node, op, mode } = cfg.net;
  let lines = '';
  let dim = '';
  let pulses = '';
  for (const [a, b] of edges) {
    const mx = (a[0] + b[0]) / 2;
    const my = Math.min(a[1], b[1]) - Math.min(60, Math.abs(a[0] - b[0]) * 0.1);
    if (mode === 'broken') {
      // snapped lines: each edge only partially survives, sagging toward the ground
      const t = r.range(0.25, 0.6);
      const ex = a[0] + (mx - a[0]) * t * 2;
      const ey = a[1] + (my + 60 - a[1]) * t * 2;
      lines += `M${n(a[0])} ${n(a[1])}Q${n(a[0] + (ex - a[0]) * 0.5)} ${n(Math.min(a[1], ey) - 10)} ${n(ex)} ${n(ey)}`;
      if (r.chance(0.5)) dim += `M${n(b[0])} ${n(b[1])}L${n(b[0] + r.range(-40, 40))} ${n(b[1] + r.range(30, 90))}`;
      continue;
    }
    const seg = `M${n(a[0])} ${n(a[1])}Q${n(mx)} ${n(my)} ${n(b[0])} ${n(b[1])}`;
    if (mode === 'flicker' && r.chance(0.45)) dim += seg;
    else lines += seg;
    if ((mode === 'solid' || mode === 'calm') && r.chance(0.35)) {
      const t = r.range(0.2, 0.8);
      const px = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mx + t * t * b[0];
      const py = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * my + t * t * b[1];
      pulses += `<circle cx="${n(px)}" cy="${n(py)}" r="3" fill="${node}" opacity=".9"/>`;
    }
  }
  const dash = mode === 'flicker' ? ' stroke-dasharray="14 6 3 9"' : '';
  let out =
    `<g filter="url(#${gl('glow')})">` +
    `<path d="${lines}" fill="none" stroke="${color}" stroke-width="${mode === 'calm' ? 1.4 : 1.8}" opacity="${op}"${dash}/>` +
    (dim ? `<path d="${dim}" fill="none" stroke="${color}" stroke-width="1.2" opacity="${op * 0.35}" stroke-dasharray="${mode === 'broken' ? '4 10' : '2 12'}"/>` : '') +
    pulses +
    `</g>`;
  for (const [x, y] of nodes) {
    const dead = mode === 'broken' && r.chance(0.5);
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="${dead ? 2.5 : 4}" fill="${dead ? '#3a0a0f' : node}" stroke="${color}" stroke-width="1.2" opacity="${dead ? 0.8 : 0.95}"/>`;
    if (!dead && r.chance(0.4)) out += `<circle cx="${n(x)}" cy="${n(y)}" r="11" fill="none" stroke="${color}" stroke-width="1" opacity="${op * 0.6}"/>`;
  }
  return out;
}

// ---------------------------------------------------------------- scene

export function endingArt(tone: Tone, width = 960): string {
  const cfg = TONES[tone] ?? TONES.neutral;
  const ids: Record<string, string> = {};
  const id = (s: string) => (ids[s] ??= uid(`end-${s}`));
  const r = new Rng(cfg.seed);

  const far = skyline(r, { minH: 60, maxH: 230, minW: 40, maxW: 110, gap: 6 });
  const mid = skyline(r, { minH: 50, maxH: 300, minW: 34, maxW: 90, gap: 14, windows: { colors: cfg.windows, density: cfg.windowDensity * 0.6 } });
  const near = skyline(r, { minH: 30, maxH: 220, minW: 46, maxW: 120, gap: 40, windows: { colors: cfg.windows, density: cfg.windowDensity } });

  const defs =
    `<defs>` +
    `<linearGradient id="${id('sky')}" x1="0" y1="0" x2="0" y2="1">${cfg.sky.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>` +
    `<linearGradient id="${id('water')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cfg.water[0]}"/><stop offset="1" stop-color="${cfg.water[1]}"/></linearGradient>` +
    `<linearGradient id="${id('fade')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="${id('reflMask')}"><rect x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#${id('fade')})"/></mask>` +
    `<radialGradient id="${id('haze')}" cx=".5" cy="1" r=".7"><stop offset="0" stop-color="${cfg.haze}" stop-opacity="${cfg.hazeOp}"/><stop offset="1" stop-color="${cfg.haze}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id('vignette')}" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient>` +
    (cfg.sun
      ? `<radialGradient id="${id('sun')}"><stop offset="0" stop-color="${cfg.sun.core}"/><stop offset=".18" stop-color="${cfg.sun.core}"/><stop offset=".3" stop-color="${cfg.sun.glow}" stop-opacity="${cfg.sun.glowOp}"/><stop offset="1" stop-color="${cfg.sun.glow}" stop-opacity="0"/></radialGradient>`
      : '') +
    `<radialGradient id="${id('moon')}"><stop offset=".25" stop-color="#cfe6ff" stop-opacity=".35"/><stop offset="1" stop-color="#cfe6ff" stop-opacity="0"/></radialGradient>` +
    `<filter id="${id('glow')}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<filter id="${id('blur')}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>` +
    `<pattern id="${id('scan')}" width="6" height="4" patternUnits="userSpaceOnUse"><rect width="6" height="1.4" fill="#000" opacity=".35"/></pattern>` +
    `</defs>`;

  let sky = `<rect width="${W}" height="${HORIZON + 4}" fill="url(#${id('sky')})"/>`;
  // stars
  if (cfg.stars) {
    let st = '';
    for (let i = 0; i < cfg.stars; i++) {
      const x = r.range(0, W);
      const y = Math.pow(r.next(), 1.6) * (HORIZON - 160);
      st += `M${n(x)} ${n(y)}h.01`;
    }
    sky += `<path d="${st}" stroke="#e6f0ff" stroke-width="2.4" stroke-linecap="round" opacity="${tone === 'good' ? 0.35 : 0.75}"/>`;
    let bright = '';
    for (let i = 0; i < Math.ceil(cfg.stars / 12); i++) bright += `M${n(r.range(0, W))} ${n(r.range(20, 360))}h.01`;
    sky += `<path d="${bright}" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="${tone === 'good' ? 0.4 : 0.9}"/>`;
  }
  if (cfg.moon) {
    const { x, y, r: mr } = cfg.moon;
    sky += `<circle cx="${x}" cy="${y}" r="${mr * 4}" fill="url(#${id('moon')})"/>`;
    sky += `<path d="M${x} ${y - mr}A${mr} ${mr} 0 1 0 ${x} ${y + mr}A${mr * 0.78} ${mr} 0 1 1 ${x} ${y - mr}Z" fill="#e8f2ff" transform="rotate(-25 ${x} ${y})"/>`;
  }
  if (cfg.sun) {
    const { x, y, r: sr } = cfg.sun;
    sky += `<circle cx="${x}" cy="${y}" r="${sr * 6}" fill="url(#${id('sun')})"/>`;
    if (tone === 'good') {
      let rays = '';
      for (let i = 0; i < 14; i++) {
        const a = Math.PI + (i / 13) * Math.PI + r.range(-0.04, 0.04);
        const a2 = a + 0.035;
        const L = 1200;
        rays += `M${x} ${y}L${n(x + Math.cos(a) * L)} ${n(y + Math.sin(a) * L)}L${n(x + Math.cos(a2) * L)} ${n(y + Math.sin(a2) * L)}Z`;
      }
      sky += `<path d="${rays}" fill="#fff3d0" opacity=".07"/>`;
    }
    sky += `<circle cx="${x}" cy="${y}" r="${sr}" fill="${cfg.sun.core}"/>`;
  }
  // light clouds / smoke
  let clouds = '';
  if (tone === 'mixed' || tone === 'good') {
    for (let i = 0; i < 6; i++) {
      const cy = r.range(240, 470);
      const cx = r.range(0, W);
      clouds += `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(r.range(180, 360))}" ry="${n(r.range(10, 22))}" fill="${tone === 'good' ? '#ffd9b0' : '#ff9a6a'}" opacity="${tone === 'good' ? 0.18 : 0.16}"/>`;
    }
  }
  if (tone === 'bad') {
    for (let i = 0; i < 7; i++) {
      const bx = r.range(100, W - 100);
      let plume = '';
      for (let k = 0; k < 6; k++) plume += `<circle cx="${n(bx + k * r.range(10, 26))}" cy="${n(HORIZON - 160 - k * 70)}" r="${n(40 + k * 22)}"/>`;
      clouds += `<g fill="#120306" opacity=".55" filter="url(#${id('blur')})">${plume}</g>`;
    }
  }

  const haze = `<rect y="${HORIZON - 420}" width="${W}" height="440" fill="url(#${id('haze')})"/>`;
  const layerEls =
    `<path d="${far.path}" fill="${cfg.layers[0]}" opacity=".9"/>` +
    haze +
    `<path d="${mid.path}" fill="${cfg.layers[1]}"/>` +
    mid.windows.map((d, i) => (d ? `<path d="${d}" fill="${cfg.windows[i]}" opacity=".55"/>` : '')).join('') +
    `<path d="${near.path}" fill="${cfg.layers[2]}"/>` +
    near.windows.map((d, i) => (d ? `<path d="${d}" fill="${cfg.windows[i]}" opacity=".9"/>` : '')).join('') +
    // aircraft-warning beacons on antennas
    [...mid.beacons, ...near.beacons].map(([x, y]) => `<circle cx="${n(x)}" cy="${n(y)}" r="3" fill="${tone === 'neutral' ? '#ff4d5e' : '#ffd27a'}" opacity=".9"/>`).join('');

  // water + reflection of the whole skyline
  const water =
    `<rect y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#${id('water')})"/>` +
    `<g mask="url(#${id('reflMask')})" opacity=".6"><g transform="translate(0 ${HORIZON * 2}) scale(1 -1)">` +
    `<path d="${mid.path}" fill="${cfg.layers[1]}"/><path d="${near.path}" fill="${cfg.layers[2]}"/>` +
    near.windows.map((d, i) => (d ? `<path d="${d}" fill="${cfg.windows[i]}" opacity=".6"/>` : '')).join('') +
    `</g></g>`;
  let shimmer = '';
  for (let i = 0; i < 70; i++) {
    const y = HORIZON + 8 + Math.pow(r.next(), 1.5) * (H - HORIZON - 10);
    const x = r.range(0, W);
    shimmer += `M${n(x)} ${n(y)}h${n(r.range(20, 120) * (1 + (y - HORIZON) / 200))}`;
  }
  let glints = '';
  if (cfg.sun) {
    for (let i = 0; i < 22; i++) {
      const y = HORIZON + 6 + i * 11 + r.range(0, 6);
      const w = (cfg.sun.r * 1.6 + i * 6) * r.range(0.5, 1.1);
      glints += `M${n(cfg.sun.x - w / 2 + r.range(-20, 20))} ${n(y)}h${n(w)}`;
    }
  } else if (cfg.moon) {
    for (let i = 0; i < 16; i++) {
      const y = HORIZON + 10 + i * 15;
      const w = (30 + i * 5) * r.range(0.5, 1.1);
      glints += `M${n(cfg.moon.x - w / 2 + r.range(-15, 15))} ${n(y)}h${n(w)}`;
    }
  }
  const waterFx =
    `<path d="${shimmer}" stroke="${cfg.windows[0]}" stroke-width="1.5" opacity=".14"/>` +
    (glints ? `<path d="${glints}" stroke="${cfg.sun ? cfg.sun.core : '#cfe6ff'}" stroke-width="3" stroke-linecap="round" opacity="${cfg.sun ? 0.55 : 0.3}"/>` : '') +
    `<rect y="${HORIZON - 1}" width="${W}" height="2" fill="${cfg.haze}" opacity=".35"/>`;

  // mixed: a perspective data-grid on the water, half of it failing
  let grid = '';
  if (tone === 'mixed') {
    let on = '';
    let off = '';
    const vx = 800;
    for (let i = -14; i <= 14; i++) {
      const seg = `M${vx + i * 18} ${HORIZON + 4}L${vx + i * 150} ${H}`;
      if (r.chance(0.6)) on += seg;
      else off += seg;
    }
    for (let k = 1; k < 12; k++) {
      const y = HORIZON + 4 + Math.pow(k / 11, 2) * (H - HORIZON);
      const seg = `M0 ${n(y)}H${W}`;
      if (r.chance(0.55)) on += seg;
      else off += seg;
    }
    grid =
      `<path d="${on}" stroke="#3fd0ff" stroke-width="1.4" opacity=".35" filter="url(#${id('glow')})"/>` +
      `<path d="${off}" stroke="#3fd0ff" stroke-width="1" opacity=".12" stroke-dasharray="6 18"/>`;
  }

  const net = network(r, cfg, [...near.tips, ...mid.tips], id);

  // particles (good) / ash (bad)
  let particles = '';
  if (tone === 'good' || tone === 'bad') {
    let pd = '';
    for (let i = 0; i < 60; i++) pd += `M${n(r.range(0, W))} ${n(r.range(80, HORIZON + 200))}h.01`;
    particles = `<path d="${pd}" stroke="${tone === 'good' ? '#fff1c9' : '#ff8a5a'}" stroke-width="${tone === 'good' ? 3 : 2.4}" stroke-linecap="round" opacity="${tone === 'good' ? 0.5 : 0.6}"/>`;
  }
  // birds at dawn
  if (tone === 'good') {
    let b = '';
    for (let i = 0; i < 7; i++) {
      const x = 560 + r.range(0, 360);
      const y = 260 + r.range(0, 120);
      const s = r.range(6, 11);
      b += `M${n(x - s)} ${n(y - s * 0.4)}Q${n(x - s * 0.4)} ${n(y - s * 0.6)} ${n(x)} ${n(y)}Q${n(x + s * 0.4)} ${n(y - s * 0.6)} ${n(x + s)} ${n(y - s * 0.4)}`;
    }
    particles += `<path d="${b}" fill="none" stroke="#2a2340" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>`;
  }

  // bad: glitch bars + scanlines
  let glitch = '';
  if (tone === 'bad') {
    for (let i = 0; i < 12; i++) {
      const y = r.range(40, H - 40);
      const h = r.range(3, 22);
      const x = r.range(-100, W - 200);
      const w = r.range(160, 900);
      glitch += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${r.pick(['#ff4d5e', '#3fd0ff', '#ffffff', '#ff4d5e'])}" opacity="${n(r.range(0.08, 0.32))}"/>`;
    }
    // displaced slice of the skyline
    const sy = r.range(470, 560);
    glitch += `<svg x="0" y="${n(sy)}" width="${W}" height="26" viewBox="0 ${n(sy)} ${W} 26" overflow="hidden"><g transform="translate(46 0)" opacity=".85"><path d="${near.path}" fill="#ff4d5e" opacity=".5"/>${near.windows.map((d) => (d ? `<path d="${d}" fill="#3fd0ff"/>` : '')).join('')}</g></svg>`;
    glitch += `<rect width="${W}" height="${H}" fill="url(#${id('scan')})"/>`;
  }

  const inner =
    defs + sky + clouds + layerEls + water + waterFx + grid + net + particles + glitch +
    `<rect width="${W}" height="${H}" fill="url(#${id('vignette')})"/>`;
  return svgRoot(width, (width * H) / W, `0 0 ${W} ${H}`, inner, `role="img" aria-label="${tone} ending" preserveAspectRatio="xMidYMid slice"`);
}
