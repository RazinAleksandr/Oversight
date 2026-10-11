/**
 * Procedural company logos: deterministic (seeded) brand marks on a dark rounded tile.
 * Each archetype has its own geometric vocabulary:
 *   frontier   → sparks, orbits, apertures, arcs (reaching outward)
 *   bigtech    → bold tiles, pixel monograms, cubes (platform solidity)
 *   defense    → chevrons, angular shields, deltas, wings (hard edges, miter joins)
 *   opensource → open rings, branches, meshes (open and connected)
 */
import type { Archetype } from '../engine/types';
import { Rng, hashString } from './rng';
import { darken, lighten, luminance, mix, n, polar, poly, svgRoot, type Pt } from './util';

const BG = '#0b1221';

interface Pal {
  c: string; // brand
  c2: string; // light accent
  c3: string; // deep tone
  dim: string; // brand blended into the tile
}

function palette(color: string): Pal {
  const lum = luminance(color);
  return {
    c: color,
    c2: lighten(color, lum > 0.5 ? 0.45 : 0.38),
    c3: darken(color, 0.38),
    dim: mix(color, BG, 0.45),
  };
}

const P = (pts: Pt[], f: string, extra = '') => `<path d="${poly(pts)}" fill="${f}"${extra ? ' ' + extra : ''}/>`;
const strokeAttrs = (c: string, w: number, join = 'round', cap = 'round') =>
  `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="${cap}" stroke-linejoin="${join}"`;

// ---------------------------------------------------------------- frontier

function fSpark(r: Rng, p: Pal): string {
  const count = r.pick([4, 6, 8]);
  const rot = r.range(0, 360 / count);
  const long = r.range(18, 20.5);
  const short = long * r.range(0.5, 0.68);
  const spread = (180 / count) * r.range(0.62, 0.8);
  const sr = r.range(5, 6.5);
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = rot + (i * 360) / count;
    const len = i % 2 ? short : long;
    out += P([polar(32, 32, sr, a - spread), polar(32, 32, len, a), polar(32, 32, sr, a + spread), [32, 32]], i % 2 ? p.c2 : p.c);
  }
  const orot = r.range(-40, 40);
  const ry = r.range(5.5, 8.5);
  const th = r.range(0, Math.PI * 2);
  const ex = 24 * Math.cos(th);
  const ey = ry * Math.sin(th);
  const or = (orot * Math.PI) / 180;
  const dx = 32 + ex * Math.cos(or) - ey * Math.sin(or);
  const dy = 32 + ex * Math.sin(or) + ey * Math.cos(or);
  return (
    `<ellipse cx="32" cy="32" rx="24" ry="${n(ry)}" transform="rotate(${n(orot)} 32 32)" ${strokeAttrs(p.c2, 1.5)} opacity=".75"/>` +
    out +
    `<circle cx="${n(dx)}" cy="${n(dy)}" r="2.6" fill="${p.c2}" stroke="${BG}" stroke-width="1.4"/>`
  );
}

function fOrbits(r: Rng, p: Pal): string {
  const k = r.pick([2, 3, 3]);
  const base = r.range(0, 180);
  const ry = r.range(6, 8.5);
  let out = '';
  for (let i = 0; i < k; i++) {
    out += `<ellipse cx="32" cy="32" rx="21" ry="${n(ry)}" transform="rotate(${n(base + (i * 180) / k)} 32 32)" ${strokeAttrs(i === 0 ? p.c : p.c, 2.6)} opacity="${i === 0 ? 1 : 0.8}"/>`;
  }
  const th = r.range(0, Math.PI * 2);
  const a = (base * Math.PI) / 180;
  const ex = 21 * Math.cos(th);
  const ey = ry * Math.sin(th);
  return (
    out +
    `<circle cx="32" cy="32" r="${n(r.range(4.2, 5.6))}" fill="${p.c2}"/>` +
    `<circle cx="${n(32 + ex * Math.cos(a) - ey * Math.sin(a))}" cy="${n(32 + ex * Math.sin(a) + ey * Math.cos(a))}" r="3" fill="${p.c2}" stroke="${BG}" stroke-width="1.6"/>`
  );
}

