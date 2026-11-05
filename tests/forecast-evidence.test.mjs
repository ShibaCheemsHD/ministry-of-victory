import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync(new URL('../src/app/02a-forecast-evidence.js', import.meta.url), 'utf8');
const evidence = vm.runInNewContext(src + '\nforecastEvidence');
const H = 3600e3, now = Date.parse('2026-11-05T12:00:00Z');
function planet() {
  const r = { idx: 0, verdict: 'ontrack', planet: { index: 7, maxHealth: 1e6 }, pw: { hasRegions: false }, fc: { local: 11, global: 10, localC: 100000 } };
  const ctx = { now, updated: now, capSrc: 'kMeasured', samples: Array.from({ length: 37 }, (_, k) => ({ t: now - (36-k)*H/6, planets: { 7: { h: 850000-k*1000, r: 1 } } })) };
  return { res: { verdict: 'ontrack', tasks: [r] }, ctx, r };
}
function counter() {
  const r = { idx: 0, verdict: 'ontrack', counter: true, primary: { kind: 'day', hours: 24, rate: 600 }, rates: { recent: { hours: 1, rate: 600 } } };
  const ctx = { now, updated: now, progKey: 'order-key', start: now-24*H, samples: Array.from({ length: 145 }, (_, k) => ({ t: now-(144-k)*H/6, prog: { 'order-key': [k*100] } })) };
  return { res: { verdict: 'ontrack', tasks: [r] }, ctx, r };
}
test('well observed describes evidence, independently of winning or losing', () => {
  const { res, ctx } = planet();
  assert.equal(evidence(res, ctx).level, 2);
  res.verdict = 'impossible';
  assert.equal(evidence(res, ctx).level, 2);
  assert.equal(evidence(res, { ...ctx, capSrc: 'kDefault' }).level, 1);
  assert.ok(evidence(res, { ...ctx, capSrc: 'kDefault' }).reasons.includes('reference'));
});
test('stale snapshots and missing history cannot acquire strong evidence', () => {
  const { res, ctx } = planet();
  for (const patch of [{ stale: { t: now } }, { seeded: true }, { updated: now-16*60e3 }, { updated: now+1 }, { samples: [] }]) assert.equal(evidence(res, { ...ctx, ...patch }).level, 0);
  assert.equal(evidence(res, { ...ctx, samples: ctx.samples.slice(0, 25) }).level, 0);
});
test('duplicates, invalid readings and future readings cannot inflate coverage', () => {
  const { res, ctx } = planet(), one = ctx.samples.at(-1);
  const samples = [...Array(50).fill(one), null, { ...one, t: now+H }, { t: now-H, planets: { 7: { h: NaN } } }];
  assert.equal(evidence(res, { ...ctx, samples }).level, 0);
  assert.equal(evidence(res, { ...ctx, samples: [...ctx.samples].reverse() }).level, 2);
});
test('local changes, pace divergence, regions, gaps and custom assumptions are explained', () => {
  for (const mutation of [
    f => { f.r.fc.local = 30; },
    f => { f.r.pw.hasRegions = true; },
    f => { f.ctx.customized = true; },
    f => { f.ctx.samples.at(-1).planets[7].r = 2; },
    f => { f.ctx.samples.at(-1).planets[7].h -= 100000; },
    f => { f.ctx.samples.splice(15, 6); },
    f => { f.r.fc.localC = null; },
  ]) { const f = planet(); mutation(f); assert.equal(evidence(f.res, f.ctx).level, 1); }
});
test('a new defense cannot borrow the previous campaign history', () => {
  const { res, ctx, r } = planet();
  r.planet.event = { maxHealth: 1e6, startTime: new Date(now-H/2).toISOString() };
  r.defense = { observed: { net: 1000 } };
  assert.equal(evidence(res, ctx).level, 0);
});
test('all required tasks use the weakest evidence, options only use the chosen task', () => {
  const { res, ctx } = planet();
  res.tasks.push({ verdict: 'unknown', simpleCount: true });
  assert.equal(evidence(res, ctx).level, 0);
  res.anyOf = true; res.pick = 0;
  assert.equal(evidence(res, ctx).level, 2);
  res.pick = 1; assert.equal(evidence(res, ctx).level, 0);
});
test('counter history must cover a cycle and agree with recent pace; zero pace remains meaningful', () => {
  const { res, ctx, r } = counter();
  assert.equal(evidence(res, ctx).level, 2);
  r.rates.recent.rate = 1200; assert.equal(evidence(res, ctx).level, 1);
  r.primary.rate = 0; r.rates.recent.rate = 0; assert.equal(evidence(res, ctx).level, 2);
  r.primary = { kind: 'recent', hours: .5, rate: 600 }; r.early = true;
  assert.equal(evidence(res, ctx).level, 0);
});
test('ended outcomes and completed objectives do not get a prediction evidence badge', () => {
  const { res, ctx } = planet();
  assert.equal(evidence({ ...res, ended: true }, ctx), null);
  assert.equal(evidence({ ...res, verdict: 'done' }, ctx), null);
  assert.equal(evidence({ ...res, verdict: 'failed' }, ctx), null);
  res.tasks.push({ verdict: 'done' }); assert.equal(evidence(res, ctx).level, 2);
});
