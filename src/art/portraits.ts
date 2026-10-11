/**
 * Procedural bust portraits — flat vector with graphic-novel lighting (two-tone key light + rim light).
 * Deterministic: the face (skin, features, hair, age) depends only on `seed`; wardrobe and backdrop
 * depend on `role` and `hue`. Def-free so the same portrait can appear many times on one page.
 * viewBox 0 0 100 100, rounded frame; looks right at 40px (silhouette, hair, wardrobe colour blocks)
 * and at 120px+ (features, glasses, lapel pins, lanyards).
 */
import { Rng, hashString } from './rng';
import { darken, hsl, lighten, mix, n, poly, svgRoot, type Pt } from './util';

export type PortraitRole = 'leader' | 'advisor' | 'ceo' | 'rival';
export interface PortraitOpts {
  size?: number;
  role?: PortraitRole;
  hue?: number;
}

// ---------------------------------------------------------------- palettes

const SKIN = ['#3b2318', '#55331f', '#6e4129', '#875234', '#a0663f', '#b97c53', '#cb9168', '#daa881', '#e8bf9c', '#f1d1b5'];
const HAIR_DARK = ['#141110', '#1d1612', '#2c1f17', '#3f2a1d'];
const HAIR_MID = ['#553624', '#6f3a22', '#8a6440', '#b8925a', '#cfae72'];
const HAIR_GREY = ['#6d6e72', '#8f9094', '#b4b5b8', '#d9d8d4'];

type HairStyle = 'bald' | 'buzz' | 'short' | 'swept' | 'curly' | 'receding' | 'afro' | 'long' | 'bob' | 'bun' | 'pixie' | 'locs';

// ---------------------------------------------------------------- curve helpers

type Seg = [Pt, Pt, Pt, Pt];

/** Closed Catmull-Rom → cubic segments (seg i runs pts[i] → pts[i+1]). */
function crSegments(pts: Pt[], k = 1 / 6): Seg[] {
  const L = pts.length;
  const g = (i: number) => pts[((i % L) + L) % L];
  const segs: Seg[] = [];
  for (let i = 0; i < L; i++) {
    const p0 = g(i - 1);
    const p1 = g(i);
    const p2 = g(i + 1);
    const p3 = g(i + 2);
    segs.push([p1, [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k], [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k], p2]);
  }
  return segs;
}

const pt = (p: Pt) => `${n(p[0])} ${n(p[1])}`;
function segsPath(segs: Seg[], move = true): string {
  let d = move ? `M${pt(segs[0][0])}` : '';
  for (const s of segs) d += `C${pt(s[1])} ${pt(s[2])} ${pt(s[3])}`;
  return d;
}
/** Smooth closed path through points. */
const blob = (pts: Pt[], k?: number) => segsPath(crSegments(pts, k)) + 'Z';
/** Smooth open path through points, without the leading move (to append). */
function openTail(pts: Pt[]): string {
  const ext: Pt[] = [pts[0], ...pts, pts[pts.length - 1]];
  let d = '';
  for (let i = 1; i < ext.length - 2; i++) {
    const p0 = ext[i - 1];
    const p1 = ext[i];
    const p2 = ext[i + 1];
    const p3 = ext[i + 2];
    d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
  }
  return d;
}
const mirror = (inner: string) => `<g transform="matrix(-1 0 0 1 100 0)">${inner}</g>`;
const mx = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [100 - x, y]);
const F = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

// ---------------------------------------------------------------- the face model

interface Face {
  fem: boolean;
  age: 0 | 1 | 2; // young / mid / older
  skin: string;
  shade: string;
  light: string;
  lip: string;
  hair: string;
  brow: string;
  style: HairStyle;
  yT: number;
  h: number;
  wC: number;
  wTop: number;
  wJ: number;
  cw: number;
  yE: number;
  yB: number;
  nw: number;
  glasses: 0 | 1 | 2 | 3;
  frame: string;
  facial: 0 | 1 | 2 | 3 | 4; // none, stubble, mustache, beard, goatee
  smile: number;
  s: 1 | -1; // shadow side (+1 = right of frame)
  pts: Pt[];
  segs: Seg[];
  rim: string; // backlight colour (set from the backdrop)
}

