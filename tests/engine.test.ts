import { describe, expect, it } from 'vitest';
import { Game, loadGame, newGame } from '../src/engine/game';
import type { ActionId, CountryId, Difficulty, FlawType, GameView } from '../src/engine/types';

const COUNTRIES: CountryId[] = ['atlantic', 'hanzhou', 'commonwealth', 'meridian'];
const DIFFICULTIES: Difficulty[] = ['analyst', 'director', 'doomer'];
const FLAWS: FlawType[] = ['scope_creep', 'deceptive', 'brittle', 'manipulative', 'jailbreakable', 'power_seeking'];

/** Deterministic pseudo-player: cycles through choices and actions using a simple counter. */
function makePlayer(variant = 0) {
  let n = variant;
  return {
    choose(g: Game): void {
      const card = g.state.inbox[0];
      const enabled = card.choices.filter((c) => !c.disabled);
      const pick = (enabled.length ? enabled : card.choices)[n++ % Math.max(1, (enabled.length ? enabled : card.choices).length)];
      const r = g.resolveChoice(card.uid, pick.id);
      if (!r.ok) {
        // Fall back to any choice that works (a choice may become unaffordable mid-quarter).
        for (const c of card.choices) if (g.resolveChoice(card.uid, c.id).ok) return;
        throw new Error(`No resolvable choice on ${card.title}`);
      }
    },
    act(g: Game): void {
      const actions = g.getActions().filter((a) => !a.disabled);
      if (!actions.length) return;
      const a = actions[n++ % actions.length];
      const targets = (a.targets ?? []).filter((t) => !t.disabled);
      if (a.targets && !targets.length) return;
      const t = targets.length ? targets[n % targets.length].id : undefined;
      const o = a.options?.length ? a.options[n % a.options.length].id : undefined;
      g.performAction(a.id, t, o);
      if (n % 5 === 0) g.setProgramLevel((['safety', 'oversight', 'workforce'] as const)[n % 3], (n % 3) as 0 | 1 | 2);
    },
  };
}

function playTurns(g: Game, turns: number, variant = 0, onStep?: (v: GameView) => void): void {
  const p = makePlayer(variant);
  for (let t = 0; t < turns && !g.state.gameOver; t++) {
    p.act(g);
    let guard = 0;
    while (g.state.inbox.length && !g.state.gameOver && guard++ < 30) {
      onStep?.(g.view());
      p.choose(g);
    }
    if (!g.state.gameOver) g.endTurn();
    onStep?.(g.view());
  }
}

function assertFogged(g: Game, v: GameView): void {
  const s = g.state;
  for (const m of v.models) {
    if ((FLAWS as string[]).includes(m.flaw)) {
      const truth = s.models.find((x) => x.id === m.id);
      expect(truth?.flawKnown, `flaw of ${m.name} leaked`).toBe(true);
    }
  }
  for (const c of v.companies) {
    for (const m of c.models) if ((FLAWS as string[]).includes(m.flaw)) expect(s.models.find((x) => x.id === m.id)?.flawKnown).toBe(true);
    for (const t of [c.safety, c.transparency, c.ambition]) if (t.value !== null) expect(t.verified).toBe(true);
  }
  const detected = new Set(s.situations.filter((x) => x.detected).map((x) => x.id));
  for (const x of v.situations) expect(detected.has(x.id), 'undetected situation in view').toBe(true);
  for (const n of v.news) if (n.situationId) expect(detected.has(n.situationId), 'signal links undetected situation').toBe(true);
  for (const c of v.inbox) if (c.ctx.situationId) expect(detected.has(c.ctx.situationId), 'card links undetected situation').toBe(true);
  for (const l of v.log) if (l.refs?.situationId) expect(detected.has(l.refs.situationId)).toBe(true);
  expect(JSON.stringify(v)).not.toContain('"riskBias"');
}

