/**
 * Shared layout & control primitives: page heads, sections, empty states, switches, segmented controls,
 * stamps, trait readouts and action buttons.
 */
import type { ComponentChildren, JSX } from 'preact';
import type { ActionView, Cost, Stamp, TraitView } from '../../engine/types';
import { t } from '../../i18n';
import { cx, money } from '../util';
import { Icon } from './Icon';

export function PageHead({ title, sub, icon, aside }: { title: string; sub?: string; icon?: string; aside?: ComponentChildren }): JSX.Element {
  return (
    <header class="pagehead">
      <div class="pagehead__text">
        <h1 class="pagehead__title">
          {icon && <Icon name={icon} size={22} />}
          {title}
        </h1>
        {sub && <p class="pagehead__sub">{sub}</p>}
      </div>
      {aside && <div class="pagehead__aside">{aside}</div>}
    </header>
  );
}

export function Section({
  title,
  icon,
  aside,
  children,
  class: cls,
  id,
}: {
  title: string;
  icon?: string;
  aside?: ComponentChildren;
  children: ComponentChildren;
  class?: string;
  id?: string;
}): JSX.Element {
  return (
    <section class={cx('section', cls)} id={id} aria-label={title}>
      <header class="section__head">
        <h2 class="section__title">
          {icon && <Icon name={icon} size={16} />}
          <span>{title}</span>
        </h2>
        {aside && <div class="section__aside">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: ComponentChildren }): JSX.Element {
  return (
    <div class="empty">
      <span class="empty__icon">
        <Icon name={icon} size={30} />
      </span>
      <p class="empty__title">{title}</p>
      {text && <p class="empty__text">{text}</p>}
      {children}
    </div>
  );
}

export function Switch({ on, onChange, label, id }: { on: boolean; onChange(v: boolean): void; label: string; id?: string }): JSX.Element {
  return (
    <button type="button" id={id} role="switch" aria-checked={on} aria-label={label} class={cx('switch', on && 'is-on')} onClick={() => onChange(!on)}>
      <span class="switch__knob" />
      <span class="switch__text" aria-hidden="true">
        {on ? t('On') : t('Off')}
      </span>
    </button>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string; desc?: string }[];
  onChange(v: T): void;
  label: string;
}): JSX.Element {
  return (
    <div class="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.id} role="radio" aria-checked={o.id === value} class={cx('seg__opt', o.id === value && 'is-on')} onClick={() => onChange(o.id)}>
          <span class="seg__label">{o.label}</span>
          {o.desc && <span class="seg__desc">{o.desc}</span>}
        </button>
      ))}
    </div>
  );
}

export const STAMP_TEXT: Record<Stamp, string> = {
  approved: t('Approved'),
  rejected: t('Rejected'),
  deferred: t('Deferred'),
  noted: t('Noted'),
  signed: t('Signed'),
  denied: t('Denied'),
  classified: t('Classified'),
  urgent: t('Urgent'),
};

/** Trait levels arrive from the engine as English ids ('Low' | 'Medium' | 'High' | 'Unknown'). */
const TRAIT_LEVEL: Record<TraitView['label'], string> = { Low: t('Low'), Medium: t('Medium'), High: t('High'), Unknown: t('Unknown') };

export function StampMark({ stamp, text, size = 'md', class: cls }: { stamp?: Stamp; text?: string; size?: 'sm' | 'md' | 'lg'; class?: string }): JSX.Element {
  const label = text ?? (stamp ? STAMP_TEXT[stamp] : '');
  return (
    <span class={cx('stamp', `stamp--${size}`, stamp && `stamp--${stamp}`, label.length > 9 && 'stamp--long', cls)} aria-hidden={size === 'sm' ? 'true' : undefined}>
      {label}
    </span>
  );
}

/** Fogged trait readout: "?" when unknown, label + "unverified" when estimated, exact value when verified. */
export function Trait({ name, t: tv }: { name: string; t: TraitView }): JSX.Element {
  const unknown = tv.label === 'Unknown';
  const level = TRAIT_LEVEL[tv.label] ?? tv.label;
  const v = unknown ? '?' : tv.verified && tv.value !== null ? String(Math.round(tv.value)) : level;
  const note = unknown ? t('Unknown') : tv.verified ? (tv.value !== null ? t('{level} · verified', { level }) : t('Verified')) : t('Unverified');
  return (
    <div class={cx('trait', unknown ? 'trait--unknown' : tv.verified ? 'trait--verified' : 'trait--est')}>
      <span class="trait__k">{name}</span>
      <span class="trait__v">
        {v}
        {tv.verified && !unknown && <Icon name="check" size={13} />}
      </span>
      <span class="trait__note">{note}</span>
    </div>
  );
}

export function costInline(c?: Cost): string {
  if (!c) return '';
  const parts: string[] = [];
  if (c.capacity) parts.push(`${c.capacity}◆`);
  if (c.budget) parts.push(money(c.budget));
  if (c.evidence) parts.push(t('{n} ev.', { n: c.evidence }));
  if (c.confidence) parts.push(t('{n} conf.', { n: c.confidence }));
  return parts.join(' · ');
}

/**
 * Why an action can't be used right now (null = available). An action is unavailable when it is
 * disabled itself, when the given target is disabled, or — with no target given — when every target is.
 */
export function actionBlock(action: ActionView, targetId?: string): string | null {
  if (action.disabled) return action.disabled;
  if (!action.targets) return null;
  if (targetId) return action.targets.find((x) => x.id === targetId)?.disabled ?? null;
  if (action.targets.length === 0) return t('No valid targets right now');
  if (action.targets.every((x) => x.disabled)) return action.targets[0].disabled ?? t('No valid targets right now');
  return null;
}

/** A compact button that opens the action sheet. Blocked actions stay tappable to show the reason. */
export function ActionChip({
  action,
  targetId,
  label,
  onOpen,
}: {
  action: ActionView;
  targetId?: string;
  label?: string;
  onOpen(id: ActionView['id'], targetId?: string): void;
}): JSX.Element {
  const blocked = actionBlock(action, targetId);
  const cost = costInline(action.cost);
  return (
    <button
      type="button"
      class={cx('actbtn', blocked && 'is-blocked')}
      onClick={() => onOpen(action.id, targetId)}
      aria-label={`${label ?? action.name}${cost ? t(', costs {cost}', { cost }) : ''}${blocked ? t(', unavailable: {reason}', { reason: blocked }) : ''}`}
    >
      <Icon name={action.icon} size={18} />
      <span class="actbtn__text">
        <span class="actbtn__name">{label ?? action.name}</span>
        {cost && <span class="actbtn__cost">{cost}</span>}
      </span>
    </button>
  );
}

/**
 * Renders a translated string whose emphasis is marked with `**…**` (so a sentence stays one key
 * even when part of it is bold): `rich(t('Tap **any** meter.'))` → Tap <b>any</b> meter.
 */
export function rich(text: string, tag: 'b' | 'strong' = 'b'): ComponentChildren {
  const parts = text.split('**');
  if (parts.length < 3) return text;
  const Tag = tag;
  return parts.map((p, i) => (i % 2 ? <Tag key={i}>{p}</Tag> : p));
}

export function Kbd({ children }: { children: ComponentChildren }): JSX.Element {
  return <kbd class="kbd">{children}</kbd>;
}
