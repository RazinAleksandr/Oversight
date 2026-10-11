/**
 * Localization core (Director-owned contract, see docs/I18N.md).
 *
 * Keys are the English source strings themselves (gettext style): `t('Quarterly income')`.
 * English needs no dictionary; other languages are lazy-loaded chunks of { english: translated }.
 *
 *  - t(src, params?)         translate + interpolate `{name}` params.
 *  - tp(n, one, other, p?)   plural; key is `${one}|${other}`, ru value has 3 forms "1|2-4|5+".
 *  - tr(src)                 translate only (no interpolation) — for content templates that the
 *                            engine resolves itself (fillTemplate keeps `{token}` / `{token:case}`).
 *  - formOf(value, form)     Russian grammatical case of a (translated) token value, e.g. a
 *                            country name in the genitive. Falls back to the value itself.
 *
 * The language is fixed for the page lifetime: switching it saves the setting and reloads, so
 * module-level content objects can be localized in place exactly once (localizeContent).
 */

export type Lang = 'en' | 'ru';
export const LANGS: { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'ru', name: 'Русский' },
];

/**
 * Russian forms used by `{token:form}` in templates. Plain `{token}` is the value as displayed in UI
 * (e.g. "Бизнес"); `nom` is the nominative as used mid-sentence (e.g. lowercase "бизнес").
 */
export type CaseForm = 'nom' | 'gen' | 'dat' | 'acc' | 'ins' | 'prep';
export type FormsTable = Record<string, Partial<Record<CaseForm, string>>>;

export interface LangPack {
  /** Engine + UI + art strings (keys from t()/tp()/tr() calls). */
  dict: Record<string, string>;
  /** Content strings (keys extracted from src/content and engine data by scripts/i18n.ts). */
  content: Record<string, string>;
  forms: FormsTable;
}

let lang: Lang = 'en';
let dict: Record<string, string> = {};
let content: Record<string, string> = {};
let forms: FormsTable = {};

export function getLang(): Lang {
  return lang;
}

/** Installs a language pack. Call once at boot, before any engine/content text is produced. */
export function setLang(l: Lang, pack?: LangPack): void {
  lang = l;
  dict = l === 'en' || !pack ? {} : pack.dict;
  content = l === 'en' || !pack ? {} : pack.content;
  forms = l === 'en' || !pack ? {} : pack.forms;
}

export function tr(src: string): string {
  if (lang === 'en' || !src) return src;
  const v = dict[src] || content[src];
  return v === undefined || v === '' ? src : v;
}

function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)(?::(\w+))?\}/g, (whole, key: string, form?: string) => {
    const v = params[key];
    if (v === undefined) return whole;
    return form ? formOf(String(v), form as CaseForm) : String(v);
  });
}

export function t(src: string, params?: Record<string, string | number>): string {
  return interpolate(tr(src), params);
}

/** Russian plural category for n: 0 → "1", 1 → "2–4", 2 → "5+/11–14/0". */
export function ruPluralIndex(n: number): 0 | 1 | 2 {
  const a = Math.abs(n);
  if (!Number.isInteger(a)) return 1;
  const m10 = a % 10;
  const m100 = a % 100;
  if (m10 === 1 && m100 !== 11) return 0;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 1;
  return 2;
}

/**
 * Plural: tp(n, '{n} action', '{n} actions'). `{n}` is always available as a param.
 * The ru dictionary value for key "{n} action|{n} actions" is "{n} действие|{n} действия|{n} действий".
 */
export function tp(n: number, one: string, other: string, params?: Record<string, string | number>): string {
  const p = { n, ...params };
  if (lang === 'en') return interpolate(n === 1 ? one : other, p);
  const v = dict[`${one}|${other}`] || content[`${one}|${other}`];
  if (!v) return interpolate(n === 1 ? one : other, p);
  const parts = v.split('|');
  const pick = parts[Math.min(ruPluralIndex(n), parts.length - 1)];
  return interpolate(pick, p);
}

export function formOf(value: string, form: CaseForm): string {
  if (lang === 'en') return value;
  return forms[value]?.[form] ?? value;
}

/** Joins "A, B and C" in the current language. */
export function listJoinL(items: string[]): string {
  const and = lang === 'ru' ? ' и ' : ' and ';
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]}${and}${items[1]}`;
  return `${items.slice(0, -1).join(', ')}${and}${items[items.length - 1]}`;
}

/** Locale tag for Intl / toLocaleString. */
export function locale(): string {
  return lang === 'ru' ? 'ru-RU' : 'en-US';
}

/**
 * Translates every string inside `root` (objects/arrays, recursively, in place) that has a
 * *content* dictionary entry. Functions are skipped. Safe to call on content modules: ids and
 * flags are never content keys (the extractor only collects display text).
 */
export function localizeInPlace(root: unknown): void {
  if (lang === 'en') return;
  const seen = new Set<unknown>();
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const v = node[i];
        if (typeof v === 'string') {
          const x = content[v];
          if (x) node[i] = x;
        } else walk(v);
      }
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === 'string') {
        const x = content[v];
        if (x) obj[k] = x;
      } else if (typeof v === 'object') walk(v);
    }
  };
  walk(root);
}

/** Loads the pack for `l` (lazy chunk). English has no pack. */
export async function loadLangPack(l: Lang): Promise<LangPack | undefined> {
  if (l === 'ru') return (await import('./ru/index')).default;
  return undefined;
}

/** Initial language: saved setting, else the browser language. */
export function detectLang(saved?: string | null): Lang {
  if (saved === 'en' || saved === 'ru') return saved;
  try {
    const nav = (navigator.languages?.[0] ?? navigator.language ?? 'en').toLowerCase();
    if (nav.startsWith('ru') || nav.startsWith('uk') || nav.startsWith('be') || nav.startsWith('kk')) return 'ru';
  } catch {
    /* no navigator (tests) */
  }
  return 'en';
}
