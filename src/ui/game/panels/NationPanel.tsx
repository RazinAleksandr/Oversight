/**
 * Nation: government (leader, priorities, demands, reviews), safety gap, programs (budget levels),
 * policies (laws) and society (adoption by sector, dependence, displacement).
 */
import { LabsPanel } from './LabsPanel';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { DemandView, PolicyView, ProgramView, SectorId } from '../../../engine/types';
import { SECTOR_INFO, dateLabel } from '../../../engine/labels';
import { Bar, EstimateLine, RangeBar } from '../../components/Bars';
import { ActionChip, PageHead, Section } from '../../components/Common';
import { Icon, Portrait } from '../../components/Icon';
import { cx, hueOf, money, one } from '../../util';
import { actionsFor, useGame } from '../context';
import { DemandForecast } from '../DemandForecast';
import { stripDeadline } from '../Inbox';
import { t, tp } from '../../../i18n';

const SECTORS: SectorId[] = ['business', 'public', 'infrastructure', 'defense'];

const MOOD_TONE = { Supportive: 'good', Satisfied: 'good', Impatient: 'warn', Hostile: 'bad' } as const;

/** GovernmentView `mood` is an English id; this is its display text. */
const MOOD_TEXT: Record<string, string> = { Supportive: t('Mood: Supportive'), Satisfied: t('Mood: Satisfied'), Impatient: t('Mood: Impatient'), Hostile: t('Mood: Hostile') };

const SUPPORT_TEXT: Record<string, string> = { '-2': t('Strongly opposes'), '-1': t('Opposes'), '0': t('Indifferent'), '1': t('Supports'), '2': t('Champions') };

export function NationPanel({ companies = false }: { companies?: boolean }): JSX.Element {
  const { view, sections, selectSection, goTab } = useGame();
  const section = companies ? 'companies' : sections.nation ?? 'government';
  return (
    <div class="page page--nation management-v4">
      <PageHead title={t('Nation')} sub={view.country.name} />
      <nav class="panel-sections" aria-label={t('Nation sections')}>
        {[...(view.unlockedTabs.includes('nation') ? [['government', t('Government')], ['programs', t('Programs')], ['policies', t('Laws')], ['society', t('Society')]] : [])].map(([id, label]) =>
          <button type="button" class={cx('btn', section === id && 'btn--accent')} aria-pressed={section === id} data-section={id} onClick={() => { if (id === 'companies') goTab('labs'); else { selectSection('nation', id); goTab('nation'); } }}>{label}</button>)}
      </nav>
      <div class="management-content">
        <div class="management-section">
          {section === 'companies' && <LabsPanel embedded />}
          {section === 'government' && <GovernmentPanel />}
          {section === 'programs' && <Programs />}
          {section === 'policies' && <Policies />}
          {section === 'society' && <Society />}
        </div>
      </div>
    </div>
  );
}

function GovernmentPanel(): JSX.Element {
  const { view, actions, openAction, sections, selectSection } = useGame();
  const g = view.government;
  const demands = [...g.demands].sort((a,b) => Number(b.status === 'active' || b.status === 'offered') - Number(a.status === 'active' || a.status === 'offered') || a.deadlineTurn-b.deadlineTurn);
  const selected = sections.demand === 'government' ? undefined : demands.find(d => d.id === sections.demand) ?? demands[0];
  return <div class="management-split">
    <nav class="management-roster" aria-label={t('Demands')}>
      <h2>{t('Commitments')}</h2>
      {demands.map(d => <button type="button" key={d.id} class={cx('management-item', selected?.id === d.id && 'is-selected')} aria-pressed={selected?.id === d.id} data-demand-select={d.id} onClick={() => selectSection('demand',d.id)}>
        <strong>{stripDeadline(d.title)}</strong><span>{d.deadlineLabel}</span><small>{d.progressLabel}</small>
      </button>)}
      {!demands.length && <p>{t('No active demands. Enjoy it while it lasts.')}</p>}
      <button type="button" class={cx('management-item', sections.demand === 'government' && 'is-selected')} onClick={() => selectSection('demand','government')}><strong>{g.leaderName}</strong><span>{g.stanceLabel}</span></button>
    </nav>
    <div class="management-detail" key={sections.demand}>
      {selected && sections.demand !== 'government' ? <Demand d={selected} /> : <>
        <header class="management-identity"><Portrait seed={g.portraitSeed} role="leader" size={56} name={g.leaderName} hue={hueOf(view.country.color)} /><div><p>{g.leaderTitle}</p><h2>{g.leaderName}</h2><span>{MOOD_TEXT[g.mood] ?? t('Mood: {mood}',{mood:g.mood})}</span></div></header>
        <div class="management-actions">{actionsFor(actions,'politics').map(a=><ActionChip key={a.id} action={a} onOpen={openAction}/>)}</div>
        <p>{g.stanceText}</p><p class="management-secondary">{g.leaderBio}</p>
        <h3>{t('Priorities')}</h3>{g.priorities.map(p=><div class="management-stat" key={p.key}><span>{p.label}</span><Bar value={p.weight} max={1} tone="gov" label={t('{label} weight {n}',{label:p.label,n:p.weight})}/></div>)}
        {g.nextReview && <p>{g.nextReview.label} · {tp(Math.max(0,g.nextReview.turn-view.turn),'in {n} quarter','in {n} quarters')}</p>}
      </>}
    </div>
  </div>;
}

