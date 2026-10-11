/**
 * Card resolution dispatch by `templateId` (system cards) or EventDef id (scripted events),
 * and card refresh (re-evaluating disabled reasons when state changes mid-quarter).
 */
import { refreshCostBlock } from './cards';
import { refreshEventCard, resolveEventCard } from './events';
import { DEPLOY_CARD, resolveDeploymentCard } from './systems/deployment';
import {
  DEMAND_CARD,
  ELECTION_CARD,
  INSIST_CARD,
  LAST_CHANCE_CARD,
  refreshGovernmentCard,
  resolveDemandCard,
  resolveElectionCard,
  resolveLastChanceCard,
} from './systems/government';
import { INTRO_CARD, resolveIntroCard } from './systems/intro';
import { QUIET_CARD, resolveQuietCard } from './systems/quiet';
import { SITUATION_CARD, refreshSituationCard, resolveSituationCard } from './systems/situations';
import { THRESHOLD_CARD, resolveThresholdCard } from './systems/threshold';
import { WORLD_CARD_PREFIX, refreshWorldCard, resolveWorldCard } from './systems/worldCards';
import type { Card, EndingId, GameState, Stamp } from './types';

export interface Resolution {
  ok: boolean;
  error?: string;
  text: string;
  title?: string;
  success?: boolean;
  stamp?: Stamp;
  /** Cards to add to the inbox immediately (e.g. "the leader insists"). */
  newCards: Card[];
  /** Threshold outcome: the run ends after this card. */
  thresholdEnd?: { success: boolean; failureId?: EndingId };
}

export function resolveCard(s: GameState, card: Card, choiceId: string): Resolution {
  const tpl = card.templateId;
  if (tpl === INTRO_CARD) return { ...resolveIntroCard(s, choiceId), newCards: [] };
  if (tpl === QUIET_CARD) return { ...resolveQuietCard(s, choiceId), newCards: [] };
  if (tpl === DEPLOY_CARD) return { ...resolveDeploymentCard(s, card, choiceId), newCards: [] };
  if (tpl === DEMAND_CARD || tpl === INSIST_CARD) {
    const r = resolveDemandCard(s, card, choiceId);
    return { ok: r.ok, error: r.error, text: r.text, success: r.success, newCards: r.newCard ? [r.newCard] : [] };
  }
  if (tpl === ELECTION_CARD) {
    const r = resolveElectionCard(s, card, choiceId);
    return { ok: r.ok, error: r.error, text: r.text, success: r.success, newCards: [] };
  }
  if (tpl === LAST_CHANCE_CARD) {
    const r = resolveLastChanceCard(s, card, choiceId);
    return { ok: r.ok, error: r.error, text: r.text, success: r.success, newCards: [] };
  }
  if (tpl === SITUATION_CARD) {
    const r = resolveSituationCard(s, card, choiceId);
    return { ok: r.ok, error: r.error, text: r.text, title: r.title, newCards: [] };
  }
  if (tpl === THRESHOLD_CARD) {
    const r = resolveThresholdCard(s, card, choiceId);
    if (!r.ok) return { ok: false, error: r.error, text: '', newCards: [] };
    return { ok: true, text: r.text, success: r.success, newCards: [], thresholdEnd: { success: r.success, failureId: r.failureId } };
  }
  if (tpl.startsWith(WORLD_CARD_PREFIX)) {
    const r = resolveWorldCard(s, card, choiceId);
    return { ok: r.ok, error: r.error, text: r.text, success: r.success, newCards: [] };
  }
  const r = resolveEventCard(s, card, choiceId);
  return { ok: r.ok, error: r.error, text: r.text, success: r.success, stamp: r.stamp, newCards: [] };
}

export function refreshCard(s: GameState, card: Card): void {
  const tpl = card.templateId;
  if (tpl === SITUATION_CARD) refreshSituationCard(s, card);
  else if (tpl === DEMAND_CARD || tpl === ELECTION_CARD || tpl === LAST_CHANCE_CARD || tpl === INSIST_CARD) refreshGovernmentCard(s, card);
  else if (tpl.startsWith(WORLD_CARD_PREFIX)) refreshWorldCard(s, card);
  else if (!tpl.startsWith('sys:')) refreshEventCard(s, card);
  else for (const ch of card.choices) refreshCostBlock(s, ch);
}
