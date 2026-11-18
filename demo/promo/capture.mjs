import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir('demo/promo/assets/captures',{recursive:true});
const shot=async(name,locator)=>{await page.waitForTimeout(250);await (locator||page).screenshot({path:`demo/promo/assets/captures/${name}.png`});};
try{
 await page.goto('http://127.0.0.1:4317');await page.getByRole('heading',{name:'A clearer view of experience.'}).waitFor();await shot('workspace');
 await page.locator('input[type=file]').setInputFiles('demo/assets/synthetic-resume.pdf');
 await page.getByRole('heading',{name:'Review professional evidence'}).waitFor();
 await page.getByRole('textbox',{name:/Candidate display name/}).fill('Alex Morgan · Fictional profile');
 await page.locator('.review-card').scrollIntoViewIfNeeded();await shot('review');
 await page.getByRole('checkbox',{name:/I reviewed this text/}).check();await page.getByRole('button',{name:'Analyze Candidate →'}).click();
 await page.getByRole('heading',{name:'Alex Morgan · Fictional profile'}).waitFor();await page.evaluate(()=>window.scrollTo(0,0));await shot('results');
 await shot('ownership',page.locator('.card.dimension').nth(1));
 await shot('mentorship',page.locator('.card.dimension').nth(2));
 await page.locator('#evidence').scrollIntoViewIfNeeded();await page.locator('.pdf-page canvas').waitFor({state:'visible'});await shot('evidence');
 await shot('pdf',page.locator('.pdf-page canvas'));
 await page.getByRole('button',{name:/Candidates/}).first().click();await page.getByRole('button',{name:/Alex Morgan/}).first().waitFor();await page.evaluate(()=>window.scrollTo(0,0));await shot('history');
 await page.getByRole('button',{name:/Screening Dimensions/}).click();
 await page.getByRole('button',{name:/Production system ownership/}).click();await page.evaluate(()=>window.scrollTo(0,0));await shot('criteria');
 await shot('rubric',page.locator('.criteria-editor'));
 await page.getByRole('textbox',{name:'Display label',exact:true}).fill('Production system ownership');
 await shot('editor',page.locator('.dimension-editor'));
}finally{await context.close();await browser.close();await writeFile('demo/promo/assets/captures/qa.json',JSON.stringify({errors,providers:'authored fictional fixtures'},null,2));}
if(errors.length)throw new Error(errors.join('\n'));
