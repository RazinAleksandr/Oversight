// FX & Audio test bench (dev only — not part of the build).
// Exposes `window.bench` for scripted screenshots / headless checks.

import fx, { _backgroundDebug, _snapBackgroundTension, replayClass } from '../src/fx';
import audio, { _audioDebug } from '../src/audio';
import { renderMusic, renderSfx } from '../src/audio/offline';
import type { SfxId } from '../src/engine/types';

type Mood = 'menu' | 'game' | 'ending_good' | 'ending_bad';

const SFX_IDS: SfxId[] = [
  'click', 'hover', 'open', 'close', 'card_in', 'card_out', 'approve', 'reject', 'stamp', 'alert', 'critical',
  'success', 'fail', 'turn', 'type', 'coin', 'negotiate', 'glitch', 'reveal', 'tab', 'unlock', 'ending_good', 'ending_bad',
];

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const center = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

// ───────────────────────────── background ─────────────────────────────

const canvas = $<HTMLCanvasElement>('#bg-canvas');
let bgOn = true;
fx.startBackground(canvas);

function setTension(t: number, snap = false): void {
  $<HTMLInputElement>('#tension').value = String(t);
  $('#tval').textContent = t.toFixed(2);
  fx.setBackgroundTension(t);
  audio.setTension(t);
  if (snap) _snapBackgroundTension();
}

$<HTMLInputElement>('#tension').addEventListener('input', (e) => setTension(+(e.target as HTMLInputElement).value));
document.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => b.addEventListener('click', () => setTension(+b.dataset.t!)));
$('#bg-toggle').addEventListener('click', (e) => {
  bgOn = !bgOn;
  if (bgOn) fx.startBackground(canvas); else fx.stopBackground();
  (e.target as HTMLElement).textContent = bgOn ? 'Stop bg' : 'Start bg';
});
function hidePanel(on: boolean): void { document.body.classList.toggle('clean', on); }
$('#clean').addEventListener('click', () => hidePanel(true));
window.addEventListener('keydown', (e) => { if (e.key === 'h' || e.key === 'H') hidePanel(!document.body.classList.contains('clean')); });
$<HTMLInputElement>('#rm').addEventListener('change', (e) => fx.setReducedMotion((e.target as HTMLInputElement).checked));

// ───────────────────────────── fx buttons ─────────────────────────────

let meterValue = 62;
const on = (id: string, fn: (el: HTMLElement) => void) => $(`#${id}`).addEventListener('click', (e) => fn(e.currentTarget as HTMLElement));

on('shake', () => fx.shake());
on('shake-hard', () => fx.shake(2, 300));
on('flash', () => fx.flash());
on('flash-red', () => { fx.flash('var(--bad)', 360); audio.play('critical'); });
on('vig-red', () => { fx.vignette('var(--bad)', 1600); audio.play('alert'); });
on('vig-amber', () => fx.vignette('var(--warn)', 1400));
on('burst', (b) => { const c = center(b); fx.burst(c.x, c.y); audio.play('success'); });
on('burst-good', () => { const c = center($('#meter')); fx.burst(c.x, c.y, { color: 'var(--good)', count: 40, spread: 1.3 }); audio.play('coin'); });
on('float-up', () => bumpMeter(+3));
on('float-down', () => bumpMeter(-5));
on('tween', () => bumpMeter(Math.round(Math.random() * 30 - 15)));
on('glitch', () => { fx.glitch($('#aihead'), 700); audio.play('glitch'); });
on('pulse', () => fx.pulse($('#meter'), 'var(--good)'));
on('type', () => {
  const job = fx.typewriter($('#typebox'), 'INTERCEPT 0417: Model weights for Atlas-3 detected on an unlisted server in Varn. Origin unknown.', 42, () => audio.play('type'));
  job.done.then(() => audio.play('reveal'));
});
on('stagger', () => { fx.staggerIn($('#stage'), '[data-fx="reveal"]', 70); audio.play('card_in'); });

function bumpMeter(delta: number): void {
  const el = $('#meter-val');
  const from = meterValue;
  meterValue = Math.max(0, Math.min(100, meterValue + delta));
  fx.tweenNumber(el, from, meterValue, 400);
  $('#meter-bar').style.width = `${meterValue}%`;
  const c = center(el);
  const sign = delta >= 0 ? '+' : '−';
  fx.floatText(c.x, c.y - 18, `${sign}${Math.abs(delta)}`);
  fx.pulse($('#meter'), delta >= 0 ? 'var(--good)' : 'var(--bad)');
  audio.play(delta >= 0 ? 'approve' : 'reject');
}

