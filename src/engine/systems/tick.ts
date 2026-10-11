/** Transient per-tick context passed between systems during End Quarter (never serialized). */
import type { CountryId, SectorId } from '../types';

export type WorldCardRequest =
  /** A rival has just overtaken our domestic frontier (major moment, at most twice per run). */
  | { kind: 'rival_overtakes'; rivalId: CountryId }
  | { kind: 'cyberattack'; rivalId: CountryId; sector: SectorId; damage: number }
  | { kind: 'espionage_found'; rivalId: CountryId }
  | { kind: 'export_controls_on_us'; rivalId: CountryId }
  | { kind: 'accord_ready' }
  | { kind: 'defection_found'; rivalId: CountryId }
  | { kind: 'rogue_found'; modelId: string };

export interface TickCtx {
  econDelta: number;
  stabDelta: number;
  secDelta: number;
  adoptionDelta: Record<SectorId, number>;
  world: WorldCardRequest[];
  situationCards: { situationId: string; reason: 'detected' | 'stage' }[];
  catastrophes: string[];
  warnings: string[];
}

export function newTickCtx(): TickCtx {
  return {
    econDelta: 0,
    stabDelta: 0,
    secDelta: 0,
    adoptionDelta: { business: 0, public: 0, infrastructure: 0, defense: 0 },
    world: [],
    situationCards: [],
    catastrophes: [],
    warnings: [],
  };
}
