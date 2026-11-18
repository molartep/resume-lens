import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
await mkdir('docs/brand/qa',{recursive:true});const results=[];const errors=[];
for(const width of [320,375,768,1024,1440]){
 const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4317');await page.getByRole('heading',{name:'A clearer view of experience.'}).waitFor();await page.getByRole('img',{name:'ResumeLens',exact:true}).waitFor();
 const data=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,logoLoaded:document.querySelector('.brand-lockup').naturalWidth>0,logoVisible:(()=>{const r=document.querySelector('.brand-lockup').getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.width>=140;})(),title:document.title,brand:getComputedStyle(document.documentElement).getPropertyValue('--rl-brand').trim(),ariaCurrent:document.querySelectorAll('[aria-current=page]').length}));
 await page.screenshot({path:`docs/brand/qa/workspace-${width}.png`});results.push(data);
 if(width===1440){for(const label of ['Screening Dimensions','Settings']){await page.getByRole('button',{name:new RegExp(label)}).first().click();await page.waitForTimeout(250);results.push({page:label,width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});await page.screenshot({path:`docs/brand/qa/${label.toLowerCase().replaceAll(' ','-')}.png`});}}
 await context.close();
}
await browser.close();await writeFile('docs/brand/qa/platform.json',JSON.stringify({errors,results},null,2));
if(errors.length||results.some(x=>x.overflow||x.logoLoaded===false||x.logoVisible===false))process.exitCode=1;
