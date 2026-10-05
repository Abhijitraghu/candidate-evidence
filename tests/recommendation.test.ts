import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, draftRule, approvedRequirements, type EvidenceRule } from '../shared/recommendation.ts';
const rule = (id:string, mustHave=false): EvidenceRule => ({id,text:id,mustHave,groups:[[id]],interviewOnly:false});
const cv = (skills:string) => `Candidate CV with professional experience.\n${skills}`;
test('recommendations gate on must-haves and the 80 percent boundary', () => {
 const rules = ['SQL','Python','Java','Go','Rust'].map((id,i) => rule(id,i===0));
 assert.equal(recommend(rules,cv('SQL Python Java Go')).recommendation,'Move to next round');
 assert.equal(recommend(rules,cv('SQL Python Java')).recommendation,'Maybe');
 const missing = recommend(rules,cv('Python Java Go Rust'));
 assert.equal(missing.recommendation,'Not now'); assert.deepEqual(missing.missingMustHaves,['SQL']);
});
test('limited or negative claims are partial and cannot satisfy a must-have', () => {
 for (const text of ['Basic SQL exposure','Learning SQL']) {
 const result = recommend([rule('SQL',true)],cv(text));
 assert.equal(result.recommendation,'Not now'); assert.equal(result.evidence[0].status,'partial'); assert.equal(result.coverage,50);
 }
});
test('communication is excluded from gates and coverage, unreadable input has no recommendation', () => {
 const result = recommend([rule('SQL',true),draftRule({id:'c',text:'Excellent communication',mustHave:true})],cv('SQL'));
 assert.equal(result.recommendation,'Move to next round'); assert.equal(result.coverage,100);
 assert.throws(() => recommend([rule('SQL')],'short'),/Unable to assess/);
});
test('every reason has exact source offsets and repeat runs are deeply identical', () => {
 const text = cv('SQL reporting.\nPython development.');
 const first = recommend([rule('SQL',true),rule('Python')],text);
 for (const row of first.evidence) for (const quote of row.quotes) assert.equal(text.slice(quote.start,quote.end),quote.text);
 assert.deepEqual(recommend([rule('SQL',true),rule('Python')],text),first);
});
test('word boundaries prevent AD from matching administrator and aliases are explicit', () => {
 const r = draftRule({id:'a',text:'Active Directory',mustHave:true});
 assert.equal(recommend([r],cv('Administrator of systems')).recommendation,'Not now');
 assert.equal(recommend([r],cv('AD administration')).recommendation,'Move to next round');
});
test('experience uses the confirmed month and counts overlapping dates once', () => {
 const r = {...rule('dates'),text:'1-3 years',assessmentMonth:'2026-10'};
 const result = recommend([r],cv('Jan 2025 - Present\nFeb 2025 - Sep 2026'));
 assert.equal(result.evidence[0].status,'found'); assert.match(result.evidence[0].explanation,/21 months/);
 assert.deepEqual(recommend([r],cv('Jan 2025 - Present\nFeb 2025 - Sep 2026')),result);
});

test('explicit denial of a must-have is Not now with the original quote', () => { const result = recommend([rule('SQL',true)],cv('No SQL experience')); assert.equal(result.recommendation,'Not now'); assert.equal(result.evidence[0].status,'conflicting'); assert.equal(result.evidence[0].quotes[0].text,'No SQL experience'); });

test('approved ITIL alternatives count and call checks are not must-haves', () => {
 const r=draftRule({id:'itil',text:'Familiarity with ITIL processes.',mustHave:true});
 for (const phrase of ['ITIL','ITSM','incident management']) assert.equal(recommend([r],cv(`Worked with ${phrase}`)).recommendation,'Move to next round');
 const rows=approvedRequirements([{id:'wide',text:'1-7 years',mustHave:false},{id:'short',text:'1-3 years',mustHave:false},{id:'c',text:'Excellent communication skills',mustHave:true},{id:'a',text:'Analytical skills to troubleshoot and resolve issues efficiently.',mustHave:true}]);
 assert.deepEqual(rows.map(r=>r.id),['wide','short','c','a']);
 for(const row of rows.slice(2)) {assert.equal(row.mustHave,false);assert.equal(draftRule(row).interviewOnly,true);}
 assert.equal(recommend([rule('SQL',true),...rows.slice(2).map(draftRule)],cv('SQL')).recommendation,'Move to next round');
});

test('new roles automatically get bounded rules instead of requiring the full JD sentence', () => {
 const r = draftRule({id:'new', text:'Required: Python development experience building reliable backend services. ' + 'Experience developing applications. '.repeat(7), mustHave:true});
 assert.ok(r.groups.every(g=>g.every(t=>t.length<=200)));
 assert.ok(r.groups.length<=50);
 const python = draftRule({id:'p',text:'Required experience with Python',mustHave:true});
 assert.equal(recommend([python],cv('Developed Python applications')).recommendation,'Move to next round');
});

 test('unrelated CVs with no must-haves also return Not now', () => {
 assert.equal(recommend([rule('SQL'),rule('Python')],cv('Restaurant cook and menu planning')).recommendation,'Not now');
 });
