/**
 * World: map, race tension gauge, Global Accord, rival powers (fogged estimates vs. ours) and
 * international actions with target pickers.
 */
import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { CountryId, RivalView } from '../../../engine/types';
import { Bar, EstimateLine, RangeBar } from '../../components/Bars';
import { ActionChip, PageHead, Trait } from '../../components/Common';
import { Icon, Svg, artCached, isPlaceholder } from '../../components/Icon';
import { cx } from '../../util';
import { actionsFor, useGame } from '../context';
import { ATTITUDE_TEXT, ATTITUDE_TONE, relTone } from './LabsPanel';
import { t } from '../../../i18n';

const tensionLabel = (v: number) => (v >= 90 ? t('Brink of war') : v >= 70 ? t('Escalating') : v >= 40 ? t('Rising') : t('Calm'));

export function WorldPanel(): JSX.Element {
  const { view, actions, openAction, openCard, sections, selectSection } = useGame();
  const section = sections.world ?? 'overview';
  const n = view.nation;
  const treaty = view.inbox.find(c=>c.templateId==='sys:world:accord_ready');
  const diplomacy = actions.find(a=>a.id==='diplomatic_initiative');
  const otherActions = actionsFor(actions,'world').filter(a=>a.id!=='diplomatic_initiative');
  const rival = view.rivals.find(r=>r.id===section);
  return <div class="page page--world management-v4">
    <PageHead title={t('World')} sub={t('Three rival powers are racing too. Our picture of them is incomplete.')}/>
    <div class="management-split">
      <nav class="management-roster" aria-label={t('World sections')}>
        <button type="button" class={cx('management-item',section==='overview' && 'is-selected')} aria-pressed={section==='overview'} onClick={()=>selectSection('world','overview')}><Icon name="accord" size={20}/><strong>{t('Global Accord')}</strong><span>{n.accord.signed?t('Signed'):treaty?t('Ready to sign'):t('{n}% progress',{n:Math.round(n.accord.progress)})}</span></button>
        <h2>{t('Rival powers')}</h2>
        {view.rivals.map(r=><button type="button" key={r.id} class={cx('management-item',section===r.id && 'is-selected')} aria-pressed={section===r.id} data-rival-select={r.id} onClick={()=>selectSection('world',r.id)}><Svg class="management-company-mark" html={artCached.emblem(r.id,32)}/><strong>{r.name}</strong><span>{ATTITUDE_TEXT[r.attitude] ?? r.attitude} · {t('Trust')} {Math.round(r.trust)}</span>{r.accordMember && <small>{t('Accord supporter')}</small>}</button>)}
        <button type="button" class={cx('management-item',section==='map' && 'is-selected')} aria-pressed={section==='map'} onClick={()=>selectSection('world','map')}><strong>{t('World map')}</strong><span>{t('Race tension')} {Math.round(n.tension)}</span></button>
        <button type="button" class={cx('management-item',section==='actions' && 'is-selected')} aria-pressed={section==='actions'} onClick={()=>selectSection('world','actions')}><strong>{t('All international actions')}</strong></button>
      </nav>
      <div class="management-detail" key={section}>
        {section==='overview' && <section class="management-accord">
          <header class="management-identity"><Icon name="accord" size={30}/><div><p>{n.accord.signed?t('Signed'):treaty?t('Ready to sign'):t('Negotiations in progress')}</p><h2>{t('Global Accord')}</h2></div><strong class="management-accord-progress">{Math.round(n.accord.progress)}%</strong></header>
          <Bar value={n.accord.progress} tone="good" label={t('Accord progress')}/>
          {treaty && !n.accord.signed && <button type="button" class="btn btn--primary" onClick={()=>openCard(treaty.uid)}>{t('Open treaty briefing')}</button>}
          <h3>{t('Diplomatic initiatives')}</h3>
          {diplomacy && <div class="management-diplomacy-targets">{diplomacy.targets?.map(target=><button type="button" key={target.id} class="management-operation" data-diplomacy-target={target.id} onClick={()=>openAction(diplomacy.id,target.id)}><strong>{target.label}</strong><span>{target.sublabel ?? t('Build trust and Accord progress')}</span><small>{diplomacy.disabled ?? target.disabled ?? t('Review initiative')}</small></button>)}</div>}
          {!n.accord.signed && <p>{t('Diplomacy builds progress. At 100%, a signing briefing arrives; the Accord takes effect only after you sign it.')}</p>}
          {n.accord.signed && <p>{t('The agreement is active. Continue managing trust and the international race.')}</p>}
          <p class="management-supporters">{t('Supporters:')} {n.accord.members.length?n.accord.members.map(id=>view.rivals.find(r=>r.id===id)?.name ?? view.country.name).join(' · '):t('No supporters yet')}</p>
          <div class="management-tension"><h3>{t('Race tension')} <strong>{Math.round(n.tension)} · {tensionLabel(n.tension)}</strong></h3><Bar value={n.tension} tone={n.tension>=70?'warn':'accent'} label={t('Race tension')}/></div>
        </section>}
        {rival && <RivalCard r={rival}/>}
        {section==='map' && <><h2>{t('World map')}</h2><WorldMap/></>}
        {section==='actions' && <><h2>{t('All international actions')}</h2><div class="management-action-catalog">{[...(diplomacy?[diplomacy]:[]),...otherActions].map(a=><div key={a.id}><ActionChip action={a} onOpen={openAction}/><p>{a.description}</p></div>)}</div></>}
      </div>
    </div>
  </div>;
}

