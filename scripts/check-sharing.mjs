import {ConvexHttpClient} from 'convex/browser';
import {api} from '../convex/_generated/api.js';
import {verdict} from '../src/lib/verdict.ts';
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import {snapshotContent} from '../src/lib/snapshot.ts';
import {recommend} from '../shared/recommendation.ts';
const {requirements,results:baseline}=JSON.parse(await readFile('.local-checks/rule-results.json','utf8'));
const results=[];
for(const original of baseline){
 const {value:cv}=await mammoth.extractRawText({path:path.resolve('test-cvs',original.file)});
 const result=recommend(requirements,cv.trim());
 expect(result).toEqual(Object.fromEntries(Object.entries(original).filter(([k])=>k!=='file')));
 results.push({file:original.file,...result});
 console.log(`${original.file}: ${result.recommendation} (${result.coverage}%) — identical to existing assessment`);
}
expect(results.find(r=>r.file==='Nagalakshmi.docx').recommendation).toBe('Move to next round');
expect(results.find(r=>r.file==='Manjunath .docx').recommendation).toBe('Maybe');
expect(results.find(r=>r.file==='Karthik.docx').recommendation).toBe('Not now');
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.LIVE_URL || 'http://127.0.0.1:5175');
 await page.getByLabel('Choose job description').setInputFiles(path.resolve('test-cvs/JD.pdf'));
 await expect(page.getByRole('button',{name:'Extract requirements',exact:true})).toBeEnabled();
 for(const [i,r] of requirements.entries()){
 await page.getByRole('button',{name:'Add a requirement',exact:true}).click();
 await page.getByLabel(`Requirement ${i+1}`,{exact:true}).fill(r.text);
 await page.getByRole('checkbox',{name:'Must-have',exact:true}).nth(i).setChecked(r.mustHave);
 await page.getByRole('textbox',{name:`CV evidence phrases ${i+1}`,exact:true}).fill(r.groups.map(g=>g.join(' / ')).join('; '));
 await page.getByRole('checkbox',{name:'Check in a call; exclude from CV coverage',exact:true}).nth(i).setChecked(r.interviewOnly);
 }
 await page.getByRole('button',{name:'Confirm requirements',exact:true}).click();
 for(const [i,r] of results.entries()){
 await page.getByLabel(i?'Replace candidate CV':'Choose candidate CV').setInputFiles(path.resolve('test-cvs',r.file));
 await expect(page.getByRole('button',{name:'Assess this CV',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Assess this CV',exact:true}).click();
 const snapshot=page.getByRole('region',{name:`Candidate snapshot for ${r.file.replace(/\.docx$/,'').trim()}`,exact:true});
 await expect(snapshot).toBeVisible();
 await expect(snapshot.locator('.snapshot-badge')).toHaveText(verdict(r,requirements));
 await expect(snapshot.locator('.coverage-ring strong')).toHaveText(`${r.coverage}%`);
 const expected=snapshotContent(r,requirements,Object.fromEntries(requirements.map(x=>[x.id,x])),(await page.locator('.candidate-panel pre').textContent()));
 expect(await snapshot.locator('.requirement-bar').count()).toBe(expected.must.length);
 await expect(snapshot.locator('.snapshot-other summary')).toHaveText(`${expected.otherShown} of ${expected.other.length} other requirements shown`);
 await snapshot.locator('.snapshot-other summary').click();
 await expect(snapshot.locator('.other-requirements')).toBeVisible();
 expect(await snapshot.locator('.other-requirements>div').count()).toBe(expected.other.length);
 const quotes=await snapshot.locator('blockquote').allTextContents();
 expect(quotes).toEqual(expected.strengths.map(x=>x.quote));
 expect(new Set(quotes).size).toBe(quotes.length);
 for(const q of quotes)expect(q.trim().split(/\s+/).length).toBeLessThan(25);
 await expect(snapshot.locator('.stat-requirement')).toHaveText(expected.strongest?.text ?? 'No must-have skill fully shown');
 expect(await snapshot.locator('.snapshot-side>.snapshot-card').first().locator('li').count()).toBeLessThanOrEqual(3);
 await snapshot.locator('.snapshot-other summary').click();
 const cv=await page.locator('.candidate-panel pre').textContent();
 for(const quote of await snapshot.locator('blockquote').allTextContents())expect(cv).toContain(quote);
 const must=requirements.filter(x=>x.mustHave&&!x.interviewOnly);
 await expect(snapshot.locator('.snapshot-stats strong').first()).toHaveText(`${must.filter(x=>r.evidence.find(e=>e.requirementId===x.id).status==='found').length} of ${must.length}`);
 console.log(`${r.file}: unchanged verdict; must-have bars, expandable other requirements, distinct work-history quotes under 25 words, strongest must-have skill and gap limit passed`);
 if(r.file==='Nagalakshmi.docx'){
  await snapshot.locator('.snapshot-other summary').click();
  await page.evaluate(()=>{new MutationObserver(()=>{const clone=document.querySelector('.snapshot-export');if(clone)window.__exportCheck={closed:!clone.querySelector('details').open,otherRows:clone.querySelectorAll('.other-requirements').length};}).observe(document.body,{childList:true});});
  const download=page.waitForEvent('download');await snapshot.getByRole('button',{name:'Download PDF'}).click();
  await (await download).saveAs('.local-checks/Nagalakshmi-snapshot.pdf');
  expect(await page.evaluate(()=>window.__exportCheck)).toEqual({closed:true,otherRows:0});
  const pdf=await readFile('.local-checks/Nagalakshmi-snapshot.pdf','latin1');
  expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(1);
  const pageSize=pdf.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  expect(Number(pageSize[1])).toBeCloseTo(595.28,2);
  expect(Number(pageSize[2])).toBeCloseTo(841.89,2);
  await snapshot.locator('.snapshot-other summary').click();
  await snapshot.locator('.candidate-snapshot').screenshot({path:'.impeccable/review/desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await snapshot.locator('.candidate-snapshot').screenshot({path:'.impeccable/review/mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:1440,height:1000});
  console.log('Nagalakshmi PDF downloaded: A4, exactly 1 page, other requirements collapsed even when expanded on screen. Desktop and phone screenshots captured; no phone overflow.');
 }
 }


 const ranked=page.getByRole('region',{name:'Ranked candidates'});
 const table=ranked.locator('.ranked-table');
 expect(await table.locator('tbody tr').count()).toBe(8);
 for (const r of results) {
   const checkbox=page.getByLabel(`Share ${r.file}`,{exact:true});
   await expect(checkbox).toBeChecked({checked:r.recommendation==='Move to next round'});
   await checkbox.setChecked(['Nagalakshmi.docx','Manjunath .docx'].includes(r.file));
 }
 await page.getByLabel('Hiring manager’s email').fill('hiring.manager@example.com');
 await page.getByRole('button',{name:'Send to hiring manager',exact:true}).click();
 const draft=page.getByRole('link',{name:'Open email draft again'});
 await expect(draft).toBeVisible();
 const mailto=new URL(await draft.getAttribute('href'));
 expect(decodeURIComponent(mailto.pathname)).toBe('hiring.manager@example.com');
 const shareLink=await page.getByRole('link',{name:'View shared shortlist'}).getAttribute('href');
 const body=mailto.searchParams.get('body');
 const backendUrl=process.env.LIVE_URL ? new URL(process.env.LIVE_URL).origin.replace('.convex.site','.convex.cloud') : (await readFile('.env.local','utf8')).match(/^CONVEX_URL=(.*)$/m)[1].trim();
 const stored=await new ConvexHttpClient(backendUrl).query(api.shares.get,{token:new URL(shareLink).pathname.split('/').pop()});
 expect(JSON.parse(stored.payload).candidates.map(c=>c.name)).toEqual(['Nagalakshmi.docx','Manjunath .docx']);
 expect(stored.expiresAt-Date.now()).toBeGreaterThan(14*24*60*60*1000-60000);
 expect(stored.expiresAt-Date.now()).toBeLessThanOrEqual(14*24*60*60*1000);

 expect(body).toBe(`Nagalakshmi — ${verdict(results.find(r=>r.file==='Nagalakshmi.docx'),requirements)} — 80%\nManjunath — ${verdict(results.find(r=>r.file==='Manjunath .docx'),requirements)} — 68%\n\n${shareLink}\n\nReply to me with times for interviews`);
 expect(mailto.searchParams.get('subject')).toMatch(/^Shortlist: /);
 // A new context is Chrome's private window: no cookies or local storage shared.
 const privateContext=await browser.newContext({viewport:{width:1440,height:1000}});
 const privatePage=await privateContext.newPage();
 await privatePage.goto(shareLink);
 const sharedTable=privatePage.locator('.ranked-table');
 await expect(sharedTable.locator('tbody tr')).toHaveCount(2);
 expect(await sharedTable.locator('tbody tr td:nth-child(2)').allTextContents()).toEqual(['Nagalakshmi','Manjunath']);
 await expect(privatePage.getByRole('region',{name:'Candidate snapshot for Nagalakshmi',exact:true})).toBeVisible();
 await expect(privatePage.getByRole('region',{name:'Candidate snapshot for Manjunath',exact:true})).toBeVisible();
 await expect(privatePage.getByRole('button',{name:'Download PDF',exact:true})).toHaveCount(2);
 expect(await privatePage.locator('input,textarea,select').count()).toBe(0);
 for(const r of results.filter(r=>!['Nagalakshmi.docx','Manjunath .docx'].includes(r.file))) expect(await privatePage.locator('body').innerText()).not.toContain(r.file.replace(/\.docx$/,'').trim());
 const download=privatePage.waitForEvent('download');
 await privatePage.getByRole('button',{name:'Download PDF',exact:true}).first().click();
 await (await download).saveAs('.local-checks/shared-Nagalakshmi.pdf');
 await privatePage.screenshot({path:'.local-checks/shared-shortlist-desktop.png',fullPage:true});
 await privatePage.setViewportSize({width:390,height:844});
 expect(await privatePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await privatePage.screenshot({path:'.local-checks/shared-shortlist-mobile.png',fullPage:true});
 await privatePage.goto(new URL('/share/invalid-token',shareLink).href);
 await expect(privatePage.getByRole('heading',{name:'Link expired or not found',exact:true})).toBeVisible();
 await expect(privatePage.locator('.ranked-table')).toHaveCount(0);
 await privatePage.goto(new URL('/share/'+'0'.repeat(64),shareLink).href);
 await expect(privatePage.getByRole('heading',{name:'Link expired or not found',exact:true})).toBeVisible();
 await privatePage.goto(shareLink);
 await expect(privatePage.locator('.ranked-table tbody tr')).toHaveCount(2);
 await privatePage.clock.install();
 await privatePage.clock.fastForward(14*24*60*60*1000+1000);
 await expect(privatePage.getByRole('heading',{name:'Link expired or not found',exact:true})).toBeVisible();
 await privateContext.close();
 // Selection changes must clear an old draft, avoiding accidental sharing of stale choices.
 await page.getByLabel('Share Manjunath .docx',{exact:true}).uncheck();
 await expect(draft).toHaveCount(0);
 expect(errors).toEqual([]);
 const proof={url:process.env.LIVE_URL || 'http://127.0.0.1:5175',shareLink,subject:mailto.searchParams.get('subject'),to:decodeURIComponent(mailto.pathname),body,verdicts:results.map(r=>({name:r.file,verdict:verdict(r,requirements),coverage:r.coverage})),checks:'Eight CVs assessed through Convex; all original results identical. Private window: exactly Nagalakshmi and Manjunath, both snapshots and PDF buttons; PDF downloaded. Invalid and unknown tokens checked; 14-day expiry verified in stored data and browser clock. Stored payload contains exactly two candidates. Desktop and mobile checked. Changing selection clears stale draft. No browser errors.'};
 await writeFile('.local-checks/share-proof.json',JSON.stringify(proof,null,2));
 console.log(JSON.stringify(proof,null,2));
}finally{await browser.close()}
