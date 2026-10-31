// The forecast maths: hand-checked cases, measured constants, and random orders that must never
// produce NaN, an unknown verdict or a crash.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const E = createRequire(import.meta.url)('../src/engine.js');
const P = (h, m, regenPerHour, regions = []) => ({ health: h, maxHealth: m, regenPerSecond: regenPerHour / 3600, regions });
const near = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test('liberation needs worked out by hand', () => {
  const w = E.planetWork(P(1e6, 1e6, 25000));
  near(E.minShareSequential([w], 40, 1e5, 0, null), 0.5);          // 100k*s - 25k = 1M/40h
  near(E.minShareSequential([w, w], 40, 1e5, 0, null), 0.75);      // 2M/(100k*s - 25k) = 40h
  near(E.minShareSequential([w, E.planetWork(P(5e5, 1e6, 25000))], 40, 1e5, 0, null), 0.625);   // half-done planet first
});

test('regions: capture bonus is 1.5x the region\'s full HP', () => {
  const w = E.planetWork(P(1e6, 1e6, 15000, [{ isAvailable: true, health: 1e5, maxHealth: 2e5, regenPerSecond: 0 }]));
  assert.equal(w.work, 1e5 + (1e6 - 3e5));
  assert.equal(w.full, 2e5 + (1e6 - 3e5));
});

test('measured constants stay what the war log says', () => {
  assert.equal(E.DEFAULTS.dssBonus, 0);
  assert.equal(E.DEFAULTS.hodMult, 1.8);
  assert.equal(E.DEFAULTS.hodOther, 0.72);
});

test('no strength or no players: out of reach, never NaN', () => {
  assert.equal(E.shareFor(1000, 0), Infinity);
  assert.equal(E.shareFor(0, 0), 0);
  assert.equal(E.dmg(0.5, 0), 0);
});

test('a counter far behind on a small front is judged on everyone online', () => {
  const now = Date.parse('2026-10-31T12:00:00Z'), H = 3.6e6, samples = [];
  for (let k = 0; k <= 25; k++) samples.push({ t: now - (25 - k) * H, prog: { A: [400 - 50 * (25 - k)] }, planets: {} });
  const planets = { 1: { index: 1, currentOwner: 'Terminids', health: 5e5, maxHealth: 1e6, statistics: { playerCount: 8000 } } };
  const run = (goal) => E.analyzeAssignment({ id: 'A', tasks: [{ type: 3, values: [2, goal, 0], valueTypes: [1, 3, 4] }], progress: [400], expiration: new Date(now + 10 * H).toISOString(), flags: 1 },
    { planets, N: 80000, now, C: 1e5, dssIdx: null, hod: null, settings: { ...E.DEFAULTS }, samples, startMs: now - 30 * H, progKey: 'A' }).tasks[0];
  assert.equal(run(1000).verdict, 'effort');                 // needs 60/h vs 50/h now: 12% of everyone
  assert.equal(run(4000).verdict, 'record');                 // 72% of everyone
  near(run(4000).needShare, 0.72);
});

test('total need: kills on a front overlap with that front\'s planets', () => {
  const res = { model: { N: 100 }, verdict: 'hard', tasks: [], liberation: null, fronts: { players: { Terminids: 10 } } };
  res.liberation = { seqNeed: 0.3, targets: [{ pw: { work: 1 }, planet: { currentOwner: 'Terminids' } }] };
  res.tasks = [{ counter: true, verdict: 'hard', needed: 2, primary: { rate: 1 }, task: { faction: 'Terminids', planetIndex: null } }];
  const n = E.orderNeeds(res);
  near(n.total, 0.3);   // max(0.3 liberation, 0.2 kills), not 0.5
});

