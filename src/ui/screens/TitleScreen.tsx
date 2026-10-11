/**
 * Title screen: logo over the animated background, atmospheric tagline, main menu.
 */
import type { JSX } from 'preact';
import { Icon, Svg, artCached, isPlaceholder } from '../components/Icon';
import { RiskClock } from '../components/RiskClock';
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
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div class="screen title">
      <div class="title__clock" aria-hidden="true">
        <RiskClock risk={{ estimate: 12, low: 6, high: 22, clock: '23:07' }} size={520} />
      </div>
      <div class="title__corner title__corner--tl" aria-hidden="true">
        DEPT. OF AI · EYES ONLY
      </div>
      <div class="title__corner title__corner--tr num" aria-hidden="true">
        2027 · Q1 · 23:07
      </div>
      <main class="title__inner">
        <Logo />
        <p class="title__tagline">
          Sixteen quarters. One department.
          <br />
          The most important technology in history is on your desk.
        </p>
        <nav class="title__menu" aria-label="Main menu">
          {hasSave && (
            <button type="button" class="btn btn--primary btn--xl" onClick={onContinue} data-autofocus>
              <Icon name="play" size={18} /> Continue
            </button>
          )}
          <button type="button" class={cx('btn btn--xl', !hasSave && 'btn--primary')} onClick={onNew}>
            <Icon name="flag" size={18} /> New Game
          </button>
          <button type="button" class="btn btn--xl" onClick={onDaily}>
            <Icon name="dice" size={18} /> Daily Run
            <span class="btn__sub num">
              {today} · #{dailySeed()}
            </span>
          </button>
          <div class="title__row">
            <button type="button" class="btn" onClick={onHowTo}>
              <Icon name="help" size={17} /> How to Play
            </button>
            <button type="button" class="btn" onClick={onSettings}>
              <Icon name="settings" size={17} /> Settings
            </button>
          </div>
        </nav>
      </main>
      <footer class="title__foot">
        A strategy thriller about governing the AI transition · All countries and companies are fictional
        {mock && <span class="title__mock">Mock data</span>}
      </footer>
    </div>
  );
}
