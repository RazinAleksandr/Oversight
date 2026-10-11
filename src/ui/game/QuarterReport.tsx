/**
 * Quarter Report overlay shown after End Quarter: calendar flip, meter rows (from → to with reasons),
 * budget, risk clock change, highlights, warnings and headlines — rows animate in sequentially.
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { MeterId, TurnReport } from '../../engine/types';
import { METER_INFO, dateLabel } from '../../engine/labels';
import { audio } from '../../audio';
import { fx } from '../../fx';
import { Icon } from '../components/Icon';
import { RiskClock } from '../components/RiskClock';
import { Sheet } from '../components/Sheet';
import { TweenNum } from '../components/TweenNum';
import { cx, money, signed, toneClass } from '../util';
import { METER_ORDER } from './Hud';
import { cleanWarning } from './Inbox';

/** Number that starts at `from` and tweens to `to` shortly after mount. */
function DelayedTween({ from, to, delay, format }: { from: number; to: number; delay: number; format?: (n: number) => string }): JSX.Element {
  const [v, setV] = useState(from);
  useEffect(() => {
    const t = window.setTimeout(() => setV(to), delay);
    return () => window.clearTimeout(t);
  }, []);
  return <TweenNum value={v} format={format} ms={600} class="num" />;
}

function CalendarFlip({ from, to }: { from: string; to: string }): JSX.Element {
  const [fq, fy] = from.split(' ');
  const [tq, ty] = to.split(' ');
  return (
    <div class="calflip" aria-hidden="true">
      <div class="calflip__page calflip__page--new">
        <span class="calflip__year">{ty}</span>
        <span class="calflip__q">{tq}</span>
      </div>
      <div class="calflip__page calflip__page--old">
        <span class="calflip__year">{fy}</span>
        <span class="calflip__q">{fq}</span>
      </div>
    </div>
  );
}