function fAperture(r: Rng, p: Pal): string {
  const N = r.pick([5, 6, 7, 8]);
  const R = 20;
  const rIn = r.range(4.5, 8);
  const twist = r.range(38, 62) * (r.chance(0.5) ? 1 : -1);
  const rot = r.range(0, 360);
  const step = 360 / N;
  let out = '';
  for (let i = 0; i < N; i++) {
    const a = rot + i * step;
    out += P(
      [polar(32, 32, rIn, a), polar(32, 32, rIn, a + step), polar(32, 32, R, a + step + twist), polar(32, 32, R, a + twist)],
      i % 2 ? p.c : mix(p.c, p.c2, 0.45),
      `stroke="${BG}" stroke-width="1.5" stroke-linejoin="round"`,
    );
  }
  return out + `<circle cx="32" cy="32" r="${n(R + 2.5)}" ${strokeAttrs(p.c, 1)} opacity=".4"/>`;
}

function fArcs(r: Rng, p: Pal): string {
  const rot = r.range(0, 360);
  const radii = [7.5, 13, 18.5];
  let out = '';
  radii.forEach((rad, i) => {
    const span = r.range(200, 290);
    const a0 = rot + i * r.range(70, 130);
    const [x0, y0] = polar(32, 32, rad, a0);
    const [x1, y1] = polar(32, 32, rad, a0 + span);
    out += `<path d="M${n(x0)} ${n(y0)}A${rad} ${rad} 0 1 1 ${n(x1)} ${n(y1)}" ${strokeAttrs(i === 2 ? p.c2 : p.c, 3.4)}/>`;
  });
  return out + `<circle cx="32" cy="32" r="2.8" fill="${p.c2}"/>`;
}

function fSparkle(r: Rng, p: Pal): string {
  const s = r.range(17, 19.5);
  const pinch = r.range(2.2, 4);
  const sp = (cx: number, cy: number, R: number, k: number) =>
    `M${n(cx)} ${n(cy - R)}Q${n(cx + k)} ${n(cy - k)} ${n(cx + R)} ${n(cy)}Q${n(cx + k)} ${n(cy + k)} ${n(cx)} ${n(cy + R)}Q${n(cx - k)} ${n(cy + k)} ${n(cx - R)} ${n(cy)}Q${n(cx - k)} ${n(cy - k)} ${n(cx)} ${n(cy - R)}Z`;
  const side = r.chance(0.5) ? 1 : -1;
  const arcA = r.range(20, 70);
  return (
    `<path d="${sp(30, 33, s, pinch)}" fill="${p.c}"/>` +
    `<path d="${sp(30 + side * 15, 15.5, 6, 1)}" fill="${p.c2}"/>` +
    `<path d="M${n(polar(30, 33, 23, 90 + arcA)[0])} ${n(polar(30, 33, 23, 90 + arcA)[1])}A23 23 0 0 1 ${n(polar(30, 33, 23, 210 + arcA)[0])} ${n(polar(30, 33, 23, 210 + arcA)[1])}" ${strokeAttrs(p.c2, 1.6)} opacity=".6"/>`
  );
}

// ---------------------------------------------------------------- bigtech

function cellShape(kind: number, x: number, y: number, s: number, rot: number, color: string): string {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const tf = rot ? ` transform="rotate(${rot} ${n(cx)} ${n(cy)})"` : '';
  switch (kind) {
    case 0:
      return `<rect x="${n(x)}" y="${n(y)}" width="${n(s)}" height="${n(s)}" rx="${n(s * 0.24)}" fill="${color}"/>`;
    case 1:
      return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(s / 2)}" fill="${color}"/>`;
    case 2: // quarter disc
      return `<path d="M${n(x)} ${n(y + s)}V${n(y)}A${n(s)} ${n(s)} 0 0 1 ${n(x + s)} ${n(y + s)}Z" fill="${color}"${tf}/>`;
    default: // leaf
      return `<path d="M${n(x)} ${n(y + s)}A${n(s)} ${n(s)} 0 0 1 ${n(x + s)} ${n(y)}A${n(s)} ${n(s)} 0 0 1 ${n(x)} ${n(y + s)}Z" fill="${color}"${tf}/>`;
  }
}

