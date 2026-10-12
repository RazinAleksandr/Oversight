/** Task QA for the deployment workspace. Tests visible controls before coordinate taps;
 * Playwright must not silently scroll an offscreen task control into view.
 * Production build required. Fixtures are isolated browser storage, never native saves.
 */
import { webkit } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const base = process.env.IOS_PREVIEW_URL ?? 'http://127.0.0.1:5177';
const out = 'artifacts/ux-pilot';
fs.mkdirSync(out, { recursive: true });
const fixture = JSON.parse(fs.readFileSync('tests/fixtures/ux-pilot-turn6.json', 'utf8'));
const card = fixture.inbox.find(c => c.kind === 'deployment');
const companyId = card.ctx.companyId;
// Serialized cards retain their language. Generate genuine Russian card text, not
// an English save under Russian chrome. All mutations here create isolated QA fixtures.
execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',`
 import fs from 'node:fs';
 const {setLang,loadLangPack}=await import('./src/i18n/index.ts');
 setLang('ru',await loadLangPack('ru'));
 (await import('./src/engine/localize.ts')).localizeContent();
 const {deploymentCard}=await import('./src/engine/systems/deployment.ts');
 const original=JSON.parse(fs.readFileSync('tests/fixtures/ux-pilot-turn6.json','utf8'));
 for(const name of ['main','five','returning']) {
  const s=structuredClone(original),old=s.inbox.find(c=>c.kind==='deployment'),model=s.models.find(m=>m.id===old.ctx.modelId);
  if(name==='five') {const e=JSON.parse(fs.readFileSync('tests/fixtures/ux-pilot-evidence.json','utf8'));s.evidence=[{...e,companyId:model.companyId}];}
  const card=deploymentCard(s,model,name==='returning');card.uid=old.uid;
  s.inbox=s.inbox.map(c=>c.uid===old.uid?card:c);
  fs.writeFileSync('artifacts/ux-pilot/qa-'+name+'-ru-save.json',JSON.stringify(s));
 }