function Demand({ d }: { d: DemandView }): JSX.Element {
  const { view, openCard, goTab, selectSection } = useGame();
  const card = view.inbox.find(c => c.ctx.demandId === d.id);
  const st = d.status;
  return (
    <div data-demand-detail={d.id} class={cx('demand', `demand--${st}`)}>
      <div class="demand__top">
        <span class="demand__title">{stripDeadline(d.title)}</span>
        <span class={cx('demand__status', st === 'met' ? 'is-good' : st === 'failed' || st === 'refused' ? 'is-bad' : '')}>
          {st === 'active'
            ? d.deadlineLabel === dateLabel(d.deadlineTurn)
              ? t('Due {date}', { date: d.deadlineLabel })
              : d.deadlineLabel
            : st === 'offered'
              ? t('Offered')
              : st === 'met'
                ? t('Met')
                : st === 'failed'
                  ? t('Failed')
                  : t('Refused')}
        </span>
      </div>
      <div class="management-actions">
        {card && <button type="button" class="btn btn--primary" onClick={() => openCard(card.uid)}>{t('Review demand')}</button>}
        {view.unlockedTabs.includes('nation') && !['cover_up','match_rival','approve_model'].includes(d.kind) && <button type="button" class="btn" onClick={() => { selectSection('nation','programs'); if (d.kind === 'defense_program') selectSection('program','defense'); if (d.kind === 'jobs_guarantee') selectSection('program','workforce'); goTab('nation'); }}>{t('Review funding')}</button>}
        {d.kind === 'cover_up' && view.unlockedTabs.includes('threats') && <button type="button" class="btn" onClick={()=>{ selectSection('threatView','active'); goTab('threats'); }}>{t('Review threats')}</button>}
        {d.kind === 'match_rival' && view.unlockedTabs.includes('world') && <button type="button" class="btn" onClick={()=>goTab('world')}>{t('Review rivals')}</button>}
        {d.kind === 'approve_model' && <button type="button" class="btn" onClick={()=>goTab('labs')}>{t('Review companies')}</button>}
        {d.kind === 'deploy_sector' && <button type="button" class="btn" onClick={() => { selectSection('nation','society'); goTab('nation'); }}>{t('Inspect adoption')}</button>}
      </div>
      <p class="demand__text">{d.text}</p>
      {d.forecast && <DemandForecast forecast={d.forecast} />}
      {!d.forecast && (st === 'active' || st === 'offered') && <p class="dim small">{t('No numeric projection is available for this demand. Review its current progress and conditions.')}</p>}
      <Bar value={d.progress * 100} tone={d.progress >= 1 ? 'good' : 'gov'} label={d.progressLabel} />
      <div class="demand__foot num">
        <span>{d.progressLabel}</span>
        <span>
          <span class="is-good">+{d.reward}</span> / <span class="is-bad">−{d.penalty}</span> {t('conf.')}
        </span>
      </div>
    </div>
  );
}


function SafetyGap(): JSX.Element {
  const { view } = useGame();
  const n = view.nation;
  const gap = n.capability.value - n.safeguards;
  const tone = gap <= 0.5 ? 'good' : gap <= 1.5 ? 'warn' : 'bad';
  return (
    <Section title={t('Safety gap')} icon="safeguards">
      <div class="panel gap">
        <div class="kvs">
          <div class="kvs__head">
            <span class="kv__k">{t('Domestic frontier · {company}', { company: n.frontierLeader })}</span>
            <EstimateLine est={n.capability} unit={t('CI')} />
          </div>
          <RangeBar est={n.capability} tone="warn" />
        </div>
        <div class="kvs">
          <div class="kvs__head">
            <span class="kv__k">{t('National safeguards')}</span>
            <span class="num">{one(n.safeguards)}</span>
          </div>
          <RangeBar est={{ value: n.safeguards, low: n.safeguards, high: n.safeguards, confidence: 'verified' }} tone="good" />
        </div>
        <p class={cx('gap__verdict', `is-${tone}`)}>
          <span class="gap__num num">{gap > 0 ? '+' : ''}{one(gap)}</span>
          <span>
            {gap <= 0
              ? t('Safeguards are ahead of capability. Keep it that way.')
              : gap <= 1.5
                ? t('Capability is outrunning your ability to control it.')
                : t('Dangerous gap. Every deployment now carries serious hidden risk.')}
          </span>
        </p>
      </div>
    </Section>
  );
}

