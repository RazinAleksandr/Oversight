/**
 * Icon set — one consistent line style:
 * 24×24 grid, 1.75 stroke in currentColor, round caps/joins, translucent currentColor accents.
 * Every name in ICON_NAMES (src/engine/labels.ts) is drawn here; unknown names get a neutral glyph.
 */
import { ICON_NAMES } from '../engine/labels';
import { arcPath, clipHalfPlane, gearPoints, n, poly, starPath, transformPts, XMLNS, type Pt } from './util';

// ---------------------------------------------------------------- tiny DSL

const TINT = 'fill="currentColor" fill-opacity=".2"';
/** stroked path */
const p = (d: string) => `<path d="${d}"/>`;
/** stroked path with a translucent fill */
const t = (d: string) => `<path d="${d}" ${TINT}/>`;
/** fill-only accent area (no stroke) */
const a = (d: string, op = 0.2) => `<path d="${d}" fill="currentColor" fill-opacity="${op}" stroke="none"/>`;
/** solid fill shape (no stroke) */
const s = (d: string) => `<path d="${d}" fill="currentColor" stroke="none"/>`;
const c = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const ct = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}" ${TINT}/>`;
/** solid dot */
const d = (cx: number, cy: number, r = 1) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" stroke="none"/>`;
const r = (x: number, y: number, w: number, h: number, rx = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''}/>`;
const rt = (x: number, y: number, w: number, h: number, rx = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''} ${TINT}/>`;
/** thin secondary line (strings, scan marks) */
const thin = (dd: string, op = 0.75) => `<path d="${dd}" stroke-width="1.1" stroke-opacity="${op}"/>`;
const ell = (cx: number, cy: number, rx: number, ry: number, rot: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})"/>`;

// ---------------------------------------------------------------- shared shapes

const SHIELD = 'M12 2.75 4.5 5.6v5.9c0 4.75 3.15 8.3 7.5 9.75 4.35-1.45 7.5-5 7.5-9.75V5.6Z';
const SHIELD_LEFT = 'M12 2.75 4.5 5.6v5.9c0 4.75 3.15 8.3 7.5 9.75Z';
const BOLT = 'M13.5 2.5 4.75 13.75H12l-1.5 7.75 8.75-11.25H12Z';
const EYE = 'M2.5 12c2.2-4.3 5.4-6.5 9.5-6.5s7.3 2.2 9.5 6.5c-2.2 4.3-5.4 6.5-9.5 6.5S4.7 16.3 2.5 12Z';
const SPEAKER = 'M3.5 9.5v5h3.75l5.25 4.5v-14L7.25 9.5Z';
const GEAR = gearPoints(12, 12, 9.75, 7.1, 8, 0.44, 22.5);

/** Arc from P to Q on circle (center c, radius rr) that passes through point `via`. */
function arcVia(cx: number, cy: number, rr: number, P: Pt, Q: Pt, via: Pt): string {
  const ang = (pt: Pt) => Math.atan2(pt[1] - cy, pt[0] - cx);
  const TAU = Math.PI * 2;
  const norm = (x: number) => ((x % TAU) + TAU) % TAU;
  const a0 = ang(P);
  const dq = norm(ang(Q) - a0);
  const dv = norm(ang(via) - a0);
  const cw = dv < dq; // screen-clockwise reaches `via` before Q
  const span = cw ? dq : TAU - dq;
  return `A${n(rr)} ${n(rr)} 0 ${span > Math.PI ? 1 : 0} ${cw ? 1 : 0} ${n(Q[0])} ${n(Q[1])}`;
}

/** Biohazard trefoil: three crescents (outer circle minus an offset hole) + core ring, even-odd filled. */
function biohazard(): string {
  const O: Pt = [12, 12.25];
  const R = 4.5;
  const r2 = 3.3;
  const e = 1.55;
  const d1 = 5.25; // 2·R < d1·√3 keeps the crescents from overlapping (clean even-odd fill)
  const aa = (R * R - r2 * r2 + e * e) / (2 * e);
  const h = Math.sqrt(R * R - aa * aa);
  let dd = '';
  for (const deg of [0, 120, 240]) {
    const rad = ((deg - 90) * Math.PI) / 180;
    const u: Pt = [Math.cos(rad), Math.sin(rad)];
    const v: Pt = [-u[1], u[0]];
    const c1: Pt = [O[0] + u[0] * d1, O[1] + u[1] * d1];
    const c2: Pt = [c1[0] + u[0] * e, c1[1] + u[1] * e];
    const P1: Pt = [c1[0] + u[0] * aa + v[0] * h, c1[1] + u[1] * aa + v[1] * h];
    const P2: Pt = [c1[0] + u[0] * aa - v[0] * h, c1[1] + u[1] * aa - v[1] * h];
    const back1: Pt = [c1[0] - u[0] * R, c1[1] - u[1] * R];
    const back2: Pt = [c2[0] - u[0] * r2, c2[1] - u[1] * r2];
    dd += `M${n(P1[0])} ${n(P1[1])}${arcVia(c1[0], c1[1], R, P1, P2, back1)}${arcVia(c2[0], c2[1], r2, P2, P1, back2)}Z`;
  }
  // core annulus
  const ring = (rr: number) => `M${n(O[0] - rr)} ${n(O[1])}a${rr} ${rr} 0 1 0 ${n(2 * rr)} 0a${rr} ${rr} 0 1 0 ${n(-2 * rr)} 0Z`;
  dd += ring(2.8) + ring(1.6);
  return `<path d="${dd}" fill="currentColor" fill-rule="evenodd" stroke="none"/>`;
}

