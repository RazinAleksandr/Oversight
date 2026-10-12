/** A focused decision: inspect the evidence, compare options, then commit explicitly. */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Card, Choice, EvidenceLine } from '../../engine/types';
import { SOURCE_INFO } from '../../engine/labels';
import { getLang, t } from '../../i18n';
import { Icon } from '../components/Icon';
import { ChanceBadge, ConfBadge, CostChips, PreviewChip, UncertainChip } from '../components/Chips';
import { Sheet } from '../components/Sheet';
import { clamp, cx, hash, money } from '../util';
import { advisorInfo, useGame } from './context';
import { DemandForecast } from './DemandForecast';

/** Reason a choice can't be taken right now (engine-provided, or an affordability check). */
export function choiceBlock(ch: Choice, res: { capacity: number; budget: number; evidence: number }): string | null {
  const c = ch.cost;
  if (!c) return ch.disabled ?? null;
  if (c.capacity && res.capacity < c.capacity) return t('No actions left this quarter');
  if (c.budget && res.budget < c.budget) return t('Need {cost}; available {available}; shortfall {shortfall}.', {
    cost: money(c.budget), available: money(res.budget), shortfall: money(Math.ceil((c.budget - res.budget) * 100) / 100),
  });
  if (c.evidence && res.evidence < c.evidence) return t('You hold no evidence');
  return ch.disabled ?? null;
}

/**
 * The Threshold's choices carry "Estimated control: 70–85%." in their hint (no `chance` on purpose).
 * Translated hints keep the shape "<label>: 70–85%." at the end, so non-English text matches any label.
 */
export function parseControl(hint?: string): { low: number; high: number; rest: string } | null {
  if (!hint) return null;
  const m = /Estimated control:\s*(\d+)\s*[–-]\s*(\d+)%\.?/i.exec(hint) ?? (getLang() === 'en' ? null : /[^.!?:]*:\s*(\d+)\s*[–-]\s*(\d+)\s*%\.?\s*$/.exec(hint));
  if (!m) return null;
  return { low: Number(m[1]), high: Number(m[2]), rest: hint.replace(m[0], '').trim() };
}

function ControlMeter({ low, high }: { low: number; high: number }): JSX.Element {
  const mid = (low + high) / 2;
  const tone = mid >= 70 ? 'good' : mid >= 45 ? 'warn' : 'bad';
  return (
    <span class={cx('control', `control--${tone}`)} aria-label={t('Estimated chance of keeping control: {low} to {high} percent', { low, high })}>
      <span class="control__label">{t('Control')}</span>
      <span class="control__track" aria-hidden="true">
        <span class="control__span" style={{ left: `${clamp(low, 0, 100)}%`, width: `${Math.max(2, clamp(high, 0, 100) - clamp(low, 0, 100))}%` }} />
      </span>
      <span class="control__num num">
        {low}–{high}%
      </span>
    </span>
  );
}

