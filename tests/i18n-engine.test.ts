/**
 * Engine localization: full games in Russian must play out exactly like the same seeds in English
 * (translation never touches the RNG or game logic), never throw, and produce Russian text.
 *
 * English runs first; then the ru pack is installed and content is localized in place (this mutates
 * the content modules, which is why it lives in its own test file — vitest isolates files).
 */
import { describe, expect, it } from 'vitest';
import { getLang, setLang, t } from '../src/i18n';
import pack from '../src/i18n/ru/index';
import engineDict from '../src/i18n/ru/engine';
import { contentErrors } from '../src/engine/events';
import { newGame, type Game } from '../src/engine/game';
import { localizeContent } from '../src/engine/localize';
import { sourceOf } from '../src/engine/source';
import { fmt } from '../src/engine/template';
import type { ActionId, Card, CountryId, Difficulty, ProgramId } from '../src/engine/types';

const COUNTRIES: CountryId[] = ['atlantic', 'hanzhou', 'commonwealth', 'meridian'];
const CYRILLIC = /[А-Яа-яЁё]/;
const PLACEHOLDER = /\{\w+(?::\w+)?\}/;

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────── Bots: decisions depend only on ids, numbers and order — never on display text ─────────────

type BotName = 'random' | 'approve' | 'reject' | 'careful';

function enabledIds(card: Card): string[] {
  const ids = card.choices.filter((c) => !c.disabled).map((c) => c.id);
  return ids.length ? ids : card.choices.map((c) => c.id);
}

function prefer(card: Card, order: string[]): string {
  const ids = enabledIds(card);
  return order.find((id) => ids.includes(id)) ?? ids[0];
}

function choose(bot: BotName, g: Game, card: Card, rnd: () => number): string {
  const ids = enabledIds(card);
  if (bot === 'random') return ids[Math.floor(rnd() * ids.length)];
  if (bot === 'approve') return prefer(card, ['approve', 'limited', 'comply', 'monitor', 'authorize', 'race', 'concede', 'sign', 'endorse', 'growth']);
  if (bot === 'reject') return prefer(card, ['reject', 'refuse', 'suspend', 'shutdown', 'investigate', 'contain', 'pause', 'international', 'sign', 'neutral', 'safety']);
  // careful: deep evaluations, investigations, safe tones, the Accord.
  const v = g.view();
  if (card.kind === 'deployment') {
    const m = v.models.find((x) => x.id === card.ctx.modelId);
    if (m && m.flaw !== 'unknown' && m.flaw !== 'none_found') return prefer(card, ['reject_evidence', 'reject']);
    return prefer(card, ['deep_eval', 'limited', 'approve']);
  }
  if (card.kind === 'situation') return prefer(card, ['investigate', 'suspend', 'restrict', 'taskforce', 'contain', 'monitor']);
  if (card.kind === 'threshold') return prefer(card, ['international', 'pause', 'join', 'authorize', 'race']);
  const safe = card.choices.find((c) => !c.disabled && c.tone === 'safe');
  return safe?.id ?? ids[0];
}

function act(bot: BotName, g: Game, rnd: () => number): void {
  const programs: ProgramId[] = ['safety', 'oversight', 'compute', 'workforce', 'defense'];
  if (bot === 'careful') {
    g.setProgramLevel('safety', 2);
    g.setProgramLevel('oversight', 1);
  } else if (rnd() < 0.3) {
    g.setProgramLevel(programs[Math.floor(rnd() * programs.length)], Math.floor(rnd() * 3));
  }
  const n = bot === 'careful' ? 2 : Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const actions = g.getActions().filter((a) => !a.disabled);
    if (!actions.length) break;
    const a = actions[Math.floor(rnd() * actions.length)];
    const targets = (a.targets ?? []).filter((x) => !x.disabled);
    if (a.targets && !targets.length) continue;
    const target = targets.length ? targets[Math.floor(rnd() * targets.length)].id : undefined;
    const options = (a.options ?? []).filter((o) => !o.disabled);
    const option = options.length ? options[Math.floor(rnd() * options.length)].id : undefined;
    g.performAction(a.id as ActionId, target, option);
  }
}

interface RunRecord {
  fingerprint: string;
  texts: { sys: string[]; content: string[]; other: string[] };
}

