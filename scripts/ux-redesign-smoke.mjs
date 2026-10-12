/** Focused iPhone UX regression against a production build; screenshots are WebKit evidence. */
import { webkit } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.IOS_PREVIEW_URL ?? 'http://127.0.0.1:5176';
const out='artifacts/ux-redesign'; fs.mkdirSync(out,{recursive:true});
const browser=await webkit.launch(); const results=[];
const ready=async p=>{if(await p.locator('.sheet-guard').count())await p.locator('.sheet-guard').waitFor({state:'detached'});await p.waitForTimeout(180);};
try {
 for(const lang of ['en','ru']) for(const [width,height] of [[390,844],[320,568],[844,390]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const p=await context.newPage();p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(String(e)));
  const shot=async name=>{await ready(p);await p.screenshot({path:`${out}/${lang}-${width}-${name}.png`});};
  const metrics=async()=>p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,mainHeight:document.querySelector('.main')?.getBoundingClientRect().height,viewport:innerHeight}));
  await p.goto(`${base}/?lang=${lang}`,{waitUntil:'networkidle'});await shot('title');
  await p.getByRole('button',{name:lang==='en'?'New Game':'Новая игра',exact:true}).click();await shot('setup');
  assert.equal(await p.locator('[data-country="commonwealth"]').getAttribute('aria-checked'),'true');
  await p.locator('.newgame__start button').click();await shot('desk');
  const desk=await metrics();assert(!desk.overflow);
  await p.locator('button[data-card]').first().click();await ready(p);
  const saved=await p.evaluate(()=>localStorage.getItem('ato.save.v1'));
  await p.locator('[data-choice]').first().click();await ready(p);
  assert.equal(await p.evaluate(()=>localStorage.getItem('ato.save.v1')),saved,'selection committed engine state');
  await p.locator('[data-confirm-choice]').click();await ready(p);await shot('receipt');
  assert.equal(await p.locator('[role="dialog"]').count(),0,'ordinary result is still modal');
  await p.locator('.result__actions .btn--primary').click();await shot('decision');
  assert.equal(await p.locator('[data-choice]').count(),4);
  const choices=await p.locator('[data-choice]').evaluateAll(xs=>xs.map(el=>({height:el.getBoundingClientRect().height,text:el.innerText})));
  assert(choices.every(c=>c.height>=44));
  await p.locator('[data-choice]').nth(1).click();await shot('selected');
  assert(await p.locator('.decision-detail').innerText());
  await p.locator('.briefing-detail--evidence > summary').click();await p.locator('.briefing-detail--evidence').scrollIntoViewIfNeeded();await shot('evidence');
  await p.locator('[data-confirm-choice]').click();await ready(p);
  await p.locator('.result__actions .btn--primary').click();
  await p.locator('.btn--end:visible').click();await shot('report');
  assert(await p.locator('.qrow__explanation').count());
  await p.locator('.qrow__explanation summary').first().click();assert(await p.locator('.qrow__explanation[open] li').count());
  await p.locator('.report__actions button').click();
  await p.locator('#tab-nation').click();await p.locator('[data-section="companies"]').click();await shot('companies');
  await p.locator('.company-record summary').first().click();await shot('company-detail');
  await p.locator('[data-section="policies"]').click();await shot('laws');
  await p.locator('.law summary').first().click();assert(await p.locator('.law[open] .law__desc').isVisible());
  await p.locator('[data-section="programs"]').click();await shot('programs');
  const nation=await metrics();assert(!nation.overflow);
  if(await p.locator('#tab-world').count()){await p.locator('#tab-world').click();await shot('world');}
  assert.deepEqual(errors,[]);
  results.push({lang,width,height,desk,nation,choices,errors});fs.writeFileSync(`${out}/ux-results.json`,JSON.stringify(results,null,2));
  await context.close();
 }
} finally {await browser.close();}
console.log(results.map(({choices,...r})=>r));
