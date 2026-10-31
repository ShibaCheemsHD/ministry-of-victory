// The track record's arithmetic, on small made-up wars where the right answer is known.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { liberationBacktest, countBacktest, liveAccuracy } from '../recorder/accuracy.mjs';
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
