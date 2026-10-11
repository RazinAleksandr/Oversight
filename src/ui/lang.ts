/**
 * Language choice (see docs/I18N.md). Stored under its own key, not in the engine Settings.
 * The language is fixed for the page lifetime: switching saves the choice and reloads.
 * `?lang=ru|en` in the URL overrides the saved choice for that page load (QA, screenshots).
 */
import { type Lang, detectLang } from '../i18n';

export const LANG_KEY = 'ato.lang.v1';

function savedLang(): string | null {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

/** Language for this page load: URL override, else the saved choice, else the browser language. */
export function bootLang(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'en' || q === 'ru') return q;
  } catch {
    /* no window (tests) */
  }
  return detectLang(savedLang());
}

/** Saves the language and reloads the page (dropping a `?lang=` override so the saved choice wins). */
export function switchLang(l: Lang): void {
  let stored = false;
  try {
    localStorage.setItem(LANG_KEY, l);
    stored = localStorage.getItem(LANG_KEY) === l;
  } catch {
    /* storage unavailable (private mode): fall back to the URL override */
  }
  const url = new URL(window.location.href);
  if (stored) url.searchParams.delete('lang');
  else url.searchParams.set('lang', l);
  if (url.toString() === window.location.href) window.location.reload();
  else window.location.replace(url.toString());
}
