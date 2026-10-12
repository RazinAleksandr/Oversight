/** Production WebKit task QA. No browser dev hooks and no native/user save reads.
 * IOS_PREVIEW_URL=http://127.0.0.1:5177 node scripts/full-redesign-qa.mjs
 * FULL_QA_LANGS=en FULL_QA_WIDTHS=844 FULL_QA_KINDS=deployment for targeted reruns.
 */
import {webkit} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const base=process.env.IOS_PREVIEW_URL??'http://127.0.0.1:5177';
const out=process.env.FULL_QA_OUT??'artifacts/full-redesign';fs.mkdirSync(out,{recursive:true});
const langs=(process.env.FULL_QA_LANGS??'en,ru').split(',');
for(const lang of langs)execFileSync(process.execPath,['--import','tsx','scripts/full-redesign-fixtures.ts',lang],{stdio:'inherit'});
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const results=[];const browser=await webkit.launch();
const settle=async p=>{if(await p.locator('.sheet-guard').count())await p.locator('.sheet-guard').waitFor({state:'detached'});await p.waitForTimeout(90);};
async function geometry(locator){return locator.evaluate(el=>{const r=el.getBoundingClientRect();let l=Math.max(0,r.left),t=Math.max(0,r.top),b=Math.min(innerHeight,r.bottom),v=Math.min(innerWidth,r.right);for(let a=el.parentElement;a;a=a.parentElement){const c=getComputedStyle(a),q=a.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(c.overflowX)){l=Math.max(l,q.left);v=Math.min(v,q.right)}if(/auto|scroll|hidden|clip/.test(c.overflowY)){t=Math.max(t,q.top);b=Math.min(b,q.bottom)}}const x=(l+v)/2,y=(t+b)/2,hit=document.elementFromPoint(x,y);return{x:r.x,y:r.y,width:r.width,height:r.height,visibleWidth:Math.max(0,v-l),visibleHeight:Math.max(0,b-t),hit:!!hit&&(hit===el||el.contains(hit)),tap:{x,y}};});}
async function tap(p,l,label){const g=await geometry(l);assert(g.width>=40&&g.height>=40,`${label}: small target ${JSON.stringify(g)}`);assert(g.visibleWidth>=g.width-1&&g.visibleHeight>=g.height-1,`${label}: clipped ${JSON.stringify(g)}`);assert(g.hit,`${label}: intercepted`);await p.touchscreen.tap(g.tap.x,g.tap.y);await settle(p);return g;}
// Explicitly browse an intentional scroll region, recording it. Never use locator.click auto-scroll.
async function browse(p,l,log,label){const g=await geometry(l);if(g.visibleWidth>=g.width-1&&g.visibleHeight>=g.height-1&&g.hit)return;const moved=await l.evaluate(el=>{const moves=[];for(let a=el.parentElement;a;a=a.parentElement){const c=getComputedStyle(a);if(!/(auto|scroll)/.test(c.overflowY)||a.scrollHeight<=a.clientHeight)continue;const r=el.getBoundingClientRect(),q=a.getBoundingClientRect(),old=a.scrollTop;if(r.top<q.top||r.bottom>q.bottom)a.scrollTop+=r.top-q.top; if(a.scrollTop!==old)moves.push({class:a.className,from:old,to:a.scrollTop});}const root=document.scrollingElement;if(root&&root.scrollHeight>innerHeight){const r=el.getBoundingClientRect(),old=root.scrollTop;if(r.top<0||r.bottom>innerHeight)root.scrollTop+=r.top;if(root.scrollTop!==old)moves.push({class:'document',from:old,to:root.scrollTop});}return moves;});log.push({scroll:label,moved});await settle(p);}
async function contained(p){const bad=await p.locator('[data-choice]').evaluateAll(xs=>xs.flatMap(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('.dv4-choice-label,.dv4-choice-summary,.dv4-choice-cost')].filter(e=>{const q=e.getBoundingClientRect();return q.left<r.left-1||q.right>r.right+1||q.top<r.top-1||q.bottom>r.bottom+1}).map(e=>e.textContent)}));assert.deepEqual(bad,[],'choice text escapes its target');}
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('ato.save.v1')));
async function insets(p){await p.evaluate(()=>{const s=document.documentElement.style;s.setProperty('--safe-t','0px');s.setProperty('--safe-l','47px');s.setProperty('--safe-r','47px');s.setProperty('--safe-b','21px');});}
async function load(p,lang,save,log){await p.goto(`${base}/?lang=${lang}`,{waitUntil:'networkidle'});await p.evaluate(s=>{localStorage.clear();localStorage.setItem('ato.save.v1',JSON.stringify(s));},save);await p.reload({waitUntil:'networkidle'});const c=p.getByRole('button',{name:lang==='en'?'Continue':'Продолжить',exact:true});await browse(p,c,log,'title Continue');await tap(p,c,'Continue');await insets(p);await settle(p);}
async function options(p){const x=p.locator('[data-workspace-mode=options]');if(await x.isVisible())await tap(p,x,'Responses');}
function comparable(s){const c=structuredClone(s);delete c.pendingTips;delete c.tipsShown;delete c.tipBacklog;delete c.settings;return c;}
try{
for(const lang of (process.env.FULL_QA_COMPLETE_ONLY?[]:langs))for(const [width,height]of[[844,390],[667,375]].filter(([w])=>!process.env.FULL_QA_WIDTHS||process.env.FULL_QA_WIDTHS.split(',').includes(String(w)))){
 const manifest=read(`artifacts/full-redesign/fixtures/${lang}-manifest.json`);
 for(const item of manifest.filter(x=>x.kind&&(!process.env.FULL_QA_KINDS||process.env.FULL_QA_KINDS.split(',').includes(x.kind))&&(!process.env.FULL_QA_TASKS||process.env.FULL_QA_TASKS.split(',').includes(x.kind)))){
  const result={lang,width,height,task:item.name,steps:[],errors:[]};const c=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>result.errors.push(String(e)));
  try{
   const saved=read(item.save);await load(p,lang,saved,result.steps);const tile=p.locator(`[data-card="${item.uid}"]`);await browse(p,tile,result.steps,'agenda case');await tap(p,tile,'open case');await p.locator(`[data-workspace][data-kind="${item.kind}"]`).waitFor();
   await p.screenshot({path:`${out}/qa-${lang}-${width}-${item.name}-brief.png`});
   const before=await state(p);await options(p);await contained(p);const original=saved.inbox.find(x=>x.uid===item.uid);assert.equal(await p.locator('[data-choice]').count(),original.choices.length);
   const blocked=p.locator('[data-choice][data-blocked=true]').first();if(await blocked.count()){await browse(p,blocked,result.steps,'inspect unavailable response');await tap(p,blocked,'inspect unavailable response');assert(await p.locator('[data-confirm-choice]').isDisabled(),'blocked response can be authorized');assert.deepEqual(await state(p),before,'blocked response spent resources');}
   const idx=original.choices.findIndex(x=>x.id===item.choiceId),choice=p.locator('[data-choice]').nth(idx);await browse(p,choice,result.steps,'choice list');const a=await geometry(choice);await tap(p,choice,'tentative choice');const b=await geometry(choice);assert(Math.abs(a.x-b.x)<=1&&Math.abs(a.y-b.y)<=1,'selecting choice moved its target');assert.deepEqual(await state(p),before,'selection spent resources');await contained(p);
   await p.screenshot({path:`${out}/qa-${lang}-${width}-${item.name}-selected.png`});
   if(item.kind==='deployment'){
    const selected=await choice.getAttribute('data-choice');await p.setViewportSize({width:height,height:width});await settle(p);await p.setViewportSize({width,height});await settle(p);assert.equal(await p.locator('[data-choice][aria-checked=true]').getAttribute('data-choice'),selected,'rotation lost selection');
    const inspect=p.locator('[data-inspect-company]');if(await inspect.isVisible()){await tap(p,inspect,'company record');await tap(p,p.locator('[data-return-decision]'),'cancel company record');assert.deepEqual(await state(p),before,'company record cancel spent resources');assert.equal(await p.locator('[data-choice][aria-checked=true]').getAttribute('data-choice'),selected,'company return lost selection');}
    await p.reload({waitUntil:'networkidle'});const resume=p.getByRole('button',{name:lang==='en'?'Continue':'Продолжить',exact:true});await browse(p,resume,result.steps,'resume selected case');await tap(p,resume,'resume selected case');await insets(p);await p.locator('[data-workspace]').waitFor();assert.equal(await p.locator('[data-choice][aria-checked=true]').getAttribute('data-choice'),selected,'reload lost selection');await options(p);await contained(p);
    await tap(p,p.locator('[data-inspect-company]'),'reopen company record');await tap(p,p.locator('[data-confirm-investigation]'),'investigate company');const inspection=read(`artifacts/full-redesign/fixtures/${lang}-deployment-inspection-oracle.json`);assert.deepEqual(comparable(await state(p)),comparable(inspection.investigated),'company investigation differs from one exact engine action');await p.screenshot({path:`${out}/qa-${lang}-${width}-company-investigation.png`});await tap(p,p.locator('[data-return-decision]'),'return from investigation');assert.equal(await p.locator('[data-choice][aria-checked=true]').getAttribute('data-choice'),selected,'investigation lost selected response');await options(p);
   }

   if(item.kind==='demand'){
    const selected=await choice.getAttribute('data-choice');await tap(p,p.locator('[data-open-management=nation]'),'review demand context');await p.locator('[data-return-task]').waitFor();assert.deepEqual(await state(p),before,'opening service mutated state');
    await p.reload({waitUntil:'networkidle'});const resume=p.getByRole('button',{name:lang==='en'?'Continue':'Продолжить',exact:true});await browse(p,resume,result.steps,'resume service');await tap(p,resume,'resume service');await insets(p);await tap(p,p.locator('[data-return-task]'),'return from management');assert.equal(await p.locator('[data-choice][aria-checked=true]').getAttribute('data-choice'),selected,'management return lost selected demand response');await options(p);result.steps.push('management route survives reload and returns to selected demand response');
   }
   const confirm=p.locator('[data-confirm-choice]');assert.equal(await confirm.isDisabled(),false);const g=await geometry(confirm);await tap(p,confirm,'confirm');await p.touchscreen.tap(g.tap.x,g.tap.y);await settle(p);
   const expected=item.kind==='deployment'?read(`artifacts/full-redesign/fixtures/${lang}-deployment-inspection-oracle.json`).decided:read(item.expected);const actual=expected.gameOver?await p.evaluate(()=>JSON.parse(localStorage.getItem('ato.completed.v1'))):await state(p);
   if(!expected.gameOver)assert.deepEqual(comparable(actual),comparable(expected),'UI resolution differs from one engine resolution');else {const go=p.locator('.result__actions .btn--primary');if(await go.count())await tap(p,go,'see ending');assert(await p.locator('.ending').count(),'terminal choice did not show ending');}
   result.steps.push('briefing visible; choice containment; stable selection without spend; exact single engine resolution');assert.deepEqual(result.errors,[]);
   await p.screenshot({path:`${out}/qa-${lang}-${width}-${item.name}-result.png`});result.ok=true;
  }catch(e){result.ok=false;result.failure=String(e);await p.screenshot({path:`${out}/qa-${lang}-${width}-${item.name}-FAIL.png`});}
  results.push(result);fs.writeFileSync(`${out}/qa-results.json`,JSON.stringify(results,null,2));console.log(`${result.ok?'PASS':'FAIL'} ${lang} ${width} ${item.name}${result.failure?' '+result.failure.slice(0,600):''}`);await c.close();
 }

 if(!process.env.FULL_QA_KINDS)for(const scenario of ['management','quarter'].filter(x=>!process.env.FULL_QA_TASKS||process.env.FULL_QA_TASKS.split(',').includes(x))){
  const result={lang,width,height,task:scenario,steps:[],errors:[]};const c=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>result.errors.push(String(e)));
  const touch=async(selector,label)=>{const l=p.locator(selector);await browse(p,l,result.steps,label);await tap(p,l,label);};
  const check=async expected=>assert.deepEqual(comparable(await state(p)),comparable(expected),'management differs from exact engine outcome');
  const snap=async name=>p.screenshot({path:`${out}/qa-${lang}-${width}-${name}.png`});
  try{
   await load(p,lang,read(`artifacts/full-redesign/fixtures/${lang}-${scenario}.json`),result.steps);await p.locator('[data-agenda]').waitFor();await snap(`${scenario}-agenda`);
   if(scenario==='management'){
    const oracle=read(`artifacts/full-redesign/fixtures/${lang}-management-oracles.json`),before=await state(p);
    for(const tab of ['labs','nation','world','threats','inbox'])await tap(p,p.locator(`[data-tab="${tab}"]`),`navigate ${tab}`);
    await tap(p,p.locator('[data-tab=nation]'),'Nation');await touch('[data-section=government]','Government');assert(await p.locator('.forecast-v4').count(),'active demand forecast absent');const forecastBefore=await p.locator('.forecast-v4').innerText();await snap('demand-forecast');
    await touch('[data-section=programs]','Programs');await touch(`[data-program-select="${oracle.program}"]`,'select program');await touch(`[data-propose-level="${oracle.level}"]`,'propose funding');assert.deepEqual(await state(p),before,'funding preview mutated engine');await touch('[data-apply-funding]','apply funding');await check(oracle.funded);await snap('funded');await touch('[data-section=government]','review updated demand');assert.notEqual(await p.locator('.forecast-v4').innerText(),forecastBefore,'forecast did not react to meeting funding demand');await snap('demand-updated');
    await tap(p,p.locator('[data-tab=threats]'),'Threats');await touch(`[data-threat-select="${oracle.targetThreat}"]`,'select threat');await touch('[data-threat-response=investigate]','review investigation');await snap('threat-confirm');
    const authorize=p.locator('[data-confirm-action],.action-sheet .sheet__actions .btn--primary').first();await browse(p,authorize,result.steps,'authorize threat investigation');await tap(p,authorize,'authorize investigation');await check(oracle.investigated);await snap('threat-result');
    await touch('[data-result-continue],.result__actions .btn--primary','continue result');
    await tap(p,p.locator('[data-tab=world]'),'World');await touch(`[data-rival-select="${oracle.targetRival}"]`,'inspect rival');await snap('rival-record');await touch('[data-world-accord]','Accord overview');await touch(`[data-diplomacy-target="${oracle.targetRival}"]`,'review diplomacy');
    if(oracle.option){const label=oracle.diplomacyAction.options.find(o=>o.id===oracle.option).label;const option=p.getByRole('radio').filter({hasText:label}).first();await browse(p,option,result.steps,'diplomacy option');await tap(p,option,'select diplomacy option');}
    await snap('diplomacy-confirm');const confirm=p.locator('[data-confirm-action],.action-sheet .sheet__actions .btn--primary').first();await browse(p,confirm,result.steps,'authorize diplomacy');await tap(p,confirm,'authorize diplomacy');await check(oracle.diplomacy);await snap('diplomacy-result');
    result.steps.push('all main sections reachable; active demand forecast; staged funding exact outcome; exact threat and diplomacy target/cost');
   }else{
    const before=await state(p);await touch('.btn--end:visible','end quarter');await p.locator('[data-report-continue],.report__actions button').waitFor();const after=await state(p);assert.equal(after.turn,before.turn+1);await check(read(`artifacts/full-redesign/fixtures/${lang}-quarter-oracle.json`).state);await snap('report');for(const [i,name] of [[1,'changes'],[2,'headlines']]){await tap(p,p.locator('.report-command nav button').nth(i),`report ${name}`);await snap(`report-${name}`);}await p.reload({waitUntil:'networkidle'});const resume=p.getByRole('button',{name:lang==='en'?'Continue':'Продолжить',exact:true});await browse(p,resume,result.steps,'resume report');await tap(p,resume,'resume');await insets(p);assert.deepEqual(await state(p),after,'report reload advanced state');await touch('[data-report-continue],.report__actions button','continue quarter');await p.locator('[data-agenda]').waitFor();await snap('next-agenda');result.steps.push('quarter advances once; pending report survives reload; new agenda reachable');
   }
   assert.deepEqual(result.errors,[]);result.ok=true;
  }catch(e){result.ok=false;result.failure=String(e);await snap(`${scenario}-FAIL`);}
  results.push(result);fs.writeFileSync(`${out}/qa-results.json`,JSON.stringify(results,null,2));console.log(`${result.ok?'PASS':'FAIL'} ${lang} ${width} ${scenario}${result.failure?' '+result.failure.slice(0,600):''}`);await c.close();
 }

}

