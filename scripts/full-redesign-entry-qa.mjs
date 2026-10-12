/** Entry, safe-area chrome and reference-sheet smoke checks. Uses isolated browser saves. */
import {webkit} from 'playwright';import assert from 'node:assert/strict';
const b=await webkit.launch();const outcomes=[];
for(const lang of ['en','ru'])for(const [width,height]of[[667,375],[390,844]]){
const c=await b.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto((process.env.IOS_PREVIEW_URL??'http://127.0.0.1:5177')+'/?lang='+lang);await p.waitForTimeout(500);
if(width>height)await p.evaluate(()=>{for(const[k,v]of[['--safe-l','47px'],['--safe-r','47px'],['--safe-b','21px']])document.documentElement.style.setProperty(k,v)});
async function tap(loc){await loc.waitFor({state:'visible'});const r=await loc.boundingBox();assert(r&&r.height>=40&&r.x>=0&&r.y>=0&&r.x+r.width<=width+.5&&r.y+r.height<=height+.5,'target reachable');assert(await loc.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'target hit');await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);await p.waitForTimeout(400)}
await p.screenshot({path:`artifacts/full-redesign/final-${lang}-${width}-title.png`});
await tap(p.getByRole('button',{name:lang==='en'?'New Game':'Новая игра',exact:true}));
await tap(p.locator('[data-country="atlantic"]'));
assert.equal(await p.locator('[data-country="atlantic"]').getAttribute('aria-checked'),'true');
await p.screenshot({path:`artifacts/full-redesign/final-${lang}-${width}-setup.png`});
await tap(p.locator('.newgame-footer >button'));await p.locator('[data-agenda]').waitFor();
await p.screenshot({path:`artifacts/full-redesign/final-${lang}-${width}-new-agenda.png`});
await tap(p.locator('.command-status'));await p.screenshot({path:`artifacts/full-redesign/final-${lang}-${width}-status.png`});
await tap(p.locator('[data-meter="confidence"]'));await p.screenshot({path:`artifacts/full-redesign/final-${lang}-${width}-meter.png`});
await p.keyboard.press('Escape');await p.waitForTimeout(350);
await tap(p.locator('.command-menu'));await p.screenshot({path:`artifacts/full-redesign/final-${lang}-${width}-settings.png`});
await p.keyboard.press('Escape');await p.waitForTimeout(350);
if(await p.locator('.command-help').count()){await tap(p.locator('.command-help'));await p.screenshot({path:`artifacts/full-redesign/final-${lang}-${width}-help.png`});await p.keyboard.press('Escape');}
assert.deepEqual(errors,[]);outcomes.push({lang,width,result:'PASS'});await c.close();
}console.log(JSON.stringify(outcomes,null,2));await b.close();
