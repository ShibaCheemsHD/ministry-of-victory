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
    const st = { hp: null, pl: null, r: null, owner: null, reg: false, hpT: null, ownT: null, regs: null }; const out = [];
    for (const x of list) {
      const tt = times[x.eind];
      if (x.hp != null) { st.hp = Number(x.hp) || 0; st.hpT = tt; }
      if (x.t != null && OWNER[x.t >> 4] !== st.owner) st.ownT = tt; if (x.pl != null) st.pl = Number(x.pl) || 0; if (x.r != null) st.r = Number(x.r) || 0;
      if (x.t != null) { st.owner = OWNER[x.t >> 4] || null; st.tRaw = x.t; }
      // a planet with enemy-held regions: capturing them adds a damage bonus, so its readings don't measure the players
      if (x.regions) { const rg = Object.values(x.regions); st.reg = rg.some(g => g && g.t != null && (g.t >> 4) !== 1); st.regs = rg; }
      out.push({ t: tt, i: x.eind, hp: st.hp, pl: st.pl, r: st.r, owner: st.owner, reg: st.reg, hpSet: x.hp != null, tRaw: st.tRaw, hpT: st.hpT, ownT: st.ownT, regs: st.regs });
    }
    P[idx] = out;
  }
  const maxHp = {}; for (const [k, l] of Object.entries(P)) maxHp[k] = Math.max(0, ...l.map(s => s.hp || 0));
  const stateAt = (idx, t) => { const l = P[idx]; if (!l) return null; let s = null; for (const x of l) { if (x.t > t) break; s = x; } return s; };
  const playersAt = (t) => { let lo = 0, hi = times.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k >= 0 ? allAt[k] : null; };

  // strength of the playerbase: HP per hour that 100% of the players would deal (the engine's C),
  // from successive health readings on enemy planets in the week before t
  function capacityAt(t) {
    // a week of readings; where the log is sparse, look further back (up to a month)
    for (const days of [7, 14, 30]) {
      const vals = [];
      for (const [k, l] of Object.entries(P)) {
        let prev = null;
        for (const x of l) {
          if (!x.hpSet) continue;
          if (x.t > t) break;
          if (prev && x.t >= t - days * 24 * H && prev.owner && prev.owner !== 'Humans' && x.owner === prev.owner && !prev.reg && !x.reg && prev.hp < maxHp[k] * 0.995) {
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
      if (vals.length >= 12) return { C: vals[Math.floor(vals.length * 0.5)], n: vals.length, days };
    }
    return null;
  }

  // planet names, longest first, to find the targets named in an order's title or launch dispatch
  const names = Object.entries(hist.galaxystatic || {}).map(([k, g]) => [String(g && g.name || '').toLowerCase(), Number(k)])
    .filter(([n]) => n.length >= 3 && n !== 'super earth').sort((a, b) => b[0].length - a[0].length);
  const namedIn = (txt0) => { let s0 = ' ' + String(txt0 || '').toLowerCase().replace(/<[^>]+>/g, ' ') + ' '; const found = [];
    for (const [n, k] of names) { const re = new RegExp('(^|[^a-z0-9])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)'); if (re.test(s0)) { found.push(k); s0 = s0.replace(re, ' '); } }
    return found; };
  // dispatches around a launch: anything sent within 20 minutes of it, or one that talks about the order
  const dispNear = (i0) => { const out = []; const t0 = times[i0];
    for (let j = i0; j >= 0 && times[j] >= t0 - 1 * H; j--) out.push(...(ev[j].log || []).filter(l => l.type === 'Dispatch').map(l => [l, times[j]]));
    for (let j = i0 + 1; j < ev.length && times[j] <= t0 + 2 * H; j++) out.push(...(ev[j].log || []).filter(l => l.type === 'Dispatch').map(l => [l, times[j]]));
    return out.filter(([l, t]) => !/order (failed|complete|won)|major order (lost|victory)/i.test(l.text || '') && (Math.abs(t - t0) <= 20 * 60e3 || /major order|operation order/i.test(l.text || ''))).map(([l]) => l); };
  const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const FAC_WORD = [[/illuminate|squid/i, 'Illuminate'], [/automaton|bot\b|cyborg/i, 'Automaton'], [/terminid|bug/i, 'Terminids']];
  // Major Orders with their launch dispatch planets
  const mos = new Map();
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i], t = times[i];
    for (const l of e.log || []) {
      const m = /^Major Order (Start|Won|Lost)$/.exec(l.type || ''); if (!m) continue;
      const tx = String(l.text || '').replace(/^\s*(Major|Minor) Order\s*\|\s*/i, '');
      const code = (tx.match(/A\d+-\d+-\d+/) || [null])[0];
      const name = tx.replace(/A\d+-\d+-\d+\s*/, '').replace(/\s*is\s*(issued|won|failed).*$/i, '').replace(/^[-\s]+/, '').trim();
      const obj = ((tx.match(/Objective:\s*(.*)$/i) || [])[1] || '').trim();
      const x = mos.get(code || name) || { code, name, obj };
      if (m[1] === 'Start') {
        x.start = t; x.obj = obj || x.obj;
        // targets: the planets the log tags on the order itself; else those named in its title; else in its launch dispatch
        const ds = dispNear(i);
        const fromLog = (l.planet || []).map(p => p[1]).filter(k => k !== 0);
        const fromTitle = namedIn(name);
        const fromDisp = [...new Set([...ds.flatMap(d => namedIn(d.text)), ...ds.flatMap(d => (d.planet || []).map(p => p[1]))])].filter(k => k !== 0);
        x.planets = fromLog.length ? fromLog : fromTitle.length ? fromTitle : fromDisp;
        x.src = fromLog.length ? 'log' : fromTitle.length ? 'title' : fromDisp.length ? 'disp' : null;
        x.anyOf = /\bor\b/i.test(name) || ds.some(d => /\b(either|choose|one of the)\b/i.test(d.text || ''));
        // "Liberate 3 Magma Worlds": how many, and of which enemy
        const cm = /liberate\s+(\d+|one|two|three|four|five|six)\b/i.exec(name);
        x.count = cm ? (Number(cm[1]) || NUM[cm[1].toLowerCase()]) : null;
        x.fac = OWNER[l.faction] && l.faction !== 1 ? OWNER[l.faction] : (FAC_WORD.find(([re]) => re.test(name)) || [])[1] || null;
        x.mixed = /\//.test(obj) || /\b(kill|eradicate|defend|hold|extract)\b/i.test(name);
      }
      else { x.end = t; x.result = m[1] === 'Won' ? 'won' : 'lost'; }
      mos.set(code || name, x);
    }
  }

  const out = [];
  // (t 17: a Super Earth world overrun by Voteless hordes, liberated like an enemy one - June 2026)
  const enemyAt = (idx, t0) => { const s = stateAt(String(idx), t0); return s && s.owner && (s.owner !== 'Humans' || s.tRaw === 17) && s.hp != null ? s : null; };
  // the health on record must have been read since the planet last changed hands, or it belongs to an older fight
  const fresh = (s) => s && s.hpT != null && (s.ownT == null || s.hpT >= s.ownT);
  // biggest health each region was seen at, for its max
  const regMax = {}; for (const [k, l] of Object.entries(P)) for (const x of l) for (const g of x.regs || []) { const key = k + ':' + g.name; regMax[key] = Math.max(regMax[key] || 0, Number(g.hp) || 0); }
  // full health around t: the biggest reading in the months before (planet sizes have changed over the war)
  const maxNear = (idx, t) => { let m = 0; for (const x of P[idx] || []) { if (x.t > t) break; if (x.hpSet && x.t >= t - 120 * 24 * H) m = Math.max(m, x.hp || 0); } return m || maxHp[idx] || 0; };
  // a planet taken (back) by the enemy since its last health reading starts that fight at full health
  const asPlanet = (idx, s, t) => { const max = Math.max(maxNear(idx, t), s.hp || 0); return { index: Number(idx), name: hist.galaxystatic?.[idx]?.name || '#' + idx, maxHealth: max, health: fresh(s) ? s.hp : max,
    regenPerSecond: s.r || 0, currentOwner: s.owner === 'Humans' ? 'Illuminate' : s.owner, statistics: { playerCount: s.pl || 0 }, event: null,
    regions: (s.regs || []).filter(g => g && g.t != null && (g.t >> 4) !== 1 && Number(g.hp) > 0).map(g => ({ name: g.name, health: Number(g.hp), maxHealth: regMax[idx + ':' + g.name] || Number(g.hp), regenPerSecond: Number(g.r) || 0, isAvailable: true })) }; };
  for (const mo of mos.values()) {
    const lib = /liberat/i.test((mo.obj || '') + ' ' + (mo.name || ''));
    // "Secure Clasa, Yed Prior, Adhara and Mog": a control order over named planets is a liberation of the ones the enemy holds
    const ctrl = !lib && /control|secure/i.test((mo.obj || '') + ' ' + (mo.name || '')) && (mo.src === 'log' || mo.src === 'title');
    if (!lib && !ctrl) continue;
    const base = { code: mo.code, name: mo.name, start: mo.start || null, end: mo.end || null, result: mo.result || null };
    const skip = (why) => out.push({ ...base, skip: why });
    if (!mo.start) { skip('noStart'); continue; }
    if (!mo.end) continue;   // still running
    const t0 = mo.start + 5 * 60e3;   // a few minutes in, once the launch has settled in the log
    const N = playersAt(t0); if (!N) { skip('noPlayers'); continue; }
    const cap = capacityAt(mo.start); if (!cap) { skip('noCalib'); continue; }
    const named = (mo.planets || []).filter(k => enemyAt(k, t0));
    // targets read off the launch dispatch alone may include planets it only mentions: judge the easiest one
    const loose = mo.src === 'disp' && !mo.count && named.length > 1;
    const planets = {}, tasks = []; let pool = null;
    if (mo.count) {
      if (named.length >= mo.count) {
        // the planets it named: all of them when the count matches, else any `count` of them
        for (const k of named) planets[k] = asPlanet(k, enemyAt(k, t0), t0);
        if (named.length === mo.count) named.forEach(k => tasks.push({ type: 11, values: [1, 1, Number(k)], valueTypes: [3, 11, 12] }));
        else { tasks.push({ type: 14, values: [mo.count], valueTypes: [3] }); pool = 'named'; }
      } else if (mo.fac) {
        // no list: any `count` worlds of that enemy (the easiest ones count, so this can only be kinder than the real order)
        for (const k of Object.keys(P)) { const st = enemyAt(k, t0); if (st && st.owner === mo.fac) planets[k] = asPlanet(k, st, t0); }
        tasks.push({ type: 14, values: [{ Humans: 1, Terminids: 2, Automaton: 3, Illuminate: 4 }[mo.fac], mo.count], valueTypes: [1, 3] }); pool = 'faction';
      } else { skip(named.length ? 'fewTargets' : 'noTargets'); continue; }
    } else {
      if (!(mo.planets || []).length) { skip('noTargets'); continue; }
      if (!named.length) { skip(ctrl ? 'type' : 'notHeld'); continue; }
      for (const k of named) { planets[k] = asPlanet(k, enemyAt(k, t0), t0); tasks.push({ type: 11, values: [1, 1, Number(k)], valueTypes: [3, 11, 12] }); }
    }
    if (!Object.keys(planets).length) { skip('notHeld'); continue; }
    // a lost order ran to its deadline; a won one finished early, so its own length is a safe deadline
    const deadline = mo.end;
    const ctx = { planets, N, now: t0, C: cap.C, dssIdx: null, hod: null, settings: { ...E.DEFAULTS }, samples: [], sectorOf: null, startMs: mo.start };
    const anyOf = (mo.anyOf || loose) && tasks.length > 1;
    const a = { id: mo.code || mo.name, tasks, progress: tasks.map(() => 0), expiration: new Date(deadline).toISOString(), flags: anyOf ? 2 : 1 };
    let res;
    try { res = E.analyzeAssignment(a, ctx); } catch (e) { skip('error'); continue; }
    if (res.anyOf) { const pk = res.tasks[res.pick]; const sub = pk && pk.planet ? E.analyzeAssignment({ ...a, flags: 1, tasks: [a.tasks[res.pick]], progress: [0] }, ctx) : null; if (sub) res = { ...res, liberation: sub.liberation, verdict: sub.verdict }; }
    const L = res.liberation;
    const libN = !L && (res.tasks || []).find(x => x.libN);
    let v = res.verdict === 'ontrack' ? 'ontrack' : L ? L.verdict : res.verdict, need = L && isFinite(L.seqNeed) ? L.seqNeed : null;
    if (libN) { v = libN.libN.verdict || v; need = isFinite(libN.libN.seqNeed) ? libN.libN.seqNeed : need; }
    if (!v || v === 'unknown') { skip('error'); continue; }
    const shown = pool === 'faction' ? [] : Object.values(planets);
    out.push({ ...base, hours: +((deadline - mo.start) / H).toFixed(1), anyOf, loose, count: mo.count || null, pool, fac: pool === 'faction' ? mo.fac : null, partial: !!(mo.mixed || ctrl || (mo.src !== 'disp' && named.length < (mo.planets || []).length)),
      v, need: need != null ? +need.toFixed(3) : null, players: N, C: Math.round(cap.C), calib: cap.n,
      targets: shown.map(p => ({ i: p.index, n: p.name, hp: p.health, max: p.maxHealth, r: p.regenPerSecond, pl: p.statistics.playerCount, o: p.currentOwner })) });
  }
  return out.sort((x, y) => y.start - x.start);
}
