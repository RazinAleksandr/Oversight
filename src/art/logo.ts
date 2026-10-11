/**
 * Title wordmark: a "neural iris" doomsday clock (red minute hand a breath from midnight) beside
 * OVERSIGHT. Text uses textLength so the layout holds even when Space Grotesk is unavailable.
 * The same iris doubles as the app icon (logoMark).
 */
import { t } from '../i18n';
import { uid } from './rng';
import { n, polar, svgRoot } from './util';

const CYAN = '#3fd0ff';
const RED = '#ff4d5e';
const FONT = `'Space Grotesk', 'Inter', 'Segoe UI', system-ui, sans-serif`;
const MONO = `'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace`;

function iris(cx: number, cy: number, id: (s: string) => string): string {
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    const [x0, y0] = polar(cx, cy, major ? 60 : 64, i * 6);
    const [x1, y1] = polar(cx, cy, 69, i * 6);
    if (i === 0) continue; // midnight gets the red marker
    ticks += `M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`;
  }
  let fibers = '';
  for (let i = 0; i < 72; i++) {
    const a = i * 5 + (i % 2) * 2;
    const [x0, y0] = polar(cx, cy, 24, a);
    const [x1, y1] = polar(cx, cy, i % 3 === 0 ? 52 : 46, a + 6);
    fibers += `M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`;
  }
  let nodes = '';
  for (let i = 0; i < 12; i++) {
    const [x, y] = polar(cx, cy, 52, i * 30 + 15);
    nodes += `<circle cx="${n(x)}" cy="${n(y)}" r="${i % 3 === 0 ? 2.6 : 1.6}" fill="${CYAN}" opacity="${i % 3 === 0 ? 0.9 : 0.55}"/>`;
  }
  const [hx, hy] = polar(cx, cy, 38, -4);
  const [mx2, my2] = polar(cx, cy, 58, -9);
  const [tx, ty] = polar(cx, cy, 58, 0);
  return (
    `<circle cx="${cx}" cy="${cy}" r="80" fill="url(#${id('halo')})"/>` +
    `<circle cx="${cx}" cy="${cy}" r="74" fill="#070b14" fill-opacity=".85" stroke="${CYAN}" stroke-width="3" filter="url(#${id('glow')})"/>` +
    `<circle cx="${cx}" cy="${cy}" r="74" fill="none" stroke="#bff0ff" stroke-width="1.2" opacity=".8"/>` +
    `<path d="${ticks}" stroke="${CYAN}" stroke-width="2" stroke-linecap="round" opacity=".75"/>` +
    `<circle cx="${cx}" cy="${cy}" r="52" fill="url(#${id('iris')})" stroke="${CYAN}" stroke-width="1" stroke-opacity=".45"/>` +
    `<path d="${fibers}" stroke="${CYAN}" stroke-width="1" opacity=".32"/>` +
    nodes +
    `<circle cx="${cx}" cy="${cy}" r="22" fill="#05080f" stroke="${CYAN}" stroke-width="2"/>` +
    `<circle cx="${cx}" cy="${cy}" r="9" fill="${CYAN}" opacity=".18"/>` +
    // midnight marker + "minutes to midnight" wedge
    `<path d="M${cx} ${cy}L${n(tx)} ${n(ty)}A58 58 0 0 0 ${n(mx2)} ${n(my2)}Z" fill="${RED}" opacity=".16"/>` +
    `<path d="M${cx - 6} ${cy - 76}h12l-6 9Z" fill="${RED}"/>` +
    // hands
    `<path d="M${cx} ${cy}L${n(hx)} ${n(hy)}" stroke="#e8f6ff" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M${cx} ${cy}L${n(mx2)} ${n(my2)}" stroke="${RED}" stroke-width="3.6" stroke-linecap="round" filter="url(#${id('redglow')})"/>` +
    `<path d="M${cx} ${cy}L${n(mx2)} ${n(my2)}" stroke="#ff8a95" stroke-width="1.2" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="5.5" fill="#e8f6ff"/><circle cx="${cx}" cy="${cy}" r="2.2" fill="${RED}"/>`
  );
}

