/**
 * Chips: effect previews, costs, chances, recorded changes and evidence-confidence badges.
 * Colour is never the only signal: every chip carries an icon, a text label and chevrons/signs.
 */
import type { JSX } from 'preact';
import type { Confidence, Cost, EffectPreview, MeterChange, PreviewKey } from '../../engine/types';
import { PREVIEW_INFO } from '../../engine/labels';
import { t, tp } from '../../i18n';
import { CONF_LABEL, changeText, cx, money, valence } from '../util';
import { Icon } from './Icon';

const SHORT: Record<PreviewKey, string> = {
  confidence: t('Confidence'),
  economy: t('Prosperity'),
  stability: t('Stability'),
  security: t('Security'),
  budget: t('Budget'),
  income: t('Income'),
  capacity: t('Actions'),
  evidence: t('Evidence'),
  risk: t('Global risk'),
  safeguards: t('Safeguards'),
  capability: t('Capability'),
  adoption: t('Adoption'),
  displacement: t('Displacement'),
  tension: t('Tension'),
  accord: t('Accord'),
  company: t('Relations'),
  rival: t('Trust'),
};

export function previewLabel(p: { key: PreviewKey; label?: string }): string {
  if (p.key === 'company' || p.key === 'rival') return p.label ? `${p.label}` : SHORT[p.key];
  return p.label ? `${SHORT[p.key]} · ${p.label}` : SHORT[p.key];
}

export function PreviewChip({ p, adoptionTarget = false }: { p: EffectPreview; adoptionTarget?: boolean }): JSX.Element {
  const unknown = p.dir === 0;
  // Risk effects show direction only (GDD §11).
  const mag = p.key === 'risk' ? 1 : p.magnitude;
  const v = unknown ? 'unknown' : valence(p.key, p.dir);
  const arrows = unknown ? '?' : (p.dir > 0 ? '\u25b2' : '\u25bc').repeat(mag);
  // Exact amount when the engine knows it (guaranteed to equal what is applied).
  const exact = !unknown && typeof p.amount === 'number' && p.amount !== 0 ? changeText(p.key, p.amount) : null;
  const label = adoptionTarget && p.key === 'adoption' ? `${t('Adoption target')}${p.label ? ` · ${p.label}` : ''}` : previewLabel(p);
  const name = `${adoptionTarget && p.key === 'adoption' ? t('Adoption target') : PREVIEW_INFO[p.key].label}${p.label ? ' ' + p.label : ''}`;
  const sr = unknown
    ? t('{name}: unknown effect', { name })
    : exact
      ? `${name} ${exact}`
      : `${p.dir > 0 ? t('{name} up', { name }) : t('{name} down', { name })}${mag > 1 ? ' \u00d7' + mag : ''}`;
  return (
    <span class={cx('chip', `chip--${v}`)} role="img" aria-label={sr}>
      <Icon name={PREVIEW_INFO[p.key].icon} size={14} />
      <span class="chip__label">{label}</span>
      {exact && <span class="chip__num">{exact}</span>}
      <span class="chip__dir" aria-hidden="true">
        {exact ? null : arrows}
      </span>
    </span>
  );
}

export function UncertainChip(): JSX.Element {
  return (
    <span class="chip chip--uncertain">
      <Icon name="question" size={14} />
      <span class="chip__label">{t('Uncertain consequences')}</span>
    </span>
  );
}

export function CostChips({ cost }: { cost?: Cost }): JSX.Element | null {
  if (!cost) return null;
  const items: JSX.Element[] = [];
  if (cost.capacity) items.push(<CostChip key="cap" icon="capacity" text={tp(cost.capacity, '{n} action', '{n} actions')} />);
  if (cost.budget) items.push(<CostChip key="bud" icon="budget" text={money(cost.budget)} />);
  if (cost.evidence) items.push(<CostChip key="ev" icon="evidence" text={t('{n} evidence', { n: cost.evidence })} />);
  if (cost.confidence) items.push(<CostChip key="conf" icon="confidence" text={t('{n} confidence', { n: cost.confidence })} />);
  if (!items.length) return null;
  return <>{items}</>;
}

function CostChip({ icon, text }: { icon: string; text: string }): JSX.Element {
  return (
    <span class="cost" aria-label={t('Costs {cost}', { cost: text })}>
      <Icon name={icon} size={13} />
      <span>{'−' + text}</span>
    </span>
  );
}

export function ChanceBadge({ chance }: { chance: number }): JSX.Element {
  const pct = Math.round(chance * 100);
  const v = pct >= 70 ? 'good' : pct >= 40 ? 'warn' : 'bad';
  return (
    <span class={cx('chance', `chance--${v}`)} aria-label={t('{n} percent chance of success', { n: pct })}>
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
