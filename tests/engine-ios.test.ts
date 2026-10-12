import { describe, expect, it } from 'vitest';
import { newGame, loadGame } from '../src/engine/game';
import { deserializeState } from '../src/engine/save';
import { demandForecast } from '../src/engine/forecasts';
import { computeIncome, programUpkeep } from '../src/engine/systems/economy';
import type { Demand } from '../src/engine/types';

const game = () => newGame({ countryId: 'commonwealth', difficulty: 'director', seed: 20261012 });
const demand = (patch: Partial<Demand> = {}): Demand => ({
  id: 'forecast-test', kind: 'budget_cut', title: '', text: '', status: 'active', issuedTurn: 1,
  deadlineTurn: 1, target: { value: 60 }, reward: 5, penalty: 5, softened: false, ...patch,
});

describe('conditional deadline forecasts', () => {
  it('includes this quarter settlement and leaves state and RNG untouched', () => {
    const g = game(), before = g.serialize();
    const f = demandForecast(g.state, demand())!;
    expect(f.quarters).toBe(1);
    expect(f.projected).toBeCloseTo(g.state.budget + computeIncome(g.state) - programUpkeep(g.state));
    expect(g.serialize()).toBe(before);
  });
  it('accounts for the expiry of free safety upkeep', () => {
    const s = game().state;
    s.programs.safety = 1; s.flags.freeSafetyUntil = 1;
    const f = demandForecast(s, demand({ deadlineTurn: 2 }))!;
    expect(f.quarters).toBe(2);
    expect(f.projected).toBeCloseTo(s.budget + 2 * computeIncome(s) - programUpkeep(s) - programUpkeep({ ...s, turn: 2 }));
    expect(programUpkeep({ ...s, turn: 2 })).toBeGreaterThan(programUpkeep(s));
  });
  it('warns instead of promising a defense level when funding runs short', () => {
    const s = game().state; s.budget = 0;
    for (const key of Object.keys(s.programs) as (keyof typeof s.programs)[]) s.programs[key] = 3;
    const f = demandForecast(s, demand({ kind: 'defense_program', target: { level: 2 }, deadlineTurn: 4 }))!;
    expect(f.projected).toBeNull(); expect(f.target).toBe(2); expect(f.current).toBe(3);
  });
  it('does not forecast settled or uncertain demands', () => {
    const s = game().state;
    expect(demandForecast(s, demand({ status: 'met' }))).toBeUndefined();
    expect(demandForecast(s, demand({ kind: 'cover_up' }))).toBeUndefined();
  });
  it('projects actual adoption, distinct from the current adoption order', () => {
    const s = game().state; s.adoption.business = 10; s.adoptionTarget.business = 30;
    const f = demandForecast(s, demand({ kind: 'deploy_sector', target: { sector: 'business', value: 25 }, deadlineTurn: 2 }))!;
    expect(f.current).toBe(10); expect(f.currentOrder).toBe(30);
    expect(f.projected).toBeCloseTo(22.8); expect(f.projected!).toBeLessThan(f.target);
  });
  it('honors infrastructure caps and defense funding in adoption projections', () => {
    const s = game().state; s.budget = 1000;
    s.policies.push('infra_firewall'); s.adoption.infrastructure = 10; s.adoptionTarget.infrastructure = 90;
    const capped = demandForecast(s, demand({ kind: 'deploy_sector', target: { sector: 'infrastructure', value: 60 }, deadlineTurn: 4 }))!;
    expect(capped.projected!).toBeLessThan(60);
    s.adoption.defense = 10; s.adoptionTarget.defense = 10; s.programs.defense = 2;
    const defense = demandForecast(s, demand({ kind: 'deploy_sector', target: { sector: 'defense', value: 20 } }))!;
    expect(defense.projected).toBeCloseTo(13.2);
  });
});

describe('portable save validation', () => {
  it('retains the RNG and produces the same next outcome after import', () => {
    const original = game(), restored = loadGame(original.serialize())!;
    expect(restored.serialize()).toBe(original.serialize());
    const card = original.view().inbox[0], choice = card.choices.find(c => !c.disabled)!;
    expect(restored.resolveChoice(card.uid, choice.id)).toEqual(original.resolveChoice(card.uid, choice.id));
    expect(restored.serialize()).toBe(original.serialize());
  });
  it.each([
    (s: any) => { s.version = 999; },
    (s: any) => { s.countryId = 'unknown'; },
    (s: any) => { s.budget = '60'; },
    (s: any) => { s.rng = [1, 2]; },
    (s: any) => { s.inbox[0].choices = null; },
    (s: any) => { s.programs.defense = '3'; },
  ])('rejects malformed imported data', mutate => {
    const s = JSON.parse(game().serialize()); mutate(s);
    expect(deserializeState(JSON.stringify(s))).toBeNull();
  });
  it('rejects truncated, oversized and prototype-bearing data', () => {
    const json = game().serialize();
    expect(deserializeState(json.slice(0, -10))).toBeNull();
    expect(deserializeState(' '.repeat(8 * 1024 * 1024 + 1))).toBeNull();
    expect(deserializeState(json.replace('{', '{"__proto__":{},'))).toBeNull();
  });
});

// Regression: an investigated threat must not continue describing its cause as unknown.
describe('investigated threat descriptions', () => {
  it.each(['mass_manipulation', 'cyber_misuse', 'rogue_agents'] as const)('updates %s without changing simulation state', type => {
    const g = game();
    const s = g.state;
    s.situations.push({
      id: 'known-cause-regression', type, severity: 30, growth: 7, growthMult: 1,
      stage: 1, notifiedStage: 1, detected: true, detectedTurn: s.turn, causeKnown: false,
      source: { companyId: s.companies[0].id }, spawnedTurn: s.turn, signalsShown: 1,
      signalTurns: [s.turn], response: 'none', resolved: false, origin: s.companies[0].name,
    });
    const unknown = g.view().situations.find(x => x.id === 'known-cause-regression')!;
    expect(unknown.causeKnown).toBe(false);
    expect(unknown.text).not.toContain('Traced to');
    s.situations.at(-1)!.causeKnown = true;
    const before = g.serialize();
    const known = g.view().situations.find(x => x.id === 'known-cause-regression')!;
    expect(known.text).toContain('Traced to');
    expect(known.text).not.toMatch(/Nobody can name a cause|cannot yet say why|could still be noise/);
    expect(g.serialize()).toBe(before);
  });
});
