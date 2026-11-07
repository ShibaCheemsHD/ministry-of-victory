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

// Forecast v2 (November 2026): fitted on the war log of 2024-25, checked on 2026 (recorder/accuracy.mjs).
test('fall forecast: players keep arriving on a planet with few of them', () => {
  const pw = E.planetWork(P(5e5, 1e6, 10000));
  // 20% of everyone, 100k HP/h at 100%: 50 h at a flat share; with arrivals for the first 12 h (a = 1) the
  // average share over T hours is s0 (1.5 - 3/T), so 20k (1.5 - 3/T) - 10k = 5e5 / T gives T = 28 h
  near(E.forecastFall({ index: 1, maxHealth: 1e6 }, pw, 0.2, 1e5, 1, [], 0).eta, 28, 2e-3);
  // 60% or more: nobody is left to arrive, the plain answer
  near(E.forecastFall({ index: 1, maxHealth: 1e6 }, pw, 0.6, 1e5, 1, [], 0).eta, 5e5 / (6e4 - 1e4));
  // stuck now and still stuck 6 hours from now: it doesn't fall
  assert.equal(E.forecastFall({ index: 1, maxHealth: 1e6 }, pw, 0.05, 1e5, 1, [], 0).eta, Infinity);
});

test('fall forecast: the planet\'s own pace, with the regen in force at the time', () => {
  const H = 3.6e6, now = 10 * H;
  // 6 h at 30% of 100k players: the planet lost 30k/h gross while regen was 20k/h, so net 10k/h,
  // then Command dropped the regen to 0: its own strength is 100k/h at 100%, like everyone's
  const samples = Array.from({ length: 7 }, (_, k) => ({ t: now - (6 - k) * H, N: 1e5, planets: { 7: { h: 6e5 - k * 1e4, p: 3e4, r: 20000 / 3600 } } }));
  const lc = E.localC(samples, 7, now, 0, 1e6);
  near(lc.C, 1e5);
  const f = E.forecastFall({ index: 7, maxHealth: 1e6 }, E.planetWork(P(5.4e5, 1e6, 0)), 0.3, 1e5, 1, samples, now);
  assert.ok(f.local > 0 && f.global > 0 && f.band.lo < f.eta && f.eta < f.band.hi);
});

test('counts: players freed by a finished objective move to the others', () => {
  const H = 3.6e6, now = Date.UTC(2026, 9, 31), start = now - 30 * H, exp = now + 48 * H;
  // A: 90 of 100 done, 1/h -> done in 10 h. B: 30 of 120, 1/h -> alone it reaches 78 by the deadline;
  // with A's players from hour 10 it goes 2/h: 30 + 10 + 2 x 38 = 116, still short but much closer
  const task = (goal) => ({ type: 3, values: [2, 0, goal], valueTypes: [1, 2, 3] });
  const a = { id: 1, expiration: new Date(exp).toISOString(), tasks: [task(100), task(120)], progress: [90, 30] };
  const samples = [0, 12, 24].map(h => ({ t: now - 24 * H + h * H, prog: { 1: [66 + h, 6 + h] } }));
  const res = E.analyzeAssignment(a, { planets: {}, N: 1e5, now, C: 1e5, dssIdx: null, hod: null, settings: E.DEFAULTS, samples, startMs: start });
  const B = res.tasks[1];
  near(B.freed.plain, 30 + 48);
  near(B.projection, 116, 0.02);
  assert.notEqual(B.verdict, 'ontrack');
  near(B.freed.rate, (116 - 30) / 48, 0.02);
  // a goal that only the switch reaches: on track, the switch is the advice, and the order needs no one extra
  const a2 = { ...a, tasks: [task(100), task(110)] };
  const r2 = E.analyzeAssignment(a2, { planets: {}, N: 1e5, now, C: 1e5, dssIdx: null, hod: null, settings: E.DEFAULTS, samples, startMs: start });
  const B2 = r2.tasks[1];
  assert.equal(B2.verdict, 'ontrack');
  assert.ok(B2.freed && B2.freed.plain < 110 && B2.projection >= 110);
  assert.ok(r2.recs.some(x => x.kind === 'cntFreed' && x.task === B2), 'the switch is the advice');
  assert.ok(!r2.recs.some(x => x.kind === 'cntOk' && x.task === B2), 'not "finishes on its own"');
});

test('calibration uses resistance recorded at each interval, not the new resistance', () => {
  const H = 3.6e6, now = 3 * H;
  const planets = { 7: { index: 7, currentOwner: 'Automaton', maxHealth: 1e6, regenPerSecond: 0 } };
  const samples = Array.from({ length: 7 }, (_, k) => ({ t: k * H / 2, N: 100000, imp: .01,
    planets: { 7: { h: 800000 - 5000 * k, p: 30000, r: 20000 / 3600 } } }));
  // 10k net/h + 20k regen/h = 30k gross/h, at 30k players and multiplier .01.
  near(E.calibrateK(samples, planets, now, 0, 1.8).K, 30000 / (30000 * .01 * 3600));
  near(E.calibrate(samples, planets, now, 0, 1.8).capacity, 100000);
  const future = { ...samples.at(-1), t: now + H / 2, planets: { 7: { h: 1000, p: 30000, r: 0 } } };
  near(E.calibrateK([...samples, future], planets, now, 0, 1.8).K, E.calibrateK(samples, planets, now, 0, 1.8).K);
});