describe('engine: setup', () => {
  it('starts with an intro card and a deployment request, inbox and labs tabs', () => {
    const g = newGame({ countryId: 'atlantic', difficulty: 'director', seed: 7 });
    const v = g.view();
    expect(v.inbox.map((c) => c.kind)).toEqual(['intro', 'deployment']);
    expect(v.unlockedTabs).toEqual(['inbox', 'labs']);
    expect(v.companies).toHaveLength(3);
    expect(new Set(v.companies.map((c) => c.archetype)).size).toBe(3);
    expect(v.companies.some((c) => c.archetype === 'frontier')).toBe(true);
    expect(v.rivals).toHaveLength(3);
    expect(g.canEndTurn()).toBe(false);
  });

  it('issues the first demand on turn 2', () => {
    const g = newGame({ countryId: 'commonwealth', difficulty: 'director', seed: 11 });
    playTurns(g, 1);
    expect(g.state.turn).toBe(2);
    expect(g.state.inbox.some((c) => c.kind === 'demand') || g.state.queue.some((c) => c.kind === 'demand')).toBe(true);
  });
});

describe('engine: determinism & saves', () => {
  it('same seed + same choices → identical serialized state (views do not mutate state)', () => {
    const a = newGame({ countryId: 'hanzhou', difficulty: 'director', seed: 1234 });
    const b = newGame({ countryId: 'hanzhou', difficulty: 'director', seed: 1234 });
    playTurns(a, 20, 3);
    playTurns(b, 20, 3, () => {
      b.getActions();
    });
    expect(a.serialize()).toBe(b.serialize());
  });

  it('different seeds diverge', () => {
    const a = newGame({ countryId: 'meridian', difficulty: 'director', seed: 1 });
    const b = newGame({ countryId: 'meridian', difficulty: 'director', seed: 2 });
    expect(a.serialize()).not.toBe(b.serialize());
  });

  it('serialize → load round-trip mid-game continues identically', () => {
    const a = newGame({ countryId: 'atlantic', difficulty: 'doomer', seed: 99 });
    playTurns(a, 5, 1);
    const saved = a.serialize();
    const b = loadGame(saved);
    expect(b).not.toBeNull();
    expect(b!.serialize()).toBe(saved);
    playTurns(a, 20, 2);
    playTurns(b!, 20, 2);
    expect(b!.serialize()).toBe(a.serialize());
  });

  it('loadGame rejects invalid input', () => {
    expect(loadGame('')).toBeNull();
    expect(loadGame('not json')).toBeNull();
    expect(loadGame('{}')).toBeNull();
    expect(loadGame('[]')).toBeNull();
    expect(loadGame(JSON.stringify({ version: 999 }))).toBeNull();
  });
});

describe('engine: full runs', () => {
  for (const country of COUNTRIES) {
    for (const difficulty of DIFFICULTIES) {
      it(`${country} / ${difficulty}: runs to an ending without throwing`, () => {
        for (let seed = 1; seed <= 4; seed++) {
          const g = newGame({ countryId: country, difficulty, seed: seed * 101 });
          let gameovers = 0;
          g.subscribe((e) => {
            if (e.type === 'gameover') gameovers++;
          });
          playTurns(g, 30, seed, (v) => assertFogged(g, v));
          expect(g.state.gameOver).toBe(true);
          const e = g.view().ending;
          expect(e).not.toBeNull();
          expect(e!.title.length).toBeGreaterThan(0);
          expect(['S', 'A', 'B', 'C', 'D', 'F']).toContain(e!.rating);
          expect(e!.hiddenTruths.length).toBeGreaterThan(0);
          expect(gameovers).toBe(1);
          expect(g.state.turn).toBeLessThanOrEqual(g.state.maxTurns + 1);
        }
      });
    }
  }

  it('keeps early turns gentle: no situation above stage 1 before turn 4', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = newGame({ countryId: COUNTRIES[seed % 4], difficulty: 'doomer', seed });
      const p = makePlayer(seed);
      while (g.state.turn < 4 && !g.state.gameOver) {
        while (g.state.inbox.length && !g.state.gameOver) p.choose(g);
        for (const x of g.state.situations) if (!x.resolved) expect(x.stage).toBeLessThanOrEqual(1);
        if (!g.state.gameOver) g.endTurn();
      }
    }
  });

  it('meter changes carry reasons and the quarter report explains them', () => {
    const g = newGame({ countryId: 'commonwealth', difficulty: 'director', seed: 5 });
    const p = makePlayer();
    while (g.state.inbox.length) p.choose(g);
    const r = g.endTurn();
    expect(r.toTurn).toBe(2);
    expect(r.headlines.length).toBeGreaterThanOrEqual(3);
    const reasons = Object.values(r.meters).flatMap((m) => m.reasons);
    expect(reasons.length).toBeGreaterThan(0);
    for (const x of reasons) expect(typeof x.reason).toBe('string');
    expect(g.view().meters.economy.reasons.length).toBeGreaterThan(0);
  });
});

