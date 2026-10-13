/** Presentation-only guidance. The current game route is authoritative; no simulated actions. */
import type { Card, CardKind, Choice, GameView } from '../../engine/types';
import { t } from '../../i18n';
import { readPreference, writePreference } from '../../platform/storage';

export const GUIDE_KEY = 'ato.guide.v1';
export interface GuideProgress {
  schema: 1;
  seed: number;
  countryId: string;
  startedTurn: number;
  welcomed: boolean;
  completed: boolean;
  lastDecisionKind: CardKind | null;
}
interface GuideEnvelope {
  schema: 1;
  completedOnce: boolean;
  skippedOnce: boolean;
  run: GuideProgress | null;
}
export type GuideRoute = 'agenda' | 'brief' | 'options' | 'result' | 'report' | 'other';
export interface GuideContext {
  view: GameView;
  guide: GuideProgress;
  route: GuideRoute;
  card?: Card;
  selectedId?: string | null;
  suspended?: boolean;
}
export interface GuideStep {
  id: string;
  title: string;
  body: string;
  /** A real rendered control/region. Null means an acknowledgement with no target outline. */
  target: string | null;
  ack?: 'welcome' | 'finish';
  cardUid?: string;
}
const KINDS: CardKind[] = ['intro','deployment','demand','negotiation','situation','event','election','breakthrough','treaty','last_chance','threshold'];
const COUNTRIES = ['atlantic','commonwealth','hanzhou','meridian'];
const empty = (): GuideEnvelope => ({schema:1,completedOnce:false,skippedOnce:false,run:null});
function progress(value: unknown): GuideProgress | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Partial<GuideProgress>;
  if (p.schema !== 1 || !Number.isFinite(p.seed) || !Number.isInteger(p.startedTurn) || p.startedTurn! < 1 || !COUNTRIES.includes(p.countryId ?? '') || typeof p.welcomed !== 'boolean' || typeof p.completed !== 'boolean' || (p.lastDecisionKind !== null && !KINDS.includes(p.lastDecisionKind!))) return null;
  return {schema:1,seed:p.seed!,countryId:p.countryId!,startedTurn:p.startedTurn!,welcomed:p.welcomed,completed:p.completed,lastDecisionKind:p.lastDecisionKind!};
}
function readEnvelope(): GuideEnvelope {
  try {
    const e = JSON.parse(readPreference(GUIDE_KEY) ?? 'null') as Partial<GuideEnvelope> | null;
    if (!e || e.schema !== 1) return empty();
    return {schema:1,completedOnce:e.completedOnce===true,skippedOnce:e.skippedOnce===true,run:progress(e.run)};
  } catch { return empty(); }
}
export function startGuide(view: GameView): GuideProgress {
  return {schema:1,seed:view.seed,countryId:view.country.id,startedTurn:view.turn,welcomed:false,completed:false,lastDecisionKind:null};
}
/** A new/imported run must not inherit an unrelated guide, or one from a future save. */
export function validateGuide(value: unknown, view: GameView): GuideProgress | null {
  const p = progress(value);
  return p && !p.completed && !view.gameOver && p.seed===view.seed && p.countryId===view.country.id && p.startedTurn<=view.turn ? p : null;
}
export function readGuide(view: GameView): GuideProgress | null { return validateGuide(readEnvelope().run,view); }
/** Explicit new/import replaces a run, even when its seed and country are identical. */
export function clearActiveGuide(): void {
  writePreference(GUIDE_KEY,JSON.stringify({...readEnvelope(),run:null} satisfies GuideEnvelope));
}
/** Null is the user's Skip operation. Completion/skip history survives an explicit replay. */
export function writeGuide(value: GuideProgress | null): void {
  const previous = readEnvelope();
  const next = value===null ? null : progress(value);
  if (value!==null && !next) return;
  writePreference(GUIDE_KEY,JSON.stringify({schema:1,completedOnce:previous.completedOnce || next?.completed===true,skippedOnce:previous.skippedOnce || value===null,run:next} satisfies GuideEnvelope));
}
export function shouldOfferGuide(): boolean {
  const e = readEnvelope();
  return !e.completedOnce && !e.skippedOnce;
}
function available(choice: Choice, view: GameView): boolean {
  const cost = choice.cost;
  return !choice.disabled && (!cost?.capacity || view.nation.capacity>=cost.capacity) && (!cost?.budget || view.nation.budget>=cost.budget) && (!cost?.evidence || view.nation.evidence.length>=cost.evidence);
}
/** Attribute string escaping is local to selection; no display string is used for game logic. */
function cardSelector(uid: string): string { return `[data-card="${uid.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"]`; }
export function deriveGuide({view,guide,route,card,selectedId,suspended}: GuideContext): GuideStep | null {
  if (suspended || route==='other' || !validateGuide(guide,view)) return null;
  // A restored result/report must stay the active task even if the quarter already advanced.
  if (route==='report') return {id:'report',title:t('See what the quarter changed'),body:t('The report records changes and their causes. Read it, then open the next agenda.'),target:'[data-report-continue]'};
  if (route==='result') return {id:'result',title:t('Read the outcome'),body:guide.lastDecisionKind==='intro'
    ? t('Your opening priority is now recorded. Read its effects, then continue to the next request.')
    : t('Read the recorded changes. Adoption itself changes over later quarters; a changed target is not immediate uptake.'),target:'[data-result-continue]'};
  if (!guide.welcomed) return {id:'welcome',title:t('Learn by running a quarter'),body:t('Keep four national meters above zero and risk away from midnight. You can take your time; the clock estimates risk.'),target:null,ack:'welcome'};
  if (view.turn>guide.startedTurn) return {id:'finish',title:t('You have completed the quarterly loop'),body:t('Read requests, review responses, issue orders, then advance the quarter. Help can guide you again whenever you need it.'),target:null,ack:'finish'};
  if (route==='agenda') {
    const next = view.inbox.find(c=>c.templateId==='sys:intro') ?? view.inbox[0];
    if (next) return {id:next.kind==='intro'?'open-intro':'open-request',title:next.kind==='intro'?t('Open your welcome briefing'):t('Open the next request'),body:next.kind==='intro'
      ? t('Your first briefing introduces the country and asks you to choose an opening priority.')
      : t('Every remaining briefing needs a response before the quarter can end.'),target:cardSelector(next.uid),cardUid:next.uid};
    return view.canEndTurn ? {id:'end-quarter',title:t('Advance the world'),body:t('Ending the quarter moves the world and pays program upkeep. Unused actions expire; spending them is optional.'),target:'.btn--end'} : null;
  }
  // Do not spotlight controls for a card that was already consumed by a successful choice.
  const current = card && view.inbox.find(c=>c.uid===card.uid);
  if (!current) return null;
  if (route==='brief') return {id:current.kind==='deployment'?'read-evaluation':'review-responses',title:current.kind==='deployment'?t('Read the evaluation and its confidence'):t('Read, then compare'),body:current.kind==='deployment'
    ? t('Company claims are uncertain. You may inspect the company, or review the responses using the evidence you have.')
    : t('Read the request at your own pace. Review responses opens your choices without committing to one.'),target:'[data-review-responses]',cardUid:current.uid};
  if (route==='options') {
    const selected = current.choices.find(c=>c.id===selectedId);
    if (selected && available(selected,view)) return {id:'confirm',title:t('Review, then issue your order'),body:t('Selection is tentative. Check the effects and cost; Issue order makes this response final.'),target:'[data-confirm-choice]',cardUid:current.uid};
    const first = current.choices.findIndex(c=>available(c,view));
    return {id:selected?'unavailable':'choose-response',title:selected?t('Choose an available response'):t('Choose any response'),body:selected
      ? t('That response is unavailable. Its restriction is shown; choose another response to review its effects.')
      : t('You decide the strategy. Select any available response to inspect its effects; nothing is spent yet.'),target:first>=0?`[data-choice="${first+1}"]`:null,cardUid:current.uid};
  }
  return null;
}
