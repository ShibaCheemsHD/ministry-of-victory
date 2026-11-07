// One row per (planet under liberation, moment), every 3 hours, war log 2024-26: everything known at that
// moment, and what happened after (hours to the fall, or censored when it never fell in the log).
// Usage: node features.mjs WAR_DIR ARCHIVE_JSON HISTORY_JSON REPO OUT_CSV
import fs from 'node:fs';
import { createRequire } from 'node:module';
const [W, ARCH, HIST, REPO, OUT] = process.argv.slice(2);
const { replayContext } = await import(REPO + '/recorder/accuracy.mjs');
const E = createRequire(import.meta.url)(REPO + '/src/engine.js');
const hist = JSON.parse(fs.readFileSync(W + '/historydata.json')), resort = JSON.parse(fs.readFileSync(W + '/resort.json'));
const H = 3.6e6, SPLIT = Date.parse('2026-01-01T00:00:00Z'), END = hist.events.at(-1).timestamp * 1000;
const { P, playersAt, capacityAt } = replayContext(hist, resort);
const T = hist.events.map(e => e.timestamp * 1000);

// DSS position over time, from the war log's per-planet 'dss' flags
const dssEv = [];
for (const [k, lst] of Object.entries(resort)) for (const x of lst) if ('dss' in x) dssEv.push([T[x.eind], k, !!x.dss]);
dssEv.sort((a, b) => a[0] - b[0]);
const dssAt = t => { let cur = null; for (const [tt, k, on] of dssEv) { if (tt > t) break; if (on) cur = k; else if (cur === k) cur = null; } return cur; };

// orders whose planets are known
const orders = [];
for (const o of JSON.parse(fs.readFileSync(ARCH)).orders) {
  const ps = new Set((o.planets || []).map(String));
  for (const tk of o.tasks || []) { const i = tk.valueTypes.indexOf(12); if (i >= 0 && tk.values[i]) ps.add(String(tk.values[i])); }
  if (o.start && o.end && ps.size) orders.push({ start: o.start, end: o.end, ps });
}
for (const o of Object.values(JSON.parse(fs.readFileSync(HIST)).hs || {})) {
  const ps = new Set();
  for (const tk of o.tasks || []) { const i = tk.valueTypes.indexOf(12); if (i >= 0 && tk.values[i]) ps.add(String(tk.values[i])); }
  if (o.start && o.exp && ps.size) orders.push({ start: o.start, end: o.exp, ps });
}
const lastIdx = (l, t) => { let lo = 0, hi = l.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (l[m].t <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k; };

const rows = [];
const grid = []; for (let t = Date.parse('2024-03-01T00:00:00Z'); t < END - 6 * H; t += 3 * H) grid.push(t);
for (const [k, l] of Object.entries(P)) {
  for (const t0 of grid) {
    const i = lastIdx(l, t0); if (i < 0) continue;
    const o = l[i].o; if (!o || o === 'Humans' || l[i].reg) continue;
    let at = null; for (let x = i; x >= 0 && l[x].t >= t0 - 1.5 * H; x--) if (l[x].hpSet) { at = l[x]; break; }
    if (!at || at.o !== o || at.hp <= 0) continue;
    const N = playersAt(at.t), C = capacityAt(at.t);
    if (!(N && C && at.pl > 0)) continue;
    const share = at.pl / N; if (share < 0.01) continue;
    const max = at.max || at.hp;
    // history inside this owner's stint, up to now
    const past = []; for (let x = i; x >= 0 && l[x].o === o; x--) past.unshift(l[x]);
    const hpAt = (h) => { let v = null; for (const x of past) { if (x.t > at.t - h * H) break; if (x.hpSet) v = x; } return v; };
    const pace = (h) => { const v = hpAt(h); return v && at.t - v.t > 0.5 * H ? (v.hp - at.hp) / max / ((at.t - v.t) / H) : null; };
    const shareAt = (h) => { let v = null; for (const x of past) { if (x.t > at.t - h * H) break; v = x; } const n = v && playersAt(v.t); return v && n ? v.pl / n : null; };
    const day = past.filter(x => x.t >= at.t - 24 * H), dayShare = day.map(x => { const n = playersAt(x.t); return n ? x.pl / n : null; }).filter(x => x != null);
    const firstPl = past.find(x => x.pl > 0);
    const samples = past.filter(x => x.t >= at.t - 24 * H).map(x => ({ t: x.t, N: playersAt(x.t), planets: { [k]: { h: x.hpSet ? x.hp : null, p: x.pl, r: x.r } } })).filter(x => x.N);
    const pw = { work: at.hp, regionHP: 0, regen: (at.r || 0) * 3600, activeRegen: (at.r || 0) * 3600, queue: [], hasRegions: false };
    const f = E.forecastFall({ index: k, maxHealth: max }, pw, share, C, 1, samples, at.t);
    const line = (h) => { const v = hpAt(h); if (!v || at.t - v.t < 0.5 * H) return null; const rate = (v.hp - at.hp) / ((at.t - v.t) / H); return rate > 0 ? at.hp / rate : 1e4; };
    const ord = orders.find(x => x.start <= at.t && at.t <= x.end);
    // outcome
    let fall = null, ended = END;
    for (let x = i + 1; x < l.length; x++) { if (l[x].o === 'Humans') { fall = l[x].t; break; } if (l[x].o !== o) { ended = l[x].t; break; } }
    const d = new Date(at.t);
    rows.push({
      planet: k, t: at.t, test: at.t >= SPLIT ? 1 : 0,
      left: at.hp / max, max, regen: (at.r || 0) * 3600 / max, share, players: at.pl, N, C,
      share6: shareAt(6), share24: dayShare.length ? dayShare.reduce((a, b) => a + b) / dayShare.length : null,
      pace1: pace(1), pace3: pace(3), pace6: pace(6), pace12: pace(12), pace24: pace(24),
      eta_ours: isFinite(f.eta) ? Math.min(f.eta, 1e4) : 1e4, eta_line1: line(1), eta_line6: line(6),
      hour: d.getUTCHours(), dow: d.getUTCDay(), age: firstPl ? (at.t - firstPl.t) / H : 0,
      mo: ord ? (ord.ps.has(k) ? 1 : 0) : null, mo_left: ord && ord.ps.has(k) ? (ord.end - at.t) / H : null,
      dss: dssAt(at.t) === k ? 1 : 0,
      y: fall ? (fall - at.t) / H : null, cens: fall ? null : (ended - at.t) / H,
    });
  }
}
const cols = Object.keys(rows[0]);
fs.writeFileSync(OUT, cols.join(',') + '\n' + rows.map(r => cols.map(c => r[c] == null ? '' : r[c]).join(',')).join('\n'));
console.log(rows.length, 'rows,', rows.filter(r => r.test).length, 'in 2026,', rows.filter(r => r.y != null).length, 'with a fall');
