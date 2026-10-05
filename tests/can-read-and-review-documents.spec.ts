import { test, expect, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { verifyEvidence } from '../shared/evidence';

// Synthetic responses test screen behavior only. The separate live spec calls OpenAI.
async function word(text: string) {
  const escaped = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escaped}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}
const docxType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
async function simulateActions(page: Page, failedAssessment = false) {
  let extractionFailed = false;
  await page.routeWebSocket(/\/sync(?:\?|$)/, socket => {
    socket.onMessage(message => {
      const request = JSON.parse(message.toString());
      if (request.type !== 'Action') return;
      let result: unknown;
      if (request.udfPath === 'assessment:setup') result = { configured: true, model: 'synthetic-test-response' };
      else if (request.udfPath === 'assessment:extractRequirements') {
        if (!extractionFailed) {
          extractionFailed = true;
          socket.send(JSON.stringify({ type: 'ActionResponse', requestId: request.requestId, success: false, result: 'Synthetic billing error', errorData: 'Synthetic test: OpenAI usage limit. Try again.', logLines: [] }));
          return;
        }
        result = [
          { id: 'sql', text: 'SQL experience', mustHave: true, sourceQuote: 'SQL experience' },
          { id: 'python', text: 'Python experience', mustHave: false, sourceQuote: 'Python experience' },
          { id: 'communication', text: 'Verify communication in a call', mustHave: false, sourceQuote: null },
        ];
      } else if (request.udfPath === 'assessment:recommendCandidate') {
        const { requirements, cvText } = request.args[0];
        result = { recommendation:'Maybe', coverage:50, missingMustHaves:[], reason:'Synthetic screen test', ruleVersion:'test', evidence: verifyEvidence(requirements, cvText, failedAssessment ? [
          { requirementId: 'sql', status: 'found', quotes: ['A fabricated quote'], explanation: 'Unsupported', question: '' },
          { requirementId: 'python', status: 'partial', quotes: [], explanation: 'Unsupported', question: '' },
        ] : [
          { requirementId: 'sql', status: 'found', quotes: ['Built monthly reports with SQL at Example Company.'], explanation: 'Synthetic test interpretation: the CV claims SQL reporting work (p1).', question: 'Which reports did you build?' },
          { requirementId: 'python', status: 'not_found', quotes: [], explanation: '', question: 'Have you used Python?' },
          { requirementId: 'communication', status: 'needs_checking', quotes: [], explanation: 'Communication needs a recruiter call.', question: 'Walk me through a recent project.' },
        ]) };
      } else throw new Error('Unexpected action in the simulated screen test.');
      socket.send(JSON.stringify({ type: 'ActionResponse', requestId: request.requestId, success: true, result, logLines: [] }));
    });
  });
}

