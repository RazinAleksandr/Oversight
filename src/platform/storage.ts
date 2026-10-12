import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { SaveJournal, emptySnapshot, type Snapshot } from './journal';
export const native = Capacitor.isNativePlatform();
export const SAVE_KEY = 'ato.save.v1';
const COMPLETED_KEY = 'ato.completed.v1', PENDING_KEY = 'ato.pending.v1';
const smallKeys = ['ato.settings.v1', 'ato.lang.v1', 'ato.task.v1'];
let cache = emptySnapshot();
let journal: SaveJournal | undefined;
type Status = 'saved' | 'saving' | 'failed';
let snapshotFailed = false;
const failedPreferences = new Set<string>();
let pendingWrites = 0, generation = 0;
const listeners = new Set<() => void>();
const smallCache = new Map<string, string>();
let preferenceQueue: Promise<void> = Promise.resolve();
let lastWrite: Promise<void> = Promise.resolve();
const localRead = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
export const readPreference = (key: string): string | null => native ? smallCache.get(key) ?? null : localRead(key);
export function saveStatus(): Status {
  return snapshotFailed || failedPreferences.size > 0 ? 'failed' : pendingWrites > 0 ? 'saving' : 'saved';
}
export function watchStorage(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }
function notify(): void { listeners.forEach(fn => fn()); }
export async function initializeStorage(): Promise<void> {
  if (!native) { cache = { active: localRead(SAVE_KEY), completed: localRead(COMPLETED_KEY), pending: localRead(PENDING_KEY) }; return; }
  for (const key of smallKeys) {
    const { value } = await Preferences.get({ key });
    const migrated = value ?? localRead(key);
    if (migrated !== null) { smallCache.set(key, migrated); if (value === null) await Preferences.set({ key, value: migrated }); }
  }
  // Directory.Data is app-private; no Files or Photos permission is requested.
  const files = await Filesystem.readdir({ path: '', directory: Directory.Data });
  const existing = new Set(files.files.map(f => f.name));
  journal = new SaveJournal({
    async read(slot) {
      const path = `oversight-save-${slot}.json`;
      if (!existing.has(path)) return null;
      const result = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 });
      if (typeof result.data !== 'string') throw new Error('Unexpected save encoding');
      return result.data;
    },
    async write(slot, data) {
      const path = `oversight-save-${slot}.json`;
      await Filesystem.writeFile({ path, data, directory: Directory.Data, encoding: Encoding.UTF8 });
      existing.add(path);
    },
  });
  const saved = await journal.load();
  cache = saved ?? { active: localRead(SAVE_KEY), completed: localRead(COMPLETED_KEY), pending: localRead(PENDING_KEY) };
  if (!saved && (cache.active || cache.completed)) await journal.write(cache);
}
export function readSnapshot(): Snapshot { return { ...cache }; }
export function writeSnapshot(patch: Partial<Snapshot>): void {
  cache = { ...cache, ...patch };
  const current = ++generation;
  const snapshot = { ...cache };
  pendingWrites++; notify();
  const write = async () => {
    if (native) { if (!journal) throw new Error('Storage not initialized'); await journal.write(snapshot); }
    else {
      for (const [key, value] of [[SAVE_KEY, snapshot.active], [COMPLETED_KEY, snapshot.completed], [PENDING_KEY, snapshot.pending]]) {
        if (value === null) localStorage.removeItem(key!); else localStorage.setItem(key!, value!);
      }
    }
  };
  lastWrite = write().then(() => { if (current === generation) snapshotFailed = false; }).catch(e => { if (current === generation) snapshotFailed = true; console.error('[save]', e); }).finally(() => { pendingWrites--; notify(); });
}
export function retrySave(): void {
  writeSnapshot({});
  for (const key of failedPreferences) {
    const value = smallCache.get(key);
    if (value !== undefined) writePreference(key, value);
  }
}
export async function flushStorage(): Promise<void> {
  await lastWrite;
  await preferenceQueue;
  await journal?.flush();
  if (saveStatus() === 'failed' || pendingWrites > 0) throw new Error('Save has not completed');
}
export function writePreference(key: string, value: string): void {
  smallCache.set(key, value);
  pendingWrites++; notify();
  preferenceQueue = preferenceQueue.catch(() => {}).then(async () => {
    try {
      if (native) await Preferences.set({ key, value });
      else localStorage.setItem(key, value);
      // An older successful write must not clear a newer failed preference.
      if (smallCache.get(key) === value) failedPreferences.delete(key);
    } catch (e) {
      failedPreferences.add(key);
      console.error('[preferences]', e);
    } finally { pendingWrites--; notify(); }
  });
}
