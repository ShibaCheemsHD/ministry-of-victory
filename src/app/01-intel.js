  /* ---------- intel: interventions and Super Earth news ---------- */
  let alerts = store.get('alerts', []);
  let news = store.get('news', { t: 0, items: [] });
  const ALERT_KEEP = 3 * 24 * 3.6e6;
  function addAlerts(found, now, live) {
    // a "changed since launch" note lives as long as its order, and as long as the recorder still stands by it
    alerts = alerts.filter(x => x.ref === 'briefing' ? (last == null || last.results.some(r => String(r.a.id) === x.order))
      && !(record && Array.isArray(record.alerts) && !record.alerts.some(r => r && r.ref === 'briefing' && r.order === x.order && JSON.stringify(r.diff) === JSON.stringify(x.diff))) : now - x.t < ALERT_KEEP);
    for (const f of found) {
      // one alert per planet and kind every 3 hours; a bigger jump replaces a smaller one
      const same = f.ref === 'briefing' ? alerts.find(x => x.ref === 'briefing' && x.order === f.order)
        : alerts.find(x => x.kind === f.kind && x.idx === f.idx && x.order === f.order && x.eid === f.eid && x.on === f.on && !x.ref && Math.abs(x.t - f.t) < 3 * 3.6e6);
      if (same && f.ref === 'briefing') { Object.assign(same, f, { id: same.id }); continue; }
      if (same) { if ((f.pct || 0) > (same.pct || 0)) Object.assign(same, f, { id: same.id }); continue; }
      const a = { ...f, id: `${f.kind}:${f.idx ?? f.order ?? f.eid}:${f.t}`, fresh: live };
      alerts.push(a);
      if (live && f.kind !== 'regen' && now - f.t < 20 * 60e3) pendingToast.push(a);
    }
    alerts = alerts.slice(-40);
    store.set('alerts', alerts.map(({ fresh: _f, ...x }) => x));
  }
  const pendingToast = [];
  // the site's recorder (GitHub Actions, every ~10 minutes) keeps the war history since the start of
  // the running orders and scans it, so even a first visit sees what happened while nobody was watching
  const RECORD = 'https://raw.githubusercontent.com/ShibaCheemsHD/ministry-of-victory/data/';
  let record = store.get('record', null);   // { t, since, every, alerts }
  let recordSamples = [], recordFetched = 0, recordProgress = null;
  const isNum = (x) => typeof x === 'number' && isFinite(x), isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x), arr = (x) => Array.isArray(x) ? x : [];
  async function loadRecord(now) {
    if (now - recordFetched < 5 * 60e3) return false;
    recordFetched = now;
    try {
      const [intel, recent, prog] = await Promise.all(['intel.json', 'recent.json', 'progress.json'].map(f =>
        ghFetch(RECORD + f + '?t=' + Math.floor(now / 300e3), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)));
      // the recorder's files are checked for shape before use: a broken file is ignored, not drawn (audit SEC-06)
      if (intel && Array.isArray(intel.alerts) && isNum(intel.updated)) {
        record = { t: intel.updated, since: isNum(intel.since) ? intel.since : null, every: isNum(intel.every) ? intel.every : 10, alerts: intel.alerts.filter(isObj), effects: arr(intel.effects).filter(isObj),
          inf: isNum(intel.inf) ? intel.inf : null, official: !!intel.official, trust: isObj(intel.trust) && isNum(intel.trust.fall6) ? intel.trust : null,
          K: isNum(intel.K) ? intel.K : null, impN24: isNum(intel.impN24) ? intel.impN24 : null, orders: isObj(intel.orders) ? intel.orders : {}, so: arr(intel.so).filter(isObj) };
        store.set('record', record);
      }
      if (prog && isObj(prog.orders)) { recordProgress = prog; saveRecap(); }
      if (recent && Array.isArray(recent.samples)) recordSamples = recent.samples.filter(x => isObj(x) && isNum(x.t)).map(x => ({ t: x.t, N: x.N, imp: x.imp, dss: x.dss, hod: x.hod, rec: true,
        planets: Object.fromEntries(Object.entries(x.pl || {}).map(([i, v]) => [i, { h: v[0], p: v[1], r: v[2] ?? null, w: v[8] ?? null }])), prog: x.prog || {} }))
        // older progress only (no planets), so a full day of pace is known on a first visit
        .concat(arr(recent.prog).filter(x => isObj(x) && isNum(x.t)).filter(x => !recent.samples.length || x.t < recent.samples[0].t).map(x => ({ t: x.t, rec: true, planets: {}, prog: x.prog || {} })));
      return true;
    } catch { return false; }
  }
  // Plan B: when the community API can't be reached, the recorder's last copy of the war (taken from
  // the community API, or from the game's official API when that one is down too) stands in for it.
  let apiDown = false, stale = null;
  async function loadLive() {
    try {
      const r = await ghFetch(RECORD + 'live.json?t=' + Math.floor(Date.now() / 60e3), { cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      if (!j || j.v !== 1 || !j.war || !Array.isArray(j.assignments) || Date.now() - j.t > 6 * 3600e3) return null;
      return j;
    } catch { return null; }
  }
  // the recorder's snapshots fill the holes in this browser's own history
  function thinSamples(list, now, fullMs = 3 * 3600e3, gap = 10 * 60e3) {
    const out = [];
    let lastOwn = -Infinity;
    for (const s of list) {
      if (s.rec || now - s.t < fullMs) { out.push(s); continue; }
      if (s.t - lastOwn >= gap) { out.push(s); lastOwn = s.t; }
    }
    return out;
  }
  function mergeRecord(list) {
    if (!recordSamples.length) return list;
    const mine = list.filter(x => !x.rec);
    // a recorder sample is dropped when this page has its own within about 90 s (linear: a set of time slots)
    const slot = (t) => Math.round(t / 90e3), have = new Set(mine.map(x => slot(x.t)));
    const add = recordSamples.filter(r => { const k = slot(r.t); return !have.has(k - 1) && !have.has(k) && !have.has(k + 1); });
    return [...mine, ...add].sort((a, b) => a.t - b.t);
  }
  async function loadNews(now) {
    if (now - news.t < 15 * 60e3) return;
    try {
      const list = await getJSON('/api/v1/dispatches', 15000);
      if (Array.isArray(list)) {
        const items = list.filter(d => d && d.message).sort((a, b) => Date.parse(b.published) - Date.parse(a.published)).slice(0, 8)
          .map(d => ({ id: d.id, t: Date.parse(d.published), msg: String(txt(d.message)).slice(0, 1200) }));
        news = { t: now, items };
        store.set('news', news);
      }
    } catch { news = { ...news, t: now - 10 * 60e3 }; }   // try again in 5 minutes
  }
  // planets an order depends on: the ones it names, or every planet that counts for "liberate / defend N"
  function orderPlanets(res) {
    const set = new Set();
    for (const r of res.tasks || []) {
      const tk = r.task || {};
      if (tk.planetIndex != null) set.add(Number(tk.planetIndex));
      if (r.planet) set.add(Number(r.planet.index));
      if ([ENGINE.TASK.LIBERATE_COUNT, ENGINE.TASK.DEFEND_COUNT, ENGINE.TASK.NET_LIBERATION].includes(tk.type) || (r.counter && tk.faction && r.verdict !== 'done')) {
        for (const p of Object.values(last.planets)) {
          if (tk.faction && factionOfPlanet(p) !== tk.faction) continue;
          if (tk.sectorIndex != null && last.sectorOf && last.sectorOf[p.index] !== tk.sectorIndex) continue;
          set.add(Number(p.index));
        }
      }
    }
    return set;
  }
  // headline and text of a dispatch, and what it announces: one shared reading (engine.js, tested on every dispatch since 2024)
  const newsParts = (msg) => ENGINE.splitDispatch(msg);
  const soOutcome = (msg) => { const np = ENGINE.splitDispatch(msg); return ENGINE.dispatchKind(np.title, np.body).so; };
  function intelFor(entry) {
    const now = last.now, rel = orderPlanets(entry.res);
    const names = [...rel].map(i => txt(last.planets[i]?.name)).filter(Boolean).map(n => n.toLowerCase());
    const touches = (x) => x.kind === 'edited' ? x.order === String(entry.a.id)
      : Array.isArray(x.planets) ? x.planets.some(i => i === -1 || rel.has(i)) : rel.has(x.idx);
    // an "objectives changed" note must fit the order as it stands: the objective it names exists and, for a
    // change found against the launch text, today's goal is the one it says ("35M -> 60M": 60M now)
    const goals = entry.res.tasks.map(r => r.task.goal);
    const editOk = (x) => x.kind !== 'edited' || !Array.isArray(x.diff) || x.diff.every(d => d.i >= 1 && d.i <= goals.length + (d.kind === 'removed' ? 1 : 0)
      && (d.kind !== 'goal' || x.ref !== 'briefing' || goals[d.i - 1] === d.to));
    let items = alerts.filter(touches).filter(editOk).filter(x => x.ref === 'briefing' || now - x.t < 24 * 3.6e6).sort((a, b) => b.t - a.t);
    const eds = items.filter(x => x.kind === 'edited');
    if (eds.length > 1) {
      const keep = eds.find(x => Array.isArray(x.diff) && x.diff.length) || eds[0];
      const merged = { ...keep, t: Math.min(...eds.map(x => x.t)), merged: eds.some(x => !x.ref) };
      items = [...items.filter(x => x.kind !== 'edited'), merged].sort((a, b) => b.t - a.t);
    }
    const weapons = new Set(entry.res.tasks.filter(r => r.verdict !== 'done').map(r => r.task.itemId).filter(Boolean).map(String));
    // effects switched on right now on the planets this order depends on (straight from the game)
    const active = (record?.effects || []).filter(e => (e.planets.some(i => i === -1 || rel.has(i)) || (e.type === 32 && weapons.has(String(valOf(e.v, 4))))) && !items.some(x => x.kind === 'effect' && x.on && x.eid === e.id))
      .map(e => ({ kind: 'active', t: record.t, eid: e.id, type: e.type, v: e.v, planets: e.planets, mine: e.type === 32 && weapons.has(String(valOf(e.v, 4))) }))
      .sort((a, b) => (b.mine - a.mine) || (WAR_FX.has(b.type) - WAR_FX.has(a.type)))
      .filter((x, i, arr) => WAR_FX.has(x.type) || arr.filter(y => !WAR_FX.has(y.type)).indexOf(x) < 3);
    const ns = news.items.filter(d => now - d.t < 48 * 3.6e6).slice(0, 3)
      .map(d => { const np = newsParts(d.msg); return { kind: 'news', t: d.t, id: 'news:' + d.id, ...np, nk: newsKind(np.title, np.body), hit: names.some(n => n && d.msg.toLowerCase().includes(n)) }; });
    return { items: [...items, ...active], news: ns, rel };
  }
  // the war-changing effects come first; perks like a free stratagem are listed after the rest
  const WAR_FX = new Set([1, 74, 77, 90, 88, 47, 48, 49, 89, 92]);
  const prioOf = (x) => ({ setback: 0, jump: 1, attack: 2, edited: 3, regen: 4 })[x.kind]
    ?? (x.kind === 'effect' ? (WAR_FX.has(x.type) ? 2.5 : 6) : x.kind === 'active' ? (WAR_FX.has(x.type) ? 3.5 : 7) : 8);
  const valOf = (v, type) => { const f = (v || []).find(x => x[0] === type); return f ? f[1] : null; };
  const signed = (n) => (n > 0 ? '+' : '') + fmt(n) + '%';
  // a game multiplier in percent: +30% reads as such, 3,000% reads better as "x30"
  const boost = (p) => p >= 300 ? '×' + fmt(p / 100, p < 1000 ? 1 : 0) : signed(p - 100);
  function effectLabel(type, v) {
    const pctv = valOf(v, 2), item = valOf(v, 4), foe = valOf(v, 16) ?? valOf(v, 13);
    const foeName = foe && enemyKnown(foe) ? esc(enemyName(foe)) : null;
    const L = t('in.fx');
    switch (type) {
      case 1: return pctv > 0 ? fill(L.lib, { x: boost(pctv) }) : L.libOdd;
      case 74: return fill(L.regenPct, { x: signed(pctv || 0) });
      case 77: return L.regenSet;
      case 90: return fill(L.maxHp, { x: fmt(pctv || 0) + '%' });
      case 88: return L.pause;
      case 47: return L.noInvade;
      case 48: case 89: return L.noAttack;
      case 49: return fill(L.attackUp, { x: signed(pctv || 0) });
      case 92: return L.demil;
      case 32: return itemKnown(item) ? fill(L.permit, { item: esc(itemKnown(item)) }) : L.permitAny;
      case 72: return pctv - 100 > 0 ? fill(foeName ? L.spawnMore : L.spawnMoreAny, { foe: foeName, x: boost(pctv) }) : fill(L.spawnLess, { foe: foeName || L.someFoe });
      case 40: return foeName ? fill(L.division, { foe: foeName }) : L.divisionAny;
      case 21: return L.extract;
      case 36: return fill(itemKnown(item) ? L.cooldown : L.cooldownAny, { item: esc(itemKnown(item) || ''), x: signed(pctv || 0) });
      default: return L.other;
    }
  }
  function planetList(list, rel) {
    if (list.includes(-1)) return t('in.fx.galaxy');
    const all = list.filter(i => rel.has(i)).map(i => last.planets[i] ? '<b>' + planetName(last.planets[i]) + '</b>' : '#' + i);
    const mine = all.slice(0, 3), others = list.length - mine.length;
    if (others > 0) mine.push(fill(t(others === 1 ? 'in.fx.other1' : 'in.fx.others'), { n: others }));
    return listJoin(mine);
  }
  function alertText(x, short, rel) {
    if (x.kind === 'effect' || x.kind === 'active') {
      const label = effectLabel(x.type, x.v), where = planetList(x.planets || [], rel || new Set());
      let out = fill(t((short ? 'in.s.' : 'in.') + (x.kind === 'active' ? 'active' : x.on ? 'fxOn' : 'fxOff')), { label, where });
      if (!short && (x.kind === 'active' || x.on) && [1, 74, 77, 90].includes(x.type)) out += ' ' + t('in.fxPace');
      return /^[a-z]/.test(out) ? out.charAt(0).toUpperCase() + out.slice(1) : out;
    }
    const p = last.planets[x.idx];
    const planet = p ? planetName(p) : esc(x.name || '#' + x.idx);
    const k = x.kind === 'regen' ? (x.to > x.from ? 'regenUp' : 'regenDown') : x.kind === 'jump' && x.attack ? 'jumpDef' : x.kind;
    const params = { planet, pct: pct(x.pct, 0), dur: dur((x.mins || 0) / 60), players: people(x.players || 0),
      from: pct(x.from, 1), to: pct(x.to, 1), faction: facName(x.faction), when: x.end ? clock((x.end - last.now) / 3.6e6) : '—' };
    if (x.kind === 'edited') return editedText(x, short);
    let out = fill(t((short ? 'in.s.' : 'in.') + k), params);
    if ((x.kind === 'jump' || x.kind === 'setback') && !short && x.won != null)
      out += ' ' + fill(t('in.proof'), { won: fmt(x.won), worth: x.worth == null ? '—' : x.worth < 0.0001 ? t('in.lt') : fill(t('in.about'), { x: pct(x.worth, 2) }) });
    return out;
  }
  // the Strategic Opportunity news that most likely explains an edit: close in time, or (for a change
  // found against the launch briefing) the latest one won while the order was running
  // Strategic Opportunity dispatches: the recorder keeps them for a week, this browser keeps the latest news
  function soList() {
    const seen = new Set(), out = [];
    for (const n of [...((record && record.so) || []), ...(news.items || [])]) if (n && soOutcome(n.msg) && !seen.has(n.id)) { seen.add(n.id); out.push(n); }
    return out.sort((a, b) => b.t - a.t);
  }
  function soNews(x, entry) {
    const won = soList();
    if (x.ref === 'briefing') {
      const start = x.start || entry?.start || 0;
      return won.filter(n => n.t >= start && soOutcome(n.msg) === 'won').sort((a, b) => b.t - a.t)[0] || null;
    }
    return won.find(n => soOutcome(n.msg) === 'won' && Math.abs(n.t - x.t) < 3 * 3.6e6) || null;
  }
  // an order edited in place: what changed, in the words of the objective, and the likely reason
  function editedText(x, short) {
    const entry = last && last.results.find(r => String(r.a.id) === String(x.order));
    const whatOf = (i) => { const r = entry && entry.res.tasks[i - 1]; return r ? plain(taskText(r)).replace(/^(Kill|Liberate|Defend|Extract|Complete)\s+[\d.,]+[kMB]?\s*/i, '') : '#' + i; };
    const goals = (x.diff || []).filter(d => d.kind === 'goal');
    if (short) {
      if (goals.length === 1) return fill(t(goals[0].to < goals[0].from ? 'in.s.editedGoal' : 'in.s.editedRaise'), { what: esc(whatOf(goals[0].i)), from: big(goals[0].from), to: big(goals[0].to) });
      if (goals.length > 1 && goals.every(g => g.to < g.from)) return fill(t('in.s.editedCutN'), { n: goals.length });
      if (goals.length > 1 && goals.every(g => g.to > g.from)) return fill(t('in.s.editedRaiseN'), { n: goals.length });
      return t('in.s.edited');
    }
    const parts = [t(x.ref === 'briefing' ? 'in.editedLaunch' : 'in.edited')];
    if (Array.isArray(x.diff) && x.diff.length) parts.push(x.diff.map(d => d.kind === 'goal' ? fill(t(d.to < d.from ? 'in.d.lower' : 'in.d.higher'), { what: esc(whatOf(d.i)), from: big(d.from), to: big(d.to) }) : fill(t('in.d.' + d.kind), { i: d.i })).join(' '));
    else parts.push(t('in.editedUnknown'));
    const so = soNews(x, entry);
    if (so) parts.push(fill(t('in.editedCause'), { title: esc(newsParts(so.msg).title) }));
    parts.push(t('in.editedNote'));
    return parts.join(' ');
  }
  // how sure: read from the game, or worked out from the numbers
  const tagOf = (x) => (x.kind === 'jump' || x.kind === 'setback') ? (x.won != null ? t('in.tag.counted') : t('in.tag.deduced')) : t('in.tag.data');
  const ago = (tm) => fill(t('in.ago'), { d: dur(Math.max(0, last.now - tm) / 3.6e6) });

  /* ---------- intel tab: what Super Earth Command (and the enemy) did, and the news ---------- */
  // Super Earth dispatches sorted by what they announce: each kind has its own colour and icon
  const NEWS_ICON = { info: 'news', win: 'trophy', loss: 'cross', so: 'check', solost: 'down', order: 'flag', gear: 'box', threat: 'warn' };
  const newsKind = (title, body) => ENGINE.dispatchKind(title, body).kind;
  const KIND_ICON = { jump: 'up', setback: 'down', attack: 'shield', regen: 'regen', edited: 'edit', effect: 'fx', active: 'fx', news: 'news' };
  const levelOf = (x) => x.kind === 'setback' || x.kind === 'attack' ? 'bad' : x.kind === 'news' ? 'info' : (x.kind === 'active' || x.kind === 'effect') && !WAR_FX.has(x.type) ? 'perk' : 'warn';
  function intelCount(entry) {
    const { items } = intelFor(entry);
    const live = items.filter(x => x.kind !== 'active' && prioOf(x) < 5);
    return { n: live.length, level: live.some(x => levelOf(x) === 'bad') ? 'bad' : live.length ? 'warn' : '' };
  }
  // the key number of an event, in one line
  function keyLine(x, rel) {
    switch (x.kind) {
      case 'jump': case 'setback': return `${x.kind === 'jump' ? '+' : '−'}${pct(x.pct, 0)} · ${dur((x.mins || 0) / 60)}${x.won != null ? ' · ' + fill(t('it.won'), { n: fmt(x.won) }) : ''}`;
      case 'regen': return `${pct(x.from, 1)}/h → <b>${pct(x.to, 1)}/h</b>`;
      case 'attack': return x.end ? fill(t('it.hold'), { when: clock((x.end - last.now) / 3.6e6) }) : '';
      case 'edited': {
        const so = soNews(x), cut = (x.diff || []).filter(d => d.kind === 'goal').map(d => `${big(d.from)} → <b>${big(d.to)}</b>`).join(' · ');
        return [cut, so ? fill(t(x.ref === 'briefing' ? 'it.afterSo2' : 'it.afterSo'), { title: esc((tl => tl.charAt(0) + tl.slice(1).toLowerCase())(plain(newsParts(so.msg).title))) }) : ''].filter(Boolean).join(' · ');
      }
      case 'effect': case 'active': return planetList(x.planets || [], rel);
      default: return '';
    }
  }
  // a small picture of the planet around a jump or setback
  function sparkHTML(x) {
    if (x.kind !== 'jump' && x.kind !== 'setback') return '';
    const pts = planetSeries(x.idx).filter(q => q[0] >= x.t - 3 * 3.6e6 && q[0] <= x.t + 2 * 3.6e6);
    if (pts.length < 3) return '';
    const t0 = pts[0][0], t1 = pts[pts.length - 1][0], lo = Math.min(...pts.map(q => q[1])), hi = Math.max(...pts.map(q => q[1]));
    const X = (tt) => ((tt - t0) / Math.max(1, t1 - t0)) * 120, Y = (v) => 34 - ((v - lo) / Math.max(1e-6, hi - lo)) * 30;
    return `<svg class="spark ${x.kind}" viewBox="0 0 120 36" aria-hidden="true"><path d="${pts.map((q, i) => `${i ? 'L' : 'M'}${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join('')}" vector-effect="non-scaling-stroke"/><line x1="${X(x.t).toFixed(1)}" x2="${X(x.t).toFixed(1)}" y1="0" y2="36"/></svg>`;
  }
  function intelTabHTML(entry) {
    const { items, news: ns, rel } = intelFor(entry);
    const now = last.now, span = 48 * 3.6e6, from = now - span;
    const events = [...items.filter(x => x.kind !== 'active'), ...ns].filter(x => x.t >= from).sort((a, b) => b.t - a.t);
    const active = items.filter(x => x.kind === 'active');
    const posX = (tt) => Math.max(0, Math.min(100, ((tt - from) / span) * 100));
    const ticks = []; const d = new Date(from); d.setMinutes(0, 0, 0); d.setHours(Math.ceil(d.getHours() / 12) * 12);
    for (; d.getTime() < now; d.setHours(d.getHours() + 12)) ticks.push(d.getTime());
    const timeline = `<div class="it-line" role="group" aria-label="${esc(t('it.lineAria'))}">
      <div class="it-track">${ticks.map(tt => `<span class="it-tick" style="left:${posX(tt)}%"><i></i>${esc(new Date(tt).toLocaleString(locale(), { weekday: 'short' }) + ' ' + String(new Date(tt).getHours()).padStart(2, '0') + ':00')}</span>`).join('')}
        ${events.map((x, i) => `<button type="button" class="it-dot lv-${levelOf(x)} ${x.kind === 'news' ? 'nk-' + x.nk : ''}" style="left:${posX(x.t)}%" data-ifocus="it-${i}" title="${esc(plain(x.kind === 'news' ? x.title : alertText(x, true, rel)))}">${ICON[x.kind === 'news' ? NEWS_ICON[x.nk] : KIND_ICON[x.kind]] || ''}</button>`).join('')}
        <span class="it-now" style="left:100%">${esc(t('h.now'))}</span></div></div>`;
    const card = (x, i) => {
      const lv = levelOf(x), sure = x.kind === 'jump' || x.kind === 'setback' ? 'lens' : 'data';
      if (x.kind === 'news') return `<article class="it-card lv-info news nk-${x.nk} ${x.hit ? 'hit' : ''}" id="it-${i}">
        <span class="it-ico">${ICON[NEWS_ICON[x.nk]]}</span><div class="it-body"><div class="it-top"><h5 aria-level="4">${esc(titleCase(x.title))}</h5><span class="it-when">${esc(ago(x.t))}</span></div>
        ${x.body ? `<details class="it-more"><summary>${esc(t('it.read'))}</summary><p>${clean(x.body)}</p></details>` : ''}</div></article>`;
      const key = keyLine(x, rel);
      return `<article class="it-card lv-${lv}" id="it-${i}">
        <span class="it-ico">${ICON[KIND_ICON[x.kind]] || ''}</span>
        <div class="it-body"><div class="it-top"><h5 aria-level="4">${alertText(x, true, rel)}</h5><span class="it-when">${esc(x.kind === 'active' ? t('in.now') : x.ref === 'briefing' && !x.merged ? t('it.sinceLaunch') : ago(x.t))}</span></div>
          ${key ? `<p class="it-key">${key}</p>` : ''}${sparkHTML(x)}
          <div class="it-foot"><span class="it-sure ${sure}" title="${esc(t(sure === 'lens' ? 'it.deducedT' : 'it.dataT'))}">${ICON[sure]}${esc(tagOf(x))}</span>
            <details class="it-more"><summary>${esc(t(sure === 'lens' ? 'it.why' : 'it.details'))}</summary><p>${alertText(x, false, rel)}</p></details></div></div></article>`;
    };
    const cmd = events.filter(x => x.kind !== 'news');
    const counts = [cmd.length ? fill(t(cmd.length === 1 ? 'it.n1' : 'it.n'), { n: cmd.length }) : null, active.length ? fill(t(active.length === 1 ? 'it.nActive1' : 'it.nActive'), { n: active.length }) : null, ns.length ? fill(t(ns.length === 1 ? 'it.nNews1' : 'it.nNews'), { n: ns.length }) : null].filter(Boolean);
    const quiet = !cmd.length && !active.length;
    return `<div class="intel-tab">
      <div class="it-head"><div><h3>${esc(t('it.title'))}</h3>${counts.length ? `<p>${counts.join(' · ')}</p>` : ''}</div></div>
      ${events.length ? timeline : ''}
      ${quiet && !ns.length ? `<div class="it-quiet"><span class="radar"></span><p>${esc(t('allQuiet'))}</p></div>` : `<div class="it-cols">
        <section class="it-col"><span class="label">${esc(t('it.cmd'))}</span>
          ${quiet ? '' : `<p class="it-legend"><span><span class="it-sure data">${ICON.data}${esc(t('in.tag.data'))}</span> ${esc(t('it.keyData'))}</span><span><span class="it-sure lens">${ICON.lens}${esc(t('in.tag.deduced'))}</span> ${esc(t('it.keyDeduced'))}</span></p>`}
          ${quiet ? `<div class="it-quiet"><span class="radar"></span><p>${esc(t('it.quiet'))}</p></div>` : ''}
          ${cmd.map(x => card(x, events.indexOf(x))).join('')}
          ${active.length ? `<span class="label sub">${esc(t('it.activeNow'))}</span>${active.map((x, k) => card(x, 'a' + k)).join('')}` : ''}</section>
        <section class="it-col"><span class="label">${esc(t('in.news'))}</span>${ns.length ? ns.map(x => card(x, events.indexOf(x))).join('') : `<p class="it-empty">${esc(t('it.noNews'))}</p>`}</section>
      </div>`}
      <p class="foot">${esc(record && record.since ? fill(t('it.foot'), { when: new Date(record.since).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }) : t('it.footLocal'))}</p>
    </div>`;
  }

  // Fast first paint: the page draws at once from this browser's last copy of the war (or the
  // recorder's copy, which a CDN serves in a fraction of a second) while the live API answers.
  // A seed render never records samples or alerts and never overwrites fresher data.
  let freshDone = false;
  async function refresh(opts = {}) {
    const seed = opts.seed || null;
    if (!seed) {
      if (busy) return;
      busy = true;
      $('refresh').classList.add('busy');
    }
    const errors = [];
    try {
      const recP = seed ? Promise.resolve(false) : loadRecord(Date.now());
      let war, assignments, campaigns, stations, live = seed;
      if (seed) ({ war, assignments, campaigns, stations } = seed);
      else try {
        // while the API is known to be down, ask it once, quickly, then go to plan B
        const tmo = apiDown ? 8000 : 15000, rt = apiDown ? 0 : 2;
        [war, assignments, campaigns, stations] = await Promise.all([
          getJSON('/api/v1/war', tmo, rt),
          getJSON('/api/v1/assignments', tmo, rt),
          getJSON('/api/v1/campaigns', tmo, rt).catch(e => { errors.push(e.message); return []; }),
          getCached('/api/v2/space-stations', 2 * 60e3, tmo).catch(() => []),
        ]);
        apiDown = false; stale = null;
      } catch (e) {
        live = await loadLive();
        if (!live) throw e;
        apiDown = true; errors.length = 0;
        ({ war, assignments, campaigns, stations } = live);
        stale = { t: live.t, src: live.src };
      }
      // order start times never change: asked again only when an order appears that isn't listed yet
      const rawPath = '/raw/api/v2/Assignment/War/801';
      if (!live && memo[rawPath] && (assignments || []).some(a => !(memo[rawPath].data || []).some(x => String(x.id32) === String(a.id)))) delete memo[rawPath];
      const raw = live ? (live.raw || []) : await getCached(rawPath, 30 * 60e3).catch(() => []);
      if (!seed && !live) try { store.set('snap', { v: 1, t: Date.now(), src: 'cache', war, assignments, campaigns, stations, raw }); } catch { }
      const planets = {};
      for (const c of campaigns || []) if (c && c.planet) planets[c.planet.index] = c.planet;
      if (live) for (const p of live.extra || []) if (p && p.index != null && !planets[p.index]) planets[p.index] = p;
      if (seed) { const xc = store.get('xplanets', {}); for (const k of Object.keys(xc)) if (!planets[k] && xc[k].p) planets[k] = xc[k].p; }
      const needed = new Set();
      for (const a of assignments || []) for (const tk of a.tasks || []) {
        const p = ENGINE.parseTask(tk, 0);
        if (p.planetIndex != null && !planets[p.planetIndex]) needed.add(p.planetIndex);
      }
      // planets an order names that aren't being fought over (already liberated, held...). They rarely
      // change, so they're kept for 30 minutes; if the request budget is spent, the page shows what it
      // has now and fills them in a few seconds later.
      const xcache = store.get('xplanets', {}), tnow = Date.now();
      for (const k of Object.keys(xcache)) if (tnow - xcache[k].t > 30 * 60e3) delete xcache[k];
      const want = [...needed].slice(0, 8);
      want.forEach(i => { if (xcache[i]) planets[i] = xcache[i].p; });
      const missing = live ? [] : want.filter(i => !planets[i]);
      const nowList = missing.filter(i => memo['/api/v1/planets/' + i]).concat(missing.filter(i => !memo['/api/v1/planets/' + i]).slice(0, freeSlots()));
      const laterList = missing.filter(i => !nowList.includes(i));
      const keep = (p) => { if (p && p.index != null) { planets[p.index] = p; xcache[p.index] = { t: tnow, p }; } };
      (await Promise.all(nowList.map(i => getCached('/api/v1/planets/' + i, 3 * 60e3).catch(() => null)))).forEach(keep);
      store.set('xplanets', xcache);
      if (laterList.length) Promise.all(laterList.map(i => getCached('/api/v1/planets/' + i, 3 * 60e3).catch(() => null)))
        .then(ps => { const xc = store.get('xplanets', {}); ps.forEach(p => { if (p && p.index != null) xc[p.index] = { t: Date.now(), p }; }); store.set('xplanets', xc); refresh(); });

      // sector-limited objectives: planet -> sector map from the raw war info (static, cached for a day)
      let sectorOf = null, sectorName = null;
      const sectorTasks = (assignments || []).some(a => (a.tasks || []).some(tk => ENGINE.parseTask(tk, 0).sectorIndex != null));
      if (sectorTasks) {
        const cached = store.get('sectors', null);
        if (cached && Date.now() - cached.t < 24 * 3600e3) sectorOf = cached.map;
        else {
          const info = live ? null : await getJSON('/raw/api/WarSeason/801/WarInfo').catch(() => null);
          if (info && Array.isArray(info.planetInfos)) {
            sectorOf = Object.fromEntries(info.planetInfos.map(x => [x.index, x.sector]));
            store.set('sectors', { t: Date.now(), map: sectorOf });
          }
        }
        if (sectorOf) {
          sectorName = {};
          for (const p of Object.values(planets)) if (p.sector && sectorOf[p.index] != null) sectorName[sectorOf[p.index]] = p.sector;
        }
      }

      const st = (stations || [])[0];
      const dssIdx = st?.planet?.index ?? null;
      if (st?.planet && !planets[dssIdx]) planets[dssIdx] = st.planet;
      const hodAction = (st?.tacticalActions || []).find(a => /ordnance|ordinance/i.test(a.name || '') && a.status === 2 && Date.parse(a.statusExpire) > Date.now());
      const hod = hodAction ? { expire: Date.parse(hodAction.statusExpire) } : null;

      const now = Date.now();
      const N = war?.statistics?.playerCount || 0;
      const warStart = Date.parse(war?.started) || null;
      // startTime is in *game* seconds, and the game clock runs weeks behind the calendar, so it can't
      // be added to the war's real start date. The API's war "now" is the game clock (as epoch seconds):
      // elapsed = game now - start, and the real start is that long before the real now.
      const gameNow = Date.parse(war?.now) / 1000;
      const startOf = (id) => {
        const r = (raw || []).find(x => String(x.id32) === String(id));
        if (!r || r.startTime == null) return null;
        if (isFinite(gameNow) && gameNow > r.startTime) return now - (gameNow - r.startTime) * 1000;
        return warStart ? warStart + r.startTime * 1000 : null;
      };

      const imp = Number(war?.impactMultiplier) || null;
      const sample = { t: now, N, imp, dss: dssIdx, hod: !!hod, planets: {}, prog: {} };
      for (const [i, p] of Object.entries(planets)) sample.planets[i] = { h: p.event ? p.event.health : p.health, p: p.statistics?.playerCount || 0, r: p.event ? 0 : (p.regenPerSecond || 0), w: p.statistics?.missionsWon ?? null };
      for (const a of assignments || []) sample.prog[orderKey(a)] = a.progress;
      await recP;
      samples = mergeRecord(samples.filter(s => now - s.t < KEEP_MS));
      if (!live && (!samples.length || now - samples[samples.length - 1].t > 30e3)) samples.push(sample);
      // older than 3 hours, this page's own samples thin out to one every 10 minutes (the pace and the
      // calibration only look at the last 3 hours at full detail)
      samples = thinSamples(samples, now);
      if (samples.length > 3000) samples = samples.slice(-3000);
      // what this browser keeps between visits: its own samples of the last 6 hours, one every 5 minutes.
      // The recorder's are downloaded again; 48 hours of everything was ~10 MB, past the browser's quota
      // (audit CR-01), and was written out every minute.
      store.set('samples', thinSamples(samples.filter(s => !s.rec && now - s.t < 6 * 3600e3), now, 0, 5 * 60e3));

      // Capacity = HP per hour that 100% of the players would deal on one planet, worked out live:
      // C = K x impactMultiplier x players online x 3600. K is measured from this browser's own samples,
      // else the last value it measured (up to a week old), else the reference.
      const calib = ENGINE.calibrateK(samples, planets, now, settings.dssBonus, settings.hodMult);
      let C, capSrc, K = null;
      if (calib && calib.K > K_MIN && calib.K < K_MAX) { K = calib.K; capSrc = 'kMeasured'; store.set('kcal', { K, t: now, hours: calib.hours }); }
      else {
        const saved = store.get('kcal', null);
        if (record && record.K > K_MIN && record.K < K_MAX && now - record.t < 2 * 3600e3) { K = record.K; capSrc = 'kRecord'; }
        else if (saved && now - saved.t < 7 * 24 * 3600e3 && saved.K > K_MIN && saved.K < K_MAX) { K = saved.K; capSrc = 'kRecent'; }
        else { K = K_REF; capSrc = 'kDefault'; }
      }
      if (settings.capMode === 'manual') { C = settings.capacity; capSrc = 'capManual'; }
      // impact x players stays nearly flat through the day: its mean over the last day (from the recorder)
      // is the war's strength for forecasts; the value right now swings about ±12% with the time of day
      else if (record && record.impN24 && now - record.t < 6 * 3600e3) C = K * record.impN24 * 3600;
      else if (imp && N) C = K * imp * N * 3600;
      else { C = ENGINE.DEFAULTS.capacity; capSrc = 'capDefault'; }

      // interventions: hand-made changes the players can't explain, plus Super Earth's own news
      const tracked = seed ? { meta: store.get('pmeta', {}), changes: [] } : ENGINE.trackPlanets(store.get('pmeta', {}), planets, now);
      if (!seed) store.set('pmeta', tracked.meta);
      const found = seed ? [] : [...tracked.changes, ...ENGINE.detectJumps(samples, tracked.meta, { now, K, hodMult: settings.hodMult, C, inf: record?.inf || 100 })];
      const okeys = store.get('okeys', {});
      if (!seed) for (const a of assignments || []) {
        const id = String(a.id), key = orderKey(a), was = okeys[id];
        const wasKey = typeof was === 'string' ? was : was?.key;
        if (wasKey && wasKey !== key) found.push({ kind: 'edited', order: id, t: now, diff: was.tasks ? ENGINE.taskDiff(was.tasks, a.tasks || []) : null });
        okeys[id] = { key, tasks: (a.tasks || []).map(tk => ({ type: tk.type, values: tk.values, valueTypes: tk.valueTypes })) };
      }
      if (!seed) store.set('okeys', okeys);
      if (record) found.push(...record.alerts.filter(a => a && a.kind && (a.ref === 'briefing' || now - a.t < ALERT_KEEP)));
      addAlerts(found, now, !!last);

      const base = { planets, N, now, C, dssIdx, hod, settings, samples, sectorOf };
      const results = (assignments || []).map(a => ({ a, res: ENGINE.analyzeAssignment(a, { ...base, startMs: startOf(a.id), progKey: orderKey(a) }), start: startOf(a.id) }));
      // a Major Order that wasn't there before: say so, and highlight its tab until it's opened
      const newOnes = results.filter(x => !known.has(String(x.a.id)));
      if (newOnes.length && last) {
        newOnes.forEach(x => fresh.add(String(x.a.id)));
        toast(newOnes.length > 1 ? fill(t('newOrders'), { n: newOnes.length }) : fill(t('newOrder'), { title: plain(clean(txt(newOnes[0].a.title) || 'Major Order')) }));
        if (!results.some(x => String(x.a.id) === String(ui.order))) ui.order = String(newOnes[0].a.id);
      }
      newOnes.forEach(x => known.add(String(x.a.id)));
      store.set('known', [...known].slice(-50));
      if (seed && freshDone) return;
      last = { N, planets, dssIdx, hod, C, K, imp, capSrc, calib, results, now, sectorName, sectorOf, stale: seed ? null : stale, seeded: !!seed };
      if (!seed) freshDone = true;
      lastOk = now;
      if (dragging) pendingRender = true; else render();
      // news last, in the background: it never holds up the numbers
      if (!live && !seed && now - news.t >= 15 * 60e3) loadNews(now).then(() => { if (last && !dragging) render(); });
      const hit = pendingToast.splice(0).find(x => (x.kind !== 'effect' || WAR_FX.has(x.type)) && results.some(({ a, res }) => { const rel = orderPlanets(res); return x.kind === 'edited' ? x.order === String(a.id) : Array.isArray(x.planets) ? x.planets.some(i => i === -1 || rel.has(i)) : rel.has(x.idx); }));
      if (hit && !newOnes.length) toast(plain(alertText(hit, true, new Set())));
      if (unknownNames(results)) loadNames(true).then(() => { if (last && !dragging) render(); });
    } catch (e) {
      errors.push(e && e.message ? e.message : String(e));
      lastStack = e && e.stack ? String(e.stack) : '';
    } finally {
      // seed data (saved snapshot or the recorder's live file) is a first paint: the real refresh
      // that follows shows any errors, so here they only go to the console (audit CR-04)
      if (seed) {
        if (errors.length) console.warn('first paint from saved data:', errors.join(' · '));
        if (last && !firstDone) { firstDone = true; bootFinish('ok'); }
      } else {
        try { renderErrors(errors); } catch (e2) { console.error(e2); }
        lastRun = Date.now();
        busy = false;
        $('refresh').classList.remove('busy');
        if (!firstDone) { firstDone = true; bootFinish(last ? 'ok' : 'fail'); }
        if (!last && errors.length) { $('view').innerHTML = ''; document.title = `${t('offline')} · Ministry of Victory`; }
        tick();
      }
    }
  }
  window.addEventListener('error', (ev) => { lastStack = String(ev.error && ev.error.stack || ev.message); try { renderErrors([String(ev.message)]); } catch {} });
  window.addEventListener('unhandledrejection', (ev) => { const r = ev.reason; lastStack = String(r && r.stack || r); try { renderErrors([String(r && r.message || r)]); } catch {} });