function bTiles(r: Rng, p: Pal): string {
  const s = 15;
  const g = 3;
  const x0 = 32 - s - g / 2;
  const colors = [p.c, p.c, p.c2, p.dim];
  let out = '';
  for (let i = 0; i < 4; i++) {
    const x = x0 + (i % 2) * (s + g);
    const y = x0 + Math.floor(i / 2) * (s + g);
    const kind = i === 0 ? 0 : r.int(0, 3);
    out += cellShape(kind, x, y, s, r.int(0, 3) * 90, i === 0 ? p.c : r.pick(colors));
  }
  return out;
}

function bPixel(r: Rng, p: Pal): string {
  const g = r.pick([3, 4, 5]);
  const gap = 2;
  const cell = (34 - gap * (g - 1)) / g;
  const half = Math.ceil(g / 2);
  const on: boolean[][] = [];
  let count = 0;
  for (let y = 0; y < g; y++) {
    on[y] = [];
    for (let x = 0; x < half; x++) {
      const v = r.chance(0.62);
      on[y][x] = v;
      on[y][g - 1 - x] = v;
      if (v) count++;
    }
  }
  if (count < 3) on[0][0] = on[0][g - 1] = on[g - 1][half - 1] = on[g - 1][g - half] = on[1][half - 1] = on[1][g - half] = true;
  const ax = r.int(0, g - 1);
  const ay = r.int(0, g - 1);
  let out = '';
  const x0 = 32 - 17;
  for (let y = 0; y < g; y++)
    for (let x = 0; x < g; x++) {
      const accent = x === ax && y === ay;
      if (!on[y][x] && !accent) {
        out += `<rect x="${n(x0 + x * (cell + gap))}" y="${n(x0 + y * (cell + gap))}" width="${n(cell)}" height="${n(cell)}" rx="${n(cell * 0.28)}" fill="${p.c}" opacity=".12"/>`;
        continue;
      }
      out += `<rect x="${n(x0 + x * (cell + gap))}" y="${n(x0 + y * (cell + gap))}" width="${n(cell)}" height="${n(cell)}" rx="${n(cell * 0.28)}" fill="${accent ? p.c2 : p.c}"/>`;
    }
  return out;
}

function bBauhaus(r: Rng, p: Pal): string {
  const s = 16.5;
  const x0 = 32 - s;
  const pattern = r.pick([
    [0, 1, 3, 2],
    [2, 3, 1, 0],
    [0, 0, 2, 2],
    [1, 3, 1, 3],
    [3, 2, 0, 1],
  ]);
  const kinds = r.chance(0.3) ? [2, 3, 3, 2] : [2, 2, 2, 2];
  let out = '';
  for (let i = 0; i < 4; i++) {
    const x = x0 + (i % 2) * s;
    const y = x0 + Math.floor(i / 2) * s;
    out += cellShape(kinds[i], x + 0.6, y + 0.6, s - 1.2, pattern[i] * 90, i % 3 === 0 ? p.c : p.c2);
  }
  return out;
}

function bCube(r: Rng, p: Pal): string {
  const cx = 32;
  const cy = 33;
  const s = r.range(17, 19);
  const h = s * 0.866;
  const top: Pt[] = [[cx, cy - s], [cx + h, cy - s / 2], [cx, cy], [cx - h, cy - s / 2]];
  const left: Pt[] = [[cx - h, cy - s / 2], [cx, cy], [cx, cy + s], [cx - h, cy + s / 2]];
  const right: Pt[] = [[cx + h, cy - s / 2], [cx, cy], [cx, cy + s], [cx + h, cy + s / 2]];
  const sep = `stroke="${BG}" stroke-width="1.6" stroke-linejoin="round"`;
  let out = P(top, p.c2, sep) + P(left, p.c, sep) + P(right, p.c3, sep);
  if (r.chance(0.6)) {
    // carved inner cube
    const k = 0.45;
    const it: Pt[] = top.map(([x, y]) => [cx + (x - cx) * k, cy - s / 2 + (y - (cy - s / 2)) * k]);
    out += P(it, BG, 'opacity=".55"');
  }
  return out;
}

function bRing(r: Rng, p: Pal): string {
  const rot = r.pick([0, 45, 90, 135, 180, 225, 270, 315]);
  const gap = r.range(50, 80);
  const [x0, y0] = polar(32, 32, 14, rot + gap / 2);
  const [x1, y1] = polar(32, 32, 14, rot - gap / 2 + 360);
  const [bx, by] = polar(32, 32, 14, rot);
  return (
    `<path d="M${n(x0)} ${n(y0)}A14 14 0 1 1 ${n(x1)} ${n(y1)}" fill="none" stroke="${p.c}" stroke-width="7.5"/>` +
    `<path d="M32 32L${n(bx)} ${n(by)}" stroke="${p.c2}" stroke-width="7.5"/>` +
    `<circle cx="32" cy="32" r="3.75" fill="${p.c2}"/>`
  );
}

