import test from 'node:test';
import assert from 'node:assert/strict';
import {paceCall, recordDeadlines, deadlineScores} from '../recorder/deadlines.mjs';
const h=3600000, exp=100*h;
test('checkpoint retains the last pre-cutoff call including stalled planets and scores observed outcomes only',()=>{
  const call={exp,tasks:[{type:11}],prog:[0],last:{t:exp-60000},result:'lost'};
  const r={task:{type:11},idx:0,planet:{index:7,health:50},pw:{},eta:1};
  recordDeadlines(call,[r],[],exp-6.5*h);
  r.eta=Infinity;recordDeadlines(call,[r],[],exp-6*h);
  r.eta=1;recordDeadlines(call,[r],[],exp-5.9*h);
  const engine={parseTask:()=>({planetIndex:7})}, score=()=>deadlineScores({call},engine)[6];
  assert.equal(score().correct,1);
  call.last.t-=h;assert.equal(score().unknown,1);
  call.track={fell:{7:exp-h}};assert.equal(score().missedWins,1);
});
test('community comparator uses the preceding complete interval and rejects sparse samples',()=>{
 const pts=[{t:h,h:120},{t:2*h,h:100},{t:3*h,h:99}];
 assert.equal(paceCall(pts,99,5),true);
 assert.equal(paceCall(pts.slice(1),99,5),null);
});