function makeFace(seed: number, role: PortraitRole): Face {
  const r = new Rng(seed);
  const fem = r.chance(0.5);
  const ageRoll = r.next();
  const senior = role === 'leader' || role === 'rival';
  const age: 0 | 1 | 2 = senior ? (ageRoll < 0.12 ? 0 : ageRoll < 0.6 ? 1 : 2) : ageRoll < 0.32 ? 0 : ageRoll < 0.78 ? 1 : 2;
  const si = r.int(0, SKIN.length - 1);
  const skin = SKIN[si];
  const deep = si <= 3;
  // deep tones get a shallower shadow and a stronger key so features stay legible on dark backdrops
  const shade = mix(skin, '#2a1420', si <= 1 ? 0.24 : deep ? 0.3 : 0.36);
  const light = mix(skin, '#fff4e6', si <= 1 ? 0.3 : 0.22);
  const lip = mix(skin, fem ? '#9c3d4a' : '#7a3a3a', fem ? 0.38 : 0.22);

  // hair colour: older → greys; deeper skin tones → mostly dark hair
  let hair: string;
  if (age === 2 && r.chance(0.78)) hair = r.pick(HAIR_GREY);
  else if (age === 1 && r.chance(0.18)) hair = r.pick(HAIR_GREY.slice(0, 2));
  else if (deep || r.chance(0.45)) hair = r.pick(HAIR_DARK);
  else hair = r.pick(HAIR_MID);

  const masc: [HairStyle, number][] = [
    ['bald', age === 2 ? 3 : 1], ['buzz', 3], ['short', 4], ['swept', 3], ['curly', deep ? 3 : 1.5], ['receding', age >= 1 ? 3 : 0.5], ['afro', deep ? 2 : 0.3],
  ];
  const femStyles: [HairStyle, number][] = [
    ['long', 4], ['bob', 3.5], ['bun', 3], ['pixie', 2], ['curly', deep ? 2.5 : 1.5], ['afro', deep ? 2.5 : 0.3], ['locs', deep ? 2 : 0.2],
  ];
  const style = r.weighted(fem ? femStyles : masc);

  const shape = r.int(0, 4); // oval, round, square, long, heart
  let wC = fem ? r.range(15, 16.6) : r.range(15.8, 17.6);
  let h = fem ? r.range(45, 48.5) : r.range(46.5, 50.5);
  let wJ = 0.8;
  let cw = 0.32;
  let wTop = wC * 0.97;
  if (shape === 1) { wJ = 0.9; cw = 0.42; h -= 1.5; wC += 0.5; }
  if (shape === 2) { wJ = 0.95; cw = 0.5; }
  if (shape === 3) { wJ = 0.8; cw = 0.3; h += 3; wC -= 0.6; }
  if (shape === 4) { wJ = 0.72; cw = 0.26; wTop = wC * 1.02; }
  if (fem) { wJ *= 0.95; cw *= 0.9; }
  wJ *= wC;
  cw *= wC;
  const yT = r.range(17, 19.5) + (shape === 3 ? -1.5 : 0);
  const yB = yT + h;
  const yE = yT + 0.5 * h;

  const R: Pt[] = [
    [50, yT],
    [50 + wTop * 0.7, yT + wTop * 0.29],
    [50 + wTop, yT + Math.max(0.28 * h, wTop * 0.92)],
    [50 + wC, yT + 0.5 * h],
    [50 + wJ, yT + (shape === 2 ? 0.8 : 0.76) * h],
    [50 + cw, yT + 0.955 * h],
    [50, yB],
  ];
  const pts: Pt[] = [...R, ...mx(R.slice(1, 6)).reverse()];

  const glassesRoll = r.next();
  const glasses = (glassesRoll < 0.13 ? 1 : glassesRoll < 0.27 ? 2 : glassesRoll < 0.33 ? 3 : 0) as 0 | 1 | 2 | 3;
  const frame = r.pick(['#121214', '#121214', '#2b2b30', '#5b3b26', '#c4a15a', '#aab0b8']);
  let facial: Face['facial'] = 0;
  if (!fem) {
    const fr = r.next();
    facial = (fr < 0.14 ? 1 : fr < 0.24 ? 2 : fr < 0.38 ? 3 : fr < 0.45 ? 4 : 0) as Face['facial'];
  } else r.next();
  const brow = hair === HAIR_GREY[3] || hair === HAIR_GREY[2] ? mix(hair, '#3a3a3a', 0.5) : darken(hair, 0.15);
  return {
    fem, age, skin, shade, light, lip, hair, brow, style, yT, h, wC, wTop, wJ, cw, yE, yB,
    nw: fem ? r.range(6, 6.8) : r.range(6.8, 8.2),
    glasses, frame, facial,
    smile: r.range(-0.2, 1.3),
    s: r.chance(0.5) ? 1 : -1,
    pts,
    segs: crSegments(pts),
    rim: '#9fdcff',
  };
}

// ---------------------------------------------------------------- face layers

function head(f: Face, role: PortraitRole): string {
  const { yT, h, wC, wTop, yE, yB, s } = f;
  const yN = yE + 0.2 * h;
  let out = '';
  // ears
  for (const side of [-1, 1]) {
    const ex = 50 + side * (wC + 0.6);
    out += `<ellipse cx="${n(ex)}" cy="${n(yE + 0.085 * h)}" rx="2.8" ry="${n(0.125 * h)}" fill="${side === s ? f.shade : f.skin}"/>`;
    out += `<path d="M${n(ex - side * 0.3)} ${n(yE + 0.02 * h)}q${n(side * 1.3)} 2 0 ${n(0.12 * h)}" fill="none" stroke="${f.shade}" stroke-width=".9" opacity=".7"/>`;
  }
  // face
  out += F(segsPath(f.segs) + 'Z', f.skin);
  // shadow side (built on the right, mirrored when the light comes from the right)
  const shadow =
    segsPath(f.segs.slice(1, 6)) +
    openTail([
      [50 + f.cw * 0.55, f.yB - 0.5],
      [50 + 5.2, yE + 0.34 * h],
      [50 + wC * 0.5, yE + 0.2 * h],
      [50 + wC * 0.56, yE + 0.04 * h],
      [50 + wC * 0.5, yE - 4],
      [50 + wTop * 0.5, yT + 0.12 * h],
      f.pts[1],
    ]) +
    'Z';
  const shadowOp = role === 'rival' ? 0.66 : 0.55;
  const lit = F(shadow, f.shade, `opacity="${shadowOp}"`);
  out += s === 1 ? lit : mirror(lit);
  // lit-side cheek & nose-bridge highlights
  const hl =
    F(blob([[50 - wC * 0.72, yE + 0.06 * h], [50 - wC * 0.42, yE + 0.04 * h], [50 - wC * 0.38, yE + 0.15 * h], [50 - wC * 0.7, yE + 0.2 * h]]), f.light, 'opacity=".28"') +
    `<path d="M48.6 ${n(yE + 1)}L48.2 ${n(yN - 2.2)}" stroke="${f.light}" stroke-width="1.2" stroke-linecap="round" opacity=".4"/>`;
  out += s === 1 ? hl : mirror(hl);
  return out;
}

