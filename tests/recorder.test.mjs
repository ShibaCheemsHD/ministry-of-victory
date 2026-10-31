// The recorder end to end on a real snapshot of the war (31 Oct 2026, Interrogation Enhancement), with the
// network replaced: it must write every file the page reads, and never invent a goal change.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const live = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'live-2026-10-31.json'), 'utf8'));

function runRecorder(dir, extra = {}) {
  const map = { '/api/v1/war': live.war, '/api/v1/assignments': live.assignments, '/api/v1/campaigns': live.campaigns, '/api/v2/space-stations': live.stations,
    '/raw/api/v2/Assignment/War/801': live.raw, '/api/v1/dispatches': extra.dispatches || [] };
  fs.writeFileSync(path.join(dir, 'fake.mjs'), `
const map = ${JSON.stringify(map)};
const official = ${JSON.stringify(extra.official || {})};
globalThis.fetch = async (u) => { u = String(u); const p = new URL(u).pathname;
  if (u.includes('helldivers2.dev') && map[p] != null) return new Response(JSON.stringify(map[p]), { status: 200 });
  for (const [k, v] of Object.entries(official)) if (u.includes(k)) return new Response(JSON.stringify(v), { status: 200 });
  throw new TypeError('offline ' + u.slice(0, 80)); };
globalThis.setTimeout = ((st) => (f, ms, ...a) => st(f, Math.min(ms, 2), ...a))(globalThis.setTimeout);
await import(${JSON.stringify(path.join(here, '..', 'recorder', 'record.mjs'))});
`);
  return spawnSync(process.execPath, [path.join(dir, 'fake.mjs'), path.join(dir, 'history.json'), path.join(dir, 'out')], { encoding: 'utf8', timeout: 120000 });
}

test('a snapshot writes every file the page reads', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mov-'));
  const r = runRecorder(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const f of ['history.json', 'intel.json', 'recent.json', 'progress.json', 'live.json', 'archive.json'])
    assert.ok(fs.existsSync(path.join(dir, 'out', f)), f + ' missing');
  const hist = JSON.parse(fs.readFileSync(path.join(dir, 'out', 'history.json'), 'utf8'));
  assert.ok(hist.calls && Object.keys(hist.calls).length >= 1, 'the running order is on record');
});

test('regression 31 Oct 2026: the launch text\'s sample count is not reported as a raised kill goal', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mov-'));
  const a = live.assignments[0];
  const official = {
    'Episode/801': { episodes: [{ phases: [{ introTitle: 'INTERROGATION ENHANCEMENT', introMessage: 'To aid development of more effective digital interrogation techniques, the Helldivers are ordered to acquire 60,000,000 Automaton samples and kill 35,000,000 Radicals.' }] }] },
    'WarSeason/801/Status': { globalEvents: [{ assignmentId32: a.id, title: 'INTERROGATION ENHANCEMENT' }] },
  };
  const r = runRecorder(dir, { official });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const hist = JSON.parse(fs.readFileSync(path.join(dir, 'out', 'history.json'), 'utf8'));
  assert.equal(hist.episode?.phases?.length, 1, 'the launch text was read');
  assert.deepEqual(hist.edits.filter(e => e.ref === 'briefing'), []);
});

test('a MAJOR ORDER WON dispatch is read as Super Earth\'s word', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mov-'));
  const r = runRecorder(dir, { dispatches: [{ id: 1, published: new Date().toISOString(), message: '<i=3>MAJOR ORDER WON</i>\n\nDone.' }, { id: 2, published: new Date().toISOString(), message: '<i=3>NEW STRATEGIC OPPORTUNITY</i>\n\nSuccess depends on you.' }] });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const hist = JSON.parse(fs.readFileSync(path.join(dir, 'out', 'history.json'), 'utf8'));
  assert.deepEqual(hist.moNews.map(x => x.won), [true]);
  assert.deepEqual(hist.so.map(x => x.id), [2]);
});

// 31 Oct 2026: after two days of recording, every DSS measurement was still 0, because only liberation
// planets without cities were measured and the DSS sat on a defense, then on a planet with cities.
import { measure } from '../recorder/measure.mjs';
test('DSS and city planets are measured too, each against plain planets of the same kind', () => {
  const t0 = Date.UTC(2026, 9, 31), step = 600e3, samples = [];
  for (let k = 0; k < 40; k++) {
    const pl = {
      // plain liberation planets
      1: [5e6 - k * 6000, 20000, 10, 6e6, 0, 0, 'Automaton', 0, 0, null],
      2: [5e6 - k * 3000, 10000, 10, 6e6, 0, 0, 'Terminids', 0, 0, null],
      // defenses: 3 plain, 4 under the DSS (same damage per Helldiver)
      3: [1.5e6 - k * 6000, 20000, 0, 1.9e6, 77, 0, 'Humans', 0, 0, null],
      4: [1.5e6 - k * 9000, 30000, 0, 1.9e6, 78, 0, 'Humans', 0, 0, null],
      5: [1.5e6 - k * 3000, 10000, 0, 1.9e6, 79, 0, 'Humans', 0, 0, null],
      // a planet with one open city: the city takes the damage, the planet heals
      6: [2.4e6 + k * 3000, 30000, 12.5, 3.2e6, 0, 1, 'Automaton', 0, 0, [[0, 2e5, 2e5, 0, 0.5, 0], [3, 9e5 - k * 4400, 1e6, 1, 2.78, 18000]]],
    };
    samples.push({ t: t0 + k * step, N: 100000, imp: 0.01, dss: 4, hod: false, pl });
  }
  const hist = { samples };
  const m = measure(hist, 0.027);
  assert.equal(m.dss.kind, 'def');
  assert.ok(Math.abs(m.dss.x - 1) < 0.05, 'same damage per Helldiver: no bonus, got ' + m.dss.x);
  assert.ok(hist.measure.kv.reg.base.length > 0, 'the city planet is measured');
  assert.ok(hist.measure.kv.lib.base.length > 0 && hist.measure.kv.def.base.length > 0);
  assert.equal(m.seen.hod, 0);
});
