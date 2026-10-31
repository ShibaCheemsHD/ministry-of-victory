// Our own measurements of what the game doesn't publish, kept for good (the war log can't show them):
//  - damage per Helldiver (in units of K) on the DSS planet, with and without Heavy Ordnance, and on the
//    other planets while Heavy Ordnance runs: the engine's dssBonus / hodMult / hodOther
//  - each region capture: how much planet health went with it, against the region's full HP (wiki: 1.5x)
//
// Damage is measured on three kinds of planet, and a bonus is only ever a ratio within one kind:
//  lib  liberation, no open region: planet HP lost + its regen
//  reg  liberation with open regions (cities): planet HP lost + regen, plus every open region's HP lost + its regen
//  def  defense event: event HP lost (no regen)
// The DSS often sits on a planet with cities or on a defense, so measuring liberation alone left it at zero.
//
// sample.pl[i] = [HP, players, regen/s, max HP, event id, open regions, owner, event end, missions won, regions]
// regions: [id, HP, full HP, open, regen/s, players] (regen and players since 31 Oct 2026)

export const KINDS = ['lib', 'reg', 'def'];
const BUCKETS = ['base', 'dss', 'hodDss', 'hodOther'];
const MIN = { dss: 20, hodDss: 10, hodOther: 20 };

const med = (a) => { const x = [...a].sort((p, q) => p - q); return x.length ? x[x.length >> 1] : null; };

export function measure(hist, K) {
  // v3: per kind of planet; the older store (liberation only) is replayed from the samples still kept
  if (!hist.measure || hist.measure.v !== 3)
    hist.measure = { v: 3, last: 0, kv: Object.fromEntries(KINDS.map(k => [k, Object.fromEntries(BUCKETS.map(b => [b, []]))])), caps: [], ta: [] };
  const M = hist.measure;
  const cap = (a, n = 3000) => { if (a.length > n) a.splice(0, a.length - n); };
  const S = hist.samples || [];
  for (let k = 1; k < S.length; k++) {
    const a = S[k - 1], b = S[k];
    if (b.t <= M.last) continue;
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0 || dt > 35 * 60 || !a.imp || !a.N) continue;
    for (const [i, v] of Object.entries(a.pl || {})) {
      const w = b.pl?.[i]; if (!w) continue;
      const [h0, p0, r0, m0, e0, g0, o0] = v, [h1, , , m1, e1, g1, o1] = w;
      // a region taken between the two snapshots: open before, gone or closed after, same owner
      if (v[9] && w[9] && !e0 && o0 === o1 && o0 !== 'Humans') {
        for (const rg of v[9]) {
          const after = w[9].find(x => x[0] === rg[0]);
          if (rg[3] && rg[1] > 0 && rg[2] > 0 && (!after || !after[3] || after[1] <= 0) && rg[1] < 0.35 * rg[2])
            M.caps.push({ t: b.t, i: Number(i), id: rg[0], max: rg[2], left: rg[1], drop: h0 - h1, regen: (r0 || 0) * dt, players: p0, imp: a.imp, dt });
        }
      }
      if (p0 < 300 || m0 !== m1 || h1 <= 0) continue;
      let kind, gross;
      if (e0 || e1) {
        // defense: the same event before and after, still running
        if (e0 !== e1 || !e0) continue;
        kind = 'def'; gross = h0 - h1;
      } else {
        if (o0 !== o1 || o0 === 'Humans' || h0 >= 0.995 * m0) continue;
        if (!g0 && !g1) { kind = 'lib'; gross = (h0 - h1) + (r0 || 0) * dt; }
        else {
          // cities: the same regions open before and after (a capture in between is measured above instead),
          // and every open region's regen on record
          const R0 = (v[9] || []).filter(x => x[3]), R1 = w[9] || [];
          if (!R0.length || R0.length !== g1 || R0.some(x => x[4] == null)) continue;
          let rg = 0, ok = true;
          for (const x of R0) { const y = R1.find(z => z[0] === x[0]); if (!y || !y[3]) { ok = false; break; } rg += (x[1] - y[1]) + x[4] * dt; }
          if (!ok) continue;
          kind = 'reg'; gross = (h0 - h1) + (r0 || 0) * dt + rg;
        }
      }
      if (!(gross > 0)) continue;
      const kv = gross / (p0 * a.imp * dt) / K;
      if (!isFinite(kv) || kv > 20) continue;
      const onDss = String(a.dss) === String(i);
      M.kv[kind][a.hod ? (onDss ? 'hodDss' : 'hodOther') : (onDss ? 'dss' : 'base')].push(+kv.toFixed(4));
    }
  }
  M.last = S.length ? S[S.length - 1].t : M.last;
  for (const k of KINDS) Object.values(M.kv[k]).forEach(x => cap(x));
  cap(M.caps, 500); cap(M.ta, 200);

  // each bonus: the ratio to plain planets of the same kind; the kind with the most samples of the bonus wins
  const ratio = (bucket) => {
    const per = KINDS.map(k => ({ k, n: M.kv[k][bucket].length, base: M.kv[k].base.length, x: M.kv[k][bucket].length && M.kv[k].base.length >= 20 ? med(M.kv[k][bucket]) / med(M.kv[k].base) : null }));
    const n = per.reduce((s, p) => s + p.n, 0);
    const best = per.filter(p => p.x != null && p.n >= MIN[bucket]).sort((p, q) => q.n - p.n)[0];
    const by = Object.fromEntries(per.filter(p => p.n).map(p => [p.k, p.n]));
    return best ? { n, x: +best.x.toFixed(3), kind: best.k, by } : { n, by };
  };
  const baseLib = med(M.kv.lib.base);
  hist.measured = {
    dss: ratio('dss'), hodDss: ratio('hodDss'), hodOther: ratio('hodOther'),
    // planet health lost with a capture, beyond what the players there would have dealt anyway, per full region HP
    regionBonus: M.caps.length ? { n: M.caps.length, x: +med(M.caps.map(c => (c.drop + c.regen - (baseLib ? baseLib * K * c.players * c.imp * c.dt : 0)) / c.max)).toFixed(3) } : { n: 0 },
    // how many snapshots ran with the DSS over a planet, and with Heavy Ordnance on: proof the measuring can happen
    seen: { dss: S.filter(s => s.dss != null).length, hod: S.filter(s => s.hod).length, of: S.length },
  };
  return hist.measured;
}

// The station's actions as the API reports them, kept whenever one changes: the API doesn't document what
// each status number means (we read 2 as "active"), so this log is how that reading gets checked.
export function logStation(hist, st, now) {
  const M = hist.measure; if (!M || !st) return;
  const cur = (st.tacticalActions || []).map(a => [String(a.name || a.id32), a.status, a.statusExpire || null]);
  const key = JSON.stringify(cur.map(x => x.slice(0, 2)));
  if (M.taKey === key) return;
  M.taKey = key; M.ta.push({ t: now, planet: st.planet?.index ?? null, a: cur });
}
