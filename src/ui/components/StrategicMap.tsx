/** A political map of the four fictional powers. All live overlays must come from fogged views. */
import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import type { CountryId } from '../../engine/types';
import { COUNTRIES, COUNTRY_ORDER } from '../../content/countries';
import { atlasBase, MAP_ANCHORS } from '../../art/map';
import { t } from '../../i18n';
import { cx } from '../util';
import { Svg, artCached } from './Icon';

export interface StrategicMapCountry {
 id:CountryId; name?:string; shortName?:string; color?:string;
 trust?:number; accordMember?:boolean; attention?:number;
}
export interface StrategicMapProps {
 player?:CountryId; selected?:CountryId; onSelect?:(id:CountryId)=>void;
 compact?:boolean; countries?:StrategicMapCountry[]; label?:string; accordSigned?:boolean;
}
export function StrategicMap({player,selected,onSelect,compact=false,countries,label,accordSigned=false}:StrategicMapProps):JSX.Element {
 const art=useMemo(()=>atlasBase(player,selected),[player,selected]);
 const entries=COUNTRY_ORDER.map(id=>({...COUNTRIES[id],...countries?.find(c=>c.id===id)}));
 const members=accordSigned?entries.filter(c=>c.accordMember):[];
 const links:JSX.Element[]=[];
 for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
  const a=MAP_ANCHORS[members[i].id],b=MAP_ANCHORS[members[j].id];
  links.push(<path key={`${members[i].id}-${members[j].id}`} d={`M${a[0]},${a[1]} Q${(a[0]+b[0])/2},${Math.min(a[1],b[1])-55} ${b[0]},${b[1]}`}/>);
 }
 return <div class={cx('strategic-map',compact && 'strategic-map--compact',!onSelect && 'strategic-map--still')} role="group" aria-label={label??t('World map')} data-strategic-map>
  <div class="strategic-map__geography" dangerouslySetInnerHTML={{__html:art}}/>
  {links.length>0 && <svg class="strategic-map__links" viewBox="0 0 1000 460" preserveAspectRatio="none" aria-hidden="true">{links}</svg>}
  {entries.map(c=>{
   const [x,y]=MAP_ANCHORS[c.id];
   const attrs={class:cx('strategic-map__country',player===c.id && 'is-player',selected===c.id && 'is-selected'),style:{left:`${x/10}%`,top:`${y/4.6}%`,'--country-color':c.color},'data-country-select':c.id};
   const content=<><Svg class="strategic-map__crest" html={artCached.emblem(c.id,40)}/><span class="strategic-map__name">{c.shortName}</span>{player===c.id && <span class="strategic-map__you">{t('You')}</span>}{!!c.attention && <span class="strategic-map__attention" aria-label={t('{n} pending',{n:c.attention})}>{c.attention}</span>}{c.accordMember && <span class="strategic-map__member" title={t('Accord supporter')}>◆</span>}</>;
   return onSelect?<button key={c.id} type="button" {...attrs} data-rival-select={c.id!==player?c.id:undefined} aria-label={c.name} aria-pressed={selected===c.id} onClick={()=>onSelect(c.id)}>{content}</button>:<span key={c.id} {...attrs}>{content}</span>;
  })}
 </div>;
}