function Programs(): JSX.Element {
  const { view, sections, selectSection } = useGame();
  const n = view.nation;
  const selected = n.programs.find(p => p.id === sections.program) ?? n.programs[0];
  return <div class="management-split">
    <nav class="management-roster" aria-label={t('Programs')}>
      <h2>{t('Funding')}</h2>
      {n.programs.map(p=><button type="button" key={p.id} class={cx('management-item',selected?.id===p.id && 'is-selected')} aria-pressed={selected?.id===p.id} data-program-select={p.id} onClick={()=>selectSection('program',p.id)}><Icon name={p.icon} size={18}/><strong>{p.short}</strong><span>{t('L{n}',{n:p.level})} · {t('{amount}/q',{amount:money(p.costs[p.level])})}</span></button>)}
      <div class="management-ledger"><span>{t('Treasury')} <strong>{money(n.budget)}</strong></span><span>{t('Income')} <strong>{money(n.income)}</strong></span><span>{t('Upkeep')} <strong>{money(n.upkeep)}</strong></span><span>{t('Net / q')} <strong>{money(n.income-n.upkeep,true)}</strong></span></div><details class="management-ledger-compact"><summary>{t('Net / q')} <strong>{money(n.income-n.upkeep,true)}</strong></summary><div class="management-ledger"><span>{t('Treasury')} <strong>{money(n.budget)}</strong></span><span>{t('Income')} <strong>{money(n.income)}</strong></span><span>{t('Upkeep')} <strong>{money(n.upkeep)}</strong></span></div></details>
    </nav>
    <div class="management-detail management-detail--program">{selected && <ProgramEditor key={selected.id} p={selected}/>}</div>
  </div>;
}

function ProgramEditor({ p }: { p: ProgramView }): JSX.Element {
  const { setProgram, view } = useGame();
  const [proposed,setProposed] = useState(p.level);
  useEffect(()=>setProposed(p.level),[p.level]);
  const delta = p.costs[proposed]-p.costs[p.level];
  const unaffordable = proposed > p.level && p.costs[proposed] > view.nation.budget;
  const nominal = view.nation.programs.reduce((total,item)=>total+item.costs[item.id===p.id?proposed:item.level],0);
  return <section class="management-program" data-program-editor={p.id}>
    <header class="management-identity"><Icon name={p.icon} size={28}/><div><p>{t('Free to change · upkeep each quarter')}</p><h2><span class="management-program-name-full">{p.name}</span><span class="management-program-name-short">{p.short}</span></h2></div></header>
    <div class="management-program-scroll">
    <div class="management-levels" role="radiogroup" aria-label={t('{program} funding level',{program:p.name})}>{p.costs.map((cost,level)=><button type="button" key={level} role="radio" aria-checked={proposed===level} class={cx(proposed===level && 'is-selected')} data-propose-level={level} onClick={()=>setProposed(level)}><strong>{level===0?t('Off'):t('L{n}',{n:level})}{p.level===level && <span class="management-level-current" title={t('Current')} aria-label={t('Current')}>✓</span>}</strong><span>{t('{amount}/q',{amount:money(cost)})}</span>{p.level===level && <small class="management-level-current-text">{t('Current')}</small>}</button>)}</div>
    <div class="management-funding-preview" aria-live="polite" aria-label={t('Proposed funding')}><h3>{t('Proposed funding')}</h3><p>{p.levelText[proposed]}</p>{unaffordable && <p class="management-warning">{t('Need {cost}; available {available}; shortfall {shortfall}.',{cost:money(p.costs[proposed]),available:money(view.nation.budget),shortfall:money(p.costs[proposed]-view.nation.budget)})}</p>}<dl><div><dt>{t('Listed upkeep')}</dt><dd>{money(p.costs[p.level])} → {money(p.costs[proposed])}</dd></div><div><dt>{t('Quarterly cost change')}</dt><dd>{money(delta,true)}</dd></div><div><dt>{t('Net income at listed costs')}</dt><dd>{money(view.nation.income-nominal,true)}</dd></div></dl><p class="management-secondary">{t('Upkeep is charged at the end of the quarter. Temporary waivers can change the actual charge.')}</p></div>
    <h3 class="management-program-name-short">{p.name}</h3><p class="management-secondary">{p.description}</p>
    {(p.id==='safety' || p.id==='oversight') && <SafetyGap/>}
    </div>
    <footer class="management-program-commit"><button type="button" class="btn btn--primary" data-apply-funding disabled={proposed===p.level || unaffordable} onClick={()=>setProgram(p.id,proposed)}>{t('Apply funding')} <span>{money(p.costs[p.level])} → {money(p.costs[proposed])}</span></button><button type="button" class="btn" disabled={proposed===p.level} onClick={()=>setProposed(p.level)}>{t('Cancel changes')}</button></footer>
  </section>;
}

