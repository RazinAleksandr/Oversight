/** Page-level visual registry. Synthetic engine fixtures only, no phone saves.
 * DESIGN_URL=http://127.0.0.1:5182 DESIGN_PHASE=before node scripts/design-v5-capture.mjs
 * Captures are review evidence, not automatic aesthetic approval. Intentional scrolling is logged.
 */
import {webkit} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.DESIGN_URL??'http://127.0.0.1:5183',phase=process.env.DESIGN_PHASE??'after';
const out=`artifacts/design-v5/${phase}`;fs.mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const langs=(process.env.DESIGN_LANGS??'en').split(',');
const sizes=(process.env.DESIGN_WIDTHS??'844,667').split(',').map(Number);
const filter=(process.env.DESIGN_PAGES??'').split(',').filter(Boolean);
const wants=n=>!filter.length||filter.includes(n);
const browser=await webkit.launch(),registry=[];
try{for(const lang of langs)for(const width of sizes){
 const height=width===844?390:width===667?375:844;
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await context.newPage();
 p.setDefaultTimeout(5000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const log=[];
 const settle=async()=>{if(await p.locator('.sheet-guard').count())await p.locator('.sheet-guard').waitFor({state:'detached'});await p.waitForTimeout(100);};
 const inset=async()=>p.evaluate(w=>{const s=document.documentElement.style;for(const[k,v]of Object.entries({'--safe-l':w>600?'47px':'0px','--safe-r':w>600?'47px':'0px','--safe-t':'0px','--safe-b':'21px'}))s.setProperty(k,v)},width);
 const snap=async name=>{await settle();const file=`${lang}-${width}-${name}.png`;await p.screenshot({path:`${out}/${file}`});registry.push({lang,width,height,name,file,errors:[...errors],scrolls:[...log],review:'pending'});fs.writeFileSync(`${out}/registry.json`,JSON.stringify(registry,null,2));console.log(file)};
 const tap=async l=>{await l.waitFor({state:'visible'});const g=await l.evaluate(e=>{const r=e.getBoundingClientRect();let t=Math.max(0,r.top),b=Math.min(innerHeight,r.bottom),left=Math.max(0,r.left),right=Math.min(innerWidth,r.right);for(let a=e.parentElement;a;a=a.parentElement){const c=getComputedStyle(a),q=a.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(c.overflowY)){t=Math.max(t,q.top);b=Math.min(b,q.bottom)}if(/auto|scroll|hidden|clip/.test(c.overflowX)){left=Math.max(left,q.left);right=Math.min(right,q.right)}}const x=(left+right)/2,y=(t+b)/2,h=document.elementFromPoint(x,y);return {x,y,full:b-t>=r.height-1&&right-left>=r.width-1,hit:!!h&&e.contains(h),text:e.textContent}});assert(g.full&&g.hit,`capture target clipped/covered: ${g.text}`);await p.touchscreen.tap(g.x,g.y);await settle();};
 const browse=async l=>{const moves=await l.evaluate(e=>{const m=[];for(let a=e.parentElement;a;a=a.parentElement){const c=getComputedStyle(a),r=e.getBoundingClientRect(),q=a.getBoundingClientRect(),old=[a.scrollLeft,a.scrollTop];if(/auto|scroll/.test(c.overflowY)&&(r.top<q.top||r.bottom>q.bottom))a.scrollTop+=r.top-q.top;if(/auto|scroll/.test(c.overflowX)&&(r.left<q.left||r.right>q.right))a.scrollLeft+=r.left-q.left;if(old[0]!==a.scrollLeft||old[1]!==a.scrollTop)m.push({class:a.className,from:old,to:[a.scrollLeft,a.scrollTop]})}return m});log.push(...moves);await settle();};
 const go=async(save,completed)=>{await p.goto(`${base}/?lang=${lang}`,{waitUntil:'networkidle'});await p.evaluate(({save,completed})=>{localStorage.clear();if(save)localStorage.setItem(completed?'ato.completed.v1':'ato.save.v1',JSON.stringify(save))},{save,completed});await p.reload({waitUntil:'networkidle'});await inset();if(save){const l=p.getByRole('button',{name:completed?(lang==='en'?'Last debrief':'Последний разбор'):(lang==='en'?'Continue':'Продолжить'),exact:true});await browse(l);await tap(l)}await inset();};
 try{
 if(wants('entry')){await go();await snap('title');await tap(p.getByRole('button',{name:lang==='en'?'New Game':'Новая игра',exact:true}));await snap('setup');}
 const manifest=read(`artifacts/full-redesign/fixtures/${lang}-manifest.json`);
 for(const item of manifest.filter(i=>i.kind&&wants(i.kind))){await go(read(item.save));const card=p.locator(`[data-card="${item.uid}"]`);await browse(card);await tap(card);await snap(`${item.kind}-brief`);const opts=p.locator('[data-workspace-mode=options]');if(await opts.isVisible())await tap(opts);const original=read(item.save).inbox.find(c=>c.uid===item.uid);const choice=p.locator('[data-choice]').nth(original.choices.findIndex(c=>c.id===item.choiceId));await browse(choice);await tap(choice);await snap(`${item.kind}-selected`);if(item.kind==='deployment'){await tap(p.locator('[data-confirm-choice]'));await snap('decision-result');}}
 if(wants('management')){
 await go(read(`artifacts/full-redesign/fixtures/${lang}-management.json`));await snap('agenda');
 for(const [tab,name]of[['labs','companies'],['nation','government'],['threats','threats'],['world','world']]){await tap(p.locator(`[data-tab=${tab}]`));await snap(name);if(tab==='nation')for(const section of ['programs','policies','society']){await browse(p.locator(`[data-section=${section}]`));await tap(p.locator(`[data-section=${section}]`));await snap(section)}}
 await tap(p.locator('[data-tab=threats]'));const investigate=p.locator('[data-threat-response=investigate]');if(await investigate.count()){await browse(investigate);await tap(investigate);await snap('action-confirmation');await tap(p.locator('[data-confirm-action]'));await snap('action-result');await tap(p.locator('[data-result-continue]'));}
 const newsState=structuredClone(read(`artifacts/full-redesign/fixtures/${lang}-management.json`));newsState.news=read(`artifacts/full-redesign/fixtures/${lang}-quarter-oracle.json`).state.news;await go(newsState);await tap(p.locator('.command-news'));await snap('news');await p.keyboard.press('Escape');await settle();
 await tap(p.locator('.command-status'));await snap('status');await p.keyboard.press('Escape');await settle();
 await tap(p.locator('.command-menu'));await snap('settings');await p.keyboard.press('Escape');await settle();
 if(await p.locator('.command-help').count()){await tap(p.locator('.command-help'));await snap('help');await p.keyboard.press('Escape');}
 }
 if(wants('ending')){await go(read(`artifacts/full-redesign/fixtures/${lang}-threshold-expected.json`),true);await snap('ending');}
 if(wants('quarter')){await go(read(`artifacts/full-redesign/fixtures/${lang}-quarter.json`));await tap(p.locator('.btn--end:visible'));await snap('report');for(const[i,name]of[[1,'report-changes'],[2,'report-headlines']]){await tap(p.locator('.report-command nav button').nth(i));await snap(name)}}
 }catch(e){await snap('CAPTURE-FAIL');registry.push({lang,width,error:String(e)});console.error(String(e))}
 await context.close();
}}finally{await browser.close();fs.writeFileSync(`${out}/registry.json`,JSON.stringify(registry,null,2));}
assert(!registry.some(r=>r.error||r.errors?.length),'capture has errors; inspect registry');
