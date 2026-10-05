import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyEvidence } from '../shared/evidence.ts';
import { buildPassages, selectedEvidence, applyEvidencePolicy, extractJDSources, completeRequirements, experienceWarnings, demoRequestLimit, displayExplanation } from '../shared/assessment.ts';

const requirements = [{ id: 'r1', text: 'SQL experience', mustHave: true }];
const cv = 'Built monthly reports with SQL at Example Company.';

test('only an exact CV quote can support a requirement', () => {
  const result = verifyEvidence(requirements, cv, [{ requirementId: 'r1', status: 'found', quotes: ['Built monthly reports with SQL'], explanation: 'SQL is documented.', question: 'Which queries did you write?' }]);
  assert.equal(result[0].status, 'found');
  assert.equal(result[0].quotes[0].start, 0);
  assert.equal(cv.slice(result[0].quotes[0].start, result[0].quotes[0].end), result[0].quotes[0].text);
});

test('invented or edited quotes cannot support a claim', () => {
  for (const quote of ['Managed a SQL team', 'built monthly reports with sql']) {
    const result = verifyEvidence(requirements, cv, [{ requirementId: 'r1', status: 'found', quotes: [quote], explanation: 'A fabricated claim.', question: 'Can you clarify?' }]);
    assert.equal(result[0].status, 'needs_checking');
    assert.deepEqual(result[0].quotes, []);
    assert.equal(result[0].explanation.includes('fabricated'), false);
  }
});

test('partial and conflicting claims also require valid quotes', () => {
  for (const status of ['partial', 'conflicting'] as const) {
    assert.equal(verifyEvidence(requirements, cv, [{ requirementId: 'r1', status, quotes: [], explanation: 'Unsupported claim.', question: '' }])[0].status, 'needs_checking');
  }
});

test('a missing assessment remains visible and unknown IDs are rejected', () => {
  assert.equal(verifyEvidence(requirements, cv, [])[0].status, 'needs_checking');
  assert.throws(() => verifyEvidence(requirements, cv, [{ requirementId: 'other', status: 'not_found', quotes: [], explanation: '', question: '' }]));
});

test('not found does not assert the candidate lacks a skill', () => {
  const result = verifyEvidence(requirements, cv, [{ requirementId: 'r1', status: 'not_found', quotes: [], explanation: 'The candidate cannot use SQL.', question: 'Tell me about SQL.' }]);
  assert.equal(result[0].status, 'not_found');
  assert.equal(result[0].explanation, 'No supporting evidence was found in this CV. This does not establish that the candidate lacks the requirement.');
});

test('verification failures distinguish missing rows, unmatched quotes and absent quotes', () => {
  assert.equal(verifyEvidence(requirements, cv, [])[0].verificationIssue, 'missing_row');
  assert.equal(verifyEvidence(requirements, cv, [{ requirementId: 'r1', status: 'found', quotes: ['Invented SQL work'], explanation: '', question: '' }])[0].verificationIssue, 'quote_mismatch');
  assert.equal(verifyEvidence(requirements, cv, [{ requirementId: 'r1', status: 'partial', quotes: [], explanation: '', question: '' }])[0].verificationIssue, 'missing_quotes');
});

test('one invalid quote keeps the claim unverified even when another quote is valid', () => {
  const row = verifyEvidence(requirements, cv, [{ requirementId: 'r1', status: 'found', quotes: ['Built monthly reports with SQL', 'Invented SQL work'], explanation: 'Unsupported interpretation', question: '' }])[0];
  assert.equal(row.status, 'needs_checking');
  assert.equal(row.verificationIssue, 'quote_mismatch');
  assert.deepEqual(row.quotes, []);
});

test('selected passages preserve the original whitespace and words; unknown IDs are rejected', () => {
  const text = 'Applicant\n\nResolved BSOD (Blue Screen of Death), startup failures.\n\n05/2015\nUniversity\nB.Com.';
  const passages = buildPassages(text);
  assert.equal(passages.map(p => p.text).join('\n\n'), text);
  const raw = selectedEvidence([{ requirementId: 'r1', status: 'partial', passageIds: [passages[1].id], explanation: '', question: '' }], passages);
  assert.equal(raw[0].quotes[0], 'Resolved BSOD (Blue Screen of Death), startup failures.');
  assert.throws(() => selectedEvidence([{ requirementId: 'r1', status: 'found', passageIds: ['invented'], explanation: '', question: '' }], passages));
});

test('communication self-claims never establish ability and exposure never proves strong knowledge', () => {
  for (const text of ['Excellent communication skills', 'Verify communication in a call', 'Culture fit']) {
    const req = [{ id: 'r1', text, mustHave: false }];
    const row = applyEvidencePolicy(req, verifyEvidence(req, cv, [{ requirementId: 'r1', status: 'found', quotes: [cv], explanation: 'Excellent ability', question: '' }]))[0];
    assert.equal(row.status, 'needs_checking');
    assert.match(row.explanation, /cannot establish/i);
  }
  const req = [{ id: 'r1', text: 'Strong knowledge of SQL', mustHave: true }];
  const row = applyEvidencePolicy(req, verifyEvidence(req, cv, [{ requirementId: 'r1', status: 'found', quotes: [cv], explanation: 'Confirms strong knowledge', question: '' }]))[0];
  assert.equal(row.status, 'partial');
  assert.match(row.explanation, /depth.*recruiter/i);
});

