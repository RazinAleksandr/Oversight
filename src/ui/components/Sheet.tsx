/**
 * Modal sheet: bottom sheet on phones, centered dialog on desktop. Rendered in a portal so no ancestor
 * transform/backdrop-filter can trap its fixed positioning. Esc closes the top-most sheet only.
 */
import type { ComponentChildren, JSX } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { cx } from '../util';
import { Icon } from './Icon';

// ── Escape stack (one global listener, top-most handler wins) ──
const escStack: { fn: () => void }[] = [];
let escInstalled = false;
function installEsc(): void {
  if (escInstalled) return;
  escInstalled = true;
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || escStack.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    escStack[escStack.length - 1].fn();
  });
}

/** Registers `handler` on the Esc stack while mounted (and while handler is defined). */
export function useEscape(handler: (() => void) | undefined): void {
  const ref = useRef(handler);
  ref.current = handler;
  const active = !!handler;
  useEffect(() => {
    if (!active) return;
    installEsc();
    const entry = { fn: () => ref.current?.() };
    escStack.push(entry);
    return () => {
      const i = escStack.indexOf(entry);
      if (i >= 0) escStack.splice(i, 1);
    };
  }, [active]);
}

export function sheetsOpen(): number {
  return escStack.length;
}

/** Close the top-most dismissable sheet (used for the browser Back button). Returns false if none. */
export function closeTopSheet(): boolean {
  const top = escStack[escStack.length - 1];
  if (!top) return false;
  top.fn();
  return true;
}

export interface SheetProps {
  label: string;
  onClose?: () => void;
  /** 'full' = full-height sheet on phone; 'auto' = content height; 'overlay' = full-screen, not dismissable by backdrop */
  size?: 'full' | 'auto' | 'overlay';
  class?: string;
  /** Show the close (×) button. */
  closeButton?: boolean;
  children: ComponentChildren;
  /** Backdrop click closes (default true when onClose given and size !== 'overlay'). */
  backdropClose?: boolean;
}

export function Sheet({ label, onClose, size = 'auto', class: cls, closeButton = true, children, backdropClose }: SheetProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  // Swallow input for a moment after opening, so a double-click on the button that opened
  // this sheet can never land on (or select text in) the new content.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setArmed(true), 320);
    return () => window.clearTimeout(t);
  }, []);
  useEscape(onClose);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // Focus the first primary control if any, otherwise the dialog itself.
    const el = ref.current;
    const auto = el?.querySelector<HTMLElement>('[data-autofocus]');
    (auto ?? el)?.focus({ preventScroll: true });
    return () => {
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, []);
  const canBackdrop = backdropClose ?? (!!onClose && size !== 'overlay');
  return createPortal(
    <div class={cx('sheet-root', `sheet-root--${size}`)}>
      <div class="sheet-backdrop" onClick={canBackdrop ? onClose : undefined} />
      <div ref={ref} class={cx('sheet', `sheet--${size}`, cls)} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {onClose && closeButton && (
          <div class="sheet__closebar">
            <button type="button" class="sheet__close iconbtn" onClick={onClose} aria-label={t('Close')}>
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
      {!armed && <div class="sheet-guard" aria-hidden="true" />}
    </div>,
    document.body,
  ) as unknown as JSX.Element;
}
