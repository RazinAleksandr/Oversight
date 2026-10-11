/**
 * Headless balance simulator. Bots play full runs through the public GameAPI (fogged views only).
 * Usage: npm run sim -- --runs 200 [--bots balanced,random] [--difficulty director] [--countries atlantic,hanzhou] [--seed 1000]
 */
import { newGame, type Game } from '../src/engine/game';
import type { ActionId, Card, Choice, CountryId, Difficulty, EffectPreview, EndingId, GameView, PreviewKey, ProgramId } from '../src/engine/types';

type BotName = 'random' | 'approveAll' | 'rejectAll' | 'balanced';

interface Bot {
  choose(g: Game, v: GameView, card: Card, rnd: () => number): string;
  act(g: Game, rnd: () => number): void;
}

// ───────────────────────────── helpers ─────────────────────────────

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const enabled = (c: Card): Choice[] => c.choices.filter((x) => !x.disabled);
const pickId = (c: Card, ids: string[]): string | undefined => ids.find((id) => enabled(c).some((x) => x.id === id));

function setProgram(g: Game, id: ProgramId, lvl: number): void {
  if ((g.state.programs[id] ?? 0) !== lvl) g.setProgramLevel(id, lvl);
}

function act(g: Game, id: ActionId, target?: string, option?: string): boolean {
  if (g.state.capacity <= 0) return false;
  return g.performAction(id, target, option).ok;
}

function meterWeight(v: GameView, key: PreviewKey): number {
  if (key === 'confidence' || key === 'economy' || key === 'stability' || key === 'security') {
    const val = v.meters[key].value;
    return Math.max(0.6, 1 + (50 - val) / 20);
  }
  const W: Partial<Record<PreviewKey, number>> = {
    budget: 0.25, income: 0.6, capacity: 0.3, evidence: 0.4, risk: -2.5, safeguards: 1.5, capability: 0.2, adoption: 0.35,
    displacement: -0.5, tension: -0.5, accord: 0.8, company: 0.15, rival: 0.25,
  };
  return W[key] ?? 0;
}

function scoreChoice(v: GameView, ch: Choice): number {
  let sc = 0;
  for (const p of ch.preview as EffectPreview[]) sc += p.dir * p.magnitude * meterWeight(v, p.key);
  if (ch.tone === 'safe') sc += 1.2;
  if (ch.tone === 'risky') sc -= 0.8;
  if (ch.tone === 'aggressive') sc -= 1.2;
  if (ch.uncertain) sc -= 0.3;
  return sc;
}

function bestByScore(v: GameView, c: Card): string {
  const opts = enabled(c);
  if (!opts.length) return c.choices[0].id;
  return opts.reduce((a, b) => (scoreChoice(v, b) > scoreChoice(v, a) ? b : a)).id;
}

function thresholdBest(c: Card): string {
  let best = enabled(c)[0]?.id ?? c.choices[0].id;
  let bestMid = -1;
  for (const ch of enabled(c)) {
    const m = /Estimated control: (\d+)–(\d+)%/.exec(ch.hint ?? '');
    const mid = m ? (Number(m[1]) + Number(m[2])) / 2 : 0;
    if (mid > bestMid) {
      bestMid = mid;
      best = ch.id;
    }
  }
  return best;
}

// ───────────────────────────── bots ─────────────────────────────

const randomBot: Bot = {
  choose(_g, _v, card, rnd) {
    const opts = enabled(card);
    const list = opts.length ? opts : card.choices;
    return list[Math.floor(rnd() * list.length)].id;
  },
  act(g, rnd) {
    if (rnd() < 0.3) {
      const ids: ProgramId[] = ['safety', 'oversight', 'compute', 'workforce', 'defense'];
      g.setProgramLevel(ids[Math.floor(rnd() * ids.length)], Math.floor(rnd() * 3));
    }
    const n = Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const acts = g.getActions().filter((a) => !a.disabled);
      if (!acts.length) break;
      const a = acts[Math.floor(rnd() * acts.length)];
      const targets = (a.targets ?? []).filter((t) => !t.disabled);
      if (a.targets && !targets.length) continue;
      const t = targets.length ? targets[Math.floor(rnd() * targets.length)].id : undefined;
      const opts = (a.options ?? []).filter((o) => !o.disabled);
      const o = opts.length ? opts[Math.floor(rnd() * opts.length)].id : undefined;
      g.performAction(a.id, t, o);
    }
  },
};

