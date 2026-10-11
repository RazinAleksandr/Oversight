/**
 * Title screen: logo over the animated background, atmospheric tagline, main menu.
 */
import type { JSX } from 'preact';
import { LANGS, getLang, locale, t } from '../../i18n';
import { Icon, Svg, artCached, isPlaceholder } from '../components/Icon';
import { RiskClock } from '../components/RiskClock';
import { switchLang } from '../lang';
import { cx, dailySeed } from '../util';

export function Logo(): JSX.Element {
  // The art module drops the tagline below 420px, which keeps the logo legible on phones.
  const svg = artCached.logo2(typeof window !== 'undefined' && window.innerWidth < 520 ? 400 : 560);
  if (!isPlaceholder(svg)) return <Svg class="logo" html={svg} label="Oversight" />;
  return (
    <h1 class="logo logo--type" aria-label="Oversight">
      <span class="logo__over">Over</span>
      <span class="logo__sight">sight</span>
    </h1>
  );
}

/** Compact EN | RU switch in the title screen corner. Switching saves the choice and reloads. */
function LangToggle(): JSX.Element {
  const cur = getLang();
  return (
    <div class="langtoggle" role="group" aria-label={t('Language')}>
      {LANGS.map((l) => (
        <button
          type="button"
          key={l.id}
          lang={l.id}
          class={cx('langtoggle__opt', l.id === cur && 'is-on')}
          aria-pressed={l.id === cur}
          aria-label={l.name}
          title={l.name}
          onClick={() => l.id !== cur && switchLang(l.id)}
        >
          {l.id.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function TitleScreen({
  hasSave,
  mock,
  onContinue,
  onNew,
  onDaily,
  onHowTo,
  onSettings,
}: {
  hasSave: boolean;
  mock: boolean;
  onContinue(): void;
  onNew(): void;
  onDaily(): void;
  onHowTo(): void;
  onSettings(): void;
}): JSX.Element {
  // ru «11.10.2026» stays on one line next to the seed («11 окт. 2026 г.» would wrap).
  const today = new Date().toLocaleDateString(locale(), getLang() === 'en' ? { month: 'short', day: 'numeric', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
  return (
    <div class="screen title">
      <div class="title__clock" aria-hidden="true">
        <RiskClock risk={{ estimate: 12, low: 6, high: 22, clock: '23:07' }} size={520} />
      </div>
      <div class="title__corner title__corner--tl" aria-hidden="true">
        {t('DEPT. OF AI · EYES ONLY')}
      </div>
      <div class="title__corner title__corner--tr num" aria-hidden="true">
        2027 · {t('Q{q}', { q: 1 })} · 23:07
      </div>
      <LangToggle />
      <main class="title__inner">
        <Logo />
        <p class="title__tagline">
          {t('Sixteen quarters. One department.')}
          <br />
          {t('The most important technology in history is on your desk.')}
        </p>
        <nav class="title__menu" aria-label={t('Main menu')}>
          {hasSave && (
            <button type="button" class="btn btn--primary btn--xl" onClick={onContinue} data-autofocus>
              <Icon name="play" size={18} /> {t('Continue')}
            </button>
          )}
          <button type="button" class={cx('btn btn--xl', !hasSave && 'btn--primary')} onClick={onNew}>
            <Icon name="flag" size={18} /> {t('New Game')}
          </button>
          <button type="button" class="btn btn--xl" onClick={onDaily}>
            <Icon name="dice" size={18} /> {t('Daily Run')}
            <span class="btn__sub num">
              {today} · #{dailySeed()}
            </span>
          </button>
          <div class="title__row">
            <button type="button" class="btn" onClick={onHowTo}>
              <Icon name="help" size={17} /> {t('How to Play')}
            </button>
            <button type="button" class="btn" onClick={onSettings}>
              <Icon name="settings" size={17} /> {t('Settings')}
            </button>
          </div>
        </nav>
      </main>
      <footer class="title__foot">
        {t('A strategy thriller about governing the AI transition · All countries and companies are fictional')}
        {mock && <span class="title__mock">{t('Mock data')}</span>}
      </footer>
    </div>
  );
}