// CSS utility classes
document.querySelectorAll<HTMLButtonElement>('[data-cls]').forEach((b) => b.addEventListener('click', () => {
  const target = $(b.dataset.target!);
  const cls = b.dataset.cls!;
  if (cls === 'fx-stamp') { target.classList.remove('hidden'); audio.play('stamp'); fx.shake(0.5, 180); }
  if (cls === 'fx-flip' || cls === 'fx-flip-out') audio.play('turn');
  if (cls === 'fx-redact-reveal') audio.play('reveal');
  if (cls === 'fx-scan') audio.play('open');
  if (target.id === 'list') {
    target.querySelectorAll<HTMLElement>('li').forEach((li, i) => { li.style.setProperty('--fx-delay', `${i * 70}ms`); replayClass(li, cls, true); });
    return;
  }
  ['fx-flip', 'fx-flip-out'].forEach((c) => c !== cls && target.classList.remove(c));
  replayClass(target, cls, cls === 'fx-stamp' || cls.startsWith('fx-flip') || cls === 'fx-redact-reveal' || cls === 'fx-scan');
}));
document.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
  const on = $(b.dataset.target!).classList.toggle(b.dataset.toggle!);
  b.classList.toggle('on', on);
}));

// ───────────────────────────── audio ─────────────────────────────

const sfxRow = $('#sfx-buttons');
for (const id of SFX_IDS) {
  const b = document.createElement('button');
  b.className = 'sfx';
  b.textContent = id;
  b.addEventListener('click', () => audio.play(id));
  if (id === 'hover') b.addEventListener('pointerenter', () => audio.play('hover'));
  sfxRow.appendChild(b);
}

// First gesture unlocks audio (what the UI should do too).
const unlockOnce = () => audio.unlock();
window.addEventListener('pointerdown', unlockOnce, { capture: true });
window.addEventListener('keydown', unlockOnce, { capture: true });
on('unlock', () => audio.unlock());
on('music-start', () => audio.startMusic());
on('music-stop', () => audio.stopMusic());
document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach((b) => b.addEventListener('click', () => setMood(b.dataset.mood as Mood)));
function setMood(m: Mood): void {
  audio.setMood(m);
  document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach((x) => x.classList.toggle('on', x.dataset.mood === m));
}
audio.setMood('game');
$<HTMLInputElement>('#vol').addEventListener('input', (e) => audio.setVolume(+(e.target as HTMLInputElement).value));
$<HTMLInputElement>('#snd').addEventListener('change', (e) => audio.setSoundEnabled((e.target as HTMLInputElement).checked));
$<HTMLInputElement>('#mus').addEventListener('change', (e) => audio.setMusicEnabled((e.target as HTMLInputElement).checked));

setInterval(() => {
  const d = _audioDebug();
  $('#status').textContent = `audio: ${d.state} · ${d.sampleRate} Hz · voices ${d.voices} · music ${d.music ? 'on' : 'off'}`;
}, 250);

async function playAll(gapMs = 120): Promise<string> {
  audio.unlock();
  for (const id of SFX_IDS) {
    audio.play(id);
    audio.play(id, { volume: 0.5, pitch: 1.5 });
    await new Promise((r) => setTimeout(r, gapMs));
  }
  audio.startMusic();
  for (const m of ['menu', 'game', 'ending_good', 'ending_bad', 'game'] as Mood[]) {
    setMood(m);
    for (const t of [0, 0.5, 1]) { audio.setTension(t); await new Promise((r) => setTimeout(r, 150)); }
  }
  audio.setVolume(0.3); audio.setSoundEnabled(false); audio.play('click'); audio.setSoundEnabled(true);
  audio.setMusicEnabled(false); audio.setMusicEnabled(true); audio.setVolume(0.8);
  audio.stopMusic();
  return JSON.stringify(_audioDebug());
}
on('play-all', () => { void playAll(); });

// ───────────────────────────── offline analysis ─────────────────────────────

interface Stats { name: string; peakDb: number; rmsDb: number; dur: number; clipped: boolean; centroid: number }

const db = (v: number) => (v > 0 ? 20 * Math.log10(v) : -120);

function stats(name: string, buf: AudioBuffer): Stats {
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  let peak = 0, sum = 0, last = 0;
  for (let i = 0; i < L.length; i++) {
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (a > peak) peak = a;
    sum += (L[i] * L[i] + R[i] * R[i]) / 2;
    if (a > 0.001) last = i;
  }
  const active = Math.max(1, last);
  return {
    name, peakDb: db(peak), rmsDb: db(Math.sqrt(sum / active)), dur: last / buf.sampleRate, clipped: peak >= 0.999,
    centroid: spectralCentroid(L, buf.sampleRate, active),
  };
}

function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

