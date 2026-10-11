// Reduced-motion state: OS preference OR the in-game toggle.
// The toggle also sets `.reduced-motion` on <html> so fx.css utilities follow it.

const mq: MediaQueryList | null =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

let manual = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((fn) => { try { fn(); } catch { /* listener errors are not ours */ } });

try { mq?.addEventListener?.('change', notify); } catch { /* old Safari: ignore */ }

export function isReducedMotion(): boolean {
  return manual || !!mq?.matches;
}

export function setReducedMotion(on: boolean): void {
  manual = !!on;
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduced-motion', manual);
  notify();
}

export function onMotionChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
