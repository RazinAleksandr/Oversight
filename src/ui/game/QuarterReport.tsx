/** A quarter debrief: consequential developments first, complete causal ledger one tap away. */
import type { JSX } from 'preact';
import { useEffect,useState } from 'preact/hooks';
import type { TabId,TurnReport } from '../../engine/types';
import { METER_INFO } from '../../engine/labels';
import { audio } from '../../audio';
import { t,tp } from '../../i18n';
import { Icon, Svg, artCached } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { cx,money,signed } from '../util';
import { METER_ORDER } from './Hud';
import { cleanWarning } from './Inbox';
import { useGame } from './context';
export function QuarterReport({report,onContinue,onManage}:{report:TurnReport;onContinue():void;onManage?(tab:TabId,section?:string,target?:string):void}):JSX.Element {
  const [section,setSection]=useState('overview');
  const {view}=useGame();
  useEffect(()=>{audio.play('turn')},[]);
  const b=report.budget;
  const lead=report.highlights[0];
  const headline=report.headlines[0];
  const threats=view.situations.filter(s=>!s.resolved);
  const demands=view.government.demands.filter(d=>d.status==='active');
  return <Sheet label={t('Quarter report: {date}',{date:report.dateLabel})} size="page" class="report-v4 report-v5" closeButton={false}>
    <header class="report-command"><Svg class="report-seal" html={artCached.emblem(view.country.id,44)}/><div><span>{t('Quarter report')}</span><h1>{report.dateLabel}</h1></div><nav aria-label={t('Quarter report')}>{[['overview',t('Overview')],['changes',t('What changed')],['headlines',t('Headlines')]].map(([id,label])=><button type="button" key={id} aria-pressed={section===id} class={cx(section===id&&'is-active')} onClick={()=>setSection(id)}>{label}</button>)}</nav></header>
    <main class="report-content" data-report>
      {section==='overview'&&<div class="report-overview"><section class="report-developments"><p class="report-byline">{view.country.name}</p><h2>{report.gameOver?t('The run has ended.'):lead?.text??tp(report.newCards,'{n} new briefing on your desk','{n} new briefings on your desk')}</h2>{(lead||report.gameOver)&&<p class="report-new">{tp(report.newCards,'{n} new briefing on your desk','{n} new briefings on your desk')}</p>}{report.warnings.length>0&&<ul class="report-warnings">{[...new Set(report.warnings.map(cleanWarning))].map(w=><li key={w}><Icon name="warning" size={17}/>{w}</li>)}</ul>}<ul class="report-highlights">{report.highlights.slice(1).map((h,i)=><li key={i} class={cx(h.tone==='bad'&&'is-bad')}><Icon name={h.icon??'news'} size={18}/><span>{h.text}</span></li>)}</ul>{!lead&&headline&&<article class="report-frontpage"><small>{headline.outlet} · {t('Headlines')}</small><p>{headline.text}</p>{headline.signal&&<span>{t('Warning sign')}</span>}</article>}
        {!report.gameOver&&onManage&&<div class="report-followups">{demands.length>0&&view.unlockedTabs.includes('nation')&&<button type="button" onClick={()=>onManage('nation','government',demands[0].id)}>{t('Review commitments')} →</button>}{threats.length>0&&view.unlockedTabs.includes('threats')&&<button type="button" onClick={()=>onManage('threats',undefined,threats[0].id)}>{t('Review threats')} →</button>}</div>}
      </section><section class="report-national"><h2>{t('National indicators')}</h2>{METER_ORDER.map(id=>{const r=report.meters[id],delta=Math.round(r.to)-Math.round(r.from),reason=[...r.reasons].sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta))[0];return <div key={id} class="report-indicator"><div><Icon name={METER_INFO[id].icon} size={18}/><strong>{METER_INFO[id].short}</strong><span>{Math.round(r.from)} → {Math.round(r.to)}</span><b class={delta<0?'is-bad':delta>0?'is-good':''}>{signed(delta)}</b></div><div class="report-change-track" aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,r.from))}%`}}/><b style={{width:`${Math.max(0,Math.min(100,r.to))}%`}}/></div>{reason&&<p>{reason.reason}</p>}</div>})}<div class="report-budget"><span>{t('Budget')} <strong>{money(b.to)}</strong></span><small>{t('{amount} income',{amount:money(b.income,true)})} · {t('{amount} upkeep',{amount:money(-b.upkeep)})}</small></div><p class="report-risk">{t('Risk clock')} <strong>{report.risk.clock}</strong></p></section></div>}
      {section==='changes'&&<section class="report-ledger">{METER_ORDER.map(id=><section key={id}><h2>{METER_INFO[id].name} <span>{Math.round(report.meters[id].from)} → {Math.round(report.meters[id].to)}</span></h2>{report.meters[id].reasons.length?<ul>{[...report.meters[id].reasons].sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).map((r,i)=><li key={i}><span>{r.reason}</span><b class={r.delta<0?'is-bad':'is-good'}>{signed(r.delta,Math.abs(r.delta)<1&&r.delta!==0?1:0)}</b></li>)}</ul>:<p>{t('No changes recorded yet this quarter.')}</p>}</section>)}</section>}
      {section==='headlines'&&<section class="report-press"><h2>{t('Headlines')}</h2>{report.headlines.map((h,i)=><article key={i}><small>{h.outlet}</small><p>{h.text}</p>{h.signal&&<span>{t('Warning sign')}</span>}</article>)}</section>}
    </main>
    <footer class="report-footer report__actions"><span>{view.nation.capacity} {t('Actions')} · {money(view.nation.budget)}</span><button type="button" class="btn btn--primary" data-report-continue data-autofocus onClick={onContinue}>{report.gameOver?t('See what happened'):t('Open the agenda')}<Icon name="chevron_right" size={18}/></button></footer>
  </Sheet>;
}
