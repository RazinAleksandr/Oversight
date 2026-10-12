/**
 * Action picker / confirm sheet: description, target & option pickers, cost and preview, Authorize.
 * Also used for situation responses (a ResponseView is adapted into the same shape).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { ActionView, ResponseView } from '../../engine/types';
import { t, tp } from '../../i18n';
import { CostChips, PreviewChip } from '../components/Chips';
import { Icon, Svg, artCached } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { cx, hash, hasCost, money } from '../util';
import { useGame } from './context';

const CATEGORY_LABEL: Record<ActionView['category'], string> = {
  labs: t('Labs action'),
  nation: t('Legislation'),
  world: t('International action'),
  threats: t('Threat response'),
  politics: t('Political action'),
};

export function responseAsAction(r: ResponseView): ActionView {
  return { id: 'situation_response', category: 'threats', name: r.label, description: r.description, icon: 'respond', cost: r.cost ?? {}, preview: r.preview, disabled: r.disabled ?? null };
}

export function ActionSheet({
  action,
  initialTarget,
  initialOption,
  subject,
  onClose,
  onConfirm,
}: {
  action: ActionView;
  initialTarget?: string;
  initialOption?: string;
  /** Extra context line (e.g. the threat a response applies to). */
  subject?: string;
  onClose(): void;
  onConfirm(targetId?: string, optionId?: string): void;
}): JSX.Element {
  const { view } = useGame();
  const [target, setTarget] = useState<string | undefined>(initialTarget ?? (action.targets?.length === 1 ? action.targets[0].id : undefined));
  const [option, setOption] = useState<string | undefined>(initialOption ?? (action.options?.length === 1 ? action.options[0].id : undefined));
  // Opened from a specific item (company card, model row, headline): show that target, allow changing it.
  const [pickTarget, setPickTarget] = useState(!initialTarget || !action.targets?.some((t) => t.id === initialTarget));
  const tgt = action.targets?.find((t) => t.id === target);
  const opt = action.options?.find((o) => o.id === option);
  const cost = opt?.cost ?? action.cost;
  const preview = opt?.preview ?? tgt?.preview ?? action.preview;
  const n = view.nation;
  const afford =
    cost.capacity && n.capacity < cost.capacity
      ? t('No actions left this quarter')
      : cost.budget && n.budget < cost.budget
        ? t('Not enough budget')
        : cost.evidence && n.evidence.length < cost.evidence
          ? t('Requires evidence you do not hold')
          : null;
  const hardBlock =
    action.disabled || tgt?.disabled || opt?.disabled || (action.targets && action.targets.length === 0 ? t('No valid targets right now') : null);
  // A missing pick is a prompt, not a block reason (it is shown on the button instead).
  const needs: 'target' | 'option' | null = hardBlock ? null : action.targets && !target ? 'target' : action.options && !option ? 'option' : null;
  const hardBlocked = hardBlock || (needs ? null : afford);
  const blocked = hardBlocked || needs;
  const targetCompany = view.companies.find(c => c.id === target);
  const targetCountry = view.rivals.find(r => r.id === target);
  const hasConfiguration = !!action.targets?.length || !!action.options?.length || preview.length > 0;

  return <Sheet label={action.name} size="page" closeButton={false} onClose={onClose} class="action-sheet action-v4 operation-v5">
    <div class="av4-shell">
      <header class="av4-command"><button type="button" onClick={onClose}><Icon name="back" size={18} />{t('Cancel')}</button><span>{CATEGORY_LABEL[action.category]}</span><div>{money(n.budget)} · {tp(n.capacity, '{n} action', '{n} actions')}</div></header>
      <main class={cx('av4-body', !hasConfiguration && 'operation-single')}>
        <section class="av4-brief">
          <div class="av4-action-symbol">{targetCompany ? <Svg html={artCached.logo(hash(targetCompany.id), targetCompany.color, targetCompany.archetype, 64)} label={targetCompany.name} /> : targetCountry ? <Svg html={artCached.emblem(targetCountry.id, 64)} label={targetCountry.name} /> : <Icon name={action.icon} size={40} />}</div>
          <h1>{action.name}</h1>
          {subject && <p class="av4-subject">{subject}</p>}
          <p>{action.description}</p>
          {!!cost.budget && <p class="av4-budget">{n.budget < cost.budget
            ? t('Need {cost}; available {available}; shortfall {shortfall}.', { cost: money(cost.budget), available: money(n.budget), shortfall: money(Math.ceil((cost.budget - n.budget) * 100) / 100) })
            : t('Available budget: {amount}', { amount: money(n.budget) })}</p>}
          {hardBlocked && <p class="av4-blocked" role="status"><Icon name="lock" size={16} />{hardBlocked}</p>}
        </section>
        {hasConfiguration && <section class="av4-configuration">
          {action.targets && action.targets.length > 0 && !pickTarget && tgt && <div class="av4-fixed-target"><div><span>{t('Target')}</span><h2>{tgt.label}</h2>{tgt.sublabel && <p>{tgt.sublabel}</p>}{tgt.disabled && <p class="av4-blocked">{tgt.disabled}</p>}</div>{action.targets.length > 1 && <button type="button" onClick={() => setPickTarget(true)}>{t('Change')}</button>}</div>}
          {action.targets && action.targets.length > 0 && pickTarget && <fieldset class="av4-picker"><legend>{t('Target')}</legend><div class="picker__list" role="radiogroup" aria-label={t('Target')}>
            {action.targets.map(x => <button type="button" key={x.id} role="radio" aria-checked={x.id === target} data-action-target={x.id} class={cx('av4-pick', x.id === target && 'is-selected', x.disabled && 'is-blocked')} onClick={() => setTarget(x.id)}><span class="av4-pick-mark" aria-hidden="true" /><span><strong>{x.label}</strong>{x.sublabel && <small>{x.sublabel}</small>}{x.disabled && <small class="av4-blocked">{x.disabled}</small>}</span></button>)}
          </div></fieldset>}
          {action.options && action.options.length > 0 && <fieldset class="av4-picker"><legend>{t('Option')}</legend><div class="picker__list" role="radiogroup" aria-label={t('Option')}>
            {action.options.map(o => <button type="button" key={o.id} role="radio" aria-checked={o.id === option} data-action-option={o.id} class={cx('av4-pick', o.id === option && 'is-selected', o.disabled && 'is-blocked')} onClick={() => setOption(o.id)}><span class="av4-pick-mark" aria-hidden="true" /><span><strong>{o.label}</strong>{o.description && <small>{o.description}</small>}{(o.preview.length > 0 || hasCost(o.cost)) && <span class="av4-pick-effects"><CostChips cost={o.cost} />{o.preview.map((p, i) => <PreviewChip key={i} p={p} />)}</span>}{o.disabled && <small class="av4-blocked">{o.disabled}</small>}</span></button>)}
          </div></fieldset>}
          {preview.length > 0 && <section class="av4-expectations"><h2>{t('Expected')}</h2><div>{preview.map((p, i) => <PreviewChip key={i} p={p} />)}</div></section>}
        </section>}
      </main>
      <footer class="av4-dock"><div><span>{t('Cost')}</span>{hasCost(cost) ? <CostChips cost={cost} /> : <span>{action.options && !opt ? t('Depends on the option') : t('Free')}</span>}</div><button type="button" class="av4-authorize btn--primary" data-confirm-action disabled={!!blocked} onClick={() => !blocked && onConfirm(target, option)}>{needs === 'target' ? t('Choose a target') : needs === 'option' ? t('Choose an option') : t('Authorize')}<Icon name="chevron_right" size={18} /></button></footer>
    </div>
  </Sheet>;
}
