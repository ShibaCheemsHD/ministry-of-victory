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

export function buildRetro(hist, resort, E, hs = null, live = null) {
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
  const stateAt = (idx, t) => { const l = P[idx]; if (!l || !l.length || l[0].t > t) return null; let lo = 0, hi = l.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (l[m].t <= t) lo = m; else hi = m - 1; } return l[lo]; };
  const logEnd = times.length ? times[times.length - 1] : 0;
  // everyone online at t (nothing past the end of the log: its last count would be stale)
  const playersAt = (t) => { if (t > logEnd + 2 * H) return null; let lo = 0, hi = times.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k >= 0 ? allAt[k] : null; };

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

  // Share of everyone online fighting where an objective counts at time t: on its planet, on its enemy's
  // planets, or everywhere. From the war log, or past its end from the recorder's own snapshots (live).
  const shareAt = (t, f, idx) => {
    if (t <= logEnd + 2 * H) {
      const all = playersAt(t); if (!all) return null;
      if (idx != null) { const st = stateAt(String(idx), t); return st ? (st.pl || 0) / all : null; }
      if (!f) return 1;
      let n = 0; for (const k of Object.keys(P)) { const st = stateAt(k, t); if (st && st.owner === f && st.pl) n += st.pl; }
      return n / all;
    }
    const sm = (live?.samples || []).filter(x => x.N && Math.abs(x.t - t) <= 20 * 60e3).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
    if (!sm) return null;
    if (idx != null) return sm.pl?.[idx] ? (sm.pl[idx][1] || 0) / sm.N : null;
    if (!f) return 1;
    let n = 0; for (const [k, v] of Object.entries(sm.pl || {})) { const fk = v[4] ? live?.factions?.[k] : v[6]; if (fk === f) n += v[1] || 0; }
    return n / sm.N;
  };
  // average of that share over a stretch (every 2 hours)
  const shareOver = (t0, t1, f, idx) => { const v = []; for (let t = t0; t <= t1; t += 2 * H) { const x = shareAt(t, f, idx); if (x != null) v.push(x); } return v.length >= Math.max(1, Math.floor((t1 - t0) / (4 * H))) ? v.reduce((a, b) => a + b, 0) / v.length : null; };

  // Orders whose exact objectives and progress over time are on record (helldiversstats.com, since May
  // 2026): kill, extraction, mission and operation counts are judged on the Helldivers' best 24 hours
  // (half the order, for orders shorter than a day and a half) kept up from start to finish, against the
  // goal. Liberation objectives in them are judged frozen at launch, as above.
  const RANKV = { done: 0, ontrack: 1, effort: 2, focus: 2, hard: 3, record: 3, nearly_impossible: 4, impossible: 5 };
  const COUNTER = new Set([1, 2, 3, 4, 5, 6, 7, 9, 10]);
  for (const o of Object.values(hs || {})) {
    if (!o.complete || !o.tasks?.length || !o.pts?.length) continue;
    // the war log's entry for it: the Major Order that started within 3 hours
    const mo = [...mos.values()].find(m => m.start && Math.abs(m.start - o.start) < 3 * H);
    const code = mo?.code || null;
    const ts = o.tasks.map(tk => E.parseTask(tk, 0));
    // its result when the war log hasn't caught up: every objective done at the last reading, or it ran out
    const lastP = o.pts[o.pts.length - 1];
    const allDone = lastP && ts.every((t, i) => (Number(lastP[1 + i]) || 0) >= (t.goal && COUNTER.has(t.type) ? t.goal : 1));
    // (gone well before its deadline: Super Earth closes an order as soon as it is done)
    const hsResult = allDone ? 'won' : o.exp - o.last < 20 * 60e3 ? 'lost' : 'won';
    const base = { code, name: mo?.name || null, start: mo?.start || o.start, end: mo?.end || o.exp, result: mo?.result || hsResult, src: 'hs', hsId: o.id };
    const cIdx = ts.map((t, i) => COUNTER.has(t.type) && t.goal ? i : -1).filter(i => i >= 0);
    const lIdx = ts.map((t, i) => t.type === 11 ? i : -1).filter(i => i >= 0);
    const other = ts.length - cIdx.length - lIdx.length;
    // the exact objectives win over what the war log let us guess: replace a log-based check of the same order
    const idx = out.findIndex(x => (code && x.code === code) || Math.abs(x.start - base.start) < 3 * H);
    // nothing to judge from the record: keep a check the war log allowed, else say why
    const skip = (why) => { if (idx >= 0) { if (out[idx].skip) out[idx] = { ...out[idx], skip: why }; } else out.push({ ...base, skip: why }); };
    if (!cIdx.length && !lIdx.length) { skip('defend'); continue; }
    // players and strength at launch come from the war log: only liberation objectives need them
    const t0 = o.start + 5 * 60e3, N0 = playersAt(t0), cap = lIdx.length ? capacityAt(o.start) : null;
    if (lIdx.length && (!N0 || !cap) && !cIdx.length) { skip('data'); continue; }
    const deadline = o.exp, hoursAll = (deadline - o.start) / H;
    const anyOf = (o.flags === 2 || o.flags === 3) && ts.length > 1;
    const parts = [];   // [{ k: task index, v, need?, pace? }]
    // liberation objectives, frozen at launch: all of them together (or the easiest, for a choice)
    if (lIdx.length && N0 && cap) {
      const planets = {}, held = lIdx.filter(k => { const st = enemyAt(ts[k].planetIndex, t0); if (st) planets[ts[k].planetIndex] = asPlanet(ts[k].planetIndex, st, t0); return !!st; });
      if (!held.length) parts.push({ k: lIdx[0], v: 'done' });
      else try {
        const ctx = { planets, N: N0, now: t0, C: cap.C, dssIdx: null, hod: null, settings: { ...E.DEFAULTS }, samples: [], sectorOf: null, startMs: o.start };
        const a = { id: o.id, tasks: held.map(k => o.tasks[k]), progress: held.map(() => 0), expiration: new Date(deadline).toISOString(), flags: anyOf ? 2 : 1 };
        let r = E.analyzeAssignment(a, ctx);
        if (r.anyOf) { const sub = E.analyzeAssignment({ ...a, flags: 1, tasks: [a.tasks[r.pick]], progress: [0] }, ctx); if (sub) r = { ...r, liberation: sub.liberation, verdict: sub.verdict }; }
        const L = r.liberation;
        parts.push({ k: held[0], v: L ? L.verdict : r.verdict, need: L && isFinite(L.seqNeed) ? L.seqNeed : null, planets: Object.values(planets) });
      } catch { }
    }
    // counters: could the Helldivers' best day, kept up from start to finish, have reached the goal?
    // (what they managed is the fairest measure of what was possible; the first hours undersell it)
    if (cIdx.length) {
      const span = hoursAll >= 36 ? 24 : Math.max(3, hoursAll / 2);
      for (const k of cIdx) {
        const goal = ts[k].goal, ser = o.pts.map(p => [p[0], Number(p[1 + k]) || 0]);
        const fin = ser[ser.length - 1];
        if (!fin || (fin[0] - o.start) / H < span) continue;
        if (fin[1] >= goal) { parts.push({ k, v: 'done', cap: 1 }); continue; }
        let best = 0, bw = null, j = 0;
        for (let i = 0; i < ser.length; i++) {
          while (j < ser.length - 1 && ser[j][0] < ser[i][0] + span * H) j++;
          const dt = (ser[j][0] - ser[i][0]) / H;
          if (dt >= span * 0.9) { const rt = (ser[j][1] - ser[i][1]) / dt; if (rt > best) { best = rt; bw = [ser[i][0], ser[j][0]]; } }
        }
        if (!(best > 0)) continue;
        const cap = best * hoursAll / goal;
        // At that best-day pace per Helldiver, what share of everyone online would the goal take, start to
        // finish? Same scale as a liberation (60% winnable, 77% our best turnout, over 100% impossible).
        // The share is of the Helldivers where the objective counts (its planet, its enemy's front, or all).
        const sh = shareOver(bw[0], bw[1], ts[k].faction && ts[k].faction !== 'Humans' ? ts[k].faction : null, ts[k].planetIndex);
        const need = sh != null && sh > 0 ? sh / cap : null;
        const vN = need == null ? null : need <= 0.6 ? 'effort' : need <= E.DEFAULTS.recordShare ? 'record' : need <= 1 ? 'nearly_impossible' : 'impossible';
        // no player counts for that stretch: fall back on the pace alone (their best day, every day)
        const vC = cap >= 1.3 ? 'ontrack' : cap >= 1 ? 'hard' : cap >= 0.5 ? 'nearly_impossible' : 'impossible';
        parts.push({ k, v: vN || vC, need, share: sh, cap, best, span, f: ts[k].faction || null, count: true });
      }
    }
    // objectives the record can't judge (liberate N worlds, holds) that the war log did: keep that check as one more part
    const logged = idx >= 0 && !out[idx].skip && out[idx].src !== 'hs' && other > 0 ? out[idx] : null;
    if (logged) parts.push({ k: -1, v: logged.v, need: logged.need, planetsT: logged.targets || [] });
    const judged = parts.filter(p => RANKV[p.v] != null);
    if (!judged.length) { skip('data'); continue; }
    // the objective that decides it: the hardest (the easiest, for a choice); on a tie, the tightest margin
    const tight = (p) => p.cap != null ? -p.cap : p.need != null ? p.need : 0;
    const pickBy = (arr) => arr.reduce((w, p) => { const d = RANKV[p.v] - RANKV[w.v] || tight(p) - tight(w); return (anyOf ? d < 0 : d > 0) ? p : w; });
    let worst = pickBy(judged);
    // all objectives at once (not a choice): the players they need add up across enemies, while kills on a
    // front overlap with liberating that front's planets, and kills of any enemy overlap with everything
    const open = judged.filter(p => p.v !== 'done');
    if (!anyOf && open.length > 1 && open.every(p => p.need != null)) {
      const facOf = (p) => p.count ? p.f || '*' : (p.planets || []).length && new Set(p.planets.map(q => q.currentOwner)).size === 1 ? p.planets[0].currentOwner : 'lib';
      const by = {}; for (const p of open) { const f = facOf(p); by[f] = Math.max(by[f] || 0, p.need); }
      const tot = Math.max(Object.entries(by).filter(([f]) => f !== '*').reduce((a, [, x]) => a + x, 0), by['*'] || 0);
      const v = tot <= 0.6 ? 'effort' : tot <= E.DEFAULTS.recordShare ? 'record' : tot <= 1 ? 'nearly_impossible' : 'impossible';
      worst = { ...worst, v, need: tot, cap: null, combined: true };
    } else if (!anyOf && open.length > 1 && open.some(p => p.need == null) && open.every(p => p.count)) {
      // player counts missing for some of them: a share for only part of the order would undersell it,
      // so all of them are judged on the pace alone (the tightest one decides)
      const k0 = open.reduce((w, p) => p.cap < w.cap ? p : w);
      const vC = k0.cap >= 1.3 ? 'ontrack' : k0.cap >= 1 ? 'hard' : k0.cap >= 0.5 ? 'nearly_impossible' : 'impossible';
      worst = { ...k0, v: vC, need: null };
    }
    const final = o.pts[o.pts.length - 1];
    const entry = { ...base, hours: +hoursAll.toFixed(1), anyOf, partial: (other > 0 && !logged) || judged.length < parts.length, v: worst.v === 'done' ? 'ontrack' : worst.v,
      need: worst.need != null ? +worst.need.toFixed(3) : null, cap: worst.need == null && worst.cap != null ? +worst.cap.toFixed(3) : null, span: worst.span || null, combined: !!worst.combined,
      counts: !!(worst.count || worst.combined),
      players: N0 || null, C: cap ? Math.round(cap.C) : null,
      goals: cIdx.map(k => ({ k, type: ts[k].type, goal: ts[k].goal, f: ts[k].faction, item: ts[k].itemId, enemy: ts[k].enemyId, got: final ? final[1 + k] || 0 : null,
        cap: (parts.find(p => p.k === k) || {}).cap ?? null, need: (parts.find(p => p.k === k) || {}).need ?? null })),
      targets: [...parts.flatMap(p => p.planets || []).map(q => ({ i: q.index, n: q.name, hp: q.health, max: q.maxHealth, r: q.regenPerSecond, pl: q.statistics.playerCount, o: q.currentOwner })), ...parts.flatMap(p => p.planetsT || [])],
      tasks: o.tasks, brief: o.brief };
    if (idx >= 0) out[idx] = entry; else out.push(entry);
  }

  // Defend and hold orders depend on the attacks the enemy launches during the order, so there is no
  // day-one forecast. What the war log does show: how many attacks came (a "defend 8" order with only
  // 5 attacks launched could never be won) and which planets fell.
  const attacks = [];   // { i, f, start, end, won }
  {
    const open = new Map();
    for (let k = 0; k < ev.length; k++) for (const l of ev[k].log || []) {
      const m = /^(defense|invasion) (start|won|lost)$/.exec(l.type || ''); if (!m) continue;
      const i = (l.planet || [])[0]?.[1]; if (i == null) continue;
      const key = m[1] + ':' + i;
      if (m[2] === 'start') { const a = { i, f: OWNER[l.faction] || null, start: times[k], end: null, won: null, kind: m[1] }; attacks.push(a); open.set(key, a); }
      else { const a = open.get(key); if (a && a.end == null) { a.end = times[k]; a.won = m[2] === 'won'; open.delete(key); } }
    }
  }
  const flips = [];   // planets taken by the enemy: { i, t }
  for (const [k, l] of Object.entries(P)) { let prev = null; for (const x of l) { if (prev === 'Humans' && x.owner && x.owner !== 'Humans') flips.push({ i: Number(k), t: x.t }); prev = x.owner; } }
  const WORDN = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const facOf = (txt) => (FAC_WORD.find(([re]) => re.test(txt)) || [])[1] || null;
  for (const mo of mos.values()) {
    if (mo.result !== 'lost' || !mo.start || !mo.end) continue;
    const at = out.findIndex(x => (mo.code && x.code === mo.code) || (x.start && Math.abs(x.start - mo.start) < 60e3));
    if (at >= 0 && !out[at].skip) continue;   // already checked
    const hsO = Object.values(hs || {}).find(o => Math.abs(o.start - mo.start) < 3 * H);
    const ts = hsO ? hsO.tasks.map(tk => E.parseTask(tk, 0)) : [];
    // how many defenses it asked for, and against whom: the exact objective, else the title ("Repel 14 Illuminate Invasions")
    let need = null, fac = null;
    const dt = ts.find(t => t.type === 12);
    if (dt) { need = dt.goal; fac = dt.faction; }
    else { const m = /\b(?:defend|repel)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.exec(mo.name || ''); if (m) { need = Number(m[1]) || WORDN[m[1].toLowerCase()]; fac = facOf(mo.name || '') || OWNER[mo.fac] || null; } }
    const facts = {};
    // an attack counts if it was decided while the order ran (one still going at the deadline can't count)
    const live = (a) => a.end != null && a.end > mo.start && a.end <= mo.end + 30 * 60e3 && (!fac || a.f === fac);
    if (need) {
      const came = attacks.filter(live), won = came.filter(a => a.won).length;
      facts.attacks = { need, came: came.length, won, f: fac };
    }
    // planets lost during the order: the ones it named (to hold), else any
    const holdI = [...ts.filter(t => t.type === 13 && t.planetIndex != null).map(t => t.planetIndex), ...(mo.src !== 'disp' ? mo.planets || [] : [])];
    const fell = flips.filter(x => x.t > mo.start && x.t <= mo.end + 30 * 60e3 && holdI.includes(x.i));
    if (holdI.length) facts.held = { n: [...new Set(holdI)].length, fell: [...new Map(fell.map(x => [x.i, { i: x.i, n: hist.galaxystatic?.[x.i]?.name || '#' + x.i, t: x.t }])).values()] };
    const base = { code: mo.code, name: mo.name, start: mo.start, end: mo.end, result: mo.result };
    // too few attacks to ever reach the goal: lost by design, not by the Helldivers
    if (facts.attacks) {
      const r = facts.attacks.came / facts.attacks.need;
      const entry = { ...base, src: 'attacks', hours: +((mo.end - mo.start) / H).toFixed(1), v: r < 1 ? 'impossible' : r < 1.25 ? 'hard' : 'ontrack', need: null, cap: null,
        partial: ts.length > 1 || /\band\b|\//.test((mo.name || '') + ' ' + (mo.obj || '')), facts, hsId: hsO?.id || null };
      if (at >= 0) out[at] = entry; else out.push(entry);
      continue;
    }
    if (at >= 0) out[at] = { ...out[at], facts }; else out.push({ ...base, skip: 'type', facts, hsId: hsO?.id || null });
  }
  return out.sort((x, y) => y.start - x.start);
}