describe('engine: invalid input never throws', () => {
  it('actions, choices and programs return ok:false', () => {
    const g = newGame({ countryId: 'atlantic', difficulty: 'director', seed: 3 });
    expect(g.performAction('nonsense' as ActionId).ok).toBe(false);
    expect(g.performAction('investigate_company').ok).toBe(false);
    expect(g.performAction('investigate_company', 'no-such-company').ok).toBe(false);
    expect(g.performAction('enact_policy', 'not_a_policy').ok).toBe(false);
    expect(g.performAction('situation_response', 'missing', 'suspend').ok).toBe(false);
    expect(g.performAction('espionage', 'atlantic').ok).toBe(false); // world tab locked & own country
    expect(g.resolveChoice('missing', 'approve').ok).toBe(false);
    expect(g.resolveChoice(g.state.inbox[0].uid, 'no-such-choice').ok).toBe(false);
    expect(g.setProgramLevel('safety', -1).ok).toBe(false);
    expect(g.setProgramLevel('safety', 7).ok).toBe(false);
    expect(g.setProgramLevel('bogus' as never, 1).ok).toBe(false);
    expect(g.setProgramLevel('constructor' as never, 1).ok).toBe(false);
    expect(g.performAction('enact_policy', 'constructor').ok).toBe(false);
    expect(g.performAction('repeal_policy', 'toString').ok).toBe(false);
    expect(() => g.view()).not.toThrow();
    const before = g.serialize();
    const report = g.endTurn(); // inbox not empty → no-op
    expect(report.fromTurn).toBe(report.toTurn);
    expect(g.serialize()).toBe(before);
  });

  it('refuses to act after the game is over', () => {
    const g = newGame({ countryId: 'meridian', difficulty: 'doomer', seed: 17 });
    playTurns(g, 30);
    expect(g.state.gameOver).toBe(true);
    expect(g.performAction('brief_leader').ok).toBe(false);
    expect(g.setProgramLevel('safety', 1).ok).toBe(false);
    expect(g.canEndTurn()).toBe(false);
  });
});

