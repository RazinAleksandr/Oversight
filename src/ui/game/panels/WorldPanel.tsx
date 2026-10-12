/** Spatial World overview, with explicit reading routes for intelligence and diplomacy. */
import type { JSX } from 'preact';
import type { RivalView } from '../../../engine/types';
import { Bar, EstimateLine, RangeBar } from '../../components/Bars';
import { ActionChip, Trait } from '../../components/Common';
import { Icon, Svg, artCached } from '../../components/Icon';
import { StrategicMap } from '../../components/StrategicMap';
import { cx } from '../../util';
import { actionsFor, useGame } from '../context';
import { ATTITUDE_TEXT, ATTITUDE_TONE, relTone } from './LabsPanel';
import { t } from '../../../i18n';

const tensionLabel = (v: number) => (v >= 90 ? t('Brink of war') : v >= 70 ? t('Escalating') : v >= 40 ? t('Rising') : t('Calm'));

export function WorldPanel(): JSX.Element {
  const { view, actions, openAction, openCard, sections, selectSection, goTab } = useGame();
  const section = sections.world ?? 'map';
  const n = view.nation;
  const treaty = view.inbox.find(c=>c.templateId==='sys:world:accord_ready');
  const diplomacy = actions.find(a=>a.id==='diplomatic_initiative');
  const otherActions = actionsFor(actions,'world').filter(a=>a.id!=='diplomatic_initiative');
  const rival = view.rivals.find(r=>r.id===section);
  const map = section==='map' || (!rival && section!=='overview' && section!=='actions');
  const accordStatus=n.accord.signed?t('Signed'):treaty?t('Ready to sign'):t('Negotiations in progress');
  const countries=[{id:view.country.id,name:view.country.name,color:view.country.color,accordMember:n.accord.members.includes(view.country.id),attention:view.situations.filter(s=>!s.resolved).length},...view.rivals.map(r=>({id:r.id,name:r.name,color:r.color,trust:r.trust,accordMember:r.accordMember}))];
  return <div class="page page--world atlas-world">
    <nav class="atlas-world__nav" aria-label={t('World sections')}>
      <button type="button" class={cx(map && 'is-active',!map && 'atlas-world__back')} data-world-map onClick={()=>selectSection('world','map')}>{!map && <Icon name="back" size={18}/>} {t('World map')}</button>
      <button type="button" class={cx(section==='overview' && 'is-active')} data-world-accord onClick={()=>selectSection('world','overview')}>{t('Global Accord')} · {n.accord.signed?'✓':`${Math.round(n.accord.progress)}%`}</button>
      <button type="button" class={cx(section==='actions' && 'is-active')} data-world-actions onClick={()=>selectSection('world','actions')}>{t('Actions')}</button>
    </nav>
    {map ? <div class="atlas-world__board">
      <div class="atlas-world__canvas"><StrategicMap player={view.country.id} countries={countries} accordSigned={n.accord.signed} onSelect={id=>id===view.country.id?goTab('nation'):selectSection('world',id)}/><div class="atlas-world__key"><span>{t('Race tension')} <strong>{Math.round(n.tension)} · {tensionLabel(n.tension)}</strong></span><span>{n.accord.members.length>0 && <>◆ {t('Accord supporter')} · </>}{t('Select a nation')}</span></div></div>
      <aside class="atlas-world__summary"><h2>{t('Global Accord')}</h2><strong class="atlas-world__accord-value">{Math.round(n.accord.progress)}%</strong><p>{accordStatus}</p><button type="button" class="atlas-world__button" onClick={()=>treaty&&!n.accord.signed?openCard(treaty.uid):selectSection('world','overview')}>{treaty&&!n.accord.signed?t('Open treaty briefing'):t('Diplomatic initiatives')}<Icon name="chevron_right" size={18}/></button></aside>
    </div> : <div class="atlas-world__reading" key={section}>
      {section==='overview' && <section>
        <header class="management-identity"><Icon name="accord" size={36}/><div><p>{accordStatus}</p><h2>{t('Global Accord')}</h2></div><strong class="management-accord-progress">{Math.round(n.accord.progress)}%</strong></header>
        <Bar value={n.accord.progress} tone="good" label={t('Accord progress')}/>
        {treaty&&!n.accord.signed && <button type="button" class="atlas-world__button" onClick={()=>openCard(treaty.uid)}>{t('Open treaty briefing')}</button>}
        <h3 class="atlas-world__initiatives-title">{t('Diplomatic initiatives')}</h3>
        {diplomacy && <div class="management-diplomacy-targets">{diplomacy.targets?.map(target=><button type="button" key={target.id} class="management-operation" data-diplomacy-target={target.id} onClick={()=>openAction(diplomacy.id,target.id)}><strong>{target.label}</strong><span>{target.sublabel??t('Build trust and Accord progress')}</span><small>{diplomacy.disabled??target.disabled??t('Review initiative')}</small></button>)}</div>}
        <p>{n.accord.signed?t('The agreement is active. Continue managing trust and the international race.'):t('Diplomacy builds progress. At 100%, a signing briefing arrives; the Accord takes effect only after you sign it.')}</p>
        <p>{t('Supporters:')} {n.accord.members.length?n.accord.members.map(id=>view.rivals.find(r=>r.id===id)?.name??view.country.name).join(' · '):t('No supporters yet')}</p>
        <h3>{t('Race tension')} · {Math.round(n.tension)} · {tensionLabel(n.tension)}</h3><Bar value={n.tension} tone={n.tension>=70?'warn':'accent'} label={t('Race tension')}/>
      </section>}
      {rival && <RivalCard r={rival}/>}
      {section==='actions' && <><h2>{t('All international actions')}</h2><div class="management-action-catalog">{[...(diplomacy?[diplomacy]:[]),...otherActions].map(a=><div key={a.id}><ActionChip action={a} onOpen={openAction}/><p>{a.description}</p></div>)}</div></>}
    </div>}
  </div>;
}

