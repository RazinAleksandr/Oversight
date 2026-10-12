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
import './styles/fx.css';
import './styles/ui-dossier.css';
import './styles/ui-workspace.css';
import './styles/ui-pilot-inspector.css';
import './styles/ui-command-v4.css';
import './styles/ui-management-v4.css';
import './styles/ui-journey-v4.css';
import './styles/ui-decisions-v4.css';
import './styles/ui-atlas-v5.css';
import './styles/ui-dispatch-v5.css';
import './styles/ui-identity-v5.css';
import './styles/ui-national-v5.css';
import { getLang, loadLangPack, setLang } from './i18n';
import { bootLang } from './ui/lang';
import { initializeStorage } from './platform/storage';
import { t } from './i18n';

async function start(): Promise<void> {
  await initializeStorage();
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

void start().catch(() => {
  const root = document.getElementById('app')!;
  const message = document.createElement('p');
  message.textContent = t('Saved data could not be opened. Your files have been kept.');
  const retry = document.createElement('button');
  retry.className = 'btn btn--primary';
  retry.textContent = t('Retry');
  retry.onclick = () => window.location.reload();
  root.style.padding = 'max(24px, env(safe-area-inset-top)) 24px';
  root.replaceChildren(message, retry);
});
