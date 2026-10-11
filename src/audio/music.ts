// Generative ambient score.
//
// Layers:   pad (detuned warm saws → LFO'd low-pass → tremolo)  ·  noise bed ("room air")
//           sparse arpeggio (bells → dotted-8th echo)  ·  bass pulse (8ths, from uneasy up)
//           heartbeat (occasional → steady)  ·  ticking clock (high tension)  ·  sub rumble
// Only pad + arps feed the reverb; percussion and sub stay dry and tight.
//
// Scheduling is time-based (`pump(until)`): the live engine calls it from a setInterval with
// a look-ahead; the dev bench calls it once to render offline. Tension is smoothed in musical
// time and every continuous parameter moves with setTargetAtTime, so nothing clicks.

import { isOffline, midiHz, noise, noiseBuffer, tone, warmSaw, type Voice } from './dsp';
import { PROGRESSIONS, type Mood, type Palette } from './harmony';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0: number, e1: number, x: number) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

interface Profile {
  tempo: (T: number) => number;
  bright: number;            // pad cutoff multiplier
  useTension: boolean;
  fixedT: number;            // effective tension when the mood ignores setTension
  arpHits: (T: number) => number;
  arpBase: number;           // lowest MIDI note of the arp register
  heartbeat: boolean;
  ticks: boolean;
  pulse: boolean;
  barsPerChord: number;
  noise: number;             // noise-bed level multiplier
  sub: number;               // minimum sub-rumble level 0..1
  palette?: Palette;
}

const PROFILES: Record<Mood, Profile> = {
  menu: { tempo: () => 54, bright: 0.9, useTension: false, fixedT: 0.1, arpHits: () => 3, arpBase: 69, heartbeat: false, ticks: false, pulse: false, barsPerChord: 2, noise: 1, sub: 0, palette: 'menu' },
  game: { tempo: (T) => lerp(60, 96, T), bright: 1, useTension: true, fixedT: 0, arpHits: (T) => lerp(2.5, 7, T), arpBase: 69, heartbeat: true, ticks: true, pulse: true, barsPerChord: 2, noise: 1, sub: 0 },
  ending_good: { tempo: () => 56, bright: 1.45, useTension: false, fixedT: 0, arpHits: () => 4, arpBase: 71, heartbeat: false, ticks: false, pulse: false, barsPerChord: 2, noise: 0.6, sub: 0, palette: 'good' },
  ending_bad: { tempo: () => 42, bright: 0.42, useTension: false, fixedT: 0.8, arpHits: () => 1.2, arpBase: 57, heartbeat: true, ticks: false, pulse: false, barsPerChord: 3, noise: 1.3, sub: 1, palette: 'bad' },
};

interface PadVoice { oscs: OscillatorNode[]; gain: GainNode }

/** Bjorklund-style even distribution of `hits` over `steps`, rotated. */
function euclid(hits: number, steps: number, rot: number): boolean[] {
  const out: boolean[] = [];
  for (let i = 0; i < steps; i++) out.push(((i + rot) * hits) % steps < hits);
  return out;
}

export class Music {
  private ctx: BaseAudioContext;
  private dest: AudioNode;
  private verbDest: AudioNode;
  private built = false;
  private running = false;
  private teardownTimer: ReturnType<typeof setTimeout> | null = null;

  // graph
  private out!: GainNode;        // dry mix (pre-fade)
  private verb!: GainNode;       // reverb send mix (pre-fade): pad + arps only
  private fadeDry!: GainNode;
  private fadeWet!: GainNode;
  private padFilter!: BiquadFilterNode;
  private padAmp!: GainNode;
  private padLfo!: OscillatorNode;
  private padLfoDepth!: GainNode;
  private trem!: OscillatorNode;
  private tremDepth!: GainNode;
  private noiseSrc!: AudioBufferSourceNode;
  private noiseFilter!: BiquadFilterNode;
  private noiseGain!: GainNode;
  private noiseLfo!: OscillatorNode;
  private noiseLfoDepth!: GainNode;
  private subA!: OscillatorNode;
  private subB!: OscillatorNode;
  private subGain!: GainNode;
  private arpBus!: GainNode;
  private arpDelay!: DelayNode;
  private arpFb!: GainNode;
  private percBus!: GainNode;
  private voices: PadVoice[] = [];

