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

test('regression (audit ARCH-01): an unreadable history stops the recorder instead of starting over', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mov-'));
  fs.writeFileSync(path.join(dir, 'history.json'), '{"samples": [ {"t": 1, "pl"');   // cut off half way
  const r = runRecorder(dir);
  assert.notEqual(r.status, 0);
  assert.ok(!fs.existsSync(path.join(dir, 'out', 'history.json')), 'nothing written');
});

test('feed: new orders and results as RSS, game markup removed, text escaped (audit PO-04)', async () => {
  const { buildFeed, feedItems, notifyDiscord } = await import('../recorder/feed.mjs');
  const H = 3.6e6, t0 = Date.parse('2026-10-30T12:00:00Z');
  const calls = {
    a: { id: 'a', title: 'MAJOR ORDER', brief: 'Liberate <i=1>Fury</i> & hold it. Then more.', start: t0, firstSeen: t0 + H, exp: t0 + 72 * H,
      first: { v: 'impossible', late: false }, result: 'lost', resultT: t0 + 73 * H },
    b: { id: 'b', title: 'Operation <Swift>', brief: '', start: t0 + 80 * H },
  };
  const items = feedItems(calls, t0 + 90 * H);
  assert.deepEqual(items.map(x => x.id), ['mo-b-new', 'mo-a-lost', 'mo-a-new']);
  assert.equal(items[2].title, 'New Major Order: Liberate Fury & hold it.');
  assert.match(items[1].text, /Impossible/);
  const xml = buildFeed(calls, t0 + 90 * H);
  assert.match(xml, /<title>New Major Order: Operation &lt;Swift&gt;<\/title>/);
  assert.match(xml, /Liberate Fury &amp; hold it\./);
  assert.ok(!/<i=1>/.test(xml));
  // Discord: only fresh news, each once
  const posts = [], send = async (url, o) => { posts.push(JSON.parse(o.body).content); return { ok: true }; };
  const hist = { calls };
  assert.equal(await notifyDiscord(hist, t0 + 82 * H, 'https://example.invalid/hook', send), 1);
  assert.match(posts[0], /Operation <Swift>/);
  assert.equal(await notifyDiscord(hist, t0 + 83 * H, 'https://example.invalid/hook', send), 0);
  assert.equal(await notifyDiscord(hist, t0 + 83 * H, '', send), 0);
});

test('enemy list: every unit has its singular and plural name (src/game/enemies.json)', () => {
  const foes = JSON.parse(fs.readFileSync(path.join(here, '..', 'src', 'game', 'enemies.json'), 'utf8'));
  const ids = Object.keys(foes).filter(k => !k.startsWith('_'));
  assert.ok(ids.includes('23741406'), 'the Radicals of order 3291378705');
  for (const k of ids) { assert.match(k, /^\d+$/); assert.ok(foes[k].one && foes[k].many, k); }
});

test('wiki cross-check: objectives read from the wiki, names compared, unknown units named (recorder/wikicheck.mjs)', async () => {
  const { parseWiki, checkOrders, sameName, singular, wikiDate } = await import('../recorder/wikicheck.mjs');
  const raw = fs.readFileSync(path.join(here, 'fixtures', 'wiki-major-orders.txt'), 'utf8');
  const E = parseWiki(raw);
  assert.equal(E.length, 4);
  assert.equal(wikiDate('Octobr 28th, 2186'), Date.UTC(2026, 9, 28));
  const ca = E.find(e => /Citizen Arrest/.test(e.title));
  assert.deepEqual(ca.objectives.map(o => [o.goal, o.name]), [[25e6, 'Agitators'], [1e6, 'Vox Engines'], [50e6, 'Obtruders'], [250000, 'Gatekeepers']], 'struck-out old goals are dropped');
  assert.ok(sameName('Dragon Roaches', 'Dragonroaches') && sameName('Shredder Tanks', 'Automaton Shredder Tanks') && !sameName('Radicals', 'Agitators'));
  assert.equal(singular('Radicals'), 'Radical'); assert.equal(singular('Voteless'), 'Voteless'); assert.equal(singular('Dragon Roaches'), 'Dragon Roach');
  const kill = (unit, goal, fac = 3) => ({ type: 3, values: [fac, 0, goal, unit, 0, 0, 0, 0, 0, 0], valueTypes: [1, 2, 3, 4, 6, 5, 8, 9, 11, 12] });
  const orders = [{ id: '3291378705', start: Date.UTC(2026, 9, 30, 9), tasks: [kill(23741406, 60e6)] },
    { id: 'ca', start: Date.UTC(2026, 8, 1, 12), tasks: [kill(1371180916, 25e6), kill(4066406510, 1e6)] }];
  const foes = JSON.parse(fs.readFileSync(path.join(here, '..', 'src', 'game', 'enemies.json'), 'utf8'));
  const ok = checkOrders(E, orders, foes);
  assert.equal(ok.matched, 2); assert.deepEqual(ok.mismatches, []); assert.deepEqual(ok.hints, {});
  // a wrong name is caught; a missing one gets the wiki's name as a hint
  const wrong = { ...foes, 1371180916: { one: 'Radical', many: 'Radicals' } }; delete wrong['23741406'];
  const r = checkOrders(E, orders, wrong);
  assert.deepEqual(r.mismatches.map(m => [m.unit, m.ours, m.wiki]), [[1371180916, 'Radicals', 'Agitators']]);
  assert.deepEqual(r.hints['23741406'], { many: 'Radicals', one: 'Radical', order: '3291378705', wiki: 'Memoriam Eternal - Interrogation Enhancement' });
  // not on the wiki yet: nothing to say
  assert.equal(checkOrders(E, [{ id: 'new', start: Date.UTC(2026, 10, 20), tasks: [kill(999, 5e6)] }], foes).matched, 0);
});