// ---------------------------------------------------------------- defense

function dShield(r: Rng, p: Pal): string {
  const shield: Pt[] = [[15, 11], [49, 11], [49, 33], [32, 53], [15, 33]];
  const k = r.pick([2, 3]);
  let chev = '';
  for (let i = 0; i < k; i++) {
    const y = 22 + i * 8 - (k - 2) * 4;
    chev += `<path d="M22 ${y}L32 ${y + 7}L42 ${y}" ${strokeAttrs(i === 0 ? p.c2 : p.c, 3.4, 'miter', 'butt')}/>`;
  }
  const filled = r.chance(0.5);
  return (
    (filled ? P(shield, p.c, `opacity=".16"`) : '') +
    `<path d="${poly(shield)}" ${strokeAttrs(p.c, 2.8, 'miter')}/>` +
    chev +
    (r.chance(0.5) ? `<path d="M15 16.5h34" stroke="${p.c}" stroke-width="1.4" opacity=".7"/>` : '')
  );
}

function dDelta(r: Rng, p: Pal): string {
  const notch = r.range(36, 44);
  const outer: Pt[] = [[32, 10], [53, 51], [32, notch], [11, 51]];
  const inner: Pt[] = [[32, 23], [43, 45], [32, notch - 2], [21, 45]];
  return P(outer, p.c) + P(inner, r.chance(0.5) ? p.c3 : BG) + `<path d="M32 10V${n(notch)}" stroke="${p.c2}" stroke-width="1.6" opacity=".9"/>`;
}

function dWings(r: Rng, p: Pal): string {
  let out = '';
  const bars = r.pick([2, 3]);
  for (let j = 0; j < bars; j++) {
    const yo = j * 6.5;
    const len = 17 - j * 3.5;
    const left: Pt[] = [[28.5, 25 + yo], [28.5 - len, 19 + yo + j * 1.5], [28.5 - len + 2.5, 23.5 + yo + j * 1.5], [28.5, 29.5 + yo]];
    const right = left.map(([x, y]) => [64 - x, y] as Pt);
    const col = j === 0 ? p.c : j === 1 ? mix(p.c, p.c2, 0.4) : p.c2;
    out += P(left, col) + P(right, col);
  }
  const d: Pt[] = [[32, 18], [35.5, 29], [32, 46], [28.5, 29]];
  return out + P(d, p.c2) + `<path d="M32 18V46" stroke="${BG}" stroke-width="1" opacity=".5"/>`;
}

function dHex(r: Rng, p: Pal): string {
  const hex: Pt[] = [];
  for (let i = 0; i < 6; i++) hex.push(polar(32, 32, 20, 30 + i * 60));
  const reticle = r.chance(0.5);
  let inner = '';
  if (reticle) {
    inner =
      `<circle cx="32" cy="32" r="7.5" ${strokeAttrs(p.c2, 2.4)}/>` +
      `<path d="M32 17v7M32 40v7M17 32h7M40 32h7" ${strokeAttrs(p.c, 2.6, 'round', 'butt')}/>` +
      `<circle cx="32" cy="32" r="2.2" fill="${p.c2}"/>`;
  } else {
    inner = `<path d="M23 36L32 25L41 36M23 43L32 32L41 43" ${strokeAttrs(p.c2, 3.2, 'miter', 'butt')}/>`;
  }
  return P(hex, p.c, 'opacity=".14"') + `<path d="${poly(hex)}" ${strokeAttrs(p.c, 3, 'miter')}/>` + inner;
}

function dChevrons(r: Rng, p: Pal): string {
  let out = '';
  const w = r.range(18, 21);
  const t = r.range(6, 7.5);
  for (let i = 0; i < 3; i++) {
    const y = 13 + i * 12;
    const pts: Pt[] = [[32 - w, y + 12], [32, y], [32 + w, y + 12], [32 + w, y + 12 + t], [32, y + t], [32 - w, y + 12 + t]];
    out += P(pts, i === 0 ? p.c2 : p.c, `opacity="${[1, 1, 0.55][i]}"`);
  }
  return out;
}