  // musical state
  private mood: Mood = 'menu';
  private tension = 0;
  private target = 0;
  private T = 0;                 // effective tension (per mood)
  private nextTime = 0;
  private stepDur = 0.25;
  private step = 0;
  private barsSinceChord = 0;
  private chordPending = true;
  private chord: number[] = PROGRESSIONS.menu[0];
  private progIdx: Partial<Record<Palette, number>> = {};
  private arpPattern: boolean[] = [];
  private arpIdx = 0;
  private arpDir = 1;

  constructor(ctx: BaseAudioContext, dest: AudioNode, verbDest: AudioNode) {
    this.ctx = ctx;
    this.dest = dest;
    this.verbDest = verbDest;
  }

  get active(): boolean { return this.running || this.teardownTimer !== null; }

  setMood(m: Mood): void {
    if (m === this.mood) return;
    this.mood = m;
    this.chordPending = true;
    if (this.built) this.updateContinuous(this.ctx.currentTime + 0.05);
  }

  setTension(t: number, immediate = false): void {
    this.target = clamp01(Number.isFinite(t) ? t : 0);
    if (immediate) this.tension = this.target;
  }

  start(fadeIn = 4): void {
    if (this.teardownTimer !== null) { clearTimeout(this.teardownTimer); this.teardownTimer = null; }
    if (!this.built) this.build();
    const now = this.ctx.currentTime;
    this.fade(1, now, fadeIn);
    if (!this.running) {
      this.running = true;
      this.nextTime = now + 0.06;
      this.chordPending = true;
      this.step = 0;
    }
  }

  stop(fadeOut = 2.5): void {
    if (!this.built) return;
    this.running = false;
    this.fade(0, this.ctx.currentTime, fadeOut);
    if (!isOffline(this.ctx) && this.teardownTimer === null) {
      this.teardownTimer = setTimeout(() => { this.teardownTimer = null; if (!this.running) this.teardown(); }, (fadeOut + 1) * 1000);
    }
  }

  /** Schedule all musical events up to `until` (context time). */
  pump(until: number): void {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.05; // recover after a stall
    let guard = 0;
    while (this.nextTime < until && guard++ < 256) {
      this.scheduleStep(this.nextTime);
      this.nextTime += this.stepDur;
    }
  }

  // ───────────────────────────── graph ─────────────────────────────

  /** Fade dry and reverb paths together so reverb tails never outlive a stop. */
  private fade(to: number, now: number, seconds: number): void {
    for (const g of [this.fadeDry, this.fadeWet]) {
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(to, now, Math.max(0.05, seconds / (to > 0 ? 3 : 4)));
    }
  }

