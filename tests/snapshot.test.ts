import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recommend, draftRule} from '../shared/recommendation.ts';
import {snapshotContent} from '../src/lib/snapshot.ts';

test('snapshot uses distinct short work-history quotes, selects a must-have skill, and leaves the assessment unchanged', () => {
  const requirements = [
    {id:'years',text:'1-7 years',mustHave:true,sourceQuote:null},
    {id:'sql',text:'SQL',mustHave:true,sourceQuote:null},
    {id:'python',text:'Python',mustHave:true,sourceQuote:null},
    {id:'optional',text:'Docker',mustHave:false,sourceQuote:null},
    ...['Java','Rust','Go','Azure'].map((text,i)=>({id:`gap${i}`,text,mustHave:i>1,sourceQuote:null})),
  ];
  const rules = Object.fromEntries(requirements.map(r=>[r.id,{...draftRule(r),assessmentMonth:'2026-10'}]));
  const cv = 'Profile Summary\nManaged SQL and Python reporting in the profile summary.\nWork Experience\nJan 2025 - Sep 2026\nManaged SQL and Python reporting for customers.\nDeveloped Python automation for support tickets.\nManaged Docker deployments for the support team.\nTechnical Skills\nSupported SQL outside the work history.';
  const result = recommend(Object.values(rules),cv);
  const before = JSON.stringify(result);
  const snapshot = snapshotContent(result,requirements,rules,cv);
  assert.equal(snapshot.strongest?.id,'sql');
  assert.deepEqual(snapshot.strengths.map(s=>s.quote),['Managed SQL and Python reporting for customers.','Developed Python automation for support tickets.','Managed Docker deployments for the support team.']);
  assert.equal(new Set(snapshot.strengths.map(s=>s.quote)).size,3);
  assert.ok(snapshot.strengths.every(s=>s.quote.split(/\s+/).length<25));
  assert.equal(snapshot.gaps.length,3);
  assert.deepEqual(snapshot.gaps.slice(0,2).map(r=>r.id),['gap2','gap3']);
  assert.equal(snapshot.must.length,5);
  assert.equal(snapshot.otherShown,1);
  assert.equal(JSON.stringify(result),before);
});
test('summary-only, long, duplicate and ambiguous quotes never become top strengths', () => {
 const requirement = {id:'sql',text:'SQL',mustHave:true,sourceQuote:null};
 const rules = {sql:draftRule(requirement)};
 for (const cv of ['Profile Summary\nManaged SQL reporting for several customers.', 'Work Experience\nManaged SQL '+ 'reporting '.repeat(25), 'Technical Skills\nManaged SQL reporting for several customers.']) {
  assert.equal(snapshotContent(recommend([rules.sql],cv),[requirement],rules,cv).strengths.length,0);
 }
});

test('verdict names evidence gaps without changing the assessment', async () => {
 const {verdict} = await import('../src/lib/verdict.ts');
 const requirements = [{id:'sql',text:'SQL',mustHave:true,sourceQuote:null},{id:'python',text:'Python',mustHave:false,sourceQuote:null}];
 const rules = requirements.map(draftRule);
 for (const [cv,expected] of [['SQL Python','I recommend this candidate'],['Learning SQL','Recommend only if the call confirms: SQL'],['Python','I do not recommend this candidate: missing SQL'],['SQL\nLearning Python','Recommend only if the call confirms: Python']]) {
  const result = recommend(rules,`Candidate CV with professional experience.\n${cv}`);
  const before = JSON.stringify(result);
  assert.equal(verdict(result,requirements),expected);
  assert.equal(JSON.stringify(result),before);
 }
});
