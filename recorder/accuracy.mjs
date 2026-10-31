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

export function liberationBacktest(hist, resort, { since = Date.parse('2026-01-01T00:00:00Z'), horizons = [6, 12, 24] } = {}) {
  const ev = hist.events || [], times = ev.map(e => tOf(e.time));
  const allAt = []; let la = null;
  for (let i = 0; i < ev.length; i++) { if (ev[i].all_players) la = ev[i].all_players; allAt[i] = la; }
  const playersAt = (t) => { let lo = 0, hi = times.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k >= 0 ? allAt[k] : null; };
  // timelines with health readings only where the log has one
  const P = {};
  for (const [k, list] of Object.entries(resort)) {
    const st = { hp: null, pl: null, r: null, o: null, reg: false }; const out = [];
    for (const x of list) {
      if (x.hp != null) st.hp = Number(x.hp) || 0; if (x.pl != null) st.pl = Number(x.pl) || 0; if (x.r != null) st.r = Number(x.r) || 0;
      if (x.t != null) st.o = OWNER[x.t >> 4] || null;
      if (x.regions) st.reg = Object.values(x.regions).some(g => g && g.t != null && (g.t >> 4) !== 1);
      out.push({ t: times[x.eind], hp: st.hp, pl: st.pl, r: st.r, o: st.o, reg: st.reg, hpSet: x.hp != null });
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
      if (!(l[j - 1].o && l[j - 1].o !== 'Humans' && fall.o === 'Humans') || fall.t < since) continue;
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
        if (out.pace != null || out.model != null) rows.push(out);
      }
    }
  }
  const summary = (key) => Object.fromEntries(horizons.map(hz => {
    const r = rows.filter(x => x.hz === hz && x[key] != null);
    const rel = r.map(x => Math.abs(x[key] - x.truth) / x.truth);
    return [hz, { n: r.length, medErrH: r.length ? +med(r.map(x => Math.abs(x[key] - x.truth))).toFixed(1) : null,
      within25: r.length ? +share(rel, v => v <= 0.25).toFixed(2) : null, early: r.length ? +share(r, x => x[key] < x.truth).toFixed(2) : null }];
  }));
  return { since, planets: new Set(rows.map(x => x.i + ':' + x.fell)).size, pace: summary('pace'), model: summary('model') };
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
      rows.push({ id: o.id, k, proj, final: ranOut ? fin : Math.max(fin, 1), done: fin >= 1 || !ranOut });
    });
  }
  const decided = rows;
  return { n: rows.length,
    calledRight: rows.length ? +share(decided, x => (x.proj >= 1) === x.done).toFixed(2) : null,
    medErrPts: rows.filter(x => !x.done).length ? +(med(rows.filter(x => !x.done).map(x => Math.abs(x.proj - x.final))) * 100).toFixed(0) : null,
    missedWins: rows.filter(x => x.proj < 1 && x.done).length, missedLosses: rows.filter(x => x.proj >= 1 && !x.done).length };
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