describe('engine: API contracts used by the UI', () => {
  function toTurn2WithDemand(): Game | null {
    for (let seed = 1; seed < 60; seed++) {
      const g = newGame({ countryId: 'commonwealth', difficulty: 'director', seed });
      while (g.state.inbox.length) g.resolveChoice(g.state.inbox[0].uid, g.state.inbox[0].choices.find((c) => !c.disabled)!.id);
      g.endTurn();
      if (g.state.inbox.some((c) => c.kind === 'demand')) return g;
    }
    return null;
  }

  it('a failed counter-offer pushes a "leader insists" card to the front of the inbox', () => {
    let sawInsist = false;
    for (let attempt = 0; attempt < 20 && !sawInsist; attempt++) {
      const g = toTurn2WithDemand();
      expect(g).not.toBeNull();
      if (!g) return;
      g.state.meters.confidence = 2; // counter chance collapses to the 5% floor
      const card = g.state.inbox.find((c) => c.kind === 'demand')!;
      const shown = g.view().inbox.find((c) => c.uid === card.uid)!.choices.find((c) => c.id === 'counter')!.chance;
      expect(shown).toBeCloseTo(0.05, 5);
      const r = g.resolveChoice(card.uid, 'counter');
      expect(r.ok).toBe(true);
      if (r.success === false) {
        sawInsist = true;
        expect(r.nextCardUid).toBeDefined();
        expect(g.state.inbox[0].uid).toBe(r.nextCardUid);
        expect(g.state.inbox[0].kind).toBe('negotiation');
        expect(g.state.inbox[0].choices.map((c) => c.id)).toEqual(['comply', 'refuse']);
        expect(g.resolveChoice(r.nextCardUid!, 'comply').ok).toBe(true);
        expect(g.view().government.demands.some((d) => d.status === 'active')).toBe(true);
      }
    }
    expect(sawInsist).toBe(true);
  });

  it('situation responses work through performAction and the view lists them', () => {
    const g = newGame({ countryId: 'atlantic', difficulty: 'director', seed: 21 });
    playTurns(g, 4, 0);
    if (g.state.gameOver) return;
    const s = g.state;
    const m = s.models.find((x) => x.status === 'deployed' || x.status === 'limited');
    // Plant a detected situation tied to a live model (test setup only).
    s.situations.push({
      id: 's-test', type: 'rogue_agents', severity: 30, growth: 7, growthMult: 1, stage: 1, detected: true, detectedTurn: s.turn,
      causeKnown: false, source: { modelId: m?.id, companyId: m?.companyId, sector: 'business' }, spawnedTurn: s.turn,
      signalsShown: 2, signalTurns: [s.turn], response: 'none', resolved: false, origin: 'test', notifiedStage: 1,
    });
    if (!s.unlockedTabs.includes('threats')) s.unlockedTabs.push('threats');
    s.capacity = 3;
    const sv = g.view().situations.find((x) => x.id === 's-test')!;
    expect(sv.causeKnown).toBe(false);
    expect(sv.type).toBe('unknown');
    expect(sv.responses.find((r) => r.id === 'suspend')!.disabled).toBeTruthy();
    expect(g.performAction('situation_response', 's-test', 'investigate').ok).toBe(true);
    const after = g.view().situations.find((x) => x.id === 's-test')!;
    expect(after.causeKnown).toBe(true);
    if (m) {
      expect(after.responses.find((r) => r.id === 'suspend')!.disabled).toBeNull();
      expect(g.performAction('situation_response', 's-test', 'suspend').ok).toBe(true);
      expect(g.performAction('situation_response', 's-test', 'restrict').ok).toBe(false); // one response per quarter
      expect(g.view().models.find((x) => x.id === m.id)!.status).toBe('suspended');
    }
  });

  it('the Threshold fires alone when an actor reaches 9.0 and ends the run on resolution', () => {
    const g = newGame({ countryId: 'meridian', difficulty: 'director', seed: 8 });
    while (g.state.inbox.length) g.resolveChoice(g.state.inbox[0].uid, g.state.inbox[0].choices[0].id);
    g.state.rivals[0].capability = 9.5;
    g.endTurn();
    if (g.state.gameOver) return;
    const v = g.view();
    expect(v.inbox).toHaveLength(1);
    expect(v.inbox[0].kind).toBe('threshold');
    expect(v.finale).toBe(true);
    for (const c of v.inbox[0].choices) expect(c.chance).toBeUndefined();
    const pick = v.inbox[0].choices.find((c) => !c.disabled)!;
    expect(pick.hint).toMatch(/Estimated control: \d+–\d+%/);
    const r = g.resolveChoice(v.inbox[0].uid, pick.id);
    expect(r.ok).toBe(true);
    expect(r.gameOver).toBe(true);
    expect(g.view().ending).not.toBeNull();
  });

  it('enact_policy takes a PolicyId target and charges the shown political cost', () => {
    const g = newGame({ countryId: 'commonwealth', difficulty: 'director', seed: 4 });
    while (g.state.inbox.length) g.resolveChoice(g.state.inbox[0].uid, g.state.inbox[0].choices[0].id);
    g.endTurn();
    while (g.state.inbox.length) g.resolveChoice(g.state.inbox[0].uid, g.state.inbox[0].choices[0].id);
    const pol = g.view().nation.policies.find((p) => !p.active && p.politicalCost < g.state.meters.confidence)!;
    const before = g.state.meters.confidence;
    const r = g.performAction('enact_policy', pol.id);
    expect(r.ok).toBe(true);
    expect(g.state.policies).toContain(pol.id);
    expect(g.state.meters.confidence).toBeCloseTo(Math.max(0, Math.min(100, before - pol.politicalCost)), 5);
    expect(g.performAction('enact_policy', pol.id).ok).toBe(false);
  });
});

