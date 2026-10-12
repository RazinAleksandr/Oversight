import {webkit} from 'playwright';
import fs from 'node:fs';
const b=await webkit.launch();const findings=[];
const ready=async p=>{if(await p.locator('.sheet-guard').count())await p.locator('.sheet-guard').waitFor({state:'detached'});await p.waitForTimeout(250);};
const out='artifacts/ux-reassessment';
try {for(const [width,height] of [[667,375],[844,390],[390,844]]){
 const c=await b.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const p=await c.newPage();
 await p.goto('http://127.0.0.1:5177/?lang=en');await p.evaluate(s=>{localStorage.setItem('ato.save.v1',s);localStorage.removeItem('ato.pending.v1');},fs.readFileSync('artifacts/ux-audit-2026-10-12/turn6-save.json','utf8'));await p.reload();await p.getByRole('button',{name:'Continue',exact:true}).click();await ready(p);
 await p.locator('#tab-nation').click();await p.locator('[data-section=companies]').click();await p.locator('.company-record summary').first().click();await ready(p);await p.screenshot({path:`${out}/${width}-company-top.png`});
 const controls=await p.locator('.company-record[open] button').allTextContents();
 const button=p.locator('.company-record[open] button').filter({hasText:/Investigate/}).first();
 if(await button.count()) {await button.click();await ready(p);await p.screenshot({path:`${out}/${width}-investigate-open.png`});
 const m=await p.locator('.action-sheet').evaluate(el=>({text:el.innerText,rect:el.getBoundingClientRect().toJSON(),scrollTop:el.scrollTop,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,children:[...el.querySelectorAll('button,p')].map(x=>({tag:x.tagName,text:x.innerText,rect:x.getBoundingClientRect().toJSON()}))}));findings.push({width,height,controls,action:m});}
 await c.close();
}
}finally{await b.close();fs.writeFileSync(`${out}/task-probes.json`,JSON.stringify(findings,null,2));}
console.log(findings.map(x=>({width:x.width,controls:x.controls,rect:x.action.rect,scrollHeight:x.action.scrollHeight,text:x.action.text})));
