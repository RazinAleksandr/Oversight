// Screen-level effects: shake, flash, vignette, floating chips, ring pulses.
// All use the Web Animations API (transform/opacity) and clean up after themselves.

import { canAnimate, clamp, fxLayer, resolveColor, rgba, supportsIndividualTransforms } from './util';
import { isReducedMotion } from './motion';

let shakeAnim: Animation | null = null;

export function shake(intensity = 1, ms = 260): void {
  if (isReducedMotion()) return;
  const target = document.getElementById('app') ?? document.body;
  if (!canAnimate(target)) return;
  const amp = 7 * clamp(intensity, 0, 3);
  if (amp <= 0) return;
  const steps = Math.max(5, Math.round(ms / 32));
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const decay = i === steps ? 0 : Math.pow(1 - p, 1.6);
    const dir = i % 2 ? 1 : -1;
    const x = dir * amp * decay * (0.6 + Math.random() * 0.4);
    const y = (Math.random() * 2 - 1) * amp * 0.45 * decay;
    const rot = (Math.random() * 2 - 1) * 0.35 * intensity * decay;
    frames.push(supportsIndividualTransforms
      ? { translate: `${x.toFixed(2)}px ${y.toFixed(2)}px`, rotate: `${rot.toFixed(3)}deg` }
      : { transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rot.toFixed(3)}deg)` });
  }
  shakeAnim?.cancel();
  shakeAnim = target.animate(frames, { duration: clamp(ms, 60, 800), easing: 'linear' });
  shakeAnim.onfinish = () => { shakeAnim = null; };
}

function overlay(className: string, style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  Object.assign(el.style, style);
  fxLayer().appendChild(el);
  return el;
}

function removeOnFinish(anim: Animation, el: Element): void {
  const done = () => el.remove();
  anim.onfinish = done;
  anim.oncancel = done;
}

export function flash(color = '#ffffff', ms = 260): void {
  const el = overlay('fx-flash', { background: color });
  if (!canAnimate(el)) { el.remove(); return; }
  const peak = isReducedMotion() ? 0.14 : 0.42;
  const anim = el.animate(
    [{ opacity: 0 }, { opacity: peak, offset: 0.12 }, { opacity: 0 }],
    { duration: clamp(ms, 80, 3000), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
  );
  removeOnFinish(anim, el);
}

export function vignette(color: string, ms = 1400): void {
  const c = resolveColor(color, [255, 77, 94]);
  const el = overlay('fx-vignette', {
    background: `radial-gradient(ellipse at 50% 50%, ${rgba(c, 0)} 58%, ${rgba(c, 0.16)} 78%, ${rgba(c, 0.5)} 100%)`,
    boxShadow: `inset 0 0 min(10vw, 110px) ${rgba(c, 0.4)}`,
  });
  if (!canAnimate(el)) { el.remove(); return; }
  const frames: Keyframe[] = isReducedMotion()
    ? [{ opacity: 0 }, { opacity: 0.7, offset: 0.25 }, { opacity: 0 }]
    : [
        { opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 0.35, offset: 0.34 },
        { opacity: 0.9, offset: 0.5 },
        { opacity: 0.3, offset: 0.72 },
        { opacity: 0 },
      ];
  const anim = el.animate(frames, { duration: clamp(ms, 200, 8000), easing: 'ease-in-out', fill: 'forwards' });
  removeOnFinish(anim, el);
}

// Recent chips, so simultaneous floatTexts at the same spot stack instead of overlapping.
const recentChips: { x: number; y: number; at: number }[] = [];

/** Rising "+3" / "−5" chip. `x`,`y` are viewport (client) coordinates, e.g. a meter's rect center. */
export function floatText(x: number, y: number, text: string, color?: string): void {
  const now = performance.now();
  for (let i = recentChips.length - 1; i >= 0; i--) if (now - recentChips[i].at > 450) recentChips.splice(i, 1);
  const stack = recentChips.filter((c) => Math.abs(c.x - x) < 40 && Math.abs(c.y - y) < 24).length;
  recentChips.push({ x, y, at: now });

  const col = color ?? inferChipColor(text);
  const el = overlay('fx-float-text', { left: `${x}px`, top: `${y - stack * 22}px` });
  el.style.setProperty('--fx-color', col);
  el.textContent = text;
  if (!canAnimate(el)) { setTimeout(() => el.remove(), 1000); return; }
  const reduced = isReducedMotion();
  // fx.css centers the chip with `transform: translate(-50%,-50%)` + `transform-origin: 0 0`,
  // so animating the individual translate/scale properties scales around the chip's center.
  const kf = (dy: number, sc: number, opacity: number, offset: number, easing: string): Keyframe => {
    const k: Keyframe = supportsIndividualTransforms
      ? { opacity, translate: `0 ${dy}px`, scale: `${sc}` }
      : { opacity, transform: `translateY(${dy}px) scale(${sc}) translate(-50%, -50%)` };
    k.offset = offset;
    k.easing = easing;
    return k;
  };
  // Pop in with a little overshoot, drift up while readable, then rise faster and fade.
  const frames: Keyframe[] = reduced
    ? [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }]
    : [
        kf(8, 0.55, 0, 0, 'cubic-bezier(.2,1.5,.4,1)'),
        kf(-4, 1, 1, 0.16, 'linear'),
        kf(-20, 1, 1, 0.62, 'cubic-bezier(.4,0,.8,.6)'),
        kf(-48, 0.94, 0, 1, 'linear'),
      ];
  const anim = el.animate(frames, { duration: 1250, easing: 'linear', fill: 'forwards' });
  removeOnFinish(anim, el);
}

function inferChipColor(text: string): string {
  const s = text.trim();
  if (/^\+/.test(s)) return 'var(--good, #3ee08f)';
  if (/^[-−–]/.test(s)) return 'var(--bad, #ff4d5e)';
  return 'var(--accent, #3fd0ff)';
}

/** Expanding ring around an element (drawn in the fx layer, so parent overflow can't clip it). */
export function pulse(el: HTMLElement, color = 'var(--accent, #3fd0ff)'): void {
  if (!el || !el.isConnected) return;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return;
  const c = resolveColor(color);
  const radius = getComputedStyle(el).borderRadius || '0px';
  const reduced = isReducedMotion();
  const rings = reduced ? 1 : 2;
  for (let i = 0; i < rings; i++) {
    const ring = overlay('fx-ring', {
      left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: radius,
    });
    if (!canAnimate(ring)) { ring.remove(); continue; }
    const spread = reduced ? 4 : 18;
    const anim = ring.animate(
      [
        { boxShadow: `0 0 0 0 ${rgba(c, 0.75)}, inset 0 0 0 1.5px ${rgba(c, 0.9)}`, opacity: 1 },
        { boxShadow: `0 0 0 ${spread}px ${rgba(c, 0)}, inset 0 0 0 1.5px ${rgba(c, 0)}`, opacity: 1 },
      ],
      { duration: reduced ? 600 : 760, delay: i * 170, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' },
    );
    removeOnFinish(anim, ring);
  }
}
