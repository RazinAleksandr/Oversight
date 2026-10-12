/** Select a country and inspect its strategic character before taking office. */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { CountryId, Difficulty } from '../../engine/types';
import { METER_INFO } from '../../engine/labels';
import { StrategicMap } from '../components/StrategicMap';
import { COUNTRY_ORDER } from '../../content/countries';
import { t } from '../../i18n';
import { Icon, Svg, artCached } from '../components/Icon';
import { countryCard } from '../countries';
import { DIFF_LABEL, cx, dailySeed } from '../util';
const DIFFICULTIES:{id:Difficulty;desc:string}[]=[{id:'analyst',desc:t('Clearer signals, gentler politics, slower risk.')},{id:'director',desc:t('The intended experience. Hard but fair.')},{id:'doomer',desc:t('Noisy evidence, relentless demands, faster risk.')}];
export function NewGameScreen({daily,onBack,onStart}:{daily:boolean;onBack():void;onStart(c:CountryId,d:Difficulty):void}):JSX.Element {
  const [country,setCountry]=useState<CountryId>('commonwealth');
  const [diff,setDiff]=useState<Difficulty>(daily?'director':'analyst');
  const chosen=countryCard(country);
  return <div class="screen newgame newgame-v4 newgame-v5">
    <header class="newgame-command"><button type="button" onClick={onBack} aria-label={t('Back to title')}><Icon name="back"/>{t('Back')}</button><h1>{t('Choose your nation')}</h1><span>{daily?t('Daily Run · seed #{seed}',{seed:dailySeed()}):t('New run')}</span></header>
    <main class="newgame-body"><section class="country-atlas"><StrategicMap compact selected={country} onSelect={setCountry}/><nav class="country-roster" role="radiogroup" aria-label={t('Country')}>{[...COUNTRY_ORDER].sort((a,b)=>Number(b==='commonwealth')-Number(a==='commonwealth')).map(id=>{const c=countryCard(id);return <button type="button" key={id} role="radio" aria-checked={country===id} data-country={id} class={cx(country===id&&'is-selected')} onClick={()=>setCountry(id)}><Svg html={artCached.emblem(id,42)}/><span><strong>{c.name}</strong><small>{c.tagline}</small></span></button>})}</nav></section>
    <section class="country-brief"><header><Svg html={artCached.emblem(country,70)}/><div><p>{t('Led by the {title}',{title:chosen.leaderTitle})}</p><h2>{chosen.name}</h2><p>{chosen.tagline}</p></div></header><div class="country-traits"><section><h3>{chosen.traitPlus.name}</h3><p>{chosen.traitPlus.text}</p><ul>{chosen.strengths.map(x=><li key={x}>{x}</li>)}</ul></section><section><h3>{chosen.traitMinus.name}</h3><p>{chosen.traitMinus.text}</p><ul>{chosen.weaknesses.map(x=><li key={x}>{x}</li>)}</ul></section></div><dl class="country-start">{(['confidence','economy','stability','security'] as const).map(id=><div key={id}><dt>{t(METER_INFO[id].short)}</dt><dd>{chosen.start[id]}</dd></div>)}</dl></section></main>
    <footer class="newgame-footer"><div class="newgame-difficulty"><span>{t('Difficulty')}</span><div role="radiogroup" aria-label={t('Difficulty')}>{DIFFICULTIES.map(d=><button type="button" key={d.id} role="radio" aria-checked={diff===d.id} disabled={daily&&d.id!=='director'} class={cx(diff===d.id&&'is-selected')} onClick={()=>setDiff(d.id)}>{DIFF_LABEL[d.id]}</button>)}</div><p>{daily?t('Daily runs are always played on Director, so everyone faces the same world.'):DIFFICULTIES.find(d=>d.id===diff)?.desc}</p></div><button type="button" class="btn btn--primary" onClick={()=>onStart(country,daily?'director':diff)}>{t('Take office — {country}',{country:chosen.shortName??chosen.name})}<Icon name="chevron_right"/></button></footer>
  </div>;
}
