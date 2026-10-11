/**
 * Advisor tips are released gradually: 'welcome' first, then at most one new tip per resolved card or
 * action, and at most two per quarter. Tips wait in `state.tipBacklog` until released to `pendingTips`.
 */
import type { GameState, TipId } from './types';

const MAX_PER_QUARTER = 2;

/** Queues a tip for later release (no-op if already seen, pending or queued). */
export function queueTip(s: GameState, id: TipId): void {
  s.tipBacklog = s.tipBacklog ?? [];
  if (s.tipsShown.includes(id) || s.pendingTips.includes(id) || s.tipBacklog.includes(id)) return;
  s.tipBacklog.push(id);
}

/** Releases at most one queued tip, if the player has no unread tip and the quarter's quota allows. */
export function releaseTip(s: GameState): void {
  const backlog = s.tipBacklog ?? [];
  if (!backlog.length || s.pendingTips.length > 0) return;
  const released = s.flags.tipsTurn === s.turn && typeof s.flags.tipsReleased === 'number' ? s.flags.tipsReleased : 0;
  if (released >= MAX_PER_QUARTER) return;
  const next = backlog.shift() as TipId;
  s.pendingTips.push(next);
  s.flags.tipsTurn = s.turn;
  s.flags.tipsReleased = released + 1;
}

export function dismissTipImpl(s: GameState, id: TipId): void {
  s.pendingTips = s.pendingTips.filter((t) => t !== id);
  s.tipBacklog = (s.tipBacklog ?? []).filter((t) => t !== id);
  if (!s.tipsShown.includes(id)) s.tipsShown.push(id);
}