function features(f: Face, role: PortraitRole): string {
  const { yE, h, wC, s } = f;
  const yN = yE + 0.2 * h;
  const yM = yE + 0.315 * h;
  const ex = wC * 0.43;
  const ink = mix(f.skin, '#120a0a', 0.82);
  let out = '';
  // brows
  const bt = f.fem ? 1.25 : 1.9;
  const stern = role === 'rival' ? 1.1 : 0;
  for (const side of [-1, 1]) {
    const xi = 50 + side * 3.1;
    const xo = 50 + side * (ex + 4.4);
    const yi = yE - 4.6 + stern;
    const yo = yE - 4.4;
    const xm = 50 + side * (ex + 0.6);
    const ym = yE - 6.6 + (f.fem ? -0.3 : 0.3);
    out += F(`M${n(xi)} ${n(yi)}Q${n(xm)} ${n(ym)} ${n(xo)} ${n(yo)}L${n(xo - side * 0.4)} ${n(yo + bt * 0.55)}Q${n(xm)} ${n(ym + bt)} ${n(xi)} ${n(yi + bt)}Z`, f.brow);
  }
  // eyes: dark almond + lid line + catch-light
  for (const side of [-1, 1]) {
    const x = 50 + side * ex;
    const ew = f.fem ? 3.1 : 2.9;
    out += F(`M${n(x - ew)} ${n(yE)}Q${n(x)} ${n(yE - 2.3)} ${n(x + ew)} ${n(yE)}Q${n(x)} ${n(yE + 1.6)} ${n(x - ew)} ${n(yE)}Z`, '#f1ece6', 'opacity=".9"');
    out += `<circle cx="${n(x + side * 0.15)}" cy="${n(yE - 0.2)}" r="1.45" fill="${ink}"/>`;
    out += `<circle cx="${n(x - s * 0.55)}" cy="${n(yE - 0.75)}" r=".45" fill="#fff" opacity=".85"/>`;
    out += `<path d="M${n(x - ew - 0.5)} ${n(yE + 0.2)}Q${n(x)} ${n(yE - 2.8)} ${n(x + ew + 0.5)} ${n(yE + 0.2)}" fill="none" stroke="${ink}" stroke-width="${f.fem ? 1.15 : 0.95}" stroke-linecap="round"/>`;
    if (f.age === 2) out += `<path d="M${n(x - 2)} ${n(yE + 2)}q2 1 4 0" fill="none" stroke="${f.shade}" stroke-width=".7" opacity=".7"/>`;
  }
  // nose: wing shadow + nostril line
  out += F(`M${n(50 + s * 1.2)} ${n(yE + 2)}Q${n(50 + s * 3.4)} ${n(yN - 3)} ${n(50 + s * 3.6)} ${n(yN)}Q${n(50 + s * 1.5)} ${n(yN + 1)} ${n(50 + s * 0.6)} ${n(yN - 1)}Z`, f.shade, 'opacity=".55"');
  out += `<path d="M${n(47.2)} ${n(yN + 0.2)}Q50 ${n(yN + 1.7)} 52.8 ${n(yN + 0.2)}" fill="none" stroke="${f.shade}" stroke-width="1" stroke-linecap="round"/>`;
  // age lines
  if (f.age >= 1) {
    const op = f.age === 2 ? 0.6 : 0.3;
    out += `<path d="M45.6 ${n(yN + 1)}Q44.2 ${n(yM - 1)} 44.6 ${n(yM + 2)}M54.4 ${n(yN + 1)}Q55.8 ${n(yM - 1)} 55.4 ${n(yM + 2)}" fill="none" stroke="${f.shade}" stroke-width=".8" opacity="${op}"/>`;
  }
  // mouth
  const mw = f.fem ? 4.6 : 5;
  const sm = role === 'rival' ? Math.min(f.smile, 0.2) - 0.3 : f.smile;
  out += F(`M${n(50 - mw * 0.8)} ${n(yM + 0.3)}Q50 ${n(yM + 3.6 + sm * 0.4)} ${n(50 + mw * 0.8)} ${n(yM + 0.3)}Z`, f.lip, `opacity="${f.fem ? 0.9 : 0.55}"`);
  if (f.fem) out += F(`M${n(50 - mw * 0.85)} ${n(yM)}Q${n(48)} ${n(yM - 1.6)} 50 ${n(yM - 0.7)}Q${n(52)} ${n(yM - 1.6)} ${n(50 + mw * 0.85)} ${n(yM)}Z`, darken(f.lip, 0.12), 'opacity=".85"');
  out += `<path d="M${n(50 - mw)} ${n(yM - sm * 0.5)}Q50 ${n(yM + sm)} ${n(50 + mw)} ${n(yM - sm * 0.5)}" fill="none" stroke="${mix(f.lip, '#1a0c0c', 0.55)}" stroke-width="1.05" stroke-linecap="round"/>`;
  return out;
}

function facialHair(f: Face): string {
  if (!f.facial) return '';
  const { yE, h, wC } = f;
  const yN = yE + 0.2 * h;
  const yM = yE + 0.315 * h;
  const mw = 5;
  const col = f.hair;
  const stache = `M${n(50 - mw - 1.2)} ${n(yM + 0.6)}Q${n(50 - mw * 0.6)} ${n(yN + 1.2)} 50 ${n(yN + 2.4)}Q${n(50 + mw * 0.6)} ${n(yN + 1.2)} ${n(50 + mw + 1.2)} ${n(yM + 0.6)}Q50 ${n(yM - 1.2)} ${n(50 - mw - 1.2)} ${n(yM + 0.6)}Z`;
  if (f.facial === 2) return F(stache, col);
  // jaw region following the face contour (cheek → chin → cheek)
  const jaw = segsPath(f.segs.slice(3, 9));
  const inner = openTail([
    [50 - wC * 0.98, yE + 0.08 * h],
    [50 - wC * 0.7, yE + 0.2 * h],
    [50 - mw - 2.2, yM - 1.5],
    [50, yN + 1.6],
    [50 + mw + 2.2, yM - 1.5],
    [50 + wC * 0.7, yE + 0.2 * h],
    [50 + wC * 0.98, yE + 0.08 * h],
  ]);
  const region = jaw + `L${n(50 - wC * 0.98)} ${n(yE + 0.08 * h)}` + inner + 'Z';
  if (f.facial === 1) return F(region, col, 'opacity=".28"');
  if (f.facial === 3) {
    return (
      F(region, col, 'opacity=".95"') +
      // mouth opening + lower lip read through the beard
      F(`M${n(50 - mw + 0.6)} ${n(yM + 0.2)}Q50 ${n(yM + 3.2)} ${n(50 + mw - 0.6)} ${n(yM + 0.2)}Z`, f.lip, 'opacity=".8"') +
      `<path d="M${n(50 - mw)} ${n(yM)}H${n(50 + mw)}" stroke="${mix(f.hair, '#000', 0.5)}" stroke-width="1"/>` +
      F(stache, lighten(col, 0.06))
    );
  }
  // goatee
  const g = blob([
    [50 - mw - 1, yM + 0.4],
    [50 - mw * 0.55, yM + 3.6],
    [50 - 3.8, f.yB - 1.4],
    [50, f.yB + 0.3],
    [50 + 3.8, f.yB - 1.4],
    [50 + mw * 0.55, yM + 3.6],
    [50 + mw + 1, yM + 0.4],
    [50, yM + 2.2],
  ]);
  return F(g, col, 'opacity=".95"') + F(stache, col);
}

