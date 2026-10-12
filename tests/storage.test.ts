import { describe, it, expect } from 'vitest';
import { SaveJournal, emptySnapshot } from '../src/platform/journal';
describe('durable save generations', () => {
  const fixture = () => {
    const slots: (string | null)[] = [null, null];
    const io = { read: async (n: number) => slots[n], write: async (n: number, s: string) => { slots[n] = s; } };
    return { slots, io, journal: new SaveJournal(io) };
  };
  it('serializes rapid writes and loads the newest generation', async () => {
    const {io,journal}=fixture();
    await Promise.all([journal.write({...emptySnapshot(),active:'first'}),journal.write({...emptySnapshot(),active:'second'})]);
    expect((await new SaveJournal(io).load())?.active).toBe('second');
  });
  it('recovers the last good generation after an interrupted write', async () => {
    const {io,journal}=fixture(); await journal.write({...emptySnapshot(),active:'safe'});
    io.write=async()=>{ throw new Error('disk full'); };
    await expect(journal.write({...emptySnapshot(),active:'lost'})).rejects.toThrow();
    expect((await new SaveJournal(io).load())?.active).toBe('safe');
  });
  it('rejects a truncated or changed payload and recovers backup', async () => {
    const {slots,io,journal}=fixture(); await journal.write({...emptySnapshot(),active:'older'});await journal.write({...emptySnapshot(),active:'newer'});
    slots[1]=slots[1]!.replace('newer','other');
    expect((await new SaveJournal(io).load())?.active).toBe('older');
  });
  it('does not treat corrupt storage as a new installation', async () => {
    const {slots,journal}=fixture();slots[0]='{broken';await expect(journal.load()).rejects.toThrow('originals retained');
  });
  it('requires read-back verification before committing a generation', async () => {
    const {slots,io,journal}=fixture();await journal.write({...emptySnapshot(),active:'safe'});
    io.write=async(n)=>{slots[n]='partial';};await expect(journal.write({...emptySnapshot(),active:'lost'})).rejects.toThrow('verification');
    expect((await new SaveJournal(io).load())?.active).toBe('safe');
  });
});