function WorldMap(): JSX.Element {
  const { view, selectSection } = useGame();
  const ref = useRef<HTMLDivElement>(null);
  const player = view.country.id;
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const colors: Partial<Record<CountryId, string>> = { [player]: view.country.color };
    for (const r of view.rivals) colors[r.id] = r.color;
    root.querySelectorAll<SVGGElement>('.region').forEach((g) => {
      const id = g.id.replace('region-', '') as CountryId;
      const c = colors[id];
      if (c) {
        g.style.setProperty('--region', c);
        g.style.color = c;
      }
      g.classList.toggle('is-player', id === player);
    });
  });
  const onClick = (e: MouseEvent) => {
    const g = (e.target as Element).closest?.('.region');
    if (!g) return;
    const id = g.id.replace('region-', '');
    if (view.rivals.some(r => r.id === id)) selectSection('world', id);
  };
  const all = [{ id: player, name: view.country.name, color: view.country.color }, ...view.rivals.map((r) => ({ id: r.id, name: r.name, color: r.color }))];
  return (
    <div class="panel worldmap">
      <div class="worldmap__art" ref={ref} onClick={onClick}>
        {!isPlaceholder(artCached.map(player, 640)) ? <Svg html={artCached.map(player, 640)} label={t('World map')} /> : <FallbackMap player={player} colors={all} />}
      </div>
      <ul class="worldmap__legend">
        {all.map((c) => (
          <li key={c.id} class={cx(c.id === player && 'is-player')}>
            <span class="swatch" style={{ background: c.color }} aria-hidden="true" />
            {c.name}
            {c.id === player && <span class="dim"> {t('(you)')}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Schematic map shown only while the art module is a stub. */
function FallbackMap({ player, colors }: { player: CountryId; colors: { id: CountryId; color: string; name: string }[] }): JSX.Element {
  const pos: Record<CountryId, [number, number, number]> = { atlantic: [120, 110, 70], commonwealth: [300, 80, 52], hanzhou: [470, 120, 66], meridian: [430, 230, 34] };
  return (
    <svg viewBox="0 0 600 300" width="100%" role="img" aria-label={t('World map')}>
      <defs>
        <pattern id="fm-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="rgba(63,208,255,.08)" />
        </pattern>
      </defs>
      <rect width="600" height="300" fill="url(#fm-grid)" />
      {colors.map((c) => {
        const [x, y, r] = pos[c.id];
        return (
          <g key={c.id} class={cx('region', c.id === player && 'is-player')} id={`region-${c.id}`} style={{ color: c.color }}>
            <circle cx={x} cy={y} r={r} fill={c.color} fill-opacity={0.22} stroke={c.color} stroke-width={c.id === player ? 3 : 1.5} />
            <text x={x} y={y + 5} text-anchor="middle" fill="#d8e1f0" font-size="14" font-family="Space Grotesk, sans-serif">
              {c.name.split(' ')[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
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
