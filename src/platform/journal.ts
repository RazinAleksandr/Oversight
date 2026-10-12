/** Two verified generations: a failed/interrupted write never overwrites the newest good save. */
export interface SlotIO { read(slot: number): Promise<string | null>; write(slot: number, value: string): Promise<void> }
export interface Snapshot { active: string | null; completed: string | null; pending: string | null }
interface Envelope { format: 1; sequence: number; writtenAt: string; checksum: string; payload: string }
export const emptySnapshot = (): Snapshot => ({ active: null, completed: null, pending: null });
function checksum(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function decode(raw: string): { sequence: number; value: Snapshot } | null {
  try {
    const e: Envelope = JSON.parse(raw);
    if (e.format !== 1 || !Number.isSafeInteger(e.sequence) || e.sequence < 1 || typeof e.payload !== 'string' || checksum(e.payload) !== e.checksum) return null;
    const value: Snapshot = JSON.parse(e.payload);
    if (!value || !['active', 'completed', 'pending'].every(k => value[k as keyof Snapshot] === null || typeof value[k as keyof Snapshot] === 'string')) return null;
    return { sequence: e.sequence, value };
  } catch { return null; }
}
export class SaveJournal {
  private sequence = 0;
  private slot = 1;
  private queue: Promise<void> = Promise.resolve();
  constructor(private io: SlotIO) {}
  async load(): Promise<Snapshot | null> {
    const raw = await Promise.all([this.io.read(0), this.io.read(1)]);
    const valid = raw.map((s, slot) => s === null ? null : { slot, decoded: decode(s) }).filter(x => x?.decoded != null);
    valid.sort((a, b) => b!.decoded!.sequence - a!.decoded!.sequence);
    if (!valid.length) {
      if (raw.some(s => s !== null)) throw new Error('No valid save generation; originals retained');
      return null;
    }
    const latest = valid[0]!;
    this.sequence = latest.decoded!.sequence; this.slot = latest.slot;
    return latest.decoded!.value;
  }
  write(value: Snapshot): Promise<void> {
    const payload = JSON.stringify(value);
    const task = this.queue.catch(() => {}).then(async () => {
      const sequence = this.sequence + 1, slot = 1 - this.slot;
      const raw = JSON.stringify({ format: 1, sequence, writtenAt: new Date().toISOString(), checksum: checksum(payload), payload });
      await this.io.write(slot, raw);
      if (await this.io.read(slot) !== raw) throw new Error('Save verification failed');
      this.sequence = sequence; this.slot = slot;
    });
    this.queue = task;
    return task;
  }
  flush(): Promise<void> { return this.queue; }
}
