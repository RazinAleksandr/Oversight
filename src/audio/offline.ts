// Offline rendering of sfx / music for QA (dev bench). Not imported by the game.

import type { SfxId } from '../engine/types';
import { buildGraph, MASTER_TRIM } from './dsp';
import type { Mood } from './harmony';
import { Music } from './music';
import { SFX } from './sfx';

const LONG: SfxId[] = ['ending_good', 'ending_bad', 'turn'];

export async function renderSfx(id: SfxId, sampleRate = 44100): Promise<AudioBuffer> {
  const seconds = LONG.includes(id) ? 8 : 3;
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * seconds), sampleRate);
  const graph = buildGraph(ctx);
  graph.master.gain.value = 0.8 * 0.8 * MASTER_TRIM; // default volume 0.8, squared curve
  SFX[id]({ ctx, out: graph.sfx, send: graph.sfxVerb, t: 0.01, p: 1, r: Math.random });
  return ctx.startRendering();
}

export async function renderMusic(mood: Mood, tension: number, seconds = 12, sampleRate = 44100): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * seconds), sampleRate);
  const graph = buildGraph(ctx);
  graph.master.gain.value = 0.8 * 0.8 * MASTER_TRIM;
  graph.music.gain.value = 0.6;
  graph.musicVerb.gain.value = 0.6;
  const m = new Music(ctx, graph.music, graph.musicVerb);
  m.setMood(mood);
  m.setTension(tension, true);
  m.start(0.3);
  m.pump(seconds);
  return ctx.startRendering();
}