if(process.env.FULL_QA_COMPLETE||process.env.FULL_QA_COMPLETE_ONLY)for(const lang of langs){
 const width=844,height=390,result={lang,width,height,task:'complete-run',steps:[],errors:[]};const c=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>result.errors.push(String(e)));
 const touch=async l=>{await browse(p,l,result.steps,(await l.textContent())?.slice(0,70));await tap(p,l,'complete run control');};
 try{
  await load(p,lang,read(`artifacts/full-redesign/fixtures/${lang}-run-start.json`),result.steps);let reports=0,funded=false;
  for(let i=0;i<260;i++){
   await settle(p);if(await p.locator('.ending').count())break;
   const tip=p.locator('.tip__ok');if(await tip.count()){await touch(tip);continue;}
   const resultButton=p.locator('[data-result-continue],.result__actions .btn--primary');if(await resultButton.count()){await touch(resultButton.first());continue;}
   const report=p.locator('[data-report-continue],.report__actions button');if(await report.count()){reports++;await touch(report.first());continue;}
   if(await p.locator('[data-workspace]').count()){
    await options(p);const s=await state(p),uid=await p.locator('[data-workspace]').getAttribute('data-uid');const title=await p.locator('.dv4-title').first().textContent();
    const choices=p.locator('[data-choice][data-blocked=false]');const labels=await choices.locator('.dv4-choice-label').allTextContents();let index=labels.findIndex(x=>/Safety first|Approve with limits|Release with safeguards|Staged release|Demand international oversight|Sign the Accord|Emergency shutdown|Безопасность прежде всего|Одобрить с ограничениями|Выпустить с мерами|Поэтапный|Подписать Соглашение|Аварийное отключение/.test(x));if(index<0)index=0;assert(await choices.count(),'no enabled choice');await touch(choices.nth(index));result.steps.push({turn:s.turn,title,choice:labels[index]});await tap(p,p.locator('[data-confirm-choice]'),'confirm run choice');continue;
   }
   if(!funded&&reports>=1){await tap(p,p.locator('[data-tab=nation]'),'Nation');const programs=p.locator('[data-section=programs]');await touch(programs);for(const[id,level]of[['safety',2],['oversight',2],['workforce',1],['defense',1]]){await touch(p.locator(`[data-program-select="${id}"]`));await touch(p.locator(`[data-propose-level="${level}"]`));const apply=p.locator('[data-apply-funding]');if(!await apply.isDisabled())await touch(apply);}await tap(p,p.locator('[data-tab=inbox]'),'Desk');funded=true;continue;}
   const card=p.locator('[data-card]');if(await card.count()){await touch(card.first());continue;}
   await touch(p.locator('.btn--end:visible'));
  }
  await p.locator('.ending').waitFor();assert(await p.evaluate(()=>localStorage.getItem('ato.completed.v1')),'missing completed save');assert.equal(await p.evaluate(()=>localStorage.getItem('ato.save.v1')),null);result.reports=reports;const completed=await p.evaluate(()=>JSON.parse(localStorage.getItem('ato.completed.v1')));result.finalTurn=completed.turn;result.endingId=completed.ending?.id;fs.writeFileSync(`${out}/qa-${lang}-completed-state.json`,JSON.stringify(completed));result.title=await p.locator('.ending__title').textContent();await p.screenshot({path:`${out}/qa-${lang}-complete.png`});
  await p.reload({waitUntil:'networkidle'});await touch(p.getByRole('button',{name:lang==='en'?'Last debrief':'Последний разбор',exact:true}));assert.equal(await p.locator('.ending__title').textContent(),result.title);assert.deepEqual(result.errors,[]);result.ok=true;
 }catch(e){result.ok=false;result.failure=String(e);await p.screenshot({path:`${out}/qa-${lang}-complete-FAIL.png`});}
 results.push(result);fs.writeFileSync(`${out}/qa-results.json`,JSON.stringify(results,null,2));console.log(`${result.ok?'PASS':'FAIL'} ${lang} complete${result.failure?' '+result.failure.slice(0,600):''}`);await c.close();
}

}finally{await browser.close();}
assert(results.every(r=>r.ok),`${results.filter(r=>!r.ok).length}/${results.length} tasks failed`);