function glasses(f: Face): string {
  if (!f.glasses) return '';
  const { yE, wC } = f;
  const ex = wC * 0.43;
  const y = yE - 0.2;
  const sw = f.frame === '#c4a15a' || f.frame === '#aab0b8' ? 0.9 : 1.35;
  const st = `fill="#e8f2ff" fill-opacity=".1" stroke="${f.frame}" stroke-width="${sw}"`;
  let out = '';
  for (const side of [-1, 1]) {
    const x = 50 + side * ex;
    if (f.glasses === 1) out += `<circle cx="${n(x)}" cy="${n(y)}" r="4.5" ${st}/>`;
    else if (f.glasses === 2) out += `<rect x="${n(x - 5)}" y="${n(y - 3.4)}" width="10" height="6.8" rx="1.8" ${st}/>`;
    else out += `<path d="M${n(x - 5)} ${n(y - 0.4)}H${n(x + 5)}V${n(y + 0.6)}Q${n(x + 4.6)} ${n(y + 3.6)} ${n(x)} ${n(y + 3.6)}Q${n(x - 4.6)} ${n(y + 3.6)} ${n(x - 5)} ${n(y + 0.6)}Z" ${st}/>`;
    out += `<path d="M${n(x + side * (f.glasses === 1 ? 4.5 : 5))} ${n(y - 1)}L${n(50 + side * (wC + 0.4))} ${n(y - 0.4)}" stroke="${f.frame}" stroke-width="${sw}"/>`;
    out += `<path d="M${n(x - side * 1.2 - 1.4)} ${n(y - 2)}l2.2 -.9" stroke="#fff" stroke-width=".7" opacity=".55" stroke-linecap="round"/>`;
  }
  const inner = f.glasses === 1 ? ex - 4.5 : ex - 5;
  out += `<path d="M${n(50 - inner)} ${n(y - 0.6)}Q50 ${n(y - 2.2)} ${n(50 + inner)} ${n(y - 0.6)}" fill="none" stroke="${f.frame}" stroke-width="${sw}"/>`;
  return out;
}

// ---------------------------------------------------------------- hair

interface HairLayers {
  back: string; // behind neck & torso
  front: string; // over the head
  locks: string; // over the clothing (long hair falling forward)
}

