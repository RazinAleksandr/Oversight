/**
 * Dev-only art gallery (not part of the build). Open http://localhost:5175/dev/art.html
 * Query: ?only=icons|emblems|logos|portraits|logo|scenes|map  (render a single section)
 *        &scale=2  (CSS zoom for close inspection)
 */
import { art } from '../src/art/index';
import { ICON_NAMES } from '../src/engine/labels';
import type { Archetype, CountryId } from '../src/engine/types';

const params = new URLSearchParams(location.search);
const only = params.get('only');
const scale = Number(params.get('scale') || 1);
if (scale !== 1) (document.body.style as any).zoom = String(scale);

const root = document.getElementById('root')!;
const show = (key: string) => !only || only.split(',').includes(key);

function section(title: string, html: string): void {
  root.insertAdjacentHTML('beforeend', `<h2>${title}</h2>${html}`);
}

const COUNTRIES: { id: CountryId; name: string; hue: number }[] = [
  { id: 'atlantic', name: 'Atlantic Federation', hue: 220 },
  { id: 'hanzhou', name: 'Hanzhou Republic', hue: 355 },
  { id: 'commonwealth', name: 'European Commonwealth', hue: 228 },
  { id: 'meridian', name: 'Meridian Republic', hue: 178 },
];

// ---------------------------------------------------------------- icons
if (show('icons')) {
  const filter = params.get('names');
  const names = filter ? filter.split(',') : art.iconNames();
  const all = art.iconNames();
  const missing = ICON_NAMES.filter((n) => !all.includes(n));
  const big = params.has('big');
  if (big) document.head.insertAdjacentHTML('beforeend', '<style>.icons{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))!important}</style>');
  const tile = (name: string) =>
    big
      ? `<div class="ic" title="${name}"><div class="sizes" style="height:100px">${art.icon(name, 20)}${art.icon(name, 96)}</div><div class="nm">${name}</div></div>`
      : `<div class="ic" title="${name}"><div class="sizes">${art.icon(name, 16)}${art.icon(name, 24)}${art.icon(name, 40)}</div><div class="nm">${name}</div></div>`;
  section(
    `Icons — ${names.length} (16 / 24 / 40px)${missing.length ? ' — MISSING: ' + missing.join(', ') : ''}`,
    `<div class="icons">${names.map(tile).join('')}${tile('__unknown__')}</div>`,
  );
  const sample = ['confidence', 'economy', 'stability', 'security', 'risk', 'evidence', 'safeguards', 'capability', 'tension', 'accord', 'killswitch', 'espionage', 'sabotage', 'bio', 'deception', 'manipulation', 'escape', 'ai', 'skull', 'trophy'];
  if (!big) section(
    'Icons on paper (#ece6d8) and in semantic colors',
    `<div class="paper"><div class="icons">${sample.map(tile).join('')}</div></div>
     <div class="row tint-row" style="margin-top:12px">${sample
       .map((n, i) => `<span style="color:${['#3fd0ff', '#3ee08f', '#ffb547', '#ff4d5e', '#a77bff', '#e8c169'][i % 6]}">${art.icon(n, 20)}</span>`)
       .join('')}</div>`,
  );
}

// ---------------------------------------------------------------- emblems
if (show('emblems')) {
  section(
    'Country emblems (160 / 64 / 32px)',
    `<div class="row">${COUNTRIES.map(
      (c) =>
        `<div class="card">${art.countryEmblem(c.id, 160)}<div class="row" style="align-items:center">${art.countryEmblem(c.id, 64)}${art.countryEmblem(c.id, 32)}</div><div class="cap">${c.name}</div></div>`,
    ).join('')}</div>`,
  );
}

// ---------------------------------------------------------------- company logos
if (show('logos')) {
  const companies: [string, string, Archetype][] = [
    ['Halcyon Labs', '#ff8a3d', 'frontier'],
    ['Lodestar Research', '#5ec8f2', 'frontier'],
    ['Quanta Mind', '#c58bff', 'frontier'],
    ['Nimbus Systems', '#4f8bff', 'bigtech'],
    ['Orchard', '#3ee08f', 'bigtech'],
    ['Tessera', '#ffd166', 'bigtech'],
    ['Bastion Dynamics', '#9fb4c8', 'defense'],
    ['Aegis Arms', '#ff5d5d', 'defense'],
    ['Vanguard Systems', '#c8a96a', 'defense'],
    ['Commons AI', '#7ee0c3', 'opensource'],
    ['OpenMeadow', '#a3e635', 'opensource'],
    ['Free Lattice', '#ff7ab6', 'opensource'],
  ];
  const seedOf = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
  section(
    'Company logos (96 / 40px) — 12 companies',
    `<div class="row">${companies
      .map(
        ([name, color, arch]) =>
          `<div class="card">${art.companyLogo(seedOf(name), color, arch, 96)}<div class="row" style="align-items:center">${art.companyLogo(seedOf(name), color, arch, 40)}</div><div class="cap">${name}<br>${arch}</div></div>`,
      )
      .join('')}</div>`,
  );
  const seedsParam = params.get('seeds');
  if (seedsParam) {
    const arch = (params.get('arch') || 'opensource') as Archetype;
    section(`Seeds ${seedsParam} (${arch})`, `<div class="row">${seedsParam.split(',').map((sd, i) => art.companyLogo(Number(sd), ['#ff8a3d', '#5ec8f2', '#c58bff', '#3ee08f', '#ffd166', '#ff5d5d'][i % 6], arch, 96)).join('')}</div>`);
  }
  const archs: Archetype[] = ['frontier', 'bigtech', 'defense', 'opensource'];
  section(
    'Logo variety — 8 seeds per archetype (80px)',
    archs
      .map(
        (arch, ai) =>
          `<div class="row" style="margin-bottom:8px">${Array.from({ length: 8 }, (_, i) =>
            art.companyLogo(1000 + i * 17 + ai, ['#ff8a3d', '#5ec8f2', '#c58bff', '#3ee08f', '#ffd166', '#ff5d5d', '#7ee0c3', '#4f8bff'][i], arch, 80),
          ).join('')}</div>`,
      )
      .join(''),
  );
}

