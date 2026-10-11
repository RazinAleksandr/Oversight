// Low-level Web Audio building blocks: bus graph, envelopes, oscillator / noise voices,
// procedurally generated buffers (noise, reverb impulse, plucked string, bitcrushed glitch).
// Everything works on BaseAudioContext so sounds can also be rendered offline (dev bench).

export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
/** Master make-up gain applied after the user volume curve (volume² × MASTER_TRIM). */
export const MASTER_TRIM = 1.3;
export const isOffline = (ctx: BaseAudioContext): boolean =>
  typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;

// ───────────────────────────── bus graph ─────────────────────────────

export interface Graph {
  ctx: BaseAudioContext;
  master: GainNode;      // volume
  sfx: GainNode;         // sfx dry bus (mute = 0)
  sfxVerb: GainNode;     // sfx reverb send bus (mirrors sfx mute)
  music: GainNode;       // music dry bus (mute = 0)
  musicVerb: GainNode;   // music reverb send bus
}

/** master → compressor → destination; sfx/music buses (+ their reverb sends) → master. */
export function buildGraph(ctx: BaseAudioContext): Graph {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.22;
  comp.connect(ctx.destination);

  const master = ctx.createGain();
  master.connect(comp);

  const reverb = ctx.createConvolver();
  reverb.normalize = true;
  reverb.buffer = impulseResponse(ctx, 2.6, 2.6);
  const verbReturn = ctx.createGain();
  verbReturn.gain.value = 0.55;
  reverb.connect(verbReturn).connect(master);

  const sfx = ctx.createGain();
  sfx.connect(master);
  const sfxVerb = ctx.createGain();
  sfxVerb.connect(reverb);

  const music = ctx.createGain();
  music.connect(master);
  const musicVerb = ctx.createGain();
  musicVerb.connect(reverb);

  return { ctx, master, sfx, sfxVerb, music, musicVerb };
}

// ───────────────────────────── generated buffers ─────────────────────────────

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** 2 s of white noise, shared per context. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (b) return b;
  b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, b);
  return b;
}

/** Stereo decaying noise with progressive darkening — a smooth plate/hall. */
function impulseResponse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const pre = Math.floor(rate * 0.014);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const p = (i - pre) / (len - pre);
      const k = 0.75 - 0.62 * p; // low-pass coefficient: bright early, dark tail
      lp += k * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - p, decay);
    }
  }
  return buf;
}

const pluckCache = new Map<string, AudioBuffer>();

/**
 * Karplus–Strong plucked string rendered into a buffer (no feedback graph needed).
 * `t60` is the time for the string to decay by 60 dB; the buffer is long enough to hold it.
 */
export function pluckBuffer(ctx: BaseAudioContext, freq: number, t60 = 1.2): AudioBuffer {
  const seconds = t60 * 1.1;
  // Per-period loop gain that yields −60 dB after t60 seconds.
  const damping = Math.pow(10, -3 / (t60 * freq));
  const key = `${ctx.sampleRate}:${freq.toFixed(2)}:${t60}`;
  const hit = pluckCache.get(key);
  if (hit) return hit;
  const sr = ctx.sampleRate;
  const n = Math.max(2, Math.round(sr / freq));
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const ring = new Float32Array(n);
  // Slightly low-passed excitation = softer, more "gut string" attack.
  let prev = 0;
  for (let i = 0; i < n; i++) { const x = Math.random() * 2 - 1; prev = prev * 0.45 + x * 0.55; ring[i] = prev; }
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const a = ring[idx];
    const b = ring[idx + 1 === n ? 0 : idx + 1];
    out[i] = a;
    ring[idx] = damping * 0.5 * (a + b);
    idx = idx + 1 === n ? 0 : idx + 1;
  }
  // Fade the last 30 ms to avoid a click at buffer end.
  const fade = Math.floor(sr * 0.03);
  for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
  if (pluckCache.size > 48) pluckCache.clear();
  pluckCache.set(key, buf);
  return buf;
}

