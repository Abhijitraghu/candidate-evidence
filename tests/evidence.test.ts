import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyEvidence } from '../shared/evidence.ts';

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