  private build(): void {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.fadeDry = ctx.createGain();
    this.fadeDry.gain.value = 0;
    this.fadeDry.connect(this.dest);
    this.fadeWet = ctx.createGain();
    this.fadeWet.gain.value = 0;
    this.fadeWet.connect(this.verbDest);
    this.out = ctx.createGain();
    this.out.connect(this.fadeDry);
    this.verb = ctx.createGain();
    this.verb.gain.value = 0.55;
    this.verb.connect(this.fadeWet);

    // Pad chain
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 700;
    this.padFilter.Q.value = 0.8;
    this.padAmp = ctx.createGain();
    this.padAmp.gain.value = 0.9;
    this.padFilter.connect(this.padAmp).connect(this.out);
    this.padAmp.connect(this.verb);
    this.padLfo = ctx.createOscillator();
    this.padLfo.frequency.value = 0.05;
    this.padLfoDepth = ctx.createGain();
    this.padLfoDepth.gain.value = 220;
    this.padLfo.connect(this.padLfoDepth).connect(this.padFilter.frequency);
    this.trem = ctx.createOscillator();
    this.trem.frequency.value = 0.1;
    this.tremDepth = ctx.createGain();
    this.tremDepth.gain.value = 0.06;
    this.trem.connect(this.tremDepth).connect(this.padAmp.gain);

    // Noise bed
    this.noiseSrc = ctx.createBufferSource();
    this.noiseSrc.buffer = noiseBuffer(ctx);
    this.noiseSrc.loop = true;
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.value = 500;
    this.noiseFilter.Q.value = 0.6;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    this.noiseSrc.connect(this.noiseFilter).connect(this.noiseGain).connect(this.out);
    this.noiseLfo = ctx.createOscillator();
    this.noiseLfo.frequency.value = 0.07;
    this.noiseLfoDepth = ctx.createGain();
    this.noiseLfoDepth.gain.value = 200;
    this.noiseLfo.connect(this.noiseLfoDepth).connect(this.noiseFilter.frequency);

    // Sub rumble (fundamental + octave so small speakers still hint at it)
    this.subGain = ctx.createGain();
    this.subGain.gain.value = 0;
    this.subGain.connect(this.out);
    this.subA = ctx.createOscillator();
    this.subA.frequency.value = midiHz(26); // D1
    this.subB = ctx.createOscillator();
    this.subB.frequency.value = midiHz(38.1);
    const subBGain = ctx.createGain();
    subBGain.gain.value = 0.35;
    this.subA.connect(this.subGain);
    this.subB.connect(subBGain).connect(this.subGain);

    // Arp bus with dotted-8th echo (low-passed feedback loop)
    this.arpBus = ctx.createGain();
    this.arpBus.connect(this.out);
    this.arpDelay = ctx.createDelay(2);
    this.arpDelay.delayTime.value = 0.75;
    this.arpFb = ctx.createGain();
    this.arpFb.gain.value = 0.36;
    const loopLp = ctx.createBiquadFilter();
    loopLp.type = 'lowpass';
    loopLp.frequency.value = 2600;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.arpBus.connect(this.arpDelay);
    this.arpDelay.connect(loopLp).connect(this.arpFb).connect(this.arpDelay);
    loopLp.connect(wet).connect(this.out);
    wet.connect(this.verb);

    this.percBus = ctx.createGain();
    this.percBus.connect(this.out);

    for (const o of [this.padLfo, this.trem, this.noiseLfo, this.subA, this.subB]) o.start(t);
    this.noiseSrc.start(t, Math.random() * 1.5);
    this.built = true;
    this.updateContinuous(t);
  }

  private teardown(): void {
    if (!this.built) return;
    const t = this.ctx.currentTime;
    const stopSafe = (n: AudioScheduledSourceNode) => { try { n.stop(t + 0.05); } catch { /* already stopped */ } };
    [this.padLfo, this.trem, this.noiseLfo, this.subA, this.subB, this.noiseSrc].forEach(stopSafe);
    this.voices.forEach((v) => v.oscs.forEach(stopSafe));
    this.voices = [];
    try { this.fadeDry.disconnect(); this.fadeWet.disconnect(); } catch { /* ignore */ }
    this.built = false;
  }

  // ───────────────────────────── sequencing ─────────────────────────────

  private profile(): Profile { return PROFILES[this.mood]; }

  private scheduleStep(time: number): void {
    const prof = this.profile();
    this.tension += (this.target - this.tension) * (1 - Math.exp(-this.stepDur / 3));
    const T = (this.T = prof.useTension ? this.tension : prof.fixedT);
    this.stepDur = 60 / prof.tempo(T) / 4;
    const s = this.step % 16;

    if (s === 0) {
      this.barsSinceChord++;
      if (this.barsSinceChord >= prof.barsPerChord) this.chordPending = true;
      const hits = Math.max(1, Math.min(10, Math.round(prof.arpHits(T) + (Math.random() - 0.5))));
      this.arpPattern = euclid(hits, 16, (Math.random() * 16) | 0);
    }
    if (this.chordPending && s % 4 === 0) this.changeChord(time);
    if (s % 4 === 0) this.updateContinuous(time);

    if (this.arpPattern[s] && Math.random() < 0.85) this.arpNote(time, T);
    if (prof.pulse) this.bassPulse(time, s, T);
    if (prof.heartbeat) this.heartbeatRule(time, s, T);
    if (prof.ticks && T > 0.5 && s % 4 === 0) this.tick(time, (this.step >> 2) % 2 === 0, smoothstep(0.5, 0.85, T));
    this.step++;
  }