/** Fresh bitcrushed "data corruption" burst: random square/noise/sweep segments, sample-and-hold + quantized. */
export function glitchBuffer(ctx: BaseAudioContext, seconds = 0.34): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let i = 0;
  while (i < len) {
    const segLen = Math.floor(sr * (0.012 + Math.random() * 0.045));
    const kind = Math.random();
    const f = 90 + Math.random() * 1800;
    const f2 = f * (0.3 + Math.random() * 3);
    const amp = 0.35 + Math.random() * 0.6;
    const hold = 2 + Math.floor(Math.random() * 22);
    const levels = 4 + Math.floor(Math.random() * 12);
    let held = 0;
    for (let j = 0; j < segLen && i < len; j++, i++) {
      if (j % hold === 0) {
        const t = j / sr;
        let v: number;
        if (kind < 0.12) v = 0; // dropout
        else if (kind < 0.45) v = Math.sin(2 * Math.PI * f * t) > 0 ? 1 : -1;
        else if (kind < 0.7) v = Math.random() * 2 - 1;
        else { const ff = f + (f2 - f) * (j / segLen); v = Math.sin(2 * Math.PI * ff * t); }
        held = Math.round(v * amp * levels) / levels;
      }
      d[i] = held;
    }
  }
  const fadeIn = Math.floor(sr * 0.002), fadeOut = Math.floor(sr * 0.03);
  for (let k = 0; k < fadeIn; k++) d[k] *= k / fadeIn;
  for (let k = 0; k < fadeOut; k++) d[len - 1 - k] *= k / fadeOut;
  return buf;
}

let warmWave: { ctx: BaseAudioContext; wave: PeriodicWave } | null = null;

/** A softened sawtooth (harmonics fall off as 1/n^1.45) — warmer pads with less filtering. */
export function warmSaw(ctx: BaseAudioContext): PeriodicWave {
  if (warmWave && warmWave.ctx === ctx) return warmWave.wave;
  const N = 40;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  for (let n = 1; n < N; n++) imag[n] = (n % 2 ? 1 : -1) / Math.pow(n, 1.45);
  const wave = ctx.createPeriodicWave(real, imag);
  warmWave = { ctx, wave };
  return wave;
}

// ───────────────────────────── voice helpers ─────────────────────────────

/** Everything a sound recipe needs: where to play, when, and per-play randomness. */
export interface Voice {
  ctx: BaseAudioContext;
  out: AudioNode;   // dry destination
  send: AudioNode;  // reverb send destination
  t: number;        // start time (ctx seconds)
  p: number;        // pitch multiplier (random variation × caller pitch)
  r: () => number;  // random 0..1
}

/** Percussive envelope: linear attack, exponential-ish decay via setTargetAtTime. */
export function env(param: AudioParam, t0: number, attack: number, peak: number, decay: number): void {
  param.setValueAtTime(0, t0);
  param.linearRampToValueAtTime(peak, t0 + attack);
  param.setTargetAtTime(0, t0 + attack, decay / 6);
}

/** Connect a voice's final node to the dry out (+ optional pan and reverb send). Returns created nodes. */
function route(v: Voice, node: AudioNode, sendAmt = 0, pan = 0): AudioNode[] {
  const made: AudioNode[] = [node];
  let last: AudioNode = node;
  if (pan && typeof v.ctx.createStereoPanner === 'function') {
    const p = v.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    last.connect(p);
    last = p;
    made.push(p);
  }
  last.connect(v.out);
  if (sendAmt > 0) {
    const s = v.ctx.createGain();
    s.gain.value = sendAmt;
    last.connect(s).connect(v.send);
    made.push(s);
  }
  return made;
}

/** Disconnect a finished note's tail nodes so long-lived buses never accumulate dead branches. */
function cleanupOnEnd(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  src.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch { /* ignore */ } } };
}

export interface ToneOpts {
  type?: OscillatorType | 'warm';
  f: number;           // Hz (multiplied by voice pitch)
  f2?: number;         // glide target Hz
  glide?: number;      // glide time (s), defaults to decay
  at?: number;         // offset from voice start (s)
  a?: number;          // attack (s)
  d: number;           // decay (s, to ~0.25%)
  g: number;           // peak gain
  detune?: number;     // cents
  lp?: number; lpQ?: number; lp2?: number;   // low-pass (optional sweep to lp2 over decay)
  hp?: number;
  send?: number;
  pan?: number;
  fixedPitch?: boolean; // ignore voice pitch variation
}