function frameSpectrum(data: Float32Array, start: number, N: number): Float32Array {
  const re = new Float32Array(N), im = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    re[i] = (data[start + i] ?? 0) * w;
  }
  fft(re, im);
  const mag = new Float32Array(N / 2);
  for (let i = 0; i < N / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

function spectralCentroid(data: Float32Array, sr: number, len: number): number {
  const N = 2048;
  let num = 0, den = 0;
  for (let s = 0; s + N < len; s += N * 2) {
    const mag = frameSpectrum(data, s, N);
    for (let i = 1; i < mag.length; i++) { const f = (i * sr) / N; num += f * mag[i]; den += mag[i]; }
  }
  return den > 0 ? num / den : 0;
}

function drawWave(c: HTMLCanvasElement, buf: AudioBuffer, seconds: number): void {
  const W = (c.width = 600), H = (c.height = 112);
  const g = c.getContext('2d')!;
  const d = buf.getChannelData(0);
  const n = Math.min(d.length, Math.floor(seconds * buf.sampleRate));
  g.fillStyle = '#04070d'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1f2b45'; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  g.fillStyle = '#3fd0ff';
  for (let x = 0; x < W; x++) {
    const a = Math.floor((x / W) * n), b = Math.floor(((x + 1) / W) * n);
    let lo = 0, hi = 0;
    for (let i = a; i < b; i++) { if (d[i] < lo) lo = d[i]; if (d[i] > hi) hi = d[i]; }
    g.fillRect(x, H / 2 - hi * H / 2, 1, Math.max(1, (hi - lo) * H / 2));
  }
}

function drawSpec(c: HTMLCanvasElement, buf: AudioBuffer, seconds: number): void {
  const W = (c.width = 600), H = (c.height = 144);
  const g = c.getContext('2d')!;
  const d = buf.getChannelData(0), sr = buf.sampleRate;
  const N = 1024, n = Math.min(d.length, Math.floor(seconds * sr));
  const img = g.createImageData(W, H);
  const fMin = 40, fMax = 14000;
  for (let x = 0; x < W; x++) {
    const start = Math.floor((x / W) * (n - N));
    const mag = frameSpectrum(d, Math.max(0, start), N);
    for (let y = 0; y < H; y++) {
      const f = fMin * Math.pow(fMax / fMin, 1 - y / (H - 1));
      const bin = Math.min(mag.length - 1, Math.round((f * N) / sr));
      const v = Math.max(0, Math.min(1, (db(mag[bin] / 40) + 80) / 80));
      const o = (y * W + x) * 4;
      img.data[o] = 255 * Math.min(1, v * 1.6);
      img.data[o + 1] = 255 * Math.max(0, v * 1.4 - 0.45);
      img.data[o + 2] = 255 * Math.max(0, Math.min(1, 0.3 + v * 0.9 - v * v));
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

function cell(root: HTMLElement, s: Stats, buf: AudioBuffer, seconds: number): void {
  const el = document.createElement('div');
  el.className = 'cell';
  const cls = s.clipped ? 'bad-txt' : s.peakDb > -3 ? 'warn-txt' : '';
  el.innerHTML = `<b>${s.name}</b><span class="${cls}">pk ${s.peakDb.toFixed(1)} dB · rms ${s.rmsDb.toFixed(1)} · ${s.dur.toFixed(2)}s · c ${Math.round(s.centroid)}Hz</span>`;
  const w = document.createElement('canvas');
  const sp = document.createElement('canvas');
  sp.className = 'spec';
  el.append(w, sp);
  root.appendChild(el);
  drawWave(w, buf, seconds);
  drawSpec(sp, buf, seconds);
}

async function analyze(which: 'sfx' | 'music' | 'all' = 'all'): Promise<Stats[]> {
  const panel = $('#analysis');
  panel.innerHTML = '<h1 style="margin:0 0 10px">Offline render analysis <button id="close-analysis" style="float:right">Close</button></h1>';
  panel.classList.add('open');
  $('#close-analysis').addEventListener('click', () => panel.classList.remove('open'));
  const grid = document.createElement('div');
  grid.className = 'grid';
  panel.appendChild(grid);
  const out: Stats[] = [];
  if (which !== 'music') {
    for (const id of SFX_IDS) {
      const buf = await renderSfx(id);
      const s = stats(id, buf);
      out.push(s);
      cell(grid, s, buf, Math.min(buf.duration, Math.max(0.25, s.dur + 0.1)));
    }
  }
  if (which !== 'sfx') {
    for (const mood of ['menu', 'game', 'ending_good', 'ending_bad'] as Mood[]) {
      for (const t of mood === 'game' ? [0, 0.5, 1] : [0]) {
        const buf = await renderMusic(mood, t, 12);
        const s = stats(`music ${mood}${mood === 'game' ? ' t=' + t : ''}`, buf);
        out.push(s);
        cell(grid, s, buf, 12);
      }
    }
  }
  return out;
}
on('analyze', () => { void analyze(); });

// Kick off a stagger so the bench itself demonstrates the entrance.
fx.staggerIn($('#stage'), '[data-fx="reveal"]', 70);

Object.assign(window, { bench: { fx, audio, setTension, hidePanel, analyze, playAll, setMood, debug: _audioDebug, bgDebug: _backgroundDebug } });