// ---------------------------------------------------------------- opensource

const node = (x: number, y: number, rr: number, c: string, w = 2.4) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${n(rr)}" fill="${BG}" stroke="${c}" stroke-width="${w}"/>`;

function oTree(r: Rng, p: Pal): string {
  const root: Pt = [32, 50];
  const fork: Pt = [32, r.range(33, 38)];
  const k = r.pick([2, 3]);
  const ends: Pt[] = [];
  const angles = k === 2 ? [-38, 38] : [-48, 0, 48];
  for (const a of angles) ends.push(polar(fork[0], fork[1], r.range(15, 19), a + r.range(-8, 8)));
  let lines = `M${root[0]} ${root[1]}L${n(fork[0])} ${n(fork[1])}`;
  for (const e of ends) lines += `M${n(fork[0])} ${n(fork[1])}Q${n(e[0])} ${n(fork[1] - 2)} ${n(e[0])} ${n(e[1])}`;
  return (
    `<path d="${lines}" ${strokeAttrs(p.c, 2.8)}/>` +
    node(root[0], root[1], 3.6, p.c) +
    ends.map((e, i) => node(e[0], e[1], 4, i === 0 ? p.c2 : p.c, 2.6)).join('') +
    `<circle cx="32" cy="${n(fork[1])}" r="2.4" fill="${p.c2}"/>`
  );
}

function oRings(r: Rng, p: Pal): string {
  // interlaced rings: at each crossing one ring passes over the other (alternating), Borromean-style
  const k = r.pick([2, 3, 3]);
  const rot = r.range(0, 360);
  const rr = k === 2 ? 11 : 9.5;
  const dist = k === 2 ? 6.5 : 7.2;
  const centers: Pt[] = [];
  for (let i = 0; i < k; i++) centers.push(polar(32, 32, dist, rot + (i * 360) / k));
  const col = (i: number) => (i === k - 1 ? p.c2 : p.c);
  let out = centers.map(([x, y], i) => `<circle cx="${n(x)}" cy="${n(y)}" r="${rr}" fill="none" stroke="${col(i)}" stroke-width="3.2"/>`).join('');
  const overArc = (i: number, X: Pt) => {
    const [cx, cy] = centers[i];
    const a = (Math.atan2(X[0] - cx, -(X[1] - cy)) * 180) / Math.PI;
    const [x0, y0] = polar(cx, cy, rr, a - 24);
    const [x1, y1] = polar(cx, cy, rr, a + 24);
    const d = `M${n(x0)} ${n(y0)}A${rr} ${rr} 0 0 1 ${n(x1)} ${n(y1)}`;
    return `<path d="${d}" fill="none" stroke="${BG}" stroke-width="7.5"/><path d="${d}" fill="none" stroke="${col(i)}" stroke-width="3.2"/>`;
  };
  for (let i = 0; i < k; i++)
    for (let j = i + 1; j < k; j++) {
      const [ax, ay] = centers[i];
      const [bx, by] = centers[j];
      const dx = bx - ax;
      const dy = by - ay;
      const d = Math.hypot(dx, dy);
      const h = Math.sqrt(Math.max(0, rr * rr - (d / 2) ** 2));
      const mx = ax + dx / 2;
      const my = ay + dy / 2;
      const X1: Pt = [mx - (dy / d) * h, my + (dx / d) * h];
      const X2: Pt = [mx + (dy / d) * h, my - (dx / d) * h];
      out += overArc(i, X1) + overArc(j, X2);
    }
  return out;
}

function oOpenRing(r: Rng, p: Pal): string {
  const rot = r.range(0, 360);
  const gap = r.range(60, 90);
  const [x0, y0] = polar(32, 32, 18, rot + gap / 2);
  const [x1, y1] = polar(32, 32, 18, rot - gap / 2 + 360);
  const [nx, ny] = polar(32, 32, 18, rot);
  const [i0x, i0y] = polar(32, 32, 8.5, rot + 180 + 40);
  const [i1x, i1y] = polar(32, 32, 8.5, rot + 180 - 40 + 360);
  return (
    `<path d="M${n(x0)} ${n(y0)}A18 18 0 1 1 ${n(x1)} ${n(y1)}" ${strokeAttrs(p.c, 3.4)}/>` +
    `<path d="M${n(i0x)} ${n(i0y)}A8.5 8.5 0 1 1 ${n(i1x)} ${n(i1y)}" ${strokeAttrs(p.c2, 3)}/>` +
    `<circle cx="${n(nx)}" cy="${n(ny)}" r="4.2" fill="${p.c2}"/>`
  );
}