/** One half of a gear split through its centre, with the axle hole, moved apart to read as "broken". */
function brokenGearHalf(side: 1 | -1, rot: number, dx: number, dy: number): string {
  const cx = 12;
  const cy = 12;
  const hole = 3;
  // split line through the centre, tilted ~20° from vertical
  const ang = (20 * Math.PI) / 180;
  const nx = Math.cos(ang) * side;
  const ny = Math.sin(ang) * side;
  const clipped = clipHalfPlane(GEAR, nx, ny, -(nx * cx + ny * cy));
  // rotate the chain so it starts at the entry point of the cut edge
  const onCut = (q: Pt) => Math.abs(nx * (q[0] - cx) + ny * (q[1] - cy)) < 1e-6;
  let start = 0;
  for (let i = 0; i < clipped.length; i++) {
    if (onCut(clipped[i]) && onCut(clipped[(i + 1) % clipped.length])) start = (i + 1) % clipped.length;
  }
  const chain = [...clipped.slice(start), ...clipped.slice(0, start)];
  const entry = chain[0];
  const exit = chain[chain.length - 1];
  const toHole = (q: Pt): Pt => {
    const L = Math.hypot(q[0] - cx, q[1] - cy);
    return [cx + ((q[0] - cx) / L) * hole, cy + ((q[1] - cy) / L) * hole];
  };
  const hExit = toHole(exit);
  const hEntry = toHole(entry);
  const via: Pt = [cx + nx * hole, cy + ny * hole];
  const all = transformPts([...chain, hExit, hEntry, via], rot, cx, cy, dx, dy);
  const m = all.length;
  const [tExit, tEntry, tVia] = [all[m - 3], all[m - 2], all[m - 1]];
  const pts = all.slice(0, m - 3);
  const dd =
    poly(pts, false) +
    `L${n(tExit[0])} ${n(tExit[1])}` +
    arcVia(cx + dx, cy + dy, hole, tExit, tEntry, tVia) +
    'Z';
  return `<path d="${dd}" ${TINT}/>`;
}

// ---------------------------------------------------------------- the set