test('review screen handles errors, evidence, highlights and requirement edits using synthetic responses', async ({ page }) => {
  await simulateActions(page);
  await page.goto('/');
  await page.getByLabel('Choose job description').setInputFiles({ name: 'synthetic-jd.docx', mimeType: docxType, buffer: await word('Backend role. Required: SQL experience. Desirable: Python experience. Communication must be checked in a recruiter call. Experience: 1-7 years. Qualifications: 1-3 years.') });
  await page.getByRole('button', { name: 'Extract requirements', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic test: OpenAI usage limit');
  await page.getByRole('button', { name: 'Extract requirements', exact: true }).click();
  await expect(page.getByRole('button', {name:'Confirm requirements', exact:true})).toBeEnabled();
  await expect(page.locator('.role-column pre')).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  const jdBox = await page.locator('.role-column > .panel').first().boundingBox();
  const rulesBox = await page.locator('.requirements-panel').boundingBox();
  expect(jdBox!.x + jdBox!.width).toBeLessThan(rulesBox!.x);
  expect(Math.abs(jdBox!.y - rulesBox!.y)).toBeLessThan(2);

  await expect(page.getByRole('button', { name: 'Confirm requirements', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm requirements', exact: true }).click();
  const cv = 'Example Applicant.\nProfile Summary\n' + 'Additional synthetic CV content. '.repeat(45) + '\nWork Experience\nBuilt monthly reports with SQL at Example Company.\nNo other claims are made in this synthetic document.';
  await page.getByLabel('Choose candidate CV').setInputFiles({ name: 'synthetic-cv.docx', mimeType: docxType, buffer: await word(cv) });
  await page.getByRole('button', { name: 'Assess this CV', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Evidence for this candidate' })).toBeVisible();
  await page.getByText('View full evidence', { exact: true }).click();
  await expect(page.locator('.evidence-panel').getByText('Evidence found', { exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic test interpretation: the CV claims SQL reporting work.', { exact: true })).toBeVisible();
  await expect(page.locator('.evidence-panel').getByText('Not found in CV', { exact: true })).toBeVisible();
  await expect(page.locator('.evidence-panel').getByText('Needs checking', { exact: true })).toBeVisible();
  await expect(page.locator('.activity')).toBeHidden();
  await page.getByRole('button', { name: 'See this quote in the CV' }).click();
  const highlighted = page.locator('.candidate-panel mark');
  await expect(highlighted).toHaveText('Built monthly reports with SQL at Example Company.');
  expect(await highlighted.evaluate(mark => {
    const pre = mark.closest('pre')!;
    return mark.getBoundingClientRect().top >= pre.getBoundingClientRect().top && mark.getBoundingClientRect().top < pre.getBoundingClientRect().bottom;
  })).toBe(true);
  await mkdir('.local-checks', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '.local-checks/evidence-desktop.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '.local-checks/evidence-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('combobox', {name:'Recruiter recommendation for synthetic-cv.docx'}).selectOption('Move to next round');
  await page.getByRole('textbox', {name:'Recruiter note for synthetic-cv.docx'}).fill('Call to clarify Python');
  const recommendation = page.getByRole('region', {name:'Candidate recommendations'});
  for (const name of ['Recommendation','Top strengths','Gaps','Check on call']) await expect(recommendation.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(recommendation.locator('.candidate-snapshot')).toContainText('Maybe');
  await expect(recommendation.locator('.candidate-snapshot')).toContainText('Built monthly reports with SQL at Example Company.');
  await expect(recommendation.locator('.candidate-snapshot')).toContainText('No CV evidence.');
  await expect(page.getByRole('textbox', {name:'Recruiter note for synthetic-cv.docx'})).toHaveValue('Call to clarify Python');
  const snapshot = page.getByRole('region', {name:'Candidate snapshot for synthetic-cv'});
  await expect(snapshot.locator('.coverage-ring strong')).toHaveText('50%');
  await expect(snapshot.locator('.snapshot-stats strong').first()).toHaveText('1 of 1');
  await expect(snapshot.locator('.requirement-bar')).toHaveCount(1);
  await expect(snapshot.locator('.snapshot-other summary')).toHaveText('0 of 2 other requirements shown');
  await snapshot.locator('.snapshot-other summary').click();
  await expect(snapshot.locator('.other-requirements')).toBeVisible();
  await expect(snapshot.locator('.other-requirements')).toContainText('Check on call (unscored)');
  const downloadEvent = page.waitForEvent('download');
  await snapshot.getByRole('button', {name:'Download PDF'}).click();
  const download = await downloadEvent;
  const {readFile} = await import('node:fs/promises');
  const pdf = await readFile((await download.path())!);
  expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
  expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);
  const pageSize = pdf.toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)!;
  expect(Number(pageSize[1])).toBeCloseTo(595.28,2);
  expect(Number(pageSize[2])).toBeCloseTo(841.89,2);
  await page.getByRole('button', { name: 'Edit requirements' }).click();
  await expect(page.getByRole('heading', { name: 'Evidence for this candidate' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Assess this CV', exact: true })).toHaveCount(0);
  await page.getByLabel('Requirement 1', { exact: true }).fill('');
  await expect(page.getByRole('button', { name: 'Confirm requirements', exact: true })).toBeDisabled();
});

test('failed verification explains each cause without showing a zero-evidence candidate assessment', async ({ page }) => {
  await simulateActions(page, true);
  await page.goto('/');
  await page.getByLabel('Choose job description').setInputFiles({ name: 'jd.docx', mimeType: docxType, buffer: await word('A synthetic backend role requiring SQL experience and Python experience.') });
  await page.getByRole('button', { name: 'Extract requirements', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Extract requirements', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm requirements', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm requirements', exact: true }).click();
  await page.getByLabel('Choose candidate CV').setInputFiles({ name: 'cv.docx', mimeType: docxType, buffer: await word('An example applicant who claims SQL reporting experience in a synthetic CV.') });
  await page.getByRole('button', { name: 'Assess this CV', exact: true }).click();
  await page.getByText('View full evidence', { exact: true }).click();
  await expect(page.getByText('No verified assessment is available. Retry the assessment; you can still read the CV.')).toBeVisible();
  await expect(page.locator('.evidence-panel').getByText(/a quote that did not match/)).toBeVisible();
  await expect(page.locator('.evidence-panel').getByText(/claim without a supporting quote/)).toBeVisible();
  await expect(page.locator('.evidence-panel').getByText(/did not return an answer/)).toBeVisible();
  await expect(page.getByText(/0 of 3 requirements/)).toHaveCount(0);
  await expect(page.getByText('A fabricated quote', { exact: true })).toHaveCount(0);
});

test('reads every private Word CV and a PDF JD, and clears unreadable replacements without AI calls', async ({ page }) => {
  const directory = path.resolve('test-cvs');
  const files: string[] = await readdir(directory, { encoding: 'utf8' }).catch(() => [] as string[]);
  const wordFiles = files.filter(file => /\.docx$/i.test(file));
  test.skip(!files.includes('JD.pdf') || !wordFiles.length, 'Private test files are absent.');
  await simulateActions(page);
  await page.goto('/');
  await page.getByLabel('Choose job description').setInputFiles(path.join(directory, 'JD.pdf'));
  await expect(page.getByRole('button', { name: 'Extract requirements', exact: true })).toBeEnabled();
  expect((await page.locator('.role-column pre').textContent())!.length).toBeGreaterThan(30);
  await page.getByRole('button', { name: 'Add a requirement' }).click();
  await page.getByLabel('Requirement 1', { exact: true }).fill('Recruiter-confirmed requirement for file-reading test');

  await page.getByRole('button', { name: 'Confirm requirements', exact: true }).click();
  for (let i = 0; i < wordFiles.length; i++) {
    await page.getByLabel(i === 0 ? 'Choose candidate CV' : 'Replace candidate CV').setInputFiles(path.join(directory, wordFiles[i]));
    await expect(page.getByRole('button', { name: 'Assess this CV', exact: true })).toBeEnabled();
    expect((await page.locator('.candidate-panel pre').textContent())!.length).toBeGreaterThan(30);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.getByLabel('Replace candidate CV').setInputFiles({ name: 'broken.docx', mimeType: docxType, buffer: Buffer.from('broken') });
  await expect(page.getByRole('alert')).toContainText('could not be read');
  await expect(page.getByRole('button', { name: 'Assess this CV', exact: true })).toHaveCount(0);
  await page.getByLabel('Choose candidate CV').setInputFiles({ name: 'old-format.doc', mimeType: 'application/msword', buffer: Buffer.from('old Word file') });
  await expect(page.getByRole('alert')).toContainText('save it as .docx');
  await page.getByLabel('Choose candidate CV').setInputFiles(path.join(directory, wordFiles[0]));
  await expect(page.getByRole('button', { name: 'Assess this CV', exact: true })).toBeEnabled();
  const protectedFile = await page.request.get('/test-cvs/JD.pdf');
  expect(protectedFile.status()).toBe(403);
  console.log(`Read one PDF JD and ${wordFiles.length} Word CVs without sending document text to AI.`);
});

 test('pasted JD replaces the role and clears its old requirements', async ({page}) => {
  await simulateActions(page);
  await page.goto('/');
  await page.getByLabel('Paste job description').fill('Required SQL experience and Python experience for a backend role.');
  await page.getByRole('button', {name:'Use pasted JD'}).click();
  await expect(page.locator('.role-column pre')).toContainText('Required SQL experience');
  await page.getByRole('button', {name:'Extract requirements',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', {name:'Extract requirements',exact:true}).click();
  await expect(page.getByLabel('Requirement 1',{exact:true})).toBeVisible();
  await page.getByLabel('Paste job description').fill('A completely different role requiring hospital nursing experience.');
  await page.getByRole('button', {name:'Use pasted JD'}).click();
  await expect(page.getByLabel('Requirement 1',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Confirm the role first',{exact:true})).toBeVisible();
  await expect(page.locator('.role-column pre')).toContainText('hospital nursing');
 });

 test('unsupported JD and CV files ask for PDF or Word', async ({page}) => {
  await simulateActions(page);
  await page.goto('/');
  const bad = {name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('Text file content is not an uploaded Word or PDF document.')};
  await page.getByLabel('Choose job description').setInputFiles(bad);
  await expect(page.getByRole('alert')).toContainText('Please upload PDF or Word');
  await page.getByLabel('Paste job description').fill('A backend role requiring SQL experience for reporting.');
  await page.getByRole('button',{name:'Use pasted JD'}).click();
  await page.getByRole('button',{name:'Add a requirement'}).click();
  await page.getByLabel('Requirement 1',{exact:true}).fill('SQL experience');
  await page.getByRole('button',{name:'Confirm requirements',exact:true}).click();
  await page.getByLabel('Choose candidate CV').setInputFiles(bad);
  await expect(page.getByRole('alert')).toContainText('Please upload PDF or Word');
  await expect(page.getByRole('button',{name:'Assess this CV',exact:true})).toHaveCount(0);
 });
