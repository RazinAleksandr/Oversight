/**
 * HUD top bar: date/era, four national meters, Risk Clock, capacity pips and budget.
 * Plus the detail sheets opened from it (meter "why" sheet, risk explanation).
 */
import type { JSX, Ref } from 'preact';
import type { MeterId, MeterView, RiskView } from '../../engine/types';
import { METER_INFO, dateLabel } from '../../engine/labels';
import { getLang, t, tp } from '../../i18n';
import { Icon } from '../components/Icon';
import { Bar, Sparkline } from '../components/Bars';
import { rich } from '../components/Common';
import { RiskClock, riskTone } from '../components/RiskClock';
import { Sheet } from '../components/Sheet';
import { TweenNum } from '../components/TweenNum';
import { cx, money, signed } from '../util';
import { useGame } from './context';

export const METER_ORDER: MeterId[] = ['confidence', 'economy', 'stability', 'security'];

const STATUS_TEXT: Record<MeterView['status'], string> = { ok: t('Stable'), strained: t('Strained'), critical: t('Critical') };
const statusTone = (s: MeterView['status']) => (s === 'critical' ? 'bad' : s === 'strained' ? 'warn' : 'good');

/**
 * Compact meter names for phone HUDs in languages whose names run long (Russian). English shows
 * METER_INFO.short everywhere; a missing translation falls back to it too.
 */
const HUD_ABBR: Partial<Record<MeterId, string>> =
  getLang() === 'en'
    ? { confidence: t('Conf'), economy: t('Pros'), stability: t('Stab'), security: t('Sec') }
    : { confidence: t('[HUD] Confidence'), economy: t('[HUD] Prosperity'), stability: t('[HUD] Stability'), security: t('[HUD] Security') };

function MeterLabel({ id, short }: { id: MeterId; short: string }): JSX.Element {
  const abbr = HUD_ABBR[id];
  if (!abbr || abbr.startsWith('[HUD]') || abbr === short) return <span class="meter__label">{short}</span>;
  return (
    <span class="meter__label">
      <span class="meter__full">{short}</span>
      <span class="meter__abbr" aria-hidden="true">
        {abbr}
      </span>
    </span>
  );
}

const TREND_ARROW = { up: '▲', down: '▼', flat: '◆' } as const;
const TREND_TEXT = { up: t('rising'), down: t('falling'), flat: t('steady') };
const RISK_TREND = { up: t('Risk rising'), down: t('Risk falling'), flat: t('Risk steady') };

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
          <span class="hud__turn hud__turn--final">{t('Final')}</span>
        ) : (
          <span class="hud__turn num" aria-label={t('Quarter {n} of {total}', { n: view.turn, total: view.maxTurns })}>
            {view.turn}/{view.maxTurns}
          </span>
        )}
      </div>

      <div class="hud__res">
        <div class="hud__cap" data-hud="capacity" aria-label={t('{n} of {max} actions left this quarter', { n: n.capacity, max: n.capacityMax })} role="img">
          <span class="hud__reslabel">{t('Actions')}</span>
          <span class="pips" aria-hidden="true">
            {Array.from({ length: Math.max(n.capacityMax, n.capacity) }, (_, i) => (
              <i key={i} class={cx('pip', i < n.capacity && 'is-on')} />
            ))}
          </span>
        </div>
        <div class="hud__budget" data-hud="budget" aria-label={t('Budget {budget}, net {net} per quarter', { budget: money(n.budget), net: money(net, true) })} role="img">
          <Icon name="budget" size={16} />
          <TweenNum value={n.budget} format={(v) => money(v)} class="num hud__money" />
          <span class={cx('hud__net num', net < 0 ? 'is-bad' : 'is-good')}>{t('{amount}/q', { amount: money(net, true) })}</span>
        </div>
        <button type="button" class="iconbtn hud__menu" onClick={onMenu} aria-label={t('Menu and settings')}>
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
        aria-label={t('Risk clock {clock}, estimated risk {est} (range {low} to {high}), {trend}. Show details', {
          clock: view.risk.clock,
          est: Math.round(view.risk.estimate),
          low: Math.round(view.risk.low),
          high: Math.round(view.risk.high),
          trend: TREND_TEXT[view.risk.trend],
        })}
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
      aria-label={
        m.lastDelta
          ? t('{name} {value}, {status}, last change {delta}. Show details', { name: info.name, value: Math.round(m.value), status: STATUS_TEXT[m.status], delta: signed(m.lastDelta) })
          : t('{name} {value}, {status}. Show details', { name: info.name, value: Math.round(m.value), status: STATUS_TEXT[m.status] })
      }
    >
      <MeterLabel id={m.id} short={info.short} />
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

