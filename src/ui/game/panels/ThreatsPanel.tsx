/**
 * Threats: detected situations with stage stepper, fogged severity, cause/source, escalation warnings
 * and response buttons; plus recent warning-sign news. Calm empty state when nothing is detected.
 */
import { SubjectPicker } from '../../components/SubjectPicker';
import type { JSX } from 'preact';
import type { Situation, SituationView } from '../../../engine/types';
import { dateLabel } from '../../../engine/labels';
import { EstimateLine, RangeBar, StageStepper } from '../../components/Bars';
import { CostChips, PreviewChip } from '../../components/Chips';
import { EmptyState, PageHead, rich } from '../../components/Common';
import { Icon } from '../../components/Icon';
import { cx, hasCost } from '../../util';
import { t } from '../../../i18n';
import { followableSignals, useGame } from '../context';
import { NewsList } from '../News';

const RESPONSE_LABEL: Record<Situation['response'], string> = {
  none: t('None'),
  monitor: t('Monitoring'),
  contained: t('Broad containment'),
  restricted: t('Source restricted'),
  suspended: t('Source suspended'),
  shutdown: t('Emergency shutdown'),
  taskforce: t('International task force'),
};

const STAGE_TONE = ['accent', 'warn', 'warn', 'bad', 'bad'] as const;

/** Renders `**…**` segments of a translated sentence in bold (keeps the sentence one key). */
export function ThreatsPanel(): JSX.Element {
  const { view, actions, openAction, sections, selectSection } = useGame();
  const active = view.situations.filter(s=>!s.resolved).sort((a,b)=>b.stage-a.stage || Number(b.escalationWarning)-Number(a.escalationWarning));
  const resolved = view.situations.filter(s=>s.resolved);
  const selected = active.find(s=>s.id===sections.threat) ?? active[0];
  const mode = sections.threatView ?? 'active';
  const signals = view.news.filter(n=>n.signal);
  const followable = followableSignals(view,actions);
  const investigate = actions.find(a=>a.id==='investigate_situation');
  return <div class="page page--threats management-v4 incidents-v5">
    <PageHead title={t('Threats')} sub={t('Detected situations. Undetected ones are still out there.')}/>
    <nav class="panel-sections" aria-label={t('Threats')}>{[['active',t('Active threats')],['signals',t('Warning signs')],['resolved',t('Resolved')]].map(([id,label])=><button type="button" key={id} class={cx('btn',mode===id && 'btn--accent')} aria-pressed={mode===id} onClick={()=>selectSection('threatView',id)}>{label}</button>)}</nav>
    {mode==='active' && (selected ? <div class="management-split"><SubjectPicker kind="threat" label={t('Threats')} value={selected.id} options={active.map(s=>({id:s.id,label:s.name}))} onSelect={id=>selectSection('threat',id)}/><nav class="management-roster" aria-label={t('Active threats')}><h2>{t('Needs attention')}</h2>{active.map(s=><button type="button" key={s.id} class={cx('management-item',selected.id===s.id && 'is-selected',s.escalationWarning && 'has-warning')} aria-pressed={selected.id===s.id} data-threat-select={s.id} onClick={()=>selectSection('threat',s.id)}><strong>{s.name}</strong><span>{s.stageLabel}{s.sourceLabel?` · ${s.sourceLabel}`:''}</span><small>{RESPONSE_LABEL[s.response]}</small>{s.escalationWarning && <small>{t('Escalation expected next quarter')}</small>}</button>)}</nav><div class="management-detail" key={selected.id}><SituationCard s={selected} canInvestigate={!!investigate?.targets?.some(target=>target.id===selected.id)} onInvestigate={()=>openAction('investigate_situation',selected.id)}/></div></div> : <div class="management-detail"><EmptyState icon="eye" title={t('No detected threats')} text={t('Quiet does not mean safe. Funding Evaluation & Oversight lets you see trouble sooner.')}/></div>)}
    {mode==='signals' && <div class="management-detail"><h2>{t('Warning signs')} · {followable.length}</h2><p>{rich(t('Odd reports from the last three quarters. Most are noise. **Following one up** costs an action — if something real is behind it, you catch it before it grows.'),'strong')}</p>{signals.length?<NewsList news={signals} limit={10}/>:<p>{t('No unusual reports. Keep watching the news.')}</p>}</div>}
    {mode==='resolved' && <div class="management-detail"><h2>{t('Resolved')}</h2>{resolved.length?resolved.map(s=><article class="management-resolved" key={s.id}><Icon name={s.icon} size={20}/><h3>{s.name}</h3><span>{s.sourceLabel}</span><strong>{s.outcome==='catastrophe'?t('Catastrophe'):s.outcome==='faded'?t('Faded'):t('Contained')}</strong></article>):<p>{t('No resolved threats yet.')}</p>}</div>}
  </div>;
}