// random orders: every type, odd numbers, missing fields
let seed = 7;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
function hasNaN(o, seen = new Set()) {
  if (o == null || typeof o !== 'object' || seen.has(o)) return false; seen.add(o);
  for (const [k, v] of Object.entries(o)) {
    if (['planet', 'planets', 'raw', 'target', 'list', 'from'].includes(k)) continue;
    if (typeof v === 'number' && Number.isNaN(v)) return k;
    const r = typeof v === 'object' && hasNaN(v, seen); if (r) return k + '.' + r;
  }
  return false;
}
test('3000 random orders: no crash, no NaN, a known verdict', () => {
  const now = Date.parse('2026-10-31T12:00:00Z'), H = 3.6e6;
  for (let r = 0; r < 3000; r++) {
    const planets = {};
    for (let i = 0; i < 1 + Math.floor(rnd() * 5); i++) {
      const owner = pick(['Terminids', 'Automaton', 'Illuminate', 'Humans']), max = pick([1e6, 2e6, 15e6, 0]);
      planets[i] = { index: i, maxHealth: max, health: Math.round(rnd() * max), regenPerSecond: pick([0, 6.94, 277.8, -2.78]), currentOwner: owner,
        statistics: { playerCount: pick([0, 3000, 60000, undefined]) },
        regions: rnd() < 0.3 ? [{ isAvailable: true, health: Math.round(rnd() * 4e5), maxHealth: pick([2e5, 4e5, 0]), regenPerSecond: 1 }] : [],
        event: owner === 'Humans' && rnd() < 0.5 ? { faction: 'Automaton', health: Math.round(rnd() * 5e5), maxHealth: pick([5e5, 0]), endTime: new Date(now + pick([-1, 3, 30]) * H).toISOString() } : null };
    }
    const idx = Object.keys(planets).map(Number);
    const tasks = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => {
      const type = pick([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 99]), where = pick([0, 1]);
      return { type, values: [pick([0, 2, 3, 4]), pick([0, 1, 1e6, 3e9]), 0, 0, 0, 0, where, where ? pick(idx) : 0], valueTypes: [1, 3, 4, 5, 6, 9, 11, 12] };
    });
    const a = { id: 'A', tasks, progress: tasks.map(() => pick([0, 1, 5e8, undefined])), expiration: new Date(now + pick([-2, 0.5, 48]) * H).toISOString(), flags: pick([0, 1, 2]) };
    const ctx = { planets, N: pick([0, 30000, 80000]), now, C: pick([1e5, 0]), dssIdx: pick([null, 0]), hod: pick([null, { expire: now + 3 * H }]), settings: { ...E.DEFAULTS }, samples: [], startMs: now - 20 * H, sectorOf: null };
    const res = E.analyzeAssignment(a, ctx);
    assert.ok(res.verdict in E.RANK, 'verdict ' + res.verdict);
    for (const t of res.tasks) assert.ok(t.verdict in E.RANK, 'task verdict ' + t.verdict);
    const bad = hasNaN({ tasks: res.tasks, recs: res.recs, directive: res.directive });
    assert.equal(bad, false, `NaN at ${bad} (order ${JSON.stringify(a).slice(0, 300)})`);
    const nd = E.orderNeeds(res); if (nd) assert.ok(!Number.isNaN(nd.total));
  }
});

test('more time or stronger players never raise the share needed', () => {
  for (let r = 0; r < 300; r++) {
    const w = [E.planetWork(P(rnd() * 1e6, 1e6, rnd() * 36000)), E.planetWork(P(rnd() * 2e6, 2e6, rnd() * 36000))];
    const H = 10 + rnd() * 100, C = 5e4 + rnd() * 1e5, a = E.minShareSequential(w, H, C, 0, null);
    assert.ok(E.minShareSequential(w, H * 1.5, C, 0, null) <= a + 1e-6);
    assert.ok(E.minShareSequential(w, H, C * 1.5, 0, null) <= a + 1e-6);
    if (isFinite(a) && a > 0) assert.ok(E.sequentialHours(w, a, C, 0, null) <= H * 1.001);
  }
});
