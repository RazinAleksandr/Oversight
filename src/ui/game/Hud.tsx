/**
 * HUD top bar: date/era, four national meters, Risk Clock, capacity pips and budget.
 * Plus the detail sheets opened from it (meter "why" sheet, risk explanation).
 */
import type { JSX, Ref } from 'preact';
import type { MeterId, MeterView, RiskView } from '../../engine/types';
import { METER_INFO, dateLabel } from '../../engine/labels';
import { Icon } from '../components/Icon';
import { Bar, Sparkline } from '../components/Bars';
import { RiskClock, riskTone } from '../components/RiskClock';
import { Sheet } from '../components/Sheet';
import { TweenNum } from '../components/TweenNum';
import { cx, money, signed } from '../util';
import { useGame } from './context';

export const METER_ORDER: MeterId[] = ['confidence', 'economy', 'stability', 'security'];

const STATUS_TEXT: Record<MeterView['status'], string> = { ok: 'Stable', strained: 'Strained', critical: 'Critical' };
const statusTone = (s: MeterView['status']) => (s === 'critical' ? 'bad' : s === 'strained' ? 'warn' : 'good');

const TREND_ARROW = { up: '▲', down: '▼', flat: '◆' } as const;
const TREND_TEXT = { up: 'rising', down: 'falling', flat: 'steady' } as const;

export function Hud({ hudRef, onMeter, onRisk, onMenu }: { hudRef: Ref<HTMLElement>; onMeter(id: MeterId): void; onRisk(): void; onMenu(): void }): JSX.Element {
  const { view } = useGame();
  const n = view.nation;
  const net = n.income - n.upkeep;
  return (
    <header class="hud" ref={hudRef}>
      <div class="hud__date">
        <span class="hud__quarter num">{view.dateLabel}</span>
        <span class="hud__era">{view.eraLabel}</span>
        {view.finale || view.turn > view.maxTurns ? (
          <span class="hud__turn hud__turn--final">Final</span>
        ) : (
          <span class="hud__turn num" aria-label={`Quarter ${view.turn} of ${view.maxTurns}`}>
            {view.turn}/{view.maxTurns}
          </span>
        )}
      </div>

      <div class="hud__res">
        <div class="hud__cap" data-hud="capacity" aria-label={`${n.capacity} of ${n.capacityMax} actions left this quarter`} role="img">
          <span class="hud__reslabel">Actions</span>
          <span class="pips" aria-hidden="true">
            {Array.from({ length: Math.max(n.capacityMax, n.capacity) }, (_, i) => (
              <i key={i} class={cx('pip', i < n.capacity && 'is-on')} />
            ))}
          </span>
        </div>
        <div class="hud__budget" data-hud="budget" aria-label={`Budget ${money(n.budget)}, net ${money(net, true)} per quarter`} role="img">
          <Icon name="budget" size={16} />
          <TweenNum value={n.budget} format={(v) => money(v)} class="num hud__money" />
          <span class={cx('hud__net num', net < 0 ? 'is-bad' : 'is-good')}>{money(net, true)}/q</span>
        </div>
        <button type="button" class="iconbtn hud__menu" onClick={onMenu} aria-label="Menu and settings">
          <Icon name="menu" size={20} />
        </button>
      </div>

      <div class="hud__meters">
        {METER_ORDER.map((id) => (
          <MeterButton key={id} m={view.meters[id]} onClick={() => onMeter(id)} />
        ))}
      </div>

      <button
        type="button"
        class={cx('hud__risk', `hud__risk--${riskTone(view.risk.estimate)}`)}
        onClick={onRisk}
        aria-label={`Risk clock ${view.risk.clock}, estimated risk ${Math.round(view.risk.estimate)} (range ${Math.round(view.risk.low)} to ${Math.round(view.risk.high)}), ${TREND_TEXT[view.risk.trend]}. Show details`}
      >
        <RiskClock risk={view.risk} size={46} />
        <span class="hud__clock">
          <span class="num">{view.risk.clock}</span>
          <span class={cx('trend', `trend--${view.risk.trend}`)} aria-hidden="true">
            {TREND_ARROW[view.risk.trend]}
          </span>
        </span>
      </button>
    </header>
  );
}

function MeterButton({ m, onClick }: { m: MeterView; onClick(): void }): JSX.Element {
  const info = METER_INFO[m.id];
  const tone = statusTone(m.status);
  return (
    <button
      type="button"
      class={cx('meter', `meter--${m.status}`)}
      data-meter={m.id}
      onClick={onClick}
      aria-label={`${info.name} ${Math.round(m.value)}, ${STATUS_TEXT[m.status]}${m.lastDelta ? ', last change ' + signed(m.lastDelta) : ''}. Show details`}
    >
      <span class="meter__label">{info.short}</span>
      <span class="meter__val">
        <Icon name={info.icon} size={15} />
        <TweenNum value={m.value} class="num meter__num" />
        {m.status !== 'ok' && <Icon name="warning" size={13} class="meter__warn" />}
        {m.lastDelta !== 0 && (
          <span class={cx('meter__delta num', m.lastDelta > 0 ? 'is-good' : 'is-bad')} aria-hidden="true">
            {signed(m.lastDelta)}
          </span>
        )}
      </span>
      <Bar value={m.value} tone={tone} thin />
    </button>
  );
}

