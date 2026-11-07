// The self-learning loop's Node steps (tools/chance): the hourly war log harvest and the model check.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (f, ...a) => execFileSync('node', [path.join(REPO, 'tools/chance', f), ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const T0 = Date.parse('2026-11-30T23:00:00Z');
// [enemy HP, players, regen/s, max HP, event, open regions, owner, event end, missions, regions]
const pl = (hp, owner, regs = null) => [hp, 500, 1.4, 1e6, 0, 0, owner, 0, 0, regs];

test('the harvest keeps one reading an hour, the fall, and nothing twice', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-'));
  const samples = [];
  for (let k = 0; k < 18; k++) {   // every 10 minutes for 3 hours, across a month's end
    const t = T0 + k * 10 * 60e3, fell = k >= 12;
    samples.push({ t, N: 50000, dss: k % 4 === 1 ? null : 5, pl: { 5: pl(fell ? 0 : 9e5 - k * 1e4, fell ? 'Humans' : 'Terminids'), 6: pl(1e6, 'Humans'), 7: pl(5e5, 'Automaton', [[0, 2e5, 2e5, 1, 0.5, 0]]) } });
  }
  fs.writeFileSync(path.join(dir, 'h.json'), JSON.stringify({ samples }));
  assert.match(run('harvest.mjs', path.join(dir, 'h.json'), dir), /\+3 hourly/);
  assert.match(run('harvest.mjs', path.join(dir, 'h.json'), dir), /\+0 hourly/);
  const nov = JSON.parse(fs.readFileSync(path.join(dir, 'warlog/2026-11.json'))), dec = JSON.parse(fs.readFileSync(path.join(dir, 'warlog/2026-12.json')));
  assert.equal(nov.length, 1); assert.equal(dec.length, 2);
  assert.deepEqual(Object.keys(nov[0].pl), ['5', '7'], 'planets we hold are left out');
  assert.equal(nov[0].pl[7][5], 1, 'a region in enemy hands');
  assert.equal(dec[1].pl[5][4], 1, 'the reading after the fall is kept');
  assert.ok([...nov, ...dec].every(r => r.dss === 5), 'a missing DSS reading is filled from the same hour');
});

test('the engine accepts its own shipped model and matches the fixture', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-'));
  run('verify.mjs', REPO, '--current', path.join(dir, 'm.json'));
  assert.match(run('verify.mjs', REPO, path.join(dir, 'm.json'), path.join(REPO, 'tests/fixtures/chance-fixture.json')), /^ok: 40 cases/);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'm.json')));
  m.trees[0][0][2] = 0;   // a tree that would loop
  fs.writeFileSync(path.join(dir, 'bad.json'), JSON.stringify(m));
  assert.throws(() => run('verify.mjs', REPO, path.join(dir, 'bad.json'), path.join(REPO, 'tests/fixtures/chance-fixture.json')));
});
