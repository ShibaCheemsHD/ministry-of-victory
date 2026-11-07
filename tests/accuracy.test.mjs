// The track record's arithmetic, on small made-up wars where the right answer is known.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { liberationBacktest, countBacktest, liveAccuracy, compactCalls } from '../recorder/accuracy.mjs';
const E = createRequire(import.meta.url)('../src/engine.js');
const H = 3.6e6, t0 = Date.parse('2026-03-01T00:00:00Z');
const stamp = (t) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');

test('a planet falling at a steady pace is forecast exactly, both ways', () => {
  // 100k online, 20% on the planet, 25k HP an hour, no regen: 1M HP falls in 40 h
  const events = Array.from({ length: 60 }, (_, h) => ({ time: stamp(t0 + h * H), all_players: 100000, log: [] }));
  const planet = [{ eind: 0, hp: 1e6, pl: 20000, r: 0, t: 49 }];
  for (let h = 1; h < 40; h++) planet.push({ eind: h, hp: 1e6 - 25000 * h });
  planet.push({ eind: 40, hp: 1e6, t: 16 });
  const r = liberationBacktest({ events }, { 5: planet }, { since: t0 });
  for (const hz of [6, 12, 24]) {
    assert.equal(r.model[hz].n, 1); assert.equal(r.model[hz].medErrH, 0); assert.equal(r.model[hz].within25, 1);
    assert.equal(r.pace[hz].n, 1); assert.equal(r.pace[hz].medErrH, 0);
  }
});

test('forecast v2 on the same planet: exact when nobody is left to arrive, earlier when players can still come', () => {
  const run = (pl) => {
    const events = Array.from({ length: 60 }, (_, h) => ({ time: stamp(t0 + h * H), all_players: 100000, log: [] }));
    const planet = [{ eind: 0, hp: 1e6, pl, r: 0, t: 49 }];
    for (let h = 1; h < 40; h++) planet.push({ eind: h, hp: 1e6 - 25000 * h });
    planet.push({ eind: 40, hp: 1e6, t: 16 });
    return liberationBacktest({ events }, { 5: planet }, { since: t0, E });
  };
  const full = run(60000), few = run(20000);
  for (const hz of [6, 12, 24]) {
    assert.equal(full.v2[hz].medErrH, 0); assert.equal(full.v2[hz].inBand, 1);
    assert.equal(few.v2[hz].early, 1);     // 20% of everyone: more players expected, the fall comes sooner
  }
  assert.ok(few.old && few.model);
});

test('counts: a day\'s pace projected to the deadline, against the result', () => {
  const kill = (goal) => ({ type: 3, values: [2, goal], valueTypes: [1, 3] });
  const order = (id, goal, perHour, hours, done) => ({ id, complete: true, start: t0, exp: t0 + hours * H, last: done ? t0 + 30 * H : t0 + hours * H,
    tasks: [kill(goal)], pts: Array.from({ length: hours + 1 }, (_, h) => [t0 + h * H, Math.min(goal, perHour * h)]) });
  const r = countBacktest({ a: order('a', 1000, 10, 72, false), b: order('b', 500, 10, 72, true) }, E);
  assert.equal(r.n, 2);
  assert.equal(r.calledRight, 1);          // a: projects 720 of 1000 and ends at 72%; b: projects past the goal and is won
  assert.equal(r.medErrPts, 0);
});

test('live record: hourly forecasts checked when the planet falls and the order ends', () => {
  const fell = t0 + 30 * H;
  const calls = { x: { id: 'x', title: 'TEST', start: t0, result: 'lost', prog: [600], tasks: [{ type: 3, values: [2, 1000], valueTypes: [1, 3] }],
    first: { v: 'record', need: 0.7, late: false },
    track: { fell: { 7: fell }, lib: { 7: [[fell - 24 * H, fell + 2 * H], [fell - 12 * H, fell], [fell - 6 * H, fell - H]] }, cnt: { 0: [[t0 + 24 * H, 0.6]] } } } };
  const r = liveAccuracy(calls, E);
  assert.equal(r.lib[24].medErrH, 2); assert.equal(r.lib[12].medErrH, 0); assert.equal(r.lib[6].medErrH, 1);
  assert.deepEqual(r.cnt, { n: 1, calledRight: 1 });
  assert.deepEqual(r.verdicts.map(v => [v.v, v.result]), [['record', 'lost']]);
});