describe('engine: regressions from review', () => {
  it('overflow cards queue and later reach the inbox', () => {
    let queuedSeen = 0;
    let deliveredFromQueue = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = newGame({ countryId: COUNTRIES[seed % 4], difficulty: 'doomer', seed });
      const p = makePlayer(seed);
      for (let t = 0; t < 12 && !g.state.gameOver; t++) {
        const queued = new Set(g.state.queue.map((c) => c.uid));
        queuedSeen += queued.size;
        while (g.state.inbox.length && !g.state.gameOver) p.choose(g);
        if (g.state.gameOver) break;
        g.endTurn();
        deliveredFromQueue += g.state.inbox.filter((c) => queued.has(c.uid)).length;
        expect(g.state.inbox.length).toBeLessThanOrEqual(3);
      }
    }
    if (queuedSeen > 0) expect(deliveredFromQueue).toBeGreaterThan(0);
  });

  it('detected situations are not frozen by the two-signal cap', () => {
    const g = newGame({ countryId: 'hanzhou', difficulty: 'director', seed: 31 });
    playTurns(g, 4, 0);
    if (g.state.gameOver) return;
    g.state.situations.push({
      id: 's-frozen', type: 'model_escape', severity: 60, growth: 10, growthMult: 1, stage: 2, detected: true, detectedTurn: g.state.turn,
      causeKnown: true, source: {}, spawnedTurn: g.state.turn, signalsShown: 1, signalTurns: [g.state.turn], response: 'none', resolved: false,
      origin: 'test', notifiedStage: 2,
    });
    while (g.state.inbox.length && !g.state.gameOver) makePlayer(1).choose(g);
    if (!g.state.gameOver) g.endTurn();
    const x = g.state.situations.find((sx) => sx.id === 's-frozen')!;
    expect(x.severity).toBeGreaterThan(69);
  });

  it('known-cause containment lets model-less situations recede', () => {
    const g = newGame({ countryId: 'commonwealth', difficulty: 'director', seed: 12 });
    playTurns(g, 4, 0);
    if (g.state.gameOver) return;
    const s = g.state;
    if (!s.unlockedTabs.includes('threats')) s.unlockedTabs.push('threats');
    s.situations.push({
      id: 's-spill', type: 'foreign_spillover', severity: 30, growth: 6, growthMult: 1, stage: 1, detected: true, detectedTurn: s.turn,
      causeKnown: true, source: { rivalId: s.rivals[0].id }, spawnedTurn: s.turn, signalsShown: 2, signalTurns: [s.turn], response: 'none',
      resolved: false, origin: 'test', notifiedStage: 1,
    });
    expect(g.performAction('situation_response', 's-spill', 'contain').ok).toBe(true);
    while (g.state.inbox.length && !g.state.gameOver) makePlayer(2).choose(g);
    if (!g.state.gameOver) g.endTurn();
    const x = g.state.situations.find((sx) => sx.id === 's-spill')!;
    expect(x.severity).toBeLessThan(30);
  });
});

