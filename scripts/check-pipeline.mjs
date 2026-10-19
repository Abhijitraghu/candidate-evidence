import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import {recommend} from '../shared/recommendation.ts';
import {verdict} from '../src/lib/verdict.ts';
const baseline=JSON.parse(await readFile('.local-checks/rule-results.json','utf8'));
const browser=await chromium.launch({channel:'chrome'});
try{
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5175');
async function screenOpening(name,files){
 await page.getByLabel('Paste job description',{exact:true}).fill(`${name}\nTest opening using the confirmed baseline requirements for pipeline verification.`);
 await page.getByRole('button',{name:'Use pasted JD',exact:true}).click();
 for(const [i,r]of baseline.requirements.entries()){
 await page.getByRole('button',{name:'Add a requirement',exact:true}).click();
 await page.getByLabel(`Requirement ${i+1}`,{exact:true}).fill(r.text);
 await page.getByRole('checkbox',{name:'Must-have',exact:true}).nth(i).setChecked(r.mustHave);
 await page.getByRole('textbox',{name:`CV evidence phrases ${i+1}`,exact:true}).fill(r.groups.map(g=>g.join(' / ')).join('; '));
 await page.getByRole('checkbox',{name:'Check in a call; exclude from CV coverage',exact:true}).nth(i).setChecked(r.interviewOnly);
 }
 await page.getByRole('button',{name:'Confirm requirements',exact:true}).click();
 for(const [i,r]of files.entries()){
 await page.getByLabel(i?'Replace candidate CV':'Choose candidate CV',{exact:true}).setInputFiles(path.resolve('test-cvs',r.file));
 await expect(page.getByRole('button',{name:'Assess this CV',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Assess this CV',exact:true}).click();
 const row=page.locator('.ranked-table tbody tr').filter({has:page.getByRole('button',{name:r.file.replace(/\.docx$/,'').trim(),exact:true})});
 await expect(row).toContainText(`${r.coverage}%`);
 await expect(row).toContainText(verdict(r,baseline.requirements));
 await expect(page.getByLabel(`Stage for ${r.file}`,{exact:true})).toBeEnabled();
 await expect(page.getByLabel(`Stage for ${r.file}`,{exact:true})).toHaveValue('Applied');
 await expect(page.getByRole('status').filter({hasText:'Opening saved'})).toBeVisible();
 }
}
await screenOpening('Digital workspace',baseline.results.slice(0,7));
await screenOpening('Network/VAPT',baseline.results.slice(0,4));
await page.getByRole('button',{name:'Pipeline',exact:true}).click();
const table=page.locator('.pipeline-table');
async function rawTable(){return (await table.locator('tr').all()).reduce(async(prev,row)=>(await prev)+ (await row.locator('th,td').allTextContents()).join('\t')+'\n',Promise.resolve(''));}
await writeFile('.local-checks/pipeline-workspace.json',JSON.stringify(await page.evaluate(()=>localStorage.getItem('hiring-workspace'))));
const before=await rawTable();
expect(before).toContain('Digital workspace\t7\t0\t0\t0\t0');expect(before).toContain('Network/VAPT\t4\t0\t0\t0\t0');
await page.getByRole('button',{name:'Digital workspace',exact:true}).click();
await expect(page.getByRole('region',{name:'History for Digital workspace',exact:true}).locator('tbody tr')).toHaveCount(7);
await page.getByRole('button',{name:'Open shortlist',exact:true}).click();
const first=baseline.results[0].file;
await page.getByLabel(`Stage for ${first}`,{exact:true}).selectOption('Interviewed');
await expect(page.getByLabel(`Stage for ${first}`,{exact:true})).toHaveValue('Interviewed');
await page.getByRole('button',{name:'Pipeline',exact:true}).click();
await expect(table).toContainText('Digital workspace');
const after=await rawTable();expect(after).toContain('Digital workspace\t7\t1\t0\t0\t0');
const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();await(await download).saveAs('.local-checks/hiring-pipeline.csv');
const csv=await readFile('.local-checks/hiring-pipeline.csv','utf8');
expect(csv).toEqual('"Opening name","Applied","Interviewed","Shortlisted","Selected","Offered"\r\n"Digital workspace","7","1","0","0","0"\r\n"Network/VAPT","4","0","0","0","0"\r\n');
await page.reload();await page.getByRole('button',{name:'Pipeline',exact:true}).click();
await expect(table).toContainText('Digital workspace');expect(await rawTable()).toEqual(after);
await page.getByRole('button',{name:'Digital workspace',exact:true}).click();
const history=page.getByRole('region',{name:'History for Digital workspace',exact:true});
const candidateHistory=history.locator('tbody tr').filter({has:page.getByRole('cell',{name:first,exact:true})});
await expect(candidateHistory.locator('time')).toHaveCount(2);
const historyText=await candidateHistory.innerText();
await page.screenshot({path:'.local-checks/pipeline-desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
await page.screenshot({path:'.local-checks/pipeline-mobile.png',fullPage:true});
// Offered counts in all preceding stages; moving back changes current cumulative totals and retains history.
await page.getByRole('button',{name:'Open shortlist',exact:true}).click();
await page.getByLabel(`Stage for ${first}`,{exact:true}).selectOption('Offered');
await expect(page.getByLabel(`Stage for ${first}`,{exact:true})).toHaveValue('Offered');
await page.getByRole('button',{name:'Pipeline',exact:true}).click();expect(await rawTable()).toContain('Digital workspace\t7\t1\t1\t1\t1');
await page.getByRole('button',{name:'Open shortlist',exact:true}).click();
await page.getByLabel(`Stage for ${first}`,{exact:true}).selectOption('Interviewed');await expect(page.getByLabel(`Stage for ${first}`,{exact:true})).toHaveValue('Interviewed');
await page.getByRole('button',{name:'Pipeline',exact:true}).click();await expect(history.locator('tbody tr').filter({has:page.getByRole('cell',{name:first,exact:true})}).locator('time')).toHaveCount(4);
const unchanged=[];
for(const original of baseline.results){const {value}=await mammoth.extractRawText({path:path.resolve('test-cvs',original.file)});const result=recommend(baseline.requirements,value.trim());expect(result).toEqual(Object.fromEntries(Object.entries(original).filter(([k])=>k!=='file')));unchanged.push(`${original.file}: ${verdict(result,baseline.requirements)}; coverage ${result.coverage}% — unchanged`);}
expect(errors).toEqual([]);
const proof=`Before stage change (browser table, tab-separated):\n${before}\nAfter moving ${first} to Interviewed (browser table, tab-separated):\n${after}\nDownloaded hiring-pipeline.csv contents:\n${csv}\nAll 8 test-CV verdicts and coverage numbers are unchanged:\n${unchanged.join('\n')}\n\nPersisted history after reload:\n${historyText}\n\nOffered cumulative counts, backward movement, all four dated history entries, reopening, refresh persistence, desktop and mobile checks passed. No browser errors.\n`;
await writeFile('.local-checks/pipeline-proof.txt',proof);console.log(proof);
}finally{await browser.close();}