const ICONS: Record<string, string> = {
  // ---- meters & resources
  confidence:
    t('M3 9.5 12 4l9 5.5Z') + p('M6 12.5v5M10 12.5v5M14 12.5v5M18 12.5v5M4.5 17.5h15M3 20.5h18'),
  economy:
    a('M7 16l4-4.5 3 3 5.5-6V17.5H7Z', 0.16) + p('M3.5 3.5v17h17') + p('M7 16l4-4.5 3 3 5.5-6') + p('M15.5 8.5h4v4'),
  stability:
    ct(12, 7.5, 3) + p('M6.5 20v-1.5a5.5 5.5 0 0 1 11 0V20') + c(5.25, 10, 2.1) + c(18.75, 10, 2.1) +
    p('M2.25 19v-.75a3.5 3.5 0 0 1 3-3.45M21.75 19v-.75a3.5 3.5 0 0 0-3-3.45'),
  security: a(SHIELD_LEFT, 0.38) + p(SHIELD) + thin('M12 3v18', 0.5),
  risk:
    c(12, 12, 8.75) + a('M12 12V4.25A7.75 7.75 0 0 0 7.9 5.43Z', 0.45) + p('M12 12 7.9 5.43') +
    p('M12 3.25v2.5M20.75 12h-2M12 20.75v-2M3.25 12h2') + d(12, 12, 1.3),
  clock: c(12, 13.5, 7.75) + p('M10 2.75h4M12 2.75v3') + p('M18.4 6.9l1.5-1.5') + p('M12 13.5 10.6 8.9') + d(12, 13.5, 1.2) +
    thin('M12 7.5v1M17.9 13.5h-1M12 19.5v-1M6.1 13.5h1', 0.6),
  budget: rt(2.5, 6, 19, 12, 2) + c(12, 12, 2.75) + d(6, 12, 1) + d(18, 12, 1) + thin('M5 20.5h14', 0.6),
  income:
    ct(10.5, 13.5, 7.5) +
    p('M12.75 11c-.35-.75-1.2-1.25-2.25-1.25-1.3 0-2.25.7-2.25 1.65 0 2.35 4.5 1.25 4.5 3.5 0 1-.95 1.6-2.25 1.6-1.15 0-2-.5-2.4-1.25M10.5 8.5v1.25M10.5 17.25v1.25') +
    p('M19.25 2.5v5M16.75 5h5'),
  capacity: t(BOLT),
  evidence:
    t('M3 7v11.5A1.5 1.5 0 0 0 4.5 20h15a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 19.5 8h-8l-2-2.5h-5A1.5 1.5 0 0 0 3 7Z') +
    p('M14.75 13V5.25a1.75 1.75 0 0 1 3.5 0v8.5a2.75 2.75 0 0 1-5.5 0V8.5') + thin('M6 16.5h4', 0.7),
  safeguards: t(SHIELD) + p('M8.5 12l2.5 2.5 4.75-5'),
  capability:
    t('M10.5 6.5c.7 4.3 2.7 6.3 7 7-4.3.7-6.3 2.7-7 7-.7-4.3-2.7-6.3-7-7 4.3-.7 6.3-2.7 7-7Z') +
    s('M18.5 2.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5Z') + d(20, 10.5, 1),
  adoption:
    ct(12, 12, 2.75) + c(5.5, 5.5, 2) + c(18.5, 5.5, 2) + c(5.5, 18.5, 2) + c(18.5, 18.5, 2) +
    p('M10.05 10.05 6.9 6.9M13.95 10.05l3.15-3.15M10.05 13.95 6.9 17.1M13.95 13.95l3.15 3.15'),
  displacement:
    ct(9, 7.5, 3.25) + p('M3 20.5V19a5.5 5.5 0 0 1 5.5-5.5h1a5.5 5.5 0 0 1 3 .9') + p('M15.5 16.5h6M18.5 13.5l3 3-3 3'),
  tension:
    t('M12 21.5a6.5 6.5 0 0 1-6.5-6.5c0-2.6 1.4-4.4 2.9-5.9.3 1.5 1 2.6 2.1 3.1-.4-3.4.9-6.6 3.5-9.2.5 2.9 2 4.9 3.6 6.6 1.7 1.8 2.9 3.4 2.9 5.4a6.5 6.5 0 0 1-6.5 6.5Z') +
    p('M12 21.5c-1.7 0-2.9-1.15-2.9-2.75 0-1.6 1.2-2.6 2.15-3.85.45 1.15 1.25 1.75 2.05 2.45.8.7 1.6 1.3 1.6 2.25 0 1.1-1.25 1.9-2.9 1.9Z'),
  accord:
    rt(1.5, 7, 3, 9, 0.75) + rt(19.5, 7, 3, 9, 0.75) +
    p('M4.5 8.5h2.6l3.6-1.9a2 2 0 0 1 1.8-.05L16.1 8.5h3.4') +
    p('M12.4 6.6 9 9.6a1.45 1.45 0 0 0 1.95 2.15l2.3-1.85 4.3 3.6') +
    p('M4.5 14.25h1.9l4.35 4.1a1.3 1.3 0 0 0 1.85-1.85M10.1 13.3l3.85 3.85a1.3 1.3 0 0 0 1.85-1.85l-1.6-1.6M16.4 13.65l.15.15a1.3 1.3 0 0 0 1.85-1.85M19.5 14.25h-1.3'),
  // ---- sectors
  business: rt(3, 7.5, 18, 12.5, 2) + p('M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2') + p('M3 12.5h7.25M13.75 12.5H21') + r(10.25, 11, 3.5, 3, 0.75),
  public: t('M3.5 10.5 12 3.5l8.5 7V19.5A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5Z') + p('M12 10.5v6.5M8.75 13.75h6.5'),
  infrastructure:
    p('M8.5 21.5 11 3h2l2.5 18.5') + p('M4 7.5h16M5.5 12h13') + thin('M4 7.5v2M20 7.5v2M5.5 12v2M18.5 12v2', 0.9) +
    thin('M10.4 7.5 14.2 12M13.6 7.5 9.8 12M9.8 12l5.2 6M14.2 12 9 18', 0.7),
  defense:
    t('M12 2.25 13.5 7.5v2.25l7 5.25v1.75l-7-1.75-.25 2.75 2.5 2v1.25L12 20l-3.75 1v-1.25l2.5-2-.25-2.75-7 1.75V15l7-5.25V7.5Z') + thin('M12 7.5v8', 0.6),

  // ---- archetypes
  frontier: ell(12, 12, 9.5, 3.6, 35) + ell(12, 12, 9.5, 3.6, -35) + d(12, 12, 2.1) + d(19.2, 7.1, 1.2),
  bigtech: r(3.5, 3.5, 7.5, 7.5, 2) + rt(13, 3.5, 7.5, 7.5, 2) + r(3.5, 13, 7.5, 7.5, 2) + ct(16.75, 16.75, 3.75),
  opensource:
    c(6, 5.5, 2.25) + c(6, 18.5, 2.25) + ct(18, 8, 2.25) + p('M6 7.75v8.5') + p('M18 10.25v.75a7 7 0 0 1-7 7H8.25'),

  // ---- programs
  safety:
    `<path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="currentColor" fill-opacity=".14" stroke="none" fill-rule="evenodd"/>` +
    c(12, 12, 9) + c(12, 12, 4) + p('M5.64 5.64l3.53 3.53M14.83 14.83l3.53 3.53M18.36 5.64l-3.53 3.53M9.17 14.83l-3.53 3.53'),
  oversight:
    ct(6.5, 16.25, 3.75) + ct(17.5, 16.25, 3.75) + p('M2.75 16 4.6 7A1.75 1.75 0 0 1 6.3 5.6h1.4a1.75 1.75 0 0 1 1.75 1.75v6.4') +
    p('M21.25 16 19.4 7a1.75 1.75 0 0 0-1.7-1.4h-1.4a1.75 1.75 0 0 0-1.75 1.75v6.4') + p('M9.5 11.5h5'),
  compute:
    rt(6, 6, 12, 12, 2) + r(9.5, 9.5, 5, 5, 1) +
    p('M9.5 2.5V6M14.5 2.5V6M9.5 18v3.5M14.5 18v3.5M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5'),
  workforce: t('M4.75 16.5V14.5a7.25 7.25 0 0 1 14.5 0v2Z') + r(2.5, 16.5, 19, 3.25, 1.6) + p('M10 7.6v4.4M14 7.6v4.4'),

  // ---- policies
  policy:
    a('M6.5 3H15a2.5 2.5 0 0 1 2.5 2.5V17h-6v1.5a2.5 2.5 0 0 1-5 0Z', 0.18) +
    p('M6.5 7.5v11a2.5 2.5 0 0 0 5 0V17h9v1.5a2.5 2.5 0 0 1-2.5 2.5H9') +
    p('M17.5 17V5.5A2.5 2.5 0 0 0 15 3H5.5A2.5 2.5 0 0 0 3 5.5V7.5h3.5') + thin('M10 8h4.5M10 11.5h4.5', 0.9),
  license: rt(2.5, 5, 19, 14, 2) + c(8.5, 10.5, 2) + p('M5.5 15.75a3 3 0 0 1 6 0') + p('M14 10h4.5M14 13.5h3'),
  report:
    t('M14 2.5H6.5A1.5 1.5 0 0 0 5 4v16a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V7.5Z') + p('M14 2.5v5h5') +
    p('M9 17.5v-3M12 17.5v-6M15 17.5v-4.5'),
  lock: rt(4.5, 10.5, 15, 10.5, 2) + p('M8 10.5V7a4 4 0 0 1 8 0v3.5') + p('M12 14.5v2.5'),
  gavel: t('M9.76 6.58 12.58 3.76l5.66 5.66-2.82 2.82Z') + p('M12.6 9.4 4.25 17.75') + p('M12 21.5h9.5M14 21.5v-2a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v2'),
  firewall:
    rt(3, 4.5, 18, 15, 1.5) + p('M3 9.5h18M3 14.5h18') +
    thin('M9 4.5v5M15 4.5v5M6 9.5v5M12 9.5v5M18 9.5v5M9 14.5v5M15 14.5v5', 0.9),
  dividend:
    ct(15, 6.5, 3.75) + thin('M15 4.75v3.5', 0.9) +
    p('M2.5 14.5h2.75l2.6-1.6a3 3 0 0 1 1.6-.45h3.8a1.6 1.6 0 0 1 0 3.2H10') +
    p('M13.2 15.65l4.05-2.55a1.55 1.55 0 0 1 2 2.3l-3.6 3.3a3.5 3.5 0 0 1-2.35.9H5.25'),
  killswitch: p('M12 3v8.5') + p('M6.52 7.52A7.75 7.75 0 1 0 17.48 7.52'),
  human: ct(12, 8, 4) + p('M4.5 21a7.5 7.5 0 0 1 15 0'),
  fasttrack: t('M3.5 6.25v11.5l7.75-5.75Z') + t('M12.25 6.25v11.5L20 12Z'),

  // ---- actions
  investigate: ct(10.5, 10.5, 6.75) + p('M15.5 15.5 21 21') + thin('M7.4 9.2a3.4 3.4 0 0 1 1.8-1.8', 0.9),
  audit:
    p('M12.5 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3h8.5l4 4v3') + p('M14 3v4h4') +
    p('M7.5 8.5h4M7.5 12h3') + ct(15.5, 15.5, 3.5) + p('M18 18l3 3'),
  grant:
    t('M9 7.5h6c3 2.4 5 5.7 5 8.9a4 4 0 0 1-4 4.1H8a4 4 0 0 1-4-4.1c0-3.2 2-6.5 5-8.9Z') + p('M9.5 7.5 8 3.5h8l-1.5 4') +
    p('M13.8 12.3c-.3-.6-1-1-1.8-1-1 0-1.8.5-1.8 1.3 0 1.8 3.6 1 3.6 2.7 0 .8-.8 1.3-1.8 1.3-.9 0-1.6-.4-1.9-1M12 10.3v1M12 16.6v1'),
  contract:
    p('M13.5 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3h9l3.5 3.5V8') + thin('M7 7.5h5M7 11h4', 0.9) +
    p('M6.5 17.25c1-1.6 1.8-1.6 2.2 0s1.2 1.5 2.3-.4') + t('M19 9.75a1.6 1.6 0 0 1 2.25 2.25l-7.5 7.5-3 .75.75-3Z'),
  enforce:
    p('M9.5 12.5V9.8c0-1-1.5-1.8-1.5-3.8a4 4 0 0 1 8 0c0 2-1.5 2.8-1.5 3.8v2.7') + t('M4 15.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2V18H4Z') + p('M5 21h14'),
  brief:
    t('M8.5 4.5H6.25A1.75 1.75 0 0 0 4.5 6.25v13.5c0 .97.78 1.75 1.75 1.75h11.5c.97 0 1.75-.78 1.75-1.75V6.25c0-.97-.78-1.75-1.75-1.75H15.5') +
    r(8.5, 2.75, 7, 3.5, 1) + p('M8 11h8M8 14.5h8M8 18h5'),
  address:
    rt(9, 2.5, 6, 10.5, 3) + thin('M9 7.25h2M13 7.25h2M9 9.75h2M13 9.75h2', 0.8) + p('M5.75 10.5a6.25 6.25 0 0 0 12.5 0') + p('M12 16.75v4.25M8.5 21h7'),
  diplomacy:
    t('M4.5 4h9A1.5 1.5 0 0 1 15 5.5v6a1.5 1.5 0 0 1-1.5 1.5H8.25L5 15.75V13h-.5A1.5 1.5 0 0 1 3 11.5v-6A1.5 1.5 0 0 1 4.5 4Z') +
    p('M17.5 9h1.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-.5v2.75L15.75 18H10.5A1.5 1.5 0 0 1 9 16.5V15.5'),
  partnership: `<path d="M10.57 16.92A5.25 5.25 0 1 1 13.12 14.91"/>` + `<path d="M13.45 7.07A5.25 5.25 0 1 1 10.9 9.06"/>`,
  export: t('M3 8.5 9.5 5l6.5 3.5v7.5L9.5 19.5 3 16Z') + p('M3 8.5l6.5 3.5 6.5-3.5M9.5 12v7.5') + p('M17.5 12H22M19.75 9.75 22 12l-2.25 2.25'),
  espionage:
    p('M2.5 11.5h19') + t('M6.25 11.5 7.8 5.6c.2-.8 1-1.3 1.8-1.1l2.4.6 2.4-.6c.8-.2 1.6.3 1.8 1.1l1.55 5.9Z') +
    ct(7.5, 16.5, 2.75) + ct(16.5, 16.5, 2.75) + p('M10.25 16.5c1-.8 2.5-.8 3.5 0'),
  sabotage: brokenGearHalf(1, 11, 1.5, -0.9) + brokenGearHalf(-1, -9, -1.5, 0.9),
  recruit: ct(9.5, 8, 3.5) + p('M3 20.5v-.5a6.5 6.5 0 0 1 13 0v.5') + p('M19 8v6M16 11h6'),
  respond:
    t('M6.5 17.5v-5a5.5 5.5 0 0 1 11 0v5Z') + r(4.5, 17.5, 15, 3.5, 1) + thin('M9.6 13.2a2.6 2.6 0 0 1 2.4-2.4', 0.9) +
    p('M12 2.5v2M4.6 5.1l1.4 1.4M19.4 5.1 18 6.5M2.5 12.5h1.75M19.75 12.5h1.75'),

  // ---- situations
  agents: rt(4.5, 7.5, 15, 12, 3) + p('M12 7.5V4.75') + d(12, 3.6, 1.3) + d(9, 12.75, 1.5) + d(15, 12.75, 1.5) + p('M2.5 12v3.5M21.5 12v3.5') + thin('M10 16.25h4', 0.9),
  deception:
    t('M2.5 8.5c3.2-1.3 6.4-1 9.5 1 3.1-2 6.3-2.3 9.5-1-.1 5.3-2.3 8.5-5.5 8.5-1.8 0-3-1.6-4-2.6-1 1-2.2 2.6-4 2.6-3.2 0-5.4-3.2-5.5-8.5Z') +
    s('M5.5 11.75c.9-1.2 2.6-1.2 3.5 0-.9 1.2-2.6 1.2-3.5 0ZM15 11.75c.9-1.2 2.6-1.2 3.5 0-.9 1.2-2.6 1.2-3.5 0Z'),
  blackout: p('M7.83 9.79 4.75 13.75H12l-1.5 7.75 3.95-5.09M16.17 14.21l3.08-3.96H12l1.5-7.75-3.95 5.09') + p('M3.5 3.5l17 17'),
  manipulation:
    p('M5.5 4.5h13M12 2.5v4') + thin('M7 4.5v8.5M17 4.5v8.5M12 6.5v1.75', 0.7) + ct(12, 10.25, 1.85) +
    p('M12 12.1v4.4M7 13l5 1 5-1M12 16.5l-2.75 4.5M12 16.5l2.75 4.5'),
  cyber: rt(2.5, 4, 19, 16, 2) + p('M6.5 9.5l3 2.5-3 2.5M11.5 15h5'),
  bio: biohazard(),
  missile:
    t('M20.5 3.5c-3 .2-5.6 1.4-7.6 3.4L7.25 12.6l4.15 4.15 5.7-5.65c2-2 3.2-4.6 3.4-7.6Z') +
    p('M8.75 11.1 5.2 10.5l-1.7 1.7 3.9 1.75M12.9 15.25l.6 3.55-1.7 1.7-1.75-3.9') + thin('M6.25 16.5 3 19.75M7.75 18.5 5.5 20.75M4.5 15.25 2.75 17', 0.85),
  escape: p('M10.5 3.5H5A1.5 1.5 0 0 0 3.5 5v14A1.5 1.5 0 0 0 5 20.5h14a1.5 1.5 0 0 0 1.5-1.5v-5.5') + d(8.5, 15.5, 2) + p('M10.75 13.25 21 3M14.5 3H21v6.5'),
  spillover:
    thin('M12 2.5V4.5M12 7.5v2M12 12.5v2M12 17.5v2', 0.75) +
    t('M2.5 18.5c2.4 0 3.6-1.3 5-3.6 1.9-3.2 4.1-6.4 8.2-6.4 3 0 5 1.9 5 4.4 0 2-1.4 3.2-3 3.2-1.3 0-2.2-.8-2.2-1.9 0-.9.6-1.6 1.5-1.6') +
    p('M2.5 21.5c1.6-1 3.2-1 4.8 0s3.2 1 4.8 0 3.2-1 4.8 0 3.2 1 4.8 0'),
  // ---- tabs
  inbox:
    t('M3 13.5 5.4 6A1.5 1.5 0 0 1 6.8 5h10.4a1.5 1.5 0 0 1 1.4 1L21 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18Z') +
    p('M3 13.5h5l1.5 2.5h5l1.5-2.5h5'),
  labs:
    a('M7.25 14.5h9.5l2.4 3.9a1.75 1.75 0 0 1-1.5 2.6H6.3a1.75 1.75 0 0 1-1.5-2.6Z', 0.3) +
    p('M10 3v6.2L4.8 18.4A1.75 1.75 0 0 0 6.3 21h11.4a1.75 1.75 0 0 0 1.5-2.6L14 9.2V3') + p('M8.5 3h7') + thin('M7.25 14.5h9.5', 0.9) + d(13, 17.75, 0.9),
  nation: t('M3 6.25 8.5 3.75l7 2.5 5.5-2.5v14l-5.5 2.5-7-2.5-5.5 2.5Z') + p('M8.5 3.75v14M15.5 6.25v14'),
  world:
    c(12, 12, 9) + p('M3 12h18') + p('M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z') +
    thin('M4.6 7.5h14.8M4.6 16.5h14.8', 0.6),
  threats:
    a('M12 12V3a9 9 0 0 1 7.79 4.5Z', 0.32) + c(12, 12, 9) + thin(`M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9`, 0.6) + p('M12 12l7.79-4.5') +
    d(8, 9.25, 1.3) + d(15.25, 15.75, 1.3),

  // ---- card sources
  company:
    t('M4.5 21V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 14.5 5v16') + p('M14.5 9.5h4a1.5 1.5 0 0 1 1.5 1.5v10') +
    p('M2.5 21h19') + p('M8 7.5h3M8 11h3M8 14.5h3M17 13.5v.01M17 17v.01'),
  government:
    t('M6.5 11a5.5 5.5 0 0 1 11 0Z') + p('M12 5.5V2.75') + p('M4.75 11h14.5M7 11v6.5M10.3 11v6.5M13.7 11v6.5M17 11v6.5') +
    p('M4.5 17.5h15M2.5 21h19'),
  foreign:
    ct(11, 10, 6.25) + thin('M4.75 10h12.5M11 3.75c1.6 1.7 2.4 3.8 2.4 6.25s-.8 4.55-2.4 6.25', 0.8) +
    p('M17.6 3.4a9 9 0 0 1-12.7 12.7') + p('M11 19v2.5M7.5 21.5h7'),
  intelligence:
    t('M9.5 12 12 9.5l2.5 2.5-2.5 2.5Z') +
    t('M8.09 3.14 10.36 5.41 5.41 10.36 3.14 8.09Z') + t('M15.91 20.86 13.64 18.59 18.59 13.64 20.86 15.91Z') +
    p('M7.9 7.9l2.85 2.85M16.1 16.1l-2.85-2.85') + p('M14.6 9.4l1.9-1.9') + p('M17.25 3.25a3.5 3.5 0 0 1 3.5 3.5'),
  public_voice:
    t('M3.5 9.5v5a1 1 0 0 0 1 1H7l9 4.5V4L7 8.5H4.5a1 1 0 0 0-1 1Z') + p('M7.25 15.5l1.5 5h2.5l-1-4.25') + p('M19 9.25a3.5 3.5 0 0 1 0 5.5'),
  ai:
    c(12, 12, 9) + ct(12, 12, 4.5) + d(12, 12, 1.8) + p('M12 3v2.25M12 18.75V21M3 12h2.25M18.75 12H21') +
    thin('M6.7 6.7l1.1 1.1M17.3 6.7l-1.1 1.1M6.7 17.3l1.1-1.1M17.3 17.3l-1.1-1.1', 0.7),
  advisor:
    ct(12, 7, 3.5) + p('M4.5 21v-1.5a5.5 5.5 0 0 1 5.5-5.5h4a5.5 5.5 0 0 1 5.5 5.5V21') + s('M12 14.5l1.25 1.5-1.25 4.75-1.25-4.75Z') + thin('M9.5 14.25 12 17l2.5-2.75', 0.9),
  media: rt(3, 7.5, 18, 13, 2) + p('M8 3l4 4.5 4-4.5') + r(6, 10.5, 9, 7, 1) + d(18, 11.5, 0.9) + d(18, 14.5, 0.9),

  // ---- ui
  settings: t(poly(GEAR)) + c(12, 12, 3),
  sound: t(SPEAKER) + p('M16 9a4.2 4.2 0 0 1 0 6M18.8 6.2a8.2 8.2 0 0 1 0 11.6'),
  sound_off: t(SPEAKER) + p('M16.5 9.5l5 5M21.5 9.5l-5 5'),
  music: p('M9 18V5.5l11-2V16') + ct(6.5, 18, 2.5) + ct(17.5, 16, 2.5) + p('M9 9.5l11-2'),
  close: p('M6 6l12 12M18 6 6 18'),
  back: p('M19.5 12h-15M10.5 6l-6 6 6 6'),
  info: ct(12, 12, 9) + p('M12 11v5.5') + d(12, 7.75, 1.25),
  warning: t('M10.3 4.2a2 2 0 0 1 3.4 0l7.6 13.3a2 2 0 0 1-1.7 3H4.4a2 2 0 0 1-1.7-3Z') + p('M12 9.5v4.5') + d(12, 17, 1.15),
  check: p('M4.5 12.5l5 5 10-11'),
  cross: ct(12, 12, 9) + p('M8.75 8.75l6.5 6.5M15.25 8.75l-6.5 6.5'),
  arrow_up: p('M12 19.5v-15M6 10.5l6-6 6 6'),
  arrow_down: p('M12 4.5v15M6 13.5l6 6 6-6'),
  chevron_right: p('M9 5.5l6.5 6.5L9 18.5'),
  chevron_left: p('M15 5.5 8.5 12l6.5 6.5'),
  play: t('M7 4.75v14.5a1 1 0 0 0 1.5.86l11.6-7.25a1 1 0 0 0 0-1.72L8.5 3.89A1 1 0 0 0 7 4.75Z'),
  refresh: p('M4 12a8 8 0 0 1 13.66-5.66L20 8.7') + p('M20 3.5v5.2h-5.2') + p('M20 12a8 8 0 0 1-13.66 5.66L4 15.3') + p('M4 20.5v-5.2h5.2'),
  calendar:
    rt(3.5, 5, 17, 16, 2) + p('M3.5 10h17M8 3v4M16 3v4') +
    d(8, 13.75, 1) + d(12, 13.75, 1) + d(16, 13.75, 1) + d(8, 17.25, 1) + d(12, 17.25, 1),
  news:
    a('M4 4.5h13v14a2.5 2.5 0 0 0 2.5 2.5h-13A2.5 2.5 0 0 1 4 18.5Z', 0.16) +
    p('M19.5 21h-13A2.5 2.5 0 0 1 4 18.5v-14h13v14a2.5 2.5 0 0 0 5 0V9h-5') + rt(7, 7.5, 7, 3.5, 0.5) + p('M7 14.5h7M7 17.5h5'),
  star: t(starPath(12, 12.6, 9.6, 4.3, 5)),
  flag: p('M5 21.5V3.5') + t('M5 4.5c2.5-1.5 5-1.5 7 0s4.5 1.5 7 0v9c-2.5 1.5-5 1.5-7 0s-4.5-1.5-7 0Z'),
  target: c(12, 12, 8) + ct(12, 12, 3.5) + p('M12 2v4M12 18v4M2 12h4M18 12h4') + d(12, 12, 1),
  eye: t(EYE) + c(12, 12, 3) + d(12, 12, 1.1),
  eye_off: p('M9.9 5.75C10.6 5.6 11.3 5.5 12 5.5c4.1 0 7.3 2.2 9.5 6.5-.6 1.2-1.3 2.25-2.1 3.15M15.4 16.9A9.3 9.3 0 0 1 12 18.5c-4.1 0-7.3-2.2-9.5-6.5 1-1.9 2.2-3.4 3.6-4.5') + p('M9.9 9.9a3 3 0 0 0 4.2 4.2') + p('M3.5 3.5l17 17'),
  question: ct(12, 12, 9) + p('M9.5 9.5a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2.2-2.5 3.7') + d(12, 17, 1.15),
  skull:
    t('M12 3a8 8 0 0 0-8 8c0 2.6 1.2 4.4 3 5.6V19a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 19v-2.4c1.8-1.2 3-3 3-5.6a8 8 0 0 0-8-8Z') +
    d(9, 11.5, 1.85) + d(15, 11.5, 1.85) + s('M12 13.75l1 2h-2Z') + thin('M10.25 20.5v-2M13.75 20.5v-2', 0.9),
  sun: ct(12, 12, 4) + p('M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4'),
  trophy:
    t('M7 3.5h10v6a5 5 0 0 1-10 0Z') + p('M7 5.5H4.5V7a3.5 3.5 0 0 0 3 3.5M17 5.5h2.5V7a3.5 3.5 0 0 1-3 3.5') +
    p('M12 14.5v3M8 21h8M9 21v-2a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 19v2'),
  menu: p('M4 7h16M4 12h16M4 17h16'),
  help:
    t('M5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17h-1A1.5 1.5 0 0 1 4 15.5v-10A1.5 1.5 0 0 1 5.5 4Z') +
    p('M9.9 8.6a2.25 2.25 0 0 1 4.35.85c0 1.45-2.25 1.75-2.25 3.05') + d(12, 14.6, 1.05),
  dice: rt(3.5, 3.5, 17, 17, 3.5) + d(8, 8, 1.45) + d(16, 8, 1.45) + d(12, 12, 1.45) + d(8, 16, 1.45) + d(16, 16, 1.45),
};

/** Neutral glyph for unknown names: a HUD diamond. */
const FALLBACK = t('M12 3.5 20.5 12 12 20.5 3.5 12Z') + d(12, 12, 1.5);

export function icon(name: string, size = 24): string {
  const body = ICONS[name] ?? FALLBACK;
  return (
    `<svg xmlns="${XMLNS}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-icon="${name}">${body}</svg>`
  );
}

export function iconNames(): string[] {
  return [...ICON_NAMES];
}
