// Element-level animation helpers: number tweens, typewriter, glitch, staggered reveal, class replay.

import { canAnimate, easeOutCubic, supportsIndividualTransforms } from './util';
import { isReducedMotion } from './motion';

const defaultFormat = (n: number) => String(Math.round(n));
const tweens = new WeakMap<HTMLElement, number>();

export function tweenNumber(el: HTMLElement, from: number, to: number, ms = 400, format: (n: number) => string = defaultFormat): void {
  if (!el) return;
  const prev = tweens.get(el);
  if (prev) cancelAnimationFrame(prev);
  tweens.delete(el);
  if (!el.style.fontVariantNumeric) el.style.fontVariantNumeric = 'tabular-nums';
  const duration = isReducedMotion() ? Math.min(ms, 120) : ms;
  if (!Number.isFinite(from) || !Number.isFinite(to) || duration <= 16 || from === to || document.hidden) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / duration);
    el.textContent = format(p >= 1 ? to : from + (to - from) * easeOutCubic(p));
    if (p < 1) tweens.set(el, requestAnimationFrame(step));
    else tweens.delete(el);
  };
  el.textContent = format(from);
  tweens.set(el, requestAnimationFrame(step));
}

interface TypeJob { skip(): void; done: Promise<void> }
const typing = new WeakMap<HTMLElement, () => void>();

/**
 * Types `text` into `el`. The not-yet-typed remainder is laid out invisibly, so the
 * element's size never jumps. `onTick` fires for visible characters, throttled to ~22/s
 * (meant for the 'type' sfx). Reduced motion → instant.
 */
export function typewriter(el: HTMLElement, text: string, cps = 45, onTick?: () => void): TypeJob {
  typing.get(el)?.(); // cancel a previous job on the same element
  let resolve!: () => void;
  const done = new Promise<void>((r) => { resolve = r; });
  const finishPlain = () => { el.textContent = text; el.classList.remove('fx-typing'); resolve(); };

  if (!el || isReducedMotion() || !text || cps <= 0 || cps >= 2000) {
    if (el) finishPlain(); else resolve();
    return { skip: () => {}, done };
  }

  el.textContent = '';
  el.classList.add('fx-typing');
  const shown = document.createTextNode('');
  const caret = document.createElement('span');
  caret.className = 'fx-caret';
  caret.setAttribute('aria-hidden', 'true');
  const rest = document.createElement('span');
  rest.className = 'fx-typing-rest';
  rest.setAttribute('aria-hidden', 'true');
  rest.textContent = text;
  el.append(shown, caret, rest);

  const chars = Array.from(text); // code-point safe
  const start = performance.now();
  let count = 0;
  let lastTick = 0;
  let raf = 0;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    typing.delete(el);
    finishPlain();
  };

  const step = (now: number) => {
    const target = Math.min(chars.length, Math.floor(((now - start) / 1000) * cps) + 1);
    if (target !== count) {
      const added = chars.slice(count, target).join('');
      count = target;
      shown.data = chars.slice(0, count).join('');
      rest.textContent = chars.slice(count).join('');
      if (onTick && /\S/.test(added) && now - lastTick > 45) { lastTick = now; try { onTick(); } catch { /* caller bug */ } }
    }
    if (count >= chars.length) finish();
    else raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  typing.set(el, finish);
  return { skip: finish, done };
}

const glitchTimers = new WeakMap<HTMLElement, number>();

/** Intense RGB-split + slice jitter for `ms`. Leaves a persistent `fx-glitch` class (if the UI set one) in place. */
export function glitch(el: HTMLElement, ms = 600): void {
  if (!el || isReducedMotion()) return;
  const hadClass = el.classList.contains('fx-glitch');
  const prev = glitchTimers.get(el);
  if (prev) clearTimeout(prev);
  el.classList.add('fx-glitch', 'fx-glitch--burst');
  glitchTimers.set(el, window.setTimeout(() => {
    el.classList.remove('fx-glitch--burst');
    if (!hadClass) el.classList.remove('fx-glitch');
    glitchTimers.delete(el);
  }, Math.max(80, ms)));
}

/** Sequential fade/slide-in for `root`'s matching elements. Uses `translate` so element transforms are preserved. */
export function staggerIn(root: HTMLElement, selector = '[data-fx="reveal"]', stepMs = 60): void {
  if (!root) return;
  const els = Array.from(root.querySelectorAll<HTMLElement>(selector));
  const reduced = isReducedMotion();
  els.forEach((el, i) => {
    if (!canAnimate(el)) return;
    // Cap the cumulative delay so long lists don't drag.
    const delay = Math.min(i, 14) * (reduced ? Math.min(stepMs, 20) : stepMs);
    const from: Keyframe = reduced
      ? { opacity: 0 }
      : supportsIndividualTransforms ? { opacity: 0, translate: '0 14px' } : { opacity: 0, transform: 'translateY(14px)' };
    const to: Keyframe = reduced
      ? { opacity: 1 }
      : supportsIndividualTransforms ? { opacity: 1, translate: '0 0' } : { opacity: 1, transform: 'none' };
    el.animate([from, to], {
      duration: reduced ? 180 : 440,
      delay,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      fill: 'backwards',
    });
  });
}

/**
 * Restart a one-shot CSS animation class (e.g. 'fx-stamp', 'fx-pulse', 'fx-shake') on an element.
 * The class is removed when its animation ends unless `keep` is true.
 */
export function replayClass(el: HTMLElement, className: string, keep = false): void {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth; // force style flush so the animation restarts
  el.classList.add(className);
  if (keep) return;
  const onEnd = (e: AnimationEvent) => {
    if (e.target !== el) return;
    el.removeEventListener('animationend', onEnd);
    el.classList.remove(className);
  };
  el.addEventListener('animationend', onEnd);
}