// ---------------------------------------------------------------- portraits
if (show('portraits')) {
  const roles = ['leader', 'advisor', 'ceo', 'rival'] as const;
  let cards = '';
  for (let i = 0; i < 16; i++) {
    const role = roles[i % 4];
    const hue = role === 'leader' || role === 'rival' ? COUNTRIES[(i >> 2) % 4].hue : (i * 47) % 360;
    cards += `<div class="card">${art.portrait(101 + i * 7, { size: 120, role, hue })}<div class="row" style="align-items:center">${art.portrait(101 + i * 7, { size: 40, role, hue })}<span class="round">${art.portrait(101 + i * 7, { size: 40, role, hue })}</span></div><div class="cap">${role} #${101 + i * 7}</div></div>`;
  }
  if (params.has('big')) {
    const ps = (params.get('pseeds') || '101,108,115,122,129,136,143,150').split(',').map(Number);
    section('Portraits at 240px', `<div class="row">${ps.map((sd, i) => art.portrait(sd, { size: 240, role: roles[i % 4], hue: COUNTRIES[i % 4].hue })).join('')}</div>`);
  } else section('Portraits (120 / 40px, square + CSS-rounded)', `<div class="row">${cards}</div>`);
  section(
    'Portrait variety — 24 seeds at 64px',
    `<div class="row">${Array.from({ length: 24 }, (_, i) => art.portrait(500 + i * 13, { size: 64, role: roles[i % 4], hue: (i * 61) % 360 })).join('')}</div>`,
  );
}

// ---------------------------------------------------------------- game logo
if (show('logo')) {
  section(
    'Game logo (1000 / 500 / 260px)',
    `<div class="card" style="align-items:flex-start">${art.gameLogo(1000)}${art.gameLogo(500)}${art.gameLogo(260)}</div>`,
  );
}

// ---------------------------------------------------------------- endings
if (show('scenes')) {
  section(
    'Ending scenes (good / mixed / bad / neutral)',
    `<div class="scenes">${(['good', 'mixed', 'bad', 'neutral'] as const)
      .map((tone) => `<div class="card">${art.endingArt(tone, 640)}<div class="cap">${tone}</div></div>`)
      .join('')}</div>`,
  );
}

// ---------------------------------------------------------------- map
if (show('map')) {
  section(
    'World map — each player highlighted (last one recolored via CSS)',
    `<div class="maps">${COUNTRIES.map(
      (c, i) => `<div class="card ${i === 3 ? 'recolor' : ''}">${art.worldMap(c.id, 640)}<div class="cap">player: ${c.name}${i === 3 ? ' (CSS recolor demo)' : ''}</div></div>`,
    ).join('')}</div>`,
  );
}

// ---------------------------------------------------------------- strict XML validation (?validate)
if (params.has('validate')) {
  const samples: [string, string][] = [];
  for (const nm of art.iconNames()) samples.push([`icon:${nm}`, art.icon(nm, 24)]);
  for (const c of COUNTRIES) samples.push([`emblem:${c.id}`, art.countryEmblem(c.id, 64)], [`map:${c.id}`, art.worldMap(c.id, 640)]);
  for (let i = 0; i < 40; i++) for (const a of ['frontier', 'bigtech', 'defense', 'opensource'] as Archetype[]) samples.push([`logo:${i}:${a}`, art.companyLogo(i, '#5ec8f2', a, 48)]);
  for (let i = 0; i < 80; i++) for (const role of ['leader', 'advisor', 'ceo', 'rival'] as const) samples.push([`portrait:${i}:${role}`, art.portrait(i, { role, hue: i * 9 })]);
  samples.push(['gameLogo', art.gameLogo(800)], ['gameLogo:compact', art.gameLogo(300)]);
  for (const t of ['good', 'mixed', 'bad', 'neutral'] as const) samples.push([`ending:${t}`, art.endingArt(t, 960)]);
  const parser = new DOMParser();
  const failures = samples.filter(([, svg]) => parser.parseFromString(svg, 'image/svg+xml').querySelector('parsererror'));
  for (const [k] of failures) console.error('XML parse error in ' + k);
  root.insertAdjacentHTML('afterbegin', `<h2 id="validate">XML validation: ${samples.length - failures.length}/${samples.length} well-formed</h2>`);
}