function Policies(): JSX.Element {
  const { view, sections, selectSection } = useGame();
  const policies = [...view.nation.policies].sort((a,b)=>Number(b.active)-Number(a.active));
  const selected = policies.find(p=>p.id===sections.policy) ?? policies[0];
  return <div class="management-split"><nav class="management-roster" aria-label={t('Laws')}><h2>{t('Laws')}</h2>{policies.map(p=><button type="button" key={p.id} class={cx('management-item',selected?.id===p.id && 'is-selected')} aria-pressed={selected?.id===p.id} data-policy-select={p.id} onClick={()=>selectSection('policy',p.id)}><strong>{p.short}</strong><span>{p.active?t('In force'):t('Available legislation')}</span></button>)}</nav><div class="management-detail">{selected && <Law p={selected}/>}</div></div>;
}

function Law({ p }: { p: PolicyView }): JSX.Element {
  const { actions, openAction } = useGame();
  const act = actions.find(a=>a.id===(p.active?'repeal_policy':'enact_policy'));
  const blocked = act?.disabled ?? act?.targets?.find(target=>target.id===p.id)?.disabled ?? null;
  const cost = p.active?Math.ceil(p.politicalCost/2):p.politicalCost;
  return <article class={cx('management-law',p.active && 'is-active')}>
    <header class="management-identity"><Icon name={p.icon} size={26}/><div><p>{p.active?t('In force'):t('Available legislation')}</p><h2>{p.name}</h2></div></header>
    <div class="management-actions"><button type="button" class="btn btn--primary" onClick={()=>openAction(p.active?'repeal_policy':'enact_policy',p.id)}>{p.active?t('Review repeal'):t('Review enactment')}</button><span>{cost>0?t('−{n} conf.',{n:cost}):cost<0?t('+{n} conf.',{n:-cost}):t('No political cost')}</span></div>
    {blocked && <p class="management-warning">{blocked}</p>}
    <p>{p.description}</p><ul class="management-effects">{p.effectsText.map(text=><li key={text}>{text}</li>)}</ul>
    <p>{SUPPORT_TEXT[String(p.leaderSupport)] ?? t('Indifferent')}</p>
  </article>;
}

function Society(): JSX.Element {
  const { view } = useGame();
  const n = view.nation;
  return (
    <Section title={t('Society & economy')} icon="adoption" class="management-detail">
      <div class="panel society">
        <h4 class="eyebrow">{t('AI adoption by sector')}</h4>
        <ul class="sectors">
          {SECTORS.map((s) => {
            const v = n.adoption[s];
            const tgt = n.adoptionTarget[s];
            return (
              <li key={s} class="sectorrow">
                <span class="sectorrow__name">
                  <Icon name={SECTOR_INFO[s].icon} size={15} /> {SECTOR_INFO[s].name}
                </span>
                <Bar value={v} ghost={tgt} tone="accent" label={t('{sector} adoption {n} percent, heading to {target}', { sector: SECTOR_INFO[s].name, n: Math.round(v), target: Math.round(tgt) })} />
                <span class="sectorrow__v num">
                  {Math.round(v)}%{Math.round(tgt) !== Math.round(v) && <span class="dim"> → {Math.round(tgt)}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <p class="dim small legend">
          <span class="legend__ghost" aria-hidden="true" /> {t('target the sector is moving toward')}
        </p>
        <div class="society__tiles">
          <div class="stat">
            <span class="eyebrow">{t('Dependence')}</span>
            <span class="stat__v num">{Math.round(n.dependence)}</span>
            <Bar value={n.dependence} tone={n.dependence > 60 ? 'warn' : 'accent'} thin label={t('Dependence')} />
            <span class="stat__hint">{t('Suspending models hurts more as this grows')}</span>
          </div>
          <div class="stat">
            <span class="eyebrow">{t('Job displacement')}</span>
            <span class={cx('stat__v num', n.displacement > 40 && 'is-bad')}>{Math.round(n.displacement)}</span>
            <Bar value={n.displacement} tone={n.displacement > 40 ? 'bad' : n.displacement > 20 ? 'warn' : 'good'} thin label={t('Displacement')} />
            <span class="stat__hint">{t('Erodes stability unless workers are supported')}</span>
          </div>
        </div>
      </div>
    </Section>
  );
}
