import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const s=fs.readFileSync(new URL('../src/app/06-objectives-strategy.js',import.meta.url),'utf8');
const order=vm.runInNewContext(s.slice(s.indexOf('  function raceOrder('),s.indexOf('  function objectivesHTML('))+'\nraceOrder');
const ids=r=>Array.from(order(r),x=>x.idx);
test('recommendation leads, done is separate and original objective ids survive sorting',()=>{
 const tasks=[{idx:0,verdict:'done'},{idx:1,verdict:'impossible'},{idx:2,verdict:'ontrack',planet:{index:7}}];
 assert.deepEqual(ids({tasks,directive:{planet:{index:7}}}),[2,1,0]);
 assert.deepEqual(tasks.map(x=>x.idx),[0,1,2]);
 assert.deepEqual(ids({tasks,anyOf:true,pick:1}),[1,2,0]);
});
test('imminent defenses precede stable races; larger shortfalls precede smaller ones',()=>{
 const tasks=[{idx:0,verdict:'effort',counter:true,projection:90,task:{goal:100}},{idx:1,verdict:'effort',counter:true,projection:30,task:{goal:100}},{idx:2,verdict:'ontrack',defense:{hoursToEnd:2}}];
 assert.deepEqual(ids({tasks}),[2,1,0]);
});
