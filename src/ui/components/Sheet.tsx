/**
 * Modal sheet: bottom sheet on phones, centered dialog on desktop. Rendered in a portal so no ancestor
 * transform/backdrop-filter can trap its fixed positioning. Esc closes the top-most sheet only.
 */
import type { ComponentChildren, JSX } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { cx } from '../util';
import { Icon } from './Icon';

// ── Escape stack (one global listener, top-most handler wins) ──
const escStack: { fn: () => void }[] = [];
let escInstalled = false;

// Portals are siblings of the app. Only the top sheet remains interactive,
// including when a second sheet opens or a result replaces a briefing.
const modalStack: HTMLElement[] = [];
const previousInert = new Map<HTMLElement, boolean>();
let modalObserver: MutationObserver | undefined;
function syncModalInert(): void {
  const top = modalStack.at(-1);
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement) || child.id === 'sr-live') continue;
    if (!previousInert.has(child)) previousInert.set(child, child.inert);
    child.inert = top ? child !== top : previousInert.get(child)!;
  }
  if (!top) previousInert.clear();
}

function focusableControls(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>('button, summary, a[href], input, select, textarea, [tabindex]'))
    .filter((el) => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert]') && el.getClientRects().length > 0
      && getComputedStyle(el).visibility !== 'hidden');
}
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
  /** 'full' = full-height sheet on phone; 'auto' = content height; 'overlay' = centered non-dismissable result; 'page' = edge-to-edge task */
  size?: 'full' | 'auto' | 'overlay' | 'page';
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
  // Non-dismissable results consume Escape/Back as well, so a lower sheet cannot close.
  useEscape(onClose ?? (() => {}));
  useLayoutEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const root = el?.parentElement;
    if (!el || !root) return;
    modalStack.push(root);
    syncModalInert();
    if (!modalObserver) {
      modalObserver = new MutationObserver(syncModalInert);
      modalObserver.observe(document.body, { childList: true });
    }
    const focusInitial = () => (el.querySelector<HTMLElement>('[data-autofocus]') ?? el).focus({ preventScroll: true });
    focusInitial();
    const onFocus = (e: FocusEvent) => {
      if (modalStack.at(-1) === root && !el.contains(e.target as Node)) focusInitial();
    };
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || modalStack.at(-1) !== root) return;
      const controls = focusableControls(el);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) {
        e.preventDefault();
        el.focus();
      } else if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        e.preventDefault();
        last!.focus();
      } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === el)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('focusin', onFocus);
    document.addEventListener('keydown', onTab);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('keydown', onTab);
      modalStack.splice(modalStack.indexOf(root), 1);
      syncModalInert();
      if (!modalStack.length) {
        modalObserver?.disconnect();
        modalObserver = undefined;
      }
      if (prev?.isConnected && !prev.closest('[inert]')) prev.focus({ preventScroll: true });
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