// ───────────── Sheets ─────────────

export function MeterSheet({ id, onClose }: { id: MeterId; onClose(): void }): JSX.Element {
  const { view } = useGame();
  const m = view.meters[id];
  const info = METER_INFO[id];
  const tone = statusTone(m.status);
  const first = Math.max(1, view.turn - m.history.length + 1);
  return (
    <Sheet label={info.name} onClose={onClose} class="detail-sheet">
      <header class="detail__head">
        <span class={cx('detail__icon', `is-${tone}`)}>
          <Icon name={info.icon} size={26} />
        </span>
        <div class="detail__title">
          <p class="eyebrow">National meter</p>
          <h2>{info.name}</h2>
        </div>
        <div class={cx('detail__big num', `is-${tone}`)}>{Math.round(m.value)}</div>
      </header>
      <p class={cx('statusline', `is-${tone}`)}>
        <Icon name={m.status === 'ok' ? 'check' : 'warning'} size={15} />
        {STATUS_TEXT[m.status]}
        {m.status === 'strained' && ' — at 30 or below'}
        {m.status === 'critical' && ' — at 15 or below. Act now.'}
      </p>
      <p class="detail__desc">
        {info.description} <strong>{info.failText}</strong>
      </p>
      <div class="detail__block">
        <h3 class="eyebrow">History</h3>
        <Sparkline values={m.history} tone={tone === 'good' ? 'accent' : tone} lines={[{ at: 30, tone: 'warn' }, { at: 15, tone: 'bad' }]} height={72} />
        <div class="spark-axis num">
          <span>{dateLabel(first)}</span>
          <span>{view.dateLabel}</span>
        </div>
      </div>
      <div class="detail__block">
        <h3 class="eyebrow">Why it changed</h3>
        {m.reasons.length ? (
          <ul class="reasons">
            {m.reasons.map((r, i) => (
              <li key={i} class="reasons__row">
                <span class="reasons__text">{r.reason}</span>
                <span class={cx('reasons__num num', r.delta > 0 ? 'is-good' : r.delta < 0 ? 'is-bad' : '')}>{signed(r.delta, Math.abs(r.delta) < 1 && r.delta !== 0 ? 1 : 0)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="dim">No changes recorded yet this quarter.</p>
        )}
      </div>
    </Sheet>
  );
}

export function RiskSheet({ onClose }: { onClose(): void }): JSX.Element {
  const { view } = useGame();
  const r: RiskView = view.risk;
  const tone = riskTone(r.estimate);
  const u = Math.round((r.high - r.low) / 2);
  return (
    <Sheet label="Risk Clock" onClose={onClose} class="detail-sheet risk-sheet">
      <div class="risk-hero">
        <RiskClock risk={r} size={168} showLabel />
        <div class="risk-hero__text">
          <p class="eyebrow">Global AI risk</p>
          <p class={cx('risk-hero__clock num', `is-${tone}`)}>{r.clock}</p>
          <p class="risk-hero__mins">
            <span class="num">{r.minutesToMidnight}</span> minutes to midnight
          </p>
          <p class={cx('trendline', `trend--${r.trend}`)}>
            {TREND_ARROW[r.trend]} Risk {TREND_TEXT[r.trend]}
          </p>
        </div>
      </div>
      <div class="risk-range">
        <div>
          <span class="eyebrow">Estimate</span>
          <span class="num risk-range__v">{Math.round(r.estimate)}</span>
        </div>
        <div>
          <span class="eyebrow">Range</span>
          <span class="num risk-range__v">
            {Math.round(r.low)}–{Math.round(r.high)}
          </span>
        </div>
        <div>
          <span class="eyebrow">Uncertainty</span>
          <span class="num risk-range__v">±{u}</span>
        </div>
      </div>
      <p class="detail__desc">
        The clock tracks the risk of a global AI catastrophe. The hand marks your analysts' best estimate; the shaded arc is how unsure they are. <strong>The true value is hidden</strong> — at midnight, the world fails.
      </p>
      <ul class="bullets">
        <li>Risk rises when deployed capability outruns safeguards, when threats go unchecked and when the race heats up.</li>
        <li>Funding <strong>Evaluation &amp; Oversight</strong> and signing the <strong>Global Accord</strong> shrink the uncertainty.</li>
        <li>Your estimate can be biased. Better oversight corrects it over time.</li>
      </ul>
      {r.history.length > 1 && (
        <div class="detail__block">
          <h3 class="eyebrow">Estimate history</h3>
          <Sparkline values={r.history} tone={tone} lines={[{ at: 50, tone: 'warn' }, { at: 75, tone: 'bad' }]} height={64} />
        </div>
      )}
    </Sheet>
  );
}
