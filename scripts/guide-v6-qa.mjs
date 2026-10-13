/** Guided first-quarter flow. Real UI actions, synthetic browser saves, exact engine oracle. */
import {webkit} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Game} from '../src/engine/game.ts';
import {setLang,loadLangPack} from '../src/i18n/index.ts';
import {localizeContent} from '../src/engine/localize.ts';
const lang=process.argv[2]??'en';setLang(lang,await loadLangPack(lang));localizeContent();
const out=process.env.GUIDE_OUT??`artifacts/guide-v6/${lang}`;fs.mkdirSync(out,{recursive:true});
const base=process.env.DESIGN_URL??'http://127.0.0.1:5183';
const sizes=(process.env.GUIDE_WIDTHS??'844,390,320,568').split(',').map(Number);
const b=await webkit.launch(),results=[];
const comparable=s=>{s=JSON.parse(JSON.stringify(s));delete s.settings;return s};
try{for(const width of sizes){
 const height=({844:390,390:844,320:568,568:320})[width];
 const c=await b.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await c.newPage();p.setDefaultTimeout(6000);
 const r={lang,width,steps:[],errors:[]};p.on('pageerror',e=>r.errors.push(e.message));
 const settle=async()=>{if(await p.locator('.sheet-guard').count())await p.locator('.sheet-guard').waitFor({state:'detached'});await p.waitForTimeout(150)};
 const inset=async()=>p.evaluate(({width})=>{for(const[k,v]of Object.entries({'--safe-l':width===844?'47px':'0px','--safe-r':width===844?'47px':'0px','--safe-t':width===390?'47px':'0px','--safe-b':width===390?'34px':width===844?'21px':'0px'}))document.documentElement.style.setProperty(k,v)},{width});
 const state=async()=>JSON.parse(await p.evaluate(()=>localStorage.getItem('ato.save.v1')));
 const tap=async l=>{await l.waitFor({state:'visible'});await l.evaluate(e=>{for(let a=e.parentElement;a;a=a.parentElement){const q=a.getBoundingClientRect(),r=e.getBoundingClientRect(),s=getComputedStyle(a);if(/auto|scroll/.test(s.overflowY)&&(r.top<q.top||r.bottom>q.bottom))a.scrollTop+=r.top-q.top;if(/auto|scroll/.test(s.overflowX)&&(r.left<q.left||r.right>q.right))a.scrollLeft+=r.left-q.left}});await settle();const g=await l.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,w:r.width,h:r.height,hit:e.contains(document.elementFromPoint(x,y)),text:e.textContent,inert:!!e.closest('[inert]')}});assert(g.w>=40&&g.h>=40&&g.hit&&!g.inert,JSON.stringify(g));await p.touchscreen.tap(g.x,g.y);await settle()};
 const step=async id=>{await p.locator(`[data-guide-step="${id}"]`).waitFor({state:'visible'});await settle();const overlap=await p.evaluate(()=>{const n=document.querySelector('[data-guide-note]')?.getBoundingClientRect(),r=document.querySelector('.guided-coach__ring')?.getBoundingClientRect();return n&&r?Math.max(0,Math.min(n.right,r.right)-Math.max(n.left,r.left))*Math.max(0,Math.min(n.bottom,r.bottom)-Math.max(n.top,r.top)):0});assert(overlap<2,`coach covers target: ${id} ${overlap}`);r.steps.push(id);await p.screenshot({path:`${out}/${width}-${r.steps.length}-${id}.png`})};
 try{
 await p.goto(`${base}/?lang=${lang}`,{waitUntil:'networkidle'});await inset();await tap(p.getByRole('button',{name:lang==='ru'?'Новая игра':'New Game',exact:true}));await tap(p.locator('.newgame-footer>button'));await step('welcome');
 let before=await state();await tap(p.locator('[data-guide-next]'));assert.deepEqual(await state(),before);await step('open-intro');
 for(let i=0;i<8;i++){
  const s=await state();if(!s.inbox.length)break;
  if(await p.locator('[data-agenda]').isVisible()&&!await p.locator('[data-workspace]').count()){const uid=s.inbox.find(c=>c.kind==='intro')?.uid??s.inbox[0].uid;await tap(p.locator(`[data-card="${uid}"]`));}
  const uid=await p.locator('[data-workspace]').getAttribute('data-uid');const card=(await state()).inbox.find(c=>c.uid===uid);
  await step(card.kind==='deployment'?'read-evaluation':'review-responses');before=await state();await tap(p.locator('[data-review-responses]'));assert.deepEqual(await state(),before);await step('choose-response');await tap(p.locator('[data-guide-toggle]'));assert.equal(await p.locator('.guided-coach__copy').isVisible(),false);assert.deepEqual(await state(),before);await tap(p.locator('[data-guide-toggle]'));assert.equal(await p.locator('.guided-coach__copy').isVisible(),true);
  let choices=p.locator('[data-choice][data-blocked=false]');if(width===568 && card.kind==='deployment'){const j=card.choices.findIndex(c=>c.id==='deep_eval');assert(j>=0);await tap(p.locator(`[data-choice="${j+1}"]`));}else await tap(choices.first());await step('confirm');assert.deepEqual(await state(),before);
  const index=Number(await p.locator('[data-choice][aria-checked=true]').getAttribute('data-choice'))-1;const id=card.choices[index].id;
  // Resume preserves the tentative decision and derives its next guide step from that route.
  if(i===0){await p.reload({waitUntil:'networkidle'});await inset();await tap(p.getByRole('button',{name:lang==='ru'?'Продолжить':'Continue',exact:true}));await step('confirm');assert.deepEqual(await state(),before);await p.setViewportSize({width:height,height:width});await settle();await p.setViewportSize({width,height});await settle();}
  const oracle=new Game(structuredClone(before));assert(oracle.resolveChoice(card.uid,id).ok);await tap(p.locator('[data-confirm-choice]'));await step('result');assert.deepEqual(comparable(await state()),comparable(oracle.state));await tap(p.locator('[data-result-continue]'));
 }
 await step('end-quarter');before=await state();const oracle=new Game(structuredClone(before));oracle.endTurn();await tap(p.locator('.btn--end'));await step('report');assert.deepEqual(comparable(await state()),comparable(oracle.state));
 await p.reload({waitUntil:'networkidle'});await inset();await tap(p.getByRole('button',{name:lang==='ru'?'Продолжить':'Continue',exact:true}));await step('report');await tap(p.locator('[data-report-continue]'));await step('finish');before=await state();await tap(p.locator('[data-guide-next]'));assert.deepEqual(await state(),before);assert.equal(await p.locator('[data-guide-note]').count(),0);
 await tap(p.locator('.command-menu'));await tap(p.locator('[data-start-guide]'));await step('welcome');await tap(p.locator('[data-guide-skip]'));assert.deepEqual(await state(),before);assert.equal(await p.locator('[data-guide-note]').count(),0);
 await tap(p.locator('.command-menu'));await tap(p.getByRole('button',{name:lang==='ru'?'Сохранить и выйти в меню':'Save & quit to title',exact:true}));await tap(p.getByRole('button',{name:lang==='ru'?'Продолжить':'Continue',exact:true}));assert.equal(await p.locator('[data-guide-note]').count(),0,'skipped replay reappeared after Continue');assert.deepEqual(await state(),before);
 if(lang==='en'&&width===844){
  // Replacing a run must not inherit a manually replayed guide with the same identity.
  await tap(p.locator('.command-menu'));await tap(p.locator('[data-start-guide]'));await step('welcome');await tap(p.locator('.command-menu'));
  await p.locator('.save-import input').setInputFiles({name:'synthetic-run.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});await settle();await tap(p.getByRole('button',{name:'Import this run',exact:true}));assert.equal(await p.locator('[data-guide-note]').count(),0);assert.deepEqual(comparable(await state()),comparable(before));
  let pref=await p.evaluate(()=>JSON.parse(localStorage.getItem('ato.guide.v1')));assert.equal(pref.run,null);assert(pref.completedOnce&&pref.skippedOnce);
  await tap(p.locator('.command-menu'));await tap(p.locator('[data-start-guide]'));await step('welcome');await tap(p.locator('.command-menu'));await tap(p.getByRole('button',{name:'Save & quit to title',exact:true}));await tap(p.getByRole('button',{name:'New Game',exact:true}));await tap(p.locator('.newgame-footer>button'));assert.equal(await p.locator('[data-guide-note]').count(),0);pref=await p.evaluate(()=>JSON.parse(localStorage.getItem('ato.guide.v1')));assert.equal(pref.run,null);assert(pref.completedOnce&&pref.skippedOnce);r.replacementChecked=true;
 }
 assert.deepEqual(r.errors,[]);r.ok=true;
 }catch(e){r.ok=false;r.error=String(e);await p.screenshot({path:`${out}/${width}-FAIL.png`});}
 results.push(r);fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(`${r.ok?'PASS':'FAIL'} ${lang} ${width} ${r.error??''}`);await c.close();
}}finally{await b.close()}
assert(results.every(r=>r.ok),'guide flow failed');
