import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cumulativeCounts,pipelineCSV} from '../shared/pipeline.ts';
test('counts include every preceding stage and default existing candidates to Applied',()=>{
 assert.deepEqual(cumulativeCounts([{}, {stage:'Interviewed'},{stage:'Offered'}]),[3,2,1,1,1]);
 assert.deepEqual(cumulativeCounts([{stage:'Applied'}]),[1,0,0,0,0]);
});
test('CSV escapes opening names and uses cumulative counts',()=>{
 assert.equal(pipelineCSV([{name:'Role, "A"',candidates:[{stage:'Offered'}]}]),'"Opening name","Applied","Interviewed","Shortlisted","Selected","Offered"\r\n"Role, ""A""","1","1","1","1","1"\r\n');
});
