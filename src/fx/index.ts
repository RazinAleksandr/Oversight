// FX module — animation helpers, overlays, particles and the animated background.
// Implements FxAPI (src/engine/types.ts). No runtime dependency on the engine.
// Importing this module also loads src/styles/fx.css (utility classes + overlay styles).

import type { FxAPI } from '../engine/types';
import '../styles/fx.css';
import { NeuralBackground } from './background';
import { isReducedMotion, setReducedMotion } from './motion';
import { flash, floatText, pulse, shake, vignette } from './overlay';
import { burst } from './particles';
import { glitch, replayClass, staggerIn, tweenNumber, typewriter } from './text';

let background: NeuralBackground | null = null;
let backgroundCanvas: HTMLCanvasElement | null = null;
let pendingTension = 0;

/** Wrap an fx call so a presentation bug can never break gameplay. */
function safe<A extends unknown[], R>(fn: (...args: A) => R, fallback: R): (...args: A) => R {
  return (...args: A) => {
    try {
      return fn(...args);
    } catch (e) {
      if (import.meta.env?.DEV) console.error('[fx]', e);
      return fallback;
    }
  };
}

function startBackground(canvas: HTMLCanvasElement): void {
  if (!canvas) return;
  if (background && backgroundCanvas === canvas) return;
  background?.stop();
  background = new NeuralBackground(canvas);
  backgroundCanvas = canvas;
  background.setTension(pendingTension);
  background.start();
}

function setBackgroundTension(t: number): void {
  pendingTension = t;
  background?.setTension(t);
}

function stopBackground(): void {
  background?.stop();
  background = null;
  backgroundCanvas = null;
}

const typewriterSafe = (el: HTMLElement, text: string, cps?: number, onTick?: () => void) => {
  try {
    return typewriter(el, text, cps, onTick);
  } catch (e) {
    if (import.meta.env?.DEV) console.error('[fx]', e);
    try { el.textContent = text; } catch { /* ignore */ }
    return { skip: () => {}, done: Promise.resolve() };
  }
};

export const fx: FxAPI = {
  setReducedMotion: safe(setReducedMotion, undefined),
  shake: safe(shake, undefined),
  flash: safe(flash, undefined),
  vignette: safe(vignette, undefined),
  burst: safe(burst, undefined),
  floatText: safe(floatText, undefined),
  tweenNumber: (el, from, to, ms, format) => {
    try { tweenNumber(el, from, to, ms, format); } catch (e) {
      if (import.meta.env?.DEV) console.error('[fx]', e);
      try { el.textContent = format ? format(to) : String(Math.round(to)); } catch { /* ignore */ }
    }
  },
  glitch: safe(glitch, undefined),
  pulse: safe(pulse, undefined),
  typewriter: typewriterSafe,
  startBackground: safe(startBackground, undefined),
  setBackgroundTension: safe(setBackgroundTension, undefined),
  stopBackground: safe(stopBackground, undefined),
  staggerIn: safe(staggerIn, undefined),
};

/** Extra helpers (not part of FxAPI) the UI may use. */
export { isReducedMotion, replayClass };

/** Dev/bench only: jump the background straight to the current target tension. */
export function _snapBackgroundTension(): void {
  background?.snapTension();
}

/** Dev/bench only: background renderer diagnostics (quality level, DPR, frame cost). */
export function _backgroundDebug() {
  return background?.debug() ?? null;
}

export default fx;