test('defense need and ETA agree on station bonuses, including off-station Heavy Ordnance', () => {
  const now = Date.UTC(2026, 10, 5), C = 100000, N = 100000;
  const settings = { ...E.DEFAULTS, dssBonus: .1, hodMult: 1.8 };
  const p = { index: 7, event: { endTime: new Date(now + 10 * 3.6e6).toISOString(), health: 500000, maxHealth: 1000000 }, statistics: { playerCount: 10000 } };
  for (const [station, hod, mult] of [[7, true, 1.1 * 1.8], [8, true, .72], [8, false, 1]]) {
    const info = E.defenseInfo(p, { N, now, C, dssIdx: station, hod, settings, samples: [] }, 20);
    near(info.need, E.shareFor(50000 / mult, C));
    const exact = E.defenseInfo({ ...p, statistics: { playerCount: N * info.need } }, { N, now, C, dssIdx: station, hod, settings, samples: [] }, 20);
    near(exact.eta, 10);
  }
});

test('counter rates ignore future data, pre-order data and decreasing counters', () => {
  const H = 3.6e6, now = 30 * H;
  const samples = [{ t: 28 * H, prog: { A: [10] } }, { t: 29 * H, prog: { A: [20] } }, { t: 31 * H, prog: { A: [10000] } }];
  near(E.counterRates(samples, 'A', 0, 20, 27 * H, now).recent.rate, 10);
  assert.equal(E.counterRates(samples, 'A', 0, 20, 29.5 * H, now).recent, null);
  assert.equal(E.counterRates([{ t: 28 * H, prog: { A: [20] } }, { t: 29 * H, prog: { A: [10] } }], 'A', 0, 10, H, now).recent, null);
});

test('a planet that falls in time but whose range runs past the deadline is a close call, not "On track"', () => {
  const H = 3.6e6, now = Date.UTC(2026, 10, 7);
  const planet = { index: 130, name: 'Achernar', currentOwner: 'Terminids', health: 1.2e6, maxHealth: 2e6, regenPerSecond: 0,
    statistics: { playerCount: 25000 }, regions: [] };
  const order = (hours) => ({ id: 9, expiration: new Date(now + hours * H).toISOString(), tasks: [{ type: 11, values: [1, 1, 130], valueTypes: [3, 11, 12] }], progress: [0] });
  const run = (hours) => E.analyzeAssignment(order(hours), { planets: { 130: planet }, N: 40000, now, C: 1e5, dssIdx: null, hod: null, settings: E.DEFAULTS, samples: [], startMs: now - 24 * H });
  const eta = run(500).tasks[0].eta, band = E.fallBand(eta);
  assert.ok(eta > 0 && isFinite(eta) && band.hi > eta * 1.2);
  const tight = run(eta * 1.1);
  assert.equal(tight.tasks[0].verdict, 'focus');
  assert.equal(tight.liberation.close, true);
  assert.ok(tight.recs.some(x => x.kind === 'libFocus' && x.variant === 'close'), 'the call says it is a close call');
  const safe = run(band.hi * 1.05);
  assert.equal(safe.tasks[0].verdict, 'ontrack');
  assert.equal(safe.liberation.close, false);
});

test('one planet left: the crowd of the objective about to finish is a scenario, not part of the forecast', () => {
  const H = 3.6e6, now = Date.UTC(2026, 10, 6, 12);
  const planet = (index, health, players) => ({ index, name: 'P' + index, currentOwner: 'Terminids', health, maxHealth: 2e6, regenPerSecond: 0, statistics: { playerCount: players }, regions: [] });
  const planets = { 128: planet(128, 2e5, 30000), 130: planet(130, 1.9e6, 3000) };
  const a = { id: 9, expiration: new Date(now + 30 * H).toISOString(), progress: [0, 0],
    tasks: [{ type: 13, values: [1, 1, 128], valueTypes: [3, 11, 12] }, { type: 13, values: [1, 1, 130], valueTypes: [3, 11, 12] }] };
  const res = E.analyzeAssignment(a, { planets, N: 40000, now, C: 1e5, dssIdx: null, hod: null, settings: E.DEFAULTS, samples: [], startMs: now - 24 * H });
  const s = res.migration, B = res.tasks[1];
  assert.ok(s, 'a scenario when 128 falls first');
  assert.equal(s.from.index, 128); assert.equal(s.to.index, 130);
  assert.ok(s.at > 0 && s.at < B.eta && s.eta < B.eta, 'its crowd makes 130 fall sooner');
  assert.ok(Math.abs(s.players - 30000) < 1);
  assert.notEqual(B.verdict, 'ontrack', 'the verdict itself does not count on them');
});
