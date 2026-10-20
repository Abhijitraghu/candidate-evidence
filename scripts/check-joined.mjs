import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {ConvexHttpClient} from 'convex/browser';
import mammoth from 'mammoth';
import {verdict} from '../src/lib/verdict.ts';
const baseline=JSON.parse(await readFile('.local-checks/rule-results.json','utf8'));
const workspace=JSON.parse(await readFile('.local-checks/pipeline-workspace.json','utf8'));
const env=await readFile('.env.local','utf8');
const client=new ConvexHttpClient(env.match(/^CONVEX_URL=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,''));
const original=await client.query('pipeline:list',{workspace});
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(key=>localStorage.setItem('hiring-workspace',key),workspace);
 await page.goto('http://127.0.0.1:5175');
 await page.getByRole('button',{name:'Pipeline',exact:true}).click();
 const table=page.locator('.pipeline-table');
 await expect(table).toContainText('Digital workspace');
 async function rawTable(){return (await Promise.all((await table.locator('tr').all()).map(async row=>(await row.locator('th,td').allTextContents()).join('\t')))).join('\n')+'\n';}
 const before=await rawTable();
 const opening=original.find(o=>o.name==='Digital workspace');
 const candidate=opening.candidates.find(c=>c.stage!=='Joined');
 if(!candidate)throw Error('No candidate available to move to Joined');
 await page.getByRole('button',{name:'Digital workspace',exact:true}).click();
 await page.getByRole('button',{name:'Open shortlist',exact:true}).click();
 await page.getByLabel(`Stage for ${candidate.name}`,{exact:true}).selectOption('Joined');
 const date=page.getByLabel(`Joining date for ${candidate.name}`,{exact:true});
 await expect(date).toHaveValue(new Date().toISOString().slice(0,10));
 await date.fill('2026-10-19');
 await expect(page.getByRole('status').filter({hasText:'Stage saved'})).toBeVisible();
 await expect(date).toBeEnabled();
 await page.getByRole('button',{name:'Pipeline',exact:true}).click();
 const history=page.getByRole('region',{name:'History for Digital workspace',exact:true});
 await expect(history.locator('tbody tr').filter({has:page.getByRole('cell',{name:candidate.name,exact:true})})).toContainText('2026-10-19');
 const after=await rawTable();
 const downloaded=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download CSV',exact:true}).click();
 await(await downloaded).saveAs('.local-checks/joined-pipeline.csv');
 const csv=await readFile('.local-checks/joined-pipeline.csv','utf8');
 expect(csv).toEqual(after.trimEnd().split('\n').map(row=>row.split('\t').map(cell=>'"'+cell.replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n');
 const updated=await client.query('pipeline:list',{workspace});
 for(const old of original){const next=updated.find(o=>o.key===old.key);expect(next.payload).toEqual(old.payload);for(const c of old.candidates){const saved=next.candidates.find(r=>r.name===c.name);if(old.key===opening.key && c.name===candidate.name){expect(saved.stage).toBe('Joined');expect(saved.joiningDate).toBe('2026-10-19');expect(saved.history.slice(0,-1)).toEqual(c.history);}else expect(saved).toEqual(c);}}
 await page.reload();await page.getByRole('button',{name:'Pipeline',exact:true}).click();await expect(table).toContainText('Digital workspace');expect(await rawTable()).toEqual(after);
 await page.getByRole('button',{name:'Digital workspace',exact:true}).click();
 const joinedRow=history.locator('tbody tr').filter({has:page.getByRole('cell',{name:candidate.name,exact:true})});
 await expect(joinedRow).toContainText('2026-10-19');
 await page.screenshot({path:'.local-checks/joined-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.local-checks/joined-mobile.png',fullPage:true});
 const results=[];
 for(const {file,...expected} of baseline.results){const {value}=await mammoth.extractRawText({path:`test-cvs/${file}`});const result=await client.action('assessment:recommendCandidate',{requirements:baseline.requirements,cvText:value.trim(),confirmed:true});expect(result).toEqual(expected);results.push(`${file}: ${verdict(result,baseline.requirements)}; coverage ${result.coverage}% — unchanged`);}
 expect(errors).toEqual([]);
 const proof=`Before moving ${candidate.name} to Joined:\n${before}\nAfter moving ${candidate.name} to Joined:\n${after}\nCSV contents:\n${csv}\nJoining date after reload: 2026-10-19\n\n${results.join('\n')}\n`;
 await writeFile('.local-checks/joined-proof.txt',proof);console.log(proof);
}finally{await browser.close();}
