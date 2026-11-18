// Capture complete, fixed-camera interaction mockups at their native viewport.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const manifest=JSON.parse(await readFile('demo/promo/assets/voice-manifest.json','utf8'));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const context=await browser.newContext({viewport:{width:1100,height:800},deviceScaleFactor:1});
const reports=[];const errors=[];
const root='demo/promo/assets/clips';await mkdir(root,{recursive:true});
async function layout(page){return page.evaluate(()=>{
 const failures=[];
 const walker=document.createTreeWalker(document.getElementById('root'),NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()){if(!node.textContent.trim())continue;const parent=node.parentElement;if(getComputedStyle(parent).display==='none'||!parent.checkVisibility())continue;const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())if(r.width&&r.height&&(r.left<-.5||r.top<-.5||r.right>1100.5||r.bottom>800.5))failures.push({text:node.textContent.trim(),x:r.x,y:r.y,width:r.width,height:r.height});}
 for(const el of document.querySelectorAll('input,textarea,select')){if(el.scrollWidth>el.clientWidth+2)failures.push({text:'Field horizontally clips: '+el.getAttribute('aria-label'),scroll:el.scrollWidth,client:el.clientWidth});}
 for(const el of document.querySelectorAll('.film-panel,.film-score-grid .card,img')){const r=el.getBoundingClientRect();if(r.left<-.5||r.top<-.5||r.right>1100.5||r.bottom>800.5)failures.push({text:'Panel or image outside full viewport',x:r.x,y:r.y,width:r.width,height:r.height});}
 return failures;
 });}
for(const scene of manifest.scenes.filter(s=>!['brand','close'].includes(s.id))){
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const url=pathToFileURL(path.resolve('demo/promo/mockup.html'));url.searchParams.set('scene',scene.id);await page.goto(url.href);await page.waitForFunction(()=>window.film?.ready);await page.evaluate(()=>document.fonts.ready);
 if(scene.id==='scores'){
  // Set the initial presentation to zero before recording; semantic answers stay final.
  await page.evaluate(()=>{for(const el of document.querySelectorAll('.value'))el.firstChild.textContent=el.firstChild.textContent.includes('%')?'0.0%':'0.00';for(const el of document.querySelectorAll('.track')){el.firstElementChild.style.width='0%';el.previousElementSibling.querySelector('strong').textContent='0.0%';}});
 }
 const dir=`${root}/${scene.id}`;await mkdir(dir,{recursive:true});const frames=[],pending=[];let count=0;
 const cdp=await context.newCDPSession(page);let started=performance.now();
 cdp.on('Page.screencastFrame',event=>{const file=`${dir}/${String(count++).padStart(5,'0')}.jpg`;frames.push({file,time:(performance.now()-started)/1000});pending.push(writeFile(file,Buffer.from(event.data,'base64')));void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:95,maxWidth:1100,maxHeight:800,everyNthFrame:1});
 const until=async t=>{const d=t*1000-(performance.now()-started);if(d>0)await page.waitForTimeout(d);};
 let checks=[...await layout(page)];
 if(scene.id==='hook'){await until(1);await page.getByRole('button',{name:'New analysis'}).click();}
 if(scene.id==='criteria'){
  const name=page.getByRole('textbox',{name:'Criterion name'});await until(.35);await name.click();await name.pressSequentially('Production system ownership',{delay:45});
  const q=page.getByRole('textbox',{name:'Criterion evidence'});await q.click();await q.pressSequentially('Look for systems built, production ownership, and engineering tradeoffs.',{delay:24});
  await page.getByRole('button',{name:'Save dimensions'}).click();
 }
 if(scene.id==='threshold'){
  await until(.65);const field=page.getByRole('spinbutton',{name:'Threshold percentage'});await field.click();await field.fill('');await field.pressSequentially('70',{delay:160});await until(2.3);await page.getByRole('button',{name:'Save dimensions'}).click();
 }
 if(scene.id==='speed'){await until(.55);await page.getByRole('button',{name:'Analyze candidate'}).click();}
 if(scene.id==='scores'){
  // Reload final model values before starting the presentation animation.
  await page.evaluate(()=>{
   const values=document.querySelectorAll('.value');values[0].firstChild.textContent='92.0%';values[1].firstChild.textContent='3.50';
   for(const el of document.querySelectorAll('.track'))el.setAttribute('aria-valuenow',el.getAttribute('aria-valuenow'));
   window.film.animateResults();
  });
 }
 if(scene.id==='evidence'){await until(.8);await page.getByRole('button',{name:'Show reviewed evidence →'}).click();}
 await page.mouse.move(1070,765,{steps:12});
 const duration=scene.voiceDuration+.45;await until(Math.max(3.5,duration-.15));checks.push(...await layout(page));
 await page.screenshot({path:`${dir}/final.png`});
 const values=scene.id==='scores'?await page.locator('.value').allTextContents():undefined;
 const animationSamples=scene.id==='scores'?await page.evaluate(()=>window.film.samples):undefined;
 await until(duration);await cdp.send('Page.stopScreencast');await Promise.all(pending);
 const report={id:scene.id,duration:(performance.now()-started)/1000,frames,layoutFailures:checks,finalValues:values,animationSamples};await writeFile(`${dir}/manifest.json`,JSON.stringify(report,null,2));reports.push({id:scene.id,frameCount:frames.length,layoutFailures:checks,finalValues:values,animationSamples});
 await page.close();console.log(scene.id,frames.length,'frames',checks.length,'layout issues');
}
await context.close();await browser.close();await writeFile(`${root}/quality.json`,JSON.stringify({viewport:{width:1100,height:800},mode:'interactive video mockups using the production DimensionCard component',errors,scenes:reports},null,2));
if(errors.length||reports.some(x=>x.layoutFailures.length))process.exitCode=1;
