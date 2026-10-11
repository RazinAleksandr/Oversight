/**
 * Card construction and inbox management: max 3 cards per quarter, priority order
 * (threshold > last chance > critical > priority > routine), overflow queued for later quarters.
 * Cards never hold functions — resolution is dispatched by `templateId` (see resolve.ts).
 */
import { t } from '../i18n';
import { changeMeter, changeResource, effectiveConfidence, spendEvidence } from './changes';
import type { Card, CardKind, Choice, Cost, GameState } from './types';
import { nextId } from './util';

export const MAX_INBOX = 3;

export type CardInit = Omit<Card, 'uid' | 'createdTurn'> & { createdTurn?: number };

export function makeCard(s: GameState, init: CardInit): Card {
  const card: Card = { ...init, uid: nextId(s, 'c'), createdTurn: init.createdTurn ?? s.turn };
  return card;
}

const KIND_RANK: Partial<Record<CardKind, number>> = { threshold: 0, last_chance: 1, intro: 2 };
const URGENCY_RANK = { critical: 3, priority: 4, routine: 5 } as const;

export function cardRank(c: Card): number {
  return KIND_RANK[c.kind] ?? URGENCY_RANK[c.urgency];
}

function sortByPriority(cards: Card[]): Card[] {
  return cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => cardRank(a.c) - cardRank(b.c) || a.c.createdTurn - b.c.createdTurn || a.i - b.i)
    .map((x) => x.c);
}

/**
 * Places freshly generated + queued cards: the best ones into the inbox (max 3), the rest into the queue.
 * `reserved` (a scripted event) always gets one inbox slot so narrative is never crowded out.
 */
export function distributeCards(s: GameState, cards: Card[], reserved?: Card): number {
  const pool = sortByPriority([...s.inbox, ...s.queue, ...cards]);
  const room = MAX_INBOX - (reserved ? 1 : 0);
  s.inbox = sortByPriority(reserved ? [...pool.slice(0, room), reserved] : pool.slice(0, room));
  s.queue = pool.slice(room);
  return s.inbox.length;
}

/** Adds a card to the inbox immediately (direct consequence of a choice). */
export function pushInboxNow(s: GameState, card: Card, front = true): void {
  if (front) s.inbox.unshift(card);
  else s.inbox.push(card);
}

type CostKey = 'capacity' | 'budget' | 'evidence' | 'confidence';

/** Disabled reasons for unaffordable costs, in the current language. */
export function costReason(key: CostKey): string {
  switch (key) {
    case 'capacity':
      return t('Not enough capacity this quarter');
    case 'budget':
      return t('Not enough budget');
    case 'evidence':
      return t('Requires evidence');
    case 'confidence':
      return t('Not enough political capital');
  }
}

const COST_KEYS: CostKey[] = ['capacity', 'budget', 'evidence', 'confidence'];

/** True for a cost-based disabled reason (in the current language; a save may come from another one). */
export function isCostReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return COST_KEYS.some((k) => costReason(k) === reason) || ['Not enough capacity this quarter', 'Not enough budget', 'Requires evidence', 'Not enough political capital'].includes(reason);
}

/** Why a cost can't be paid right now, or null if affordable. */
export function costBlock(s: GameState, cost: Cost | undefined): string | null {
  if (!cost) return null;
  if ((cost.capacity ?? 0) > s.capacity) return costReason('capacity');
  if ((cost.budget ?? 0) > 0 && (cost.budget ?? 0) > s.budget) return costReason('budget');
  if ((cost.evidence ?? 0) > s.evidence.length) return costReason('evidence');
  if ((cost.confidence ?? 0) > 0 && effectiveConfidence(s, cost.confidence ?? 0) >= s.meters.confidence) return costReason('confidence');
  return null;
}

/** Pays a cost (assumes `costBlock` returned null). Evidence spends the oldest matching token. */
export function payCost(s: GameState, cost: Cost | undefined, reason: string, evidenceFor?: { companyId?: string; rivalId?: string }): void {
  if (!cost) return;
  if (cost.capacity) changeResource(s, 'capacity', -cost.capacity, reason);
  if (cost.budget) changeResource(s, 'budget', -cost.budget, reason);
  if (cost.confidence) changeMeter(s, 'confidence', -effectiveConfidence(s, cost.confidence), reason, true);
  for (let i = 0; i < (cost.evidence ?? 0); i++) spendEvidence(s, reason, evidenceFor);
}

/** Re-evaluates cost-based disabled reasons on a choice, keeping static reasons. */
export function refreshCostBlock(s: GameState, choice: Choice): void {
  if (choice.disabled && !isCostReason(choice.disabled)) return;
  choice.disabled = costBlock(s, choice.cost);
}