test('an open-ended experience summary cannot prove an upper bound', () => {
  const req = [{ id: 'r1', text: '1-7 years of experience', mustHave: false }];
  const text = 'Over 3+ years of experience.';
  const row = applyEvidencePolicy(req, verifyEvidence(req, text, [{ requirementId: 'r1', status: 'found', quotes: [text], explanation: 'Fully confirmed', question: '' }]))[0];
  assert.equal(row.status, 'partial');
  assert.match(row.explanation, /upper bound/i);
});

test('JD coverage restores omitted responsibilities with original quotes and separates independent tools', () => {
  const jd = 'Responsibilities\n• Support Windows and macOS.\n• Escalate issues to L2/L3 with documentation.\nPreferred Skills\n• Experience with DLP, Azure, MDM/Intune, and application support.\nQualifications\n• A related degree is preferred.';
  const sources = extractJDSources(jd);
  assert.equal(sources.length, 4);
  const drafts = completeRequirements(jd, sources, [{ text: 'Support Windows and macOS.', mustHave: false, sourceQuote: 'Support Windows and macOS.' }]);
  assert.ok(drafts.some(r => r.text.includes('L2/L3')));
  for (const tool of ['DLP', 'Azure', 'MDM/Intune', 'application support']) assert.ok(drafts.some(r => r.text === `Experience with ${tool}.`));
  assert.ok(drafts.every(r => r.sourceQuote && jd.includes(r.sourceQuote)));
  assert.ok(drafts.find(r => r.text.includes('degree'))?.mustHave === false);
});

test('conflicting experience ranges are surfaced while identical repeated ranges are not', () => {
  assert.equal(experienceWarnings(['1-7 years of experience', '1-3 years in a support role']).length, 1);
  assert.equal(experienceWarnings(['1-3 years of experience', '1–3 years in support']).length, 0);
});

test('coverage retains experience outside bullet sections and splits ITIL from ticketing', () => {
  const jd = 'Years of Experience   1-7 years\nMandatory Skills\nl   Familiarity with ITIL processes and ticketing systems.\nQualifications\nl   1-3 years of experience in support.';
  const sources = extractJDSources(jd);
  const rows = completeRequirements(jd, sources, []);
  assert.ok(rows.some(r => r.text.includes('1-7 years')));
  assert.ok(rows.some(r => r.text === 'Familiarity with ITIL processes.'));
  assert.ok(rows.some(r => r.text === 'Familiarity with ticketing systems.'));
  assert.equal(experienceWarnings(rows.map(r => r.text)).length, 1);
});

test('experience ranges use non-overlapping job dates, not a model claim that four years fits within three', () => {
  const req = [{ id: 'r1', text: '1-3 years of support experience', mustHave: false }];
  const text = 'Worked as a Service Desk Engineer from Dec 2021 to Aug 2025.';
  const row = applyEvidencePolicy(req, verifyEvidence(req, text, [{ requirementId: 'r1', status: 'found', quotes: [text], explanation: '4 years fits 1-3 years or more', question: '' }]))[0];
  assert.equal(row.status, 'needs_checking');
  assert.match(row.explanation, /44 months/);
  assert.match(row.explanation, /outside/i);
  const wide = [{ ...req[0], text: '1-7 years of support experience' }];
  assert.equal(applyEvidencePolicy(wide, verifyEvidence(wide, text, [{ requirementId: 'r1', status: 'found', quotes: [text], explanation: '', question: '' }]))[0].status, 'found');
  const overlap = 'Support role Jan 2021 to Jan 2023. Other support role Jan 2022 to Jan 2024.';
  const overlapped = applyEvidencePolicy(req, verifyEvidence(req, overlap, [{ requirementId: 'r1', status: 'found', quotes: [overlap], explanation: 'Four years', question: '' }]))[0];
  assert.match(overlapped.explanation, /36 months/);
  assert.equal(overlapped.status, 'partial');
});

test('ordinary Microsoft 365 work cannot establish DLP or all tools in a combined requirement', () => {
  const text = 'Microsoft 365 administration. Intune device enrollment and application deployment.';
  const req = [{ id: 'r1', text: 'Experience with O365 DLP, Azure, MDM/Intune, and application support', mustHave: false }];
  const row = applyEvidencePolicy(req, verifyEvidence(req, text, [{ requirementId: 'r1', status: 'found', quotes: [text], explanation: 'DLP via Microsoft 365', question: '' }]))[0];
  assert.equal(row.status, 'partial');
  assert.match(row.explanation, /O365 DLP/);
  assert.match(row.explanation, /Azure/);
  const dlp = [{ ...req[0], text: 'Experience with O365 DLP.' }];
  assert.equal(applyEvidencePolicy(dlp, verifyEvidence(dlp, text, [{ requirementId: 'r1', status: 'found', quotes: [text], explanation: '', question: '' }]))[0].status, 'needs_checking');
});

test('the demo budget stays bounded and malformed overrides retain the normal cap', () => {
  for (const value of [undefined, '', 'NaN', '0', '-1', '30.5']) assert.equal(demoRequestLimit(value), 30);
  assert.equal(demoRequestLimit('45'), 45);
  assert.equal(demoRequestLimit('999'), 60);
});

test('recruiter explanations omit internal passage references and retain incident priorities', () => {
  assert.equal(displayExplanation('The CV describes P1/P2 incidents (p2, p14, p16, p17).'), 'The CV describes P1/P2 incidents.');
  assert.equal(displayExplanation('Job dates (p22-p24 and p43) need checking.'), 'Job dates need checking.');
});