`],{stdio:'pipe'});
const ruFixture=JSON.parse(fs.readFileSync(`${out}/qa-main-ru-save.json`,'utf8'));
const results = [];
const resultPath = `${out}/${process.env.UX_QA_RESULTS ?? 'qa-results.json'}`;
const browser = await webkit.launch();
// Stable task selectors are shared with the workspace; adapt only to its public DOM contract.
const S = {
  workspace: '.deployment-workspace', choices: '[data-choice]', confirm: '[data-confirm-choice]',
  inspect: '[data-workspace-inspect], [data-inspect-company]',
  authorize: '[data-confirm-investigation]', return: '[data-return-decision]',
};
const ready = async p => {
  if (await p.locator('.sheet-guard').count()) await p.locator('.sheet-guard').waitFor({ state: 'detached' });
  await p.waitForTimeout(100);
};
async function visibleGeometry(locator) {
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    let left = Math.max(0, r.left), right = Math.min(innerWidth, r.right);
    let top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
    const clipping = [];
    for (let a = el.parentElement; a; a = a.parentElement) {
      const s = getComputedStyle(a), q = a.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { left = Math.max(left,q.left); right = Math.min(right,q.right); }
      if (/(auto|scroll|hidden|clip)/.test(s.overflowY)) { top = Math.max(top,q.top); bottom = Math.min(bottom,q.bottom); }
      if (q.top > r.top || q.bottom < r.bottom) clipping.push({ class: a.className, top:q.top,bottom:q.bottom });
    }
    const x = (left + right)/2, y = (top + bottom)/2;
    const hit = document.elementFromPoint(x,y);
    return { text: el.textContent, x:r.x,y:r.y,width:r.width,height:r.height,
      visibleWidth:Math.max(0,right-left),visibleHeight:Math.max(0,bottom-top),
      hit:!!hit && (el===hit || el.contains(hit)),center:{x,y},clipping };
  });
}
async function visibleTap(p, locator, label) {
  const g = await visibleGeometry(locator);
  assert(g.width >= 40 && g.height >= 40, `${label}: touch target ${g.width}×${g.height}`);
  assert(g.visibleWidth >= g.width-1 && g.visibleHeight >= g.height-1, `${label}: clipped ${JSON.stringify(g)}`);
  assert(g.hit, `${label}: another surface intercepts input`);
  await p.touchscreen.tap(g.center.x,g.center.y);
  await ready(p);
  return g;
}
async function choiceGeometry(p, expected = card.choices.length) {
  const rows = [];
  for (const x of await p.locator(S.choices).all()) {
    const g = await visibleGeometry(x);
    if(p.viewportSize().width>=760) assert(g.hit && g.visibleHeight >= g.height-1 && g.visibleWidth >= g.width-1, `choice is not fully available: ${JSON.stringify(g)}`);
    const overflow=await x.evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('.workspace-choice-label,.workspace-choice-summary,.workspace-choice-cost')].map(e=>({text:e.textContent,r:e.getBoundingClientRect()})).filter(({r:q})=>q.top<r.top-1||q.bottom>r.bottom+1||q.left<r.left-1||q.right>r.right+1).map(({text,r:q})=>({text,top:q.top,bottom:q.bottom,parentTop:r.top,parentBottom:r.bottom}));});
    assert.deepEqual(overflow,[],`choice content overlaps neighboring rows: ${JSON.stringify(overflow)}`);
    rows.push(g);
  }
  assert.equal(rows.length,expected);
  return rows;
}
const state = p => p.evaluate(() => JSON.parse(localStorage.getItem('ato.save.v1')));
async function load(p, lang, saved = lang==='ru'?ruFixture:fixture) {
  await p.goto(`${base}/?lang=${lang}`, { waitUntil:'networkidle' });
  await p.evaluate(s => { localStorage.clear();localStorage.setItem('ato.save.v1',JSON.stringify(s)); },saved);
  await p.reload({ waitUntil:'networkidle' });
  const continueButton=p.getByRole('button',{name:lang==='en'?'Continue':'Продолжить',exact:true});
  await continueButton.scrollIntoViewIfNeeded(); // Initial title is outside pilot scope; known short-landscape scroll.
  await visibleTap(p,continueButton,'continue');
  const taskCard=saved.inbox.find(c=>c.kind==='deployment');
  const tile = p.locator(`[data-card="${taskCard.uid}"]`);
  // Finding the initial inbox card may require browsing the inbox; record this explicitly.
  // Task controls inside the workspace below never get implicit scrolling.
  await tile.scrollIntoViewIfNeeded();
  await visibleTap(p,tile,'open deployment');
  await p.locator(S.workspace).waitFor();
}
async function prepareChoice(p,index) {
  const option=p.locator(S.choices).nth(index);
  if(p.viewportSize().width<760) await option.evaluate(e=>{const list=e.closest('.workspace-choice-list'),r=e.getBoundingClientRect(),v=list.getBoundingClientRect();if(r.top<v.top||r.bottom>v.bottom)list.scrollTop+=r.top-v.top;});
  await ready(p);return option;
}
async function showOptions(p) {
  const mode=p.locator('[data-workspace-mode=options]');
  if(await mode.isVisible()) await visibleTap(p,mode,'open choices pane');
}
async function showBrief(p) {
  const mode=p.locator('[data-workspace-mode=brief]');
  if(await mode.isVisible()) await visibleTap(p,mode,'open briefing pane');
}
async function capture(p,name) {await ready(p);await p.screenshot({path:`${out}/qa-${name}.png`});}
function stable(a,b,label) {
  assert.equal(a.length,b.length);
  a.forEach((g,i)=>assert(Math.abs(g.y-b[i].y)<=1 && Math.abs(g.x-b[i].x)<=1,`${label}: choice${i+1} moved from${g.x},${g.y} to${b[i].x},${b[i].y}`));
}
try {
 for (const lang of (process.env.UX_QA_SKIP_MATRIX ? [] : (process.env.UX_QA_LANGS ?? 'en,ru').split(','))) for (const [width,height] of [[844,390],[667,375],[390,844],[320,568]].filter(([w])=>!process.env.UX_QA_WIDTHS||process.env.UX_QA_WIDTHS.split(',').includes(String(w)))) {
  const c = await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const p = await c.newPage();p.setDefaultTimeout(6000);const errors=[];p.on('pageerror',e=>errors.push(String(e)));
  const result={lang,width,height,checks:[],errors};
  try {
   await load(p,lang);await capture(p,`${lang}-${width}-initial`);
   await showOptions(p);
   const before=await state(p);await choiceGeometry(p);
   for(let i=0;i<4;i++) {
    const option=await prepareChoice(p,i), preSelection=await choiceGeometry(p);
    await visibleTap(p,option,`choose${i+1}`);
    stable(preSelection,await choiceGeometry(p),'selecting alternative');
    assert.deepEqual(await state(p),before,'tentative selection mutated engine save');
   }
   await visibleTap(p,await prepareChoice(p,1),'select limited release');
   result.checks.push(width<760?'bounded compact options scroll; selecting does not scroll or move controls; no spend':'all choices stay visible and stable while selected; selection does not spend');
   await capture(p,`${lang}-${width}-selected`);
   await showBrief(p);
   await visibleTap(p,p.locator('[data-workspace-reader=evidence]'),'read evidence');
   await p.locator('.workspace-reader-scroll').evaluate(e=>{e.scrollTop=80;});await ready(p);
   const readingScroll=await p.locator('.workspace-reader-scroll').evaluate(e=>e.scrollTop);
   await visibleTap(p,p.locator(S.inspect),'inspect company');
   await capture(p,`${lang}-${width}-company`);
   await visibleTap(p,p.locator(S.return),'cancel inspection');
   assert.deepEqual(await state(p),before,'inspection cancel spent resources');
   assert.equal(await p.locator(`${S.choices}[aria-checked=true]`).getAttribute('data-choice'),'2','cancel lost tentative choice');
   assert.equal(await p.locator('[data-workspace-reader=evidence]').getAttribute('aria-pressed'),'true','cancel lost evidence reading section');
   assert(Math.abs(await p.locator('.workspace-reader-scroll').evaluate(e=>e.scrollTop)-readingScroll)<=1,'cancel lost reading position');
   await visibleTap(p,p.locator(S.inspect),'reopen company');
   await visibleTap(p,p.locator(S.authorize),'authorize investigation');
   const after=await state(p);
   assert.equal(after.capacity,before.capacity-1,'investigation costs exactly one action');
   assert.equal(after.budget,before.budget,'company investigation must not cost cash');
   const target=after.companies.find(x=>x.id===companyId), old=before.companies.find(x=>x.id===companyId);
   assert.equal(target.intel,1);assert.equal(target.lastInvestigatedTurn,after.turn);
   assert.equal(target.relation,old.relation-3);
   assert.deepEqual(after.models,before.models,'company investigation must not silently reevaluate models');
   assert.deepEqual(after.inbox.find(x=>x.uid===card.uid).evidence,before.inbox.find(x=>x.uid===card.uid).evidence,'original evaluation record changed');
   assert.deepEqual(after.companies.filter(x=>x.id!==companyId),before.companies.filter(x=>x.id!==companyId),'wrong company changed');
   await capture(p,`${lang}-${width}-investigated`);
   await visibleTap(p,p.locator(S.return),'return to decision');
   assert.equal(await p.locator(`${S.choices}[aria-checked=true]`).getAttribute('data-choice'),'2','return lost tentative choice');
   await showOptions(p);await choiceGeometry(p);
   const resourceBox=await visibleGeometry(p.locator('.workspace-resources'));
   assert(resourceBox.visibleHeight>0 && resourceBox.height>0,'available resources hidden on return');
   assert.match(await p.locator('.workspace-resources').innerText(),/2 (?:action|действ)/,'remaining action count missing');
   result.checks.push('company action targets correct company, spends once, return preserves selection');
   await capture(p,`${lang}-${width}-returned`);
   await p.setViewportSize({width:height,height:width});await ready(p);
   assert.equal(await p.locator(`${S.choices}[aria-checked=true]`).getAttribute('data-choice'),'2','rotation lost tentative choice');
   await p.setViewportSize({width,height});await ready(p);
   await p.reload({waitUntil:'networkidle'});
   if(await p.getByRole('button',{name:lang==='en'?'Continue':'Продолжить',exact:true}).count()) {const resume=p.getByRole('button',{name:lang==='en'?'Continue':'Продолжить',exact:true});await resume.scrollIntoViewIfNeeded();await visibleTap(p,resume,'resume draft');}
   await p.locator(S.workspace).waitFor();
   assert.equal(await p.locator(`${S.choices}[aria-checked=true]`).getAttribute('data-choice'),'2','reload lost tentative choice');
   result.checks.push('rotation and reload preserve selected case');
   // Emulated CSS insets test content geometry only, not UIKit or physical reach.
   await p.evaluate(({width})=>{const s=document.documentElement.style;s.setProperty('--safe-t',width<600?'47px':'0px');s.setProperty('--safe-b',width<600?'34px':'21px');s.setProperty('--safe-l',width<600?'0px':'47px');s.setProperty('--safe-r',width<600?'0px':'47px');},{width});
   await ready(p);await showOptions(p);await choiceGeometry(p);const confirm=await visibleGeometry(p.locator(S.confirm));assert(confirm.hit&&confirm.visibleHeight>=confirm.height-1,'safe-area confirm clipped');await capture(p,`${lang}-${width}-safe-area`);
   const preConfirm=await state(p);
   const point=confirm.center;
   await p.touchscreen.tap(point.x,point.y);await p.touchscreen.tap(point.x,point.y);await ready(p);
   const committed=await state(p);
   assert.equal(committed.inbox.filter(x=>x.uid===card.uid).length,0,'decision did not resolve');
   assert.equal(committed.models.find(x=>x.id===card.ctx.modelId).status,'limited');
   assert.equal(committed.capacity,preConfirm.capacity,'free limited choice unexpectedly spent capacity');
   assert.equal(committed.budget,preConfirm.budget,'free limited choice unexpectedly spent cash');
   assert.equal(committed.companies.find(x=>x.id===companyId).relation,preConfirm.companies.find(x=>x.id===companyId).relation+3,'confirmation ran more than once');
   result.checks.push('safe-area geometry; double tap resolves exactly one selected choice');
   await capture(p,`${lang}-${width}-confirmed`);
   assert.deepEqual(errors,[]);result.ok=true;
  } catch(e) { result.ok=false;result.failure=String(e);await capture(p,`${lang}-${width}-failure`); }
  results.push(result);fs.writeFileSync(resultPath,JSON.stringify(results,null,2));await c.close();
 }
 for(const scenario of (process.env.UX_QA_SKIP_EXTRAS ? [] : (process.env.UX_QA_SCENARIOS ?? 'last-action,low-cash,five,returning,larger-text,interruption').split(','))) {
  const c=await browser.newContext({viewport:{width:667,height:375},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const p=await c.newPage();p.setDefaultTimeout(6000);const result={scenario,lang:'ru',width:667,height:375,checks:[]};
  try {
   let saved=structuredClone(ruFixture);
   if(scenario==='last-action') saved.capacity=1;
   if(scenario==='low-cash') saved.budget=1;
   if(['five','returning'].includes(scenario)) saved=JSON.parse(fs.readFileSync(`${out}/qa-${scenario}-ru-save.json`,'utf8'));
   await load(p,'ru',saved);await showOptions(p);
   if(scenario==='last-action') {
    await visibleTap(p,await prepareChoice(p,2),'select evaluation');
    assert.equal(await p.locator(S.confirm).isDisabled(),false);
    await showBrief(p);await visibleTap(p,p.locator(S.inspect),'inspect');
    await visibleTap(p,p.locator(S.authorize),'spend final action');
    await visibleTap(p,p.locator(S.return),'return with no actions');await showOptions(p);
    assert.equal(await p.locator(`${S.choices}[aria-checked=true]`).getAttribute('data-choice'),'3');
    assert.equal(await p.locator(S.confirm).isDisabled(),true,'evaluation must become unavailable after final action');
    const snapshot=await state(p),g=await visibleGeometry(p.locator(S.confirm));await p.touchscreen.tap(g.center.x,g.center.y);await ready(p);
    assert.deepEqual(await state(p),snapshot,'disabled confirmation spent');result.checks.push('final action revalidates existing choice without clearing selection');
   } else if(scenario==='low-cash') {
    await visibleTap(p,await prepareChoice(p,2),'select unaffordable evaluation');
    assert.equal(await p.locator(S.confirm).isDisabled(),true);
    assert.match(await p.locator('.workspace-footer-note').innerText(),/1/);
    assert.deepEqual(await state(p),saved);result.checks.push('exact cash shortfall blocks evaluation');
   } else if(scenario==='interruption') {
    await visibleTap(p,await prepareChoice(p,1),'select before interruption');await showBrief(p);
    await visibleTap(p,p.locator(S.inspect),'open company before interruption');
    const resume=async()=>{await p.reload({waitUntil:'networkidle'});const button=p.getByRole('button',{name:'Продолжить',exact:true});if(await button.count()){await button.scrollIntoViewIfNeeded();await visibleTap(p,button,'resume interrupted task');}};
    await resume();assert.equal(await p.locator('[data-company-inspector]').count(),1,'inspector route lost after reload');
    assert.equal((await state(p)).capacity,saved.capacity,'resume spent action');
    await visibleTap(p,p.locator(S.authorize),'investigate before interruption');
    await resume();assert.equal(await p.locator('[data-inspection-result]').count(),1,'pending investigation result lost');
    assert.equal((await state(p)).capacity,saved.capacity-1,'result resume repeated spending');
    await visibleTap(p,p.locator(S.return),'return from resumed result');
    assert.equal(await p.locator(`${S.choices}[aria-checked=true]`).getAttribute('data-choice'),'2');
    result.checks.push('inspector and pending investigation outcome survive reload without repeated action');
   } else if(scenario==='larger-text') {
    // Deliberate 125% text-only stress, not a claim of native Dynamic Type support.
    await p.evaluate(()=>{const sizes=[...document.querySelectorAll('.deployment-workspace button, .deployment-workspace p, .deployment-workspace span, .deployment-workspace strong, .deployment-workspace h2')].map(e=>[e,getComputedStyle(e).fontSize]);for(const[e,size]of sizes)e.style.fontSize=`${parseFloat(size)*1.25}px`;});
    await ready(p);await choiceGeometry(p);
    const overflowing=await p.locator('.workspace-choice-label').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1).map(e=>e.textContent));
    assert.deepEqual(overflowing,[],'125% choice text is clipped');result.checks.push('125% text-only choice visibility');
   } else {
    const count=saved.inbox.find(c=>c.kind==='deployment').choices.length;
    assert.equal(await p.locator(S.choices).count(),count);await choiceGeometry(p,count);
    // Five alternatives can extend the bounded choice list; scroll it deliberately, never the whole task.
    for(let i=0;i<count;i++) {
     const choice=p.locator(S.choices).nth(i);
     await p.locator('.workspace-choice-list').evaluate((e,i)=>{const target=e.querySelectorAll('[data-choice]')[i];e.scrollTop=target.offsetTop-e.offsetTop;},i);
     await ready(p);await visibleTap(p,choice,`inspect choice${i+1}`);
    }
    result.checks.push(`${count} actual engine choices reachable within choice pane`);
   }
   await capture(p,`extra-${scenario}`);result.ok=true;
  } catch(e){result.ok=false;result.failure=String(e);await capture(p,`extra-${scenario}-failure`);}
  results.push(result);fs.writeFileSync(resultPath,JSON.stringify(results,null,2));await c.close();
 }
} finally {await browser.close();}
console.log(JSON.stringify(results,null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
