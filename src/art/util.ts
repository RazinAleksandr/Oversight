/** Shared helpers for SVG string building: number formatting, colors, smooth paths. */

/** Round to 2 decimals and drop trailing zeros → compact path data. */
export function n(v: number): string {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

export const XMLNS = 'http://www.w3.org/2000/svg';

/** Root <svg> wrapper. `w`/`h` are the rendered size; `vb` the viewBox. */
export function svgRoot(w: number, h: number, vb: string, inner: string, extra = ''): string {
  return `<svg xmlns="${XMLNS}" width="${n(w)}" height="${n(h)}" viewBox="${vb}"${extra ? ' ' + extra : ''}>${inner}</svg>`;
}

/** Escape text content for safe embedding in SVG markup. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------- colors

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [63, 208, 255];
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear mix of two hex colors, t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

export const lighten = (c: string, t: number) => mix(c, '#ffffff', t);
export const darken = (c: string, t: number) => mix(c, '#000000', t);

/** HSL (h 0–360, s/l 0–1) → hex */
export function hsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const k = (m: number) => (m + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (m: number) => l - a * Math.max(-1, Math.min(k(m) - 3, Math.min(9 - k(m), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/** Relative luminance 0–1 (for contrast decisions). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Hue (0–360) of a hex color. */
export function hueOf(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

// ---------------------------------------------------------------- geometry

export type Pt = [number, number];

/** Polar → cartesian; angle in degrees, 0 = up, clockwise (clock-face convention). */
export function polar(cx: number, cy: number, r: number, deg: number): Pt {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Polygon path from points. */
export function poly(pts: Pt[], close = true): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join('') + (close ? 'Z' : '');
}

/**
 * Smooth path through points using Catmull-Rom → cubic Bézier.
 * `tension` 0..1 (0.5 = classic). Closed paths wrap around.
 */
export function smooth(pts: Pt[], closed = true, tension = 0.5): string {
  const len = pts.length;
  if (len < 2) return '';
  const get = (i: number): Pt => {
    if (closed) return pts[((i % len) + len) % len];
    return pts[Math.max(0, Math.min(len - 1, i))];
  };
  let d = `M${n(pts[0][0])} ${n(pts[0][1])}`;
  const segs = closed ? len : len - 1;
  const k = tension / 3;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) * k * 2, p1[1] + (p2[1] - p0[1]) * k * 2];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) * k * 2, p2[1] - (p3[1] - p1[1]) * k * 2];
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}

/** Regular star / polygon path. Angles start at the top. */
export function starPath(cx: number, cy: number, outer: number, inner: number, points: number, rot = 0): string {
  const pts: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    pts.push(polar(cx, cy, i % 2 ? inner : outer, rot + (i * 180) / points));
  }
  return poly(pts);
}

/** Circle as path data (so many dots can share one <path>). */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;
}

/** Arc path along a circle between clock angles a0→a1 (degrees, clockwise). */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const sweep = ((a1 - a0) % 360 + 360) % 360;
  const large = sweep > 180 ? 1 : 0;
  return `M${n(x0)} ${n(y0)}A${n(r)} ${n(r)} 0 ${large} 1 ${n(x1)} ${n(y1)}`;
}

/** Gear outline polygon points (used by settings/sabotage icons and some logos). */
export function gearPoints(cx: number, cy: number, outer: number, root: number, teeth: number, topFrac = 0.42, rot = 0): Pt[] {
  const pts: Pt[] = [];
  const step = 360 / teeth;
  const top = step * topFrac * 0.5;
  const flank = step * 0.12;
  for (let i = 0; i < teeth; i++) {
    const a = rot + i * step;
    pts.push(polar(cx, cy, root, a - top - flank));
    pts.push(polar(cx, cy, outer, a - top));
    pts.push(polar(cx, cy, outer, a + top));
    pts.push(polar(cx, cy, root, a + top + flank));
    pts.push(polar(cx, cy, root, a + step / 2));
  }
  return pts;
}

/** Sutherland–Hodgman clip of a polygon by the half-plane a·x + b·y + c >= 0. */
export function clipHalfPlane(pts: Pt[], a: number, b: number, c: number): Pt[] {
  const out: Pt[] = [];
  const side = (p: Pt) => a * p[0] + b * p[1] + c;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/** Ray-casting point-in-polygon test. */
export function inPoly(x: number, y: number, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Rotate / translate a point set. */
export function transformPts(pts: Pt[], deg: number, ox: number, oy: number, dx = 0, dy = 0): Pt[] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map(([x, y]) => [ox + (x - ox) * c - (y - oy) * s + dx, oy + (x - ox) * s + (y - oy) * c + dy]);
}