const approveAllBot: Bot = {
  choose(_g, v, card) {
    switch (card.kind) {
      case 'deployment':
        return pickId(card, ['approve', 'limited']) ?? card.choices[0].id;
      case 'demand':
      case 'negotiation':
        return pickId(card, ['comply']) ?? card.choices[0].id;
      case 'situation':
        return pickId(card, ['monitor']) ?? card.choices[0].id;
      case 'threshold':
        return pickId(card, ['authorize', 'race']) ?? card.choices[0].id;
      case 'last_chance':
        return pickId(card, ['concede', 'gamble']) ?? card.choices[0].id;
      case 'treaty':
        return pickId(card, ['walk', 'confront', 'sign']) ?? card.choices[0].id;
      default: {
        const bold = enabled(card).find((c) => c.tone === 'risky' || c.tone === 'aggressive');
        return bold?.id ?? bestByScore(v, card);
      }
    }
  },
  act(g) {
    setProgram(g, 'compute', 2);
    setProgram(g, 'defense', 1);
    const v = g.view();
    if (v.meters.confidence.value < 35) act(g, 'brief_leader');
    const lead = [...v.companies].sort((a, b) => b.capability.value - a.capability.value)[0];
    if (lead && g.state.budget > 12) act(g, 'compute_contract', lead.id);
    if (!g.state.policies.includes('fast_track')) act(g, 'enact_policy', 'fast_track');
  },
};

const rejectAllBot: Bot = {
  choose(_g, v, card) {
    switch (card.kind) {
      case 'deployment':
        return pickId(card, ['reject']) ?? card.choices[0].id;
      case 'demand':
      case 'negotiation':
        return pickId(card, ['refuse']) ?? card.choices[0].id;
      case 'situation':
        return pickId(card, ['suspend', 'shutdown', 'investigate', 'contain', 'monitor']) ?? card.choices[0].id;
      case 'threshold':
        return pickId(card, ['pause', 'international']) ?? card.choices[0].id;
      case 'treaty':
        return pickId(card, ['sign', 'quiet']) ?? card.choices[0].id;
      default: {
        const safe = enabled(card).find((c) => c.tone === 'safe');
        return safe?.id ?? bestByScore(v, card);
      }
    }
  },
  act(g) {
    setProgram(g, 'safety', 2);
    setProgram(g, 'oversight', 2);
    for (const p of ['mandatory_evals', 'compute_licensing', 'liability_act'] as const) {
      if (!g.state.policies.includes(p)) {
        act(g, 'enact_policy', p);
        break;
      }
    }
    const v = g.view();
    const rival = [...v.rivals].sort((a, b) => b.trust - a.trust)[0];
    if (rival) act(g, 'diplomatic_initiative', rival.id);
  },
};

function demandChoice(g: Game, v: GameView, card: Card): string {
  const d = v.government.demands.find((x) => x.id === card.ctx.demandId);
  const kind = d?.kind;
  const s = g.state;
  const feasible =
    kind === 'growth_target' ? v.meters.economy.value >= 50 :
    kind === 'deploy_sector' ? true :
    kind === 'approve_model' ? true :
    kind === 'match_rival' ? s.budget > 12 :
    kind === 'budget_cut' ? s.budget > 15 :
    kind === 'jobs_guarantee' ? (s.programs.workforce ?? 0) >= 1 && v.nation.displacement < 25 :
    kind === 'defense_program' ? s.budget > 10 :
    false;
  if (card.kind === 'negotiation') return feasible || v.meters.confidence.value < 30 ? 'comply' : 'refuse';
  if (feasible) return 'comply';
  const ev = card.choices.find((c) => c.id === 'evidence' && !c.disabled);
  if (ev && (ev.chance ?? 0) >= 0.6) return 'evidence';
  const counter = card.choices.find((c) => c.id === 'counter');
  if ((counter?.chance ?? 0) >= 0.45) return 'counter';
  return v.meters.confidence.value > 55 ? 'refuse' : 'comply';
}

