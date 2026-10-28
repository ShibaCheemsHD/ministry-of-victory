/* MO Check - analysis engine (pure functions, no DOM, no network). */
const ENGINE = (() => {
  const TASK = {
    EXTRACT: 1, EXTRACT_WITH: 2, KILL: 3, OBJECTIVE: 4, PLAY_MISSION: 5, USE_EQUIPMENT: 6,
    MISSION_COMPLETE: 7, PERSONAL: 8, OPERATION_COMPLETE: 9, DONATION: 10,
    LIBERATE: 11, DEFEND_COUNT: 12, HOLD: 13, LIBERATE_COUNT: 14, NET_LIBERATION: 15,
  };
  const COUNTER_TYPES = new Set([1, 2, 3, 4, 5, 6, 7, 9, 10]);
  const FACTIONS = { 1: 'Humans', 2: 'Terminids', 3: 'Automaton', 4: 'Illuminate' };

  // Defaults measured on "Honour the Fallen" (Oct 2026): 100% of the playerbase
  // deals ~90k HP/h to one planet, DSS adds ~10%, HOD measured ~1.3x.
  // capacity: HP/h at a 50% share, 2026 median of the war archive. dssBonus: 0, the archive shows no
  // extra damage on the DSS planet (0.98-0.99x per share in 2024, 2025 and 2026).
  const DEFAULTS = { capacity: 100000, dssBonus: 0, hodMult: 1.3, recordShare: 0.77 };

  function parseTask(task, progress) {
    const v = {};
    (task.valueTypes || []).forEach((t, i) => { v[t] = Number(task.values[i]); });
    const out = {
      type: task.type, progress: Number(progress ?? 0), raw: v,
      faction: FACTIONS[v[1]] || null, goal: v[3] ?? null, enemyId: v[4] || null,
      itemId: v[6] ? (v[5] || null) : (v[5] || null), itemKind: v[6] || null,
      minDifficulty: v[9] || null, planetIndex: null, sectorIndex: null,
    };
    if (v[11] === 1) out.planetIndex = v[12];
    else if (v[11] === 2) out.sectorIndex = v[12];
    return out;
  }

  // Damage vs share of players on a planet. Hour-by-hour averages in the war archive (Sept 2025 -
  // Oct 2026) hint at share^0.91, but replaying 51 real liberations predicted fall times better
  // with a straight line (median miss 1.3h vs 1.7h on a 12h horizon), so the curve stays linear.
  // C is the playerbase capacity measured at a 50% share (HP per hour), the typical MO focus.
  const SHARE_EXP = 1.0, SHARE_REF = 0.5;
  const dmg = (share, C) => share > 0 ? C * SHARE_REF * Math.pow(share / SHARE_REF, SHARE_EXP) : 0;
  const shareFor = (gross, C) => gross > 0 ? SHARE_REF * Math.pow(gross / (C * SHARE_REF), 1 / SHARE_EXP) : 0;

  const isEnemy = (p) => p && p.currentOwner && p.currentOwner !== 'Humans';

  // Work (HP) still needed to liberate a planet, including the region capture bonus
  // (capturing a region deals 1.5x its HP to the planet).
  // Regions are taken one at a time: only the region under attack loses ground to its own regen,
  // untouched regions are already full. `queue` lists them quickest first.
  function planetWork(p) {
    const regen = (p.regenPerSecond || 0) * 3600;
    const regs = (p.regions || []).filter(r => r && r.isAvailable && (r.health || 0) > 0);
    // While regions are being taken, the planet's own regen keeps eating the capture bonus already
    // dealt (1 HP of planet regen undoes 1/1.5 HP of region work), so it counts against each region too.
    const erosion = regen / 1.5;
    const queue = regs.map(r => ({ name: r.name || null, hp: r.health, max: r.maxHealth || r.health,
      ownRegen: (r.regenPerSecond || 0) * 3600, regen: (r.regenPerSecond || 0) * 3600 + erosion, players: r.players || 0 }))
      .sort((a, b) => a.hp - b.hp || a.regen - b.regen);
    const rh = queue.reduce((a, r) => a + r.hp, 0);
    const rr = queue.reduce((a, r) => a + r.regen, 0);
    const work = rh + Math.max(0, p.health - 1.5 * rh);
    // work at full enemy health: a planet left waiting regenerates back towards this
    const full = rh + Math.max(0, p.maxHealth - 1.5 * rh);
    // regen working against us right now: regions already damaged, or the next one in line
    const hurt = queue.filter(q => q.hp < q.max);
    const activeRegen = queue.length ? (hurt.length ? hurt.reduce((a, q) => a + q.regen, 0) : queue[0].regen) : regen;
    return { work, full, regen, regionHP: rh, regionRegen: rr, activeRegen, queue, hasRegions: queue.length > 0 };
  }

  // Time (h) to finish a planet with gross damage g HP/h: regions one by one, then the planet itself.
  function hoursFor(pw, g) {
    let t = 0;
    for (const q of pw.queue || []) {
      if (q.hp <= 0) continue;
      if (g <= q.regen) return Infinity;
      t += q.hp / (g - q.regen);
    }
    const rest = pw.work - pw.regionHP;
    if (rest > 0) {
      if (g <= pw.regen) return Infinity;
      t += rest / (g - pw.regen);
    }
    return t;
  }

  // Simulate "everyone on one planet at a time, DSS on the target".
  // hod = {hours, mult}: HOD active for the first `hours` hours.
  // Best plan: try every order; a planet waiting its turn regains its regen
  // on any progress already made. Returns {total, order, segs:[{i,start,end}]}.
  function sequentialPlan(works, share, C, dssBonus, hod) {
    let best = { total: Infinity, order: null, segs: [] };
    const g = (m) => dmg(share, C) * (1 + dssBonus) * m;
    for (const ord of permutations(works.map((_, i) => i))) {
      let t = 0, ok = true;
      const segs = [];
      for (const i of ord) {
        const start = t;
        let remaining = { ...works[i] };
        if (remaining.work < remaining.full && t > 0) {
          const back = Math.min(remaining.full - remaining.work, remaining.regen * t);
          remaining.work += back;
        }
        let used = 0, finished = false;
        if (hod && hod.hours > t) {
          const window = hod.hours - t;
          const fullH = hoursFor(remaining, g(hod.mult));
          if (fullH <= window) { t += fullH; finished = true; }
          else { remaining = advance(remaining, g(hod.mult), window); used = window; }
        }
        if (!finished) {
          const tt = hoursFor(remaining, g(1));
          if (!isFinite(tt)) { ok = false; break; }
          t += used + tt;
        }
        segs.push({ i, start, end: t });
      }
      if (ok && t < best.total) best = { total: t, order: ord, segs };
    }
    return best;
  }
  const sequentialHours = (works, share, C, dssBonus, hod) => sequentialPlan(works, share, C, dssBonus, hod).total;

  // Largest set of planets that can be liberated before H with this share.
  function bestSubset(works, share, H, C, dssBonus, hod) {
    const n = works.length;
    let best = { count: 0, idx: [], total: 0 };
    for (let mask = 1; mask < (1 << n); mask++) {
      const idx = [...Array(n).keys()].filter(i => mask & (1 << i));
      if (idx.length < best.count) continue;
      const plan = sequentialPlan(idx.map(i => works[i]), share, C, dssBonus, hod);
      if (plan.total > H) continue;
      if (idx.length > best.count || plan.total < best.total) best = { count: idx.length, idx: plan.order.map(k => idx[k]), total: plan.total };
    }
    return best;
  }

  function advance(pw, g, hours) {
    let h = hours;
    const queue = (pw.queue || []).map(q => ({ ...q }));
    let regionHP = pw.regionHP, work = pw.work;
    for (const q of queue) {
      if (q.hp <= 0) continue;
      const net = g - q.regen;
      if (net <= 0) return { ...pw, queue, regionHP, work };
      const need = q.hp / net;
      if (need >= h) { const done = net * h; q.hp -= done; return { ...pw, queue, regionHP: regionHP - done, work: work - done }; }
      h -= need; regionHP -= q.hp; work -= q.hp; q.hp = 0;
    }
    const net = g - pw.regen;
    if (net > 0) work = Math.max(0, work - net * h);
    return { ...pw, queue, regionHP: Math.max(0, regionHP), work };
  }

  function permutations(a) {
    if (a.length <= 1) return [a];
    if (a.length > 5) return [a];
    return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
  }

  function minShareSequential(works, H, C, dssBonus, hod) {
    if (!works.length) return 0;
    if (sequentialHours(works, 5, C, dssBonus, hod) > H) return Infinity;
    let lo = 0, hi = 5;
    for (let k = 0; k < 50; k++) {
      const m = (lo + hi) / 2;
      if (sequentialHours(works, m, C, dssBonus, hod) > H) lo = m; else hi = m;
    }
    return hi;
  }

  function parallelShare(works, H, C) {
    return works.reduce((a, pw) => a + shareFor(pw.work / H + pw.regen, C), 0);
  }

  // Observed net HP/h on a planet from stored samples (last 90 min, >= 15 min span).
  function observedNet(samples, idx, now) {
    const pts = samples.filter(s => s.planets && s.planets[idx] && now - s.t <= 90 * 60e3)
      .map(s => ({ t: s.t, h: s.planets[idx].h }));
    if (pts.length < 2) return null;
    const a = pts[0], b = pts[pts.length - 1];
    const span = (b.t - a.t) / 3.6e6;
    if (span < 0.25) return null;
    return { net: (a.h - b.h) / span, span };
  }

  // Live calibration of capacity C from samples of planets under liberation.
  // Damage constant K, measured live: the game weighs every player by the war's impact multiplier,
  // so on a planet  gross HP/s = players x impactMultiplier x K  (x DSS / HOD boosts).
  // K is fitted on planets being liberated (no regions, no defense event, not at full health):
  // gross = HP actually lost + regen that had to be beaten.
  function calibrateK(samples, planetsNow, now, dssBonus, hodMult) {
    let G = 0, W = 0, span = 0;
    const per = [];
    for (const [idx, p] of Object.entries(planetsNow)) {
      if (!isEnemy(p) || p.event) continue;
      // planets with open regions are left out: part of the damage goes to the regions, not the planet
      if ((p.regions || []).some(r => r && r.isAvailable && (r.health || 0) > 0)) continue;
      const pts = samples.filter(s => s.imp && s.planets && s.planets[idx] && now - s.t <= 3 * 3600e3);
      let g = 0, w = 0, sp = 0;
      for (let i = 1; i < pts.length; i++) {
        const s0 = pts[i - 1], s1 = pts[i];
        const a = s0.planets[idx], b = s1.planets[idx];
        const dt = (s1.t - s0.t) / 1000;
        if (dt <= 0 || dt > 1800) continue;
        if (Math.max(a.h, b.h) > 0.995 * p.maxHealth || b.h <= 0 || a.p < 300) continue;
        // a drop far beyond what the players there could deal is an intervention, not damage
        if (a.h - b.h > 0.03 * p.maxHealth && a.h - b.h > 5 * a.p * s0.imp * K_TYPICAL * dt) continue;
        const mult = (s0.dss == idx ? 1 + dssBonus : 1) * (s0.dss == idx && s0.hod ? hodMult : 1);
        g += (a.h - b.h) + (p.regenPerSecond || 0) * dt;
        const corr = s0.N ? Math.pow((a.p / s0.N) / SHARE_REF, SHARE_EXP - 1) : 1;
        w += a.p * s0.imp * mult * corr * dt;
        sp += dt;
      }
      if (sp > 0 && w > 0) { G += g; W += w; span += sp; per.push({ idx: Number(idx), K: g / w, hours: sp / 3600 }); }
    }
    if (span < 900 || W <= 0 || G <= 0) return null;
    return { K: G / W, hours: span / 3600, per };
  }

  /* ---------- interventions: things the players can't explain ---------- */
  // Rarely-changing facts per planet, with the time they last changed. The fight on a planet is only
  // compared over a stretch where its owner, defense event, max HP and open regions stayed the same.
  const K_TYPICAL = 0.027;
  const planetFacts = (p) => ({
    m: p.event ? p.event.maxHealth : p.maxHealth, e: p.event ? (p.event.id ?? 1) : 0, o: p.currentOwner,
    g: (p.regions || []).filter(r => r && r.isAvailable && (r.health || 0) > 0).length,
    r: p.event ? 0 : (p.regenPerSecond || 0),
  });
  function trackPlanets(meta, planets, now) {
    const out = { ...(meta || {}) }, changes = [];
    for (const [idx, p] of Object.entries(planets || {})) {
      if (!p) continue;
      const f = planetFacts(p), was = out[idx];
      if (!was) { out[idx] = { m: f.m, e: f.e, o: f.o, g: f.g, since: now, seen: now, r: [[now, f.r]] }; continue; }
      const lastR = was.r[was.r.length - 1][1];
      const same = was.e === f.e && was.o === f.o;
      if (f.e && was.e !== f.e && was.o === f.o) {
        const start = Date.parse(p.event.startTime);
        changes.push({ kind: 'attack', idx: Number(idx), t: isFinite(start) ? start : now, end: Date.parse(p.event.endTime) || null, faction: p.event.faction || null });
      }
      // resistance (regen) is set by hand: a change of more than a fifth is worth telling
      if (same && was.g === f.g && Math.abs(f.r - lastR) > Math.max(0.2 * Math.abs(lastR), 0.2) && f.m > 0) {
        changes.push({ kind: 'regen', idx: Number(idx), t: now, after: was.seen, from: lastR * 3600 / f.m, to: f.r * 3600 / f.m });
      }
      const rs = f.r !== lastR ? [...was.r, [now, f.r]].slice(-6) : was.r;
      const moved = was.m !== f.m || was.e !== f.e || was.o !== f.o || was.g !== f.g;
      out[idx] = { m: f.m, e: f.e, o: f.o, g: f.g, since: moved ? now : was.since, seen: now, r: rs };
    }
    for (const [idx, v] of Object.entries(out)) if (now - v.seen > 7 * 24 * 3.6e6) delete out[idx];
    return { meta: out, changes };
  }
  const regenAt = (rs, t) => { let v = rs[0][1]; for (const [ti, ri] of rs) if (ti <= t) v = ri; return v; };

  // Compares what happened to a planet over a stretch of 20-90 minutes with what its Helldivers could do.
  // A gap larger than 8% of the planet's HP (13 of 17,000 hour-long stretches of the 2026 war archive)
  // is reported as a jump forward or a setback. pts: [{t, h, p, r (HP/s), N, imp, dss, hod}], oldest first.
  function judgeStretch(pts, idx, m, attack, opts = {}) {
    const { K = K_TYPICAL, hodMult = 1, C: Cfb, maxGap = 10 / 60 } = opts;
    if (pts.length < 2 || !m) return null;
    const span = pts[pts.length - 1].t - pts[0].t;
    if (span < 20 * 60e3) return null;
    let exp = 0, bigStep = -1, at = pts[pts.length - 1].t;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dt = (b.t - a.t) / 3.6e6;
      if (dt > maxGap) return null;   // a hole in the record
      const C = a.imp && a.N ? K * a.imp * a.N * 3600 : Cfb;
      const mult = a.dss == idx && a.hod ? hodMult : 1;
      const gross = a.N && C ? dmg(a.p / a.N, C) * mult : 0;
      exp += (gross - (a.r || 0) * 3600) * dt;
      const step = Math.abs(a.h - b.h);
      if (step > bigStep) { bigStep = step; at = b.t; }
    }
    const obs = pts[0].h - pts[pts.length - 1].h, players = pts[pts.length - 1].p;
    const base = { idx: Number(idx), t: at, mins: span / 60e3, pct: Math.abs(obs) / m, players, attack: !!attack };
    // evidence the game itself keeps: how many missions were won on the planet meanwhile, and what
    // they are worth (inf = HP per won mission per unit of impact multiplier, measured by the recorder)
    const w0 = pts[0].w, w1 = pts[pts.length - 1].w;
    if (w0 != null && w1 != null && w1 >= w0) {
      const impAvg = pts.reduce((a, x) => a + (x.imp || 0), 0) / pts.length;
      base.won = w1 - w0;
      if (impAvg) base.worth = base.won * impAvg * (opts.inf || 100) / m;
    }
    if (obs - exp > 0.08 * m && obs > 3 * Math.max(exp, 0.01 * m)) return { kind: 'jump', ...base };
    // from nearly taken to full health is a planet changing hands and starting over, not a setback
    const reset = pts[0].h < 0.02 * m && pts[pts.length - 1].h > 0.98 * m;
    if (!reset && exp - obs > 0.08 * m && obs < -0.03 * m) return { kind: 'setback', ...base };
    return null;
  }
  // live check over this browser's own samples
  function detectJumps(samples, meta, ctx) {
    const { now } = ctx;
    const found = [];
    for (const [idx, mt] of Object.entries(meta || {})) {
      if (!mt.m || now - mt.seen > 5 * 60e3) continue;
      const from = Math.max(mt.since, now - 90 * 60e3);
      const pts = samples.filter(s => s.t >= from && s.planets && s.planets[idx])
        .map(s => ({ t: s.t, h: s.planets[idx].h, p: s.planets[idx].p, w: s.planets[idx].w, r: regenAt(mt.r, s.t), N: s.N, imp: s.imp, dss: s.dss, hod: s.hod }));
      const hit = judgeStretch(pts, idx, mt.m, mt.e, ctx);
      if (hit) found.push(hit);
    }
    return found;
  }
  // Whole recorded history (the site's recorder, every ~10 minutes): the same checks for every planet
  // at every point in time. Record: [{t, N, imp, dss, hod, pl: {idx: [h, p, regen/s, maxHP, eventId, openRegions, owner, eventEnd]}}]
  function scanHistory(record, ctx = {}) {
    const out = [];
    const add = (a) => {
      const same = out.find(x => x.kind === a.kind && x.idx === a.idx && Math.abs(x.t - a.t) < 3 * 3.6e6);
      if (!same) out.push(a); else if ((a.pct || 0) > (same.pct || 0)) Object.assign(same, a);
    };
    const opts = { maxGap: 35 / 60, ...ctx };
    const idxs = new Set(); for (const s of record) for (const k of Object.keys(s.pl || {})) idxs.add(k);
    for (const idx of idxs) {
      let f = null, seg = [], lastT = 0;
      for (const s of record) {
        const v = s.pl && s.pl[idx];
        if (!v) { f = null; seg = []; continue; }
        const [h, p, r, m, e, g, o, end, w] = v;
        if (f && s.t - lastT <= 3 * 3.6e6) {
          if (e && f.e !== e && f.o === o) add({ kind: 'attack', idx: Number(idx), t: s.t, end: end || null, faction: ctx.factionOf ? ctx.factionOf(idx, s) : null });
          if (f.e === e && f.o === o && f.g === g && m > 0 && Math.abs(r - f.r) > Math.max(0.2 * Math.abs(f.r), 0.2))
            add({ kind: 'regen', idx: Number(idx), t: s.t, after: lastT, from: f.r * 3600 / m, to: r * 3600 / m });
        }
        if (!f || f.m !== m || f.e !== e || f.o !== o || f.g !== g || s.t - lastT > opts.maxGap * 3.6e6) seg = [];
        f = { m, e, o, g, r }; lastT = s.t;
        seg.push({ t: s.t, h, p, w, r: e ? 0 : r, N: s.N, imp: s.imp, dss: s.dss, hod: s.hod });
        while (seg.length && s.t - seg[0].t > 90 * 60e3) seg.shift();
        const hit = judgeStretch(seg, idx, m, e, opts);
        if (hit) add(hit);
      }
    }
    return out.sort((a, b) => a.t - b.t);
  }

  // What changed between two versions of an order's task list (Super Earth edits orders in place).
  function taskDiff(before, after) {
    const out = [];
    const n = Math.max(before.length, after.length);
    for (let i = 0; i < n; i++) {
      const a = before[i], b = after[i];
      if (!a) { out.push({ i: i + 1, kind: 'added' }); continue; }
      if (!b) { out.push({ i: i + 1, kind: 'removed' }); continue; }
      if (JSON.stringify([a.type, a.values, a.valueTypes]) === JSON.stringify([b.type, b.values, b.valueTypes])) continue;
      const pa = parseTask(a, 0), pb = parseTask(b, 0);
      const sameRest = JSON.stringify({ ...pa.raw, 3: 0 }) === JSON.stringify({ ...pb.raw, 3: 0 }) && a.type === b.type;
      if (sameRest && pa.goal !== pb.goal) out.push({ i: i + 1, kind: 'goal', from: pa.goal, to: pb.goal });
      else out.push({ i: i + 1, kind: 'changed' });
    }
    return out;
  }

  function calibrate(samples, planetsNow, now, dssBonus, hodMult) {
    let G = 0, W = 0, span = 0;
    for (const [idx, p] of Object.entries(planetsNow)) {
      if (!isEnemy(p) || p.event) continue;
      const pts = samples.filter(s => s.planets && s.planets[idx] && now - s.t <= 3 * 3600e3);
      for (let i = 1; i < pts.length; i++) {
        const s0 = pts[i - 1], s1 = pts[i];
        const a = s0.planets[idx], b = s1.planets[idx];
        const dt = (s1.t - s0.t) / 3.6e6;
        if (dt <= 0 || dt > 0.5 || !s0.N) continue;
        if (Math.max(a.h, b.h) > 0.98 * p.maxHealth || b.h <= 0) continue;
        const share = a.p / s0.N;
        if (share < 0.03) continue;
        const mult = (s0.dss == idx ? 1 + dssBonus : 1) * (s0.dss == idx && s0.hod ? hodMult : 1);
        G += (a.h - b.h) + (p.regenPerSecond || 0) * 3600 * dt;
        W += share * mult * dt;
        span += dt;
      }
    }
    if (span < 0.5 || W <= 0) return null;
    return { capacity: G / W, hours: span };
  }

  // Counter projection: rate since MO start and recent rate from samples.
  function counterRates(samples, assignmentId, taskIdx, progress, startMs, now) {
    const out = { sinceStart: null, recent: null, recentSpan: 0 };
    if (startMs && now > startMs) {
      const h = (now - startMs) / 3.6e6;
      if (h > 0.25) out.sinceStart = { rate: progress / h, hours: h };
    }
    const pts = samples.filter(s => s.prog && s.prog[assignmentId] && now - s.t <= 3 * 3600e3)
      .map(s => ({ t: s.t, v: Number(s.prog[assignmentId][taskIdx]) }));
    if (pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      const span = (b.t - a.t) / 3.6e6;
      if (span >= 0.2) { out.recent = { rate: (b.v - a.v) / span, hours: span }; out.recentSpan = span; }
    }
    return out;
  }

  /* Verdict codes, from best to worst: done, ontrack, effort/focus, hard/record, nearly_impossible, impossible (unknown = not enough data) */
  const RANK = { done: 0, ontrack: 1, effort: 2, focus: 2, hard: 3, record: 3, nearly_impossible: 4, impossible: 5, failed: 6, unknown: 1.5 };

  function analyzeAssignment(a, ctx) {
    const { planets, N, now, C, dssIdx, hod, settings, samples, startMs } = ctx;
    const hLeft = (new Date(a.expiration).getTime() - now) / 3.6e6;
    const H = isFinite(hLeft) ? Math.max(0, hLeft) : 0;
    const tasks = (a.tasks || []).map((t, i) => parseTask(t, (a.progress || [])[i]));
    const res = { id: a.id, hoursLeft: H, tasks: [], liberation: null };
    const libTargets = [];

    tasks.forEach((t, i) => {
      const r = { idx: i, task: t, verdict: 'unknown' };
      const p = t.planetIndex != null ? planets[t.planetIndex] : null;
      r.planet = p || null;
      if (t.type === TASK.LIBERATE && p) {
        if (!isEnemy(p) || t.progress >= 1) { r.verdict = 'done'; }
        else {
          const pw = planetWork(p);
          const share = N ? (p.statistics?.playerCount || 0) / N : 0;
          const onDss = dssIdx === p.index;
          const mult = (onDss ? 1 + settings.dssBonus : 1) * (onDss && hod ? settings.hodMult : 1);
          const obs = observedNet(samples, p.index, now);
          const modelNet = dmg(share, C) * mult - pw.activeRegen;
          const net = obs ? obs.net : modelNet;
          const eta = net > 0 ? pw.work / net : Infinity;
          Object.assign(r, {
            pw, share, onDss, mult, observed: obs, modelNet, net, eta,
            breakEven: shareFor(pw.regen / (1 + settings.dssBonus), C),
            aloneShare: shareFor((pw.work / Math.max(H, 0.01) + pw.regen) / (1 + settings.dssBonus), C),
          });
          libTargets.push(r);
        }
      } else if (t.type === TASK.HOLD && p) {
        if (isEnemy(p)) {
          // must be liberated before the end: same math as a liberation
          const pw = planetWork(p);
          const share = N ? (p.statistics?.playerCount || 0) / N : 0;
          const obs = observedNet(samples, p.index, now);
          const onDss = dssIdx === p.index;
          const mult = (onDss ? 1 + settings.dssBonus : 1) * (onDss && hod ? settings.hodMult : 1);
          const modelNet = dmg(share, C) * mult - pw.activeRegen;
          const net = obs ? obs.net : modelNet;
          Object.assign(r, { pw, share, onDss, mult, observed: obs, modelNet, net, eta: net > 0 ? pw.work / net : Infinity, holdLost: true,
            breakEven: shareFor(pw.regen / (1 + settings.dssBonus), C),
            aloneShare: shareFor((pw.work / Math.max(H, 0.01) + pw.regen) / (1 + settings.dssBonus), C) });
          libTargets.push(r);
        } else if (p.event) {
          r.defense = defenseInfo(p, ctx, H);
          r.verdict = r.defense.verdict;
        } else { r.verdict = 'done'; r.safe = true; }
      } else if (COUNTER_TYPES.has(t.type) && t.goal) {
        // progress samples are stored per assignment *and* task list, so an edited order starts a fresh history
        const rates = counterRates(samples, ctx.progKey ?? a.id, i, t.progress, startMs, now);
        const remaining = Math.max(0, t.goal - t.progress);
        const needed = H > 0 ? remaining / H : Infinity;
        const primary = rates.sinceStart && rates.sinceStart.hours >= 12 ? rates.sinceStart
          : (rates.recent && rates.recent.hours >= 0.25 ? rates.recent : rates.sinceStart);
        const projection = primary ? t.progress + primary.rate * H : null;
        let verdict = 'unknown';
        if (remaining <= 0) verdict = 'done';
        else if (primary && primary.rate > 0) {
          const ratio = needed / primary.rate;
          verdict = ratio <= 1 ? 'ontrack' : ratio <= 1.25 ? 'effort' : ratio <= 2 ? 'hard' : ratio <= 4 ? 'nearly_impossible' : 'impossible';
        }
        Object.assign(r, { counter: true, rates, remaining, needed, primary, projection, verdict });
      } else if (t.type === TASK.DEFEND_COUNT || t.type === TASK.LIBERATE_COUNT) {
        r.counter = true; r.simpleCount = true;
        r.verdict = t.goal && t.progress >= t.goal ? 'done' : 'unknown';
        if (t.type === TASK.DEFEND_COUNT) {
          r.defenses = Object.values(planets).filter(p => p.event && p.currentOwner === 'Humans'
            && (!t.faction || p.event.faction === t.faction)).map(p => ({ planet: p, ...defenseInfo(p, ctx, H) }));
        } else if (r.verdict !== 'done') {
          r.libN = libNInfo(t, ctx, H);
          r.verdict = r.libN.verdict;
        }
      }
      res.tasks.push(r);
    });

    // Group verdict for liberation targets
    if (libTargets.length) {
      const works = libTargets.map(r => r.pw);
      const hodHours = hod ? Math.max(0, Math.min(H, (hod.expire - now) / 3.6e6)) : 0;
      const hodArg = hodHours > 0 ? { hours: hodHours, mult: settings.hodMult } : null;
      const seqNeed = minShareSequential(works, H, C, settings.dssBonus, hodArg);
      const parNeed = parallelShare(works, H, C);
      const currentShare = libTargets.reduce((a, r) => a + r.share, 0);
      const allOnTrack = libTargets.every(r => r.eta <= H);
      const seqAtCurrent = sequentialHours(works, currentShare, C, settings.dssBonus, hodArg);
      let verdict;
      if (allOnTrack) verdict = 'ontrack';
      else if (seqNeed <= currentShare) verdict = 'focus';
      else if (seqNeed <= 0.6) verdict = 'effort';
      else if (seqNeed <= settings.recordShare) verdict = 'record';
      else if (seqNeed <= 1) verdict = 'nearly_impossible';
      else verdict = 'impossible';
      libTargets.forEach(r => { r.verdict = r.eta <= H ? 'ontrack' : verdict; });
      // The plan shown to the community: at the current share if that is enough,
      // otherwise at the share that would be needed.
      const winnableNow = seqNeed <= currentShare;
      const planShare = winnableNow ? currentShare : (isFinite(seqNeed) ? seqNeed : currentShare);
      const plan = sequentialPlan(works, planShare, C, settings.dssBonus, hodArg);
      plan.segs = plan.segs.map(s => ({ ...s, target: libTargets[s.i] }));
      const partial = winnableNow ? null : bestSubset(works, currentShare, H, C, settings.dssBonus, hodArg);
      if (partial) {
        partial.targets = partial.idx.map(i => libTargets[i]);
        if (partial.count) {
          const pp = sequentialPlan(partial.idx.map(i => works[i]), currentShare, C, settings.dssBonus, hodArg);
          pp.segs = pp.segs.map(s => ({ ...s, target: partial.targets[s.i] }));
          partial.plan = pp;
        }
      }
      res.liberation = { seqNeed, parNeed, currentShare, seqAtCurrent, verdict, count: libTargets.length, hodHours,
        plan, planShare, winnableNow, partial, targets: libTargets };
    }

    const hodH = hod ? Math.max(0, Math.min(H, (hod.expire - now) / 3.6e6)) : 0;
    res.model = { C, H, N, dssBonus: settings.dssBonus, hod: hodH > 0 ? { hours: hodH, mult: settings.hodMult } : null, recordShare: settings.recordShare };
    // Deadline passed but the API still lists the order: whatever isn't done has failed, nothing left to plan.
    if (H <= 0 && res.tasks.length) {
      res.ended = true;
      res.tasks.forEach(r => { if (r.verdict !== 'done') r.verdict = 'failed'; });
    }
    const worst = res.tasks.reduce((w, r) => (RANK[r.verdict] ?? 1) > (RANK[w] ?? 0) ? r.verdict : w, 'done');
    res.verdict = res.tasks.length ? worst : 'unknown';
    if (res.ended) {
      const won = res.verdict === 'done';
      res.recs = won ? [{ kind: 'allDone', prio: 0 }] : [];
      res.directive = won ? { kind: 'done', verdict: 'done' } : { kind: 'ended', verdict: 'failed' };
      return res;
    }
    res.recs = recommend(res, ctx);
    res.directive = directive(res);
    return res;
  }

  /* ---------- The ONE thing the community should do right now ----------
     Picks the most urgent action that can still change the outcome. */
  function directive(res) {
    const recs = res.recs || [];
    if (res.tasks.length && res.tasks.every(r => r.verdict === 'done')) return { kind: 'done', verdict: 'done' };
    const cands = [];
    const sev = (v) => RANK[v] ?? 1;
    for (const r of recs.filter(x => x.kind === 'defSend')) {
      cands.push({ kind: 'defend', planet: r.planet, need: r.players, now: r.nowPlayers, hours: r.hours,
        // a defense that ends soon outranks slower objectives: if it falls, the order is lost
        verdict: r.verdict, score: sev(r.verdict) + (r.hours < 12 ? 1.5 : r.hours < 24 ? 0.8 : 0.2), tie: 5 });
    }
    const focus = recs.find(x => x.kind === 'libFocus');
    if (focus && res.liberation) {
      const v = res.liberation.verdict;
      const reg = recs.find(x => x.kind === 'libRegion' && x.planet === focus.planet);
      cands.push({ kind: 'liberate', variant: focus.variant, planet: focus.planet, need: focus.players, now: focus.nowPlayers,
        hours: focus.hours, remaining: focus.remaining, region: reg ? reg.region : null, verdict: v, score: sev(v) + (focus.variant === 'partial' ? 0.3 : 0), tie: 4,
        wasted: recs.filter(x => x.kind === 'libWasted').reduce((a, x) => a + x.players, 0) });
    } else if (res.liberation && res.liberation.verdict === 'impossible') {
      // nothing on this order can fall in time, not even one planet
      cands.push({ kind: 'lost', verdict: 'impossible', score: 0, tie: 0 });
    }
    for (const r of recs.filter(x => x.kind === 'libNFocus')) {
      cands.push({ kind: 'liberate', variant: 'n', planet: r.planet, need: r.players, now: r.nowPlayers, left: r.left,
        verdict: r.verdict, score: sev(r.verdict), tie: 4 });
    }
    // counters: the one furthest behind (a pace still being measured is not "behind")
    const behind = res.tasks.filter(r => r.counter && !r.simpleCount && !['done', 'ontrack', 'unknown'].includes(r.verdict));
    if (behind.length) {
      const ratio = (r) => r.primary && r.primary.rate > 0 ? r.needed / r.primary.rate : 99;
      const worst = [...behind].sort((a, b) => sev(b.verdict) - sev(a.verdict) || ratio(b) - ratio(a))[0];
      const tk = worst.task;
      const move = recs.find(x => x.kind === 'cntMove' && x.to === tk.faction);
      const short = recs.find(x => x.kind === 'cntShort' && x.to === tk.faction);
      const proj = worst.projection != null && tk.goal ? worst.projection / tk.goal : null;
      const base = { task: worst, verdict: worst.verdict, score: sev(worst.verdict), proj };
      if (move || short) {
        const now = res.fronts?.players?.[tk.faction] || 0;
        cands.push({ ...base, kind: 'front', faction: tk.faction, from: move ? move.from : [], aheadFrom: move ? move.aheadFrom : [], idleFrom: move ? move.idleFrom : [], move: move ? move.players : 0,
          short: short ? short.players : 0, now, need: now + (move ? move.players : 0) + (short ? short.players : 0), tie: 3 });
      } else if (tk.itemId && tk.type === TASK.KILL) {
        cands.push({ ...base, kind: 'weapon', item: tk.itemId, faction: tk.faction, tie: 2 });
      } else {
        cands.push({ ...base, kind: 'counter', faction: tk.faction, tie: 1 });
      }
    }
    if (!cands.length) {
      const open = res.tasks.filter(r => r.verdict !== 'done');
      if (open.length && open.every(r => r.verdict === 'ontrack')) return { kind: 'steady', verdict: res.verdict };
      const wait = recs.find(x => x.kind === 'defWait');
      if (wait) return { kind: 'waitDefense', left: wait.left, faction: wait.faction, verdict: 'unknown' };
      // pace not measured yet: point at the objective furthest from its goal
      const unk = res.tasks.filter(r => r.counter && !r.simpleCount && r.verdict === 'unknown');
      if (unk.length) {
        const frac = (r) => r.task.goal ? r.task.progress / r.task.goal : 1;
        const w = [...unk].sort((a, b) => frac(a) - frac(b))[0];
        return { kind: w.task.itemId && w.task.type === TASK.KILL ? 'weapon' : 'counter', item: w.task.itemId, task: w, faction: w.task.faction, measuring: true, verdict: 'unknown', proj: null };
      }
      return { kind: 'play', verdict: res.verdict };
    }
    const savable = cands.filter(c => c.verdict !== 'impossible');
    const pool = savable.length ? savable : cands;
    pool.sort((a, b) => b.score - a.score || b.tie - a.tie);
    return pool[0];
  }

  /* ---------- "What if?" for liberation orders ----------
     Outcome if `share` of all online players were on the order's planets, perfectly focused. */
  function simulate(res, share) {
    const lib = res.liberation, m = res.model;
    if (!lib || !m) return null;
    const works = lib.targets.map(r => r.pw);
    const plan = sequentialPlan(works, share, m.C, m.dssBonus, m.hod);
    const sub = bestSubset(works, share, m.H, m.C, m.dssBonus, m.hod);
    return {
      share, wins: plan.total <= m.H, total: plan.total, count: sub.count, n: works.length,
      segs: (plan.order ? plan.segs : []).map(s => ({ planet: lib.targets[s.i].planet, start: s.start, end: s.end })),
      taken: (sub.idx || []).map(i => lib.targets[i].planet),
    };
  }

  /* ---------- Action plan: best community moves right now ----------
     Each rec = {kind, prio, ...params}. Lower prio = do it first. */
  function recommend(res, ctx) {
    const { planets, N, dssIdx, hod, settings, C } = ctx;
    const recs = [];
    const players = (share) => Math.round((share * N) / 100) * 100;
    const H = res.hoursLeft;

    if (res.tasks.length && res.tasks.every(r => r.verdict === 'done')) {
      recs.push({ kind: 'allDone', prio: 0 });
      return recs;
    }

    // --- Liberation / retake targets ---
    const lib = res.liberation;
    if (lib) {
      const hasPlan = !!(lib.plan && lib.plan.order);
      // Winnable (now or with more players): follow the full plan. Not winnable even with
      // everyone: focus on the first planet of the best partial plan with the players we have.
      const fullPossible = lib.winnableNow || lib.seqNeed <= 1;
      const hasPartial = !!(lib.partial && lib.partial.count);
      if (!lib.winnableNow && lib.seqNeed > 1) {
        recs.push({ kind: 'libImpossible', prio: 0, need: lib.seqNeed, none: !hasPartial });
      }
      if (!lib.winnableNow && hasPartial && lib.partial.count < lib.count) {
        recs.push({ kind: 'libPartial', prio: 1, share: lib.currentShare, k: lib.partial.count, n: lib.count,
          planets: lib.partial.targets.map(r => r.planet), need: lib.seqNeed });
      }
      let focus = null, first = null;
      if (fullPossible && hasPlan) { first = lib.plan.segs[0]; focus = first.target; }
      else if (hasPartial) { focus = lib.partial.targets[0]; first = lib.partial.plan && lib.partial.plan.segs[0]; }
      if (focus) {
        const focusShare = lib.winnableNow || !fullPossible ? lib.currentShare : lib.seqNeed;
        const variant = lib.winnableNow ? 'win' : fullPossible ? 'more' : 'partial';
        const planSegs = fullPossible ? lib.plan.segs : (lib.partial.plan ? lib.partial.plan.segs : []);
        recs.push({ kind: 'libFocus', prio: 2, variant, planet: focus.planet, share: focusShare, players: players(focusShare),
          hours: first ? first.end - first.start : null, now: focus.share, nowPlayers: focus.planet.statistics?.playerCount || 0,
          remaining: planSegs.length });
        if (planSegs.length > 1) {
          recs.push({ kind: 'libOrder', prio: 3, partial: !fullPossible, segs: planSegs.map(s => ({ planet: s.target.planet, start: s.start, end: s.end })), H });
        }
        if (dssIdx !== focus.planet.index && settings.dssBonus > 0) {
          recs.push({ kind: 'libDss', prio: 4, planet: focus.planet, from: dssIdx != null ? planets[dssIdx] : null });
        }
        const reg = regionAdvice(focus, dmg(focusShare, C) * (1 + settings.dssBonus));
        if (reg) recs.push({ kind: 'libRegion', prio: 2.6, planet: focus.planet, ...reg });
        // Wasted effort: players on targets other than the focus that can't beat regen
        for (const r of lib.targets) {
          if (r === focus) continue;
          const p = r.planet.statistics?.playerCount || 0;
          if (p >= 500 && r.net <= 0) {
            recs.push({ kind: 'libWasted', prio: 2.5, planet: r.planet, players: p, regen: r.pw.regen, target: focus.planet });
          }
        }
        // Partially liberated planets that would lose progress if left waiting
        for (const r of lib.targets) {
          if (r === focus) continue;
          const done = 1 - r.pw.work / r.pw.full;
          if (done > 0.1) recs.push({ kind: 'libDecay', prio: 3.5, planet: r.planet, done, regen: r.pw.regen });
        }
      }
      // HOD: best where the regen is hardest to beat
      const hardest = [...lib.targets].sort((a, b) => b.breakEven - a.breakEven)[0];
      if (!hod && hardest && (focus || fullPossible)) {
        recs.push({ kind: 'libHod', prio: 5, planet: hardest.planet, breakEven: hardest.breakEven });
      }
    }

    // --- Defenses tied to the order ---
    for (const r of res.tasks) {
      if (r.defense) {
        if (r.defense.outlastsMO) recs.push({ kind: 'defSkip', prio: 6, planet: r.planet });
        else if (r.defense.verdict !== 'ontrack') recs.push({ kind: 'defSend', prio: 1.5, planet: r.planet, players: players(r.defense.need), hours: r.defense.hoursToEnd, nowPlayers: r.planet.statistics?.playerCount || 0, verdict: r.defense.verdict });
      }
      if (r.defenses) for (const d of r.defenses) {
        if (d.verdict !== 'ontrack' && d.verdict !== 'done') recs.push({ kind: 'defSend', prio: 1.6, planet: d.planet, players: players(d.need), hours: d.hoursToEnd, nowPlayers: d.planet.statistics?.playerCount || 0, verdict: d.verdict });
      }
      // "Defend N attacks" with no attack running: nothing to do but be ready
      if (r.task.type === TASK.DEFEND_COUNT && r.verdict !== 'done' && !(r.defenses || []).length) {
        recs.push({ kind: 'defWait', prio: 6, task: r, left: Math.max(0, (r.task.goal || 0) - r.task.progress), faction: r.task.faction });
      }
    }

    // --- "Liberate N planets": the quickest planets to take ---
    for (const r of res.tasks) {
      const L = r.libN;
      if (!L || r.verdict === 'done' || !L.first) continue;
      if (L.verdict === 'ontrack') { recs.push({ kind: 'libNOk', prio: 7, task: r, left: L.left }); continue; }
      const need = isFinite(L.seqNeed) ? Math.min(1, L.seqNeed) : null;
      recs.push({ kind: 'libNFocus', prio: 2, task: r, planet: L.first.planet, left: L.left, list: L.pick.map(x => x.planet),
        share: need, players: need != null ? players(need) : null, nowPlayers: L.first.planet.statistics?.playerCount || 0, verdict: L.verdict });
    }

    // --- Counters (kills, samples, operations) ---
    const counters = res.tasks.filter(r => r.counter && !r.simpleCount && r.verdict !== 'done');
    if (counters.length) {
      // players per front, from every contested planet
      const fronts = { Terminids: 0, Automaton: 0, Illuminate: 0 };
      for (const p of Object.values(planets)) {
        const f = p.event ? p.event.faction : (isEnemy(p) ? p.currentOwner : null);
        if (f && f in fronts) fronts[f] += p.statistics?.playerCount || 0;
      }
      const byFront = {}, weaponFront = {};
      for (const r of counters) {
        // the same pace as the projection (average since the start once there are 12 h of it):
        // a last-hour rate measured over a few minutes swings wildly
        const rate = r.primary?.rate;
        const tk = r.task;
        const front = tk.planetIndex == null ? tk.faction : null;
        if (r.verdict === 'ontrack') {
          recs.push({ kind: 'cntOk', prio: 7, task: r });
        } else if (rate > 0) {
          recs.push({ kind: 'cntBehind', prio: 2, task: r, more: r.needed / rate - 1, needed: r.needed, rate });
        } else {
          recs.push({ kind: 'cntStart', prio: 2, task: r, needed: r.needed });
        }
        if (tk.itemId && tk.type === TASK.KILL && r.verdict !== 'ontrack') recs.push({ kind: 'cntWeapon', prio: 2.2, task: r });
        // players needed = players there now x (pace needed / pace now). For weapon-only kills this
        // assumes the same share of players keeps using the weapon ("at today's weapon use").
        if (front && front in fronts && fronts[front] > 0 && rate > 0) {
          const perPlayer = rate / fronts[front];
          const needPlayers = r.needed / perPlayer;
          if (needPlayers > (byFront[front] || 0)) { byFront[front] = needPlayers; weaponFront[front] = !!tk.itemId; }
        }
      }
      // Fronts that are ahead can give players to fronts that are behind
      // players already busy with this order's planets (defenses, holds, liberations) are never moved
      const busy = { Terminids: 0, Automaton: 0, Illuminate: 0 };
      const taskPlanets = new Set();
      for (const r of res.tasks) {
        if (r.planet && !r.counter) taskPlanets.add(r.planet.index);
        for (const d of r.defenses || []) taskPlanets.add(d.planet.index);
      }
      for (const i of taskPlanets) {
        const p = planets[i]; if (!p) continue;
        const f = p.event ? p.event.faction : (isEnemy(p) ? p.currentOwner : null);
        if (f && f in busy) busy[f] += p.statistics?.playerCount || 0;
      }
      const surplus = [], deficit = [];
      for (const [f, need] of Object.entries(byFront)) {
        const d = need - fronts[f];
        if (d > 0) deficit.push({ f, n: d }); else surplus.push({ f, n: Math.min(-d, fronts[f] - busy[f]) });
      }
      // fronts with no task in this order are free capacity
      for (const f of Object.keys(fronts)) if (!(f in byFront) && fronts[f] - busy[f] > 0 && Object.keys(byFront).length) surplus.push({ f, n: fronts[f] - busy[f], idle: true });
      res.fronts = { players: { ...fronts }, need: { ...byFront }, busy };
      deficit.sort((a, b) => b.n - a.n); surplus.sort((a, b) => b.n - a.n);
      for (const d of deficit) {
        let need = d.n;
        for (const s of surplus) {
          if (need <= 0 || s.n <= 0) continue;
          const move = Math.min(need, s.n);
          if (move >= 300) {
            const ex = recs.find(x => x.kind === 'cntMove' && x.to === d.f);
            // aheadFrom: fronts whose own objective is already on track; idleFrom: fronts with no objective in this order
            if (ex) { ex.from.push(s.f); (s.idle ? ex.idleFrom : ex.aheadFrom).push(s.f); ex.players += Math.round(move / 100) * 100; ex.idle = ex.idle && !!s.idle; }
            else recs.push({ kind: 'cntMove', prio: 1.8, from: [s.f], aheadFrom: s.idle ? [] : [s.f], idleFrom: s.idle ? [s.f] : [], to: d.f, players: Math.round(move / 100) * 100, idle: !!s.idle, weaponUse: !!weaponFront[d.f] });
          }
          s.n -= move; need -= move;
        }
        if (need >= 300) recs.push({ kind: 'cntShort', prio: 1.9, to: d.f, players: Math.round(need / 100) * 100, weaponUse: !!weaponFront[d.f] });
      }
    }

    return rankMoves(recs.sort((a, b) => a.prio - b.prio), res, ctx);
  }

  /* ---------- How much each move matters ----------
     Merges moves that say the same thing, attaches a level (critical / high / helps / tip) and a
     concrete effect so the plan can say *why* each step is worth doing. */
  const LEVEL = { critical: 0, high: 1, helps: 2, tip: 3 };
  function rankMoves(recs, res, ctx) {
    const { N, C, settings } = ctx;
    const H = res.hoursLeft;
    const lib = res.liberation;
    const targetOf = (planet) => lib ? lib.targets.find(r => r.planet === planet) : null;
    const focusRec = recs.find(x => x.kind === 'libFocus');
    const focusT = focusRec ? targetOf(focusRec.planet) : null;
    const etaWith = (t, extraShare) => {
      if (!t) return null;
      const net = t.net + (dmg(t.share + extraShare, C) - dmg(t.share, C)) * t.mult;
      return net > 0 ? t.pw.work / net : Infinity;
    };
    const out = [];
    // one "leave these planets" move instead of one per planet
    const wasted = recs.filter(x => x.kind === 'libWasted');
    if (wasted.length) {
      const players = wasted.reduce((a, x) => a + x.players, 0);
      out.push({ kind: 'libWasted', prio: 2.5, planets: wasted.map(x => x.planet), players, target: wasted[0].target, level: 'high',
        effect: focusT ? { kind: 'eta', now: focusT.eta, next: etaWith(focusT, N ? players / N : 0), planet: focusT.planet } : null });
    }
    for (const r of recs) {
      if (r.kind === 'libWasted') continue;
      const m = { ...r };
      switch (r.kind) {
        case 'libFocus': {
          const t = targetOf(r.planet);
          m.level = r.variant === 'partial' ? 'high' : 'critical';
          m.effect = t && r.hours != null ? { kind: 'eta', now: t.eta, next: r.hours, planet: r.planet } : null;
          break;
        }
        case 'libDecay': m.level = 'high'; m.effect = { kind: 'decay', perHour: r.regen / (r.planet.maxHealth || 1) }; break;
        case 'libDss': {
          const t = focusT, share = focusRec ? focusRec.share : 0;
          const a = t ? hoursFor(t.pw, dmg(share, C)) : Infinity, b = t ? hoursFor(t.pw, dmg(share, C) * (1 + settings.dssBonus)) : Infinity;
          m.level = 'helps'; m.effect = isFinite(a) && isFinite(b) && a - b > 0.25 ? { kind: 'saves', hours: a - b, planet: r.planet } : null;
          break;
        }
        case 'libRegion': m.level = 'helps'; m.effect = r.knock != null ? { kind: 'region', knock: r.knock } : null; break;
        case 'libHod': m.level = 'tip'; break;
        case 'defSend': m.level = r.hours < 24 || (RANK[r.verdict] ?? 0) >= 3 ? 'critical' : 'high';
          m.effect = { kind: 'gap', more: Math.max(0, r.players - r.nowPlayers), hours: r.hours }; break;
        case 'defWait': m.level = 'tip'; break;
        case 'libNFocus': m.level = r.verdict === 'impossible' ? 'high' : 'critical';
          m.effect = r.players != null ? { kind: 'gap', more: Math.max(0, r.players - r.nowPlayers) } : null; break;
        case 'cntMove': {
          const task = res.tasks.find(x => x.counter && !x.simpleCount && x.task.faction === r.to && x.verdict !== 'done' && x.verdict !== 'ontrack');
          const frontNow = res.fronts?.players?.[r.to] || 0;
          m.level = task && (RANK[task.verdict] ?? 0) >= 3 ? 'critical' : 'high';
          m.task = task || null;
          if (task && task.primary && frontNow && task.task.goal) {
            const rate = task.primary.rate, boosted = rate * (1 + r.players / frontNow);
            m.effect = { kind: 'proj', now: task.projection / task.task.goal, next: (task.task.progress + boosted * H) / task.task.goal };
          }
          break;
        }
        case 'cntShort': {
          // same front as a "move over" step: one step that says both things, not two that repeat
          const host = out.find(x => x.kind === 'cntMove' && x.to === r.to);
          if (host) { host.short = r.players; host.shortWeaponUse = r.weaponUse; continue; }
          m.level = 'high'; m.effect = { kind: 'gap', more: r.players, weaponUse: r.weaponUse }; break;
        }
        case 'cntBehind': {
          // already covered by a "move to the X front" step for the same faction
          if (recs.some(x => (x.kind === 'cntMove' || x.kind === 'cntShort') && x.to === r.task.task.faction)) continue;
          m.level = (RANK[r.task.verdict] ?? 0) >= 3 ? 'critical' : 'high';
          m.effect = r.task.projection != null && r.task.task.goal ? { kind: 'proj', now: r.task.projection / r.task.task.goal } : null;
          break;
        }
        case 'cntWeapon': {
          // a weapon is a requirement of the objective, not advice: it rides on the step for that front,
          // and with no such step it is already said by the objective itself
          const host = out.find(x => (x.kind === 'cntMove' || x.kind === 'cntBehind' || x.kind === 'cntShort') && (x.to || x.task?.task?.faction) === r.task.task.faction);
          if (host) host.weapon = r.task.task.itemId;
          continue;
        }
        case 'cntStart': m.level = 'tip'; break;
        default: break;
      }
      out.push(m);
    }
    // a weapon note for a front step that was pushed after the weapon rec
    for (const w of recs.filter(x => x.kind === 'cntWeapon')) {
      const host = out.find(x => (x.kind === 'cntMove' || x.kind === 'cntBehind' || x.kind === 'cntShort') && (x.to || x.task?.task?.faction) === w.task.task.faction);
      if (host && !host.weapon) host.weapon = w.task.task.itemId;
    }
    // a front that is still short after a "move over" step was pushed before it
    for (const sh of out.filter(x => x.kind === 'cntShort')) {
      const host = out.find(x => x.kind === 'cntMove' && x.to === sh.to);
      if (host) { host.short = sh.players; host.shortWeaponUse = sh.weaponUse; host.weapon = host.weapon || sh.weapon; out.splice(out.indexOf(sh), 1); }
    }
    return out.sort((a, b) => (LEVEL[a.level] ?? 4) - (LEVEL[b.level] ?? 4) || a.prio - b.prio);
  }

  // Which region of a planet to take first: the quickest to capture at gross damage g.
  // Also flags players spread over several regions (every damaged region regenerates).
  function regionAdvice(target, g) {
    const pw = target.pw, p = target.planet;
    const q = (pw.queue || []).filter(x => x.hp > 0);
    if (!q.length) return null;
    const time = (x) => g > x.regen ? x.hp / (g - x.regen) : Infinity;
    const order = [...q].sort((a, b) => time(a) - time(b));
    const first = order[0];
    const busy = q.filter(x => x.players >= 100).length;
    return { region: first.name, hp: first.hp, regen: first.ownRegen ?? first.regen, hours: time(first),
      knock: p.maxHealth ? Math.min(1, (1.5 * first.hp) / p.maxHealth) : null,
      order: order.map(x => x.name), spread: busy >= 2 ? busy : 0 };
  }

  function defenseInfo(p, ctx, H) {
    const { N, now, C, dssIdx, hod, settings } = ctx;
    const e = p.event;
    const hEvent = Math.max(0.01, (new Date(e.endTime).getTime() - now) / 3.6e6);
    const share = N ? (p.statistics?.playerCount || 0) / N : 0;
    const onDss = dssIdx === p.index;
    const mult = (onDss ? 1 + settings.dssBonus : 1) * (onDss && hod ? settings.hodMult : 1);
    const rate = dmg(share, C) * mult;
    const need = shareFor(e.health / hEvent / (1 + settings.dssBonus), C);
    const eta = rate > 0 ? e.health / rate : Infinity;
    const outlastsMO = hEvent > H; // the attack ends after the MO: planet is still ours at MO end
    let verdict = eta <= hEvent ? 'ontrack' : need <= share ? 'focus' : need <= 0.5 ? 'effort' : need <= settings.recordShare ? 'record' : need <= 1 ? 'nearly_impossible' : 'impossible';
    if (outlastsMO) verdict = 'done';
    return { hoursToEnd: hEvent, share, rate, need, eta, verdict, outlastsMO, progress: 1 - e.health / e.maxHealth };
  }

  /* ---------- Several orders at once ----------
     Each order is analysed as if it had the whole playerbase. Here we add up what each one needs,
     by faction. Players fighting a faction count for every kill/mission objective on that front, so
     those overlap with each other and with liberations/defenses of the same faction; liberations,
     defenses and hold targets on different planets don't overlap. Shares are of everyone online. */
  function orderNeeds(res) {
    if (!res || res.ended || res.verdict === 'done') return null;
    const N = res.model.N || 0;
    const place = {}, front = {};   // per faction: planet-bound needs (add up) / front-wide needs (overlap)
    const add = (o, f, x) => { if (f && x > 0 && isFinite(x)) o[f] = (o[f] || 0) + x; };
    let unknown = false;
    const lib = res.liberation;
    if (lib) {
      if (!isFinite(lib.seqNeed)) unknown = true;
      else {
        const tot = lib.targets.reduce((a, r) => a + r.pw.work, 0) || 1;
        lib.targets.forEach(r => add(place, r.planet.currentOwner, lib.seqNeed * r.pw.work / tot));
      }
    }
    for (const r of res.tasks) {
      if (r.verdict === 'done') continue;
      if (r.defense && !r.defense.outlastsMO) add(place, r.planet.event && r.planet.event.faction, r.defense.need);
      if (r.libN && r.libN.first) { if (isFinite(r.libN.seqNeed)) add(place, r.task.faction || r.libN.first.planet.currentOwner, r.libN.seqNeed); else unknown = true; }
    }
    // kills/missions on a front: players needed = players there now x (pace needed / pace now).
    // Weapon-only kills are left out: they depend on how many pick the weapon up, not on head count.
    for (const r of res.tasks) {
      if (!r.counter || r.simpleCount || r.verdict === 'done' || r.task.planetIndex != null) continue;
      const f = r.task.faction, now = res.fronts && res.fronts.players ? res.fronts.players[f] || 0 : 0;
      const rate = r.primary?.rate;
      if (!f || !N || !now || !(rate > 0)) { if (r.verdict === 'unknown' || !(rate > 0)) unknown = true; continue; }
      front[f] = Math.max(front[f] || 0, (now * r.needed / rate) / N);
    }
    const total = Object.values(place).reduce((a, x) => a + x, 0) + Object.values(front).reduce((a, x) => a + x, 0);
    return { place, front, total, unknown };
  }
  function crossOrders(list, recordShare) {
    const live = list.map(x => ({ ...x, need: orderNeeds(x.res) })).filter(x => x.need && x.need.total > 0);
    if (live.length < 2) return null;
    // combine by faction: planet-bound needs add up, front-wide needs overlap with them (take the larger)
    const facs = new Set(live.flatMap(x => [...Object.keys(x.need.place), ...Object.keys(x.need.front)]));
    let total = 0;
    for (const f of facs) {
      const place = live.reduce((a, x) => a + (x.need.place[f] || 0), 0);
      const front = Math.max(0, ...live.map(x => x.need.front[f] || 0));
      total += Math.max(place, front);
    }
    const anyUnknown = live.some(x => x.need.unknown);
    const feasible = live.filter(x => !x.need.unknown && x.need.total <= recordShare);
    // best bet when we can't have everything: the cheapest order that can still be won, more medals breaking ties
    const pick = [...feasible].sort((a, b) => a.need.total - b.need.total || (b.medals || 0) - (a.medals || 0))[0] || null;
    let verdict;
    if (!anyUnknown && total <= recordShare) verdict = 'all';
    else if (pick) verdict = 'pick';
    else verdict = 'none';
    return { verdict, total, orders: live.map(x => ({ id: x.id, title: x.title, medals: x.medals, need: x.need.total, unknown: x.need.unknown })), pick: pick ? pick.id : null };
  }

  // "Liberate N planets": which open planets are quickest to take, and can we take enough of them in time?
  // Players already fighting that faction are assumed to be the ones who would focus.
  function libNInfo(t, ctx, H) {
    const { planets, N, now, C, dssIdx, hod, settings } = ctx;
    const left = Math.max(0, (t.goal || 0) - t.progress);
    if (!left) return { left, pool: [], verdict: 'done' };
    // sector-limited orders need the planet -> sector map (raw WarInfo); without it we can't tell which planets count
    if (t.sectorIndex != null && !ctx.sectorOf) return { left, pool: [], verdict: 'unknown', sectorOnly: true };
    const inSector = (p) => t.sectorIndex == null || ctx.sectorOf[p.index] === t.sectorIndex;
    const pool = Object.values(planets).filter(p => isEnemy(p) && !p.event && inSector(p) && (!t.faction || p.currentOwner === t.faction)).map(p => {
      const pw = planetWork(p);
      const share = N ? (p.statistics?.playerCount || 0) / N : 0;
      const onDss = dssIdx === p.index;
      const mult = (onDss ? 1 + settings.dssBonus : 1) * (onDss && hod ? settings.hodMult : 1);
      const net = dmg(share, C) * mult - pw.activeRegen;
      return { planet: p, pw, share, onDss, net, observed: null, eta: net > 0 ? pw.work / net : Infinity,
        breakEven: shareFor(pw.regen / (1 + settings.dssBonus), C) };
    });
    if (!pool.length) return { left, pool, verdict: 'unknown' };
    const ease = (x) => { const h = hoursFor(x.pw, dmg(0.5, C) * (1 + settings.dssBonus)); return isFinite(h) ? h : 1e9; };
    const rank = [...pool].sort((a, b) => ease(a) - ease(b));
    const pick = rank.slice(0, left);
    const natural = pool.filter(x => x.eta <= H).length;
    const frontShare = pool.reduce((a, x) => a + x.share, 0);
    const hodH = hod ? Math.max(0, Math.min(H, (hod.expire - now) / 3.6e6)) : 0;
    const hodArg = hodH > 0 ? { hours: hodH, mult: settings.hodMult } : null;
    const seqNeed = pick.length < left ? Infinity : minShareSequential(pick.map(x => x.pw), H, C, settings.dssBonus, hodArg);
    let verdict;
    if (natural >= left) verdict = 'ontrack';
    else if (seqNeed <= frontShare) verdict = 'focus';
    else if (seqNeed <= 0.6) verdict = 'effort';
    else if (seqNeed <= settings.recordShare) verdict = 'record';
    else if (seqNeed <= 1) verdict = 'nearly_impossible';
    else verdict = 'impossible';
    return { left, pool, rank, pick, natural, frontShare, seqNeed, verdict, first: rank[0] };
  }

  return { dmg, shareFor, calibrateK, trackPlanets, detectJumps, scanHistory, judgeStretch, taskDiff, orderNeeds, crossOrders, TASK, FACTIONS, DEFAULTS, parseTask, planetWork, sequentialHours, sequentialPlan, bestSubset, recommend, directive, simulate, minShareSequential, parallelShare,
    observedNet, calibrate, counterRates, analyzeAssignment, isEnemy, RANK };
})();
if (typeof module !== 'undefined') module.exports = ENGINE;
