/**
 * Action picker / confirm sheet: description, target & option pickers, cost and preview, Authorize.
 * Also used for situation responses (a ResponseView is adapted into the same shape).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { ActionView, ResponseView } from '../../engine/types';
import { t } from '../../i18n';
import { CostChips, PreviewChip } from '../components/Chips';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { cx, hasCost, money } from '../util';
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
  const preview = opt?.preview ?? action.preview;
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

  return (
    <Sheet label={action.name} onClose={onClose} class="action-sheet">
      <header class="detail__head">
        <span class="detail__icon is-accent">
          <Icon name={action.icon} size={26} />
        </span>
        <div class="detail__title">
          <p class="eyebrow">{CATEGORY_LABEL[action.category]}</p>
          <h2>{action.name}</h2>
          {subject && <p class="dim">{subject}</p>}
        </div>
      </header>
      <p class="detail__desc">{action.description}</p>

      {action.targets && action.targets.length > 0 && !pickTarget && tgt && (
        <div class="picker">
          <div class="picker__head">
            <span class="eyebrow">{t('Target')}</span>
            {action.targets.length > 1 && (
              <button type="button" class="linkbtn" onClick={() => setPickTarget(true)}>
                {t('Change')}
              </button>
            )}
          </div>
          <div class={cx('picker__opt picker__opt--fixed is-on', tgt.disabled && 'is-blocked')}>
            <span class="picker__text">
              <span class="picker__label">{tgt.label}</span>
              {tgt.sublabel && <span class="picker__sub">{tgt.sublabel}</span>}
              {tgt.disabled && <span class="picker__blocked">{tgt.disabled}</span>}
            </span>
          </div>
        </div>
      )}

      {action.targets && action.targets.length > 0 && pickTarget && (
        <fieldset class="picker">
          <legend class="eyebrow">{t('Target')}</legend>
          <div class="picker__list" role="radiogroup" aria-label={t('Target')}>
            {action.targets.map((x) => (
              <button
                type="button"
                key={x.id}
                role="radio"
                aria-checked={x.id === target}
                class={cx('picker__opt', x.id === target && 'is-on', x.disabled && 'is-blocked')}
                onClick={() => setTarget(x.id)}
              >
                <span class="picker__radio" aria-hidden="true" />
                <span class="picker__text">
                  <span class="picker__label">{x.label}</span>
                  {x.sublabel && <span class="picker__sub">{x.sublabel}</span>}
                  {x.disabled && <span class="picker__blocked">{x.disabled}</span>}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {action.options && action.options.length > 0 && (
        <fieldset class="picker">
          <legend class="eyebrow">{t('Option')}</legend>
          <div class="picker__list" role="radiogroup" aria-label={t('Option')}>
            {action.options.map((o) => (
              <button
                type="button"
                key={o.id}
                role="radio"
                aria-checked={o.id === option}
                class={cx('picker__opt', o.id === option && 'is-on', o.disabled && 'is-blocked')}
                onClick={() => setOption(o.id)}
              >
                <span class="picker__radio" aria-hidden="true" />
                <span class="picker__text">
                  <span class="picker__label">{o.label}</span>
                  {o.description && <span class="picker__sub">{o.description}</span>}
                  {(o.preview.length > 0 || hasCost(o.cost)) && (
                    <span class="picker__chips">
                      <CostChips cost={o.cost} />
                      {o.preview.map((p, i) => (
                        <PreviewChip key={i} p={p} />
                      ))}
                    </span>
                  )}
                  {o.disabled && <span class="picker__blocked">{o.disabled}</span>}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div class="confirm-fx">
        <div class="confirm-fx__row">
          <span class="eyebrow">{t('Cost')}</span>
          <span class="chips">{hasCost(cost) ? <CostChips cost={cost} /> : <span class="dim">{action.options && !opt ? t('Depends on the option') : t('Free')}</span>}</span>
        </div>
        <div class="confirm-fx__row">
          <span class="eyebrow">{t('Expected')}</span>
          <span class="chips">
            {preview.length ? (
              preview.map((p, i) => <PreviewChip key={i} p={p} />)
            ) : (
              <span class="dim">{action.options && !opt ? t('Choose an option above') : t('No immediate visible effects')}</span>
            )}
          </span>
        </div>
      </div>

      {!!cost.budget && <p class="small dim">{n.budget < cost.budget
        ? t('Need {cost}; available {available}; shortfall {shortfall}.', { cost: money(cost.budget), available: money(n.budget), shortfall: money(Math.ceil((cost.budget - n.budget) * 100) / 100) })
        : t('Available budget: {amount}', { amount: money(n.budget) })}</p>}

      {hardBlocked && (
        <p class="blocked" role="status">
          <Icon name="lock" size={15} /> {blocked}
        </p>
      )}

      <div class="sheet__actions">
        <button type="button" class="btn btn--ghost" onClick={onClose}>
          {t('Cancel')}
        </button>
        <button type="button" class="btn btn--primary" disabled={!!blocked} onClick={() => onConfirm(target, option)} data-autofocus={!blocked ? '' : undefined}>
          {needs === 'target' ? t('Choose a target') : needs === 'option' ? t('Choose an option') : t('Authorize')}
        </button>
      </div>
    </Sheet>
  );
}
