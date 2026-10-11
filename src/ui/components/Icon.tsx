/**
 * Thin wrappers around the art module (SVG strings). Results are cached so re-renders never rebuild markup.
 * While the art module is still a stub (no icon names), a minimal glyph fallback keeps the UI readable.
 */
import type { JSX } from 'preact';
import { art } from '../../art';
import { cx } from '../util';

const cache = new Map<string, string>();
function cached(key: string, make: () => string): string {
  let v = cache.get(key);
  if (v === undefined) {
    try {
      v = make();
    } catch {
      v = '';
    }
    cache.set(key, v);
  }
  return v;
}

/**
 * True when an art string is a stub placeholder (the art module ships assets incrementally).
 * Real assets are far richer than the 24×24 stub box, so a size + shape check is reliable.
 */
export function isPlaceholder(svg: string): boolean {
  if (!svg) return true;
  return svg.length < 420 && (/<rect x="3" y="3" width="18" height="18" rx="4"/.test(svg) || />OVERSIGHT</.test(svg));
}

const GLYPHS: Record<string, string> = {
  confidence: '★', economy: '$', stability: '⚖', security: '◆', risk: '◔', clock: '◷',
  budget: '$', income: '+', capacity: '◆', evidence: '⎘', safeguards: '⛨', capability: '▲',
  adoption: '▣', displacement: '⇣', tension: '⌁', accord: '✦', business: '▤', public: '⌂',
  infrastructure: '⚡', defense: '⚔', frontier: '▲', bigtech: '▦', opensource: '◎',
  safety: '⛨', oversight: '◉', compute: '▦', workforce: '⚒', policy: '§', investigate: '⌕',
  audit: '✓', inbox: '✉', labs: '⚗', nation: '⚑', world: '◍', threats: '⚠',
  company: '▦', government: '♕', foreign: '◍', intelligence: '◉', public_voice: '❝', ai: '⬡',
  advisor: '☺', media: '☷', settings: '⚙', sound: '♪', sound_off: '✕', music: '♫',
  close: '✕', back: '‹', info: 'i', warning: '!', check: '✓', cross: '✕', arrow_up: '▲',
  arrow_down: '▼', chevron_right: '›', chevron_left: '‹', play: '▶', refresh: '↻',
  calendar: '▤', news: '☷', star: '★', flag: '⚑', target: '◎', eye: '◉', eye_off: '◌',
  question: '?', skull: '☠', sun: '☀', trophy: '★', menu: '≡', help: '?', dice: '⚄',
  agents: '⬡', deception: '◐', blackout: '⚡', manipulation: '❝', cyber: '⌁', bio: '☣',
  missile: '➶', escape: '↗', spillover: '≋', respond: '⚒', diplomacy: '✦', espionage: '◉',
};

export function Icon({ name, size = 18, class: cls }: { name: string; size?: number; class?: string }): JSX.Element {
  const svg = cached(`i:${name}:${size}`, () => art.icon(name, size));
  if (isPlaceholder(svg)) {
    return (
      <span
        class={cx('icon icon--glyph', cls)}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.82) }}
        aria-hidden="true"
      >
        {GLYPHS[name] ?? '•'}
      </span>
    );
  }
  return (
    <span
      class={cx('icon', cls)}
      style={{ width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Generic inline SVG from an art string. `label` makes it an accessible image, otherwise it is decorative. */
export function Svg({ html, class: cls, label }: { html: string; class?: string; label?: string }): JSX.Element {
  return (
    <span
      class={cx('svg', cls)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const artCached = {
  emblem: (id: Parameters<typeof art.countryEmblem>[0], size: number) =>
    cached(`e:${id}:${size}`, () => art.countryEmblem(id, size)),
  logo: (seed: number, color: string, arch: Parameters<typeof art.companyLogo>[2], size: number) =>
    cached(`l:${seed}:${color}:${arch}:${size}`, () => art.companyLogo(seed, color, arch, size)),
  portrait: (seed: number, role: 'leader' | 'advisor' | 'ceo' | 'rival', size: number, hue?: number) =>
    cached(`p:${seed}:${role}:${size}:${hue ?? ''}`, () => art.portrait(seed, { size, role, hue })),
  logo2: (width: number) => cached(`g:${width}`, () => art.gameLogo(width)),
  ending: (tone: Parameters<typeof art.endingArt>[0], width: number) => cached(`n:${tone}:${width}`, () => art.endingArt(tone, width)),
  map: (player: Parameters<typeof art.worldMap>[0], width: number) => cached(`m:${player}:${width}`, () => art.worldMap(player, width)),
};

/** Initials avatar used as a graceful fallback while the art module is a stub. */
export function Portrait({ seed, role, size, name, hue }: { seed: number; role: 'leader' | 'advisor' | 'ceo' | 'rival'; size: number; name: string; hue?: number }): JSX.Element {
  const svg = artCached.portrait(seed, role, size, hue);
  if (isPlaceholder(svg)) {
    const initials = name
      .split(/\s+/)
      .filter((w) => /^\p{Lu}/u.test(w))
      .slice(0, 2)
      .map((w) => w[0])
      .join('');
    return (
      <span class={cx('portrait portrait--fallback', `portrait--${role}`)} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
        {initials || '?'}
      </span>
    );
  }
  return (
    <span class={cx('svg portrait', `portrait--${role}`)} style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