describe('engine: polish pass (P0 regressions & new mechanics)', () => {
  /** Plays to the start of a quarter where the World/Nation/Threats tabs are open. */
  function midGame(country: CountryId, seed: number, turns = 4): Game {
    const g = newGame({ countryId: country, difficulty: 'director', seed });
    playTurns(g, turns, seed);
    while (g.state.inbox.length && !g.state.gameOver) makePlayer(seed).choose(g);
    return g;
  }

  it('P0 fog: before the cause is known, responses never name the source', () => {
    const g = midGame('atlantic', 41);
    if (g.state.gameOver) return;
    const s = g.state;
    const m = s.models.find((x) => x.status === 'deployed' || x.status === 'limited') ?? s.models[0];
    const company = s.companies.find((c) => c.id === m.companyId)!;
    s.situations.push({
      id: 's-fog', type: 'rogue_agents', severity: 30, growth: 7, growthMult: 1, stage: 1, detected: true, detectedTurn: s.turn,
      causeKnown: false, source: { modelId: m.id, companyId: m.companyId, sector: 'business' }, spawnedTurn: s.turn,
      signalsShown: 2, signalTurns: [s.turn], response: 'none', resolved: false, origin: `${m.name} (${company.name})`, notifiedStage: 1,
    });
    const sv = g.view().situations.find((x) => x.id === 's-fog')!;
    const json = JSON.stringify(sv);
    expect(json).not.toContain(company.name);
    expect(json).not.toContain(m.name);
    expect(sv.sourceLabel).toBeUndefined();
    for (const r of sv.responses) for (const p of r.preview) if (p.key === 'company') expect(p.label).toBe('Unknown source');
  });

  it('P0 costs: shown confidence equals applied confidence (Atlantic volatility ×1.3)', () => {
    const g = midGame('atlantic', 7, 1);
    if (g.state.gameOver) return;
    const s = g.state;
    expect(s.unlockedTabs).toContain('nation');
    // Policy: the shown political cost is exactly what is lost.
    const pol = g.view().nation.policies.find((p) => !p.active && p.politicalCost > 0 && p.politicalCost < s.meters.confidence)!;
    s.capacity = Math.max(s.capacity, 1);
    let before = s.meters.confidence;
    expect(g.performAction('enact_policy', pol.id).ok).toBe(true);
    expect(before - s.meters.confidence).toBeCloseTo(pol.politicalCost, 5);
    // Briefing: the preview amount is exactly what is gained.
    s.capacity = Math.max(s.capacity, 1);
    s.meters.confidence = 40;
    s.flags.briefTurns = '';
    const brief = g.getActions().find((a) => a.id === 'brief_leader')!;
    const shown = brief.preview.find((p) => p.key === 'confidence')!.amount!;
    before = s.meters.confidence;
    expect(g.performAction('brief_leader').ok).toBe(true);
    expect(s.meters.confidence - before).toBeCloseTo(shown, 5);
    expect(shown).toBeCloseTo(4 * 1.3, 5);
  });

  it('P0 costs: demand rewards/penalties and refusal shown equal what is applied', () => {
    for (let seed = 1; seed < 40; seed++) {
      const g = newGame({ countryId: 'atlantic', difficulty: 'director', seed });
      while (g.state.inbox.length) g.resolveChoice(g.state.inbox[0].uid, g.state.inbox[0].choices.find((c) => !c.disabled)!.id);
      g.endTurn();
      const card = g.view().inbox.find((c) => c.kind === 'demand');
      if (!card) continue;
      const refuse = card.choices.find((c) => c.id === 'refuse')!;
      const shown = refuse.preview.find((p) => p.key === 'confidence')!.amount!;
      const before = g.state.meters.confidence;
      expect(g.resolveChoice(card.uid, 'refuse').ok).toBe(true);
      expect(g.state.meters.confidence - before).toBeCloseTo(Math.max(shown, -before), 5);
      return;
    }
    throw new Error('no demand card found');
  });

  it('capacity starts at 2 and briefings halve on repeat (+4, +2, +1)', () => {
    const g = newGame({ countryId: 'hanzhou', difficulty: 'director', seed: 5 });
    expect(g.state.capacityMax).toBe(2);
    g.state.meters.confidence = 30;
    const gains: number[] = [];
    for (let i = 0; i < 3; i++) {
      g.state.capacity = 1;
      const before = g.state.meters.confidence;
      g.performAction('brief_leader');
      gains.push(Math.round(g.state.meters.confidence - before));
    }
    expect(gains).toEqual([4, 2, 1]);
  });

  it('tips are released gradually (welcome first, at most one per action)', () => {
    const g = newGame({ countryId: 'meridian', difficulty: 'director', seed: 9 });
    expect(g.view().pendingTips).toEqual(['welcome']);
    g.dismissTip('welcome');
    g.resolveChoice(g.state.inbox[0].uid, g.state.inbox[0].choices[0].id);
    expect(g.view().pendingTips.length).toBeLessThanOrEqual(1);
  });

  it('revoke_model can pull a model with a confirmed flaw and no situation', () => {
    const g = midGame('commonwealth', 13);
    if (g.state.gameOver) return;
    const m = g.state.models.find((x) => x.status === 'deployed' || x.status === 'limited');
    if (!m) return;
    m.flaw = 'deceptive';
    m.flawKnown = true;
    const a = g.getActions().find((x) => x.id === 'revoke_model')!;
    expect(a.targets?.some((t) => t.id === m.id && !t.disabled)).toBe(true);
    expect(g.performAction('revoke_model', m.id, 'bogus').ok).toBe(false);
    const r = g.performAction('revoke_model', m.id, 'suspend');
    expect(r.ok).toBe(true);
    expect(r.success).toBe(true);
    expect(g.state.models.find((x) => x.id === m.id)!.status).toBe('suspended');
  });

  it('follow_signal targets recent signals and detects or reports a false lead', () => {
    let tested = false;
    for (let seed = 1; seed < 60 && !tested; seed++) {
      const g = newGame({ countryId: COUNTRIES[seed % 4], difficulty: 'director', seed });
      playTurns(g, 8, seed);
      if (g.state.gameOver) continue;
      if (!g.state.unlockedTabs.includes('threats')) continue;
      const a = g.getActions().find((x) => x.id === 'follow_signal')!;
      const t = a.targets?.find((x) => !x.disabled);
      if (!t || a.disabled) continue;
      g.state.capacity = Math.max(1, g.state.capacity);
      const r = g.performAction('follow_signal', t.id);
      expect(r.ok).toBe(true);
      expect(g.performAction('follow_signal', t.id).ok).toBe(false); // already followed
      tested = true;
    }
    expect(tested).toBe(true);
  });
});