function hairLayers(f: Face, r: Rng): HairLayers {
  const { yT, h, wC, wTop, yE, yB, s } = f;
  const c = f.hair;
  const sheenCol = lighten(c, 0.28);
  const shadowCol = darken(c, 0.35);
  const L: HairLayers = { back: '', front: '', locks: '' };
  const sheen = (v: number) =>
    `<path d="M${n(50 - wTop * 0.75)} ${n(yT + 0.1 * h)}Q${n(50 - wTop * 0.45)} ${n(yT - v * 0.6 + 0.5)} ${n(50 - 2)} ${n(yT - v + 1.6)}" fill="none" stroke="${sheenCol}" stroke-width="1.4" stroke-linecap="round" opacity=".28"${s === -1 ? ' transform="matrix(-1 0 0 1 100 0)"' : ''}/>`;

  /** Generic cap: outer contour around the skull + a hairline across the forehead. */
  const cap = (v: number, hairlineY: number, part: number, sideburn: number, opts: { templeIn?: number; bump?: number; fringe?: number } = {}) => {
    const ti = opts.templeIn ?? 1.8;
    const outer: Pt[] = [];
    const cy = yT + 0.42 * h;
    const rx = wTop + v * 0.75;
    const ry = 0.42 * h + v;
    const N = opts.bump ? 15 : 7;
    for (let i = 0; i <= N; i++) {
      const a = Math.PI + (i / N) * Math.PI; // left → over the top → right
      const bump = opts.bump ? (i % 2 ? opts.bump : -opts.bump * 0.35) : 0;
      outer.push([50 + Math.cos(a) * (rx + bump), cy + Math.sin(a) * (ry + bump)]);
    }
    const fr = opts.fringe ?? 0;
    const pts: Pt[] = [
      [50 - wC - 0.6, yE + sideburn],
      ...outer.slice(1, -1),
      [50 + wC + 0.6, yE + sideburn],
      [50 + wC - 1.4, yE + sideburn - 1.2],
      [50 + wTop - ti, yT + 0.3 * h],
      [50 + wTop * 0.55, hairlineY + 0.03 * h - (part > 0 ? 0 : fr)],
      [50 + part, hairlineY - 0.02 * h + fr * 0.5],
      [50 - wTop * 0.55, hairlineY + 0.03 * h - (part > 0 ? fr : 0)],
      [50 - wTop + ti, yT + 0.3 * h],
      [50 - wC + 1.4, yE + sideburn - 1.2],
    ];
    return blob(pts);
  };

  const part = r.range(-6, 6);
  switch (f.style) {
    case 'bald': {
      if (f.age >= 1 && r.chance(0.7)) {
        for (const side of [-1, 1]) {
          const p: Pt[] = [
            [50 + side * (wTop - 0.6), yT + 0.3 * h],
            [50 + side * (wTop + 1.3), yT + 0.36 * h],
            [50 + side * (wC + 1.2), yE + 0.5],
            [50 + side * (wC - 1), yE - 0.5],
            [50 + side * (wTop - 1.4), yT + 0.36 * h],
          ];
          L.front += F(blob(p), c, 'opacity=".9"');
        }
      }
      L.front += `<path d="M${n(50 - wTop * 0.55)} ${n(yT + 0.1 * h)}Q${n(50 - wTop * 0.2)} ${n(yT + 1.2)} ${n(50 + 2)} ${n(yT + 1.4)}" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".18"${s === -1 ? ' transform="matrix(-1 0 0 1 100 0)"' : ''}/>`;
      break;
    }
    case 'buzz':
      L.front = F(cap(0.9, yT + 0.2 * h, 0, -1.5, { templeIn: 2.2 }), c, 'opacity=".92"') + sheen(0.9);
      break;
    case 'short':
      L.front = F(cap(3, yT + 0.19 * h, part, -1, { fringe: 1.5 }), c) + sheen(3);
      break;
    case 'swept':
      L.front =
        F(cap(4.6, yT + 0.15 * h, part * 0.5, -1.5), c) +
        `<path d="M${n(50 - wTop * 0.5)} ${n(yT + 0.1 * h)}Q50 ${n(yT - 3)} ${n(50 + wTop * 0.6)} ${n(yT + 0.08 * h)}M${n(50 - wTop * 0.2)} ${n(yT + 0.13 * h)}Q${n(52)} ${n(yT)} ${n(50 + wTop * 0.75)} ${n(yT + 0.16 * h)}" fill="none" stroke="${shadowCol}" stroke-width=".9" opacity=".6"/>` +
        sheen(4.6);
      break;
    case 'receding':
      L.front = F(cap(1.8, yT + 0.1 * h, 0, -1.5, { templeIn: 5.5 }), c, 'opacity=".95"') + sheen(1.8);
      break;
    case 'curly':
      if (f.fem) {
        L.back = F(
          blob([[50 - wTop - 6, yT + 0.3 * h], [50 - wTop - 3, yT - 3], [50, yT - 7], [50 + wTop + 3, yT - 3], [50 + wTop + 6, yT + 0.3 * h], [50 + wC + 7, yE + 0.25 * h], [50 + wC + 4, yB + 2], [50, yB - 4], [50 - wC - 4, yB + 2], [50 - wC - 7, yE + 0.25 * h]]),
          c,
        );
        L.front = F(cap(5, yT + 0.22 * h, part, 2, { bump: 1.6 }), c) + sheen(4);
      } else {
        L.front = F(cap(3.4, yT + 0.2 * h, 0, -1.5, { bump: 1.3 }), c) + sheen(3);
      }
      break;
    case 'afro':
      L.front = F(cap(9.5, yT + 0.2 * h, 0, 0.5, { bump: 1.4, templeIn: 1.4 }), c) + sheen(9);
      break;
    case 'long':
    case 'locs': {
      const len = r.range(84, 96);
      const spread = r.range(6, 9);
      L.back = F(
        blob([
          [50 - wTop - 3, yT + 0.25 * h], [50 - wTop * 0.6, yT - 3.5], [50, yT - 4.5], [50 + wTop * 0.6, yT - 3.5], [50 + wTop + 3, yT + 0.25 * h],
          [50 + wC + spread * 0.6, yE + 0.3 * h], [50 + wC + spread, len], [50, len - 6], [50 - wC - spread, len], [50 - wC - spread * 0.6, yE + 0.3 * h],
        ]),
        c,
      );
      L.front = F(cap(3.2, yT + 0.17 * h, part * 0.3, 0.32 * h, { templeIn: 1.2 }), c) + sheen(3.2);
      // locks falling in front of the shoulders
      for (const side of [-1, 1]) {
        const lk: Pt[] = [
          [50 + side * (wC + 0.2), yE + 0.15 * h],
          [50 + side * (wC + 3.8), yE + 0.2 * h],
          [50 + side * (wC + spread + 1.5), len - 2],
          [50 + side * (wC + spread - 3.5), len + 1],
          [50 + side * (wC - 0.6), yB],
        ];
        L.locks += F(blob(lk), c);
      }
      if (f.style === 'locs') {
        let lines = '';
        for (let i = -3; i <= 3; i++) {
          const x = 50 + i * ((wC + spread) / 3.4);
          lines += `M${n(x)} ${n(yE + 0.25 * h)}L${n(x + i * 0.8)} ${n(len - 4)}`;
        }
        L.back += `<path d="${lines}" stroke="${shadowCol}" stroke-width="1.2" opacity=".6"/>`;
        L.locks += `<path d="M${n(50 - wC - 2)} ${n(yE + 0.3 * h)}L${n(50 - wC - spread + 1)} ${n(len - 3)}M${n(50 + wC + 2)} ${n(yE + 0.3 * h)}L${n(50 + wC + spread - 1)} ${n(len - 3)}" stroke="${shadowCol}" stroke-width="1.1" opacity=".6"/>`;
      } else {
        L.locks += `<path d="M${n(50 - wC - 2.5)} ${n(yE + 0.35 * h)}Q${n(50 - wC - spread)} ${n(len - 14)} ${n(50 - wC - spread + 2)} ${n(len - 3)}" fill="none" stroke="${sheenCol}" stroke-width="1" opacity=".35"/>`;
      }
      break;
    }
    case 'bob': {
      const end = yE + r.range(0.36, 0.46) * h;
      L.back = F(
        blob([[50 - wTop - 3.5, yT + 0.25 * h], [50 - wTop * 0.6, yT - 3.8], [50, yT - 4.8], [50 + wTop * 0.6, yT - 3.8], [50 + wTop + 3.5, yT + 0.25 * h], [50 + wC + 5, end - 3], [50 + wC + 3, end + 1], [50, end - 1], [50 - wC - 3, end + 1], [50 - wC - 5, end - 3]]),
        c,
      );
      const bangs = r.chance(0.45);
      L.front =
        F(cap(3.6, bangs ? yT + 0.3 * h : yT + 0.17 * h, bangs ? 0 : part, 0.36 * h, { templeIn: 1, fringe: bangs ? 0 : 3 }), c) + sheen(3.6);
      break;
    }
    case 'bun':
      L.back = `<circle cx="${n(50 + part * 0.3)}" cy="${n(yT - 3.2)}" r="${n(r.range(6, 7.5))}" fill="${c}"/>` +
        `<path d="M${n(44 + part * 0.3)} ${n(yT - 2)}q6 3 12 0" fill="none" stroke="${shadowCol}" stroke-width="1" opacity=".7"/>`;
      L.front = F(cap(1.6, yT + 0.17 * h, part * 0.4, -0.5, { templeIn: 1.4 }), c) + sheen(1.6);
      break;
    case 'pixie':
      L.front = F(cap(3.4, yT + 0.24 * h, part > 0 ? 5 : -5, 0, { fringe: 4.5, templeIn: 1.2 }), c) + sheen(3.4);
      break;
  }
  return L;
}

// ---------------------------------------------------------------- wardrobe

interface Outfit {
  body: string; // torso & clothes
  collarOverNeck?: boolean;
}

function torsoPath(f: Face, yS: number, sw: number, drop: number): string {
  const nw = f.nw;
  const bw = Math.min(sw + 1.5, 33.5); // bottom half-width stays inside the frame's rounded corners
  return (
    `M${n(50 - nw - 1.5)} ${n(yS - 1.5)}` +
    `C${n(50 - nw - 7)} ${n(yS)} ${n(50 - sw + 9)} ${n(yS + 0.5)} ${n(50 - sw + 2)} ${n(yS + drop)}` +
    `C${n(50 - sw - 1)} ${n(yS + drop + 2.5)} ${n(50 - bw)} ${n(yS + drop + 8)} ${n(50 - bw)} 104` +
    `H${n(50 + bw)}` +
    `C${n(50 + bw)} ${n(yS + drop + 8)} ${n(50 + sw + 1)} ${n(yS + drop + 2.5)} ${n(50 + sw - 2)} ${n(yS + drop)}` +
    `C${n(50 + sw - 9)} ${n(yS + 0.5)} ${n(50 + nw + 7)} ${n(yS)} ${n(50 + nw + 1.5)} ${n(yS - 1.5)}Z`
  );
}