export function gameLogo(width = 640): string {
  const ids: Record<string, string> = {};
  const id = (s: string) => (ids[s] ??= uid(`logo-${s}`));
  const compact = width < 420;
  const base = 124;
  // OVER in white, SIGHT in cyan: one <text> so tracking stays even across both halves.
  const word = (over: string, sight: string) =>
    `<text x="214" y="${base}" textLength="770" lengthAdjust="spacing" font-family="${FONT}" font-weight="700" font-size="96" fill="${over}">OVER<tspan fill="${sight}">SIGHT</tspan></text>`;
  const words = word(`url(#${id('text')})`, `url(#${id('cyanText')})`);
  const textOnly = word('#fff', '#fff');

  const defs =
    `<defs>` +
    `<linearGradient id="${id('text')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#dfe8f6"/><stop offset="1" stop-color="#9fb0cc"/></linearGradient>` +
    `<linearGradient id="${id('cyanText')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8f0ff"/><stop offset=".5" stop-color="${CYAN}"/><stop offset="1" stop-color="#1d8fc2"/></linearGradient>` +
    `<radialGradient id="${id('iris')}"><stop offset=".3" stop-color="#0d2a3d"/><stop offset=".85" stop-color="#0a1626"/><stop offset="1" stop-color="#123049"/></radialGradient>` +
    `<radialGradient id="${id('halo')}"><stop offset=".6" stop-color="${CYAN}" stop-opacity=".22"/><stop offset="1" stop-color="${CYAN}" stop-opacity="0"/></radialGradient>` +
    `<filter id="${id('glow')}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<filter id="${id('redglow')}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<filter id="${id('soft')}" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>` +
    `<clipPath id="${id('textClip')}">${textOnly}</clipPath>` +
    `<clipPath id="${id('slice')}"><rect x="600" y="70" width="400" height="5"/></clipPath>` +
    `<pattern id="${id('scan')}" width="8" height="4" patternUnits="userSpaceOnUse"><rect width="8" height="1.2" fill="#070b14" opacity=".26"/></pattern>` +
    `</defs>`;

  let hud = '';
  if (!compact) {
    let tk = '';
    for (let x = 210; x <= 984; x += 12) tk += `M${x} 146v${(x - 210) % 96 === 0 ? 7 : 3}`;
    hud =
      `<path d="M210 146H984" stroke="${CYAN}" stroke-width="1" opacity=".35"/>` +
      `<path d="${tk}" stroke="${CYAN}" stroke-width="1" opacity=".35"/>` +
      `<rect x="214" y="143.5" width="98" height="5" fill="${CYAN}" opacity=".9"/>` +
      `<text x="214" y="178" font-family="${MONO}" font-size="16" font-weight="600" letter-spacing="5" fill="#7f8ba3">${t('GOVERNMENT AI DEPARTMENT')}</text>` +
      `<text x="984" y="178" text-anchor="end" font-family="${MONO}" font-size="16" font-weight="600" letter-spacing="5" fill="#7f8ba3">${t('EYES ONLY')} <tspan fill="${RED}">●</tspan></text>`;
  }

  const inner =
    defs +
    iris(100, 100, id) +
    // soft cyan bloom behind the wordmark
    `<g filter="url(#${id('soft')})" opacity=".35">${word('#5aa9d6', CYAN)}</g>` +
    words +
    // CRT scanlines only inside the letters
    `<rect x="200" y="40" width="800" height="100" fill="url(#${id('scan')})" clip-path="url(#${id('textClip')})"/>` +
    // glitch slice: a red sliver of SIGHT knocked out of alignment, the oversight in the system
    (compact ? '' : `<g clip-path="url(#${id('slice')})" opacity=".6"><g transform="translate(7 0)">${word(RED, RED)}</g></g>`) +
    hud;
  return svgRoot(width, width / 5, '0 0 1000 200', inner, 'role="img" aria-label="Oversight"');
}

/** The iris alone on a rounded dark tile: the app icon / favicon (scripts/icons.ts writes public/icons). */
export function logoMark(size = 512): string {
  const ids: Record<string, string> = {};
  const id = (s: string) => (ids[s] ??= uid(`mark-${s}`));
  const defs =
    `<defs>` +
    `<radialGradient id="${id('bg')}" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#14213b"/><stop offset="1" stop-color="#070b14"/></radialGradient>` +
    `<radialGradient id="${id('iris')}"><stop offset=".3" stop-color="#0d2a3d"/><stop offset=".85" stop-color="#0a1626"/><stop offset="1" stop-color="#123049"/></radialGradient>` +
    `<radialGradient id="${id('halo')}"><stop offset=".6" stop-color="${CYAN}" stop-opacity=".22"/><stop offset="1" stop-color="${CYAN}" stop-opacity="0"/></radialGradient>` +
    `<filter id="${id('glow')}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<filter id="${id('redglow')}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `</defs>`;
  const inner =
    defs +
    `<rect width="512" height="512" rx="112" fill="url(#${id('bg')})"/>` +
    `<g transform="translate(256 256) scale(2.75) translate(-100 -100)">${iris(100, 100, id)}</g>`;
  return svgRoot(size, size, '0 0 512 512', inner, 'role="img" aria-label="Oversight"');
}
