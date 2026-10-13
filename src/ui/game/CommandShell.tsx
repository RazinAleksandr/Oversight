/** Landscape command room: the quarter agenda and direct routes to its work. */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { StrategicMap } from '../components/StrategicMap';
import type { Card, MeterId, TabId } from '../../engine/types';
import { METER_INFO, SOURCE_INFO, turnYearQuarter } from '../../engine/labels';
import { t, tp } from '../../i18n';
import { Icon, Portrait, Svg, artCached } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { cx, money, hash } from '../util';
import { KIND_LABEL, EndQuarterButton, stripDeadline, cleanWarning } from './Inbox';
import { METER_ORDER } from './Hud';
import { useGame } from './context';

export function CommandBar({ onMenu, onStatus, onRisk, onHelp }: { onMenu(): void; onStatus(): void; onRisk(): void; onHelp?:()=>void }): JSX.Element {
  const { view } = useGame();
  const calendar=turnYearQuarter(view.turn);
  const critical = METER_ORDER.filter(id => view.meters[id].status === 'critical').length;
  return <header class="command-bar">
    <div class="command-date"><strong class="command-date-full">{view.dateLabel}</strong><strong class="command-date-compact" aria-label={view.dateLabel}><span>{t('Q{q}',{q:calendar.quarter})}</span><small>{calendar.year}</small></strong><span>{view.country.name}</span></div>
    <button type="button" class={cx('command-status', critical > 0 && 'is-critical')} onClick={onStatus} aria-label={t('National indicators')}>
      <Icon name={critical ? 'warning' : 'nation'} size={18}/><span>{t('Status')}</span>{critical > 0 && <b>{critical}</b>}
    </button>
    <div class="command-resources"><span data-hud="budget">{money(view.nation.budget)}</span><span data-hud="capacity" aria-label={tp(view.nation.capacity, '{n} action', '{n} actions')}><Icon name="capacity" size={15}/><span class="command-capacity-full">{tp(view.nation.capacity, '{n} action', '{n} actions')}</span><span class="command-capacity-compact" aria-hidden="true">{view.nation.capacity}</span></span></div>
    <button type="button" class="command-clock" onClick={onRisk} aria-label={t('Risk clock')}><Icon name="clock" size={18}/>{view.risk.clock}</button>
    {onHelp&&<button type="button" class="command-help" onClick={onHelp} aria-label={t('Advisor advice')}><Icon name="help" size={20}/></button>}
    <button type="button" class="command-menu" onClick={onMenu} aria-label={t('Menu and settings')}><Icon name="menu" size={21}/></button>
  </header>;
}

export function CommandNav({ tab, onTab }: { tab: TabId; onTab(tab:TabId):void }): JSX.Element {
  const { view, openNews } = useGame();
  const tabs: {id:TabId;label:string;icon:string}[] = [
    {id:'inbox',label:t('Agenda'),icon:'inbox'}, {id:'labs',label:t('Companies'),icon:'labs'},
    {id:'nation',label:t('Nation'),icon:'nation'}, {id:'threats',label:t('Threats'),icon:'threats'},
    {id:'world',label:t('World'),icon:'world'},
  ];
  return <nav class="command-nav" aria-label={t('Sections')}><div role="tablist">{tabs.filter(x=>view.unlockedTabs.includes(x.id)).map(x=><button key={x.id} type="button" role="tab" id={`tab-${x.id}`} aria-controls="main" aria-selected={tab===x.id} data-tab={x.id} class={cx(tab===x.id&&'is-active')} onClick={()=>onTab(x.id)}><Icon name={x.icon} size={21}/><span>{x.label}</span>{x.id==='inbox'&&view.inbox.length>0&&<b>{view.inbox.length}</b>}</button>)}</div><button type="button" class="command-news" onClick={openNews}><Icon name="news" size={20}/><span>{t('News')}</span></button></nav>;
}

function SourceMark({card}: {card:Card}):JSX.Element {
  const {view}=useGame();
  const company=card.source.type==='company'?view.companies.find(c=>c.id===card.source.id || c.id===card.ctx.companyId):undefined;
  if(company) return <Svg html={artCached.logo(hash(company.id),company.color,company.archetype,48)} />;
  const rival=card.source.type==='foreign'?view.rivals.find(c=>c.id===(card.source.id??card.ctx.rivalId)):undefined;
  if(rival) return <Svg html={artCached.emblem(rival.id,48)}/>;
  if(card.source.type==='government') return <Portrait seed={view.government.portraitSeed} role="leader" size={48} name={view.government.leaderName}/>;
  return <Icon name={SOURCE_INFO[card.source.type].icon} size={30}/>;
}