describe('engine: browser-QA fixes', () => {
  function firstChoicePlay(g: Game, onTurnStart?: (g: Game) => void): void {
    while (!g.state.gameOver) {
      onTurnStart?.(g);
      while (g.state.inbox.length && !g.state.gameOver) {
        const c = g.state.inbox[0];
        const ch = c.choices.find((x) => !x.disabled) ?? c.choices[0];
        if (!g.resolveChoice(c.uid, ch.id).ok) for (const x of c.choices) if (g.resolveChoice(c.uid, x.id).ok) break;
      }
      if (!g.state.gameOver) g.endTurn();
    }
  }

  it('every quarter opens with at least one briefing (incl. the QA repro seed)', () => {
    const runs: [CountryId, number][] = [['commonwealth', 831211110]];
    for (let seed = 1; seed <= 60; seed++) runs.push([COUNTRIES[seed % 4], seed * 7919]);
    for (const [country, seed] of runs) {
      const g = newGame({ countryId: country, difficulty: 'director', seed });
      firstChoicePlay(g, (game) => expect(game.state.inbox.length, `${country}/${seed} turn ${game.state.turn}`).toBeGreaterThan(0));
    }
  });

  it('the finale reads as the final quarter (never "Q1 2031" or 17/16)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 3; seed++) {
      const g = newGame({ countryId: COUNTRIES[seed % 4], difficulty: 'analyst', seed });
      let finaleView: GameView | null = null;
      let lastReport: string | null = null;
      while (!g.state.gameOver) {
        while (g.state.inbox.length && !g.state.gameOver) {
          const v = g.view();
          if (v.finale) finaleView = v;
          const c = g.state.inbox[0];
          const ch = c.choices.find((x) => !x.disabled) ?? c.choices[0];
          g.resolveChoice(c.uid, ch.id);
        }
        if (!g.state.gameOver) lastReport = JSON.stringify(g.endTurn());
      }
      if (!finaleView || g.state.turn <= g.state.maxTurns) continue;
      checked++;
      expect(finaleView.turn).toBeLessThanOrEqual(finaleView.maxTurns);
      expect(finaleView.dateLabel).toBe('Q4 2030');
      for (const c of finaleView.inbox) expect(c.createdTurn).toBeLessThanOrEqual(16);
      expect(JSON.stringify(finaleView)).not.toContain('2031');
      expect(lastReport).not.toContain('2031');
      expect(JSON.stringify(g.view())).not.toContain('2031');
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('MeterView.lastDelta is live: current value minus the start of the previous quarter', () => {
    const g = newGame({ countryId: 'atlantic', difficulty: 'director', seed: 77 });
    playTurns(g, 3, 1);
    if (g.state.gameOver) return;
    const hist = g.state.meterHistory.confidence;
    const expectDelta = () => Math.round(g.state.meters.confidence - hist[hist.length - 2]);
    expect(g.view().meters.confidence.lastDelta).toBe(expectDelta());
    g.state.capacity = Math.max(1, g.state.capacity);
    g.state.flags.briefTurns = '';
    const before = g.view().meters.confidence.lastDelta;
    expect(g.performAction('brief_leader').ok).toBe(true);
    const after = g.view().meters.confidence.lastDelta;
    expect(after).toBe(expectDelta());
    expect(after).toBeGreaterThan(before);
  });
});
