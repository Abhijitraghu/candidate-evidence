import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cumulativeCounts,pipelineCSV} from '../shared/pipeline.ts';
test('counts include every preceding stage and default existing candidates to Applied',()=>{
 assert.deepEqual(cumulativeCounts([{}, {stage:'Interviewed'},{stage:'Offered'}]),[3,2,1,1,1,0]);
 assert.deepEqual(cumulativeCounts([{stage:'Applied'}]),[1,0,0,0,0,0]);
});
test('CSV escapes opening names and uses cumulative counts',()=>{
 assert.equal(pipelineCSV([{name:'Role, "A"',candidates:[{stage:'Offered'}]}]),'"Opening name","Applied","Interviewed","Shortlisted","Selected","Offered","Joined"\r\n"Role, ""A""","1","1","1","1","1","0"\r\n');
});

test('Joined counts in all stages without changing existing stages',()=>{
 const rows=[{stage:'Offered' as const},{stage:'Joined' as const},{stage:'Interviewed' as const}];
 assert.deepEqual(cumulativeCounts(rows),[3,3,2,2,2,1]);
 assert.deepEqual(rows.map(r=>r.stage),['Offered','Joined','Interviewed']);
});
