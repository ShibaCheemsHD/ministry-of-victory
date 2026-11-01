// How right were the forecasts? Replayed on the war's own records, the way the site forecasts live.
//
// Liberations (community war log, CrossWaveOmega resort.json): for every planet taken back from the enemy,
// stand 6, 12 and 24 hours before it fell and forecast the fall the two ways the site does:
//   pace:  the health it lost over the 3 hours before (what the page shows once it has watched a while)
//   model: everyone's strength that week x the share of players there, minus regen (the day-one view)
// then compare with when it really fell.
// Counts (helldiversstats.com progress series): a day into each kill / mission / operation objective,
// project the pace of that day to the deadline, and compare with how far it really got.
const H = 3.6e6;
const OWNER = { 1: 'Humans', 2: 'Terminids', 3: 'Automaton', 4: 'Illuminate' };
const tOf = (s) => Date.parse(String(s).slice(0, 16).replace(' ', 'T') + ':00Z');
const med = (a) => { const x = [...a].sort((p, q) => p - q); return x.length ? x[x.length >> 1] : null; };
const share = (a, f) => a.length ? a.filter(f).length / a.length : null;

// v2: the forecast the site uses since November 2026 (engine forecastFall: the planet's own strength over the last
// 6 h, players arriving, blended with everyone's strength), replayed the same way.
export function liberationBacktest(hist, resort, { since = Date.parse('2026-01-01T00:00:00Z'), horizons = [6, 12, 24], E = null, withRows = false, until = Infinity } = {}) {
  const ev = hist.events || [], times = ev.map(e => tOf(e.time));
  const allAt = []; let la = null;
  for (let i = 0; i < ev.length; i++) { if (ev[i].all_players) la = ev[i].all_players; allAt[i] = la; }
  const playersAt = (t) => { let lo = 0, hi = times.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k >= 0 ? allAt[k] : null; };
  // timelines with health readings only where the log has one
  const P = {};
  for (const [k, list] of Object.entries(resort)) {
    const st = { hp: null, pl: null, r: null, o: null, reg: false }; const out = [];
    for (const x of list) {
      if (x.hp != null) { st.hp = Number(x.hp) || 0; st.max = Math.max(st.max || 0, st.hp); } if (x.pl != null) st.pl = Number(x.pl) || 0; if (x.r != null) st.r = Number(x.r) || 0;
      if (x.t != null) st.o = OWNER[x.t >> 4] || null;
      if (x.regions) st.reg = Object.values(x.regions).some(g => g && g.t != null && (g.t >> 4) !== 1);
      out.push({ t: times[x.eind], hp: st.hp, pl: st.pl, r: st.r, o: st.o, reg: st.reg, max: st.max, hpSet: x.hp != null });
    }
    P[k] = out;
  }
  // strength of the playerbase (HP/h at 100% of players), median over the week before t
  const capCache = new Map();
  const capacityAt = (t) => {
    const key = Math.floor(t / (24 * H)); if (capCache.has(key)) return capCache.get(key);
    const vals = [];
    for (const l of Object.values(P)) {
      let prev = null;
      for (const x of l) {
        if (!x.hpSet) continue; if (x.t > t) break;
        if (prev && x.t >= t - 7 * 24 * H && prev.o && prev.o !== 'Humans' && x.o === prev.o && !prev.reg && !x.reg) {
          const dt = (x.t - prev.t) / H, all = playersAt(prev.t);
          if (dt >= 0.5 && dt <= 8 && all && prev.pl / all >= 0.03) { const g = prev.hp - x.hp + (prev.r || 0) * 3600 * dt; if (g > 0) vals.push(g / dt / (prev.pl / all)); }
        }
        prev = x;
      }
    }
    const c = vals.length >= 12 ? med(vals) : null; capCache.set(key, c); return c;
  };
  const rows = [];
  for (const [k, l] of Object.entries(P)) {
    for (let j = 1; j < l.length; j++) {
      const fall = l[j];
      if (!(l[j - 1].o && l[j - 1].o !== 'Humans' && fall.o === 'Humans') || fall.t < since || fall.t >= until) continue;
      const fight = l.slice(0, j).filter(x => x.hpSet && x.o === l[j - 1].o);
      for (const hz of horizons) {
        const t0 = fall.t - hz * H;
        const at = [...fight].reverse().find(x => x.t <= t0 && x.t >= t0 - 1.5 * H);
        const back = [...fight].reverse().find(x => x.t <= t0 - 2.5 * H && x.t >= t0 - 4 * H);
        if (!at || at.reg || at.hp <= 0) continue;
        const truth = (fall.t - at.t) / H;
        const out = { i: Number(k), hz, truth, fell: fall.t };
        if (back && !back.reg && back.hp > at.hp) { const net = (back.hp - at.hp) / ((at.t - back.t) / H); out.pace = at.hp / net; }
        const all = playersAt(at.t), C = capacityAt(at.t);
        if (all && C && at.pl > 0) { const net = C * at.pl / all - (at.r || 0) * 3600; if (net > 0) out.model = at.hp / net; }
        // what the page showed before November 2026: the recent pace when it had one, else the model
        out.old = out.pace ?? out.model;
        if (E && all && C && at.pl > 0) {
          // the planet's last day as the page's samples (the forecast keeps its own window)
          const samples = l.slice(0, j).filter(x => x.o === l[j - 1].o && x.t <= at.t && x.t >= at.t - 24 * H)
            .map(x => ({ t: x.t, N: playersAt(x.t), planets: { [k]: { h: x.hpSet ? x.hp : null, p: x.pl, r: x.r } } })).filter(s => s.N);
          const pw = { work: at.hp, regionHP: 0, regen: (at.r || 0) * 3600, activeRegen: (at.r || 0) * 3600, queue: [], hasRegions: false };
          const fc = E.forecastFall({ index: k, maxHealth: at.max || at.hp }, pw, at.pl / all, C, 1, samples, at.t);
          if (isFinite(fc.eta)) { out.v2 = fc.eta; out.inBand = !!fc.band && fc.band.lo <= truth && truth <= fc.band.hi; }
          if (withRows) Object.assign(out, { fcG: fc.global, fcL: fc.local, fcC: fc.localC, C, share: at.pl / all, nS: samples.length });
        }
        if (out.pace != null || out.model != null || out.v2 != null) rows.push(out);
      }
    }
  }
  const summary = (key) => Object.fromEntries(horizons.map(hz => {
    const r = rows.filter(x => x.hz === hz && x[key] != null);
    const rel = r.map(x => Math.abs(x[key] - x.truth) / x.truth);
    return [hz, { n: r.length, medErrH: r.length ? +med(r.map(x => Math.abs(x[key] - x.truth))).toFixed(1) : null,
      within25: r.length ? +share(rel, v => v <= 0.25).toFixed(2) : null, early: r.length ? +share(r, x => x[key] < x.truth).toFixed(2) : null,
      ...(key === 'v2' && r.length ? { inBand: +share(r, x => x.inBand).toFixed(2) } : {}) }];
  }));
  return { since, planets: new Set(rows.map(x => x.i + ':' + x.fell)).size, pace: summary('pace'), model: summary('model'), old: summary('old'), v2: E ? summary('v2') : null, ...(withRows ? { rows } : {}) };
}