function SituationCard({ s, canInvestigate, onInvestigate }: { s: SituationView; canInvestigate: boolean; onInvestigate(): void }): JSX.Element {
  const { openResponse, actions } = useGame();
  const investigation = actions.find(a=>a.id==='investigate_situation');
  const activeResponse = (id: string) => ({monitor:'monitor',contain:'contained',restrict:'restricted',suspend:'suspended',shutdown:'shutdown',taskforce:'taskforce'} as Record<string,string>)[id] === s.response;
  const tone = STAGE_TONE[s.stage];
  // The engine exposes "investigate" as a response; avoid showing it twice.
  const hasInvestigateResponse = s.responses.some((r) => r.id === 'investigate');
  const responses = [...s.responses].sort((a,b)=>Number(!!a.disabled)-Number(!!b.disabled));
  return (
    <article data-management-threat={s.id} class={cx('panel threat', `threat--${tone}`, s.escalationWarning && 'threat--escalating')}>
      <header class="entity__head incident-heading">
        <span class={cx('threat__icon', `is-${tone}`)}>
          <Icon name={s.icon} size={24} />
        </span>
        <div class="entity__id">
          <h3 class="entity__name">{s.name}</h3>

        </div>
        <span class={cx('stagepill', `stagepill--${s.stage}`)}>{s.stageLabel}</span>
      </header>


      {s.escalationWarning && (
        <p class="threat__warn" role="alert">
          <Icon name="warning" size={16} /> {t('Escalation expected next quarter')}
        </p>
      )}

      <div class="management-threat-state"><p class="threat__src">
        <Icon name="target" size={15} />
        {s.causeKnown && s.sourceLabel ? (
          <span>
            {t('Source:')} <strong>{s.sourceLabel}</strong>
          </span>
        ) : (
          <span>{t('Cause unknown')}</span>
        )}
      </p>
      <p class="threat__resp">
        {t('Current response:')} <strong>{RESPONSE_LABEL[s.response]}</strong>
      </p></div>

      <div class="incident-progression"><StageStepper stage={s.stage}/></div>
      <h3 class="management-response-heading">{t('Available responses')}</h3>
      <div class="responses">
        {canInvestigate && !hasInvestigateResponse && (
          <button type="button" class="respbtn" onClick={onInvestigate}>
            <span class="respbtn__top">
              <Icon name="investigate" size={16} />
              <span class="respbtn__label">{t('Investigate')}</span>
            </span>
            <span class="respbtn__chips">
              <CostChips cost={investigation?.cost} />
            </span>
          </button>
        )}
        {responses.map((r) => (
          <button
            type="button"
            key={r.id}
            class={cx('respbtn', r.disabled && 'is-blocked', activeResponse(r.id) && 'is-current')}
            data-threat-response={r.id} onClick={() => openResponse(s.id, r.id)}
            aria-label={r.disabled ? t('{label}, unavailable: {reason}', { label: r.label, reason: r.disabled }) : r.label}
          >
            <span class="respbtn__top">
              <Icon name={r.id === 'investigate' ? 'investigate' : r.id === 'monitor' ? 'eye' : 'respond'} size={16} />
              <span class="respbtn__label">{r.label}</span>
              {activeResponse(r.id) && <span class="respbtn__cur">{t('Active')}</span>}
            </span>
            {(hasCost(r.cost) || r.preview.length > 0) && (
              <span class="respbtn__chips">
                <CostChips cost={r.cost} />
                {r.preview.map((p, i) => (
                  <PreviewChip key={i} p={p} />
                ))}
              </span>
            )}
            {r.disabled && (
              <span class="respbtn__blocked">
                <Icon name="lock" size={12} /> {r.disabled}
              </span>
            )}
          </button>
        ))}
      </div>
      <section class="management-intelligence"><h3><Icon name="investigate" size={20}/>{t('Situation report')}</h3>          <p class="entity__sub">
            {s.detectedTurn === undefined
              ? s.causeKnown
                ? t('Cause identified')
                : t('Cause unknown')
              : s.detectedTurn > 0
                ? s.causeKnown
                  ? t('Cause identified · detected {date}', { date: dateLabel(s.detectedTurn) })
                  : t('Cause unknown · detected {date}', { date: dateLabel(s.detectedTurn) })
                : s.causeKnown
                  ? t('Cause identified · detected before term')
                  : t('Cause unknown · detected before term')}
          </p>{!s.causeKnown && <p>{t('Source unknown — investigate to unlock targeted responses.')}</p>}
      <p class="threat__text">{s.text}</p>

      <div class="kvs">
        <div class="kvs__head">
          <span class="kv__k">{t('Severity (rough)')}</span>
          <EstimateLine est={s.severity} digits={0} />
        </div>
        <RangeBar est={s.severity} max={100} tone={tone === 'accent' ? 'accent' : tone} />
      </div>

      </section>
    </article>
  );
}