function oMesh(r: Rng, p: Pal): string {
  const k = r.pick([5, 6]);
  const rot = r.range(0, 60);
  const pts: Pt[] = [];
  for (let i = 0; i < k; i++) pts.push(polar(32, 32, r.range(15, 19), rot + (i * 360) / k + r.range(-10, 10)));
  let lines = '';
  for (let i = 0; i < k; i++) {
    lines += `M32 32L${n(pts[i][0])} ${n(pts[i][1])}`;
    if (r.chance(0.65)) {
      const q = pts[(i + 1) % k];
      lines += `M${n(pts[i][0])} ${n(pts[i][1])}L${n(q[0])} ${n(q[1])}`;
    }
  }
  return (
    `<path d="${lines}" ${strokeAttrs(p.c, 2)} opacity=".75"/>` +
    pts.map(([x, y], i) => node(x, y, 3.3, i % 2 ? p.c : p.c2, 2.2)).join('') +
    `<circle cx="32" cy="32" r="4.6" fill="${p.c}"/>`
  );
}

function oSprout(r: Rng, p: Pal): string {
  const lean = r.range(-3, 3);
  const leaf = (bx: number, by: number, tx: number, ty: number, bulge: number) => {
    const mx = (bx + tx) / 2;
    const my = (by + ty) / 2;
    const dx = tx - bx;
    const dy = ty - by;
    const L = Math.hypot(dx, dy);
    const nx = (-dy / L) * bulge;
    const ny = (dx / L) * bulge;
    return `M${n(bx)} ${n(by)}Q${n(mx + nx)} ${n(my + ny)} ${n(tx)} ${n(ty)}Q${n(mx - nx)} ${n(my - ny)} ${n(bx)} ${n(by)}Z`;
  };
  return (
    `<path d="M32 52C32 44 ${n(32 + lean)} 36 ${n(32 + lean)} 22" ${strokeAttrs(p.c, 3)}/>` +
    `<path d="${leaf(32, 40, 14, 30, 6)}" ${strokeAttrs(p.c, 2.8)}/>` +
    `<path d="${leaf(32 + lean * 0.6, 32, 49, 21, 6)}" ${strokeAttrs(p.c2, 2.8)}/>` +
    node(32 + lean, 18.5, 4, p.c2, 2.6)
  );
}

// ---------------------------------------------------------------- assembly

const VARIANTS: Record<Archetype, ((r: Rng, p: Pal) => string)[]> = {
  frontier: [fSpark, fOrbits, fAperture, fArcs, fSparkle],
  bigtech: [bTiles, bPixel, bBauhaus, bCube, bRing],
  defense: [dShield, dDelta, dWings, dHex, dChevrons],
  opensource: [oTree, oRings, oOpenRing, oMesh, oSprout],
};

function tile(c: string, glyph: string): string {
  return (
    `<rect x=".75" y=".75" width="62.5" height="62.5" rx="14" fill="${BG}"/>` +
    `<circle cx="32" cy="32" r="27" fill="${c}" opacity=".08"/>` +
    `<path d="M14.75.75h34.5a14 14 0 0 1 14 14V24C44 30 20 20 .75 27V14.75a14 14 0 0 1 14-14Z" fill="#fff" opacity=".035"/>` +
    glyph +
    `<rect x=".75" y=".75" width="62.5" height="62.5" rx="14" fill="none" stroke="${c}" stroke-opacity=".32" stroke-width="1.2"/>`
  );
}

export function companyLogo(seed: number, color: string, archetype: Archetype, size = 48): string {
  const variants = VARIANTS[archetype] ?? VARIANTS.frontier;
  const r = new Rng((seed | 0) ^ hashString(archetype));
  const pal = palette(color);
  const glyph = variants[r.int(0, variants.length - 1)](r, pal);
  return svgRoot(size, size, '0 0 64 64', tile(pal.c, glyph), 'aria-hidden="true"');
}
