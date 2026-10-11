/**
 * Backend abstraction (real engine or MockGame) + save-slot helpers.
 * main.tsx decides which backend to hand to <App/>.
 */
import type { GameAPI, NewGameOptions } from '../engine/types';

export interface Backend {
  kind: 'engine' | 'mock';
  /** May be async: the mock is code-split and loaded on demand. */
  newGame(opts: NewGameOptions): GameAPI | Promise<GameAPI>;
  loadGame(json: string): GameAPI | null | Promise<GameAPI | null>;
  /** Cheap check whether a stored save belongs to this backend (decides whether "Continue" is shown). */
  canLoad(json: string): boolean;
}

export const SAVE_KEY = 'ato.save.v1';

/** Mock saves are tagged; a cheap string check avoids loading the mock module just to look. */
export function isMockSave(json: string): boolean {
  return json.includes('"__mock":true');
}

export function readSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

export function writeSave(game: GameAPI): void {
  try {
    if (game.view().gameOver) localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, game.serialize());
  } catch (e) {
    console.warn('[ui] autosave failed', e);
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