/** Body-side shading (shadow side of the torso). */
function torsoShade(f: Face, sw: number, yS: number, drop: number): string {
  const s = f.s;
  const bw = Math.min(sw + 1.5, 33.5);
  const d = `M${n(50 + sw - 2)} ${n(yS + drop)}C${n(50 + sw + 1)} ${n(yS + drop + 2.5)} ${n(50 + bw)} ${n(yS + drop + 8)} ${n(50 + bw)} 104H${n(50 + bw - 6)}C${n(50 + bw - 5)} ${n(yS + drop + 10)} ${n(50 + sw - 5)} ${n(yS + drop + 4)} ${n(50 + sw - 2)} ${n(yS + drop)}Z`;
  const g = F(d, '#000', 'opacity=".22"');
  const hl = `<path d="M${n(50 - sw + 9)} ${n(yS + 1.2)}Q${n(50 - sw + 3)} ${n(yS + 2.5)} ${n(50 - sw + 0.5)} ${n(yS + drop + 1.5)}" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".14"/>`;
  // backlight traced along the exact right-hand torso outline (first stretch near the neck skipped via dash)
  const nw = f.nw;
  const rimLine = `<path d="M${n(50 + nw + 1.5)} ${n(yS - 1.5)}C${n(50 + nw + 7)} ${n(yS)} ${n(50 + sw - 9)} ${n(yS + 0.5)} ${n(50 + sw - 2)} ${n(yS + drop)}C${n(50 + sw + 1)} ${n(yS + drop + 2.5)} ${n(50 + bw)} ${n(yS + drop + 8)} ${n(50 + bw)} 104" fill="none" stroke="${f.rim}" stroke-width="1.5" stroke-dasharray="0 ${n(sw - nw - 6)} 200 0" opacity=".6"/>`;
  return s === 1 ? g + hl + rimLine : mirror(g + hl + rimLine);
}

function suit(f: Face, yS: number, jacket: string, shirt: string, opts: { tie?: string; pin?: string; crew?: boolean; collar?: boolean; vDepth?: number }): string {
  const nw = f.nw;
  const sw = f.fem ? 32 : 35;
  const drop = f.fem ? 6 : 7;
  const yV = yS + (opts.vDepth ?? 19);
  let out = F(torsoPath(f, yS, sw, drop), jacket) + torsoShade(f, sw, yS, drop);
  // shirt V
  out += F(poly([[50 - nw - 2.5, yS - 1.5], [50 + nw + 2.5, yS - 1.5], [50, yV]]), shirt);
  if (opts.crew) {
    out += `<path d="M${n(50 - nw - 1)} ${n(yS - 1.6)}Q50 ${n(yS + 5.5)} ${n(50 + nw + 1)} ${n(yS - 1.6)}" fill="none" stroke="${darken(shirt, 0.18)}" stroke-width="1.6"/>`;
  }
  if (opts.collar !== false && !opts.crew) {
    const cl = lighten(shirt, 0.25);
    for (const side of [-1, 1]) {
      out += F(poly([[50 + side * (nw + 0.8), yS - 4.8], [50 + side * 0.6, yS + 3.6], [50 + side * (nw + 3), yS + 3.4]]), cl, `stroke="${darken(shirt, 0.2)}" stroke-width=".5" stroke-linejoin="round"`);
    }
  }
  if (opts.tie) {
    out += F(poly([[48, yS + 2.4], [52, yS + 2.4], [51.4, yS + 5.2], [48.6, yS + 5.2]]), darken(opts.tie, 0.15));
    out += F(poly([[48.6, yS + 5.2], [51.4, yS + 5.2], [53.2, yV - 2], [50, yV + 2.5], [46.8, yV - 2]]), opts.tie);
    out += `<path d="M49 ${n(yS + 8)}l2.6 2.2M48.6 ${n(yS + 12)}l3 2.4" stroke="${lighten(opts.tie, 0.25)}" stroke-width=".7" opacity=".5"/>`;
  }
  // lapels
  const lap = mix(jacket, '#ffffff', 0.07);
  const edge = darken(jacket, 0.45);
  for (const side of [-1, 1] as const) {
    const pts: Pt[] = [
      [50 + side * (nw + 2.5), yS - 2.2],
      [50 + side * 0.4, yV + 0.5],
      [50 + side * 7, yS + 13],
      [50 + side * 13.5, yS + 8.5],
      [50 + side * 11.5, yS + 6.2],
      [50 + side * 14.5, yS + 4.2],
      [50 + side * (nw + 5.5), yS - 0.8],
    ];
    out += F(poly(pts), lap, `stroke="${edge}" stroke-width=".7" stroke-linejoin="round"`);
  }
  if (opts.pin) {
    out += `<circle cx="${n(50 - 16)}" cy="${n(yS + 11.5)}" r="1.9" fill="${opts.pin}" stroke="#e8c169" stroke-width=".7"/>`;
  }
  return out;
}

