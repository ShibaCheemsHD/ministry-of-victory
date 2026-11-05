import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/app/01-intel.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('  function intelCategory('), source.indexOf('  function intelTabHTML('));
const api = vm.runInNewContext(code + '\n({intelCategory, intelImpact, intelKey, intelBuckets})', {});
test('command log groups simultaneous events without losing or overlapping entries', () => {
  const events = Array.from({ length: 80 }, (_, i) => ({ kind: i % 2 ? 'regen' : 'effect', type: 77, t: 4000 + i, eid: i, from: .01, to: .02 }));
  const groups = api.intelBuckets(events, 0, 10000, 4);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].events.length, 80);
  const keys = events.map(api.intelKey);
  assert.equal(new Set(keys).size, 80);
  assert.equal(api.intelKey(events[0]), api.intelKey({ ...events[0] }));
  assert.equal(api.intelBuckets([{ kind: 'news', t: 10000 }], 0, 10000, 4)[0].slot, 3);
});
test('event type never implies impact: lower resistance helps, higher resistance hurts', () => {
  const down = { kind: 'regen', from: .02, to: -.005 }, up = { ...down, from: -.005, to: .025 };
  assert.equal(api.intelCategory(down), api.intelCategory(up));
  assert.equal(api.intelImpact(down), 'help');
  assert.equal(api.intelImpact(up), 'hurt');
  assert.equal(api.intelImpact({ kind: 'effect', type: 40, on: true }), 'neutral');
  assert.equal(api.intelImpact({ kind: 'edited', diff: [{ kind: 'goal', from: 100, to: 50 }] }), 'help');
});
