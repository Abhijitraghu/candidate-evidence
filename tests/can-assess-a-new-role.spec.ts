import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { mkdir, writeFile } from 'node:fs/promises';

const jd = `Backend developer
Required Skills
• Python experience.
• SQL experience.
Responsibilities
• Develop backend services using Python and SQL.
Preferred Skills
• Docker experience.
• Excellent communication skills.`;
const matching = `Synthetic matching applicant
Backend developer at Example Company
Develop backend services using Python and SQL.
Python application development and SQL reporting.
Docker container deployment.
Excellent communication skills.`;
const unrelated = `Synthetic unrelated applicant
Restaurant cook at Example Kitchen
Prepared menus and cooked seasonal meals.
Managed food inventory and kitchen cleaning.
Trained kitchen staff on food hygiene.`;
async function word(text: string) {
 const zip = new JSZip();
 zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${text.split('\n').map(line=>`<w:p><w:r><w:t>${line.replaceAll('&','&amp;').replaceAll('<','&lt;')}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
 return zip.generateAsync({type:'nodebuffer'});
}

test('a fresh JD gets its own rules and matching and unrelated CVs repeat identically', async ({page, baseURL}) => {
 const browserErrors: string[] = [];
 const assessments: unknown[] = [];
 const ids = new Set<number>();
 page.on('pageerror', error=>browserErrors.push(error.message));
 page.on('websocket', socket=>{
  socket.on('framesent', frame=>{
   const data = JSON.parse(frame.payload.toString());
   if (data.type === 'Action' && data.udfPath === 'assessment:recommendCandidate') ids.add(data.requestId);
  });
  socket.on('framereceived', frame=>{
   const data = JSON.parse(frame.payload.toString());
   if(data.type === 'ActionResponse' && ids.has(data.requestId)) {
    expect(data.success).toBe(true);
    assessments.push(data.result);
   }
  });
 });
 await page.goto('/');
 // Start with another role, then prove the replacement owns all its requirements and rules.
 await page.getByLabel('Paste job description').fill('A service desk role requiring Active Directory administration.');
 await page.getByRole('button',{name:'Use pasted JD'}).click();
 await page.getByRole('button',{name:'Add a requirement'}).click();
 await page.getByLabel('Requirement 1',{exact:true}).fill('Active Directory');
 await page.getByLabel('Replace job description').setInputFiles({name:'new-backend-role.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:await word(jd)});
 await expect(page.getByLabel('Requirement 1',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Extract requirements',exact:true}).click();
 await expect(page.getByLabel('Requirement 1',{exact:true})).toBeVisible({timeout:120000});
 await expect(page.locator('.activity')).toBeHidden({timeout:120000});
 const requirements = await page.locator('.requirement textarea').allTextContents();
 expect(requirements.join(' ')).not.toContain('Active Directory');
 for (const input of await page.getByRole('textbox',{name:/^CV evidence phrases /}).all()) {
  expect((await input.inputValue()).length).toBeGreaterThan(0);
 }
 await page.getByRole('button',{name:'Confirm requirements',exact:true}).click();
 await mkdir('.local-checks',{recursive:true});
 for (const [index, text] of [matching,unrelated].entries()) {
  const name = index === 0 ? 'matching-backend-cv.docx' : 'unrelated-kitchen-cv.docx';
  await page.getByLabel(index === 0 ? 'Choose candidate CV' : 'Replace candidate CV').setInputFiles({name,mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:await word(text)});
  await page.getByRole('button',{name:'Assess this CV',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Evidence for this candidate',exact:true})).toBeVisible();
  const first = await page.locator('.evidence-panel').innerText();
  expect(first).toContain(index === 0 ? 'Move to next round' : 'Not now');
  const lastCandidate = page.getByRole('region',{name:'Candidate recommendations'}).getByRole('article').last();
  for (const heading of ['Recommendation','Strengths','Weaknesses','Check on call']) await expect(lastCandidate.getByRole('heading',{name:heading,exact:true})).toBeVisible();
  const cv = await page.locator('.candidate-panel pre').textContent();
  for (const quote of await lastCandidate.locator('.recommendation-bullets blockquote').allTextContents()) expect(cv).toContain(quote);
  await page.getByRole('button',{name:'Assess this CV again',exact:true}).click();
  await expect(page.locator('.activity')).toBeHidden();
  await expect(page.getByRole('heading',{name:'Evidence for this candidate',exact:true})).toBeVisible();
  expect(await page.locator('.evidence-panel').innerText()).toBe(first);
  expect(assessments.length).toBe((index+1)*2);
  expect(assessments[index*2+1]).toEqual(assessments[index*2]);
  await page.getByRole('region',{name:'Candidate recommendations'}).screenshot({path:`.local-checks/${process.env.LIVE_URL ? 'live' : 'local'}-${index === 0 ? 'matching' : 'unrelated'}.png`});
 }
 expect(browserErrors).toEqual([]);
 await writeFile(`.local-checks/${process.env.LIVE_URL ? 'live' : 'local'}-results.json`,JSON.stringify({url:baseURL,jd,matching,unrelated,requirements,assessments},null,2));
});