test('finished orders keep only the forecasts the record reads, with the same numbers (audit CR-03)', () => {
  const fell = t0 + 40 * H, exp = t0 + 72 * H;
  const lib = Array.from({ length: 41 }, (_, h) => [t0 + h * H, fell + (h % 5 - 2) * H]);   // one forecast an hour
  const cnt = Array.from({ length: 72 }, (_, h) => [t0 + h * H, 0.5 + h / 200]);
  const mk = () => ({ x: { id: 'x', title: 'T', start: t0, exp, result: 'won', prog: [1000], tasks: [{ type: 3, values: [2, 1000], valueTypes: [1, 3] }],
    track: { fell: { 7: fell }, lib: { 7: lib.map(p => [...p]), 8: lib.map(p => [...p]) }, cnt: { 0: cnt.map(p => [...p]) } } } });
  const calls = mk(), before = liveAccuracy(calls, E);
  assert.equal(compactCalls(calls, exp + 24 * H), 0, 'too soon: the order may still be settling');
  assert.equal(compactCalls(calls, exp + 8 * 24 * H), 1);
  assert.deepEqual(liveAccuracy(calls, E), before);
  assert.equal(calls.x.track.lib[7].length, 3);
  assert.equal(calls.x.track.lib[8], undefined, 'a planet that never fell has nothing to check');
  assert.equal(calls.x.track.cnt[0].length, 1);
  assert.equal(compactCalls(calls, exp + 9 * 24 * H), 0, 'once only');
});

test('defenses: replayed on the recorder\'s snapshots, Command\'s jumps flagged', async () => {
  const { defenseReplay, defenseAccuracy } = await import('../recorder/accuracy.mjs');
  // 20% of 100k players, K 0.027, impact 0.01: 19,440 HP/h; 500k HP of defense, 30 h left -> held in about 25.7 h
  const S = [];
  for (let k = 0; k <= 27 * 6; k++) {
    const t = t0 + k * 600e3, hp = Math.max(0, 5e5 - 19440 * k / 6);
    S.push({ t, N: 100000, imp: 0.01, pl: { 9: hp > 0 ? [hp, 20000, 0, 1e6, 77, 0, 'Humans', t0 + 30 * H] : [1e6, 20000, 0, 1e6, 0, 0, 'Humans', 0] } });
  }
  const hist = { samples: S };
  const rec = defenseReplay(hist, E, 0.027, t0 + 28 * H);
  const r = rec['9:77'];
  assert.ok(r && r.done && r.won && !r.joel);
  assert.ok(r.calls.every(c => c[3] === 1), 'every call says it holds');
  const a = defenseAccuracy(rec);
  assert.equal(a.calledRight, 1); assert.equal(a.within25, 1);
});

test('historical calibration is independent of the order in which forecast horizons are replayed', () => {
  const events = Array.from({ length: 60 }, (_, h) => ({ time: stamp(t0 + h * H), all_players: 100000, log: [] }));
  const target = Array.from({ length: 40 }, (_, h) => ({ eind: h, hp: 1e6 - h * 25000, pl: 20000, r: 0, t: 49 }));
  target.push({ eind: 40, hp: 1e6, t: 16 });
  const calibration = Array.from({ length: 40 }, (_, h) => ({ eind: h, hp: 1e7 - h * 10000 - Math.max(0, h - 30) * 70000, pl: 10000, r: 0, t: 49 }));
  const replay = horizons => liberationBacktest({ events }, { 5: target, 6: calibration }, { since: t0, horizons, E, withRows: true });
  const forward = replay([6, 12]), reverse = replay([12, 6]);
  for (const hz of [6, 12]) {
    assert.equal(forward.rows.find(x => x.hz === hz).C, reverse.rows.find(x => x.hz === hz).C);
    assert.deepEqual(forward.v2[hz], reverse.v2[hz]);
  }
});

test('order verdicts are scored 1, 2 and 3 days before the end', async () => {
  const { verdictScores, compactCalls } = await import('../recorder/accuracy.mjs');
  const H = 3.6e6, exp = 100 * H;
  const log = (vs) => vs.map(([h, v]) => [exp - h * H, v]);
  const calls = {
    a: { exp, result: 'won', vlog: log([[72, 'focus'], [48, 'ontrack'], [24, 'ontrack']]) },
    b: { exp, result: 'lost', vlog: log([[72, 'ontrack'], [48, 'impossible'], [24.5, 'impossible']]) },
    c: { exp, result: null, vlog: log([[24, 'ontrack']]) },   // still running: not scored
  };
  const s = verdictScores(calls);
  assert.deepEqual(s[24], { n: 2, right: 2, win: 1, winRight: 1, loss: 1, lossRight: 1, open: 0, openWon: 0 });
  assert.deepEqual(s[72], { n: 2, right: 0, win: 1, winRight: 0, loss: 0, lossRight: 0, open: 1, openWon: 1 });
  // thinning a finished order keeps exactly what the score reads
  const before = JSON.stringify(verdictScores(calls));
  calls.a.track = { lib: {}, cnt: {} }; calls.a.vlog.push([exp - 30 * H, 'ontrack'], [exp - 60 * H, 'focus']);
  compactCalls(calls, exp + 8 * 24 * H);
  assert.equal(calls.a.vlog.length, 3);
  assert.equal(JSON.stringify(verdictScores(calls)), before);
});
