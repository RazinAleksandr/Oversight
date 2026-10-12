import { beforeEach, describe, expect, it, vi } from 'vitest';

const disk = vi.hoisted(() => ({ files: new Map<string, string>(), prefs: new Map<string, string>(), failPref: false }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/filesystem', () => ({ Directory: { Data: 'DATA' }, Encoding: { UTF8: 'utf8' }, Filesystem: {
  readdir: async () => ({ files: [...disk.files.keys()].map(name => ({ name })) }),
  readFile: async ({ path }: { path: string }) => ({ data: disk.files.get(path) }),
  writeFile: async ({ path, data }: { path: string; data: string }) => { disk.files.set(path, data); },
} }));
vi.mock('@capacitor/preferences', () => ({ Preferences: {
  get: async ({ key }: { key: string }) => ({ value: disk.prefs.get(key) ?? null }),
  set: async ({ key, value }: { key: string; value: string }) => {
    if (disk.failPref) throw new Error('Unavailable'); disk.prefs.set(key, value);
  },
} }));
beforeEach(() => { vi.resetModules(); disk.files.clear(); disk.prefs.clear(); disk.failPref = false; });
describe('native storage adapter', () => {
  it('keeps a failed preference visible across a successful game save and retries both', async () => {
    const s = await import('../src/platform/storage'); await s.initializeStorage();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      disk.failPref = true; s.writePreference('ato.lang.v1', 'ru');
      await expect(s.flushStorage()).rejects.toThrow();
      s.writeSnapshot({ active: 'game' });
      await expect(s.flushStorage()).rejects.toThrow();
      expect(s.saveStatus()).toBe('failed');
      disk.failPref = false; s.retrySave(); await s.flushStorage();
      expect(s.saveStatus()).toBe('saved'); expect(disk.prefs.get('ato.lang.v1')).toBe('ru');
    } finally { log.mockRestore(); }
  });
  it('restores the committed run and pending result after a fresh startup', async () => {
    const s = await import('../src/platform/storage'); await s.initializeStorage();
    s.writePreference('ato.task.v1', JSON.stringify({ uid: 'card1', selectedId: 'limit' }));
    s.writeSnapshot({ active: 'run1', pending: 'result1' });
    s.writeSnapshot({ active: 'run2', pending: 'result2' }); await s.flushStorage();
    vi.resetModules(); const next = await import('../src/platform/storage'); await next.initializeStorage();
    expect(next.readSnapshot()).toEqual({ active: 'run2', completed: null, pending: 'result2' });
    expect(next.readPreference('ato.task.v1')).toBe(JSON.stringify({ uid: 'card1', selectedId: 'limit' }));
  });
});
