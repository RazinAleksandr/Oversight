/** The opening frame of the political thriller. Local procedural map; no launch network dependency. */
import type { JSX } from 'preact';
import { LANGS, getLang, locale, t } from '../../i18n';
import { Icon, Svg, artCached } from '../components/Icon';
import { switchLang } from '../lang';
import { cx, dailySeed } from '../util';
export function Logo(): JSX.Element { return <h1 class="logo-v4">OVERSIGHT</h1>; }
export function TitleScreen({hasSave,mock,onContinue,onDebrief,onNew,onDaily,onHowTo,onSettings}: {
  hasSave:boolean;mock:boolean;onContinue():void;onDebrief?():void;onNew():void;onDaily():void;onHowTo():void;onSettings():void;
}):JSX.Element {
  const today=new Date().toLocaleDateString(locale(),{day:'numeric',month:'short'});
  return <div class="screen title title-v4">
    <div class="title-map" aria-hidden="true"><Svg html={artCached.map('commonwealth',1000)}/></div>
    <header class="title-top"><span>{t('A strategy thriller')}</span><div class="langtoggle" role="group" aria-label={t('Language')}>{LANGS.map(l=><button type="button" key={l.id} lang={l.id} class={cx('langtoggle__opt',getLang()===l.id&&'is-on')} aria-label={l.name} aria-pressed={getLang()===l.id} onClick={()=>l.id!==getLang()&&switchLang(l.id)}>{l.id.toUpperCase()}</button>)}</div></header>
    <main class="title-composition"><section class="title-story"><div class="title-symbol" aria-hidden="true"><Icon name="eye" size={40}/><span>16</span></div><Logo/><p class="title-premise">{t('Sixteen quarters. One department.')}</p><p class="title-description">{t('The most important technology in history is on your desk.')}</p></section>
    <nav class="title-commands" aria-label={t('Main menu')}>
      {hasSave&&<button type="button" class="title-play" onClick={onContinue} data-autofocus><span>{t('Continue')}</span><Icon name="chevron_right" size={22}/></button>}
      <button type="button" class={cx(!hasSave&&'title-play')} onClick={onNew}><span>{t('New Game')}</span><Icon name="chevron_right" size={20}/></button>
      <button type="button" onClick={onDaily}><span>{t('Daily Run')}<small>{today} · #{dailySeed()}</small></span><Icon name="dice" size={18}/></button>
      {onDebrief&&<button type="button" onClick={onDebrief}><span>{t('Last debrief')}</span><Icon name="chevron_right" size={18}/></button>}
      <div class="title-utilities"><button type="button" onClick={onHowTo}>{t('How to Play')}</button><button type="button" onClick={onSettings}>{t('Settings')}</button></div>
    </nav></main>
    <footer class="title-bottom"><span>{t('All countries and companies are fictional.')}</span>{mock&&<span>{t('Mock data')}</span>}</footer>
  </div>;
}