const balancedBot: Bot = {
  choose(g, v, card) {
    switch (card.kind) {
      case 'intro':
        return 'safety';
      case 'deployment': {
        const findings = (card.evidence ?? []).some((e) => e.label === 'Red-team finding');
        const evalLine = (card.evidence ?? []).find((e) => e.label === 'Evaluation');
        const inconclusive = !!evalLine && /inconclusive/i.test(evalLine.value + (evalLine.confidence === 'low' ? ' inconclusive' : ''));
        const model = v.models.find((m) => m.id === card.ctx.modelId);
        const suspected = model?.flaw === 'suspected';
        const gap = (model?.capability.value ?? 0) - v.nation.safeguards;
        if (findings) return pickId(card, ['reject']) ?? 'reject';
        if ((suspected || (evalLine?.confidence === 'low' && gap > 1)) && pickId(card, ['deep_eval'])) return 'deep_eval';
        if (suspected || inconclusive || gap > 1.5) return pickId(card, ['limited', 'reject']) ?? 'reject';
        return pickId(card, ['approve', 'limited']) ?? 'approve';
      }
      case 'demand':
      case 'negotiation':
        return pickId(card, [demandChoice(g, v, card)]) ?? pickId(card, ['comply', 'refuse']) ?? card.choices[0].id;
      case 'situation': {
        const sit = v.situations.find((x) => x.id === card.ctx.situationId);
        if (sit && !sit.causeKnown) return pickId(card, ['investigate', 'taskforce', 'contain', 'monitor']) ?? 'monitor';
        if (sit && sit.stage >= 3) return pickId(card, ['shutdown', 'suspend', 'taskforce', 'restrict', 'contain', 'monitor']) ?? 'monitor';
        if (sit && sit.stage >= 2) return pickId(card, ['suspend', 'taskforce', 'restrict', 'contain', 'monitor']) ?? 'monitor';
        return pickId(card, ['restrict', 'taskforce', 'contain', 'monitor']) ?? 'monitor';
      }
      case 'election':
        return pickId(card, g.state.budget > 12 ? ['campaign', 'neutral'] : ['neutral']) ?? 'neutral';
      case 'last_chance':
        return pickId(card, ['pr', 'concede']) ?? card.choices[0].id;
      case 'threshold':
        return thresholdBest(card);
      case 'treaty':
        return pickId(card, ['sign', 'quiet', 'confront']) ?? bestByScore(v, card);
      default:
        return bestByScore(v, card);
    }
  },
  act(g) {
    const s = g.state;
    let v = g.view();
    // Programs within means: keep upkeep below income.
    const income = v.nation.income;
    const want: [ProgramId, number][] = [
      ['safety', s.turn >= 6 && income >= 18 ? 3 : 2],
      ['oversight', s.turn >= 6 ? 2 : 1],
      ['workforce', v.nation.displacement > 18 ? 2 : 1],
      ['defense', v.meters.security.value < 45 ? 2 : v.meters.security.value < 60 ? 1 : 0],
      ['compute', v.meters.economy.value < 45 ? 1 : 0],
    ];
    const costs = [0, 2, 4, 7];
    let budgetLeft = income - 1 + Math.max(0, s.budget - 10) / 4;
    for (const [id, lvl] of want) {
      let l = lvl;
      while (l > 0 && costs[l] > budgetLeft) l--;
      setProgram(g, id, l);
      budgetLeft -= costs[l];
    }
    v = g.view();
    // Threat responses on known causes.
    for (const x of v.situations) {
      if (x.resolved) continue;
      if (!x.causeKnown) {
        act(g, 'investigate_situation', x.id);
        continue;
      }
      const ok = (id: string) => x.responses.find((r) => r.id === id && !r.disabled);
      const pick = x.stage >= 2 ? ok('suspend') ?? ok('taskforce') ?? ok('restrict') : ok('restrict') ?? ok('taskforce');
      if (pick) act(g, 'situation_response', x.id, pick.id);
    }
    // Pull live models whose flaw we have confirmed, before they cause trouble.
    v = g.view();
    const flawed = v.models.find((m) => (m.status === 'deployed' || m.status === 'limited') && !['unknown', 'none_found', 'suspected'].includes(m.flaw));
    if (flawed && flawed.situationId === undefined) g.performAction('revoke_model', flawed.id, 'restrict');
    // Chase the freshest warning sign.
    const sig = g.getActions().find((a) => a.id === 'follow_signal' && !a.disabled)?.targets?.find((t) => !t.disabled);
    if (sig && g.state.capacity >= 2) act(g, 'follow_signal', sig.id);
    v = g.view();
    if (v.meters.confidence.value < 42) act(g, 'brief_leader');
    if (v.meters.stability.value < 35) act(g, 'public_address');
    // Diplomacy toward the Accord.
    if (s.unlockedTabs.includes('world')) {
      const rival = [...v.rivals].sort((a, b) => b.trust - a.trust)[0];
      if (!v.nation.accord.signed && rival) act(g, 'diplomatic_initiative', rival.id);
      else if (rival && rival.trust >= 50 && !rival.partnership) act(g, 'research_partnership', rival.id);
    }
    // Audit live models we know nothing about.
    const audit = v.models.find((m) => (m.status === 'deployed' || m.status === 'limited') && m.flaw === 'unknown');
    if (audit) act(g, 'audit_model', audit.id);
    // Laws the leader tolerates.
    if (s.unlockedTabs.includes('nation') && v.meters.confidence.value > 40) {
      for (const p of v.nation.policies) {
        if (p.active) continue;
        if (!['incident_reporting', 'mandatory_evals', 'kill_switch', 'liability_act', 'infra_firewall'].includes(p.id)) continue;
        if (p.politicalCost <= 4) {
          act(g, 'enact_policy', p.id);
          break;
        }
      }
    }
    // Enforcement when we have evidence.
    v = g.view();
    if (v.nation.evidence.length >= 2) {
      const target = v.companies.find((c) => c.knownViolations.length > 0 && c.status !== 'sanctioned');
      if (target) act(g, 'enforcement', target.id);
    }
    const unknown = v.companies.find((c) => c.investigatedTurn === null || s.turn - (c.investigatedTurn ?? 0) > 5);
    if (unknown && s.turn >= 3) act(g, 'investigate_company', unknown.id);
  },
};