export function QuarterAgenda(): JSX.Element {
  const { view, openCard, openManagement } = useGame();
  const [watch, setWatch] = useState(false);
  const [focus, setFocus] = useState(view.country.id);
  const demands = view.government.demands.filter(d => d.status === 'active').sort((a,b) => a.deadlineTurn-b.deadlineTurn);
  const threats = view.situations.filter(s => !s.resolved).sort((a,b) => Number(b.escalationWarning)-Number(a.escalationWarning));
  const cards = [...view.inbox].sort((a,b) => ({critical:0,priority:1,routine:2}[a.urgency]-{critical:0,priority:1,routine:2}[b.urgency]));
  const countries = [{id:view.country.id,name:view.country.name,color:view.country.color,attention:threats.length}, ...view.rivals];
  const focused = countries.find(c => c.id === focus) ?? countries[0];
  const inspect = (tab:TabId, section?:string, target?:string) => { setWatch(false); openManagement(tab,section,target); };
  return <>
    <div class="quarter-agenda atlas-agenda" data-agenda>
      <section class="agenda-atlas">
        <header class="atlas-national-heading">
          <Svg html={artCached.emblem(view.country.id,42)}/>
          <div><strong>{view.country.name}</strong><span>{view.eraLabel} · {view.turn}/{view.maxTurns}</span></div>
          {view.unlockedTabs.includes('world') && <button type="button" onClick={() => openManagement('world','map')}><Icon name="world" size={18}/>{t('World map')}</button>}
        </header>
        <div class="atlas-national-indicators">{METER_ORDER.map(id => <div key={id} class={cx(view.meters[id].status==='critical'&&'is-critical')}><span>{METER_INFO[id].short}</span><strong>{Math.round(view.meters[id].value)}</strong><i style={{'--level':`${Math.max(0,Math.min(100,view.meters[id].value))}%`}}/></div>)}</div>
        <div class="agenda-map-stage"><StrategicMap player={view.country.id} selected={focus} countries={countries} accordSigned={view.nation.accord.signed} compact onSelect={id => {setFocus(id); if(id!==view.country.id && view.unlockedTabs.includes('world')) openManagement('world',undefined,id);}}/></div>
        <div class="atlas-focus-label"><span>{focused.name}</span>{'trust' in focused && <strong>{t('Trust')} {Math.round(focused.trust as number)}</strong>}</div>
        <footer class="atlas-alerts"><button type="button" onClick={() => setWatch(true)}><Icon name="threats" size={18}/><strong>{threats.length}</strong>{t('Threats')}</button><button type="button" onClick={() => setWatch(true)}><Icon name="government" size={18}/><strong>{demands.length}</strong>{t('Commitments')}</button>{view.warnings.length>0 && <span class="atlas-warning-count"><Icon name="warning" size={16}/>{view.warnings.length}</span>}</footer>
      </section>
      <section class="agenda-decisions agenda-dispatches">
        <header class="agenda-heading"><div><p>{view.dateLabel}</p><h1>{view.finale?t('The Threshold'):t('Your agenda')}</h1></div><span>{tp(cards.length,'{n} decision','{n} decisions')}</span></header>
        <div class="agenda-decision-list">{cards.map((card,i) => <button type="button" key={card.uid} data-card={card.uid} class={cx('agenda-case',i===0&&'agenda-case--lead',card.urgency==='critical'&&'is-critical')} onClick={() => openCard(card.uid)}><span class="agenda-source-mark"><SourceMark card={card}/></span><span class="agenda-case-copy"><small>{card.source.name}</small><strong>{card.title}</strong><span>{card.subtitle??KIND_LABEL[card.kind]}</span></span><Icon name="chevron_right" size={20}/></button>)}{!cards.length&&<div class="agenda-clear"><Icon name="check" size={35}/><h2>{t('Desk clear')}</h2><p>{t('Use your remaining actions, review your commitments, then advance the quarter.')}</p></div>}</div>
        <footer class="agenda-progress"><EndQuarterButton/></footer>
      </section>
    </div>
    {watch && <Sheet size="page" class="atlas-watchlist" label={t('Watchlist')} onClose={() => setWatch(false)}><h1>{t('Watchlist')}</h1><div class="atlas-watch-content">{threats.map(s => <button type="button" key={s.id} class="agenda-watch agenda-watch--threat" onClick={() => inspect('threats',undefined,s.id)}><Icon name="threats" size={22}/><span><strong>{s.name}</strong><small>{s.escalationWarning?t('Escalation expected next quarter'):s.stageLabel}</small></span><Icon name="chevron_right" size={20}/></button>)}{demands.map(d => <button type="button" key={d.id} class="agenda-watch" onClick={() => inspect('nation','government',d.id)}><Icon name="government" size={22}/><span><strong>{stripDeadline(d.title)}</strong><small>{d.progressLabel} · {d.deadlineLabel}</small></span><Icon name="chevron_right" size={20}/></button>)}{!threats.length&&!demands.length&&<p>{t('No active threats or commitments. Read the briefings to prepare your next move.')}</p>}{view.warnings.length>0&&<ul class="agenda-warnings">{[...new Set(view.warnings.map(cleanWarning))].map(w => <li key={w}><Icon name="warning" size={15}/>{w}</li>)}</ul>}</div></Sheet>}
  </>;
}

export function NationalStatus({ onClose, onMeter }: {onClose():void;onMeter(id:MeterId):void}):JSX.Element {
  const {view}=useGame();
  return <Sheet label={t('National indicators')} onClose={onClose} class="national-status" size="page"><header><h1>{t('National indicators')}</h1><p>{view.country.name} · {view.dateLabel}</p></header><div class="national-status-list">{METER_ORDER.map(id=><button type="button" key={id} data-meter={id} class={cx(view.meters[id].status==='critical'&&'is-critical')} onClick={()=>onMeter(id)}><Icon name={METER_INFO[id].icon} size={26}/><span><strong>{METER_INFO[id].name}</strong><small>{t('View causes and recent changes')}</small></span><b>{Math.round(view.meters[id].value)}</b><Icon name="chevron_right"/></button>)}</div></Sheet>;
}
