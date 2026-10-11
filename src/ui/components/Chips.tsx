/**
 * Chips: effect previews, costs, chances, recorded changes and evidence-confidence badges.
 * Colour is never the only signal: every chip carries an icon, a text label and chevrons/signs.
 */
import type { JSX } from 'preact';
import type { Confidence, Cost, EffectPreview, MeterChange, PreviewKey } from '../../engine/types';
import { PREVIEW_INFO } from '../../engine/labels';
import { CONF_LABEL, changeText, cx, valence } from '../util';
import { Icon } from './Icon';

const SHORT: Record<PreviewKey, string> = {
  confidence: 'Confidence',
  economy: 'Prosperity',
  stability: 'Stability',
  security: 'Security',
  budget: 'Budget',
  income: 'Income',
  capacity: 'Actions',
  evidence: 'Evidence',
  risk: 'Global risk',
  safeguards: 'Safeguards',
  capability: 'Capability',
  adoption: 'Adoption',
  displacement: 'Displacement',
  tension: 'Tension',
  accord: 'Accord',
  company: 'Relations',
  rival: 'Trust',
};

export function previewLabel(p: { key: PreviewKey; label?: string }): string {
  if (p.key === 'company' || p.key === 'rival') return p.label ? `${p.label}` : SHORT[p.key];
  return p.label ? `${SHORT[p.key]} · ${p.label}` : SHORT[p.key];
}

export function PreviewChip({ p }: { p: EffectPreview }): JSX.Element {
  const unknown = p.dir === 0;
  // Risk effects show direction only (GDD §11).
  const mag = p.key === 'risk' ? 1 : p.magnitude;
  const v = unknown ? 'unknown' : valence(p.key, p.dir);
  const arrows = unknown ? '?' : (p.dir > 0 ? '\u25b2' : '\u25bc').repeat(mag);
  // Exact amount when the engine knows it (guaranteed to equal what is applied).
  const exact = !unknown && typeof p.amount === 'number' && p.amount !== 0 ? changeText(p.key, p.amount) : null;
  const label = previewLabel(p);
  const name = `${PREVIEW_INFO[p.key].label}${p.label ? ' ' + p.label : ''}`;
  const sr = unknown ? `${name}: unknown effect` : exact ? `${name} ${exact}` : `${name} ${p.dir > 0 ? 'up' : 'down'}${mag > 1 ? ' \u00d7' + mag : ''}`;
  return (
    <span class={cx('chip', `chip--${v}`)} role="img" aria-label={sr}>
      <Icon name={PREVIEW_INFO[p.key].icon} size={14} />
      <span class="chip__label">{label}</span>
      {exact && <span class="chip__num">{exact}</span>}
      <span class="chip__dir" aria-hidden="true">
        {arrows}
      </span>
    </span>
  );
}

export function UncertainChip(): JSX.Element {
  return (
    <span class="chip chip--uncertain">
      <Icon name="question" size={14} />
      <span class="chip__label">Uncertain consequences</span>
    </span>
  );
}

export function CostChips({ cost }: { cost?: Cost }): JSX.Element | null {
  if (!cost) return null;
  const items: JSX.Element[] = [];
  if (cost.capacity) items.push(<CostChip key="cap" icon="capacity" text={`${cost.capacity} action${cost.capacity > 1 ? 's' : ''}`} />);
  if (cost.budget) items.push(<CostChip key="bud" icon="budget" text={`$${cost.budget}B`} />);
  if (cost.evidence) items.push(<CostChip key="ev" icon="evidence" text={`${cost.evidence} evidence`} />);
  if (cost.confidence) items.push(<CostChip key="conf" icon="confidence" text={`${cost.confidence} confidence`} />);
  if (!items.length) return null;
  return <>{items}</>;
}

function CostChip({ icon, text }: { icon: string; text: string }): JSX.Element {
  return (
    <span class="cost" aria-label={`Costs ${text}`}>
      <Icon name={icon} size={13} />
      <span>{'−' + text}</span>
    </span>
  );
}

export function ChanceBadge({ chance }: { chance: number }): JSX.Element {
  const pct = Math.round(chance * 100);
  const v = pct >= 70 ? 'good' : pct >= 40 ? 'warn' : 'bad';
  return (
    <span class={cx('chance', `chance--${v}`)} aria-label={`${pct} percent chance of success`}>
      <Icon name="dice" size={13} />
      {pct}%
    </span>
  );
}

export function ChangeChip({ c, big }: { c: Pick<MeterChange, 'key' | 'delta'> & { reason?: string }; big?: boolean }): JSX.Element {
  const v = valence(c.key, c.delta);
  return (
    <span class={cx('chip', 'chip--change', `chip--${v}`, big && 'chip--big')}>
      <Icon name={PREVIEW_INFO[c.key].icon} size={big ? 16 : 14} />
      <span class="chip__label">{SHORT[c.key]}</span>
      <span class="chip__num">{changeText(c.key, c.delta)}</span>
    </span>
  );
}

export function ConfBadge({ c }: { c: Confidence }): JSX.Element {
  return <span class={cx('conf', `conf--${c}`)}>{CONF_LABEL[c]}</span>;
}

/** Merge changes with the same key (+ label) so result overlays stay compact. */
export function mergeChanges(changes: MeterChange[]): MeterChange[] {
  const out = new Map<string, MeterChange>();
  for (const c of changes) {
    const k = c.key;
    const prev = out.get(k);
    if (prev) prev.delta += c.delta;
    else out.set(k, { ...c });
  }
  return [...out.values()].filter((c) => Math.abs(c.delta) >= 0.05);
}
