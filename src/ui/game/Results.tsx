/**
 * Result overlays: the stamped outcome of a briefing choice, and the result of a department action
 * (with revealed intel styled as declassified text). Meter changes float up from the HUD.
 */
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import type { ActionResult, ChoiceResult, MeterChange, Stamp } from '../../engine/types';
import { audio } from '../../audio';
import { fx } from '../../fx';
import { t } from '../../i18n';
import { ChangeChip, mergeChanges } from '../components/Chips';
import { StampMark } from '../components/Common';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { cx } from '../util';

const STAMP_SFX: Partial<Record<Stamp, 'approve' | 'reject'>> = { approved: 'approve', signed: 'approve', rejected: 'reject', denied: 'reject' };


/** Styling heuristic on engine-provided revealed lines (alarming findings in red); covers the Russian wording too. */
const ALERT_LINE = /violation|flaw|warning|наруш|изъян|дефект|тревож/i;

/** Changes are recorded in the receipt. Avoid floating HUD feedback across a new document. */
export function floatChanges(changes: MeterChange[]): void {
  if (changes.some(c => c.key === 'budget' && c.delta > 0)) audio.play('coin');
}

function ResultFrame({ inline, label, children }: { inline?: boolean; label: string; children: ComponentChildren }): JSX.Element {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (inline) { ref.current?.scrollIntoView({ block: 'start' }); ref.current?.focus({ preventScroll: true }); }
  }, []);
  return inline ? <section ref={ref} tabIndex={-1} class="result-sheet result-receipt" aria-label={label}>{children}</section>
    : <Sheet label={label} size="page" class="result-sheet result-page">{children}</Sheet>;
}

function ChangeList({ changes }: { changes: MeterChange[] }): JSX.Element | null {
  const ref = useRef<HTMLUListElement>(null);
  const merged = mergeChanges(changes);
  useEffect(() => {
    if (ref.current) {
      try {
        fx.staggerIn(ref.current, '[data-fx="reveal"]', 90);
      } catch {
        /* fx optional */
      }
    }
  }, []);
  if (!merged.length) return null;
  return (
    <ul class="result__changes" ref={ref} aria-label={t('Immediate changes')}>
      {merged.map((c, i) => (
        <li key={i} data-fx="reveal">
          <ChangeChip c={c} big />
        </li>
      ))}
    </ul>
  );
}

export function ChoiceResultOverlay({
  result,
  inline,
  remaining,
  onNext,
  onDesk,
}: {
  result: ChoiceResult;
  inline?: boolean;
  remaining: number;
  onNext(): void;
  onDesk(): void;
}): JSX.Element {
  const stamp: Stamp = result.stamp ?? (result.success === false ? 'denied' : 'noted');
  const tone = result.success === false ? 'bad' : result.success === true ? 'good' : STAMP_SFX[stamp] === 'reject' ? 'bad' : 'neutral';
  useEffect(() => {
    const sfx = STAMP_SFX[stamp];
    if (sfx) audio.play(sfx);
    const t1 = window.setTimeout(() => {
      audio.play('stamp');

    }, 260);
    const t2 = window.setTimeout(() => {
      if (result.success === true) audio.play('success');
      if (result.success === false) audio.play('fail');
    }, 520);
    floatChanges(result.changes);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);
  const primary = result.gameOver
    ? t('See what happened')
    : result.nextCardUid
      ? t('Continue')
      : remaining > 0
        ? t('Next briefing ({n})', { n: remaining })
        : t('Back to desk');
  return (
    <ResultFrame label={t('Decision recorded')} inline={inline}>
      <div class={cx('result', `result--${tone}`)}>
        <div class="result__stampzone">
          <StampMark stamp={stamp} size="lg" class="result__stamp" />
        </div>
        <p class="result__card">{result.title}</p>
        {result.success !== undefined && (
          <p class={cx('result__verdict', result.success ? 'is-good' : 'is-bad')}>
            <Icon name={result.success ? 'check' : 'cross'} size={15} /> {result.success ? t('It worked') : t('It failed')}
          </p>
        )}
        <p class="result__text">{result.text}</p>
        <ChangeList changes={result.changes} />
        <div class="result__actions">
          <button type="button" class="btn btn--primary btn--wide" data-autofocus onClick={onNext}>
            {primary}
            <Icon name="chevron_right" size={18} />
          </button>
          {!result.gameOver && remaining > 0 && !result.nextCardUid && (
            <button type="button" class="btn btn--ghost" onClick={onDesk}>
              {t('Back to desk')}
            </button>
          )}
        </div>
      </div>
    </ResultFrame>
  );
}

export function ActionResultOverlay({ result, inline, onClose }: { result: ActionResult; inline?: boolean; onClose(): void }): JSX.Element {
  const revealed = result.revealed ?? [];
  const tone = result.success === false ? 'bad' : 'good';
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (revealed.length) audio.play('reveal');
    else audio.play(result.success === false ? 'fail' : 'success');
    floatChanges(result.changes);
    if (listRef.current) {
      try {
        fx.staggerIn(listRef.current, '[data-fx="reveal"]', 260);
      } catch {
        /* fx optional */
      }
    }
  }, []);
  return (
    <ResultFrame label={t('Action result')} inline={inline}>
      <div class={cx('result', `result--${tone}`, 'result--action')}>
        <div class="result__stampzone">
          <StampMark text={result.success === false ? t('Compromised') : revealed.length ? t('Declassified') : t('Complete')} size="lg" class={cx('result__stamp', result.success === false ? 'stamp--denied' : revealed.length ? 'stamp--classified' : 'stamp--approved')} />
        </div>
        <p class="result__card">{result.title}</p>
        <p class="result__text">{result.text}</p>
        {revealed.length > 0 && (
          <div class="declass">
            <p class="declass__head">{t('Declassified — eyes only')}</p>
            <ul class="declass__list" ref={listRef}>
              {revealed.map((r, i) => (
                <li key={i} data-fx="reveal" class={cx('declass__line', ALERT_LINE.test(r) && 'is-alert')}>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        <ChangeList changes={result.changes} />
        <div class="result__actions">
          <button type="button" class="btn btn--primary btn--wide" data-autofocus onClick={onClose}>
            {result.gameOver ? t('See what happened') : t('Continue')}
            <Icon name="chevron_right" size={18} />
          </button>
        </div>
      </div>
    </ResultFrame>
  );
}
