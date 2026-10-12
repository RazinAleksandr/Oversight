// Audio module — procedural Web Audio SFX + generative music. Implements AudioAPI (src/engine/types.ts).
//
// • The AudioContext is created/resumed in unlock() (call from the first pointerup/keydown).
//   Settings and startMusic()/setTension()/setMood() calls made before that are remembered.
// • Graph: voices → sfx / music buses (+ reverb sends) → master (volume) → compressor → out.
// • Never throws: every public call is guarded; without Web Audio everything is a no-op.
// • The context is suspended while the tab is hidden and resumed when it comes back.
// • setMood('ending_good' | 'ending_bad') also plays the matching stinger — don't play it twice.

import type { AudioAPI, SfxId } from '../engine/types';
import { buildGraph, MASTER_TRIM, type Graph } from './dsp';
import type { Mood } from './harmony';
import { Music } from './music';
import { MIN_INTERVAL, PITCH_JITTER, SFX } from './sfx';

const LOOKAHEAD = 0.3;        // seconds of music scheduled ahead
const SCHED_INTERVAL = 60;    // ms between scheduler wake-ups
const MAX_VOICES = 48;
const LOW_PRIORITY = new Set<SfxId>(['hover', 'type', 'click', 'tab']);

const settings = { volume: 0.8, sound: true, music: true };
const musicState = { wanted: false, tension: 0, mood: 'menu' as Mood };

let ctx: AudioContext | null = null;
let graph: Graph | null = null;
let music: Music | null = null;
let schedTimer: ReturnType<typeof setInterval> | null = null;
let unavailable = false;
let primed = false;
let suspendedForHidden = false;
let appActive = true;
let activeVoices = 0;
const lastPlayed = new Map<SfxId, number>();

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

function report(e: unknown): void {
  if (import.meta.env?.DEV) console.error('[audio]', e);
}

/** Run `fn`, swallowing (and in dev, logging) any error. */
function guard(fn: () => void): void {
  try { fn(); } catch (e) { report(e); }
}

// ───────────────────────────── context ─────────────────────────────

function ensureContext(): boolean {
  if (ctx) return true;
  if (unavailable || typeof window === 'undefined') return false;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) { unavailable = true; return false; }
  try {
    ctx = new AC({ latencyHint: 'interactive' });
    graph = buildGraph(ctx);
    applySettings(true);
    document.addEventListener('visibilitychange', onVisibility);
    return true;
  } catch (e) {
    report(e);
    unavailable = true;
    ctx = null;
    graph = null;
    return false;
  }
}

function resume(): void {
  if (!ctx || ctx.state === 'closed' || suspendedForHidden || !appActive || document.hidden) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => { /* needs a gesture; retried on next call */ });
}

function onVisibility(): void {
  guard(() => {
    if (!ctx || ctx.state === 'closed') return;
    if (document.hidden || !appActive) {
      suspendedForHidden = true;
      if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
      if (ctx.state === 'running') {
        ctx.suspend().catch(report);
      }
    } else {
      suspendedForHidden = false;
      resume();
      if (musicState.wanted && settings.music) startMusicNow();
    }
  });
}

/** Native interruptions share the same suspension path as page visibility. */
export function setAudioActive(active: boolean): void {
  appActive = active;
  onVisibility();
}

/** Push volume / enable flags into the graph (smoothed, so toggles never click). */
function applySettings(immediate = false): void {
  if (!ctx || !graph) return;
  const now = ctx.currentTime;
  const set = (p: AudioParam, v: number, tau: number) => {
    if (immediate) { p.cancelScheduledValues(now); p.setValueAtTime(v, now); }
    else p.setTargetAtTime(v, now, tau);
  };
  const vol = settings.volume;
  set(graph.master.gain, vol * vol * MASTER_TRIM, 0.05); // perceptual (squared) volume curve
  const sfx = settings.sound ? 1 : 0;
  set(graph.sfx.gain, sfx, 0.03);
  set(graph.sfxVerb.gain, sfx, 0.03);
  const mus = settings.music ? 0.6 : 0;
  set(graph.music.gain, mus, 0.4);
  set(graph.musicVerb.gain, mus, 0.4);
}

// ───────────────────────────── music ─────────────────────────────

