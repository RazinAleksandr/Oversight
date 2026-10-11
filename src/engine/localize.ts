/**
 * Localizes all static content and engine data in place for the active language (see docs/I18N.md).
 * Call exactly once at boot, after setLang() and before creating or loading a game.
 * Strings that live inside content functions (requires-reasons, h.log/h.news/h.meter/h.text) are
 * not reachable here; the engine translates those at their sinks with tr().
 */
import * as companies from '../content/companies';
import * as countries from '../content/countries';
import * as endings from '../content/endings';
import * as events from '../content/events/index';
import * as headlines from '../content/headlines';
import * as leaders from '../content/leaders';
import * as situations from '../content/situations';
import * as tips from '../content/tips';
import { getLang, localizeInPlace } from '../i18n';
import * as fallback from './data/fallback';
import * as policies from './data/policies';
import * as programs from './data/programs';
import * as situationData from './data/situations';
import * as stances from './data/stances';
import * as labels from './labels';
import { registerSources } from './source';

let done = false;

/** String leaves of `root` in the same walk order as `localizeInPlace` (objects/arrays, functions skipped). */
function collectStrings(root: unknown, out: string[]): void {
  const seen = new Set<unknown>();
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    const values = Array.isArray(node) ? node : Object.keys(node).map((k) => (node as Record<string, unknown>)[k]);
    for (const v of values) {
      if (typeof v === 'string') out.push(v);
      else if (typeof v === 'object') walk(v);
    }
  };
  walk(root);
}

export function localizeContent(): void {
  if (done || getLang() === 'en') return;
  done = true;
  const modules: object[] = [
    companies, countries, endings, events, headlines, leaders, situations, tips,
    fallback, policies, programs, situationData, stances, labels,
  ];
  for (const m of modules) {
    for (const v of Object.values(m)) {
      // Remember the English source of every translated string (engine rules read it, see source.ts).
      const english: string[] = [];
      collectStrings(v, english);
      localizeInPlace(v);
      const translated: string[] = [];
      collectStrings(v, translated);
      registerSources(english, translated);
    }
  }
}
