/**
 * The Risk Clock: "minutes to midnight". The minute hand sits at the risk *estimate*
 * (risk 0 → 23:00, risk 100 → midnight); the shaded arc spans the uncertainty range low→high.
 */
import type { JSX } from 'preact';
import type { RiskView } from '../../engine/types';
import { clamp, cx } from '../util';

export function riskTone(estimate: number): 'accent' | 'warn' | 'bad' {
  return estimate >= 65 ? 'bad' : estimate >= 40 ? 'warn' : 'accent';
}

function polar(c: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [c + r * Math.sin(a), c - r * Math.cos(a)];
}

function arcPath(c: number, r: number, from: number, to: number): string {
  const span = Math.max(0.5, to - from);
  const [x1, y1] = polar(c, r, from);
  const [x2, y2] = polar(c, r, from + span);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${span > 180 ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
}

export function RiskClock({
  risk,
  size = 56,
  showLabel = false,
  class: cls,
}: {
  risk: Pick<RiskView, 'estimate' | 'low' | 'high' | 'clock'>;
  size?: number;
  showLabel?: boolean;
  class?: string;
}): JSX.Element {
  const c = size / 2;
  const r = c - Math.max(2, size * 0.04);
  const est = clamp(risk.estimate, 0, 100);
  const lo = clamp(risk.low, 0, 100);
  const hi = clamp(risk.high, 0, 100);
  const tone = riskTone(est);
  const minuteDeg = est * 3.6;
  const hourDeg = ((11 + est / 100) / 12) * 360;
  const big = size >= 96;
  const ticks: JSX.Element[] = [];
  const tickCount = big ? 60 : 12;
  for (let i = 0; i < tickCount; i++) {
    const major = big ? i % 5 === 0 : true;
    const deg = (i / tickCount) * 360;
    const [x1, y1] = polar(c, r - 1, deg);
    const [x2, y2] = polar(c, r - (major ? size * 0.11 : size * 0.05), deg);
    ticks.push(<line key={i} class={cx('rclock__tick', major && 'is-major')} x1={x1} y1={y1} x2={x2} y2={y2} />);
  }
  const [mx, my] = polar(c, r * 0.82, minuteDeg);
  const [hx, hy] = polar(c, r * 0.5, hourDeg);
  const [tx, ty] = polar(c, r * 0.2, minuteDeg + 180);
  const bandR = r - size * 0.16;
  return (
    <svg class={cx('rclock', `rclock--${tone}`, cls)} viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <circle class="rclock__face" cx={c} cy={c} r={r} />
      <path class="rclock__zone rclock__zone--warn" d={arcPath(c, r - size * 0.03, 225, 288)} />
      <path class="rclock__zone rclock__zone--bad" d={arcPath(c, r - size * 0.03, 288, 360)} />
      {ticks}
      <path class="rclock__band" d={arcPath(c, bandR, lo * 3.6, hi * 3.6)} style={{ strokeWidth: Math.min(22, Math.max(3, size * 0.09)) }} />
      <line class="rclock__hour" x1={c} y1={c} x2={hx} y2={hy} style={{ strokeWidth: Math.min(9, Math.max(2, size * 0.055)) }} />
      <line class="rclock__minute" x1={tx} y1={ty} x2={mx} y2={my} style={{ strokeWidth: Math.min(5, Math.max(1.5, size * 0.035)) }} />
      <circle class="rclock__hub" cx={c} cy={c} r={Math.max(2, size * 0.05)} />
      {showLabel && (
        <text class="rclock__label" x={c} y={c + r * 0.52} text-anchor="middle" style={{ fontSize: size * 0.13 }}>
          {risk.clock}
        </text>
      )}
    </svg>
  );
}