  private pickPalette(): Palette {
    const prof = this.profile();
    if (prof.palette) return prof.palette;
    const T = this.tension;
    const wCalm = 1 - smoothstep(0.2, 0.5, T);
    const wDread = smoothstep(0.55, 0.85, T);
    const wUneasy = Math.max(0, 1 - wCalm - wDread);
    const r = Math.random() * (wCalm + wUneasy + wDread);
    return r < wCalm ? 'calm' : r < wCalm + wUneasy ? 'uneasy' : 'dread';
  }

  private changeChord(time: number): void {
    this.chordPending = false;
    this.barsSinceChord = 0;
    const pal = this.pickPalette();
    const prog = PROGRESSIONS[pal];
    const idx = ((this.progIdx[pal] ?? -1) + 1) % prog.length;
    this.progIdx[pal] = idx;
    const notes = prog[idx];
    this.chord = notes;

    const ctx = this.ctx;
    for (const v of this.voices) {
      v.gain.gain.cancelScheduledValues(time);
      v.gain.gain.setTargetAtTime(0, time, 1.7);
      for (const o of v.oscs) { try { o.stop(time + 11); } catch { /* ignore */ } }
    }
    this.voices = [];
    const wave = warmSaw(ctx);
    for (const m of notes) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      const level = m < 40 ? 0.05 : m < 52 ? 0.042 : m < 62 ? 0.034 : 0.026;
      g.gain.setTargetAtTime(level, time, 1.3);
      g.connect(this.padFilter);
      const oscs: OscillatorNode[] = [];
      // Two detuned oscillators per note give a slow natural chorus.
      for (const dt of [-7, 6]) {
        const o = ctx.createOscillator();
        o.setPeriodicWave(wave);
        o.frequency.value = midiHz(m);
        o.detune.value = dt + (Math.random() * 4 - 2);
        o.connect(g);
        o.start(time);
        oscs.push(o);
      }
      oscs[0].onended = () => { try { g.disconnect(); } catch { /* ignore */ } };
      this.voices.push({ oscs, gain: g });
    }
  }

  private updateContinuous(time: number): void {
    const prof = this.profile();
    const T = prof.useTension ? this.tension : prof.fixedT;
    const set = (p: AudioParam, v: number, tau: number) => p.setTargetAtTime(v, time, tau);
    const cutoff = lerp(620, 2100, Math.pow(T, 1.2)) * prof.bright;
    set(this.padFilter.frequency, cutoff, 1.5);
    set(this.padFilter.Q, lerp(0.7, 4.5, T), 2);
    set(this.padLfo.frequency, lerp(0.045, 0.2, T), 2);
    set(this.padLfoDepth.gain, cutoff * 0.35, 2);
    const trem = lerp(0.05, 0.22, T);
    set(this.trem.frequency, lerp(0.09, 0.55, T), 2);
    set(this.tremDepth.gain, trem, 2);
    set(this.padAmp.gain, 0.95 - trem, 2);
    const noiseHz = lerp(450, 1500, T) * Math.min(1, 0.45 + 0.55 * prof.bright); // darker moods → darker air
    set(this.noiseFilter.frequency, noiseHz, 2);
    set(this.noiseLfoDepth.gain, noiseHz * 0.4, 2);
    set(this.noiseGain.gain, lerp(0.016, 0.034, T) * prof.noise, 2);
    set(this.subGain.gain, Math.max(smoothstep(0.55, 1, T) * 0.2, prof.sub * 0.2), 2.5);
    set(this.arpFb.gain, lerp(0.34, 0.46, T), 2);
    set(this.arpDelay.delayTime, Math.min(1.9, (60 / prof.tempo(T)) * 0.75), 3);
  }

  private voice(dest: AudioNode, time: number, send = this.verb): Voice {
    return { ctx: this.ctx, out: dest, send, t: time, p: 1, r: Math.random };
  }

  private arpNote(time: number, T: number): void {
    const prof = this.profile();
    // Chord tones folded into the arp register (base .. base+14), sorted.
    const pcs = Array.from(new Set(this.chord.map((m) => m % 12)));
    const pool: number[] = [];
    for (let m = prof.arpBase; m <= prof.arpBase + 14; m++) if (pcs.includes(m % 12)) pool.push(m);
    if (!pool.length) return;
    // Melodic walk with occasional leaps.
    if (Math.random() < 0.25) this.arpDir = -this.arpDir;
    this.arpIdx += Math.random() < 0.15 ? this.arpDir * 2 : this.arpDir;
    if (this.arpIdx < 0) { this.arpIdx = 1; this.arpDir = 1; }
    if (this.arpIdx >= pool.length) { this.arpIdx = pool.length - 2; this.arpDir = -1; }
    const m = pool[Math.max(0, Math.min(pool.length - 1, this.arpIdx))];
    const f = midiHz(m);
    const v = this.voice(this.arpBus, time);
    const g = (0.042 + Math.random() * 0.016) * (this.mood === 'ending_bad' ? 0.8 : 1);
    const d = lerp(1.5, 0.5, T);
    tone(v, { f, a: 0.004, d, g, send: 0.5, pan: Math.random() * 0.8 - 0.4 });
    tone(v, { f: f * 2, a: 0.003, d: d * 0.4, g: g * 0.22 });
    if (T > 0.5) tone(v, { type: 'triangle', f, a: 0.003, d: 0.12, g: g * 0.5 * smoothstep(0.5, 1, T), lp: 2400 });
  }

  private bassPulse(time: number, s: number, T: number): void {
    const level = smoothstep(0.25, 0.65, T);
    if (level <= 0.01 || s % 2) return;
    const root = Math.min(...this.chord);
    const m = root < 36 ? root + 12 : root;
    const accent = s % 4 === 0 ? 1.25 : 0.8;
    tone(this.voice(this.percBus, time), {
      type: 'triangle', f: midiHz(m), a: 0.004, d: lerp(0.18, 0.11, T), g: 0.065 * level * accent, lp: 320 + 520 * T, lpQ: 1.5,
    });
  }

  private heartbeatRule(time: number, s: number, T: number): void {
    const bar = Math.floor(this.step / 16);
    let beat = false;
    if (this.mood === 'ending_bad') beat = s === 0;
    else if (T < 0.35) beat = s === 0 && bar % 4 === 2 && Math.random() < 0.65;
    else if (T < 0.7) beat = s === 0 || (T > 0.55 && s === 8);
    else beat = T > 0.85 ? s % 4 === 0 : s % 8 === 0;
    if (!beat) return;
    const g = this.mood === 'ending_bad' ? 0.3 : lerp(0.2, 0.42, T);
    const v = this.voice(this.percBus, time);
    tone(v, { f: 62, f2: 38, glide: 0.12, a: 0.005, d: 0.22, g });
    noise(v, { d: 0.07, g: g * 0.25, type: 'lowpass', f: 140, q: 0.7 });
    const gap = Math.min(0.26, this.stepDur * 1.1);
    tone(v, { at: gap, f: 56, f2: 36, glide: 0.1, a: 0.005, d: 0.2, g: g * 0.7 });
  }

  private tick(time: number, high: boolean, level: number): void {
    const v = this.voice(this.percBus, time);
    const g = 0.075 * level;
    noise(v, { d: 0.018, g, f: high ? 4300 : 3100, q: 5, a: 0.001, pan: high ? 0.15 : -0.15 });
    tone(v, { f: high ? 2100 : 1550, d: 0.012, g: g * 0.35, a: 0.001 });
  }
}
