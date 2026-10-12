import { describe, expect, it } from 'vitest';
import { money } from '../src/ui/util';
import { choiceBlock } from '../src/ui/game/Briefing';
import type { Choice } from '../src/engine/types';
describe('cash near purchase thresholds', () => {
  it('never advertises the price when available cash is below it', () => {
    expect(money(14.999999999)).toBe('$14.99B');
    expect(money(15)).toBe('$15B');
    expect(money(0.29)).toBe('$0.29B');
  });
  it('explains an unavailable choice using current cash and shortfall', () => {
    const choice: Choice = { id: 'buy', label: 'Buy', preview: [], cost: { budget: 15 } };
    expect(choiceBlock(choice, { capacity: 2, budget: 14.95, evidence: 0 })).toContain('available $14.95B');
    expect(choiceBlock(choice, { capacity: 2, budget: 15, evidence: 0 })).toBeNull();
  });
});