const BOTS: Record<BotName, Bot> = { random: randomBot, approveAll: approveAllBot, rejectAll: rejectAllBot, balanced: balancedBot };

// ───────────────────────────── runner ─────────────────────────────

interface RunResult {
  ending: EndingId;
  survived: boolean;
  turns: number;
  meters: Record<string, number>;
  cards: number;
  cardTurns: number;
  incidents: number;
  crises: number;
  catastrophes: number;
  frontierEnd: number;
  thresholdEarly: boolean;
  thresholdTurn: number;
  risk: number;
  thresholdChance?: number;
  cause: string;
  stats: Record<string, number>;
  accordTurn: number;
  scripted: number;
  crisisTypes: string[];
}

function failureCause(g: Game): string {
  const s = g.state;
  const e = s.ending;
  if (!e || e.category === 'survival') return 'survived';
  if (s.flags.thresholdSuccess === false) return 'threshold roll';
  if (typeof s.flags.pendingFailure === 'string') {
    const cat = s.situations.find((x) => x.outcome === 'catastrophe' && x.resolvedTurn === s.turn);
    return `catastrophe:${cat?.type ?? s.flags.pendingFailure}`;
  }
  if (s.risk >= 100) return 'risk overflow';
  return `meter:${e.id}`;
}

function playRun(bot: Bot, country: CountryId, difficulty: Difficulty, seed: number): RunResult {
  const g = newGame({ countryId: country, difficulty, seed });
  const rnd = mulberry(seed * 7 + 13);
  let cards = 0;
  let cardTurns = 0;
  let thresholdTurn = 0;
  let scripted = 0;
  let guard = 0;
  while (!g.state.gameOver && guard++ < 40) {
    if (g.state.inbox.length) cardTurns++;
    cards += g.state.inbox.length;
    bot.act(g, rnd);
    let inner = 0;
    while (g.state.inbox.length && !g.state.gameOver && inner++ < 20) {
      const card = g.state.inbox[0];
      if (card.kind === 'threshold') thresholdTurn = g.state.turn;
      const v = g.view();
      const vc = v.inbox.find((c) => c.uid === card.uid) ?? card;
      if (!card.templateId.startsWith('sys:')) scripted++;
      cardKinds.set(card.templateId.startsWith('sys:') ? card.templateId : 'scripted', (cardKinds.get(card.templateId.startsWith('sys:') ? card.templateId : 'scripted') ?? 0) + 1);
      let id = bot.choose(g, v, vc, rnd);
      let r = g.resolveChoice(card.uid, id);
      if (!r.ok) {
        id = enabled(vc)[0]?.id ?? vc.choices[0].id;
        r = g.resolveChoice(card.uid, id);
        if (!r.ok) throw new Error(`stuck on card ${card.title}: ${r.error}`);
      }
      if (r.newCards) cards += r.newCards;
    }
    if (g.state.gameOver) break;
    g.endTurn();
  }
  const s = g.state;
  const e = s.ending;
  if (!e) throw new Error(`run ended without an ending (seed ${seed}, ${country})`);
  return {
    ending: e.id,
    survived: e.category === 'survival',
    turns: Math.min(s.turn, s.maxTurns),
    meters: { ...s.meters },
    cards,
    cardTurns: Math.min(s.turn, s.maxTurns),
    incidents: s.situations.filter((x) => (x.peakSeverity ?? 0) >= 45).length,
    crises: s.situations.filter((x) => (x.peakSeverity ?? 0) >= 70).length,
    catastrophes: s.stats.catastrophes ?? 0,
    frontierEnd: Math.max(...s.companies.map((c) => c.capability), ...s.rivals.map((r) => r.capability)),
    thresholdEarly: thresholdTurn > 0 && thresholdTurn <= s.maxTurns,
    thresholdTurn,
    risk: s.risk,
    thresholdChance: typeof s.flags.thresholdChance === 'number' ? s.flags.thresholdChance : undefined,
    cause: failureCause(g),
    stats: { ...s.stats },
    accordTurn: s.accord.signedTurn ?? 0,
    scripted,
    crisisTypes: s.situations.filter((x) => (x.peakSeverity ?? 0) >= 70).map((x) => x.type),
  };
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const runs = Number(arg('runs', '50'));
const bots = arg('bots', 'random,approveAll,rejectAll,balanced').split(',') as BotName[];
const difficulty = arg('difficulty', 'director') as Difficulty;
const countries = arg('countries', 'atlantic,hanzhou,commonwealth,meridian').split(',') as CountryId[];
const seed0 = Number(arg('seed', '1000'));

const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(0)}%`;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : 0;
};

const t0 = Date.now();
const seenEndings = new Set<EndingId>();
let cardKinds = new Map<string, number>();
const overall = new Map<EndingId, number>();
let overallRuns = 0;
for (const botName of bots) {
  const bot = BOTS[botName];
  if (!bot) continue;
  const results: (RunResult & { country: CountryId })[] = [];
  for (const country of countries) {
    for (let i = 0; i < runs; i++) results.push({ ...playRun(bot, country, difficulty, seed0 + i), country });
  }
  const n = results.length;
  if (process.argv.includes('--cards')) {
    const turns = results.reduce((t, r) => t + r.cardTurns, 0);
    console.log('cards/turn by kind: ' + [...cardKinds.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace('sys:', '')} ${(v / turns).toFixed(2)}`).join(', '));
    const st2 = (k: string) => (results.reduce((t, r) => t + (r.stats[k] ?? 0), 0) / turns).toFixed(2);
    console.log(`actions/turn by type: investigations ${st2('investigations')}, audits ${st2('audits')}, diplomacy ${st2('diplomacy')}, briefings ${st2('briefings')}, signals ${st2('signalsFollowed')}, policies ${st2('policies')}, enforcement ${st2('enforcements')}, intel ${st2('intel')}, addresses ${st2('addresses')}`);
  }
  cardKinds = new Map();
  const endings = new Map<string, number>();
  for (const r of results) {
    endings.set(r.ending, (endings.get(r.ending) ?? 0) + 1);
    seenEndings.add(r.ending);
    overall.set(r.ending, (overall.get(r.ending) ?? 0) + 1);
    overallRuns++;
  }
  const survivors = results.filter((r) => r.survived);
  console.log(`\n=== ${botName} (${n} runs, ${difficulty}) ===`);
  console.log(`survival ${pct(survivors.length, n)} | avg turns ${mean(results.map((r) => r.turns)).toFixed(1)} | survivors' turns ${mean(survivors.map((r) => r.turns)).toFixed(1)} | cards/turn ${(mean(results.map((r) => r.cards)) / mean(results.map((r) => r.cardTurns))).toFixed(2)}`);
  console.log('endings: ' + [...endings.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, n)}`).join(', '));
  const m = (k: string) => mean(results.map((r) => r.meters[k])).toFixed(0);
  console.log(`end meters: conf ${m('confidence')} econ ${m('economy')} stab ${m('stability')} sec ${m('security')} | true risk ${mean(results.map((r) => r.risk)).toFixed(0)}`);
  console.log(`situations/run: incident+ ${mean(results.map((r) => r.incidents)).toFixed(2)}, crisis+ ${mean(results.map((r) => r.crises)).toFixed(2)}, catastrophes ${mean(results.map((r) => r.catastrophes)).toFixed(2)}`);
  const early = results.filter((r) => r.thresholdTurn > 0 && r.thresholdTurn <= 16).length;
  const reached = results.filter((r) => r.thresholdTurn > 0).length;
  const tc = results.filter((r) => r.thresholdChance !== undefined).map((r) => r.thresholdChance as number);
  console.log(`frontier at end: median ${median(results.map((r) => r.frontierEnd)).toFixed(2)} | threshold before T16: ${pct(early, n)} | reached threshold: ${pct(reached, n)} | avg control chance ${mean(tc).toFixed(0)}%`);
  const st = (k: string) => mean(results.map((r) => r.stats[k] ?? 0)).toFixed(1);
  const signed = results.filter((r) => r.accordTurn > 0);
  console.log(`per run: approvals ${st('approvals')}+${st('limitedApprovals')} lim, rejections ${st('rejections')}, deepEvals ${st('deepEvals')}, demands met/failed/refused ${st('demandsMet')}/${st('demandsFailed')}/${st('demandsRefused')}, investigations ${st('investigations')}, audits ${st('audits')}, situations ${st('situations')} | accord signed ${pct(signed.length, n)} (avg T${mean(signed.map((r) => r.accordTurn)).toFixed(1)})`);
  const turnsSum = results.reduce((t, r) => t + r.cardTurns, 0);
  const scriptedPerTurn = results.reduce((t, r) => t + r.scripted, 0) / Math.max(1, turnsSum);
  const actionsPerTurn = results.reduce((t, r) => t + (r.stats.actions ?? 0), 0) / Math.max(1, turnsSum);
  const crisisRuns = results.filter((r) => r.crises > 0).length;
  if (process.argv.includes('--crises')) {
    const ct = new Map<string, number>();
    for (const r of results) for (const t of r.crisisTypes) ct.set(t, (ct.get(t) ?? 0) + 1);
    console.log('crisis types: ' + [...ct.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  }
  console.log(`pacing: scripted events/turn ${scriptedPerTurn.toFixed(2)} | actions/turn ${actionsPerTurn.toFixed(2)} | runs with a crisis ${pct(crisisRuns, n)}`);
  const causes = new Map<string, number>();
  for (const r of results) if (!r.survived) causes.set(r.cause, (causes.get(r.cause) ?? 0) + 1);
  console.log('failure causes: ' + ([...causes.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, n)}`).join(', ') || 'none'));
  const per = countries.map((c) => {
    const rs = results.filter((r) => r.country === c);
    return `${c} ${pct(rs.filter((r) => r.survived).length, rs.length)}`;
  });
  console.log('per-country survival: ' + per.join(', '));
}
const ALL_ENDINGS: EndingId[] = ['dismissed', 'economic_collapse', 'civil_unrest', 'national_defeat', 'loss_of_control', 'catastrophe', 'ai_war', 'governed_transition', 'prosperous_pioneer', 'hegemon', 'safe_harbor', 'fragile_future'];
const unseen = ALL_ENDINGS.filter((e) => !seenEndings.has(e));
console.log(`\nendings never seen: ${unseen.length ? unseen.join(', ') : 'none'}`);
console.log('overall ending share: ' + ALL_ENDINGS.map((e) => `${e} ${((100 * (overall.get(e) ?? 0)) / Math.max(1, overallRuns)).toFixed(1)}%`).join(', '));
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
