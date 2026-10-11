// Small math / color / DOM helpers shared by the fx modules.

export type RGB = [number, number, number];

export const clamp = (v: number, lo = 0, hi = 1): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Piecewise-linear color ramp. Stops must be sorted by position. */
export function rampColor(stops: ReadonlyArray<readonly [number, RGB]>, t: number): RGB {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i];
    if (t <= p1) {
      const [p0, c0] = stops[i - 1];
      return mixRGB(c0, c1, (t - p0) / (p1 - p0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}

export const rgba = (c: RGB, a: number): string =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.round(clamp(a) * 1000) / 1000})`;

let colorProbe: CanvasRenderingContext2D | null = null;
const colorCache = new Map<string, RGB>();

/** Resolve any CSS color (hex, rgb(), named, `var(--token)`) to RGB. Falls back to the accent cyan. */
export function resolveColor(css: string | undefined, fallback: RGB = [63, 208, 255]): RGB {
  if (!css) return fallback;
  let value = css.trim();
  const v = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(value);
  if (v) {
    const fromRoot = typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue(v[1]).trim()
      : '';
    value = fromRoot || (v[2] ?? '').trim();
    if (!value) return fallback;
  }
  const cached = colorCache.get(value);
  if (cached) return cached;
  let out: RGB = fallback;
  const hex = /^#([0-9a-f]{3,8})$/i.exec(value);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
    out = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  } else {
    // Let the browser normalize named colors, hsl(), etc.
    try {
      colorProbe ??= document.createElement('canvas').getContext('2d');
      if (colorProbe) {
        colorProbe.fillStyle = '#000';
        colorProbe.fillStyle = value;
        const norm = String(colorProbe.fillStyle);
        const m = /^#([0-9a-f]{6})$/i.exec(norm) ?? null;
        if (m) out = [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
        else {
          const n = norm.match(/[\d.]+/g);
          if (n && n.length >= 3) out = [+n[0], +n[1], +n[2]];
        }
      }
    } catch { /* keep fallback */ }
  }
  colorCache.set(value, out);
  return out;
}

/** The shared overlay container (`#fx-layer` from index.html, or a fallback we create). */
export function fxLayer(): HTMLElement {
  let el = document.getElementById('fx-layer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fx-layer';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  return el;
}

/** Individual transform properties (`translate`, `rotate`, `scale`) compose with the element's own transform. */
export const supportsIndividualTransforms: boolean =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('translate', '1px 1px');

/** Build a WAAPI keyframe offset using `translate` when supported, otherwise `transform`. */
export function translateKF(x: number, y: number, extra = ''): Keyframe {
  return supportsIndividualTransforms
    ? { translate: `${x}px ${y}px` }
    : { transform: `translate(${x}px, ${y}px) ${extra}` };
}

export const canAnimate = (el: Element): boolean => typeof (el as HTMLElement).animate === 'function';
