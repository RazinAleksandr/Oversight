import {webkit} from 'playwright';import fs from 'node:fs';
const b=await webkit.launch();const result=[];const out='artifacts/ux-reassessment';
const settled=async p=>{if(await p.locator('.sheet-guard').count())await p.locator('.sheet-guard').waitFor({state:'detached'});await p.waitForTimeout(200)};
const geom=async p=>p.evaluate(()=>{const rect=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}};return Object.fromEntries(['.decision-page__scroll','.decision-page__context','.decision','.decision-detail','.decision-page__footer','.main','.page-head','.panel-sections'].map(s=>[s,document.querySelector(s)?rect(document.querySelector(s)):null]).concat([['choices',[...document.querySelectorAll('[data-choice]')].map(e=>({text:e.innerText,...rect(e)}))]]))});
try{for(const [width,height] of [[390,844],[844,390],[667,375]]){
const c=await b.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const p=await c.newPage();
await p.goto('http://127.0.0.1:5178/?lang=en');await p.evaluate(s=>{localStorage.setItem('ato.save.v1',s);localStorage.removeItem('ato.pending.v1')},fs.readFileSync('artifacts/ux-audit-2026-10-12/turn6-save.json','utf8'));await p.reload();await p.getByRole('button',{name:'Continue',exact:true}).click();await settled(p);
const cards=await p.locator('[data-card]').allTextContents();console.log(width,cards);
await p.locator('[data-card]').filter({hasText:'Open release'}).first().click();await settled(p);await p.screenshot({path:`${out}/${width}-decision.png`});const before=await geom(p);
await p.locator('[data-choice]').nth(1).click();await settled(p);await p.screenshot({path:`${out}/${width}-selected.png`});const selected=await geom(p);
await p.locator('.briefing-detail--evidence>summary').click();await settled(p);await p.screenshot({path:`${out}/${width}-evidence.png`});const evidence=await geom(p);
await p.locator('.decision-page__bar button').click();await p.locator('#tab-nation').click();await p.locator('[data-section=companies]').click();await p.locator('.company-record>summary').first().click();await settled(p);await p.screenshot({path:`${out}/${width}-company.png`});const company=await geom(p);
await p.locator('#tab-inbox').click();await p.locator('[data-card]').filter({hasText:'Open release'}).first().click();await settled(p);const returned={selection:await p.locator('[aria-checked=true][data-choice]').count(),evidenceOpen:await p.locator('.briefing-detail--evidence[open]').count()};
result.push({width,height,before,selected,evidence,company,returned});await c.close();
}}finally{await b.close();fs.writeFileSync(`${out}/research-metrics.json`,JSON.stringify(result,null,2));}
