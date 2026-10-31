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
