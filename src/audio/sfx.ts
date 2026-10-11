// Sound recipes for every SfxId. Each recipe schedules nodes on the voice and returns
// its duration in seconds (used for cleanup). Levels are balanced against each other:
// UI ticks sit low (≈ −24 dBFS), feedback cues mid, stamps / alarms / endings highest.

import type { SfxId } from '../engine/types';
import { bell, glitchBuffer, midiHz, noise, pluckBuffer, sample, tone, type Voice } from './dsp';

type Recipe = (v: Voice) => number;
const max = Math.max;

export const SFX: Record<SfxId, Recipe> = {
  // ── UI navigation ──────────────────────────────────────────────
  click: (v) => max(
    noise(v, { d: 0.022, g: 0.15, f: 3800, q: 1.3 }),
    tone(v, { f: 1650, f2: 1150, d: 0.045, g: 0.085 }),
  ),

  hover: (v) => max(
    tone(v, { f: 2350, d: 0.03, g: 0.022, a: 0.002 }),
    noise(v, { d: 0.012, g: 0.018, f: 6200, q: 1.5 }),
  ),

  tab: (v) => max(
    tone(v, { type: 'triangle', f: 620, f2: 540, d: 0.08, g: 0.085, lp: 2600 }),
    tone(v, { f: 1240, d: 0.05, g: 0.035 }),
    noise(v, { d: 0.018, g: 0.05, f: 2600, q: 1.2 }),
  ),

  open: (v) => max(
    noise(v, { a: 0.09, d: 0.24, g: 0.12, f: 480, f2: 2700, sweep: 0.24, q: 1.4, send: 0.15 }),
    tone(v, { f: 330, f2: 660, glide: 0.2, a: 0.06, d: 0.2, g: 0.04, send: 0.2 }),
  ),

  close: (v) => max(
    noise(v, { a: 0.03, d: 0.2, g: 0.1, f: 2400, f2: 420, sweep: 0.2, q: 1.4 }),
    tone(v, { f: 600, f2: 300, a: 0.01, d: 0.16, g: 0.035 }),
  ),

  // ── Paper cards ────────────────────────────────────────────────
  card_in: (v) => max(
    // Paper friction: two overlapping filtered noise layers…
    noise(v, { a: 0.045, d: 0.2, g: 0.13, f: 2600, f2: 3600, q: 0.7, hp: 900, pan: -0.15 }),
    noise(v, { at: 0.03, a: 0.03, d: 0.15, g: 0.07, f: 5200, q: 0.9, pan: 0.1 }),
    // …and a soft landing on the desk.
    tone(v, { at: 0.17, f: 170, f2: 95, d: 0.09, g: 0.1 }),
    noise(v, { at: 0.17, d: 0.05, g: 0.06, type: 'lowpass', f: 900, q: 0.7 }),
  ),

  card_out: (v) => max(
    noise(v, { a: 0.012, d: 0.16, g: 0.11, f: 3400, f2: 1300, q: 0.8, hp: 700, pan: 0.15 }),
    noise(v, { d: 0.08, g: 0.045, f: 6500, q: 1, type: 'bandpass' }),
  ),

  // ── Decisions ──────────────────────────────────────────────────
  approve: (v) => max(
    bell(v, midiHz(84), { g: 0.11, d: 0.75, send: 0.25, pan: -0.1 }),           // C6
    bell(v, midiHz(91), { at: 0.085, g: 0.11, d: 1.0, send: 0.3, pan: 0.1 }),    // G6
  ),

  reject: (v) => max(
    tone(v, { f: 150, f2: 70, glide: 0.14, a: 0.003, d: 0.22, g: 0.3 }),
    tone(v, { type: 'triangle', f: 196, f2: 160, d: 0.14, g: 0.07, lp: 900 }),
    noise(v, { d: 0.07, g: 0.1, type: 'lowpass', f: 500, q: 0.8 }),
  ),

  stamp: (v) => max(
    tone(v, { f: 125, f2: 42, glide: 0.13, a: 0.002, d: 0.26, g: 0.5 }),         // thump
    tone(v, { type: 'triangle', f: 88, f2: 55, d: 0.12, g: 0.16, lp: 600 }),       // body
    noise(v, { d: 0.02, g: 0.3, type: 'highpass', f: 1600, q: 0.7, a: 0.001 }),   // crack
    noise(v, { d: 0.11, g: 0.2, f: 1800, q: 0.9 }),                              // paper slap
    noise(v, { at: 0.03, d: 0.07, g: 0.05, f: 900, q: 2, send: 0.08 }),           // desk rattle
  ),

  // ── Alerts ─────────────────────────────────────────────────────
  alert: (v) => max(
    tone(v, { type: 'triangle', f: 880, d: 0.17, g: 0.12, lp: 3200, send: 0.15 }),
    tone(v, { f: 1760, d: 0.1, g: 0.025 }),
    tone(v, { type: 'triangle', at: 0.17, f: 659.25, d: 0.3, g: 0.12, lp: 3200, send: 0.18 }),
    tone(v, { at: 0.17, f: 1318.5, d: 0.14, g: 0.025 }),
  ),

  critical: (v) => {
    let end = tone(v, { f: 90, f2: 45, d: 0.45, g: 0.28, a: 0.003 });
    for (let i = 0; i < 3; i++) {
      const at = i * 0.23;
      end = max(end,
        tone(v, { type: 'sawtooth', at, f: 523, f2: 784, glide: 0.16, a: 0.012, d: 0.19, g: 0.075, lp: 2100, lpQ: 2, send: 0.12 }),
        tone(v, { type: 'square', at, f: 261.6, f2: 392, glide: 0.16, a: 0.012, d: 0.19, g: 0.03, lp: 1200 }),
      );
    }
    return max(end, noise(v, { d: 0.05, g: 0.06, type: 'highpass', f: 2500 }));
  },

  // ── Outcomes ───────────────────────────────────────────────────
  success: (v) => {
    const notes = [72, 76, 79, 84]; // C5 E5 G5 C6
    let end = 0;
    notes.forEach((m, i) => {
      end = max(end, bell(v, midiHz(m), { at: i * 0.07, g: 0.085, d: i === 3 ? 1.1 : 0.5, send: 0.3, pan: (i - 1.5) * 0.15 }));
    });
    tone(v, { type: 'triangle', f: midiHz(60), a: 0.05, d: 0.7, g: 0.035, lp: 1500, send: 0.2 });
    tone(v, { type: 'triangle', f: midiHz(67), a: 0.05, d: 0.7, g: 0.025, lp: 1500, send: 0.2 });
    return end;
  },

  fail: (v) => {
    const notes = [67, 63, 60]; // G4 Eb4 C4
    let end = 0;
    notes.forEach((m, i) => {
      const d = i === 2 ? 0.95 : 0.4;
      end = max(end,
        tone(v, { type: 'triangle', at: i * 0.14, f: midiHz(m), a: 0.01, d, g: 0.085, lp: 1400, send: 0.2 }),
        tone(v, { type: 'warm', at: i * 0.14, f: midiHz(m), detune: 9, a: 0.01, d, g: 0.03, lp: 1100 }),
      );
    });
    return max(end, tone(v, { at: 0.28, f: midiHz(48), a: 0.02, d: 1.0, g: 0.065 }));
  },

  turn: (v) => {
    // Calendar page flaps…
    noise(v, { d: 0.05, g: 0.13, f: 2300, q: 0.8, pan: -0.2 });
    noise(v, { at: 0.075, d: 0.06, g: 0.1, f: 1600, q: 0.8, pan: 0.2 });
    // …then a soft gong (inharmonic partials, long decays).
    const f = midiHz(43); // G2
    const partials: [number, number, number][] = [[1, 1, 2.8], [1.003, 0.5, 2.6], [2.0, 0.45, 2.0], [2.76, 0.3, 1.4], [4.07, 0.14, 0.9], [5.4, 0.07, 0.6]];
    let end = 0;
    for (const [ratio, amp, d] of partials) {
      end = max(end, tone(v, { at: 0.12, f: f * ratio, a: 0.018, d, g: 0.085 * amp, send: 0.4 }));
    }
    return end;
  },

  type: (v) => max(
    noise(v, { d: 0.012, g: 0.11, f: 3500, q: 1.5, a: 0.001 }),
    tone(v, { f: 260, f2: 180, d: 0.025, g: 0.045 }),
  ),

  coin: (v) => max(
    tone(v, { type: 'square', f: 987.77, d: 0.07, g: 0.035, lp: 4000 }),
    tone(v, { type: 'square', at: 0.07, f: 1318.5, d: 0.35, g: 0.035, lp: 5000 }),
    tone(v, { at: 0.07, f: 1318.5, d: 0.42, g: 0.05, send: 0.2 }),
    tone(v, { at: 0.07, f: 3951, d: 0.25, g: 0.012, send: 0.3 }),
    tone(v, { at: 0.07, f: 5274, d: 0.2, g: 0.008, send: 0.3 }),
  ),

  negotiate: (v) => max(
    // Low tritone pluck pair (D3 + G#3) — tense, unresolved.
    sample(v, pluckBuffer(v.ctx, midiHz(50), 1.3), { g: 0.26, lp: 2600, send: 0.2, pan: -0.15 }),
    sample(v, pluckBuffer(v.ctx, midiHz(56), 1.1), { at: 0.028, g: 0.21, lp: 2600, send: 0.2, pan: 0.15 }),
    tone(v, { type: 'warm', f: midiHz(38), a: 0.12, d: 0.8, g: 0.03, lp: 500 }),
  ),

  glitch: (v) => max(
    sample(v, glitchBuffer(v.ctx), { g: 0.075, hp: 120, lp: 9000, send: 0.05 }),
    tone(v, { type: 'square', f: 55, d: 0.1, g: 0.04, lp: 400 }),
  ),

  reveal: (v) => {
    const notes = [81, 88, 90, 93, 100]; // A5 E6 F#6 A6 E7
    let end = 0;
    notes.forEach((m, i) => {
      end = max(end, tone(v, { at: i * 0.045, f: midiHz(m), a: 0.06, d: 0.85, g: 0.035, send: 0.45, pan: (i % 2 ? 0.25 : -0.25) }));
    });
    return max(end, noise(v, { a: 0.22, d: 0.35, g: 0.03, f: 3000, f2: 8500, sweep: 0.55, q: 1.2, hp: 2500, send: 0.3 }));
  },

  unlock: (v) => {
    const notes = [84, 86, 88, 91, 93, 96, 100]; // C6 D6 E6 G6 A6 C7 E7
    let end = 0;
    notes.forEach((m, i) => {
      const at = i * 0.035 + v.r() * 0.008;
      end = max(end, bell(v, midiHz(m), { at, g: 0.045, d: 0.38, send: 0.4, pan: (i / 6 - 0.5) * 0.6, bright: 0.6 }));
    });
    for (const m of [72, 79, 88]) tone(v, { type: 'triangle', f: midiHz(m), a: 0.02, d: 0.75, g: 0.025, lp: 2500, send: 0.4 });
    return end;
  },

  // ── Endings ────────────────────────────────────────────────────
  ending_good: (v) => {
    // Warm D major add9 swell: detuned soft saws through a low-pass that opens and settles.
    const notes = [50, 57, 62, 66, 69, 76]; // D3 A3 D4 F#4 A4 E5
    const ctx = v.ctx, t0 = v.t;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(300, t0);
    filter.frequency.exponentialRampToValueAtTime(2600, t0 + 1.8);
    filter.frequency.exponentialRampToValueAtTime(1100, t0 + 5);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(1, t0 + 1.2);
    amp.gain.setTargetAtTime(0, t0 + 2.6, 0.9);
    filter.connect(amp);
    amp.connect(v.out);
    const send = ctx.createGain();
    send.gain.value = 0.45;
    amp.connect(send).connect(v.send);
    const stopAt = t0 + 7.5;
    for (const m of notes) {
      for (const dt of [-8, 8]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiHz(m) * v.p;
        o.detune.value = dt;
        const g = ctx.createGain();
        g.gain.value = 0.022;
        o.connect(g).connect(filter);
        o.start(t0);
        o.stop(stopAt);
      }
    }
    tone(v, { f: midiHz(38), a: 1.0, d: 4.5, g: 0.09 });                                // sub D2
    bell(v, midiHz(86), { at: 1.0, g: 0.035, d: 1.6, send: 0.5, pan: -0.2 });            // D6
    bell(v, midiHz(93), { at: 1.25, g: 0.03, d: 1.8, send: 0.5, pan: 0.2 });             // A6
    return 7.5;
  },

  ending_bad: (v) => {
    // Impact + rumble…
    tone(v, { f: 70, f2: 28, glide: 0.7, a: 0.004, d: 1.6, g: 0.55 });
    noise(v, { a: 0.004, d: 3.2, g: 0.32, type: 'lowpass', f: 180, q: 0.8 });
    noise(v, { d: 0.45, g: 0.12, f: 420, q: 1.2, send: 0.3 });
    // …then a dark detuned cluster (D, Eb, Ab) that decays slowly.
    const cluster = [26, 38, 39, 44]; // D1 D2 Eb2 Ab2
    let end = 0;
    cluster.forEach((m, i) => {
      for (const dt of [-11, 11]) {
        end = max(end, tone(v, { type: 'sawtooth', at: 0.05, f: midiHz(m), detune: dt, a: 0.5, d: 5, g: 0.04, lp: 280, lp2: 160, lpQ: 2, send: 0.35, pan: (i - 1.5) * 0.2 }));
      }
    });
    // Eerie high whistle.
    tone(v, { at: 0.6, f: midiHz(80), a: 1.4, d: 3, g: 0.01, send: 0.6 });
    return end;
  },
};

/** Pitch randomization per sound (fraction, ±). */
export const PITCH_JITTER: Partial<Record<SfxId, number>> = {
  click: 0.05, hover: 0.06, tab: 0.04, type: 0.1, card_in: 0.06, card_out: 0.06, open: 0.03, close: 0.03,
  stamp: 0.04, reject: 0.03, coin: 0.02, glitch: 0.15, approve: 0.01, success: 0.01, fail: 0.01,
  alert: 0, critical: 0, turn: 0.015, negotiate: 0.02, reveal: 0.02, unlock: 0.02, ending_good: 0, ending_bad: 0,
};

/** Minimum re-trigger interval per sound (ms) — keeps rapid UI input from machine-gunning. */
export const MIN_INTERVAL: Partial<Record<SfxId, number>> = {
  hover: 45, type: 28, click: 35, tab: 50, card_in: 60, card_out: 60, coin: 50, stamp: 90,
  alert: 150, critical: 400, ending_good: 1500, ending_bad: 1500,
};