export function countBacktest(hs, E, { at = 24 } = {}) {
  const COUNTER = new Set([1, 2, 3, 4, 5, 6, 7, 9, 10]);
  const rows = [];
  for (const o of Object.values(hs || {})) {
    if (!o.complete || !o.pts?.length || !o.exp) continue;
    const hours = (o.exp - o.start) / H;
    if (hours < at + 12) continue;
    // ran to its deadline (or was closed early because it was done)
    const ranOut = o.exp - o.last < 20 * 60e3;
    const mine = [];
    o.tasks.forEach((tk, k) => {
      const p = E.parseTask(tk, 0); if (!COUNTER.has(p.type) || !p.goal) return;
      const ser = o.pts.map(x => [x[0], Number(x[1 + k]) || 0]);
      const a = [...ser].reverse().find(x => x[0] <= o.start + at * H);
      if (!a || a[0] < o.start + (at - 2) * H) return;
      const b = [...ser].reverse().find(x => x[0] <= a[0] - 22 * H) || ser[0];
      if (!(a[0] > b[0])) return;
      const rate = (a[1] - b[1]) / ((a[0] - b[0]) / H);
      const proj = (a[1] + rate * (o.exp - a[0]) / H) / p.goal;
      const fin = ser[ser.length - 1][1] / p.goal;
      if (a[1] >= p.goal) return;   // already done a day in: nothing to forecast
      const row = { id: o.id, k, proj, final: ranOut ? fin : Math.max(fin, 1), done: fin >= 1 || !ranOut, got: a[1], rate, goal: p.goal, left: (o.exp - a[0]) / H };
      rows.push(row); mine.push(row);
    });
    // v2 (the site since November 2026): players freed by a finished objective spread over those still open
    const live = mine.filter(x => x.rate > 0);
    for (const x of mine) x.proj2 = x.proj;
    if (live.length > 1) {
      const st = live.map(x => ({ x, got: x.got })), n0 = st.length, left = live[0].left;
      for (let t = 0; t < left; t += 1) {
        const open = st.filter(y => y.got < y.x.goal); if (!open.length) break;
        for (const y of open) y.got += y.x.rate * (n0 / open.length) * Math.min(1, left - t);
      }
      for (const y of st) y.x.proj2 = Math.max(y.x.proj, y.got / y.x.goal);
    }
  }
  const sum = (key) => ({ n: rows.length,
    calledRight: rows.length ? +share(rows, x => (x[key] >= 1) === x.done).toFixed(2) : null,
    medErrPts: rows.filter(x => !x.done).length ? +(med(rows.filter(x => !x.done).map(x => Math.abs(x[key] - x.final))) * 100).toFixed(0) : null,
    missedWins: rows.filter(x => x[key] < 1 && x.done).length, missedLosses: rows.filter(x => x[key] >= 1 && !x.done).length });
  // the headline numbers are the forecast the site uses now; `old` is the plain day-one pace
  return { ...sum('proj2'), old: sum('proj') };
}

