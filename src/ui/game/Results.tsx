/** Consequences are a readable part of the turn, with one clear onward action. */
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import type { ActionResult, ChoiceResult, MeterChange, Stamp } from '../../engine/types';
import { audio } from '../../audio';
import { t } from '../../i18n';
import { ChangeChip, mergeChanges } from '../components/Chips';
import { STAMP_TEXT } from '../components/Common';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { changeText, cx } from '../util';

const STAMP_SFX: Partial<Record<Stamp, 'approve' | 'reject'>> = { approved: 'approve', signed: 'approve', rejected: 'reject', denied: 'reject' };
export function floatChanges(changes: MeterChange[]): void {
  if (changes.some(c => c.key === 'budget' && c.delta > 0)) audio.play('coin');
}

export function ResolutionPage({ result, label, primary, onNext, onDesk, inline = false, investigation = false, pilot = false }: {
  result: ActionResult | ChoiceResult; label: string; primary: string; onNext(): void; onDesk?(): void;
  inline?: boolean; investigation?: boolean; pilot?: boolean;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const changes = mergeChanges(result.changes);
  const stamp = 'stamp' in result ? result.stamp : undefined;
  const reasonsFor = (key: MeterChange['key']) => [...new Set(result.changes.filter(c => c.key === key).map(c => c.reason).filter(Boolean))];
  // Engine records the adoption key only from changeAdoptionTarget; actual uptake occurs on later ticks.
  const immediateChanges = changes.filter(c => c.key !== 'adoption');
  const adoptionTargets = changes.filter(c => c.key === 'adoption');
  const revealed = 'revealed' in result ? result.revealed ?? [] : [];
  useLayoutEffect(() => {
    if (inline) { ref.current?.scrollIntoView({ block: 'start' }); ref.current?.focus({ preventScroll: true }); }
  }, []);
  const content = <div ref={ref} tabIndex={inline ? -1 : undefined} class={cx('rv4-shell result', result.success === false && 'is-failure')} data-action-result={!('cardUid' in result) || undefined} data-inspection-result={investigation || undefined} data-pilot-result={pilot && !investigation || undefined}>
    <header class="rv4-status"><Icon name={result.success === false ? 'warning' : investigation ? 'investigate' : 'check'} size={22} /><strong>{label}</strong>{result.success !== undefined && <span>{result.success ? t('It worked') : t('It failed')}</span>}</header>
    <main class="rv4-body">
      <section class="rv4-narrative">{stamp && <div class={cx('receipt-seal', `receipt-seal--${stamp}`)}>{STAMP_TEXT[stamp]}</div>}<h1 class="result__card">{result.title}</h1><p class="result__text">{result.text}</p>
        {investigation && <p class="rv4-note">{t('These findings update the company record. The original model evaluation remains a separate report. A negative investigation is not proof of safety.')}</p>}
      </section>
      <section class="rv4-facts">
        {immediateChanges.length > 0 && <><h2>{t('Immediate changes')}</h2><ul class="result__changes rv4-changes">{immediateChanges.map((c, i) => <li key={i}><ChangeChip c={c} /><div class="receipt-causes">{reasonsFor(c.key).map(reason => <p key={reason}>{reason}</p>)}</div></li>)}</ul></>}
        {adoptionTargets.length > 0 && <section class="rv4-adoption-target"><h2>{t('Adoption target')}</h2><ul class="rv4-changes">{adoptionTargets.map((c, i) => <li key={i}><span class={cx('chip', c.delta > 0 ? 'chip--good' : 'chip--bad')}><Icon name="adoption" size={14} /><span class="chip__label">{t('Adoption target')}</span><span class="chip__num">{changeText(c.key, c.delta)}</span></span></li>)}</ul><p class="rv4-note">{t('Adoption changes over later quarters, not immediately.')}</p></section>}
        {revealed.length > 0 && <><h2>{t('Investigation findings')}</h2><ul class="rv4-findings">{revealed.map((line, i) => <li key={i}>{line}</li>)}</ul></>}
        {changes.length === 0 && revealed.length === 0 && <div class="rv4-quiet"><Icon name="clock" size={40} /><p>{t('No immediate visible effects')}</p></div>}
      </section>
    </main>
    <footer class="rv4-dock result__actions">
      {onDesk && <button type="button" class="rv4-secondary" onClick={onDesk}>{t('Back to desk')}</button>}
      <button type="button" class="rv4-primary btn--primary" data-autofocus data-return-decision={investigation || undefined} data-result-continue onClick={onNext}>{primary}<Icon name="chevron_right" size={18} /></button>
    </footer>
  </div>;
  return inline ? <section class="result-sheet result-receipt outcome-v4 receipt-v5 rv4-inline" aria-label={label}>{content}</section>
    : <Sheet size="page" closeButton={false} label={label} class="result-sheet outcome-v4 receipt-v5">{content}</Sheet>;
}

export function ChoiceResultOverlay({ result, inline, remaining, onNext, onDesk }: {
  result: ChoiceResult; inline?: boolean; remaining: number; onNext(): void; onDesk(): void;
}): JSX.Element {
  useEffect(() => {
    const sound = STAMP_SFX[result.stamp ?? 'noted'];
    if (sound) audio.play(sound);
    else audio.play(result.success === false ? 'fail' : 'success');
    floatChanges(result.changes);
  }, []);
  const primary = result.gameOver ? t('See what happened') : result.nextCardUid ? t('Continue') : remaining > 0 ? t('Next briefing ({n})', { n: remaining }) : t('Back to desk');
  return <ResolutionPage result={result} inline={inline} label={t('Decision recorded')} primary={primary} onNext={onNext} onDesk={!result.gameOver && remaining > 0 && !result.nextCardUid ? onDesk : undefined} />;
}

export function ActionResultOverlay({ result, inline, onClose }: { result: ActionResult; inline?: boolean; onClose(): void }): JSX.Element {
  useEffect(() => {
    audio.play(result.revealed?.length ? 'reveal' : result.success === false ? 'fail' : 'success');
    floatChanges(result.changes);
  }, []);
  return <ResolutionPage result={result} inline={inline} label={t('Action result')} primary={result.gameOver ? t('See what happened') : t('Continue')} onNext={onClose} />;
}
