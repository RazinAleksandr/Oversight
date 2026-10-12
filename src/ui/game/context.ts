/**
 * Game-screen context: the current fogged view plus the intents panels can trigger.
 * Panels never call the engine directly — GameScreen owns all mutations, sounds and overlays.
 */
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { ActionId, ActionTarget, ActionView, AdvisorId, GameAPI, GameView, NewsItem, ProgramId, TabId } from '../../engine/types';
import { t } from '../../i18n';

export interface GameCtxValue {
  game: GameAPI;
  view: GameView;
  actions: ActionView[];
  desktop: boolean;
  sections: Record<string, string>;
  selectSection(panel: string, section: string): void;
  openCard(uid: string): void;
  /** Open the action picker/confirm sheet, optionally pre-selecting a target and option. */
  openAction(id: ActionId, targetId?: string, optionId?: string): void;
  /** Confirm sheet for a situation response. */
  openResponse(situationId: string, responseId: string): void;
  setProgram(id: ProgramId, level: number): void;
  goTab(tab: TabId): void;
  /** Open an operation in context, preserving the active decision and return route. */
  openManagement(tab: TabId, section?: string, target?: string): void;
  endQuarter(): void;
  toast(msg: string): void;
  /** Open the full news feed sheet. */
  openNews(): void;
}

export const GameCtx = createContext<GameCtxValue>(null as unknown as GameCtxValue);
export const useGame = (): GameCtxValue => useContext(GameCtx);

const FALLBACK_ADVISORS: Record<AdvisorId, { name: string; role: string; bias: string; portraitSeed: number }> = {
  chief_of_staff: { name: t('Chief of Staff'), role: t('Chief of Staff'), bias: t('Politics first.'), portraitSeed: 11 },
  scientist: { name: t('Chief Scientist'), role: t('Chief Scientist'), bias: t('Cautious.'), portraitSeed: 23 },
  economist: { name: t('Economic Advisor'), role: t('Economic Advisor'), bias: t('Growth first.'), portraitSeed: 37 },
  intelligence: { name: t('Intelligence Director'), role: t('Intelligence Director'), bias: t('Hawkish.'), portraitSeed: 41 },
};

export function advisorInfo(view: GameView, id: AdvisorId) {
  return view.advisors?.[id] ?? FALLBACK_ADVISORS[id];
}

/** Actions of a category that can target a given entity id. */
export function actionsFor(actions: ActionView[], category: ActionView['category'] | ActionView['category'][], targetId?: string): ActionView[] {
  const cats = Array.isArray(category) ? category : [category];
  return actions.filter((a) => cats.includes(a.category) && (targetId ? !!a.targets?.some((t) => t.id === targetId) : true));
}

/** The follow_signal target for a news item, if the engine offers one (it may carry a disabled reason). */
export function followTarget(actions: ActionView[], n: Pick<NewsItem, 'id' | 'signal'>): { action: ActionView; target: ActionTarget } | null {
  if (!n.signal || !n.id) return null;
  const action = actions.find((a) => a.id === 'follow_signal');
  const target = action?.targets?.find((t) => t.id === n.id);
  return action && target ? { action, target } : null;
}

/** Signal headlines the player can still follow up this quarter. */
export function followableSignals(view: GameView, actions: ActionView[]): NewsItem[] {
  return view.news.filter((n) => {
    const f = followTarget(actions, n);
    return !!f && !f.target.disabled;
  });
}