function startMusicNow(): void {
  if (!ctx || !graph || !appActive || document.hidden) return;
  const fresh = !music;
  if (!music) music = new Music(ctx, graph.music, graph.musicVerb);
  music.setMood(musicState.mood);
  music.setTension(musicState.tension, fresh);
  music.start(fresh ? 4 : 2);
  if (!schedTimer) {
    schedTimer = setInterval(() => guard(() => {
      if (!ctx || !music) return;
      if (ctx.state === 'running') music.pump(ctx.currentTime + LOOKAHEAD);
      if (!music.active && schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    }), SCHED_INTERVAL);
  }
  if (ctx.state === 'running') music.pump(ctx.currentTime + LOOKAHEAD);
}

// ───────────────────────────── sfx ─────────────────────────────

function playNow(id: SfxId, opts?: { volume?: number; pitch?: number }): void {
  if (!settings.sound || !ctx || !graph || ctx.state === 'closed' || !appActive || document.hidden) return;
  const recipe = SFX[id];
  if (!recipe) return;
  resume();
  const nowMs = performance.now();
  if (nowMs - (lastPlayed.get(id) ?? -1e9) < (MIN_INTERVAL[id] ?? 25)) return;
  if (activeVoices >= MAX_VOICES && LOW_PRIORITY.has(id)) return;
  lastPlayed.set(id, nowMs);

  const vol = clamp(opts?.volume ?? 1, 0, 2);
  if (vol === 0) return;
  const jitter = PITCH_JITTER[id] ?? 0.03;
  const p = clamp(opts?.pitch ?? 1, 0.25, 4) * (1 + (Math.random() * 2 - 1) * jitter);
  const out = ctx.createGain();
  out.gain.value = vol;
  out.connect(graph.sfx);
  const send = ctx.createGain();
  send.gain.value = vol;
  send.connect(graph.sfxVerb);

  const dur = recipe({ ctx, out, send, t: ctx.currentTime + 0.008, p, r: Math.random });
  activeVoices++;
  setTimeout(() => {
    activeVoices--;
    try { out.disconnect(); send.disconnect(); } catch { /* ignore */ }
  }, (dur + 0.4) * 1000);
}

// ───────────────────────────── public API ─────────────────────────────

export const audio: AudioAPI = {
  unlock() {
    guard(() => {
      if (!ensureContext() || !ctx) return;
      resume();
      // iOS: a silent one-sample buffer started inside the first gesture fully unlocks output.
      if (!primed) {
        primed = true;
        const s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        s.connect(ctx.destination);
        s.start();
      }
      if (musicState.wanted && settings.music && (!music || !music.active)) startMusicNow();
    });
  },

  play(id, opts) {
    guard(() => playNow(id, opts));
  },

  setTension(t) {
    guard(() => {
      musicState.tension = clamp(t, 0, 1);
      music?.setTension(musicState.tension);
    });
  },

  startMusic() {
    guard(() => {
      musicState.wanted = true;
      if (ctx && settings.music) startMusicNow();
    });
  },

  stopMusic() {
    guard(() => {
      musicState.wanted = false;
      music?.stop(2.5);
    });
  },

  setSoundEnabled(on) {
    guard(() => { settings.sound = !!on; applySettings(); });
  },

  setMusicEnabled(on) {
    guard(() => {
      settings.music = !!on;
      applySettings();
      if (!settings.music) music?.stop(0.8);
      else if (musicState.wanted && ctx) startMusicNow();
    });
  },

  setVolume(v) {
    guard(() => { settings.volume = clamp(v, 0, 1); applySettings(); });
  },

  setMood(mood) {
    guard(() => {
      const prev = musicState.mood;
      musicState.mood = mood;
      music?.setMood(mood);
      if (mood !== prev && (mood === 'ending_good' || mood === 'ending_bad')) playNow(mood);
    });
  },
};

/** Dev/bench diagnostics (not part of AudioAPI). */
export function _audioDebug(): { state: string; voices: number; music: boolean; sampleRate: number } {
  return {
    state: ctx ? ctx.state : unavailable ? 'unavailable' : 'locked',
    voices: activeVoices,
    music: !!music?.active,
    sampleRate: ctx?.sampleRate ?? 0,
  };
}

export default audio;