export function BriefingSheet({ card, onClose, onChoose }: { card: Card; onClose(): void; onChoose(ch: Choice): void }): JSX.Element {
  const { view } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const res = { capacity: view.nation.capacity, budget: view.nation.budget, evidence: view.nation.evidence.length };
  const choice = card.choices.find(c => c.id === selected);
  const blocked = choice ? choiceBlock(choice, res) : null;
  const forecast = view.government.demands.find(d => d.id === card.ctx.demandId)?.forecast;
  const paragraphs = card.body.split(/\n\s*\n/).filter(Boolean);
  const summary = card.kind === 'intro'
    ? t('You lead the national AI department. Keep your job, protect the country, and guide the transition. What will you prioritize?')
    : paragraphs[0] ?? card.body;
  const extraStory = card.kind === 'intro' || paragraphs.length > 1;
  const lowEvidence = card.evidence?.some(e => e.confidence === 'low' || e.confidence === 'redacted');
  const pick = (id: string) => {
    setSelected(id);
  };
  useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [selected]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (detailRef.current?.closest('[inert]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const i = Number(e.key) - 1;
      if (!Number.isInteger(i) || i < 0 || i >= card.choices.length) return;
      e.preventDefault(); pick(card.choices[i].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card.uid]);
  const control = parseControl(choice?.hint);
  return (
    <Sheet label={t('Briefing: {title}', { title: card.title })} onClose={onClose} size="page" closeButton={false} class="briefing-sheet decision-page">
      <header class="decision-page__bar">
        <button type="button" class="linkbtn" onClick={onClose}><Icon name="back" size={18} />{t('Desk')}</button>
        <span>{view.dateLabel}</span>
        <span>{t('{n} remaining', { n: view.inbox.length })}</span>
      </header>
      <div class="decision-page__scroll">
        <div class="decision-page__context">
          <header class="decision-page__heading">
            <p class="decision-page__source">{card.source.name} · {SOURCE_INFO[card.source.type].label}</p>
            <h1 class="dossier__title">{card.title}</h1>
            {card.urgency === 'critical' && <p class="decision-page__urgent"><Icon name="warning" size={16} />{t('Urgent')}</p>}
          </header>
          <p class="decision-page__summary">{summary}</p>
          {extraStory && <details class="briefing-detail"><summary>{t('Full briefing')}</summary><div>{paragraphs.map((p,i) => <p key={i}>{p}</p>)}</div></details>}
          {!!card.evidence?.length && <details class="briefing-detail briefing-detail--evidence">
            <summary>{t('Evidence')}<span>{lowEvidence ? t('Incomplete picture') : t('{n} findings', { n: card.evidence.length })}</span></summary>
            <section class="evidence" aria-label={t('Evidence')}>
              <dl class="evidence__list">{card.evidence.map((e,i)=><EvidenceRow key={i} e={e} seed={hash(card.uid+i)} />)}</dl>
              {card.kind === 'deployment' && <><p class="briefing-note">{t('A negative result is not proof of safety.')}</p><p class="briefing-note">{t('Approval raises an adoption target. Actual use grows over later quarters. Investigating costs time and resources, but can reveal missed problems.')}</p></>}
            </section>
          </details>}
          {!!card.advisors?.length && <details class="briefing-detail">
            <summary>{t('Advisors')}<span>{t('Different priorities')}</span></summary>
            <section class="advisors" aria-label={t('Advisor notes')}>{card.advisors.map(n=>{
              const a=advisorInfo(view,n.advisor);
              return <figure key={n.advisor}><figcaption><strong>{a.role}</strong><blockquote>{n.text}</blockquote></figcaption></figure>;
            })}</section>
          </details>}
          {card.kind === 'threshold' && <p class="briefing-note">{t('Control is uncertain even after strong preparation. The range is an estimate; this decision can end the run.')}</p>}
          {forecast && <DemandForecast forecast={forecast} />}
        </div>
        <section class="decision" aria-label={t('Your decision')}>
          <h2 class="decision__title">{t('Your decision')}</h2>
          <div class="choices" role="radiogroup" aria-label={t('Your decision')}>
            {card.choices.map((ch,i)=>{
              const reason=choiceBlock(ch,res);
              return <button key={ch.id} type="button" role="radio" aria-checked={selected===ch.id} aria-controls="decision-detail" data-choice={i+1} data-blocked={!!reason}
                class={cx('choice',selected===ch.id && 'is-selected',reason && 'is-blocked')} onClick={()=>pick(ch.id)}>
                <span class="choice__radio" aria-hidden="true" /><span class="choice__label">{ch.label}</span>
                {reason && <Icon name="lock" size={16} />}
              </button>;
            })}
          </div>
          <section ref={detailRef} id="decision-detail" class="decision-detail" aria-live="polite" aria-atomic="true">
            {choice ? <>
              <h3>{choice.label}</h3>
              {(control?.rest ?? choice.hint) && <p>{control?.rest ?? choice.hint}</p>}
              {control && <ControlMeter low={control.low} high={control.high} />}
              {choice.chance!==undefined && <p><ChanceBadge chance={choice.chance} /></p>}
              <div class="choice__chips">{choice.preview.map((p,i)=><PreviewChip key={i} p={p} adoptionTarget={card.kind==='deployment'} />)}</div>
              {choice.uncertain && <UncertainChip />}
              {choice.cost && <p class="decision-detail__cost"><CostChips cost={choice.cost} /></p>}
              {blocked && <p class="choice__blocked"><Icon name="lock" size={16} />{blocked}</p>}
            </> : <p class="decision-detail__hint">{t('Select an option to compare its effects. Nothing is committed yet.')}</p>}
          </section>
        </section>
      </div>
      <footer class="decision-page__footer">
        <div class="decision-page__resources"><span>{t('Available')}</span><span>{money(res.budget)}</span><span>{t('{n} actions', { n: res.capacity })}</span></div>
        {choice && <button type="button" data-confirm-choice class="btn btn--primary btn--wide" disabled={!!blocked} onClick={()=>!blocked && onChoose(choice)}>{t('Confirm: {choice}',{choice:choice.label})}<Icon name="chevron_right" size={18} /></button>}
      </footer>
    </Sheet>
  );
}

function EvidenceRow({ e, seed }: { e: EvidenceLine; seed: number }): JSX.Element {
  const redacted = e.confidence === 'redacted';
  return (
    <div class={cx('evidence__row', redacted && 'is-redacted')}>
      <dt class="evidence__label">{e.label}</dt>
      <dd class="evidence__value">
        {redacted ? (
          <span class="redact" aria-label={t('Redacted')}>
            <span class="redact__bar" style={{ width: `${55 + (seed % 35)}%` }} />
            {seed % 3 === 0 && <span class="redact__bar redact__bar--short" style={{ width: `${20 + (seed % 25)}%` }} />}
          </span>
        ) : (
          <span class="evidence__text">{e.value}</span>
        )}
        <ConfBadge c={e.confidence} />
      </dd>
    </div>
  );
}

