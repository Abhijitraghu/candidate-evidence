import { test, expect } from '@playwright/test';
import { readdirSync } from 'node:fs';
import path from 'node:path';

// Real documents stay in the ignored folder. No fixture contents, screenshots, or traces are committed.
const fixtureDir = path.resolve('test-cvs');
const files = (() => { try { return readdirSync(fixtureDir); } catch { return []; } })();
const cvName = files.find(file => /\.docx$/i.test(file));

test('recruiter confirms a JD before inspecting exact evidence for one CV', async ({ page }) => {
  test.skip(!files.includes('JD.pdf') || !cvName, 'Add a JD.pdf and a .docx CV to the ignored test-cvs folder.');
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Confirm the role first', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Choose candidate CV')).toHaveCount(0);
  await page.getByLabel('Choose job description').setInputFiles(path.join(fixtureDir, 'JD.pdf'));
  await expect(page.getByRole('button', { name: 'Extract requirements', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Extract requirements', exact: true }).click();
  await Promise.race([
    page.getByRole('button', { name: 'Confirm requirements', exact: true }).waitFor({ state: 'visible', timeout: 120000 }).then(async () => { await expect(page.getByRole('button', { name: 'Confirm requirements', exact: true })).toBeEnabled({ timeout: 120000 }); }),
    page.getByRole('alert').waitFor({ state: 'visible', timeout: 120000 }).then(async () => { throw new Error(await page.getByRole('alert').innerText()); }),
  ]);
  const requirements = page.locator('textarea');
  expect(await requirements.count()).toBeGreaterThan(0);
  const originalText = await requirements.first().inputValue();
  await requirements.first().fill('');
  await expect(page.getByRole('button', { name: 'Confirm requirements', exact: true })).toBeDisabled();
  await requirements.first().fill(originalText);
  await page.getByRole('button', { name: 'Add a requirement', exact: true }).click();
  await requirements.last().fill('Recruiter call: verify communication ability');
  const editedRequirement = await requirements.count();
  await page.getByRole('checkbox', { name: 'Must-have', exact: true }).last().check();
  await page.getByRole('button', { name: 'Confirm requirements', exact: true }).click();
  await page.getByLabel('Choose candidate CV').setInputFiles(path.join(fixtureDir, cvName!));
  await expect(page.getByRole('button', { name: 'Assess this CV', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Assess this CV', exact: true }).click();
  await Promise.race([
    page.getByRole('heading', { name: 'Evidence for this candidate', exact: true }).waitFor({ state: 'visible', timeout: 120000 }),
    page.getByRole('alert').waitFor({ state: 'visible', timeout: 120000 }).then(async () => { throw new Error(await page.getByRole('alert').innerText()); }),
  ]);
  const rows = page.locator('.evidence-row');
  expect(await rows.count()).toBe(editedRequirement);
  const cvText = await page.locator('.candidate-panel pre').textContent();
  const quotes = await page.locator('.cv-quote blockquote').allTextContents();
  expect(quotes.length).toBeGreaterThan(0);
  for (const quote of quotes) expect(cvText?.includes(quote)).toBe(true);
  const communication = rows.filter({ has: page.getByRole('heading', { name: 'Recruiter call: verify communication ability' }) });
  await expect(communication.getByText('Evidence found', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'See this quote in the CV', exact: true }).first().click();
  await expect(page.locator('.candidate-panel mark')).toBeVisible();
  await page.getByRole('button', { name: 'Edit requirements', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Evidence for this candidate' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Assess this CV', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirm requirements', exact: true }).click();
  // A corrupt replacement must remove both the old CV and its result.
  await page.getByLabel('Replace candidate CV').setInputFiles({ name: 'unreadable.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('not a Word file') });
  await expect(page.getByRole('alert')).toContainText('could not be read');
  await expect(page.getByRole('button', { name: 'Assess this CV', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Evidence for this candidate' })).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});