// The live record: the forecasts the recorder made hour by hour (hist.calls[].track), checked against what
// happened. Grows with every order from 29 October 2026 on.
export function liveAccuracy(calls, E, { horizons = [6, 12, 24] } = {}) {
  const lib = [], cnt = [], verdicts = [];
  for (const c of Object.values(calls || {})) {
    const T = c.track;
    if (T) {
      for (const [i, fell] of Object.entries(T.fell || {})) {
        for (const hz of horizons) {
          const want = fell - hz * H, preds = (T.lib[i] || []).filter(p => Math.abs(p[0] - want) <= H);
          if (!preds.length) continue;
          const p = preds.sort((a, b) => Math.abs(a[0] - want) - Math.abs(b[0] - want))[0];
          lib.push({ i: Number(i), hz, errH: (p[1] - fell) / H, truth: (fell - p[0]) / H });
        }
      }
      if (c.result && c.prog) for (const [k, list] of Object.entries(T.cnt || {})) {
        const tk = c.tasks?.[k]; if (!tk) continue;
        const goal = E.parseTask(tk, 0).goal; if (!goal) continue;
        const want = c.start + 24 * H, p = list.filter(x => Math.abs(x[0] - want) <= 2 * H).sort((a, b) => Math.abs(a[0] - want) - Math.abs(b[0] - want))[0];
        if (!p) continue;
        const fin = Number(c.prog[k]) / goal;
        cnt.push({ id: c.id, k: Number(k), proj: p[1], final: fin, done: fin >= 1 });
      }
    }
    if (c.first && !c.first.late && c.result) verdicts.push({ id: c.id, title: c.title, v: c.first.v, need: c.first.need, result: c.result });
  }
  const byHz = Object.fromEntries(horizons.map(hz => { const r = lib.filter(x => x.hz === hz);
    return [hz, { n: r.length, medErrH: r.length ? +med(r.map(x => Math.abs(x.errH))).toFixed(1) : null, within25: r.length ? +share(r, x => Math.abs(x.errH) <= 0.25 * x.truth).toFixed(2) : null }]; }));
  return { lib: byHz, cnt: { n: cnt.length, calledRight: cnt.length ? +share(cnt, x => (x.proj >= 1) === x.done).toFixed(2) : null }, verdicts };
}

// Finished orders keep only the forecasts liveAccuracy reads (audit CR-03): for each planet that fell, the
// one nearest to each horizon; for each count, the one nearest to day 1. The record gives the same numbers,
// and an order's track shrinks from up to 240 hourly forecasts per planet to a handful.
// (hist.hs, the community series behind the backtests, is already thinned to hourly after the first 30 h.)
export function compactCalls(calls, now, { horizons = [6, 12, 24], after = 7 * 24 * H } = {}) {
  let n = 0;
  for (const c of Object.values(calls || {})) {
    const T = c.track;
    if (!T || T.compact || !c.result || !(now > (c.exp || 0) + after)) continue;
    const nearest = (list, want, tol) => list.filter(p => Math.abs(p[0] - want) <= tol).sort((a, b) => Math.abs(a[0] - want) - Math.abs(b[0] - want))[0];
    for (const i of Object.keys(T.lib || {})) {
      const fell = T.fell?.[i];
      const keep = fell ? [...new Set(horizons.map(hz => nearest(T.lib[i], fell - hz * H, H)).filter(Boolean))] : [];
      if (keep.length) T.lib[i] = keep.sort((a, b) => a[0] - b[0]); else delete T.lib[i];
    }
    for (const k of Object.keys(T.cnt || {})) {
      const p = c.prog ? nearest(T.cnt[k], c.start + 24 * H, 2 * H) : null;
      if (p) T.cnt[k] = [p]; else delete T.cnt[k];
    }
    T.compact = 1; n++;
  }
  return n;
}

