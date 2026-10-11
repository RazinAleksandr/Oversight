/**
 * Shared predicates for scripted events. Pure functions over GameState / runtime entities.
 * Content may read hidden truth here (events are how hidden truth leaks into the story),
 * but must never mutate state outside Effect/custom effects.
 */
import type {
  AIModel,
  Archetype,
  Company,
  EffectHelpers,
  EventContext,
  FlawType,
  GameState,
  PolicyId,
  ProgramId,
  Rival,
  SectorId,
  Situation,
  SituationType,
} from '../../engine/types';

// ── state checks ──────────────────────────────────────────────
export const flag = (s: GameState, key: string): boolean => !!s.flags?.[key];
export const notFlag = (s: GameState, key: string): boolean => !s.flags?.[key];
export const hasPolicy = (s: GameState, id: PolicyId): boolean => s.policies.includes(id);
export const programLvl = (s: GameState, id: ProgramId): number => s.programs?.[id] ?? 0;
export const adoption = (s: GameState, sector: SectorId): number => s.adoption?.[sector] ?? 0;

/** Best true capability among domestic companies. */
export const domesticC = (s: GameState): number => s.companies.reduce((m, c) => Math.max(m, c.capability), 0);
/** Best true capability among rivals. */
export const rivalC = (s: GameState): number => s.rivals.reduce((m, r) => Math.max(m, r.capability), 0);
/** True if some rival is ahead of the best domestic lab. */
export const behindRival = (s: GameState): boolean => rivalC(s) > domesticC(s);

/** A leadership review (election/congress) happens within the next `within` turns (exclusive of now). */
export const reviewSoon = (s: GameState, within: number): boolean =>
  (s.government?.calendar ?? []).some((e) => e.turn > s.turn && e.turn <= s.turn + within);

export const openSituations = (s: GameState): Situation[] => s.situations.filter((x) => !x.resolved);
export const hasOpenSituation = (s: GameState, type?: SituationType): boolean =>
  openSituations(s).some((x) => !type || x.type === type);

export const deployedModels = (s: GameState): AIModel[] => s.models.filter(isDeployed);

// ── binding predicates ────────────────────────────────────────
export const isActive = (c: Company): boolean => c.status !== 'suspended';
export const ofType =
  (...types: Archetype[]) =>
  (c: Company): boolean =>
    isActive(c) && types.includes(c.archetype);
/** Companies likely to hide things (hidden truth). */
export const secretive = (c: Company): boolean => isActive(c) && c.transparency < 55;
export const reckless = (c: Company): boolean => isActive(c) && (c.ambition > 60 || c.safety < 45);
export const conscientious = (c: Company): boolean => isActive(c) && c.safety >= 55;
export const friendlyCompany = (c: Company): boolean => isActive(c) && c.relation >= 55;
export const hostileCompany = (c: Company): boolean => isActive(c) && c.relation < 40;

export const isDeployed = (m: AIModel): boolean =>
  m.status === 'deployed' || m.status === 'limited' || m.status === 'rogue_deployed';
export const deployedIn =
  (sector: SectorId) =>
  (m: AIModel): boolean =>
    isDeployed(m) && m.sectors.includes(sector);
export const openModel = (m: AIModel): boolean => m.openWeights && m.status !== 'rejected';
/** Approved and serving users (not unauthorized deployments). */
export const inService = (m: AIModel): boolean => m.status === 'deployed' || m.status === 'limited';
/** Model whose hidden flaw is absent or one of these, so a story about that flaw can be made true. */
export const flawFits =
  (...flaws: FlawType[]) =>
  (m: AIModel): boolean =>
    m.flaw === null || flaws.includes(m.flaw);
/** Combine model predicates. */
export const both =
  (...preds: ((m: AIModel) => boolean)[]) =>
  (m: AIModel): boolean =>
    preds.every((p) => p(m));
/** Company predicate: it owns at least one model matching `pred` (so a company+model binding cannot dead-end). */
export const ownsModel =
  (pred: (m: AIModel) => boolean, companyPred: (c: Company) => boolean = isActive) =>
  (c: Company, s: GameState): boolean =>
    companyPred(c) && s.models.some((m) => m.companyId === c.id && pred(m));

export const anyRival = (_r: Rival): boolean => true;
export const distrustfulRival = (r: Rival): boolean => r.trust < 45;
export const friendlyRival = (r: Rival): boolean => r.trust >= 50;
export const aggressiveRival = (r: Rival): boolean => r.aggression >= 0.5;
export const carefulRival = (r: Rival): boolean => r.safetyStance >= 0.55;
export const leadingRival = (r: Rival, s: GameState): boolean => r.capability >= domesticC(s) - 0.3;

// ── story ↔ simulation glue (custom effects) ─────────────────
// When an event's text asserts that the bound model misbehaves, these keep the hidden truth,
// the Labs view and the debrief consistent with the story. All tolerate a missing model.

type Custom = (s: GameState, ctx: EventContext, h: EffectHelpers) => void;

/** Run several custom effects in order. */
export const all =
  (...fns: Custom[]): Custom =>
  (s, ctx, h) => {
    for (const f of fns) f(s, ctx, h);
  };

/** The story says the bound model has this problem: make its hidden flaw match (never overwrites an existing flaw). */
export const ensureFlaw =
  (flaw: FlawType): Custom =>
  (_s, ctx) => {
    const m = ctx.model;
    if (m && !m.flaw) m.flaw = flaw;
  };

/** Flag the bound model as suspect for the player (Labs shows "suspected") and make the flaw real. */
export const markSuspect =
  (flaw: FlawType): Custom =>
  (_s, ctx) => {
    const m = ctx.model;
    if (!m) return;
    if (!m.flaw) m.flaw = flaw;
    if (!m.flawKnown) m.suspected = true;
  };

/** Confirm the bound model's flaw to the player, as a successful audit would. */
export const revealFlaw =
  (flaw: FlawType): Custom =>
  (_s, ctx) => {
    const m = ctx.model;
    if (!m) return;
    if (!m.flaw) m.flaw = flaw;
    m.flawKnown = true;
    m.evalDetected = true;
    m.suspected = false;
  };

/**
 * Hidden consequence of burying a problem: spawn an undetected situation tied to the bound model
 * (or company/rival), making the model's flaw match. If that model already feeds a live situation
 * of this type, it grows faster instead of duplicating.
 */
export const seedThreat =
  (type: SituationType, severity: number, flaw?: FlawType): Custom =>
  (s, ctx, h) => {
    const m = ctx.model;
    if (m && flaw && !m.flaw) m.flaw = flaw;
    const live = m ? s.situations.find((x) => !x.resolved && x.type === type && x.source?.modelId === m.id) : undefined;
    if (live) {
      live.growthMult = Math.min(3, live.growthMult + 0.25);
      return;
    }
    h.spawnSituation(type, {
      severity,
      modelId: m?.id,
      companyId: m?.companyId ?? ctx.company?.id,
      rivalId: m ? undefined : ctx.rival?.id,
      detected: false,
    });
  };

/** Block a choice that makes no sense while national chip export controls are already on. */
export const unlessExportControls = (s: GameState): boolean | string =>
  s.exportControls ? 'Chip exports are already restricted for every rival' : true;

export const liveSituation =
  (...types: SituationType[]) =>
  (x: Situation): boolean =>
    !x.resolved && (types.length === 0 || types.includes(x.type));
export const hiddenSituation =
  (...types: SituationType[]) =>
  (x: Situation): boolean =>
    !x.resolved && !x.detected && (types.length === 0 || types.includes(x.type));
