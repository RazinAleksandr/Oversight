import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame } from '../src/engine/game';
import { clearActiveGuide, deriveGuide, GUIDE_KEY, readGuide, shouldOfferGuide, startGuide, validateGuide, writeGuide } from '../src/ui/game/playGuide';

const prefs = vi.hoisted(()=>new Map<string,string>());
vi.mock('../src/platform/storage',()=>({readPreference:(key:string)=>prefs.get(key)??null,writePreference:(key:string,value:string)=>{prefs.set(key,value);}}));
beforeEach(()=>prefs.clear());
function fixture() {
  const game=newGame({countryId:'commonwealth',difficulty:'director',seed:20261013});
  const guide={...startGuide(game.view()),welcomed:true};
  return {game,guide};
}
describe('real-action play guidance',()=>{
  it('binds to the real welcome card and follows tentative selection without mutating the game',()=>{
    const {game,guide}=fixture();const view=game.view();const before=game.serialize();
    const intro=view.inbox.find(c=>c.templateId==='sys:intro')!;
    expect(deriveGuide({view,guide,route:'agenda'})?.cardUid).toBe(intro.uid);
    expect(deriveGuide({view,guide,route:'brief',card:intro})?.target).toBe('[data-review-responses]');
    expect(deriveGuide({view,guide,route:'options',card:intro})?.id).toBe('choose-response');
    for(const choice of intro.choices)expect(deriveGuide({view,guide,route:'options',card:intro,selectedId:choice.id})?.id).toBe('confirm');
    expect(game.serialize()).toBe(before);
  });
  it.each(['approve','limited','reject','deep_eval'])('accepts %s as a real answer without forcing another deployment choice',choice=>{
    const {game,guide}=fixture();let view=game.view();
    const intro=view.inbox.find(c=>c.kind==='intro')!;
    expect(game.resolveChoice(intro.uid,'growth').ok).toBe(true);
    const card=game.view().inbox.find(c=>c.kind==='deployment')!;
    expect(game.resolveChoice(card.uid,choice).ok).toBe(true);
    view=game.view();
    expect(deriveGuide({view,guide,route:'brief',card})).toBeNull();
    expect(deriveGuide({view,guide:{...guide,lastDecisionKind:'deployment'},route:'result'})?.id).toBe('result');
    expect(view.canEndTurn).toBe(true);
    expect(deriveGuide({view,guide,route:'agenda'})?.id).toBe('end-quarter');
    expect(game.view().nation.capacity).toBeGreaterThan(0); // unused actions never trap the guide
    game.endTurn();view=game.view();
    expect(deriveGuide({view,guide,route:'report'})?.id).toBe('report');
    expect(deriveGuide({view,guide,route:'agenda'})?.ack).toBe('finish');
  });
  it.each(['capacity','budget','evidence','disabled'])('does not spotlight confirmation for a %s-blocked selection',resource=>{
    const {game,guide}=fixture();const view=structuredClone(game.view());const card=view.inbox.find(c=>c.kind==='deployment')!;
    const selected=card.choices.find(c=>c.id==='deep_eval')!;
    if(resource==='capacity')view.nation.capacity=0;
    if(resource==='budget')view.nation.budget=0;
    if(resource==='evidence'){selected.cost={evidence:1};view.nation.evidence=[];}
    if(resource==='disabled')selected.disabled='Unavailable in this context';
    const step=deriveGuide({view,guide,route:'options',card,selectedId:selected.id});
    expect(step?.id).toBe('unavailable');expect(step?.target).not.toBe('[data-confirm-choice]');
    expect(step?.target).toMatch(/^\[data-choice=/);
  });
  it('pauses for exploration/modals and recovers the current task after reloading',()=>{
    const {game,guide}=fixture();const view=game.view();const card=view.inbox[0];const before=game.serialize();
    writeGuide(guide);const loaded=readGuide(view)!;
    expect(loaded).toEqual(guide);
    expect(deriveGuide({view,guide:loaded,route:'other'})).toBeNull();
    expect(deriveGuide({view,guide:loaded,route:'options',card,suspended:true})).toBeNull();
    expect(deriveGuide({view,guide:loaded,route:'options',card,selectedId:card.choices[2].id})?.id).toBe('confirm');
    expect(game.serialize()).toBe(before);
  });
  it('uses restored results and reports before welcome/finish acknowledgements',()=>{
    const {game}=fixture();const guide=startGuide(game.view());
    expect(deriveGuide({view:game.view(),guide,route:'result'})?.id).toBe('result');
    expect(deriveGuide({view:game.view(),guide,route:'report'})?.id).toBe('report');
    expect(deriveGuide({view:game.view(),guide,route:'agenda'})?.ack).toBe('welcome');
  });
});
describe('guide preference recovery and replay',()=>{
  it.each(['first-time','skipped','completed'] as const)('clears same-seed replay state on run replacement while preserving %s history',history=>{
    const {game,guide}=fixture();const before=game.serialize();
    if(history==='skipped')writeGuide(null);
    if(history==='completed')writeGuide({...guide,completed:true});
    writeGuide({...guide,lastDecisionKind:'deployment'});
    const previous=JSON.parse(prefs.get(GUIDE_KEY)!);
    clearActiveGuide();
    const replacement=newGame({countryId:'commonwealth',difficulty:'director',seed:guide.seed});
    expect(readGuide(replacement.view())).toBeNull();
    expect(JSON.parse(prefs.get(GUIDE_KEY)!)).toEqual({...previous,run:null});
    expect(shouldOfferGuide()).toBe(history==='first-time');
    expect(game.serialize()).toBe(before);
  });
  it('remembers skip/completion globally while allowing an explicit current-run replay',()=>{
    const {game,guide}=fixture();const before=game.serialize();
    expect(shouldOfferGuide()).toBe(true);writeGuide(guide);expect(shouldOfferGuide()).toBe(true);
    writeGuide(null);expect(shouldOfferGuide()).toBe(false);expect(readGuide(game.view())).toBeNull();
    writeGuide(startGuide(game.view()));expect(readGuide(game.view())?.welcomed).toBe(false);expect(shouldOfferGuide()).toBe(false);
    writeGuide({...guide,completed:true});expect(readGuide(game.view())).toBeNull();
    writeGuide(startGuide(game.view()));expect(shouldOfferGuide()).toBe(false);
    expect(game.serialize()).toBe(before);
  });
  it('rejects stale run identity, future-start progress, malformed preferences, and completed runs',()=>{
    const {game,guide}=fixture();const view=game.view();
    expect(validateGuide({...guide,seed:guide.seed+1},view)).toBeNull();
    expect(validateGuide({...guide,countryId:'meridian'},view)).toBeNull();
    expect(validateGuide({...guide,startedTurn:view.turn+1},view)).toBeNull();
    expect(validateGuide({...guide,lastDecisionKind:'bogus'},view)).toBeNull();
    expect(validateGuide(guide,{...view,gameOver:true})).toBeNull();
    prefs.set(GUIDE_KEY,'invalid JSON');expect(readGuide(view)).toBeNull();expect(shouldOfferGuide()).toBe(true);
  });
  it('starts replay from the current quarter and does not require vanished intro cards',()=>{
    const {game}=fixture();for(const c of [...game.view().inbox])expect(game.resolveChoice(c.uid,c.kind==='intro'?'safety':'reject').ok).toBe(true);
    game.endTurn();const view=game.view();const guide={...startGuide(view),welcomed:true};
    expect(guide.startedTurn).toBe(view.turn);
    const step=deriveGuide({view,guide,route:'agenda'});
    if(view.inbox.length){expect(step?.id).toBe('open-request');expect(view.inbox.some(c=>c.uid===step?.cardUid)).toBe(true);}
    else expect(step?.id).toBe('end-quarter');
  });
});