function MeterRow({ id, r, i }: { id: MeterId; r: TurnReport['meters'][MeterId]; i: number }): JSX.Element {
  // Delta from the displayed (rounded) endpoints so "67 > 67" never reads "−1".
  const d = Math.round(r.to) - Math.round(r.from);
  const status = r.to <= 15 ? 'bad' : r.to <= 30 ? 'warn' : 'ok';
  const reasons = [...r.reasons].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
  return (
    <li class={cx('qrow', `qrow--${status}`)} data-fx="reveal">
      <span class="qrow__icon">
        <Icon name={METER_INFO[id].icon} size={18} />
      </span>
      <span class="qrow__name">{METER_INFO[id].short}</span>
      <span class="qrow__vals">
        <span class="num dim">{Math.round(r.from)}</span>
        <Icon name="chevron_right" size={14} />
        <span class={cx('qrow__to', status !== 'ok' && `is-${status}`)}>
          <DelayedTween from={r.from} to={r.to} delay={350 + i * 120} />
        </span>
      </span>
      <span class={cx('qrow__delta num', d > 0 ? 'is-good' : d < 0 ? 'is-bad' : 'is-flat')}>{signed(d)}</span>
      {reasons.length > 0 && (
        <ul class="qrow__reasons">
          {reasons.map((x, k) => (
            <li key={k}>
              <span>{x.reason}</span>
              <span class={cx('num', x.delta > 0 ? 'is-good' : x.delta < 0 ? 'is-bad' : '')}>{signed(x.delta, Math.abs(x.delta) < 1 && x.delta !== 0 ? 1 : 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function QuarterReport({ report, onContinue }: { report: TurnReport; onContinue(): void }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    audio.play('turn');
    if (ref.current) {
      try {
        fx.staggerIn(ref.current, '[data-fx="reveal"]', 110);
      } catch {
        /* fx optional */
      }
    }
    const crit = METER_ORDER.some((id) => report.meters[id].to <= 15 && report.meters[id].from > 15);
    if (crit) window.setTimeout(() => audio.play('critical'), 900);
    if (report.budget.to > report.budget.from) window.setTimeout(() => audio.play('coin', { volume: 0.6 }), 700);
  }, []);
  const b = report.budget;
  const fromClock = `23:${String(Math.round(60 * Math.min(1, report.risk.from / 100))).padStart(2, '0')}`;
  // Judge movement by the clock the player sees, not sub-minute drift.
  const moved = fromClock !== report.risk.clock;
  const riskUp = moved && report.risk.to > report.risk.from;
  const riskDown = moved && report.risk.to < report.risk.from;
  return (
    <Sheet label={`Quarter report: ${report.dateLabel}`} size="overlay" class="report-sheet">
      <div class="report" ref={ref}>
        <header class="report__head">
          <CalendarFlip from={dateLabel(report.fromTurn)} to={report.dateLabel} />
          <div class="report__headtext">
            <p class="eyebrow">Quarter report</p>
            <h2 class="report__title">{report.dateLabel}</h2>
            <p class="report__sub">
              {report.gameOver ? 'The run has ended.' : `${report.newCards} new briefing${report.newCards === 1 ? '' : 's'} on your desk`}
            </p>
          </div>
        </header>

        <ul class="qrows">
          {METER_ORDER.map((id, i) => (
            <MeterRow key={id} id={id} r={report.meters[id]} i={i} />
          ))}
        </ul>

        <div class="report__pair">
          <div class="qtile" data-fx="reveal">
            <span class="eyebrow">
              <Icon name="budget" size={13} /> Budget
            </span>
            <span class="qtile__big">
              <DelayedTween from={b.from} to={b.to} delay={700} format={(v) => money(v)} />
            </span>
            <span class="qtile__sub num">
              <span class="is-good">{money(b.income, true)} income</span>
              <span class="is-bad">{money(-b.upkeep)} upkeep</span>
            </span>
          </div>
          <div class={cx('qtile qtile--risk', riskUp && 'is-up')} data-fx="reveal">
            <span class="eyebrow">
              <Icon name="clock" size={13} /> Risk clock
            </span>
            <span class="qtile__risk">
              <RiskClock risk={{ estimate: report.risk.to, low: report.risk.to, high: report.risk.to, clock: report.risk.clock }} size={40} />
              <span class="num qtile__clock">
                <span class="dim">{fromClock}</span> → {report.risk.clock}
              </span>
            </span>
            <span class={cx('qtile__sub', riskUp ? 'is-bad' : riskDown ? 'is-good' : '')}>
              {riskUp ? '▲ Closer to midnight' : riskDown ? '▼ The clock moved back' : '◆ Holding steady'}
            </span>
          </div>
        </div>

        {report.warnings.length > 0 && (
          <ul class="warnings" data-fx="reveal">
            {[...new Set(report.warnings.map(cleanWarning))].map((w) => (
              <li key={w} class="warning warning--bad">
                <Icon name="warning" size={15} />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}

        {report.highlights.length > 0 && (
          <section class="report__sec" data-fx="reveal">
            <h3 class="eyebrow">Highlights</h3>
            <ul class="highlights">
              {report.highlights.map((h, i) => (
                <li key={i} class={cx('highlight', `highlight--${toneClass(h.tone)}`)}>
                  <Icon name={h.icon ?? (h.tone === 'bad' ? 'warning' : 'star')} size={16} />
                  <span>{h.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {report.headlines.length > 0 && (
          <section class="report__sec" data-fx="reveal">
            <h3 class="eyebrow">Headlines</h3>
            <ul class="headlines">
              {report.headlines.map((h, i) => (
                <li key={i} class={cx('headline', h.signal && 'headline--signal')}>
                  <span class="headline__outlet">{h.outlet}</span>
                  <span class="headline__text">{h.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div class="report__actions">
          <button type="button" class="btn btn--primary btn--wide" data-autofocus onClick={onContinue}>
            {report.gameOver ? 'See what happened' : 'To the desk'}
            <Icon name="chevron_right" size={18} />
          </button>
        </div>
      </div>
    </Sheet>
  );
}