export function tone(v: Voice, o: ToneOpts): number {
  const ctx = v.ctx;
  const t0 = v.t + (o.at ?? 0);
  const a = Math.max(0.0015, o.a ?? 0.004);
  const pm = o.fixedPitch ? 1 : v.p;
  const osc = ctx.createOscillator();
  if (o.type === 'warm') osc.setPeriodicWave(warmSaw(ctx));
  else osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f * pm, t0);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2 * pm), t0 + (o.glide ?? o.d));
  if (o.detune) osc.detune.value = o.detune;
  let node: AudioNode = osc;
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(o.lp, t0);
    if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t0 + a + o.d);
    f.Q.value = o.lpQ ?? 0.7;
    node.connect(f);
    node = f;
  }
  if (o.hp) {
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = o.hp;
    node.connect(f);
    node = f;
  }
  const g = ctx.createGain();
  env(g.gain, t0, a, o.g, o.d);
  node.connect(g);
  cleanupOnEnd(osc, route(v, g, o.send, o.pan));
  osc.start(t0);
  osc.stop(t0 + a + o.d + 0.05);
  return (o.at ?? 0) + a + o.d;
}

export interface NoiseOpts {
  at?: number;
  a?: number;
  d: number;
  g: number;
  type?: BiquadFilterType;
  f: number;           // filter frequency
  f2?: number;         // sweep target
  sweep?: number;      // sweep time (defaults to a + d)
  q?: number;
  hp?: number;         // extra high-pass
  send?: number;
  pan?: number;
}

export function noise(v: Voice, o: NoiseOpts): number {
  const ctx = v.ctx;
  const t0 = v.t + (o.at ?? 0);
  const a = Math.max(0.001, o.a ?? 0.002);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.f, t0);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.sweep ?? a + o.d));
  f.Q.value = o.q ?? 1;
  let node: AudioNode = src;
  node.connect(f);
  node = f;
  if (o.hp) {
    const h = ctx.createBiquadFilter();
    h.type = 'highpass';
    h.frequency.value = o.hp;
    node.connect(h);
    node = h;
  }
  const g = ctx.createGain();
  env(g.gain, t0, a, o.g, o.d);
  node.connect(g);
  cleanupOnEnd(src, route(v, g, o.send, o.pan));
  src.start(t0, v.r() * 1.5);
  src.stop(t0 + a + o.d + 0.05);
  return (o.at ?? 0) + a + o.d;
}

/** Play a prepared buffer through an envelope-free gain (buffer carries its own envelope). */
export function sample(v: Voice, buf: AudioBuffer, o: { at?: number; g: number; rate?: number; lp?: number; hp?: number; send?: number; pan?: number }): number {
  const ctx = v.ctx;
  const t0 = v.t + (o.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = (o.rate ?? 1) * v.p;
  let node: AudioNode = src;
  if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
  if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; node.connect(f); node = f; }
  const g = ctx.createGain();
  g.gain.value = o.g;
  node.connect(g);
  cleanupOnEnd(src, route(v, g, o.send, o.pan));
  src.start(t0);
  return (o.at ?? 0) + buf.duration / src.playbackRate.value;
}

/** Bell / chime: a few sine partials with individual decays. */
export function bell(v: Voice, f: number, o: { at?: number; g: number; d: number; send?: number; pan?: number; bright?: number }): number {
  const b = o.bright ?? 1;
  const end = tone(v, { f, at: o.at, a: 0.003, d: o.d, g: o.g, send: o.send, pan: o.pan });
  tone(v, { f: f * 2, at: o.at, a: 0.002, d: o.d * 0.45, g: o.g * 0.28 * b, send: o.send, pan: o.pan });
  tone(v, { f: f * 3.01, at: o.at, a: 0.002, d: o.d * 0.22, g: o.g * 0.12 * b, send: o.send, pan: o.pan });
  tone(v, { type: 'triangle', f, at: o.at, a: 0.002, d: 0.08, g: o.g * 0.25, pan: o.pan });
  return end;
}