/** Plays a full game; returns a numeric fingerprint and every player-visible text it produced. */
function play(bot: BotName, countryId: CountryId, difficulty: Difficulty, seed: number): RunRecord {
  const g = newGame({ countryId, difficulty, seed });
  const rnd = mulberry(seed * 31 + 7);
  const texts: RunRecord['texts'] = { sys: [], content: [], other: [] };
  const trace: string[] = [];
  const seeCard = (c: Card) => {
    const bucket = c.templateId.startsWith('sys:') ? texts.sys : texts.content;
    bucket.push(c.title, c.body, ...c.choices.map((x) => x.label));
    texts.other.push(...(c.evidence ?? []).map((e) => e.label), ...(c.advisors ?? []).map((a) => a.text));
  };
  let guard = 0;
  while (!g.state.gameOver && guard++ < 40) {
    texts.other.push(...g.getActions().map((a) => a.name));
    act(bot, g, rnd);
    let inner = 0;
    while (g.state.inbox.length && !g.state.gameOver && inner++ < 20) {
      const v = g.view();
      const card = v.inbox[0];
      seeCard(card);
      let id = choose(bot, g, card, rnd);
      let r = g.resolveChoice(card.uid, id);
      if (!r.ok) {
        id = card.choices.find((c) => !c.disabled)?.id ?? card.choices[0].id;
        r = g.resolveChoice(card.uid, id);
        if (!r.ok) throw new Error(`stuck on card ${card.templateId}: ${r.error}`);
      }
      trace.push(`${g.state.turn}:${card.templateId}:${id}`);
      texts.other.push(r.text);
    }
    if (g.state.gameOver) break;
    const report = g.endTurn();
    texts.other.push(report.dateLabel, ...report.highlights.map((h) => h.text), ...report.warnings);
  }
  const s = g.state;
  if (!s.ending) throw new Error(`no ending (${bot}, ${countryId}, seed ${seed})`);
  texts.other.push(s.ending.title, ...s.ending.stats.map((x) => x.label), ...s.ending.missed, ...s.ending.decisiveMoments.map((m) => m.title));
  const v = g.view();
  texts.other.push(...v.log.map((l) => l.text), ...v.news.map((n) => n.text));
  const fingerprint = JSON.stringify({
    ending: s.ending.id,
    rating: s.ending.rating,
    scores: s.ending.scores,
    turn: s.turn,
    meters: s.meters,
    budget: s.budget,
    risk: s.risk,
    safeguards: s.safeguards,
    rng: s.rng,
    stats: s.stats,
    trace,
    decisive: s.ending.decisiveMoments.map((m) => m.turn),
  });
  return { fingerprint, texts };
}

const RUNS: { bot: BotName; country: CountryId; difficulty: Difficulty; seed: number }[] = [];
(['random', 'approve', 'reject', 'careful'] as BotName[]).forEach((bot, b) =>
  COUNTRIES.forEach((country, c) => {
    for (const seed of [11 + b * 100 + c, 503 + b * 7 + c * 13]) RUNS.push({ bot, country, difficulty: (['analyst', 'director', 'doomer'] as Difficulty[])[(b + c) % 3], seed });
  }),
);

describe('engine in Russian', () => {
  const english = new Map<string, string>();
  let englishErrors = 0;

  it('plays every run in English first (baseline)', () => {
    expect(getLang()).toBe('en');
    const before = contentErrors.length;
    for (const r of RUNS) english.set(`${r.bot}/${r.country}/${r.seed}`, play(r.bot, r.country, r.difficulty, r.seed).fingerprint);
    englishErrors = contentErrors.length - before;
    expect(english.size).toBe(RUNS.length);
  });

  it('installs the ru pack and localizes content', () => {
    setLang('ru', pack);
    localizeContent();
    expect(getLang()).toBe('ru');
    expect(t('Q{q} {year}', { q: 3, year: 2028 })).toBe('3 кв. 2028');
  });

  it('plays the same runs in Russian with identical outcomes and Russian text', () => {
    const before = contentErrors.length;
    let sysTexts = 0;
    let sysCyrillic = 0;
    let contentTexts = 0;
    let contentCyrillic = 0;
    const leftovers = new Set<string>();
    for (const r of RUNS) {
      const res = play(r.bot, r.country, r.difficulty, r.seed);
      expect(res.fingerprint, `${r.bot}/${r.country}/${r.seed}`).toBe(english.get(`${r.bot}/${r.country}/${r.seed}`));
      for (const x of res.texts.sys) {
        sysTexts++;
        if (CYRILLIC.test(x)) sysCyrillic++;
        if (PLACEHOLDER.test(x)) leftovers.add(x);
      }
      for (const x of res.texts.content) {
        contentTexts++;
        if (CYRILLIC.test(x)) contentCyrillic++;
      }
      for (const x of res.texts.other) if (PLACEHOLDER.test(x)) leftovers.add(x);
    }
    // Translation must never make content functions fail where English did not.
    expect(contentErrors.length - before).toBe(englishErrors);
    // Content dictionaries are being translated in parallel: report, don't fail.
    console.info(
      `[i18n] system cards: ${sysCyrillic}/${sysTexts} texts in Russian; scripted cards: ${contentCyrillic}/${contentTexts}; ` +
        `texts with unresolved {tokens}: ${leftovers.size}${leftovers.size ? ` e.g. ${[...leftovers].slice(0, 3).join(' | ')}` : ''}`,
    );
    const engineComplete = Object.values(engineDict).every((v) => v !== '');
    if (engineComplete) {
      // Engine-built cards are fully covered by the engine dictionary (names inside are Latin brands).
      expect(sysCyrillic / sysTexts).toBeGreaterThan(0.95);
    }
  });

  it('keeps logic on the English source of translated content', () => {
    // A translated content string maps back to its English source; untranslated strings map to themselves.
    expect(sourceOf('not a content string')).toBe('not a content string');
    expect(sourceOf(t('Q{q}', { q: 1 }))).toBe(t('Q{q}', { q: 1 }));
  });

  it('formats tokens: case forms and capitalized sentence starts', () => {
    expect(fmt('Итак. {who} прибыл.', { who: 'д-р Рао' })).toBe('Итак. Д-р Рао прибыл.');
    expect(fmt('«{who}» — сказал {who}.', { who: 'д-р Рао' })).toBe('«Д-р Рао» — сказал д-р Рао.');
    expect(fmt('— {who} молчит.\n— {who}?', { who: 'ген. Ли' })).toBe('— Ген. Ли молчит.\n— Ген. Ли?');
    expect(fmt('Доклад: {x}', { x: 'итог' })).toBe('Доклад: итог');
    expect(fmt('{x:gen} нет', { x: 'нечто' })).toBe('Нечто нет');
  });
});
