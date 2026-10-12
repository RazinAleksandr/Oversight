/** Optional UI context. Engine saves remain authoritative; stale drafts are discarded. */
import type { GameView, TabId } from '../../engine/types';
import { readPreference, writePreference } from '../../platform/storage';

export const TASK_KEY = 'ato.task.v1';
export interface WorkspaceReading {
  section: 'brief' | 'evidence' | 'effects';
  pane: 'brief' | 'options';
  scroll: Record<'brief' | 'evidence' | 'effects' | 'options', number>;
}
export interface TaskDraft {
  schema: 1;
  seed: number;
  countryId: string;
  turn: number;
  uid: string;
  selectedId: string | null;
  active: boolean;
  route: 'decision' | 'company' | 'management';
  management?: { tab: TabId; section?: string; target?: string };
  reading: WorkspaceReading;
}
export const newReading = (): WorkspaceReading => ({ section: 'brief', pane: 'brief', scroll: { brief: 0, evidence: 0, effects: 0, options: 0 } });
export function newTask(view: GameView, uid: string): TaskDraft {
  return { schema: 1, seed: view.seed, countryId: view.country.id, turn: view.turn, uid, selectedId: null, active: true, route: 'decision', reading: newReading() };
}
export function validateTask(value: unknown, view: GameView): TaskDraft | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as Partial<TaskDraft>;
  const card = view.inbox.find(c => c.uid === d.uid);
  if (d.schema !== 1 || d.seed !== view.seed || d.countryId !== view.country.id || d.turn !== view.turn || !card || view.gameOver) return null;
  const reading = newReading();
  if (d.reading && typeof d.reading === 'object') {
    if (['brief', 'evidence', 'effects'].includes(d.reading.section)) reading.section = d.reading.section;
    if (d.reading.pane === 'options') reading.pane = 'options';
    for (const key of Object.keys(reading.scroll) as (keyof WorkspaceReading['scroll'])[]) {
      const n = d.reading.scroll?.[key];
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0) reading.scroll[key] = Math.min(n, 100000);
    }
  }
  const management = d.management && view.unlockedTabs.includes(d.management.tab) ? {
    tab: d.management.tab, ...(typeof d.management.section === 'string' ? { section: d.management.section } : {}),
    ...(typeof d.management.target === 'string' ? { target: d.management.target } : {}),
  } : undefined;
  return { ...newTask(view, card.uid), active: d.active === true, route: d.route === 'company' && card.kind === 'deployment' ? 'company' : d.route === 'management' && management ? 'management' : 'decision',
    ...(management ? {management} : {}),
    selectedId: card.choices.some(c => c.id === d.selectedId) ? d.selectedId! : null, reading };
}
export function readTask(view: GameView): TaskDraft | null {
  try { return validateTask(JSON.parse(readPreference(TASK_KEY) ?? 'null'), view); }
  catch { return null; }
}
export function writeTask(draft: TaskDraft | null): void { writePreference(TASK_KEY, JSON.stringify(draft)); }