function outfit(f: Face, role: PortraitRole, hue: number, r: Rng): string {
  const yS = f.yB + (f.fem ? 7.5 : 8.5);
  const nw = f.nw;
  const flag = hsl(hue, 0.6, 0.5);
  switch (role) {
    case 'leader': {
      const jacket = r.pick(['#1b2235', '#22252b', '#263046', '#1c2a39', '#2e2a2a']);
      if (f.fem) {
        const blouse = r.pick(['#ece7df', '#d9e2ee', hsl(hue, 0.25, 0.82), '#f4efe6']);
        let o = suit(f, yS, r.chance(0.3) ? hsl(hue, 0.35, 0.25) : jacket, blouse, { pin: flag, collar: false, vDepth: 15 });
        if (r.chance(0.6)) o += `<path d="M${n(50 - nw + 0.6)} ${n(yS - 1)}Q50 ${n(yS + 5.2)} ${n(50 + nw - 0.6)} ${n(yS - 1)}" fill="none" stroke="#e3c47a" stroke-width=".9"/><circle cx="50" cy="${n(yS + 3.4)}" r="1.1" fill="#f1dca0"/>`;
        return o;
      }
      return suit(f, yS, jacket, r.pick(['#eef1f5', '#dfe8f3', '#f2efe8']), { tie: r.pick([hsl(hue, 0.55, 0.38), '#7d1f2a', '#24365e', hsl(hue + 180, 0.4, 0.36)]), pin: flag });
    }
    case 'rival': {
      const dark = r.pick(['#14161c', '#191c23', '#22252d']);
      if (r.chance(0.55)) {
        // high-collared tunic
        const sw = f.fem ? 32 : 35;
        let o = F(torsoPath(f, yS, sw, 7), dark) + torsoShade(f, sw, yS, 7);
        o += F(`M${n(50 - nw - 2.4)} ${n(yS + 1)}V${n(yS - 6)}Q50 ${n(yS - 4)} ${n(50 + nw + 2.4)} ${n(yS - 6)}V${n(yS + 1)}Q50 ${n(yS + 3)} ${n(50 - nw - 2.4)} ${n(yS + 1)}Z`, lighten(dark, 0.08), `stroke="${darken(dark, 0.5)}" stroke-width=".6"`);
        o += `<path d="M50 ${n(yS + 2)}V104" stroke="${darken(dark, 0.6)}" stroke-width="1"/>`;
        for (let i = 0; i < 3; i++) o += `<circle cx="51.6" cy="${n(yS + 6 + i * 6)}" r=".9" fill="#c9a45a"/>`;
        // ribbon bars
        const bars = [hsl(hue, 0.6, 0.45), '#c9a45a', hsl(hue + 30, 0.5, 0.35), '#8e9aae'];
        for (let i = 0; i < 4; i++) o += `<rect x="${n(31 + (i % 2) * 4.4)}" y="${n(yS + 9 + Math.floor(i / 2) * 2.6)}" width="4" height="2.1" fill="${bars[i]}"/>`;
        return o;
      }
      return suit(f, yS, dark, '#2a2e36', { tie: r.pick(['#0e0f12', hsl(hue, 0.5, 0.25)]), pin: f.fem ? flag : undefined });
    }
    case 'ceo': {
      if (r.chance(0.5)) {
        const tn = r.pick(['#141519', '#23262c', '#3a3e46', '#e6e1d6', hsl(hue, 0.2, 0.25)]);
        const sw = f.fem ? 32 : 35;
        let o = F(torsoPath(f, yS, sw, 6.5), tn) + torsoShade(f, sw, yS, 6.5);
        const top = f.yB + 2.5;
        o += F(`M${n(50 - nw - 2.2)} ${n(yS + 1.5)}V${n(top + 2)}Q50 ${n(top + 4.5)} ${n(50 + nw + 2.2)} ${n(top + 2)}V${n(yS + 1.5)}Q50 ${n(yS + 4)} ${n(50 - nw - 2.2)} ${n(yS + 1.5)}Z`, lighten(tn, 0.07));
        o += `<path d="M${n(50 - nw - 2)} ${n(top + 4.6)}Q50 ${n(top + 7)} ${n(50 + nw + 2)} ${n(top + 4.6)}M${n(50 - nw - 2)} ${n(top + 7.4)}Q50 ${n(top + 9.8)} ${n(50 + nw + 2)} ${n(top + 7.4)}" fill="none" stroke="${darken(tn, 0.35)}" stroke-width=".7" opacity=".8"/>`;
        return o;
      }
      const blazer = r.pick(['#2b2f38', '#3a3f4a', '#4a3f35', hsl(hue, 0.25, 0.28)]);
      return suit(f, yS, blazer, r.pick(['#e9e9e6', '#16171b', '#c9ced6']), { crew: true, collar: false, vDepth: 17 });
    }
    default: {
      // advisor: shirt (+ maybe sweater) and a lanyard badge
      const shirt = r.pick(['#c9d6e6', '#e3e6ea', '#a9bcd0', '#d8cdbb', '#e8dcdc']);
      const sw = f.fem ? 32 : 35;
      const sweater = r.chance(0.42) ? r.pick(['#3b4a5e', '#56483c', '#2f3d36', '#4a3a4f', '#6b6f78']) : null;
      let o = F(torsoPath(f, yS, sw, 7), sweater ?? shirt) + torsoShade(f, sw, yS, 7);
      if (sweater) {
        o += F(poly([[50 - nw - 2.5, yS - 1.5], [50 + nw + 2.5, yS - 1.5], [50, yS + 14]]), shirt);
        o += `<path d="M${n(50 - nw - 3)} ${n(yS - 1.2)}L50 ${n(yS + 14.6)}L${n(50 + nw + 3)} ${n(yS - 1.2)}" fill="none" stroke="${lighten(sweater, 0.15)}" stroke-width="1.6"/>`;
      } else {
        o += `<path d="M50 ${n(yS + 4)}V104" stroke="${darken(shirt, 0.2)}" stroke-width=".8"/>`;
        o += `<circle cx="50.9" cy="${n(yS + 9)}" r=".7" fill="${darken(shirt, 0.3)}"/><circle cx="50.9" cy="${n(yS + 16)}" r=".7" fill="${darken(shirt, 0.3)}"/>`;
      }
      // open collar showing the throat
      o += F(poly([[50 - nw + 0.4, yS - 1.6], [50 + nw - 0.4, yS - 1.6], [50, yS + 4.6]]), f.skin);
      o += F(poly([[50 - nw + 0.4, yS - 1.6], [50 + nw - 0.4, yS - 1.6], [50, yS + 1.2]]), f.shade, 'opacity=".5"');
      const cl = lighten(shirt, 0.3);
      for (const side of [-1, 1]) {
        o += F(poly([[50 + side * (nw + 0.6), yS - 5], [50 + side * 0.3, yS + 4.8], [50 + side * (nw + 4.2), yS + 3.6]]), cl, `stroke="${darken(shirt, 0.25)}" stroke-width=".55" stroke-linejoin="round"`);
      }
      // lanyard + badge
      const lc = hsl(hue, 0.6, 0.5);
      const bx = r.range(-4, 4);
      o += `<path d="M${n(50 - nw - 1.8)} ${n(yS - 1)}L${n(48 + bx)} 92M${n(50 + nw + 1.8)} ${n(yS - 1)}L${n(52 + bx)} 92" stroke="${lc}" stroke-width="1.5" fill="none"/>`;
      o += `<rect x="${n(44.5 + bx)}" y="91" width="11" height="12" rx="1.2" fill="#e9eef4"/><rect x="${n(44.5 + bx)}" y="91" width="11" height="2.6" rx="1" fill="${lc}"/><rect x="${n(46.2 + bx)}" y="95" width="3.6" height="4" fill="#9aa6b8"/>`;
      return o;
    }
  }
}