/** "<n> minutes to midnight" with the number styled as a figure. */
function minutesToMidnight(n: number): JSX.Element {
  const [before, after] = tp(n, '{n} minute to midnight', '{n} minutes to midnight').split(String(n));
  return (
    <>
      {before}
      <span class="num">{n}</span>
      {after}
    </>
  );
}

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
          <p class="eyebrow">{t('National meter')}</p>
          <h2>{info.name}</h2>
        </div>
        <div class={cx('detail__big num', `is-${tone}`)}>{Math.round(m.value)}</div>
      </header>
      <p class={cx('statusline', `is-${tone}`)}>
        <Icon name={m.status === 'ok' ? 'check' : 'warning'} size={15} />
        {m.status === 'strained' ? t('{status} — at 30 or below', { status: STATUS_TEXT[m.status] }) : m.status === 'critical' ? t('{status} — at 15 or below. Act now.', { status: STATUS_TEXT[m.status] }) : STATUS_TEXT[m.status]}
      </p>
      <p class="detail__desc">
        {info.description} <strong>{info.failText}</strong>
      </p>
      <div class="detail__block">
        <h3 class="eyebrow">{t('History')}</h3>
        <Sparkline values={m.history} tone={tone === 'good' ? 'accent' : tone} lines={[{ at: 30, tone: 'warn' }, { at: 15, tone: 'bad' }]} height={72} />
        <div class="spark-axis num">
          <span>{dateLabel(first)}</span>
          <span>{view.dateLabel}</span>
        </div>
      </div>
      <div class="detail__block">
        <h3 class="eyebrow">{t('Why it changed')}</h3>
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
          <p class="dim">{t('No changes recorded yet this quarter.')}</p>
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
    <Sheet label={t('Risk Clock')} onClose={onClose} class="detail-sheet risk-sheet">
      <div class="risk-hero">
        <RiskClock risk={r} size={168} showLabel />
        <div class="risk-hero__text">
          <p class="eyebrow">{t('Global AI risk')}</p>
          <p class={cx('risk-hero__clock num', `is-${tone}`)}>{r.clock}</p>
          <p class="risk-hero__mins">
            {minutesToMidnight(r.minutesToMidnight)}
          </p>
          <p class={cx('trendline', `trend--${r.trend}`)}>
            {TREND_ARROW[r.trend]} {RISK_TREND[r.trend]}
          </p>
        </div>
      </div>
      <div class="risk-range">
        <div>
          <span class="eyebrow">{t('Estimate')}</span>
          <span class="num risk-range__v">{Math.round(r.estimate)}</span>
        </div>
        <div>
          <span class="eyebrow">{t('Range')}</span>
          <span class="num risk-range__v">
            {Math.round(r.low)}–{Math.round(r.high)}
          </span>
        </div>
        <div>
          <span class="eyebrow">{t('Uncertainty')}</span>
          <span class="num risk-range__v">±{u}</span>
        </div>
      </div>
      <p class="detail__desc">
        {rich(t("The clock tracks the risk of a global AI catastrophe. The hand marks your analysts' best estimate; the shaded arc is how unsure they are. **The true value is hidden** — at midnight, the world fails."), 'strong')}
      </p>
      <ul class="bullets">
        <li>{t('Risk rises when deployed capability outruns safeguards, when threats go unchecked and when the race heats up.')}</li>
        <li>{rich(t('Funding **Evaluation & Oversight** and signing the **Global Accord** shrink the uncertainty.'), 'strong')}</li>
        <li>{t('Your estimate can be biased. Better oversight corrects it over time.')}</li>
      </ul>
      {r.history.length > 1 && (
        <div class="detail__block">
          <h3 class="eyebrow">{t('Estimate history')}</h3>
          <Sparkline values={r.history} tone={tone} lines={[{ at: 50, tone: 'warn' }, { at: 75, tone: 'bad' }]} height={64} />
        </div>
      )}
    </Sheet>
  );
}