function RivalCard({ r }: { r: RivalView }): JSX.Element {
  const { view, actions, openAction } = useGame();
  const acts = actionsFor(actions, 'world', r.id);
  const ours = view.nation.capability;
  const ahead = r.capability.value - ours.value;
  return (
    <article class="panel rival" id={`rival-${r.id}`} style={{ '--brand': r.color }}>
      <header class="entity__head">
        <Svg class="entity__logo entity__logo--emblem" html={artCached.emblem(r.id, 48)} />
        <div class="entity__id">
          <h3 class="entity__name">{r.name}</h3>
          <p class="entity__sub">
            <span>{t('{title}-led', { title: r.leaderTitle })}</span>
            <span>{t('Lead lab: {lab}', { lab: r.leadLab })}</span>
          </p>
        </div>
        <span class={cx('att', `att--${ATTITUDE_TONE[r.attitude]}`)}>{ATTITUDE_TEXT[r.attitude] ?? r.attitude}</span>
      </header>

      {acts.length > 0 && (
        <div class="actrow">
          {acts.map((a) => (
            <ActionChip key={a.id} action={a} targetId={r.id} onOpen={openAction} />
          ))}
        </div>
      )}
      <div class="kvs">
        <div class="kvs__head">
          <span class="kv__k">{t('Frontier capability')}</span>
          <EstimateLine est={r.capability} unit={t('CI')} />
        </div>
        <div class="vsbars">
          <span class="vsbars__lbl">{r.adjective}</span>
          <RangeBar est={r.capability} tone="bad" />
          <span class="vsbars__lbl">{t('You')}</span>
          <RangeBar est={ours} tone="accent" ticks={false} />
        </div>
        <p class={cx('vsline', ahead > 0.3 ? 'is-bad' : ahead < -0.3 ? 'is-good' : '')}>
          {ahead > 0.3
            ? t('Likely ahead of you by ~{n}', { n: ahead.toFixed(1) })
            : ahead < -0.3
              ? t('Likely behind you by ~{n}', { n: (-ahead).toFixed(1) })
              : t('Roughly level with you')}
        </p>
      </div>

      <div class="kvs">
        <div class="kvs__head">
          <span class="kv__k">{t('Safeguards')}</span>
          <EstimateLine est={r.safeguards} />
        </div>
        <RangeBar est={r.safeguards} tone="good" />
      </div>

      <div class="kv">
        <span class="kv__k">{t('Trust')}</span>
        <Bar value={r.trust} tone={relTone(r.trust) as 'good'} label={t('Trust {n}', { n: r.trust })} />
        <span class="kv__v num">{Math.round(r.trust)}</span>
      </div>

      <div class="traits traits--2">
        <Trait name={t('Aggression')} t={r.aggressionLabel} />
        <Trait name={t('Safety stance')} t={r.safetyLabel} />
      </div>

      <p class="entity__intel">
        <span>
          <Icon name="eye" size={13} /> {t('Intel')} <span class="num">{Math.round(r.intel * 100)}%</span>
        </span>
        {r.accordMember && <span class="badge badge--good">{t('Accord supporter')}</span>}
        {r.exportControlled && <span class="badge badge--warn">{t('Export controlled')}</span>}
        {r.partnership && <span class="badge badge--ai">{t('Research partner')}</span>}
      </p>


    </article>
  );
}
