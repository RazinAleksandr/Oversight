/**
 * Bootstrap: installs the language before any other app module is evaluated (docs/I18N.md §1),
 * so module-level t() calls see the active language. The rest of the app lives in boot.tsx and is
 * imported dynamically afterwards. English needs no pack, so its path downloads nothing extra.
 * Styles are imported here (not in boot.tsx) so they start loading in parallel with the pack.
 */
import './styles/main.css';
import './styles/ui-game.css';
import './styles/ui-card.css';
import './styles/ui-screens.css';
import { getLang, loadLangPack, setLang } from './i18n';
import { bootLang } from './ui/lang';

async function start(): Promise<void> {
  const lang = bootLang();
  if (lang !== 'en') {
    try {
      const pack = await loadLangPack(lang);
      setLang(lang, pack);
      (await import('./engine/localize')).localizeContent();
    } catch (e) {
      // A missing/broken pack must never block the game: fall back to English.
      console.error('[i18n] language pack failed to load — falling back to English', e);
      setLang('en');
    }
  }
  document.documentElement.lang = getLang();
  await import('./boot');
}

void start();
