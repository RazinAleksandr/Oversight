/**
 * Data primitives: bars, estimate range bars, sparklines, stage stepper, semicircle gauge.
 */
import type { JSX } from 'preact';
import type { Estimate } from '../../engine/types';
import { STAGE_LABELS } from '../../engine/labels';
import { CONF_LABEL, clamp, cx, one } from '../util';

export type BarTone = 'good' | 'warn' | 'bad' | 'accent' | 'ai' | 'gov' | 'neutral';

export function Bar({
  value,
  max = 100,
  tone = 'accent',
  ghost,
  label,
  thin,
}: {
  value: number;
  max?: number;
  tone?: BarTone;
  ghost?: number;
  label?: string;
  thin?: boolean;
}): JSX.Element {
  const pct = clamp((value / max) * 100, 0, 100);
  return (
    <span
      class={cx('bar', `bar--${tone}`, thin && 'bar--thin')}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-label={label}
    >
      <span class="bar__fill" style={{ width: `${pct}%` }} />
      {ghost !== undefined && <span class="bar__ghost" style={{ left: `${clamp((ghost / max) * 100, 0, 100)}%` }} aria-hidden="true" />}
    </span>
  );
}

/** Fogged estimate on a 0..max scale: shaded uncertainty range + marker at the estimate. */
export function RangeBar({ est, max = 10, tone = 'accent', ticks = true }: { est: Estimate; max?: number; tone?: BarTone; ticks?: boolean }): JSX.Element {
  const lo = clamp((est.low / max) * 100, 0, 100);
  const hi = clamp((est.high / max) * 100, 0, 100);
  const v = clamp((est.value / max) * 100, 0, 100);
  return (
    <span class={cx('range', `range--${tone}`)} aria-hidden="true">
      {ticks && (
        <span class="range__ticks">
          {Array.from({ length: max === 10 ? 9 : 3 }, (_, i) => (
            <i key={i} style={{ left: `${((i + 1) / (max === 10 ? 10 : 4)) * 100}%` }} />
          ))}
        </span>
      )}
      <span class="range__span" style={{ left: `${lo}%`, width: `${Math.max(1.5, hi - lo)}%` }} />
      <span class="range__mark" style={{ left: `${v}%` }} />
    </span>
  );
}

export function estimateText(est: Estimate, digits = 1): string {
  const f = (n: number) => (digits ? n.toFixed(digits) : String(Math.round(n)));
  return est.low === est.high ? f(est.value) : `${f(est.low)}–${f(est.high)}`;
}

export function EstimateLine({ est, digits = 1, unit }: { est: Estimate; digits?: number; unit?: string }): JSX.Element {
  return (
    <span class="estline">
      <span class="num">{digits ? one(est.value) : Math.round(est.value)}</span>
      {unit && <span class="estline__unit">{unit}</span>}
      <span class="estline__range num">({estimateText(est, digits)})</span>
      <span class={cx('conf', `conf--${est.confidence}`)}>{CONF_LABEL[est.confidence]}</span>
    </span>
  );
}

export function Sparkline({
  values,
  width = 220,
  height = 56,
  lines = [],
  tone = 'accent',
  max = 100,
  min = 0,
}: {
  values: number[];
  width?: number;
  height?: number;
  lines?: { at: number; tone: BarTone }[];
  tone?: BarTone;
  max?: number;
  min?: number;
}): JSX.Element {
  const pad = 4;
  const n = values.length;
  const x = (i: number) => (n <= 1 ? width / 2 : pad + (i / (n - 1)) * (width - pad * 2));
  const y = (v: number) => pad + (1 - (clamp(v, min, max) - min) / (max - min)) * (height - pad * 2);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = n > 1 ? `M${x(0)},${height - pad} L${pts.split(' ').join(' L')} L${x(n - 1)},${height - pad} Z` : '';
  return (
    <svg class={cx('spark', `spark--${tone}`)} viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true">
      {lines.map((l) => (
        <line key={l.at} class={`spark__line spark__line--${l.tone}`} x1={0} x2={width} y1={y(l.at)} y2={y(l.at)} />
      ))}
      {area && <path class="spark__area" d={area} />}
      {n > 1 && <polyline class="spark__stroke" points={pts} />}
      {n > 0 && <circle class="spark__dot" cx={x(n - 1)} cy={y(values[n - 1])} r={3} />}
    </svg>
  );
}

export function StageStepper({ stage, compact }: { stage: number; compact?: boolean }): JSX.Element {
  return (
    <ol class={cx('stages', compact && 'stages--compact')} aria-label={`Stage ${STAGE_LABELS[stage]}`}>
      {STAGE_LABELS.map((l, i) => (
        <li key={l} class={cx('stages__step', `stages__step--${i}`, i < stage && 'is-past', i === stage && 'is-current')}>
          <span class="stages__dot" aria-hidden="true" />
          {!compact && <span class="stages__label">{l}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Semicircle gauge 0–100 with warning zones (used for Race Tension). */
export function Gauge({ value, size = 160, zones = [70, 90] }: { value: number; size?: number; zones?: [number, number] }): JSX.Element {
  const r = size / 2 - 10;
  const cx0 = size / 2;
  const cy0 = size / 2;
  const pt = (v: number, rr = r) => {
    const a = Math.PI * (1 - v / 100);
    return [cx0 + rr * Math.cos(a), cy0 - rr * Math.sin(a)] as const;
  };
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a);
    const [x2, y2] = pt(b);
    return `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
  };
  const [nx, ny] = pt(clamp(value, 0, 100), r - 14);
  return (
    <svg class="gauge" viewBox={`0 0 ${size} ${size / 2 + 12}`} width={size} height={size / 2 + 12} aria-hidden="true">
      <path class="gauge__track" d={arc(0, 100)} />
      <path class="gauge__zone gauge__zone--ok" d={arc(0, zones[0])} />
      <path class="gauge__zone gauge__zone--warn" d={arc(zones[0], zones[1])} />
      <path class="gauge__zone gauge__zone--bad" d={arc(zones[1], 100)} />
      {Array.from({ length: 11 }, (_, i) => {
        const [x1, y1] = pt(i * 10, r + 6);
        const [x2, y2] = pt(i * 10, r - (i % 5 === 0 ? 6 : 2));
        return <line key={i} class="gauge__tick" x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
      <line class="gauge__needle" x1={cx0} y1={cy0} x2={nx} y2={ny} />
      <circle class="gauge__hub" cx={cx0} cy={cy0} r={5} />
    </svg>
  );
}
