/**
 * Threats: detected situations with stage stepper, fogged severity, cause/source, escalation warnings
 * and response buttons; plus recent warning-sign news. Calm empty state when nothing is detected.
 */
import type { JSX } from 'preact';
import type { Situation, SituationView } from '../../../engine/types';
import { dateLabel } from '../../../engine/labels';
import { EstimateLine, RangeBar, StageStepper } from '../../components/Bars';
import { CostChips, PreviewChip } from '../../components/Chips';
import { EmptyState, PageHead, Section } from '../../components/Common';
import { Icon } from '../../components/Icon';
import { cx, hasCost } from '../../util';
import { followableSignals, useGame } from '../context';
import { NewsList } from '../News';

const RESPONSE_LABEL: Record<Situation['response'], string> = {
  none: 'None',
  monitor: 'Monitoring',
  contained: 'Broad containment',
  restricted: 'Source restricted',
  suspended: 'Source suspended',
  shutdown: 'Emergency shutdown',
  taskforce: 'International task force',
};

const STAGE_TONE = ['accent', 'warn', 'warn', 'bad', 'bad'] as const;

export function ThreatsPanel(): JSX.Element {
  const { view, actions, openAction } = useGame();
  const active = view.situations.filter((s) => !s.resolved).sort((a, b) => b.stage - a.stage || Number(b.escalationWarning) - Number(a.escalationWarning));
  const resolved = view.situations.filter((s) => s.resolved);
  const signals = view.news.filter((n) => n.signal);
  const followable = followableSignals(view, actions);
  const investigate = actions.find((a) => a.id === 'investigate_situation');
  return (
    <div class="page page--threats">
      <PageHead title="Threats" sub="Detected situations. Undetected ones are still out there." />
      {active.length === 0 ? (
        <EmptyState icon="eye" title="No detected threats" text="Quiet does not mean safe. Funding Evaluation & Oversight lets you see trouble sooner." />
      ) : (
        <div class="cardgrid cardgrid--threats">
          {active.map((s) => (
            <SituationCard key={s.id} s={s} canInvestigate={!!investigate?.targets?.some((t) => t.id === s.id)} onInvestigate={() => openAction('investigate_situation', s.id)} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <Section title="Resolved" icon="check">
          <ul class="resolved">
            {resolved.map((s) => (
              <li key={s.id} class="resolved__row">
                <Icon name={s.icon} size={16} />
                <span class="resolved__name">{s.name}</span>
                <span class={cx('pill', s.outcome === 'catastrophe' ? 'pill--bad' : 'pill--good')}>{s.outcome === 'catastrophe' ? 'Catastrophe' : s.outcome === 'faded' ? 'Faded' : 'Contained'}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Warning signs" icon="news" aside={<span class="dim small">{followable.length ? `${followable.length} worth a look` : 'Possible early signals'}</span>} class="signals">
        <div class={cx('panel signals__panel', followable.length > 0 && 'has-followable')}>
          <p class="signals__intro">
            Odd reports from the last three quarters. Most are noise. <strong>Following one up</strong> costs an action — if something real is behind it, you catch it before it grows.
          </p>
          {signals.length ? <NewsList news={signals} limit={10} /> : <p class="dim small">No unusual reports. Keep watching the news.</p>}
        </div>
      </Section>
    </div>
  );
}

function SituationCard({ s, canInvestigate, onInvestigate }: { s: SituationView; canInvestigate: boolean; onInvestigate(): void }): JSX.Element {
  const { openResponse } = useGame();
  const tone = STAGE_TONE[s.stage];
  // The engine exposes "investigate" as a response; avoid showing it twice.
  const hasInvestigateResponse = s.responses.some((r) => r.id === 'investigate');
  return (
    <article class={cx('panel threat', `threat--${tone}`, s.escalationWarning && 'threat--escalating')}>
      <header class="entity__head">
        <span class={cx('threat__icon', `is-${tone}`)}>
          <Icon name={s.icon} size={24} />
        </span>
        <div class="entity__id">
          <h3 class="entity__name">{s.name}</h3>
          <p class="entity__sub">
            {s.causeKnown ? 'Cause identified' : 'Cause unknown'}
            {s.detectedTurn !== undefined && ` · detected ${s.detectedTurn > 0 ? dateLabel(s.detectedTurn) : 'before term'}`}
          </p>
        </div>
        <span class={cx('stagepill', `stagepill--${s.stage}`)}>{s.stageLabel}</span>
      </header>

      <StageStepper stage={s.stage} />

      {s.escalationWarning && (
        <p class="threat__warn" role="alert">
          <Icon name="warning" size={16} /> Escalation expected next quarter
        </p>
      )}

      <p class="threat__text">{s.text}</p>

      <div class="kvs">
        <div class="kvs__head">
          <span class="kv__k">Severity (rough)</span>
          <EstimateLine est={s.severity} digits={0} />
        </div>
        <RangeBar est={s.severity} max={100} tone={tone === 'accent' ? 'accent' : tone} />
      </div>

      <p class="threat__src">
        <Icon name="target" size={15} />
        {s.causeKnown && s.sourceLabel ? (
          <span>
            Source: <strong>{s.sourceLabel}</strong>
          </span>
        ) : (
          <span>Source unknown — investigate to unlock targeted responses.</span>
        )}
      </p>
      <p class="threat__resp">
        Current response: <strong>{RESPONSE_LABEL[s.response]}</strong>
      </p>

      <div class="responses">
        {canInvestigate && !hasInvestigateResponse && (
          <button type="button" class="respbtn" onClick={onInvestigate}>
            <span class="respbtn__top">
              <Icon name="investigate" size={16} />
              <span class="respbtn__label">Investigate</span>
            </span>
            <span class="respbtn__chips">
              <CostChips cost={{ capacity: 1 }} />
            </span>
          </button>
        )}
        {s.responses.map((r) => (
          <button
            type="button"
            key={r.id}
            class={cx('respbtn', r.disabled && 'is-blocked', r.id === s.response && 'is-current')}
            onClick={() => openResponse(s.id, r.id)}
            aria-label={`${r.label}${r.disabled ? ', unavailable: ' + r.disabled : ''}`}
          >
            <span class="respbtn__top">
              <Icon name={r.id === 'investigate' ? 'investigate' : r.id === 'monitor' ? 'eye' : 'respond'} size={16} />
              <span class="respbtn__label">{r.label}</span>
              {r.id === s.response && <span class="respbtn__cur">Active</span>}
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
    </article>
  );
}
