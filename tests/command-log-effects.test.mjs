import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/app/01-intel.js', import.meta.url), 'utf8');
const effects = JSON.parse(fs.readFileSync(new URL('../src/game/planetEffects.json', import.meta.url), 'utf8'));
const code = source.slice(source.indexOf('  function deploymentName('), source.indexOf('  function planetList('));
const dict = fs.readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8');
const a = vm.runInNewContext(dict + '\nconst t=k=>k.split(".").reduce((o,p)=>o?.[p],TEXT);\n' + code + '\n({isSeafEffect, extractionSeconds, effectLabel, effectExplanation})', {
  GAME: {fx:Object.fromEntries(Object.entries(effects).map(([k,v])=>[k,{n:v.name,d:v.description}]))}, valOf:(v,t)=>v?.find(x=>x[0]===t)?.[1] ?? null,
  fmt:String,esc:String,plain:String,clean:String,enemyKnown:()=>false,titleCase:s=>s.toLowerCase().replace(/\b\w/g,x=>x.toUpperCase()),fill:(s,p)=>s.replace(/\{(\w+)\}/g,(_,k)=>p[k]),
});
test('SEAF is allied support, not an enemy division despite the raw Enemies suffix',()=>{
  assert.equal(a.isSeafEffect({type:40,eid:1401}),true);
  assert.match(a.effectLabel(40,[[16,3126357841]],1401),/allied troops/);
  assert.doesNotMatch(a.effectLabel(40,[],1401),/enemy division/i);
  assert.match(a.effectExplanation({type:40,eid:1401}),/friendly support/);
});
test('deployment ids name Caustic, unknown division hashes never become guessed strains',()=>{
  assert.match(a.effectLabel(40,[[16,585432236]],1430),/Caustic Strain/);
  assert.match(a.effectLabel(40,[[16,903954334]],1434),/not yet identified/);
});
test('extraction modifiers preserve units, direction and removal semantics',()=>{
  const v=[[3,0],[1,20]];
  assert.equal(a.extractionSeconds(v),20);
  assert.match(a.effectLabel(21,v,1312),/\+20 seconds/);
  assert.match(a.effectExplanation({type:21,v,on:true,kind:'effect'}),/Adds 20 seconds/);
  assert.match(a.effectExplanation({type:21,v,on:false,kind:'effect'}),/was removed/);
  assert.match(a.effectExplanation({type:21,v:[[3,0],[1,-20]],kind:'active'}),/Removes 20 seconds/);
  assert.equal(a.extractionSeconds([[3,99],[1,20]]),null);
});
