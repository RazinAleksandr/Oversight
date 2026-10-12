/** Synthetic, reproducible QA states. Never reads native or user saves.
 * Run once per locale: node --import tsx scripts/full-redesign-fixtures.ts en|ru
 * Uses production card constructors so long localized copy is representative.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { setLang, loadLangPack } from '../src/i18n/index';
import { localizeContent } from '../src/engine/localize';
import { newGame, Game } from '../src/engine/game';
import { seedState } from '../src/engine/rng';
import { introCard } from '../src/engine/systems/intro';
import { deploymentCard, releaseModel } from '../src/engine/systems/deployment';
import { createDemand, demandCard, electionCard, lastChanceCard, resolveDemandCard } from '../src/engine/systems/government';
import { spawnSituation, situationCard } from '../src/engine/systems/situations';
import { thresholdCard } from '../src/engine/systems/threshold';
import { worldCard } from '../src/engine/systems/worldCards';
import type { Card, CardKind, GameState } from '../src/engine/types';
const lang = process.argv[2] === 'ru' ? 'ru' : 'en';
setLang(lang, await loadLangPack(lang));localizeContent();
const out='artifacts/full-redesign/fixtures';fs.mkdirSync(out,{recursive:true});
const initial=newGame({countryId:'commonwealth',difficulty:'director',seed:20261013}).state;
function base(): GameState {
 const s=structuredClone(initial);s.turn=6;s.budget=48;s.capacity=3;s.inbox=[];s.tipBacklog=[];s.pendingTips=[];s.unlockedTabs=['inbox','labs','nation','world','threats'];
 return s;
}
const entries: {name:string;kind?:CardKind;uid?:string;choiceId?:string;save:string;expected?:string}[]=[];
function save(name:string,s:GameState,card?:Card, preferred?:string) {
 if(card)s.inbox=[card];
 const path=`${out}/${lang}-${name}.json`;fs.writeFileSync(path,JSON.stringify(s));
 const entry:{name:string;kind?:CardKind;uid?:string;choiceId?:string;save:string;expected?:string}={name,save:path};
 if(card) {
  entry.kind=card.kind;entry.uid=card.uid;
  const choice=card.choices.find(c=>c.id===preferred&&!c.disabled)??card.choices.find(c=>!c.disabled);assert(choice);
  const game=new Game(structuredClone(s));const result=game.resolveChoice(card.uid,choice.id);assert(result.ok,`${name}: ${result.error}`);
  entry.choiceId=choice.id;entry.expected=`${out}/${lang}-${name}-expected.json`;fs.writeFileSync(entry.expected,JSON.stringify(game.state));
 }
 entries.push(entry);
}
{const s=base();save('intro',s,introCard(s),'safety');}
{const s=base();const m=releaseModel(s,s.companies[0]);const card=deploymentCard(s,m,false);save('deployment',s,card,'limited');const g=new Game(structuredClone(s));assert(g.performAction('investigate_company',m.companyId).ok);const investigated=structuredClone(g.state);const intended=entries.find(e=>e.name==='deployment')!.choiceId!;assert(g.resolveChoice(card.uid,intended).ok);fs.writeFileSync(`${out}/${lang}-deployment-inspection-oracle.json`,JSON.stringify({investigated,decided:g.state}));}
{const s=base();const d=createDemand(s);assert(d);save('demand',s,demandCard(s,d),'comply');}
{let made=false;for(let i=0;i<40&&!made;i++){const s=base();const d=createDemand(s);assert(d);const card=demandCard(s,d);s.rng=seedState(20261013+i);const r=resolveDemandCard(s,card,'counter');if(r.newCard){save('negotiation',s,r.newCard,'comply');made=true;}}assert(made,'failed to generate negotiation');}
{const s=base();const x=spawnSituation(s,'infrastructure_failure',{detected:true,severity:55,companyId:s.companies[0].id,sector:'infrastructure'});save('situation',s,situationCard(s,x,'detected'),'monitor');}
{const s=base();save('event',s,worldCard(s,{kind:'cyberattack',rivalId:s.rivals[0].id,sector:'business',damage:10})!,'recover');}
{const s=base();save('breakthrough',s,worldCard(s,{kind:'rival_overtakes',rivalId:s.rivals[0].id})!,'talks');}
{const s=base();s.accord.progress=100;s.rivals.forEach(r=>r.trust=75);save('treaty',s,worldCard(s,{kind:'accord_ready'})!,'sign');}
{const s=base();save('election',s,electionCard(s,'election'),'neutral');}
{const s=base();save('last_chance',s,lastChanceCard(s));}
{const s=base();s.companies[0].capability=9;save('threshold',s,thresholdCard(s),'pause');}
{const s=base();s.government.stance='hawk';let d=createDemand(s);for(let i=0;i<30&&d?.kind!=='defense_program';i++){s.demands=[];d=createDemand(s);}assert(d?.kind==='defense_program');d.status='active';const m=releaseModel(s,s.companies[0]);s.inbox=[deploymentCard(s,m,false)];spawnSituation(s,'infrastructure_failure',{detected:true,severity:55,companyId:s.companies[0].id,sector:'infrastructure'});save('management',s);
 const g=new Game(structuredClone(s));const checks:any={program:'defense',level:2,targetThreat:s.situations.find(x=>x.detected&&!x.resolved)!.id};
 assert(g.setProgramLevel('defense',2).ok);checks.funded=structuredClone(g.state);
 assert(g.performAction('situation_response',checks.targetThreat,'investigate').ok);checks.investigated=structuredClone(g.state);
 const a=g.getActions().find(a=>a.id==='diplomatic_initiative')!;checks.diplomacyAction=a;checks.targetRival=a.targets!.find(t=>!t.disabled)!.id;checks.option=a.options?.find(o=>!o.disabled)?.id;
 assert(g.performAction('diplomatic_initiative',checks.targetRival,checks.option).ok);checks.diplomacy=structuredClone(g.state);
 fs.writeFileSync(`${out}/${lang}-management-oracles.json`,JSON.stringify(checks));}

{const s=base();save('quarter',s);const g=new Game(structuredClone(s));const report=g.endTurn();fs.writeFileSync(`${out}/${lang}-quarter-oracle.json`,JSON.stringify({state:g.state,report}));}
save('run-start',structuredClone(initial));
fs.writeFileSync(`${out}/${lang}-manifest.json`,JSON.stringify(entries,null,2));console.log(`${lang}: ${entries.length} fixtures generated`);