// ---------------------------------------------------------------- backdrop

function backdrop(role: PortraitRole, hue: number, f: Face, r: Rng): { bg: string; rim: string } {
  let bg = '';
  let rim = '#bfe9ff';
  const rect = (fill: string, extra = '') => `<rect width="100" height="100" rx="12" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
  switch (role) {
    case 'leader': {
      // the national flag hanging behind, softly lit
      bg += rect(hsl(hue, 0.38, 0.19));
      const tilt = r.range(-8, 8);
      bg += `<path d="M-5 ${n(18 + tilt)}L105 ${n(46 - tilt)}V${n(62 - tilt)}L-5 ${n(34 + tilt)}Z" fill="${hsl(hue, 0.5, 0.36)}" opacity=".7"/>`;
      bg += `<path d="M-5 ${n(38 + tilt)}L105 ${n(66 - tilt)}V${n(71 - tilt)}L-5 ${n(43 + tilt)}Z" fill="#fff" opacity=".1"/>`;
      for (let i = 0; i < 5; i++) bg += `<rect x="${8 + i * 20}" y="0" width="9" height="100" fill="#000" opacity=".07"/>`;
      bg += `<circle cx="${50 - f.s * 14}" cy="34" r="34" fill="#fff" opacity=".06"/>`;
      rim = lighten(hsl(hue, 0.5, 0.6), 0.3);
      break;
    }
    case 'ceo': {
      bg += rect(hsl(hue, 0.3, 0.15));
      let lines = '';
      for (let i = -100; i < 200; i += 9) lines += `M${i} 0L${i + 100} 100`;
      bg += `<path d="${lines}" stroke="${hsl(hue, 0.6, 0.6)}" stroke-width=".5" opacity=".1"/>`;
      bg += `<circle cx="${50 - f.s * 12}" cy="36" r="36" fill="${hsl(hue, 0.5, 0.5)}" opacity=".12"/>`;
      rim = lighten(hsl(hue, 0.6, 0.6), 0.25);
      break;
    }
    case 'rival': {
      bg += rect('#0b0d13');
      bg += `<circle cx="${50 + f.s * 6}" cy="40" r="33" fill="${hsl(hue, 0.65, 0.35)}" opacity=".3"/>`;
      bg += `<circle cx="${50 + f.s * 6}" cy="40" r="22" fill="${hsl(hue, 0.7, 0.4)}" opacity=".18"/>`;
      for (let i = 0; i < 10; i++) bg += `<rect x="0" y="${i * 10 + 4}" width="100" height="1.2" fill="#000" opacity=".25"/>`;
      rim = hsl(hue, 0.85, 0.62);
      break;
    }
    default: {
      bg += rect('#141c2b');
      bg += `<circle cx="${50 - f.s * 10}" cy="38" r="38" fill="#2a3a58" opacity=".55"/>`;
      let grid = '';
      for (let i = 10; i < 100; i += 10) grid += `M${i} 0V100M0 ${i}H100`;
      bg += `<path d="${grid}" stroke="#7fc8ff" stroke-width=".4" opacity=".07"/>`;
      rim = '#9fdcff';
    }
  }
  return { bg, rim };
}

// ---------------------------------------------------------------- assembly

const cache = new Map<string, string>();

export function portrait(seed: number, opts: PortraitOpts = {}): string {
  const size = opts.size ?? 96;
  const role: PortraitRole = opts.role ?? 'advisor';
  const hue = opts.hue ?? ((seed * 137.5) % 360 + 360) % 360;
  const key = `${seed}|${role}|${Math.round(hue)}`;
  let inner = cache.get(key);
  if (!inner) {
    const f = makeFace(seed, role);
    const wr = new Rng((seed | 0) ^ hashString(role));
    const { bg, rim } = backdrop(role, hue, f, wr);
    f.rim = rim;
    const hr = new Rng((seed | 0) + 0x51ed);
    const hair = hairLayers(f, hr);
    const neckTop = f.yE + 0.22 * f.h;
    const neckBot = f.yB + 12;
    const neck =
      F(`M${n(50 - f.nw)} ${n(neckTop)}V${n(neckBot)}H${n(50 + f.nw)}V${n(neckTop)}Z`, f.skin) +
      F(`M${n(50 - f.nw)} ${n(f.yB - 6)}Q50 ${n(f.yB + 9)} ${n(50 + f.nw)} ${n(f.yB - 6)}V${n(f.yB + 3)}Q50 ${n(f.yB + 7)} ${n(50 - f.nw)} ${n(f.yB + 3)}Z`, f.shade, 'opacity=".7"') +
      (f.s === 1
        ? F(`M${n(50 + f.nw * 0.35)} ${n(neckTop)}H${n(50 + f.nw)}V${n(neckBot)}H${n(50 + f.nw * 0.2)}Z`, f.shade, 'opacity=".5"')
        : F(`M${n(50 - f.nw * 0.35)} ${n(neckTop)}H${n(50 - f.nw)}V${n(neckBot)}H${n(50 - f.nw * 0.2)}Z`, f.shade, 'opacity=".5"'));
    inner =
      bg +
      `<g transform="translate(50 74) scale(1.12) translate(-50 -74)">` +
      hair.back +
      neck +
      outfit(f, role, hue, wr) +
      hair.locks +
      head(f, role) +
      features(f, role) +
      facialHair(f) +
      hair.front +
      glasses(f) +
      `</g>` +
      // vignette + frame edge
      `<rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="5"/>` +
      `<rect x=".5" y=".5" width="99" height="99" rx="11.5" fill="none" stroke="#fff" stroke-opacity=".08"/>`;
    if (cache.size > 400) cache.clear();
    cache.set(key, inner);
  }
  return svgRoot(size, size, '0 0 100 100', inner, 'aria-hidden="true"');
}
