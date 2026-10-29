// Retro "day-one call" for past liberation Major Orders, rebuilt from the community war log
// (CrossWaveOmega/helldiversplanettable: historydata.json + resort.json).
//
// For each liberation order: the planets named in its launch dispatch, their enemy health, regen and
// Helldivers at launch, everyone online at launch, and the deadline (for a lost order, the moment it
// was lost; a won order shows how long it took). The playerbase's strength at the time is measured
// from the same log: hour by hour, the damage dealt on enemy planets against the share of players
// on them, over the week before launch. The site's own engine then says what share of everyone
// online the order needed from the first hour.
const H = 3.6e6;
const OWNER = { 1: 'Humans', 2: 'Terminids', 3: 'Automaton', 4: 'Illuminate' };
const tOf = (s) => Date.parse(String(s).slice(0, 16).replace(' ', 'T') + ':00Z');

export function buildRetro(hist, resort, E) {
  const ev = hist.events || [];
  const times = ev.map(e => tOf(e.time));
  // everyone online at an event index (the last count at or before it)
  const allAt = []; let lastAll = null;
  for (let i = 0; i < ev.length; i++) { if (ev[i].all_players) lastAll = ev[i].all_players; allAt[i] = lastAll; }
  // planet timelines: [{t, i, hp, pl, r, owner}] with the state carried forward
  const P = {};
  for (const [idx, list] of Object.entries(resort)) {
    const st = { hp: null, pl: null, r: null, owner: null, reg: false }; const out = [];
    for (const x of list) {
      if (x.hp != null) st.hp = Number(x.hp) || 0; if (x.pl != null) st.pl = Number(x.pl) || 0; if (x.r != null) st.r = Number(x.r) || 0;
      if (x.t != null) st.owner = OWNER[x.t >> 4] || null;
      if (x.regions && Object.keys(x.regions).length) st.reg = true;
      out.push({ t: times[x.eind], i: x.eind, hp: st.hp, pl: st.pl, r: st.r, owner: st.owner, reg: st.reg, hpSet: x.hp != null });
    }
    P[idx] = out;
  }
  const maxHp = {}; for (const [k, l] of Object.entries(P)) maxHp[k] = Math.max(0, ...l.map(s => s.hp || 0));
  const stateAt = (idx, t) => { const l = P[idx]; if (!l) return null; let s = null; for (const x of l) { if (x.t > t) break; s = x; } return s; };
  const playersAt = (t) => { let lo = 0, hi = times.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k >= 0 ? allAt[k] : null; };

  // strength of the playerbase: HP per hour that 100% of the players would deal (the engine's C),
  // from successive health readings on enemy planets in the week before t
  function capacityAt(t) {
    const vals = [];
    for (const [k, l] of Object.entries(P)) {
      let prev = null;
      for (const x of l) {
        if (!x.hpSet) continue;
        if (x.t > t) break;
        if (prev && x.t >= t - 7 * 24 * H && prev.owner && prev.owner !== 'Humans' && x.owner === prev.owner && !prev.reg && prev.hp < maxHp[k] * 0.995) {
          const dt = (x.t - prev.t) / H, all = playersAt(prev.t);
          if (dt >= 0.5 && dt <= 8 && all && prev.pl > 0) {
            const share = prev.pl / all, gross = (prev.hp - x.hp) + (prev.r || 0) * 3600 * dt;
            if (share >= 0.03 && gross > 0) vals.push(gross / dt / share);
          }
        }
        prev = x;
      }
    }
    vals.sort((a, b) => a - b);
    return vals.length >= 12 ? { C: vals[Math.floor(vals.length * 0.5)], n: vals.length } : null;
  }

  // planet names, longest first, to find the targets named in an order's title or launch dispatch
  const names = Object.entries(hist.galaxystatic || {}).map(([k, g]) => [String(g && g.name || '').toLowerCase(), Number(k)])
    .filter(([n]) => n.length >= 3 && n !== 'super earth').sort((a, b) => b[0].length - a[0].length);
  const namedIn = (txt0) => { let s0 = ' ' + String(txt0 || '').toLowerCase().replace(/<[^>]+>/g, ' ') + ' '; const found = [];
    for (const [n, k] of names) { const re = new RegExp('(^|[^a-z0-9])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)'); if (re.test(s0)) { found.push(k); s0 = s0.replace(re, ' '); } }
    return found; };
  const dispNear = (i0) => { const out = []; const t0 = times[i0];
    for (let j = i0; j >= 0 && times[j] >= t0 - 1 * H; j--) out.push(...(ev[j].log || []).filter(l => l.type === 'Dispatch'));
    for (let j = i0 + 1; j < ev.length && times[j] <= t0 + 2 * H; j++) out.push(...(ev[j].log || []).filter(l => l.type === 'Dispatch'));
    return out.filter(l => /major order/i.test(l.text || '')); };
  // Major Orders with their launch dispatch planets
  const mos = new Map();
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i], t = times[i];
    const disp = null;
    for (const l of e.log || []) {
      const m = /^Major Order (Start|Won|Lost)$/.exec(l.type || ''); if (!m) continue;
      const tx = String(l.text || '').replace(/^Major Order \|\s*/, '');
      const code = (tx.match(/A\d+-\d+-\d+/) || [null])[0];
      const name = tx.replace(/A\d+-\d+-\d+\s*/, '').replace(/\s*is\s*(issued|won|failed).*$/i, '').replace(/^[-\s]+/, '').trim();
      const obj = ((tx.match(/Objective:\s*(.*)$/i) || [])[1] || '').trim();
      const x = mos.get(code || name) || { code, name, obj };
      if (m[1] === 'Start') {
        x.start = t; x.obj = obj || x.obj;
        // targets: planets named in the order's title; else the ones its launch dispatch names or tags
        const ds = dispNear(i);
        const fromTitle = namedIn(name);
        const fromDisp = [...new Set([...ds.flatMap(d => (d.planet || []).map(p => p[1])), ...ds.flatMap(d => namedIn(d.text))])].filter(k => k !== 0);
        x.planets = fromTitle.length ? fromTitle : fromDisp;
        x.anyOf = /\bor\b/i.test(name) || ds.some(d => /\b(either|choose|one of the)\b/i.test(d.text || ''));
        x.count = /liberate\s+(\d+|two|three|four|five)\b/i.test(name) && !fromTitle.length;
      }
      else { x.end = t; x.result = m[1] === 'Won' ? 'won' : 'lost'; }
      mos.set(code || name, x);
    }
  }

  const out = [];
  for (const mo of mos.values()) {
    if (!/liberat/i.test((mo.obj || '') + ' ' + (mo.name || '')) || !mo.start || !mo.end || mo.count || !mo.planets || !mo.planets.length) continue;
    const t0 = mo.start + 5 * 60e3;   // a few minutes in, once the launch has settled in the log
    const N = playersAt(t0); if (!N) continue;
    const cap = capacityAt(mo.start); if (!cap) continue;
    const planets = {}, tasks = [];
    for (const idx of mo.planets) {
      const s = stateAt(String(idx), t0);
      if (!s || !s.owner || s.owner === 'Humans' || s.hp == null) continue;   // only planets the enemy held at launch
      planets[idx] = { index: Number(idx), name: hist.galaxystatic?.[idx]?.name || '#' + idx, maxHealth: maxHp[idx] || s.hp, health: s.hp,
        regenPerSecond: s.r || 0, currentOwner: s.owner, statistics: { playerCount: s.pl || 0 }, regions: [], event: null };
      tasks.push({ type: 11, values: [1, 1, Number(idx)], valueTypes: [3, 11, 12] });
    }
    if (!tasks.length) continue;
    // a lost order ran to its deadline; a won one finished early, so its own length is a safe deadline
    const deadline = mo.end;
    const a = { id: mo.code || mo.name, tasks, progress: tasks.map(() => 0), expiration: new Date(deadline).toISOString(), flags: mo.anyOf && tasks.length > 1 ? 2 : 1 };
    let res;
    try { res = E.analyzeAssignment(a, { planets, N, now: t0, C: cap.C, dssIdx: null, hod: null, settings: { ...E.DEFAULTS }, samples: [], sectorOf: null, startMs: mo.start }); } catch { continue; }
    const L = res.liberation;
    if (res.anyOf) { const pk = res.tasks[res.pick]; const sub = pk && pk.planet ? E.analyzeAssignment({ ...a, flags: 1, tasks: [a.tasks[res.pick]], progress: [0] }, { planets, N, now: t0, C: cap.C, dssIdx: null, hod: null, settings: { ...E.DEFAULTS }, samples: [], sectorOf: null, startMs: mo.start }) : null; if (sub) res = { ...res, liberation: sub.liberation, verdict: sub.verdict }; }
    out.push({ code: mo.code, name: mo.name, start: mo.start, end: mo.end, result: mo.result, hours: +((deadline - mo.start) / H).toFixed(1), anyOf: !!(mo.anyOf && tasks.length > 1),
      v: res.verdict === 'ontrack' ? 'ontrack' : L ? L.verdict : res.verdict, need: L && isFinite(L.seqNeed) ? +L.seqNeed.toFixed(3) : null,
      players: N, C: Math.round(cap.C), calib: cap.n, targets: Object.values(planets).map(p => ({ i: p.index, n: p.name, hp: p.health, max: p.maxHealth, r: p.regenPerSecond, pl: p.statistics.playerCount, o: p.currentOwner })) });
  }
  return out.sort((x, y) => y.start - x.start);
}
