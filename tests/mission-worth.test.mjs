import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { measureMissionImpact } from '../recorder/measure.mjs';

// Ten clean intervals: 3000 HP lost, 600 HP regen, 30 wins, multiplier 2 => 60 HP/win/unit.
const samples = (n = 11) => Array.from({ length: n }, (_, k) => ({ t: 1000000 + k * 600000, imp: 2,
  hod: false, dss: null, pl: { 1: [900000 - k * 3000, 1000, 1, 1000000, null, 0, 'Automaton', null, k * 30] } }));

test('mission calibration keeps the fallback distinct from measured data, even when the value is 100', () => {
  assert.equal(measureMissionImpact([]).source, 'default');
  assert.equal(measureMissionImpact(samples(10)).source, 'default');
  const s = samples();
  s.forEach((x, k) => { x.pl[1][0] = 900000 - k * 5400; });
  const result = measureMissionImpact(s);
  assert.equal(result.value, 100);
  assert.equal(result.source, 'measured');
  assert.equal(result.samples, 10);
  assert.equal(result.updated, s.at(-1).t);
});

test('mission calibration includes regen and excludes station bonuses, region captures and resets', () => {
  assert.equal(measureMissionImpact(samples()).value, 60);
  for (const mutate of [s => s.forEach(x => { x.dss = 1; }), s => s.forEach(x => { x.hod = true; }),
    s => s.forEach(x => { x.pl[1][5] = 1; }), s => s.forEach(x => { x.pl[1][8] = 0; })]) {
    const s = samples(); mutate(s);
    assert.equal(measureMissionImpact(s).source, 'default');
    assert.equal(measureMissionImpact(s).samples, 0);
  }
});

// Exercise the actual browser calculation without a DOM; do not duplicate its formula in this test.
const source = fs.readFileSync(new URL('../src/app/02-directive.js', import.meta.url), 'utf8');
const calc = source.slice(source.indexOf('  function missionWorth('), source.indexOf('  // a tiny percentage'));
function worth(planet = {}, state = {}) {
  const context = { last: { imp: 2, inf: 100, dssIdx: null, hod: false, ...state },
    settings: { dssBonus: .1, hodMult: 1.8 }, ENGINE: { DEFAULTS: { hodOther: .7 } },
    p: { index: 1, currentOwner: 'Automaton', health: 100000, maxHealth: 1000000, ...planet } };
  return vm.runInNewContext(calc + '\nmissionWorth(p)', context);
}
test('legacy recorder values never claim measured provenance; explicit matching evidence does', () => {
  assert.equal(worth().measured, false);
  assert.equal(worth({}, { infMeasurement: { value: 100, source: 'default', samples: 9 } }).measured, false);
  assert.equal(worth({}, { infMeasurement: { value: 100, source: 'measured', samples: 10 } }).measured, true);
  assert.equal(worth({}, { infMeasurement: { value: 200, source: 'measured', samples: 10 } }).measured, false);
});
test('region worlds do not show a misleading planet-only total; defense uses event health', () => {
  assert.equal(worth({ regions: [{ isAvailable: true, health: 100 }] }).left, null);
  assert.equal(worth({ event: { health: 10000, maxHealth: 100000 } }).left, 50);
  assert.equal(worth({ health: 100000 }).left, 500);
  assert.equal(worth({ health: NaN }), null);
  assert.equal(worth({}, { imp: Infinity }), null);
});