// Defenses. The community war log has no defense health, so they can't be replayed on the past: they are
// replayed on the recorder's own snapshots instead (every 10 minutes, kept 2-8 days), with the page's own
// defenseInfo, every 2 hours of each attack, and kept for good once the attack is over.
//   hist.defRecord[planet:event] = { i, start, end, deadline, won, joel, calls: [[t, eta h, hours left, held?]] }
// sample.pl[i] = [HP, players, regen/s, max HP, event id, open regions, owner, event end, ...]
export function defenseReplay(hist, E, K, now) {
  const S = hist.samples || [], rec = hist.defRecord ||= {};
  const asPage = (s) => ({ t: s.t, N: s.N, imp: s.imp, dss: s.dss, hod: s.hod, planets: Object.fromEntries(Object.entries(s.pl).map(([i, v]) => [i, { h: v[0], p: v[1], r: v[2] }])) });
  const byKey = {};
  S.forEach((s, k) => { for (const [i, v] of Object.entries(s.pl || {})) if (v[4]) (byKey[i + ':' + v[4]] ||= []).push(k); });
  for (const [key, ks] of Object.entries(byKey)) {
    if (rec[key]?.done) continue;
    const i = key.split(':')[0], first = S[ks[0]], lastK = ks[ks.length - 1], last = S[lastK];
    const v0 = first.pl[i], vl = last.pl[i], deadline = vl[7] || null;
    // over? the next snapshot no longer shows the attack
    const after = S[lastK + 1];
    if (!after) continue;
    const va = after.pl?.[i];
    const won = va ? va[6] === 'Humans' : vl[0] <= 0.03 * vl[3];
    // Command stepping in: a drop of more than 3% of the defense in one snapshot, beyond what its players could do
    let joel = false;
    for (let k = 1; k < ks.length; k++) {
      const a = S[ks[k - 1]], b = S[ks[k]], A = a.pl[i], B = b.pl[i], dt = (b.t - a.t) / 1000;
      if (A[0] - B[0] > 0.03 * A[3] && A[0] - B[0] > 5 * A[1] * (a.imp || 0) * K * dt) joel = true;
    }
    const calls = [];
    let next = first.t;
    for (const k of ks) {
      const s = S[k]; if (s.t < next) continue; next = s.t + 2 * 3.6e6;
      const v = s.pl[i];
      if (!s.N || !s.imp) continue;
      const p = { index: Number(i), event: { health: v[0], maxHealth: v[3], endTime: new Date(v[7]).toISOString() }, statistics: { playerCount: v[1] } };
      const C = K * s.imp * s.N * 3600;
      const pages = S.slice(Math.max(0, k - 40), k + 1).map(asPage);
      const d = E.defenseInfo(p, { N: s.N, now: s.t, C, dssIdx: s.dss, hod: null, settings: E.DEFAULTS, samples: pages }, 1e6);
      calls.push([s.t, isFinite(d.eta) ? +d.eta.toFixed(2) : null, +d.hoursToEnd.toFixed(2), d.eta <= d.hoursToEnd ? 1 : 0]);
    }
    rec[key] = { i: Number(i), start: first.t, end: last.t, deadline, won, joel, done: true, calls,
      // started before the recording window: the first calls are missing, but the end is known
      partial: first.t - (S[0]?.t || first.t) < 15 * 60e3 && (v0[0] < 0.97 * v0[3]) };
  }
  for (const [k, r] of Object.entries(rec)) if (now - r.end > 120 * 24 * 3.6e6) delete rec[k];
  return rec;
}
export function defenseAccuracy(rec) {
  const R = Object.values(rec || {}).filter(r => r.done && r.calls?.length);
  const calls = R.flatMap(r => r.calls.map(c => ({ ...r, c })));
  const right = calls.filter(x => (x.c[3] === 1) === x.won);
  // once Command steps in, the forecast before it was about a different fight: counted apart
  const clean = R.filter(r => !r.joel);
  const cc = clean.flatMap(r => r.calls.map(c => ({ ...r, c })));
  const timed = cc.filter(x => x.won && x.c[1] != null).map(x => ({ truth: (x.end - x.c[0]) / 3.6e6 + 1 / 6, eta: x.c[1] })).filter(x => x.truth > 0.5);
  return { n: R.length, won: R.filter(r => r.won).length, joel: R.filter(r => r.joel).length, calls: calls.length,
    calledRight: calls.length ? +(right.length / calls.length).toFixed(2) : null,
    cleanRight: cc.length ? +(cc.filter(x => (x.c[3] === 1) === x.won).length / cc.length).toFixed(2) : null,
    within25: timed.length ? +(timed.filter(x => Math.abs(x.eta - x.truth) <= 0.25 * x.truth).length / timed.length).toFixed(2) : null, timed: timed.length };
}
