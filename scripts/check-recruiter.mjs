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
 expect(await table.locator('tbody tr').first().innerText()).toContain('Nagalakshmi');
 await page.getByLabel('Search by name').fill('Manjunath');
 expect(await table.locator('tbody tr').count()).toBe(1);
 await table.locator('tbody tr').first().click();
 await expect(page.getByRole('region',{name:'Candidate snapshot for Manjunath',exact:true})).toBeVisible();
 await page.getByLabel('Search by name').fill('');
 for(const name of ['Nagalakshmi.docx','Manjunath .docx','Karthik.docx']) await page.getByLabel(`Compare ${name}`,{exact:true}).check();
 await ranked.getByRole('button',{name:'Compare',exact:true}).click();
 const compare=page.getByRole('region',{name:'Candidate comparison'});
 await expect(compare).toBeVisible();
 expect(await compare.locator('thead th').allTextContents()).toEqual(['Criterion','Nagalakshmi','Manjunath','Karthik']);
 expect(await compare.locator('.best-value').count()).toBeGreaterThan(0);
 const markdown=async t=>{
 const rows=await t.locator('tr').all();
 const values=[];for(const row of rows)values.push(await row.locator('th,td').allTextContents());
 return values.map((row,i)=>'| '+row.map(x=>x.trim().replaceAll('\n','<br>')).join(' | ')+' |'+(i===0?'\n| '+row.map(()=>'---').join(' | ')+' |':'')).join('\n');
 };
 await writeFile('.local-checks/recruiter-proof.md', '# Ranked table\n\n'+await markdown(table)+'\n\n# Comparison\n\n'+await markdown(compare.locator('table'))+'\n');
 await page.setViewportSize({width:1440,height:1000});
 await ranked.screenshot({path:'.local-checks/recruiter-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await ranked.screenshot({path:'.local-checks/recruiter-mobile.png'});
 expect(errors).toEqual([]);
 console.log('All 8 CVs passed against real Convex assessments. No browser errors. Matching rules unchanged.');
}finally{await browser.close()}
