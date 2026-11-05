import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const s=fs.readFileSync(new URL('../src/app/00b-resistance-events.js',import.meta.url),'utf8');
const api=vm.runInNewContext(s+'\n({mergeResistanceEvents, unrepresentedEffectPlanets, uniqueIntelEvents, uniqueDispatches})');
const t=1e9;
const regen=(idx=270,time=t)=>({kind:'regen',idx,t:time,from:.017,to:-.005});
const effect=(planets=[270],time=t)=>({kind:'effect',type:77,eid:100,on:true,planets,t:time});
test('same-planet setting and numeric observation appear once, with original evidence preserved',()=>{
 const input=[regen(),effect()],saved=JSON.stringify(input);
 const out=api.mergeResistanceEvents(input);
 assert.equal(out.length,1);assert.equal(out[0].kind,'regen');assert.equal(out[0].to,-.005);
 assert.equal(out[0].resistanceEffects[0].eid,100);assert.equal(JSON.stringify(input),saved);
 assert.equal(api.unrepresentedEffectPlanets({id:100,planets:[270]},out).length,0);
});
test('settings for other planets are retained, including their active status',()=>{
 const out=api.mergeResistanceEvents([regen(),effect([270,75])]);
 assert.equal(out.length,2);assert.deepEqual(Array.from(out[1].planets),[75]);
 assert.deepEqual(Array.from(api.unrepresentedEffectPlanets({id:100,planets:[270,75,7]},out)),[7]);
});
test('different planets, global effects, distant updates and unrelated modifiers stay independent',()=>{
 for(const e of [effect([75]),effect([-1]),effect([270],t+13*60e3),{...effect(),type:90},{...effect(),type:88}]) assert.equal(api.mergeResistanceEvents([regen(),e]).length,2);
});
test('closest change wins; a removed setting does not suppress a currently active effect',()=>{
 const out=api.mergeResistanceEvents([regen(270,t-10*60e3),regen(),{...effect(),on:false}]);
 assert.equal(out[0].resistanceEffects,undefined);assert.equal(out[1].resistanceEffects.length,1);
 assert.deepEqual(Array.from(api.unrepresentedEffectPlanets({id:100,planets:[270]},out)),[270]);
});

test('duplicate source observations and planet batches collapse without hiding on/off transitions',()=>{
 const first=effect([270]),other=effect([75],t+30e3);
 const input=[first,other,{...first,t:t+20e3},{...first,on:false},{...first,t:t+2*60e3}];
 const saved=JSON.stringify(input),out=api.uniqueIntelEvents(input);
 assert.equal(out.length,3);assert.deepEqual(Array.from(out[0].planets),[270,75]);
 assert.equal(out[1].on,false);assert.equal(JSON.stringify(input),saved);
 assert.equal(api.mergeResistanceEvents([regen(),regen(),effect(),effect()]).length,1);
});
test('identical dispatch copies collapse, later dispatches and different messages remain',()=>{
 const out=api.uniqueDispatches([{id:1,t,msg:'New directive'}, {id:1,t,msg:'New directive'},
  {id:2,t,msg:'New  directive'}, {id:3,t:t+1,msg:'New directive'}, {id:4,t,msg:'Other directive'}]);
 assert.deepEqual(Array.from(out,x=>x.id),[1,3,4]);
});
