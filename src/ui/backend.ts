/**
 * Backend abstraction (real engine or MockGame) + save-slot helpers.
 * main.tsx decides which backend to hand to <App/>.
 */
import type { ActionResult, ChoiceResult, GameAPI, NewGameOptions, TurnReport } from '../engine/types';
import { readSnapshot, writeSnapshot } from '../platform/storage';
export { SAVE_KEY } from '../platform/storage';

export interface Backend {
  kind: 'engine' | 'mock';
  /** May be async: the mock is code-split and loaded on demand. */
  newGame(opts: NewGameOptions): GameAPI | Promise<GameAPI>;
  loadGame(json: string): GameAPI | null | Promise<GameAPI | null>;
  /** Cheap check whether a stored save belongs to this backend (decides whether "Continue" is shown). */
  canLoad(json: string): boolean;
}

/** Mock saves are tagged; a cheap string check avoids loading the mock module just to look. */
export function isMockSave(json: string): boolean {
  return json.includes('"__mock":true');
}

export function readSave(): string | null {
  return readSnapshot().active;
}

export type SavedOverlay = { type: 'choice'; result: ChoiceResult } | { type: 'action'; result: ActionResult } | { type: 'report'; report: TurnReport };
export function readPending(): SavedOverlay | null {
  try {
    const saved = JSON.parse(readSnapshot().pending ?? 'null');
    return saved && (saved.type === 'report' && saved.report || ['choice', 'action'].includes(saved.type) && saved.result) ? saved : null;
  } catch { return null; }
}
export function clearPending(): void { writeSnapshot({ pending: null }); }
export function writeSave(game: GameAPI, pending?: SavedOverlay | null): void {
  if (game.view().gameOver) writeSnapshot({ active: null, completed: game.serialize(), pending: null });
  else writeSnapshot({ active: game.serialize(), ...(pending !== undefined ? { pending: pending ? JSON.stringify(pending) : null } : {}) });
}

export function clearSave(): void {
  writeSnapshot({ active: null, pending: null });
}
