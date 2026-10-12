/**
 * Player settings: persisted in localStorage (`ato.settings.v1`) and pushed into the audio/fx modules.
 */
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Settings } from '../engine/types';
import { audio } from '../audio';
import { fx } from '../fx';
import { readPreference, writePreference } from '../platform/storage';

export const SETTINGS_KEY = 'ato.settings.v1';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function defaultSettings(): Settings {
  return { sound: true, music: true, volume: 0.7, reducedMotion: prefersReducedMotion(), textSpeed: 'fast' };
}

export function loadSettings(): Settings {
  const d = defaultSettings();
  try {
    const raw = readPreference(SETTINGS_KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: typeof p.sound === 'boolean' ? p.sound : d.sound,
      music: typeof p.music === 'boolean' ? p.music : d.music,
      volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : d.volume,
      reducedMotion: typeof p.reducedMotion === 'boolean' ? p.reducedMotion : d.reducedMotion,
      textSpeed: p.textSpeed === 'instant' || p.textSpeed === 'normal' || p.textSpeed === 'fast' ? p.textSpeed : d.textSpeed,
    };
  } catch {
    return d;
  }
}

export function saveSettings(s: Settings): void {
  try {
    writePreference(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode) — settings stay in memory */
  }
}

export function applySettings(s: Settings): void {
  try {
    audio.setSoundEnabled(s.sound);
    audio.setMusicEnabled(s.music);
    audio.setVolume(s.volume);
    fx.setReducedMotion(s.reducedMotion);
  } catch (e) {
    console.warn('[ui] applying settings failed', e);
  }
  document.documentElement.classList.toggle('reduced-motion', s.reducedMotion);
}

/** Characters per second for the typewriter reveal; 0 = instant. */
export function typeCps(s: Settings): number {
  return s.textSpeed === 'instant' || s.reducedMotion ? 0 : s.textSpeed === 'fast' ? 140 : 60;
}

export interface SettingsCtxValue {
  settings: Settings;
  update(patch: Partial<Settings>): void;
}

export const SettingsCtx = createContext<SettingsCtxValue>({ settings: defaultSettings(), update: () => {} });
export const useSettings = (): SettingsCtxValue => useContext(SettingsCtx);
