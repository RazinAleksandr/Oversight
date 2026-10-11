/**
 * English source of localized content strings (see docs/I18N.md §1).
 *
 * Content objects are translated in place at boot, but a few engine rules read content *text*
 * (headline filters, red-team finding keywords, "never repeat a line" hashes, debrief keywords).
 * Those rules must see the English source so a run plays out identically in every language:
 * `sourceOf(translated)` returns the English string it came from (identity for anything else).
 * `localizeContent()` registers the pairs; the registry stays empty in English.
 */

const toSource = new Map<string, string>();

/** Records `translated → english` pairs (the first source wins if two strings share a translation). */
export function registerSources(english: readonly string[], translated: readonly string[]): void {
  const n = Math.min(english.length, translated.length);
  for (let i = 0; i < n; i++) {
    const en = english[i];
    const tr = translated[i];
    if (en !== tr && !toSource.has(tr)) toSource.set(tr, en);
  }
}

/** The English source of a (possibly translated) content string. */
export function sourceOf(text: string): string {
  return toSource.get(text) ?? text;
}
