/** Production WebKit journey. Start `npm run preview -- --port 5176` first. */
import { webkit } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='artifacts/ios-smoke';fs.mkdirSync(out,{recursive:true});
const browser=await webkit.launch();
const base = process.env.IOS_PREVIEW_URL ?? 'http://127.0.0.1:5176';
const outcomes=[];
try {
for(const lang of ['en','ru']) {
 const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const p=await ctx.newPage();p.setDefaultTimeout(10000);
 const errors=[];p.on('pageerror',e=>errors.push(String(e))); const trace=[];
 await p.goto(`${base}/?lang=${lang}`,{waitUntil:'networkidle'});
 await p.getByRole('button',{name:lang==='en'?/^Daily Run/:/^Партия дня/}).click();await p.locator('[data-country="commonwealth"]').click();await p.locator('.newgame__start button').click();
 let turns=0, prepared=false, restoredChoice=false,restoredReport=false;
 for(let i=0;i<280;i++) {
  await p.waitForTimeout(100);
  if(await p.locator('.ending').count()) break;
  if(await p.locator('.sheet-guard').count()) { await p.locator('.sheet-guard').waitFor({state:'detached'}); }
  if(await p.locator('.result__actions .btn--primary').count()) {
   if(!restoredChoice) {
    const saved=await p.evaluate(()=>[localStorage.getItem('ato.save.v1'),localStorage.getItem('ato.pending.v1')]);
    assert(saved[1]);await p.reload({waitUntil:'networkidle'});await p.getByRole('button',{name:lang==='en'?/^Continue/:/^Продолжить/}).click();await p.locator('.result-sheet').waitFor();
    assert.deepEqual(await p.evaluate(()=>[localStorage.getItem('ato.save.v1'),localStorage.getItem('ato.pending.v1')]),saved);restoredChoice=true;
   }
   await p.locator('.result__actions .btn--primary').click(); continue;
  }
  if(await p.locator('.report__actions button').count()) {
   if(!restoredReport) {
    const saved=await p.evaluate(()=>localStorage.getItem('ato.save.v1'));
    await p.reload({waitUntil:'networkidle'});await p.getByRole('button',{name:lang==='en'?/^Continue/:/^Продолжить/}).click();await p.locator('.report-sheet').waitFor();
    assert.equal(await p.evaluate(()=>localStorage.getItem('ato.save.v1')),saved);restoredReport=true;
   }
   await p.locator('.report__actions button').click();turns++;continue;
  }
  if(await p.locator('.tip__ok').count()){await p.locator('.tip__ok').click();continue;}
  if(await p.locator('[data-choice]').count()) {
   const mode=p.locator('[data-workspace-mode="options"]'); if(await mode.isVisible()) await mode.click();
   const choices=p.locator('[data-choice][data-blocked="false"]'); const labels=await choices.locator('.choice__label, .workspace-choice-label').allTextContents();
   let index=labels.findIndex(x=>/Safety first|Approve with limits|Release with safeguards|Demand international oversight|Sign the Accord|Emergency shutdown|Безопасность прежде всего|Одобрить с ограничениями|Выпустить с мерами|Подписать Соглашение|Аварийное отключение/.test(x));if(index<0)index=0;
   trace.push({turns,title:await p.locator('.dossier__title, .workspace-subject').innerText(),choice:labels[index]});
   await choices.nth(index).click();await p.locator('[data-confirm-choice]').click();continue;
  }
  if(!prepared && turns>=1) {
   await p.locator('#tab-nation').click();await p.locator('[data-section="programs"]').click();
   for(const [idx,level] of [[0,2],[1,2],[3,1],[4,1]]) await p.locator('.stepper').nth(idx).locator('button').nth(level).click();
   await p.locator('#tab-inbox').click();prepared=true;continue;
  }
  if(await p.locator('button[data-card]').count()){await p.locator('button[data-card]').first().click();continue;}
  await p.locator('.btn--end:visible').click();
 }
 await p.locator('.ending').waitFor();
 assert.equal(await p.evaluate(()=>typeof window.__ato),'undefined','release exposes QA hooks');
 const title=await p.locator('.ending__title').innerText();assert.equal(await p.evaluate(()=>localStorage.getItem('ato.save.v1')),null);assert(await p.evaluate(()=>localStorage.getItem('ato.completed.v1')));
 await p.locator('#debrief-section').selectOption('rating');await p.waitForTimeout(1200);await p.locator('.ending__nav').scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/${lang}-ending-rating.png`});
 assert.equal(await p.locator('.scorecard').count(),1);
 for(const value of await p.locator('#debrief-section option').evaluateAll(xs=>xs.map(x=>x.value))) await p.locator('#debrief-section').selectOption(value);
 await p.reload({waitUntil:'networkidle'});await p.getByRole('button',{name:lang==='en'?'Last debrief':'Последний разбор',exact:true}).click();
 assert.equal(await p.locator('.ending__title').innerText(),title);assert.deepEqual(errors,[]);
 outcomes.push({lang,turns,title,restoredChoice,restoredReport,errors,trace});fs.writeFileSync(`${out}/full-run-results.json`,JSON.stringify(outcomes,null,2));
 await ctx.close();
}
}finally{await browser.close();}
console.log(outcomes.map(({trace,...x})=>x));
