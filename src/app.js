/* Ministry of Victory - user interface */
(() => {
  'use strict';
  const API = 'https://api.helldivers2.dev';
  const NAMES = {
    enemies: 'https://raw.githubusercontent.com/Stonemercy/Galactic-Wide-Web/main/data/json/enemies/enemy_ids.json',
    items: 'https://raw.githubusercontent.com/helldivers-2/json/master/items/item_names.json',
    strats: 'https://raw.githubusercontent.com/Stonemercy/Galactic-Wide-Web/main/data/lists.py',
  };
  const REFRESH_MS = 60000;
  // damage constant K (HP per second per player per unit of impact multiplier): reference value measured
  // live on 28 Oct 2026; plausible range used to reject bad measurements
  const K_REF = 0.027, K_MIN = 0.005, K_MAX = 0.2;
  const KEEP_MS = 48 * 3600e3;
  const RING = 75.4;

  /* ---------- storage (per-browser conveniences; never required) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mocheck.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('mocheck.' + k, JSON.stringify(v)); } catch {} },
  };

  /* ---------- texts + formatting (English only) ---------- */
  const t = (k) => {
    const v = k.split('.').reduce((o, p) => o?.[p], TEXT);
    // the test page lists every text the code asks for and the dictionary doesn't have
    if (v == null && window.__mockLog) (window.__missingT ||= new Set()).add(k);
    return v ?? k;
  };
  // the browser's own English variant if it has one, otherwise en-GB (24-hour clock)
  const LOCALE = (() => { const n = (navigator.language || '').trim(); return /^en(-|$)/i.test(n) ? n : 'en-GB'; })();
  const locale = () => LOCALE;
  // numbers always in English format (36,000), whatever the browser's region
  const fmt = (n, d = 0, min = d) => (n == null || !isFinite(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: min });
  const plainCap = (s) => String(s).replace(/<[^>]+>/g, '');
  const pct = (x, d = 0) => (x == null || !isFinite(x)) ? '—' : fmt(x * 100, d) + '%';
  // a projection of the goal: past three times it, the exact figure means nothing
  const projPct = (x) => x > 3 ? '>300%' : pct(x);
  // shares in the plan texts: "83%", or "over 500%" when even 5x the playerbase isn't enough
  // a share of everyone online: past twice everyone, "x times everyone" says it better than 23,083%
  const sharePct = (x, d = 0) => (x == null || !isFinite(x)) ? t('shareInf') : x > 2 ? fill(t('shareX'), { x: fmt(x, x < 10 ? 1 : 0) }) : pct(x, d);
  const big = (n) => {
    if (n == null || !isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a >= 1e9) return fmt(n / 1e9, 2, 0) + 'B';
    if (a >= 1e6) return fmt(n / 1e6, 2, 0) + 'M';
    if (a >= 1e4) return fmt(n / 1e3, 1, 0) + 'k';
    return fmt(n);
  };
  const people = (n) => n == null || !isFinite(n) ? '—' : fmt(Math.round(n / 100) * 100);
  const dur = (h) => {
    if (h == null || !isFinite(h)) return t('never');
    if (h < 1) return Math.max(1, Math.round(h * 60)) + ' min';
    // round to whole hours first, so 4d 23.6h reads "5d", never "4d 24h"
    const H = Math.round(h), d = Math.floor(H / 24), hh = H - d * 24;
    return d ? (hh ? `${d}d ${hh}h` : `${d}d`) : `${H}h`;
  };
  // time left, rounded down like the countdown (2d 18h 59m -> "2d 18h")
  const durDown = (h) => {
    if (h == null || !isFinite(h)) return '—';
    if (h < 1) return Math.max(0, Math.floor(h * 60)) + ' min';
    const d = Math.floor(h / 24), hh = Math.floor(h - d * 24);
    return d ? `${d}d ${hh}h` : `${hh}h`;
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clean = (s) => esc(String(s ?? '').replace(/<\/?i(=\d+)?>/g, ''));
  // API texts are requested in English; if an object with every language ever comes back, take English
  const txt = (m) => m && typeof m === 'object' ? (m['en-US'] || m['en-GB'] || m.en || Object.values(m)[0] || '') : (m || '');
  const fill = (str, params) => String(str).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
  const listJoin = (a) => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const facName = (f) => esc(t('fac')[f] || f || '');
  const facPlural = (f) => esc(t('facPl')[f] || t('fac')[f] || f || '');
  const planetName = (p) => p ? esc(txt(p.name) || ('#' + p.index)) : '—';
  const factionOfPlanet = (p) => p ? (p.event ? p.event.faction : p.currentOwner) : null;
  let clockUTC = false;   // set while the share image is drawn
  const clock = (hoursFromNow) => {
    const d = new Date((last ? last.now : Date.now()) + hoursFromNow * 3.6e6);
    // the share image is read all over the world: UTC there
    if (clockUTC) return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
    return d.toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  };

  /* ---------- settings ---------- */
  const settings = Object.assign({ capMode: 'auto', capacity: ENGINE.DEFAULTS.capacity, dssBonus: ENGINE.DEFAULTS.dssBonus,
    hodMult: ENGINE.DEFAULTS.hodMult, recordShare: ENGINE.DEFAULTS.recordShare, contact: 'ministry-of-victory-user', motion: 'full' }, store.get('settings', {}));
  // 1.3 was the old default for Heavy Ordnance, measured on one order; the war log since 2025 says x1.8
  if (settings.hodMult === 1.3) settings.hodMult = ENGINE.DEFAULTS.hodMult;
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => settings.motion === 'reduced' || mq.matches;

  /* ---------- enemy / item names (best effort) ---------- */
  const names = { enemies: store.get('names.enemies', null), items: store.get('names.items', null), strats: store.get('names.strats', null) };
  async function loadNames(force = false) {
    const age = Date.now() - store.get('names.t', 0);
    if (names.enemies && names.items && age < (force ? 15 * 60e3 : 24 * 3600e3)) return;
    try {
      const [enemyList, itemList, py] = await Promise.all([
        fetch(NAMES.enemies).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(NAMES.items).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(NAMES.strats).then(r => r.ok ? r.text() : null).catch(() => null),
      ]);
      if (enemyList) { names.enemies = Object.fromEntries(Object.entries(enemyList).map(([k, v]) => [k, v.plural || v.name])); store.set('names.enemies', names.enemies); }
      if (itemList) { names.items = Object.fromEntries(Object.entries(itemList).map(([k, v]) => [k, v.name])); store.set('names.items', names.items); }
      if (py) {
        const block = py.split('STRATAGEM_ID_DICT')[1] || '';
        const s = {};
        for (const m of block.slice(0, block.indexOf('}')).matchAll(/(\d+)\s*:\s*"([^"]+)"/g)) s[m[1]] = m[2];
        names.strats = s; store.set('names.strats', s);
      }
      store.set('names.t', Date.now());
    } catch {}
  }
  // a name the lists don't have yet (a brand-new weapon or enemy): plain words, never a raw id
  const itemKnown = (id) => id ? (names.items?.[id] || names.strats?.[id] || null) : null;
  const itemName = (id) => id ? (itemKnown(id) || t('itemAny')) : null;
  const enemyName = (id) => id ? (names.enemies?.[id] || t('enemyAny')) : null;
  const unknownNames = (results) => results.some(({ res }) => res.tasks.some(r =>
    (r.task.itemId && !(names.items?.[r.task.itemId] || names.strats?.[r.task.itemId])) || (r.task.enemyId && !names.enemies?.[r.task.enemyId])));

  /* ---------- API ---------- */
  // The API translates briefings and names into the language the browser asks for (an Italian browser
  // got Italian briefings). `culture` in the query wins over the browser's Accept-Language, and the
  // header is set as well; both are "simple" for CORS, so no preflight is needed.
  const apiUrl = (path) => `${API}${path}${path.includes('?') ? '&' : '?'}culture=en-US&ui-culture=en-US&x-super-client=ministry-of-victory&x-super-contact=${encodeURIComponent(settings.contact || 'ministry-of-victory-user')}`;
  // The API allows 5 requests every 10 seconds per address, and refuses the rest (HTTP 429).
  // Requests wait for a free slot here instead (and a refused one is tried again once, 10 s later).
  // Sliding window: never more than 5 requests in any 11 seconds, so the server's bucket can't run dry.
  // The timestamps are kept across reloads, so refreshing the page can't burst past the limit either.
  const sentKey = 'mov-sent';
  const sent = (() => { try { return (JSON.parse(localStorage.getItem(sentKey)) || []).filter(x => typeof x === 'number' && Date.now() - x < 11000).sort((a, b) => a - b); } catch (e) { return []; } })();
  const saveSent = () => { try { localStorage.setItem(sentKey, JSON.stringify(sent)); } catch (e) { } };
  const WINDOW_MS = window.__mockScenario && !window.__mockRealRate ? 200 : 11000;   // tests run fast
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));
  const freeSlots = () => { const now = Date.now(); return 5 - sent.filter(t0 => now - t0 < WINDOW_MS).length; };
  async function slot() {
    for (;;) {
      const now = Date.now();
      while (sent.length && now - sent[0] >= WINDOW_MS) sent.shift();
      if (sent.length < 5) { sent.push(now); saveSent(); return; }
      await sleep(sent[0] + WINDOW_MS - now + 20);
    }
  }
  async function getJSON(path, timeoutMs = 20000, retry = 2) {
    await slot();
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(apiUrl(path), { cache: 'no-store', headers: { 'Accept-Language': 'en-US' }, signal: ctrl ? ctrl.signal : undefined });
      if (r.status === 429 && retry > 0) {
        clearTimeout(timer);
        const ra = Number(r.headers.get('Retry-After'));
        await sleep(ra > 0 && ra < 60 ? ra * 1000 + 300 : 10500);
        return getJSON(path, timeoutMs, retry - 1);
      }
      if (!r.ok) throw new Error(`HTTP ${r.status} ${path}`);
      return await r.json();
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error(`timeout ${path}`);
      throw e;
    } finally { clearTimeout(timer); }
  }
  // things that change slowly are fetched again only every few minutes
  const memo = {};
  async function getCached(path, maxAgeMs, timeoutMs) {
    const m = memo[path];
    if (m && Date.now() - m.t < maxAgeMs) return m.data;
    const data = await getJSON(path, timeoutMs);
    memo[path] = { t: Date.now(), data };
    return data;
  }

  /* ---------- state ---------- */
  let samples = store.get('samples', []);
  let last = null, busy = false, lastRun = 0, lastOk = 0, lastStack = '', firstDone = false;
  const ui = Object.assign({ order: null, tab: {}, sim: {}, pace: {}, showNums: false, briefOpen: {}, intelOpen: {}, simOpen: {}, crossOpen: false, histMode: {}, chartOff: {} }, store.get('ui', {}));
  const saveUi = () => store.set('ui', { order: ui.order, tab: ui.tab, showNums: ui.showNums });
  const prev = { bars: {}, count: {}, dir: {}, verdict: {}, seen: {} };
  const $ = (id) => document.getElementById(id);
  // An order is identified by its id *and* its task list: if Super Earth edits an order in place,
  // its pace history starts over instead of mixing old and new objectives.
  const hashStr = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const orderKey = (a) => `${a.id}:${hashStr(JSON.stringify((a.tasks || []).map(tk => [tk.type, tk.values, tk.valueTypes])))}`;
  let known = new Set(store.get('known', []));   // orders this browser has already shown
  const fresh = new Set();                       // orders that arrived while the page was open
  let dragging = false, pendingRender = false;

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
  async function loadRecord(now) {
    if (now - recordFetched < 5 * 60e3) return false;
    recordFetched = now;
    try {
      const [intel, recent, prog] = await Promise.all(['intel.json', 'recent.json', 'progress.json'].map(f =>
        fetch(RECORD + f + '?t=' + Math.floor(now / 300e3), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)));
      if (intel && Array.isArray(intel.alerts)) {
        record = { t: intel.updated, since: intel.since, every: intel.every || 10, alerts: intel.alerts, effects: intel.effects || [], inf: intel.inf || null, official: !!intel.official, K: intel.K || null, impN24: intel.impN24 || null, orders: intel.orders || {}, so: intel.so || [] };
        store.set('record', record);
      }
      if (prog && prog.orders) { recordProgress = prog; saveRecap(); }
      if (recent && Array.isArray(recent.samples)) recordSamples = recent.samples.map(x => ({ t: x.t, N: x.N, imp: x.imp, dss: x.dss, hod: x.hod, rec: true,
        planets: Object.fromEntries(Object.entries(x.pl || {}).map(([i, v]) => [i, { h: v[0], p: v[1], w: v[8] ?? null }])), prog: x.prog || {} }))
        // older progress only (no planets), so a full day of pace is known on a first visit
        .concat((recent.prog || []).filter(x => !recent.samples.length || x.t < recent.samples[0].t).map(x => ({ t: x.t, rec: true, planets: {}, prog: x.prog || {} })));
      return true;
    } catch { return false; }
  }
  // Plan B: when the community API can't be reached, the recorder's last copy of the war (taken from
  // the community API, or from the game's official API when that one is down too) stands in for it.
  let apiDown = false, stale = null;
  async function loadLive() {
    try {
      const r = await fetch(RECORD + 'live.json?t=' + Math.floor(Date.now() / 60e3), { cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      if (!j || j.v !== 1 || !j.war || !Array.isArray(j.assignments) || Date.now() - j.t > 6 * 3600e3) return null;
      return j;
    } catch { return null; }
  }
  // the recorder's snapshots fill the holes in this browser's own history
  function mergeRecord(list) {
    if (!recordSamples.length) return list;
    const mine = list.filter(x => !x.rec);
    const add = recordSamples.filter(r => !mine.some(x => Math.abs(x.t - r.t) < 90e3));
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
    const foeName = foe && names.enemies?.[foe] ? esc(names.enemies[foe]) : null;
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
      case 32: return fill(L.permit, { item: esc(itemKnown(item) || t('aStratagem')) });
      case 72: return pctv - 100 > 0 ? fill(foeName ? L.spawnMore : L.spawnMoreAny, { foe: foeName, x: boost(pctv) }) : fill(L.spawnLess, { foe: foeName || L.someFoe });
      case 40: return foeName ? fill(L.division, { foe: foeName }) : L.divisionAny;
      case 21: return L.extract;
      case 36: return fill(L.cooldown, { item: esc(itemKnown(item) || t('aStratagem')), x: signed(pctv || 0) });
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
  function renderIntel(entry) {
    const box = $('intel');
    if (!entry) { box.innerHTML = ''; return; }
    const { items, news: ns, rel } = intelFor(entry);
    if (!items.length && !ns.length) { box.innerHTML = ''; return; }
    const sorted = [...items].sort((a, b) => prioOf(a) - prioOf(b) || b.t - a.t);
    const top = sorted.find(x => prioOf(x) < 5);
    const n = items.length + ns.length;
    const short = top ? alertText(top, true, rel) : ns.length ? fill(t('in.s.news'), { title: esc(ns[0].title) }) : alertText(sorted[0], true, rel);
    const more = n > 1 ? `<span class="more">${fill(t('in.more'), { n: n - 1 })}</span>` : '';
    const level = top && (top.kind === 'setback' || top.kind === 'attack') ? 'bad' : top ? 'warn' : 'info';
    const li = sorted.map(x => `<li class="k-${x.kind} ${x.kind === 'active' || x.kind === 'effect' ? (WAR_FX.has(x.type) ? 'war' : 'perk') : ''}"><span class="when">${esc(x.kind === 'active' ? t('in.now') : ago(x.t))} · <span class="tag">${esc(tagOf(x))}</span></span><p>${alertText(x, false, rel)}</p></li>`).join('');
    const nl = ns.map(d => `<li class="k-news ${d.hit ? 'hit' : ''}"><span class="when">${esc(t('in.news'))} · ${esc(ago(d.t))}</span><p><b>${esc(d.title)}</b> ${clean(d.body).slice(0, 320)}</p></li>`).join('');
    const rec = record && record.since ? fill(t('in.recorded'), { n: record.every || 10, when: new Date(record.since).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }) : t('in.noRecord');
    box.innerHTML = `<details class="cmdintel v-${level}" data-intelstrip ${ui.intelStripOpen ? 'open' : ''}>
      <summary><span class="label">${t('in.label')}</span><span class="xs">${short}</span>${more}${ICON.chev}</summary>
      <ul>${li}${nl}</ul><p class="note">${esc(t('in.note'))} ${esc(rec)}</p></details>`;
  }

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
    const timeline = `<div class="it-line" role="img" aria-label="${esc(t('it.lineAria'))}">
      <div class="it-track">${ticks.map(tt => `<span class="it-tick" style="left:${posX(tt)}%"><i></i>${esc(new Date(tt).toLocaleString(locale(), { weekday: 'short' }) + ' ' + String(new Date(tt).getHours()).padStart(2, '0') + ':00')}</span>`).join('')}
        ${events.map((x, i) => `<button type="button" class="it-dot lv-${levelOf(x)} ${x.kind === 'news' ? 'nk-' + x.nk : ''}" style="left:${posX(x.t)}%" data-ifocus="it-${i}" title="${esc(plain(x.kind === 'news' ? x.title : alertText(x, true, rel)))}">${ICON[x.kind === 'news' ? NEWS_ICON[x.nk] : KIND_ICON[x.kind]] || ''}</button>`).join('')}
        <span class="it-now" style="left:100%">${esc(t('h.now'))}</span></div></div>`;
    const card = (x, i) => {
      const lv = levelOf(x), sure = x.kind === 'jump' || x.kind === 'setback' ? 'lens' : 'data';
      if (x.kind === 'news') return `<article class="it-card lv-info news nk-${x.nk} ${x.hit ? 'hit' : ''}" id="it-${i}">
        <span class="it-ico">${ICON[NEWS_ICON[x.nk]]}</span><div class="it-body"><div class="it-top"><h5>${esc(titleCase(x.title))}</h5><span class="it-when">${esc(ago(x.t))}</span></div>
        ${x.body ? `<details class="it-more"><summary>${esc(t('it.read'))}</summary><p>${clean(x.body)}</p></details>` : ''}</div></article>`;
      const key = keyLine(x, rel);
      return `<article class="it-card lv-${lv}" id="it-${i}">
        <span class="it-ico">${ICON[KIND_ICON[x.kind]] || ''}</span>
        <div class="it-body"><div class="it-top"><h5>${alertText(x, true, rel)}</h5><span class="it-when">${esc(x.kind === 'active' ? t('in.now') : x.ref === 'briefing' && !x.merged ? t('it.sinceLaunch') : ago(x.t))}</span></div>
          ${key ? `<p class="it-key">${key}</p>` : ''}${sparkHTML(x)}
          <div class="it-foot"><span class="it-sure ${sure}" title="${esc(t(sure === 'lens' ? 'it.deducedT' : 'it.dataT'))}">${ICON[sure]}${esc(tagOf(x))}</span>
            <details class="it-more"><summary>${esc(t(sure === 'lens' ? 'it.why' : 'it.details'))}</summary><p>${alertText(x, false, rel)}</p></details></div></div></article>`;
    };
    const cmd = events.filter(x => x.kind !== 'news');
    const counts = [cmd.length ? fill(t(cmd.length === 1 ? 'it.n1' : 'it.n'), { n: cmd.length }) : null, active.length ? fill(t('it.nActive'), { n: active.length }) : null, ns.length ? fill(t('it.nNews'), { n: ns.length }) : null].filter(Boolean);
    const quiet = !cmd.length && !active.length;
    return `<div class="intel-tab">
      <div class="it-head"><div><h3>${esc(t('it.title'))}</h3>${counts.length ? `<p>${counts.join(' · ')}</p>` : ''}</div>
        <div class="it-legend"><span class="it-sure data">${ICON.data}${esc(t('in.tag.data'))}</span><span class="it-sure lens">${ICON.lens}${esc(t('in.tag.deduced'))}</span></div></div>
      ${events.length ? timeline : ''}
      ${quiet && !ns.length ? `<div class="it-quiet"><span class="radar"></span><p>${esc(t('allQuiet'))}</p></div>` : `<div class="it-cols">
        <section class="it-col"><span class="label">${esc(t('it.cmd'))}</span>
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
      for (const [i, p] of Object.entries(planets)) sample.planets[i] = { h: p.event ? p.event.health : p.health, p: p.statistics?.playerCount || 0, w: p.statistics?.missionsWon ?? null };
      for (const a of assignments || []) sample.prog[orderKey(a)] = a.progress;
      await recP;
      samples = mergeRecord(samples.filter(s => now - s.t < KEEP_MS));
      if (!live && (!samples.length || now - samples[samples.length - 1].t > 30e3)) samples.push(sample);
      if (samples.length > 3000) samples = samples.slice(-3000);
      store.set('samples', samples);

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
      if (seed) { if (last && !firstDone) { firstDone = true; bootFinish('ok'); } return; }
      try { renderErrors(errors); } catch (e2) { console.error(e2); }
      lastRun = Date.now();
      busy = false;
      $('refresh').classList.remove('busy');
      if (!firstDone) { firstDone = true; bootFinish(last ? 'ok' : 'fail'); }
      if (!last && errors.length) { $('view').innerHTML = ''; document.title = `${t('offline')} · Ministry of Victory`; }
      tick();
    }
  }
  window.addEventListener('error', (ev) => { lastStack = String(ev.error && ev.error.stack || ev.message); try { renderErrors([String(ev.message)]); } catch {} });
  window.addEventListener('unhandledrejection', (ev) => { const r = ev.reason; lastStack = String(r && r.stack || r); try { renderErrors([String(r && r.message || r)]); } catch {} });

  /* ---------- errors ---------- */
  const embedded = (() => { try { return window.top !== window.self; } catch { return true; } })();
  function renderErrors(errs) {
    if (!errs.length) { $('errors').innerHTML = ''; return; }
    const blocked = errs.some(e => /failed to fetch|networkerror|load failed|blocked/i.test(e));
    const help = blocked ? `<div class="help"><p><b>${esc(t('helpTitle'))}</b></p><ol>
        ${embedded ? `<li>${esc(t('helpPreview'))}</li>` : ''}
        <li>${esc(t('helpBrowser'))}</li><li>${esc(t('helpBlocker'))}</li>
        <li>${esc(t('helpTest'))} <a href="${esc(apiUrl('/api/v1/war'))}" target="_blank" rel="noopener">${esc(API)}/api/v1/war</a></li></ol></div>` : '';
    const tech = lastStack ? `<details class="tech"><summary>${esc(t('techDetails'))}</summary><pre>${esc(lastStack)}</pre></details>` : '';
    $('errors').innerHTML = `<div class="err">${esc(fill(t('errApi'), { e: [...new Set(errs)].join(', ') }))}${help}${tech}</div>`;
  }

  /* ---------- small components ---------- */
  const ICON = {
    image: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.2" y="2" width="9.6" height="8" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 9l2.6-3 2 2 1.4-1.4L10 9" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="4.4" r=".9" fill="currentColor"/></svg>',
    check: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="2"/></svg>',
    target: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="6" r="1.2" fill="currentColor"/></svg>',
    warn: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5L11 10.5H1z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 5v2.5" stroke="currentColor" stroke-width="1.6"/></svg>',
    cross: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="2"/></svg>',
    dots: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/></svg>',
    copy: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 2H1.5v6.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    chev: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    up: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10V2M2.5 5.5L6 2l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    down: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2.5 6.5L6 10l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    shield: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1l4.5 1.6v3.2C10.5 8.4 8.6 10.3 6 11 3.4 10.3 1.5 8.4 1.5 5.8V2.6z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    regen: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M10 6a4 4 0 1 1-1.2-2.9M10 1.5v2.4H7.6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    edit: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 10l.6-2.6L8.2 1.8l2 2-5.6 5.6zM7 3l2 2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    fx: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1l1.3 3.7L11 6 7.3 7.3 6 11 4.7 7.3 1 6l3.7-1.3z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    trophy: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1.5h5v3a2.5 2.5 0 0 1-5 0zM3.5 2.5H1.5c0 1.6.8 2.6 2.2 2.8M8.5 2.5h2c0 1.6-.8 2.6-2.2 2.8M6 7v2M4 10.5h4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    box: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 3.5L6 1.5l4.5 2v5L6 10.5l-4.5-2zM1.5 3.5L6 5.5l4.5-2M6 5.5v5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    flag: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 11V1.5M2.5 2h7l-1.6 2.2L9.5 6.5h-7" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    news: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 3.5L9 1v10L1.5 8.5zM9 4.5h1.5v3H9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    data: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><ellipse cx="6" cy="3" rx="4" ry="1.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 3v6c0 .9 1.8 1.6 4 1.6s4-.7 4-1.6V3M2 6c0 .9 1.8 1.6 4 1.6S10 6.9 10 6" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    lens: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><circle cx="5" cy="5" r="3.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7.5 7.5L11 11" stroke="currentColor" stroke-width="1.6"/></svg>',
  };
  const VICON = { done: 'check', ontrack: 'check', effort: 'plus', focus: 'target', hard: 'warn', record: 'warn', nearly_impossible: 'cross', impossible: 'cross', failed: 'cross', unknown: 'dots' };
  const pill = (v) => `<span class="pill v-${v}">${ICON[VICON[v] || 'dots']}${esc(t('v.' + v))}</span>`;
  const medalSvg = '<svg class="medal" viewBox="0 0 26 26" aria-hidden="true"><path d="M8 1h10l-2 8h-6z" fill="var(--info)"/><circle cx="13" cy="16" r="8" fill="none" stroke="var(--yellow)" stroke-width="2"/><path d="M13 11.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="var(--yellow)"/></svg>';

  function taskText(r) {
    const tk = r.task, n = big(tk.goal);
    // "Liberate 1 planet", not "1 planets"
    const fillN = (key, params) => fill(tk.goal === 1 && t(key + '1') !== key + '1' ? t(key + '1') : t(key), params);
    const sector = tk.sectorIndex != null && last && last.sectorName ? last.sectorName[tk.sectorIndex] : null;
    const where = r.planet ? ` ${t('on')} ${planetName(r.planet)}` : sector ? ` ${fill(t('inSector'), { s: esc(sector) })}` : tk.sectorIndex != null ? ` ${t('inASector')}` : '';
    const fac = tk.faction && tk.faction !== 'Humans' ? tk.faction : null;
    const diff = tk.minDifficulty ? ` (${fill(t('minDiff'), { d: tk.minDifficulty })})` : '';
    switch (tk.type) {
      case 3: {
        const target = tk.enemyId ? esc(enemyName(tk.enemyId)) : (fac ? facPlural(fac) : t('enemies'));
        const item = tk.itemId ? ` ${t('with')} ${esc(itemName(tk.itemId))}` : '';
        return `${t('kill')} ${n} ${target}${item}${where}${diff}`;
      }
      case 1: return fillN('extractN', { n }) + (fac ? ` · ${facName(fac)}` : '') + where + diff;
      case 2: return `${t('extract')} ${n} ${tk.itemId ? esc(itemName(tk.itemId)) : t('samples')}${where}`;
      case 4: return fillN('objectives', { n }) + where + diff;
      case 5: return fillN('play', { n }) + where + diff;
      case 6: return fillN('use', { item: esc(itemName(tk.itemId) || ''), n }) + where;
      case 7: return fillN('missions', { n }) + (fac ? ` · ${facName(fac)}` : '') + where + diff;
      case 9: return fillN('operations', { n }) + (fac ? ` · ${facName(fac)}` : '') + where + diff;
      case 10: return fill(t('donate'), { n, item: tk.itemId ? esc(itemName(tk.itemId)) : t('resources') });
      case 11: return fill(t('liberate'), { p: planetName(r.planet) });
      case 12: return fillN('defendN', { n }) + (fac ? ` · ${facName(fac)}` : '');
      case 13: return fill(t('hold'), { p: planetName(r.planet) });
      case 14: return (fac ? fillN('liberateNf', { n, f: facName(fac) }) : fillN('liberateN', { n })) + where;
      case 15: return t('net');
      default: return fill(t('unknownTask'), { n: tk.type }) + (tk.goal ? ` (${n})` : '');
    }
  }
  const crowdText = (need, now) => {
    const r = now > 0 ? need / now : 99, c = t('crowd');
    return r < 1.15 ? c[0] : r < 1.6 ? c[1] : r < 2.4 ? c[2] : r < 3.5 ? c[3] : c[4];
  };
  // bar helper: widths animate from the previous value (data-key) to the new one
  const barFill = (key, frac, cls = 'fill') => `<div class="${cls}" data-key="${esc(key)}" data-w="${Math.max(0, Math.min(1, frac || 0)) * 100}"></div>`;

  /* ---------- HUD ---------- */
  function renderHud() {
    const Ls = last;
    const dssP = Ls.dssIdx != null ? Ls.planets[Ls.dssIdx] : null;
    $('hud-stats').innerHTML = `
      <div class="stat" title="${esc(t('players'))}"><span class="label">${t('players')}</span><span class="v"><i class="live ${Ls.stale ? 'warn' : ''}"></i><span data-count="players" data-to="${Ls.N}">${fmt(Ls.N)}</span><small class="m-only"> ${t('online')}</small></span></div>`;
  }

  /* ---------- order tabs ---------- */
  function renderOrderTabs() {
    const rs = last.results;
    if (!rs.length) { $('order-tabs').innerHTML = ''; return; }
    $('order-tabs').hidden = rs.length < 2;
    if (!rs.some(x => String(x.a.id) === String(ui.order))) ui.order = String(rs[0].a.id);
    fresh.delete(String(ui.order));
    // forget the tabs of orders that are gone
    for (const k of Object.keys(ui.tab)) if (!rs.some(x => String(x.a.id) === k)) delete ui.tab[k];
    saveUi();
    $('order-tabs').innerHTML = rs.map(({ a, res }, i) => {
      const sel = String(a.id) === String(ui.order);
      return `<button type="button" role="tab" class="otab ${fresh.has(String(a.id)) ? 'is-new' : ''}" id="otab-${esc(a.id)}" data-otab="${esc(a.id)}" aria-selected="${sel}" tabindex="${sel ? 0 : -1}">
        <span class="k"><i class="dot v-${res.verdict}"></i>${fill(t('order'), { n: i + 1 })}<span class="kv-v"> · ${esc(t('v.' + res.verdict))}</span>${fresh.has(String(a.id)) ? `<span class="new-tag">${t('newTag')}</span>` : ''}</span>
        <span class="n">${clean(txt(a.title) || 'Major Order')}</span><span class="idx">${i + 1}</span></button>`;
    }).join('');
  }

  // "kills" when every counted objective is a kill count, otherwise the neutral "objectives"
  const counterNoun = (res) => res.tasks.filter(r => r.counter && !r.simpleCount).every(r => r.task.type === 3) ? t('what')[3] : t('what')[0];

  /* ---------- directive (the ONE thing) ---------- */
  function directiveParts(res) {
    const d = res.directive || { kind: 'steady' };
    const D = t('d');
    let kicker = '', target = '', why = '', fac = null, meter = '', ring = null, planet = null, cap = '', req = '';
    const projTxt = d.proj != null ? projPct(d.proj) : '—';
    // players there now vs players needed; `where` says where ("on Fury", "on the Terminid front")
    const meterPips = (now, need, where, weaponUse = false, needKey = null) => {
      if (need == null || !isFinite(need)) return '';
      const N = res.model.N || 0;
      const ok = now >= need * 0.98, tooMany = N && need > N;
      const on = Math.max(0, Math.min(20, Math.round((need > 0 ? now / need : 1) * 20)));
      const pips = Array.from({ length: 20 }, (_, i) => `<i class="pip ${i < on ? 'on' : ''} ${ok && i < on ? 'ok' : ''}" style="--i:${i}"></i>`).join('');
      const left = (n) => fill(t('meterNow'), { n, where });
      const times = N ? fmt(need / N, need / N < 10 ? 1 : 0) : '';
      const right = (n) => ok ? t('meterEnough')
        : fill(t(tooMany ? 'meterAll' : 'meterNeed'), { n, x: times }) + (weaponUse ? t('meterWeapon') : '');
      cap = plainCap(`${left(people(now))} · ${right(people(need))}`);
      const rightNoW = (n) => ok ? t('meterEnough') : fill(t(needKey && !tooMany ? needKey : tooMany ? 'meterAll' : 'meterNeed'), { n, x: times });
      return `<div class="dir-meter" ${weaponUse ? `title="${esc(t('meterWeaponTip'))}"` : ''}><div class="pips" aria-hidden="true">${pips}</div>
        <div class="cap"><span>${left(`<b>${people(now)}</b>`)}</span><span>${rightNoW(`<b>${people(need)}</b>`)}${weaponUse && !ok ? ` <button type="button" class="q" data-tipq="${esc(t('meterWeaponTip'))}" aria-label="${esc(t('meterWeaponTip'))}">?</button>` : ''}</span></div></div>`;
    };
    const meterProj = (r) => {
      const tk = r.task, frac = tk.goal ? Math.min(1, tk.progress / tk.goal) : 0;
      const pf = r.projection != null && tk.goal ? Math.min(1, r.projection / tk.goal) : null;
      const right = d.measuring ? t('s.cWait') : fill(t('meterProj'), { p: `<b>${projTxt}</b>` });
      cap = `${fill(t('s.progress'), { p: pct(frac) })} · ${d.measuring ? t('s.cWait') : fill(t('meterProj'), { p: projTxt })}`;
      return `<div class="dir-meter"><div class="bar" style="height:16px">
          ${pf != null && pf > frac ? `<div class="proj" style="left:${frac * 100}%;width:${(pf - frac) * 100}%"></div>` : ''}${barFill(`dir:${res.id}`, frac)}<div class="goal"></div></div>
        <div class="cap"><span>${fill(t('s.progress'), { p: `<b>${pct(frac)}</b>` })}</span><span>${right}</span></div></div>`;
    };
    const taskRing = (r) => r && r.task && r.task.goal ? { frac: Math.min(1, r.task.progress / r.task.goal), label: t('what')[r.task.type] ? fill(t('gProgW'), { what: t('what')[r.task.type] }) : t('gProg'), tone: 'cnt' } : null;
    const libRing = (p) => p && p.maxHealth ? { frac: Math.max(0, Math.min(1, 1 - p.health / p.maxHealth)), label: t('gLib'), tone: 'lib' } : null;
    switch (d.kind) {
      case 'liberate': {
        planet = d.planet; fac = factionOfPlanet(d.planet);
        kicker = D.liberate.k; target = txt(d.planet.name);
        let v = d.variant;
        if (v === 'more' && d.wasted >= 1000) v = 'moreWasted';
        if (v === 'win' && (d.remaining || 1) <= 1) v = 'winLast';
        if (v === 'n') v = d.verdict === 'impossible' ? 'nImp' : d.left === 1 ? 'n1' : 'n';
        why = fill(D.liberate.why[v] || D.liberate.why.more, { when: d.hours != null ? clock(d.hours) : '', crowd: crowdText(d.need, d.now), planet: planetName(d.planet), left: fmt(d.left) })
          + (d.region ? fill(D.liberate.region, { region: esc(d.region) }) : '');
        meter = meterPips(d.now, d.need, fill(t('onPlanet'), { p: planetName(d.planet) }), false, d.variant === 'win' ? 'meterFocus' : null); ring = libRing(d.planet);
        break;
      }
      case 'defend': {
        planet = d.planet; fac = factionOfPlanet(d.planet); kicker = D.defend.k; target = txt(d.planet.name);
        why = fill(D.defend.why, { when: clock(d.hours) }); meter = meterPips(d.now, d.need, fill(t('onPlanet'), { p: planetName(d.planet) }));
        const e = d.planet.event; ring = e && e.maxHealth ? { frac: Math.max(0, Math.min(1, 1 - e.health / e.maxHealth)), label: t('gDef'), tone: 'lib' } : null;
        break;
      }
      case 'front': {
        fac = d.faction; kicker = D.front.k; target = fill(D.front.target, { f: t('fac')[d.faction] || d.faction });
        const ahead = d.aheadFrom || [], idle = d.idleFrom || [];
        const tt = d.task ? d.task.task.type : 3;
        why = fill(D.front.why, { f: facName(d.faction), what: t('what')[tt] || t('what')[0], proj: projTxt })
          + (ahead.length ? fill(D.front.whyFrom, { from: listJoin(ahead.map(facName)), what: counterNoun(res) }) : '');
        if (d.task && tt === 3 && d.task.task.itemId) req = itemName(d.task.task.itemId);
        meter = meterPips(d.now, d.need, fill(t('onFront'), { f: facName(d.faction) }), !!(d.task && tt === 3 && d.task.task.itemId));
        ring = taskRing(d.task); break;
      }
      case 'weapon':
        fac = d.faction; kicker = D.weapon.k; target = itemName(d.item) || '';
        why = d.measuring ? D.measuring : fill(D.weapon.why, { proj: projTxt }); meter = meterProj(d.task); ring = taskRing(d.task); break;
      case 'counter': {
        fac = d.faction; const tk = d.task.task;
        const enemyTarget = () => tk.enemyId ? enemyName(tk.enemyId) : (tk.faction ? (t('facPl')[tk.faction] || t('fac')[tk.faction]) : t('tgtEnemies'));
        const C = {
          3: [D.kill, enemyTarget],
          1: [D.extract, () => t('tgtExtractions')],
          2: [D.extract, () => tk.itemId ? itemName(tk.itemId) : t('tgtSamples')],
          4: [D.objectives, () => t('tgtObjectives')],
          5: [D.playN, () => t('tgtMissions')],
          6: [D.useItem, () => tk.itemId ? itemName(tk.itemId) : t('tgtGear')],
          7: [D.complete, () => t('tgtMissions')],
          9: [D.complete, () => t('tgtOps')],
          10: [D.donate, () => tk.itemId ? itemName(tk.itemId) : t('tgtResources')],
        }[tk.type] || [D.complete, () => t('tgtMissions')];
        kicker = C[0].k; target = C[1](); why = fill(C[0].why, { proj: projTxt });
        if (tk.type === 3 && tk.itemId) req = itemName(tk.itemId);
        if (d.measuring) why = D.measuring;
        meter = meterProj(d.task); ring = taskRing(d.task); break;
      }
      case 'waitDefense':
        fac = d.faction; kicker = D.waitDefense.k; target = D.waitDefense.target;
        why = fill(D.waitDefense.why, { left: fmt(d.left) }); break;
      case 'lost':
        kicker = D.lost.k; target = D.lost.target; why = D.lost.why; break;
      case 'ended':
        kicker = D.ended.k; target = D.ended.target; why = D.ended.why; break;
      case 'play': {
        const P = res.tasks.some(r => r.task.type === 15 && r.verdict !== 'done') ? D.net : D.play;
        kicker = P.k; target = P.target; why = P.why; break;
      }
      case 'done':
        kicker = D.done.k; target = D.done.target; why = D.done.why;
        meter = `<div class="dir-done"><div class="big-check">${ICON.check.replace('class="ico"', 'style="width:34px;height:34px"')}</div></div>`; break;
      default:
        kicker = D.steady.k; target = D.steady.target; why = D.steady.why;
    }
    const title = ['steady', 'lost'].includes(d.kind) ? target : d.kind === 'ended' ? `${kicker}: ${target}` : `${kicker} ${target}`;
    // the hero must agree with the forecast: a hard or hopeless order says so before telling you where to go
    const leadOk = !res.ended && !d.measuring && (['front', 'counter', 'weapon', 'defend'].includes(d.kind) || (d.kind === 'liberate' && !['nImp', 'partial'].includes(d.variant) && d.verdict !== 'impossible'));
    const lead = leadOk ? (t('lead')[res.verdict] || '') : '';
    return { d, kicker, target, why, fac, meter, ring, planet, cap, title, req, lead };
  }

  // a planet in the faction's colour, with the objective's progress as an orbit ring
  function surfaceSVG(seed) {
    let s = (Math.abs(Math.floor(seed)) % 233280) || 7;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const blobs = Array.from({ length: 10 }, () => ({ x: rnd() * 156, y: 46 + rnd() * 148, rx: 8 + rnd() * 30, ry: 3 + rnd() * 9, d: rnd() > 0.45 }));
    const copy = (off) => blobs.map(b => `<ellipse cx="${(42 + off + b.x).toFixed(1)}" cy="${b.y.toFixed(1)}" rx="${b.rx.toFixed(1)}" ry="${b.ry.toFixed(1)}" class="${b.d ? 'd' : 'l'}"/>`).join('');
    return copy(-156) + copy(0) + copy(156);
  }
  function globeHTML(p, res) {
    const r = p.ring;
    if (!r) return '';
    const id = 'gl' + String(res.id).replace(/[^\w-]/g, '');
    const seed = p.planet ? Number(p.planet.index) * 37 + 11 : String(p.fac || 'x').length * 131;
    const dss = !!(p.planet && last && last.dssIdx === p.planet.index);
    // the planet card has to announce itself: a visible label under the globe, pulsing until first opened
    const cp = cardPlanets({ res });
    const cta = cp ? `<span class="g-cta"><span class="g-cta-n">${planetName(cp.planet)}${cp.list && cp.list.length > 1 ? ` <small>+${cp.list.length - 1}</small>` : ''}</span><span class="g-cta-t">${esc(t('gCta'))} ›</span><span class="g-cta-s">${esc(t('gCtaS'))} ›</span></span>` : '';
    const fresh = cp && !store.get('pcSeen', false);
    return `<div class="globe ${r.tone} ${fresh ? 'g-new' : ''}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${esc(t('pc.open'))}" data-globe>
      <svg viewBox="0 0 240 240" focusable="false">
        <defs>
          <radialGradient id="${id}b" cx="34%" cy="30%" r="80%"><stop offset="0" class="g-s0"/><stop offset=".55" class="g-s1"/><stop offset="1" class="g-s2"/></radialGradient>
          <radialGradient id="${id}t" cx="32%" cy="28%" r="92%"><stop offset=".42" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>
          <radialGradient id="${id}a" cx="50%" cy="50%" r="50%"><stop offset=".8" class="g-a0"/><stop offset=".86" class="g-a1"/><stop offset="1" class="g-a0"/></radialGradient>
          <clipPath id="${id}c"><circle cx="120" cy="120" r="78"/></clipPath>
        </defs>
        <circle class="g-ticks" cx="120" cy="120" r="114"/>
        <circle class="g-track" cx="120" cy="120" r="103"/>
        <circle class="g-arc" cx="120" cy="120" r="103" pathLength="100" transform="rotate(-90 120 120)" data-ring="ring:${esc(res.id)}" data-frac="${(r.frac * 100).toFixed(2)}"/>
        <circle cx="120" cy="120" r="97" fill="url(#${id}a)"/>
        <circle cx="120" cy="120" r="78" fill="url(#${id}b)"/>
        <g clip-path="url(#${id}c)"><g class="g-surf">${surfaceSVG(seed)}</g></g>
        <circle cx="120" cy="120" r="78" fill="url(#${id}t)"/>
        ${dss ? `<g class="g-sat ${last.hod ? 'hod' : ''}"><path d="M120 6.5l6.5 6.5-6.5 6.5-6.5-6.5z"/></g>` : ''}
      </svg>
      <div class="g-val"><b>${pct(r.frac)}</b><span>${esc(r.label)}</span>${dss ? `<i>${esc(last.hod ? t('gDssHod') : t('gDss'))}</i>` : ''}</div>
      ${cta}
    </div>`;
  }

  /* ---------- planet card: hover (or tap) the planet in the order of the day ---------- */
  // Conditions and enemies come straight from the game (texts via github.com/helldivers-2/json);
  // the advice under them is ours, checked against the Helldivers Wiki (numbers noted where it has them).
  const G = (typeof GAME !== 'undefined') ? GAME : { env: {}, bio: {}, fx: {} };
  const envKey = (name) => Object.keys(G.env).find(k => (G.env[k].n || '').toLowerCase() === String(name || '').toLowerCase()) || null;
  const HZ_ICON = {
    extreme_cold: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />',
    intense_heat: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    acid_storms: '<path d="M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z"/>',
    ion_storms: '<path d="M13 2L5 13h6l-1 9 8-12h-6z"/>',
    sandstorms: '<path d="M3 8h12a3 3 0 1 0-3-3M3 13h16a3 3 0 1 1-3 3M3 18h8"/>',
    blizzards: '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15M8 19l1-2M13 21l1-2M18 19l1-2"/>',
    thick_fog: '<path d="M3 8h18M5 12h14M3 16h18M7 20h10"/>',
    rainstorms: '<path d="M6 14a4 4 0 0 1 1-8 5 5 0 0 1 10 1 3.5 3.5 0 0 1 0 7z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    tremors: '<path d="M2 12h4l2-5 3 10 3-12 3 9 2-2h3"/>',
    meteor_storms: '<circle cx="16" cy="16" r="4"/><path d="M3 3l10 10M8 3l6 6M3 8l6 6"/>',
    volcanic_activity: '<path d="M3 21l6-10h6l6 10z"/><path d="M10 7l-1-3M14 7l1-3M12 6V2"/>',
    fire_tornadoes: '<path d="M4 4h16M6 8h12M8 12h8M10 16h5M11 20h2"/>',
  };
  const hzIcon = (k) => `<svg class="hz-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 22 6.5v11L12 23 2 17.5v-11Z" class="hex"/><g transform="translate(6 6) scale(.5)">${HZ_ICON[k] || '<circle cx="12" cy="12" r="3"/>'}</g></svg>`;
  const HZ_TIP = {
    extreme_cold: ['A good planet for laser weapons: weapons that build heat cool about a third faster here. Rate of fire is about 10% lower.', 'wiki'],
    intense_heat: ['Maximum stamina is halved and weapons that build heat cool about a third slower: favour weapons that don\'t overheat, and a Stamina Enhancement booster.', 'wiki'],
    acid_storms: ['During a storm armor counts for less on both sides: enemies go down faster, and so do you. Keep stims ready.', 'game'],
    ion_storms: ['Stratagems cut out from time to time: call down support weapons and backpacks early, and don\'t count on a strike at the critical moment.', 'game'],
    sandstorms: ['Visibility drops a lot and movement slows: close-range weapons and a tight squad beat long-range picks.', 'game'],
    blizzards: ['Visibility and movement drop: fight closer, and keep the squad together.', 'game'],
    thick_fog: ['Visibility drops a little: enemies show up closer than usual.', 'game'],
    rainstorms: ['Visibility drops; nothing else changes.', 'game'],
    tremors: ['Quakes stun everyone, enemies too: use them to break contact rather than to aim.', 'game'],
    meteor_storms: ['Meteor strikes deal massive damage: don\'t hold still in the open.', 'game'],
    volcanic_activity: ['Burning rocks rain down: armor with fire resistance (the Inflammable passive) cuts the damage.', 'game'],
    fire_tornadoes: ['Fire tornadoes sweep the map: give them room; armor with fire resistance (the Inflammable passive) cuts the damage.', 'game'],
  };
  const FAC_TIP = {
    Terminids: 'Swarms plus big armored bugs: bring crowd control (fire, gas, explosives) and at least one anti-tank weapon in the squad.',
    Automaton: 'Armored walkers, tanks and gunships: a primary that pierces medium armor plus an anti-tank support weapon, and fight from cover.',
    Illuminate: 'Shielded Overseers and Harvesters behind hordes of Voteless: sustained fire to break shields, crowd control for the hordes.',
  };
  const DIV_TIP = [[/jet brigade/i, 'Jetpack troopers: hitting the jetpack brings them down.'], [/predator/i, 'Fast ambush hunters: stay together and favour close-range firepower.'],
    [/rupture/i, 'They burst out of the ground: keep moving.'], [/spore burst/i, 'They burst into spores when they die: kill them at a distance.'],
    [/incinerat/i, 'Flame troops: armor with fire resistance (the Inflammable passive) helps.'], [/dragonroach/i, 'They fly: bring a weapon that can hit targets in the air.']];
  const fxName = (id) => { const f = G.fx[String(id)]; return f && f.n ? f.n.replace(/\s*\((enemies)\)\s*$/i, '').trim() : null; };
  function planetCardHTML(p, entry, frontPlanets) {
    if (!p) return '';
    const res = entry.res, owner = factionOfPlanet(p), fac = owner && owner !== 'Humans' ? owner : (p.event ? p.event.faction : null);
    const m = p.event ? p.event.maxHealth : p.maxHealth, h = p.event ? p.event.health : p.health;
    const lib = m ? 1 - h / m : 0, regen = p.regenPerSecond && p.maxHealth ? p.regenPerSecond * 3600 / p.maxHealth : 0;
    const task = res.tasks.find(r => r.planet && r.planet.index === p.index);
    const fx = (record?.effects || []).filter(e => e.planets.includes(p.index) || e.planets.includes(-1));
    const permits = fx.filter(e => e.type === 32), divs = fx.filter(e => e.type === 40 || e.type === 72);
    const weapons = res.tasks.filter(r => r.verdict !== 'done' && r.task.itemId && (!r.task.faction || r.task.faction === fac)).map(r => itemName(r.task.itemId));
    const bioKey = p.biome && Object.keys(G.bio).find(k => G.bio[k].n === p.biome.name);
    const hz = (p.hazards || []).map(x => ({ k: envKey(x.name), name: x.name, d: x.description || (G.env[envKey(x.name)] || {}).d })).filter(x => x.k !== 'none' && x.k !== 'normal_temp');
    const spark = planetSeries(p.index).filter(q => last.now - q[0] < 24 * 3.6e6);
    const sp = spark.length > 2 ? (() => { const t0 = spark[0][0], t1 = spark[spark.length - 1][0], lo = Math.min(...spark.map(q => q[1])), hi = Math.max(...spark.map(q => q[1]), lo + 0.01);
      return `<svg class="pc-spark" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true"><path d="${spark.map((q, i) => `${i ? 'L' : 'M'}${((q[0] - t0) / Math.max(1, t1 - t0) * 120).toFixed(1)},${(28 - (q[1] - lo) / (hi - lo) * 26).toFixed(1)}`).join('')}" vector-effect="non-scaling-stroke"/></svg>`; })() : '';
    const tabs = frontPlanets && frontPlanets.length > 1 ? `<div class="pc-tabs" role="tablist">${frontPlanets.map(fp => `<button type="button" role="tab" data-pcplanet="${fp.index}" aria-selected="${fp.index === p.index}">${planetName(fp)} <small>${people(fp.statistics?.playerCount || 0)}</small></button>`).join('')}</div>` : '';
    const row = (icon, title, body, tip, src) => `<li><span class="pc-ic">${icon}</span><div><b>${title}</b>${body ? `<p>${body}</p>` : ''}${tip ? `<p class="tip"><i>›</i>${esc(tip)}${src ? ` <span class="src">${esc(t('pc.src.' + src))}</span>` : ''}</p>` : ''}</div></li>`;
    return `<div class="pcard fac-${esc(fac || 'none')}" role="dialog" aria-label="${esc(plain(planetName(p)))}">
      ${tabs}
      <button type="button" class="pc-x" data-pcclose aria-label="${esc(t('pc.close'))}">✕</button>
      <div class="pc-head"><span class="pc-hex"></span><div><h4>${planetName(p)}</h4><span class="pc-sub">${esc(fac ? fill(t('pc.held'), { f: plain(facName(fac)) }) : t('pc.ours'))}${p.sector ? ' · ' + esc(p.sector) : ''}</span></div></div>
      <div class="pc-stats">
        <div><span class="label">${esc(t(p.event ? 'pc.defended' : 'pc.lib'))}</span><b>${pct(lib, 1)}</b>${sp}</div>
        <div><span class="label">${esc(t('pc.players'))}</span><b>${people(p.statistics?.playerCount || 0)}</b></div>
        ${!p.event && regen ? `<div><span class="label">${esc(t('pc.regen'))}</span><b>${pct(regen, 1)}/h</b></div>` : ''}
        ${task && task.pw && isFinite(task.eta) ? `<div><span class="label">${esc(t('pc.falls'))}</span><b>${esc(task.eta <= res.hoursLeft ? clock(task.eta) : t('pc.late'))}</b></div>` : ''}
      </div>
      <span class="label pc-sec">${esc(t('pc.where'))}</span>
      <ul class="pc-list">
        ${p.biome ? row(hzIcon(null), esc(p.biome.name), esc((p.biome.description || (G.bio[bioKey] || {}).d || '').split(/(?<=\.)\s/)[0]), '', '') : ''}
        ${hz.length ? hz.map(x => row(hzIcon(x.k), esc(x.name), esc(x.d || ''), (HZ_TIP[x.k] || [])[0], (HZ_TIP[x.k] || [])[1])).join('') : `<li class="muted"><span class="pc-ic"></span><div><p>${esc(t('pc.noHz'))}</p></div></li>`}
      </ul>
      ${fac && FAC_TIP[fac] ? `<span class="label pc-sec">${esc(t('pc.enemy'))}</span><ul class="pc-list">
        ${row(`<span class="pc-fdot"></span>`, esc(plain(facPlural(fac))), '', FAC_TIP[fac], '')}
        ${divs.map(e => { const n = fxName(e.id) || effectLabel(e.type, e.v); const tip = (DIV_TIP.find(([re]) => re.test(n)) || [])[1]; return row(ICON.fx, esc(n), esc((G.fx[String(e.id)] || {}).d || ''), tip || '', ''); }).join('')}
      </ul>` : ''}
      ${weapons.length || permits.length ? `<span class="label pc-sec">${esc(t('pc.order'))}</span><ul class="pc-list">
        ${weapons.map(w => row(ICON.target, esc(w), esc(t('pc.reqS')), '', '')).join('')}
        ${permits.map(e => row(ICON.plus, esc(itemKnown(valOf(e.v, 4)) || fxName(e.id) || t('aStratagem')), esc(t('pc.freeS')), '', '')).join('')}
      </ul>` : ''}
      <p class="pc-foot">${esc(t('pc.foot'))}</p>
    </div>`;
  }
  // which planet the card shows: the target, or for a whole front its busiest planets
  function cardPlanets(entry) {
    const p = directiveParts(entry.res);
    if (p.planet) return { list: null, planet: p.planet };
    const fac = p.fac || (entry.res.directive && entry.res.directive.faction);
    if (!fac) return null;
    const list = Object.values(last.planets).filter(x => factionOfPlanet(x) === fac && x.currentOwner !== 'Humans' || (x.event && x.event.faction === fac))
      .sort((a, b) => (b.statistics?.playerCount || 0) - (a.statistics?.playerCount || 0)).slice(0, 3);
    if (!list.length) return null;
    const pick = list.find(x => String(x.index) === String(ui.pcPlanet)) || list[0];
    return { list, planet: pick };
  }

  function directiveHTML(res) {
    const p = directiveParts(res);
    const long = (p.target || '').length > 14;
    const showSim = !res.ended && ((p.d.kind === 'liberate' && res.liberation) || ((p.d.kind === 'front' || p.d.kind === 'weapon' || p.d.kind === 'counter') && !p.d.measuring));
    const globe = globeHTML(p, res);
    const tint = p.fac ? 'fac-' + esc(p.fac) : `k-${esc(p.d.kind)}`;
    return `<div class="area-dir"><section class="panel br directive ${globe ? 'has-globe' : ''} ${tint}" aria-labelledby="dir-${esc(res.id)}">
      <i class="hatch-rail l y" aria-hidden="true"></i>
      <div class="glow-clip" aria-hidden="true"><div class="glow"></div></div>
      <div class="dir-head"><span class="label"><i class="live"></i>${t('dirLabel')}</span>${p.fac ? `<span class="fchip">${facName(p.fac)}</span>` : ''}</div>
      <div class="dir-title">
        <div class="kicker">${esc(p.kicker)}</div>
        <h2 class="target ${long ? 'long' : ''}" id="dir-${esc(res.id)}" data-decrypt="${esc(p.target)}">${esc(p.target)}</h2>
        ${p.req ? `<p class="req-chip">${ICON.warn}<b>${esc(t('req'))}</b><span>${esc(p.req)}</span></p>` : ''}
      </div>
      ${globe}${globe ? '<div class="pc-wrap" hidden></div>' : ''}
      <p class="why">${p.lead ? `<b class="lead v-${esc(res.verdict)}">${esc(p.lead)}</b>` : ''}${p.why}</p>
      ${p.meter}
      <div class="dir-actions">
        <button type="button" class="btn primary" data-goto="strategy">${t(res.verdict === 'impossible' || res.verdict === 'failed' || (res.ended && res.verdict !== 'done') ? 'seeWhy' : 'seePlan')} ›</button>
        <button type="button" class="btn ghostly" data-shareimg="${esc(res.id)}">${ICON.image}<span>${t('sh.btn')}</span></button>
        <button type="button" class="btn ghostly" data-copy="${esc(res.id)}">${ICON.copy}<span>${t('copy')}</span></button>
      </div>
    </section></div>`;
  }

  const medalsOf = (a) => (a.rewards && a.rewards.length ? a.rewards : [a.reward]).filter(Boolean).reduce((s, x) => s + (x.type === 1 ? Number(x.amount) : 0), 0);

  /* ---------- several orders at once ---------- */
  function renderCross() {
    const box = $('cross');
    const cx = ENGINE.crossOrders(last.results.map(({ a, res }) => ({ id: String(a.id), title: plain(clean(txt(a.title) || 'Major Order')), medals: medalsOf(a), res })), settings.recordShare);
    if (!cx) { box.innerHTML = ''; return; }
    const pick = cx.orders.find(o => o.id === cx.pick);
    const msg = cx.verdict === 'all' ? fill(t('xAll'), { total: sharePct(cx.total) })
      : cx.verdict === 'pick' ? fill(t('xPick'), { total: sharePct(cx.total), title: esc(pick.title), need: sharePct(pick.need) })
      : fill(t(cx.orders.some(o => o.unknown) ? 'xNoneU' : 'xNone'), { total: sharePct(cx.total) });
    const note = cx.orders.some(o => o.unknown) ? ` ${t('xUnknown')}` : '';
    const chips = cx.orders.map(o => `<button type="button" class="xchip ${o.id === cx.pick ? 'pick' : ''}" data-otab="${esc(o.id)}">
      <span>${esc(o.title)}</span><b>${o.unknown ? '?' : sharePct(o.need)}</b></button>`).join('');
    const short = cx.verdict === 'all' ? fill(t('xShortAll'), { n: cx.orders.length }) : cx.verdict === 'pick' ? fill(t('xShortPick'), { title: esc(pick.title) }) : t('xShortNone');
    box.innerHTML = `<details class="cross v-${cx.verdict}" data-cross ${ui.crossOpen ? 'open' : ''}>
      <summary><span class="label">${fill(t('xLabelN'), { n: cx.orders.length })}</span><span class="xs">${short}</span>${ICON.chev}</summary>
      <p>${msg}${note}</p><div class="xchips">${chips}</div></details>`;
  }

  /* ---------- rail ---------- */
  // the forecast's "why": what we do against what it takes, one meter per open objective
  function whyHTML(res) {
    if (res.verdict === 'done' || res.verdict === 'unknown') return '';
    const meters = [];
    const meter = (label, have, need, sub, mark, key, few = false) => {
      const ratio = need > 0 ? have / need : 1;
      const ok = ratio >= 1;
      const fillW = Math.max(2, Math.min(100, ratio * 100)), markW = mark != null && need > 0 ? Math.min(100, (mark / need) * 100) : null;
      meters.push({ sev: ratio, html: `<div class="why-m ${ok ? 'ok' : ratio < 0.5 ? 'bad' : 'warn'}">
        <div class="wm-top"><span class="wm-l">${label}</span><span class="wm-x">${ok ? esc(t('why.ok')) : esc(fill(t(few ? 'why.few' : 'why.slow'), { x: fmt(1 / Math.max(ratio, 0.01), 1, 1) }))}</span></div>
        <div class="wm-bar" role="img" aria-label="${esc(plain(sub))}"><div class="fill" data-key="why:${esc(key)}" data-w="${fillW}"></div>${markW != null ? `<i class="wm-mark" style="left:${markW}%"></i>` : ''}</div>
        <div class="wm-sub">${sub}</div></div>` });
    };
    for (const r of res.anyOf ? [res.tasks[res.pick]] : res.tasks) {
      if (r.verdict === 'done') continue;
      if (r.counter && !r.simpleCount && r.needed > 0 && r.primary) {
        const noun = `${facName(r.task.faction)} ${t('what')[r.task.type] || t('what')[0]}`.trim();
        const rec0 = r.rates.recent ? r.rates.recent.rate : null;
        // the last hour is worth showing only when it differs from the main pace
        const rec = rec0 != null && r.primary.rate > 0 && Math.abs(rec0 / r.primary.rate - 1) > 0.1 ? rec0 : null;
        meter(esc(noun.charAt(0).toUpperCase() + noun.slice(1)), r.primary.rate, r.needed,
          fill(t(rec != null && r.primary.kind !== 'recent' ? 'why.paceRec' : 'why.pace'), { have: big(r.primary.rate), rec: big(rec), need: big(r.needed), basis: t('why.basis.' + (r.primary.kind || 'start')) }), r.primary.kind !== 'recent' ? rec : null, `${res.id}:${r.idx}`);
      } else if (r.defense && !r.defense.outlastsMO) {
        meter(fill(t('why.def'), { planet: planetName(r.planet) }), r.defense.share, r.defense.need,
          fill(t('why.players'), { have: pct(r.defense.share), need: sharePct(r.defense.need) }), null, `${res.id}:${r.idx}`, true);
      }
    }
    const lib = res.liberation;
    if (lib && isFinite(lib.currentShare) && lib.seqNeed > 0 && lib.verdict !== 'done' && lib.verdict !== 'ontrack')
      meter(esc(t(lib.count > 1 ? 'why.libN' : 'why.lib1')), lib.currentShare, isFinite(lib.seqNeed) ? lib.seqNeed : 5,
        fill(t('why.players'), { have: pct(lib.currentShare), need: sharePct(lib.seqNeed) }), null, `${res.id}:lib`, true);
    if (!meters.length) return '';
    meters.sort((x, y) => x.sev - y.sev);
    const doneN = res.tasks.filter(r => r.verdict === 'done').length;
    return `<div class="fwhy">${meters.slice(0, 3).map(m => m.html).join('')}
      ${doneN ? `<p class="why-done">${ICON.check}<span>${fill(t('why.done'), { k: doneN, n: res.tasks.length })}</span></p>` : ''}</div>`;
  }
  /* ---------- between orders: report on the last one, and the war right now ---------- */
  // The recorder keeps each order's objectives and its progress every 20 minutes; the last finished
  // one is kept in this browser for a week, so the page has something to say between orders.
  function saveRecap() {
    if (!record || !record.orders || !recordProgress) return;
    const now = Date.now();
    const ended = Object.entries(record.orders).filter(([, o]) => o.exp && o.exp < now).sort((a, b) => b[1].exp - a[1].exp)[0];
    if (!ended) return;
    const [id, o] = ended, pr = recordProgress.orders && recordProgress.orders[id];
    if (!pr || !pr.pts || !pr.pts.length) return;
    const so = soList().filter(n => soOutcome(n.msg) === 'won' && n.t >= (o.start || 0) - 3 * 3.6e6 && n.t <= o.exp + 3 * 3.6e6);
    store.set('recap', { id, title: o.title, start: o.start, exp: o.exp, tasks: o.tasks, pts: pr.pts, so, alerts: (record.alerts || []).filter(a => a.order === id || (a.kind === 'effect' && a.t >= (o.start || 0) && a.t <= o.exp)).slice(-40) });
  }
  function recapHTML() {
    const R = store.get('recap', null);
    if (!R || Date.now() - R.exp > 7 * 24 * 3600e3) return '';
    const fin = R.pts[R.pts.length - 1];
    const rows = (R.tasks || []).map((tk, i) => {
      const p = ENGINE.parseTask(tk, fin[i + 1]);
      const goal = p.goal || ([11, 13].includes(p.type) ? 1 : 0);
      const val = Number(fin[i + 1] || 0), frac = goal ? Math.min(1, val / goal) : 0, done = goal && val >= goal;
      return { i, p, goal, val, frac, done, r: { task: p, planet: p.planetIndex != null && last.planets ? last.planets[p.planetIndex] : null } };
    });
    const won = rows.length && rows.every(x => x.done), nDone = rows.filter(x => x.done).length;
    const t0 = R.pts[0][0], t1 = Math.max(R.exp, fin[0]), W = 200, Hh = 28;
    const xs = (t) => ((t - t0) / Math.max(1, t1 - t0) * W).toFixed(1);
    const facC = (f) => FAC_VAR[f] || 'var(--fg)';
    // each objective: how it moved, against the steady pace that would have finished it on time
    const spark = (x) => {
      if (!(x.goal > 1) || R.pts.length < 2) return '';
      const f0 = Math.min(1, Number(R.pts[0][x.i + 1] || 0) / x.goal), lo = Math.max(0, f0 - 0.04);
      const ys = (f) => (Hh - (Math.min(1, f) - lo) / Math.max(0.04, 1 - lo) * Hh).toFixed(1);
      const d = R.pts.map((pt, k) => `${k ? 'L' : 'M'}${xs(pt[0])} ${ys(Number(pt[x.i + 1] || 0) / x.goal)}`).join('');
      return `<svg class="rc-spark" viewBox="0 -2 ${W} ${Hh + 4}" preserveAspectRatio="none" aria-hidden="true">
        <line class="goal" x1="0" x2="${W}" y1="0" y2="0"/><line class="pace" x1="0" y1="${ys(f0)}" x2="${xs(R.exp)}" y2="0"/><path d="${d}"/></svg>`;
    };
    const fmtDay = (ms) => new Date(ms).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const durH = (R.exp - (R.start || t0)) / 3600e3;
    const objs = rows.map(x => `<li class="${x.done ? 'ok' : 'no'}" style="--c:${facC(x.p.faction)}">
        <span class="rc-mark">${x.done ? ICON.check : ICON.cross}</span>
        <div><b>${taskText(x.r)}</b>
        <div class="rc-bar"><i style="width:${(x.frac * 100).toFixed(1)}%"></i></div>
        <span class="rc-num">${x.goal > 1 ? `${big(x.val)} / ${big(x.goal)} · ${pct(x.frac)}` : esc(t(x.done ? 'rc.libDone' : 'rc.libNo'))}</span></div>${spark(x)}</li>`).join('');
    const hasSpark = rows.some(x => x.goal > 1) && R.pts.length > 1;
    return `<section class="recap panel br">
      <span class="label">${esc(t('rc.label'))}</span>
      <div class="rc-head"><div><h3>${esc(clean(R.title || 'Major Order'))}</h3>
        <p class="rc-when">${esc(fill(t('rc.when'), { a: fmtDay(R.start || t0), b: fmtDay(R.exp), d: dur(durH) }))}</p></div>
        <div class="stamp ${won ? 'v-done' : 'v-failed'}">${ICON[won ? 'check' : 'cross']}<span>${esc(t(won ? 'rc.won' : 'rc.lost'))}</span></div></div>
      <p class="rc-sum">${esc(won ? t('rc.sumWon') : fill(t('rc.sumLost'), { k: nDone, n: rows.length }))}</p>
      <ul class="rc-objs">${objs}</ul>
      ${hasSpark ? `<p class="rc-legend"><span><i class="l-prog"></i>${esc(t('rc.lProg'))}</span><span><i class="l-pace"></i>${esc(t('rc.lPace'))}</span><span class="rc-since">${esc(fill(t('rc.since'), { when: fmtDay(t0) }))}</span></p>` : ''}
    </section>`;
  }
  // Hand-made moves, in plain words: Joel (Arrowhead's Game Master) and Super Earth Command
  function soFor(x, start, end, list) {
    const won = (list || soList()).filter(n => soOutcome(n.msg) === 'won');
    if (x.ref === 'briefing') return won.filter(n => n.t >= (start || 0) && (!end || n.t <= end + 3 * 3.6e6)).sort((a, b) => b.t - a.t)[0] || null;
    return won.filter(n => Math.abs(n.t - x.t) < 3 * 3.6e6).sort((a, b) => Math.abs(a.t - x.t) - Math.abs(b.t - x.t))[0] || null;
  }
  function joelItem(x, tasks, rel, ctx = {}) {
    const noun = (i) => { const tk = tasks && tasks[i - 1]; if (!tk) return '#' + i; const p = tk.raw ? tk : ENGINE.parseTask(tk, 0); const w = `${p.faction ? plain(facName(p.faction)) + ' ' : ''}${t('what')[p.type] || t('what')[0]}`; return w.charAt(0).toUpperCase() + w.slice(1); };
    if (x.kind === 'edited') {
      const g = (x.diff || []).filter(d => d.kind === 'goal');
      const title = g.length && g.every(d => d.to < d.from) ? t('jo.cut') : g.length && g.every(d => d.to > d.from) ? t('jo.raised') : t('jo.edited');
      const detail = g.map(d => `<span class="jo-d">${esc(noun(d.i))}: ${big(d.from)} → <b>${big(d.to)}</b></span>`).join('');
      const so = soFor(x, ctx.start, ctx.end, ctx.so);
      if (so && (!g.length || g.every(d => d.to < d.from))) {
        const np = newsParts(so.msg);
        return { icon: 'check', earned: true, title: `${title}: ${esc(t('jo.soWon'))}`, detail: detail + `<span class="jo-so">${esc(t('jo.soWhy'))}</span>${np.body ? `<span class="jo-q">“${esc(plain(np.body).slice(0, 160))}${np.body.length > 160 ? '…' : ''}”</span>` : ''}`, t: so.t, when: x.ref === 'briefing' ? t('jo.launch') : null };
      }
      return { icon: 'edit', title, detail, t: x.t, when: x.ref === 'briefing' ? t('jo.launch') : null };
    }
    if (x.kind === 'effect' || x.kind === 'active') {
      const lbl = plain(effectLabel(x.type, x.v));
      return { icon: 'fx', title: lbl.charAt(0).toUpperCase() + lbl.slice(1), detail: planetList(x.planets || [], rel && rel.size ? rel : new Set(x.planets || [])), t: x.t, when: x.kind === 'active' ? t('in.now') : null };
    }
    return { icon: KIND_ICON[x.kind] || 'warn', title: alertText(x, true, rel || new Set()), detail: '', t: x.t };
  }
  function joelHTML(list, tasks, rel, more, ctx) {
    const rows = list.map(x => joelItem(x, tasks, rel, ctx)).filter(r => !r.earned).slice(0, 5);
    return `<section class="panel br rail-card joel">
      <span class="label">${esc(t('jo.title'))}</span>
      <p class="jo-sub">${esc(t('jo.sub'))}</p>
      ${rows.length ? `<ul class="jo-list">${rows.map(r => `<li class="${r.earned ? 'earned' : ''}"><span class="jo-ico">${ICON[r.icon] || ''}</span><div><b>${r.title}</b>${r.detail ? `<p>${r.detail}</p>` : ''}</div><span class="jo-when">${esc(r.when || ago(r.t))}</span></li>`).join('')}</ul>`
        : `<p class="jo-none">${esc(t('jo.none'))}</p>`}
      ${more ? `<button type="button" class="linkbtn" data-goto="intel">${esc(t('jo.more'))} ›</button>` : ''}
    </section>`;
  }
  function joelActive(res, a) {
    const entry = last.results.find(x => x.res === res); if (!entry) return '';
    const it = intelFor(entry);
    const tasks = res.tasks.map(r => r.task);
    return joelHTML([...it.items].sort((x, y) => prioOf(x) - prioOf(y) || y.t - x.t), tasks, it.rel, true, { start: entry.start, end: Date.parse(a.expiration) });
  }
  function joelRecap() {
    const R = store.get('recap', null);
    if (!R || Date.now() - R.exp > 7 * 24 * 3600e3) return '';
    const seen = new Set(), list = [];
    for (const a of [...(R.alerts || [])].sort((x, y) => y.t - x.t)) {
      if (a.kind === 'effect' && !a.on) continue;
      const k = a.kind === 'effect' ? 'e' + a.eid : a.kind === 'edited' ? 'ed' : a.kind + a.idx + Math.round(a.t / 3.6e6);
      if (seen.has(k)) continue; seen.add(k); list.push(a);
    }
    return joelHTML(list.sort((a, b) => prioOf(a) - prioOf(b)), R.tasks, new Set(), false, { start: R.start, end: R.exp, so: [...(R.so || []), ...soList()] });
  }
  // Super Earth's dispatches; a won Strategic Opportunity shows the reward it brought
  // Intel feed: one short line per event, grouped by day like a war log. The order's own start and
  // end come from the game data; a dispatch can be opened to read it in full, never cut off.
  function feedRow(r) {
    const tm = new Date(r.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const head = `<span class="fd-time">${esc(tm)}</span><span class="fd-ico">${ICON[NEWS_ICON[r.k]]}</span><span class="fd-txt"><b>${r.title}</b>${r.sub ? `<span class="fd-sub">${r.sub}</span>` : ''}</span>`;
    return r.body
      ? `<li class="nk-${r.k}"><details class="fd-more"><summary>${head}${ICON.chev}</summary><p>${clean(r.body)}</p></details></li>`
      : `<li class="nk-${r.k}"><div class="fd-row">${head}</div></li>`;
  }
  function feedHTML(rows, cls = '') {
    const day = (tm) => { const d = new Date(tm), n = new Date(last.now); const k = (x) => x.toDateString();
      if (k(d) === k(n)) return t('fd.today'); const y = new Date(n); y.setDate(y.getDate() - 1); if (k(d) === k(y)) return t('fd.yesterday');
      return d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' }); };
    let out = '', cur = null;
    for (const r of rows) { const d = day(r.t); if (d !== cur) { out += `${cur ? '</ul>' : ''}<h5 class="fd-day">${esc(d)}</h5><ul class="fd-list">`; cur = d; } out += feedRow(r); }
    return `<div class="feed ${cls}">${out}${cur ? '</ul>' : ''}</div>`;
  }
  // game titles come in capitals: "VICTORY ON MERIDIA" -> "Victory on Meridia"
  const SMALL = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
  // word by word, so "ARMORED EAGLE-Patriotic Invigoration" and "MEMORIAM ETERNAL-HONOR" both come out right
  const titleCase = (s0) => plain(s0 || '').trim().split(/(\s+|-)/).map((w, i) => {
    if (/^(\s+|-)$/.test(w) || !/[A-Z]{2}/.test(w) || w !== w.toUpperCase() || /^[A-Z]\d|\d/.test(w) || /^[IVX]+$/.test(w)) return w;
    const lw = w.toLowerCase(); return i && SMALL.has(lw) ? lw : lw.replace(/^(\W*)(\w)/, (m, p1, c) => p1 + c.toUpperCase());
  }).join('');
  function dispatchRows(list, events) {
    const rows = [];
    const seen = new Set();
    for (const n of list) {
      if (!n || seen.has(n.id)) continue; seen.add(n.id);
      const np = newsParts(n.msg), k = newsKind(np.title, np.body);
      // the order's own start or end is already in the log, from the game data
      if ((k === 'order' || k === 'win' || k === 'loss') && /major order/i.test(n.msg) && events.some(e => e.mo && Math.abs(e.t - n.t) < 3 * 3.6e6)) continue;
      rows.push({ t: n.t, k, title: esc(titleCase(np.title)), body: np.body, n });
    }
    return rows;
  }
  function newsHomeHTML() {
    const R = store.get('recap', null);
    const events = [];
    if (R) {
      const rows = (R.tasks || []).map((tk, i) => { const p = ENGINE.parseTask(tk, R.pts[R.pts.length - 1][i + 1]); const goal = p.goal || 1; return Number(R.pts[R.pts.length - 1][i + 1] || 0) >= goal; });
      const won = rows.length && rows.every(Boolean), nd = rows.filter(Boolean).length;
      const name = esc(titleCase(clean(R.title || 'Major Order')));
      if (R.start) events.push({ mo: true, t: R.start, k: 'order', title: fill(t('fd.moStart'), { name }) });
      events.push({ mo: true, t: R.exp, k: won ? 'win' : 'loss', title: fill(t(won ? 'fd.moWon' : 'fd.moLost'), { name }), sub: won ? '' : esc(fill(t('fd.moLostSub'), { k: nd, n: rows.length })) });
      for (const a of R.alerts || []) if (a.kind === 'edited') {
        const it = joelItem(a, R.tasks, new Set(), { start: R.start, end: R.exp, so: [...(R.so || []), ...soList()] });
        const g = (a.diff || []).filter(d => d.kind === 'goal');
        if (g.length) events.push({ t: it.t || a.t, k: it.earned ? 'so' : 'order', title: esc(it.earned ? t('fd.cutSo') : plain(it.title)), sub: g.map(d => `${big(d.from)} → <b>${big(d.to)}</b>`).join(' · ') });
      }
    }
    const disp = dispatchRows([...(news.items || []), ...((R && R.so) || []), ...((record && record.so) || [])], events)
      .filter(r => !(r.k === 'so' && events.some(e => e.k === 'so' && Math.abs(e.t - r.t) < 3 * 3.6e6)));
    const all = [...events, ...disp].sort((x, y) => y.t - x.t).slice(0, 14);
    if (!all.length) return '';
    const kinds = [...new Set(all.map(x => x.k))];
    const f = kinds.includes(ui.nf) ? ui.nf : null;
    const shown = all.filter(x => !f || x.k === f);
    const filters = kinds.length > 1 ? `<div class="nk-filter" role="group" aria-label="${esc(t('nw.filter'))}"><button type="button" data-nf="" aria-pressed="${!f}">${esc(t('nw.all'))} <small>${all.length}</small></button>${kinds.map(k => `<button type="button" class="nk-${k}" data-nf="${k}" aria-pressed="${f === k}">${ICON[NEWS_ICON[k]]}${esc(t('nk.' + k))} <small>${all.filter(x => x.k === k).length}</small></button>`).join('')}</div>` : '';
    return `<section class="newsbox panel br"><span class="label">${esc(t('nw.title'))}</span>${filters}${feedHTML(shown)}</section>`;
  }
  function frontsHTML() {
    const P = Object.values(last.planets || {}).filter(p => p && p.currentOwner);
    const F = ['Terminids', 'Automaton', 'Illuminate'].map(f => {
      const ps = P.filter(p => p.currentOwner === f || (p.event && p.event.faction === f));
      const pl = ps.reduce((n, p) => n + (p.statistics?.playerCount || 0), 0);
      const defs = ps.filter(p => p.event);
      const top = [...ps].sort((a, b) => (b.statistics?.playerCount || 0) - (a.statistics?.playerCount || 0)).slice(0, 3);
      return { f, ps, pl, defs, top };
    }).filter(x => x.ps.length);
    if (!F.length) return '';
    const N = last.N || F.reduce((n, x) => n + x.pl, 0) || 1;
    return `<section class="fronts panel br"><span class="label">${esc(t('rc.fronts'))}</span>
      <div class="fr-grid">${F.map(x => `<div class="fr" style="--c:${FAC_VAR[x.f]}">
        <h4>${esc(plain(facName(x.f)))}</h4>
        <p class="fr-n"><b>${people(x.pl)}</b> ${esc(t('rc.divers'))} · ${pct(x.pl / N)}</p>
        <div class="fr-bar"><i style="width:${Math.min(100, x.pl / N * 100).toFixed(1)}%"></i></div>
        <p class="fr-s">${esc(fill(t(x.ps.length > 1 ? 'rc.planetsN' : 'rc.planets1'), { n: x.ps.length }))}${x.defs.length ? ` · <b class="fr-def">${esc(fill(t(x.defs.length > 1 ? 'rc.defsN' : 'rc.defs1'), { n: x.defs.length }))}</b>` : ''}</p>
        <ul>${x.top.map(p => `<li><button type="button" class="fr-p mp-link" data-open-planet="${p.index}">${planetName(p)}</button><span>${people(p.statistics?.playerCount || 0)}</span></li>`).join('')}</ul>
      </div>`).join('')}</div></section>`;
  }

  /* ---------- war map: the fronts as the game's galaxy map draws them ---------- */
  // Every planet being fought over, at its real galactic position (Super Earth in the centre), in its
  // owner's colour and sized by its Helldivers. The order's planets get a white ring, the planets of
  // "what to do now" yellow brackets; attacks are dashed, supply lines faint. Hover or tap a planet.
  const FAC_VAR = { Terminids: 'var(--f-terminid)', Automaton: 'var(--f-automaton)', Illuminate: 'var(--f-illuminate)', Humans: 'var(--f-human)' };
  function mapHTML(res) {
    const P = Object.values(last.planets || {}).filter(p => p && p.position && isFinite(p.position.x) && isFinite(p.position.y));
    if (P.length < 3) return '';
    const rel = res ? orderPlanets(res) : new Set();
    const cp = res ? cardPlanets({ res }) : null;
    const focus = new Set(cp ? (cp.list || [cp.planet]).map(p => Number(p.index)) : []);
    const maxP = Math.max(1, ...P.map(p => p.statistics?.playerCount || 0));
    const dssI = last.dssIdx != null ? Number(last.dssIdx) : null;
    // galaxy scale: the farthest planet sits near the edge of the disc
    const far = Math.max(0.3, ...P.map(p => Math.hypot(p.position.x, p.position.y)));
    const k = Math.min(1.6, 94 / (far * 100)) * 100;
    // each planet's footprint: its dot plus whatever is drawn around it (ring, defense ring, brackets, DSS)
    const N = P.map(p => {
      const i = Number(p.index), r = 2 + Math.sqrt((p.statistics?.playerCount || 0) / maxP) * 4.2;
      const isF = focus.has(i), isR = rel.has(i);
      const R = Math.max(4.5, r + (isR ? 3 : 0) + (p.event ? 2.4 : 0) + (isF ? 5.5 : 0) + (i === dssI ? (isF ? 5 : 3) : 0));
      const x0 = p.position.x * k, y0 = -p.position.y * k;
      return { p, i, r, R, isF, isR, x0, y0, x: x0, y: y0 };
    });
    // spread overlapping planets apart, as little as possible, keeping them near their real place
    const SE = { x: 0, y: 0, R: 5, fixed: true };
    for (let it = 0; it < 160; it++) {
      let moved = false;
      for (let a = 0; a < N.length; a++) {
        const A = N[a];
        for (let b = a + 1; b <= N.length; b++) {
          const B = b === N.length ? SE : N[b];
          let dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
          const need = A.R + B.R + 1.4;
          if (d >= need) continue;
          if (d < 1e-6) { dx = Math.cos(a + b); dy = Math.sin(a + b); d = 1; }
          const push = (need - d) / (B.fixed ? 1 : 2), ux = dx / d, uy = dy / d;
          A.x -= ux * push; A.y -= uy * push;
          if (!B.fixed) { B.x += ux * push; B.y += uy * push; }
          moved = true;
        }
      }
      for (const n of N) {
        n.x += (n.x0 - n.x) * 0.015; n.y += (n.y0 - n.y) * 0.015;
        const d = Math.hypot(n.x, n.y), lim = 106 - n.R;
        if (d > lim) { n.x *= lim / d; n.y *= lim / d; }
      }
      if (!moved && it > 20) break;
    }
    const at = new Map(N.map(n => [n.i, n]));
    const f1 = (v) => v.toFixed(1);
    const lines = [];
    for (const n of N) {
      for (const w of n.p.waypoints || []) { const q = at.get(Number(w)); if (q && n.i < q.i) lines.push(`<line class="mw" x1="${f1(n.x)}" y1="${f1(n.y)}" x2="${f1(q.x)}" y2="${f1(q.y)}"/>`); }
      for (const tIdx of n.p.attacking || []) { const q = at.get(Number(tIdx)); if (q) lines.push(`<line class="ma" style="--c:${FAC_VAR[factionOfPlanet(n.p)] || 'var(--fg)'}" x1="${f1(n.x)}" y1="${f1(n.y)}" x2="${f1(q.x)}" y2="${f1(q.y)}"/>`); }
    }
    // one label, for the planet of "what to do now", on the first side where it hits nothing
    let label = '';
    const L = cp && at.get(Number(cp.planet.index));
    if (L) {
      const txtL = plain(planetName(L.p)).toUpperCase(), w = txtL.length * 4.9 + 4, h = 9;
      // candidate boxes on rings around the planet, nearest first; a leader line when it had to move away
      const hits = (b) => b.x < -110 || b.x + w > 110 || b.y < -110 || b.y + h > 110
        || N.some(n => n !== L && Math.hypot(Math.max(b.x - n.x, 0, n.x - b.x - w), Math.max(b.y - n.y, 0, n.y - b.y - h)) < n.R + 2)
        || Math.hypot(Math.max(b.x - L.x, 0, L.x - b.x - w), Math.max(b.y - L.y, 0, L.y - b.y - h)) < L.R + 1;
      let pick = null;
      for (let gap = 2; gap <= 40 && !pick; gap += 3) {
        for (const ang of [-90, 90, 0, 180, -45, -135, 45, 135, -65, -115, 65, 115, -20, -160, 20, 160]) {
          const a = ang * Math.PI / 180, dist = L.R + gap;
          const cx = L.x + Math.cos(a) * (dist + w / 2 * Math.abs(Math.cos(a))), cy = L.y + Math.sin(a) * (dist + h / 2 * Math.abs(Math.sin(a)));
          const b = { x: cx - w / 2, y: cy - h / 2 };
          if (!hits(b)) { pick = { ...b, gap, cx, cy }; break; }
        }
      }
      if (!pick) pick = { x: L.x - w / 2, y: L.y - L.R - h - 2, gap: 2, cx: L.x, cy: L.y - L.R - h / 2 - 2 };
      const ex = pick.cx - L.x, ey = pick.cy - L.y, el = Math.hypot(ex, ey) || 1;
      const lead = pick.gap > 5 ? `<line class="lead" x1="${f1(L.x + ex / el * (L.R + 0.5))}" y1="${f1(L.y + ey / el * (L.R + 0.5))}" x2="${f1(Math.max(pick.x, Math.min(pick.x + w, L.x)))}" y2="${f1(Math.max(pick.y, Math.min(pick.y + h, L.y)))}"/>` : '';
      label = `${lead}<text class="lbl" x="${f1(pick.cx)}" y="${f1(pick.cy + 3)}" text-anchor="middle">${esc(txtL)}</text>`;
    }
    const order = [...N].sort((a, b) => (a.isF - b.isF) || (a.isR - b.isR));
    const dots = order.map(n => {
      const p = n.p, owner = p.event ? (p.event.faction || factionOfPlanet(p)) : factionOfPlanet(p), r = n.r;
      const lib = p.event && p.event.maxHealth ? 1 - p.event.health / p.event.maxHealth : p.maxHealth ? 1 - p.health / p.maxHealth : 0;
      const tip = `${plain(planetName(p))}|${plain(facName(owner) || '')}|${people(p.statistics?.playerCount || 0)}|${p.event ? 'def' : 'lib'}|${(lib * 100).toFixed(1)}`;
      let ring = r;
      const parts = [];
      if (p.event) { ring += 2.4; parts.push(`<circle class="evr" r="${f1(ring)}"/>`); }
      if (n.isR) { ring += 2.6; parts.push(`<circle class="ring" r="${f1(ring)}"/>`); }
      if (n.isF) { const b = ring + 3, c = 3.2; parts.push(`<path class="br" d="M${f1(-b)} ${f1(-b + c)}V${f1(-b)}H${f1(-b + c)}M${f1(b - c)} ${f1(-b)}H${f1(b)}V${f1(-b + c)}M${f1(b)} ${f1(b - c)}V${f1(b)}H${f1(b - c)}M${f1(-b + c)} ${f1(b)}H${f1(-b)}V${f1(b - c)}"/>`); }
      if (n.i === dssI) { const o = n.isF ? ring + 3 + 2.6 : (ring + 2.2) * 0.7071; parts.push(`<path class="mdss" d="M${f1(o)} ${f1(-o - 2.2)}l2.2 2.2-2.2 2.2-2.2-2.2z"/>`); }
      return `<g class="mp ${n.isF ? 'focus' : ''} ${n.isR ? 'rel' : ''} ${p.event ? 'ev' : ''}" style="--c:${FAC_VAR[owner] || 'var(--fg)'}" transform="translate(${f1(n.x)} ${f1(n.y)})" data-mp="${n.i}" data-tip="${esc(tip)}" tabindex="0" role="button" aria-label="${esc(plain(planetName(p)))}">
        <circle class="hit" r="${f1(n.R)}"/>${parts.join('')}<circle class="dot" r="${f1(r)}"/></g>`;
    }).join('');
    return `<section class="panel br rail-card map-card">
      <span class="label">${esc(t('map.title'))}</span>
      <div class="war-map ${res ? '' : 'all'}">
        <svg viewBox="-112 -112 224 224" role="group" aria-label="${esc(t('map.aria'))}">
          <circle class="mr" r="106"/><circle class="mr" r="70"/><circle class="mr" r="35"/>
          <g class="mlines">${lines.join('')}</g>
          <circle class="se" r="3"/><circle class="se-c" r="1"/>
          ${dots}${label}
        </svg>
        <div class="map-tip" hidden></div>
      </div>
      <p class="map-key"><span><i class="k-ring"></i>${esc(t('map.kOrder'))}</span>${focus.size ? `<span><i class="k-br"></i>${esc(t('map.kNow'))}</span>` : ''}<span><i class="k-ev"></i>${esc(t('map.kAttack'))}</span>${dssI != null && at.has(dssI) ? `<span><i class="k-dss"></i>DSS</span>` : ''}</p>
    </section>`;
  }
  function railHTML(res, a) {
    const v = res.verdict;
    const alert = v === 'impossible' || v === 'nearly_impossible' || v === 'failed';
    const exp = Date.parse(a.expiration);
    const medals = medalsOf(a);
    const brief = clean(txt(a.briefing));
    const desc = txt(a.description) && txt(a.description) !== txt(a.briefing) ? clean(txt(a.description)) : '';
    const open = !!ui.briefOpen[a.id];
    return `<aside class="area-rail">
      <section class="panel br rail-card verdict-card ${alert ? 'alert' : ''}">
        <span class="label">${t('forecast')}</span>
        <div class="stamp v-${v}" data-stamp="${esc(res.id)}:${v}">${ICON[VICON[v] || 'dots']}<span>${esc(t('v.' + v))}</span></div>
        <p class="meaning">${esc(t('m.' + v))}</p>
        ${whyHTML(res)}
        <div class="timer ${v === 'done' || res.ended ? 'finished' : ''}" title="${esc(fill(t('endsAt'), { when: isFinite(exp) ? new Date(exp).toLocaleString(locale(), { weekday: 'long', hour: 'numeric', minute: '2-digit' }) : '—' }))}">
          <div><span class="label">${t('timeLeft')}</span><div class="count" data-exp="${exp}">—</div></div>
          ${medals ? `<div class="reward">${medalSvg}<span>${fill(t('medals'), { n: fmt(medals) })}</span></div>` : ''}
        </div>
      </section>
      ${mapHTML(res)}
      ${joelActive(res, a)}
      ${brief || desc ? `<section class="panel br rail-card brief-card">
        <span class="label">${t('brief')}</span>
        <div class="text ${open ? 'open' : ''}" id="brief-${esc(a.id)}"><p>${brief}</p>${desc ? `<p style="margin-top:8px">${desc}</p>` : ''}</div>
        <button type="button" class="linkbtn" data-brief="${esc(a.id)}" aria-expanded="${open}" aria-controls="brief-${esc(a.id)}">${open ? t('less') : t('more')}</button>
      </section>` : ''}
    </aside>`;
  }

  /* ---------- objectives tab ---------- */
  const kv = (label, value) => `<span>${esc(label)}: <b>${value}</b></span>`;
  // per-objective numbers, folded away until asked for
  function intelHTML(r, res, key) {
    const tk = r.task, p = r.planet, rows = [];
    if (r.pw && p) {
      rows.push(kv(t('iHp'), `${big(p.health)} / ${big(p.maxHealth)}`));
      rows.push(kv(t('iRegen'), `${big(r.pw.regen)} HP${t('perHour')}`));
      rows.push(kv(t('th.divers'), `${fmt(p.statistics?.playerCount || 0)} (${pct(r.share, 1)})`));
      rows.push(kv(t('iNet'), `${r.net >= 0 ? '+' : ''}${big(r.net)} HP${t('perHour')} · ${r.observed ? t('obs') : t('model')}`));
      rows.push(kv(t('iBe'), pct(r.breakEven)));
      if (r.pw.hasRegions) rows.push(kv(t('iRegions'), r.pw.queue.filter(q => q.hp > 0).map(q => `${esc(q.name || '?')} ${big(q.hp)} (${fmt(q.players)})`).join(' · ')));
    } else if (r.defense && p) {
      rows.push(kv(t('defEnds'), dur(r.defense.hoursToEnd)));
      rows.push(kv(t('th.divers'), `${fmt(p.statistics?.playerCount || 0)} (${pct(r.defense.share, 1)})`));
      rows.push(kv(t('defNeed'), `${people(r.defense.need * res.model.N)} (${pct(r.defense.need)})`));
    } else if (r.counter && !r.simpleCount) {
      rows.push(kv(t('done'), `${big(tk.progress)} / ${big(tk.goal)}`));
      rows.push(kv(t('needRate'), `${big(r.needed)}${t('perHour')}`));
      rows.push(kv(t('rateStart'), r.rates.sinceStart ? big(r.rates.sinceStart.rate) + t('perHour') : '—'));
      rows.push(kv(t('rateRecent'), r.rates.recent ? big(r.rates.recent.rate) + t('perHour') : '—'));
    } else if (r.libN && r.libN.rank) {
      rows.push(kv(t('iQuickest'), r.libN.rank.slice(0, 4).map(x => planetName(x.planet)).join(', ')));
      rows.push(kv(t('iFront'), `${fmt(Math.round(r.libN.frontShare * res.model.N))} (${pct(r.libN.frontShare, 1)})`));
    } else if (r.defenses && r.defenses.length) {
      rows.push(kv(t('iAttacks'), r.defenses.map(d => `${planetName(d.planet)} · ${dur(d.hoursToEnd)}`).join(', ')));
    }
    if (!rows.length) return '';
    const open = !!ui.intelOpen[key];
    return `<details class="intel" data-intel="${esc(key)}" ${open ? 'open' : ''}><summary>${ICON.chev}<span>${t('intel')}</span></summary><div class="kv">${rows.join('')}</div></details>`;
  }

  function objectivesHTML(res) {
    const H = res.hoursLeft;
    const S = (k, p = {}) => fill(t('s.' + k), p);
    const banner = res.anyOf ? `<p class="anyof">${ICON.target}<span>${fill(t('anyOf'), { k: res.pick + 1 })}</span></p>` : '';
    return banner + res.tasks.map((r, i) => {
      const tk = r.task;
      const p = r.planet;
      const fac = p ? factionOfPlanet(p) : tk.faction;
      let bar = '', line = '', chips = [];
      const key = `${res.id}:${r.idx}`;
      if (r.pw || ((tk.type === 11 || tk.type === 13) && !r.defense)) {
        if (!r.pw) { bar = `<div class="bar lib fac-Humans">${barFill(key, 1)}</div>`; line = r.safe ? S('safe') : S('liberated'); }
        else {
          const frac = Math.max(0, 1 - p.health / p.maxHealth);
          bar = `<div class="bar lib ${r.net > 0 ? 'moving' : 'stuck'}" role="img" aria-label="${pct(frac)}">${barFill(key, frac)}</div>`;
          const L = res.liberation, seg = L && L.plan && isFinite(L.seqNeed) && L.seqNeed <= 1 ? L.plan.segs.findIndex(sg => sg.target === r) : -1;
          const planned = seg > 0 && !(r.eta <= H) ? fill(t('libPlan'), { prev: planetName(L.plan.segs[seg - 1].target.planet), a: clock(L.plan.segs[seg].start), b: clock(L.plan.segs[seg].end) }) : null;
          line = `<b>${S('pct', { p: pct(frac) })}</b> · ${res.ended ? S('missed') : r.eta <= H ? S('falls', { when: clock(r.eta) }) : planned || (r.net <= 0 ? S('stuck') : S('slow'))}`;
          if (r.onDss) chips.push(`<span class="chip" style="color:var(--info)">${t('chipDss')}</span>`);
          if (r.onDss && last.hod) chips.push(`<span class="chip" style="color:var(--yellow)">${t('chipHod')}</span>`);
          if (r.holdLost) chips.push(`<span class="chip" style="color:var(--warn)">${t('chipRetake')}</span>`);
        }
      } else if (r.defense) {
        bar = `<div class="bar def">${barFill(key, r.defense.progress)}</div>`;
        line = r.defense.outlastsMO ? S('defOut') : r.defense.verdict === 'ontrack' ? S('defOk') : S('defHelp', { when: clock(r.defense.hoursToEnd) });
      } else if (r.counter && !r.simpleCount) {
        const frac = tk.goal ? Math.min(1, tk.progress / tk.goal) : 0;
        const pf = r.projection != null && tk.goal ? Math.min(1, r.projection / tk.goal) : null;
        const proj = r.projection != null && tk.goal ? projPct(r.projection / tk.goal) : null;
        bar = `<div class="bar">${pf != null && pf > frac ? `<div class="proj" style="left:${frac * 100}%;width:${(pf - frac) * 100}%"></div>` : ''}${barFill(key, frac)}<div class="goal"></div></div>`;
        const rate = r.rates && (r.rates.recent || r.primary) ? (r.rates.recent || r.primary).rate : null;
        const live = r.verdict !== 'done' && !res.ended && tk.goal && rate > 0
          ? `<span class="tick-wrap"><i class="live"></i><span class="tick" data-tick="${tk.progress}" data-rate="${(rate / 3600).toFixed(3)}" data-goal="${tk.goal}" data-t0="${last.now}">${fmt(tk.progress)}</span> / ${big(tk.goal)}</span> · ` : '';
        // far ahead: "done by Sun 14:00" reads better than "about 5,575% by the deadline"
        const doneIn = r.verdict === 'ontrack' && r.primary && r.primary.rate > 0 && r.projection / tk.goal > 1.5 ? (tk.goal - tk.progress) / r.primary.rate : null;
        line = `${r.early ? `<span class="chip early" title="${esc(t('earlyWhy'))}">${esc(t('early'))}</span> ` : ''}<b>${pct(frac)}</b> · ${live}${r.verdict === 'done' ? S('cDone') : res.ended ? S('missed') : !proj || r.verdict === 'unknown' ? S('cWait') : doneIn != null ? S('cOkBy', { when: clock(doneIn) }) : r.verdict === 'ontrack' ? S('cOk', { proj }) : S('cBehind', { proj })}`;
      } else {
        const frac = tk.goal ? Math.min(1, tk.progress / tk.goal) : null;
        if (frac != null) bar = `<div class="bar">${barFill(key, frac)}<div class="goal"></div></div>`;
        line = tk.goal ? S('cCount', { p: fmt(tk.progress), g: fmt(tk.goal) }) : fmt(tk.progress);
        if (r.libN && r.libN.first && r.verdict !== 'done') line += ` · ${S('nNext', { planet: planetName(r.libN.first.planet) })}`;
        if (r.defenses && r.verdict !== 'done') line += ` · ${r.defenses.length > 1 ? S('nAttacks', { n: r.defenses.length }) : r.defenses.length ? S('nAttack1') : S('nNoAttack')}`;
      }
      const check = r.verdict === 'done' ? `<span class="check done">${ICON.check}</span>` : r.verdict === 'impossible' || r.verdict === 'failed' ? `<span class="check fail">${ICON.cross}</span>` : '<span class="check"></span>';
      return `<article class="objective ${fac ? 'fac-' + esc(fac) : ''}" style="--i:${i}">
        ${check}<h4>${res.anyOf ? `<span class="opt ${i === res.pick ? 'best' : ''}">${fill(t('option'), { n: i + 1 })}</span>` : ''}${taskText(r)}</h4>${pill(r.verdict)}
        <div class="meta">${bar}<p class="line">${line}</p>${chips.length ? `<div class="chipline">${chips.join('')}</div>` : ''}${r.verdict === 'done' ? '' : intelHTML(r, res, key)}</div>
      </article>`;
    }).join('');
  }

  /* ---------- strategy tab ---------- */
  function timelineHTML(segs, H, key) {
    if (!segs || !segs.length) return '';
    const span = Math.max(H, segs[segs.length - 1].end);
    const x = (h) => (h / span) * 100;
    const segHtml = segs.map((s, i) => `<div class="tl-seg${s.end > H + 0.01 ? ' late' : ''}" style="--i:${i};--fc:var(--s${(i % 4) + 1});left:${x(s.start)}%;width:${x(s.end - s.start)}%" title="${esc(txt(s.planet.name))}">${planetName(s.planet)}</div>`).join('');
    const list = segs.map((s, i) => `<span><i class="sw2" style="--fc:var(--s${(i % 4) + 1})"></i><b>${planetName(s.planet)}</b> ${s.start < 0.05 ? t('now') : clock(s.start)} → ${clock(s.end)}</span>`).join('');
    return `<div class="timeline" data-tl="${esc(key)}">
      <div class="tl-track" role="img">${segHtml}<div class="tl-deadline" style="left:calc(${Math.min(100, x(H))}% - 1px)" title="${esc(t('deadline'))}"></div></div>
      <div class="tl-list">${list}<span>· ${t('deadline')}: <b>${clock(H)}</b></span></div></div>`;
  }

  function recItem(rec, res, tag = 'li', icon = '') {
    const R = (k) => TEXT.r[k];
    const P = (p) => planetName(p);
    let key = rec.kind, params = {}, cls = '', minor = false, extra = '';
    switch (rec.kind) {
      case 'libImpossible': params = { need: sharePct(rec.need) }; cls = 'k-bad'; if (rec.none) key = 'libImpossibleNone'; break;
      case 'libNFocus': {
        const rest = rec.list.slice(1).map(P);
        params = { planet: P(rec.planet), left: fmt(rec.left), then: rest.length ? fill(R('libNThen'), { list: listJoin(rest) }) : '',
          players: rec.players != null ? people(rec.players) : '—', share: rec.share != null ? pct(rec.share) : '—', nowPlayers: fmt(rec.nowPlayers) };
        if (rec.verdict === 'impossible') cls = 'k-warn';
        break;
      }
      case 'libNOk': params = { task: taskText(rec.task) }; minor = true; break;
      case 'defWait': params = { left: fmt(rec.left) }; minor = true; break;
      case 'libPartial': params = { k: rec.k, n: rec.n, share: sharePct(rec.share), need: sharePct(rec.need), planets: listJoin(rec.planets.map(P)) }; cls = 'k-warn'; break;
      case 'libFocus':
        key = { win: 'libFocusWin', more: 'libFocusMore', partial: 'libFocusPartial' }[rec.variant];
        params = { planet: P(rec.planet), players: people(rec.players), share: pct(rec.share), nowPlayers: fmt(rec.nowPlayers), when: rec.hours != null ? clock(rec.hours) : '', crowd: crowdText(rec.players, rec.nowPlayers) };
        break;
      case 'libWasted': params = { planet: P(rec.planet), players: fmt(rec.players), regen: big(rec.regen), target: P(rec.target) }; break;
      case 'libDecay': params = { planet: P(rec.planet), done: pct(rec.done), regen: big(rec.regen) }; break;
      case 'libOrder':
        if (rec.partial) key = 'libOrderPartial';
        params = { order: rec.segs.map((s, i) => fill(t(i ? 'orderThen' : 'orderFirst'), { a: P(s.planet) })).join('') + '.' };
        extra = timelineHTML(rec.segs, rec.H, `plan:${res.id}`); break;
      case 'libRegion':
        params = { planet: P(rec.planet), region: esc(rec.region || '?'), knock: rec.knock != null ? pct(rec.knock) : '—', hp: big(rec.hp), regen: big(rec.regen),
          order: rec.order.map(esc).join(' → '), spread: rec.spread ? fill(R('libRegionSpread'), { n: rec.spread }) : '' };
        break;
      case 'libDss': params = { p: pct(settings.dssBonus), planet: P(rec.planet), from: rec.from ? fill(R('libDssFrom'), { from: P(rec.from) }) : '' }; minor = true; break;
      case 'libHod': params = { planet: P(rec.planet), be: sharePct(rec.breakEven) }; minor = true; break;
      case 'defSend': params = { planet: P(rec.planet), when: clock(rec.hours), players: people(rec.players), nowPlayers: fmt(rec.nowPlayers) }; break;
      case 'defSkip': params = { planet: P(rec.planet) }; minor = true; break;
      case 'cntMove': {
        const ahead = rec.aheadFrom || (rec.idle ? [] : rec.from), idle = rec.idleFrom || (rec.idle ? rec.from : []);
        const parts = [];
        if (ahead.length) parts.push(fill(R('cntMoveAhead'), { from: listJoin(ahead.map(facName)), to: facName(rec.to), what: counterNoun(res) }));
        if (idle.length) parts.push(fill(R(idle.length > 1 ? 'cntMoveIdleN' : 'cntMoveIdle'), { from: listJoin(idle.map(facName)), to: facName(rec.to) }));
        params = { players: people(rec.players), from: listJoin(rec.from.map(facName)), to: facName(rec.to), why: parts.join(' ') };
        break;
      }
      case 'cntShort': params = { players: people(rec.players), to: facName(rec.to) }; cls = 'k-warn'; break;
      case 'cntBehind': {
        const tk = rec.task.task;
        params = { task: taskText(rec.task), more: sharePct(rec.more), needed: big(rec.needed), rate: big(rec.rate), proj: rec.task.projection != null && tk.goal ? projPct(rec.task.projection / tk.goal) : '—' };
        break;
      }
      case 'cntStart': params = { task: taskText(rec.task), needed: big(rec.needed) }; break;
      case 'cntWeapon': params = { item: esc(itemName(rec.task.task.itemId) || '') }; minor = true; break;
      case 'cntOk': params = { task: taskText(rec.task) }; minor = true; break;
    }
    const [head, detail, nums] = R(key) || [key, '', ''];
    return `<${tag} class="${minor ? 'minor ' : ''}${cls}">${icon ? `<span class="fi">${icon}</span>` : ''}<div>
      <div class="head">${fill(head, params)}</div>
      ${detail ? `<div class="detail">${fill(detail, params)}</div>` : ''}
      ${nums ? `<div class="nums">${fill(nums, params)}</div>` : ''}${extra}</div></${tag}>`;
  }
  // situation (what the numbers say) / moves (what to do) / already fine (nothing to do)
  const ASSESS = new Set(['libImpossible', 'libPartial']);
  const FINE = new Set(['cntOk', 'defSkip', 'libNOk', 'allDone']);

  function simOutHTML(res, share) {
    const sm = ENGINE.simulate(res, share);
    if (!sm) return '';
    const N = res.model.N;
    let cls, bigTxt, sub;
    if (sm.wins) { cls = 'v-ontrack'; bigTxt = t('simWin'); sub = fill(t('simWinSub'), { when: clock(sm.total) }); }
    else if (sm.count > 0) { cls = 'v-record'; bigTxt = fill(t('simPartial'), { k: sm.count, n: sm.n }); sub = fill(t('simPartialSub'), { list: listJoin(sm.taken.map(planetName)) }); }
    else { cls = 'v-impossible'; bigTxt = t('simNone'); sub = t('simNoneSub'); }
    return `<div class="sim-out ${cls}">
      <div class="big">${esc(bigTxt)}</div>
      <div class="sub">${fill(t('simShare'), { pct: `<b>${pct(share)}</b>`, players: people(share * N) })}</div>
      <div class="sub">${sub}</div>
      ${sm.wins || sm.count ? timelineHTML(sm.wins ? sm.segs : sm.segs.filter(s => sm.taken.includes(s.planet)), res.model.H, `sim:${res.id}`) : ''}
    </div>`;
  }

  function simHTML(res) {
    const lib = res.liberation;
    if (!lib || res.ended) return '';
    const cur = Math.max(0.05, Math.min(1, lib.currentShare));
    const val = ui.sim[res.id] ?? Math.round(cur * 100);
    const pos = (v) => ((v - 5) / 95) * 100;
    return `<section class="panel br sim" id="sim-${esc(res.id)}">
      <div class="sec-head"><h3>${t('simTitle')}</h3></div>
      <p class="q">${t('simQ')}</p>
      <div class="range-wrap">
        <span class="range-now" style="left:${pos(cur * 100)}%">${t('simNow')} ${pct(cur)}</span>
        <input type="range" min="5" max="100" step="1" value="${val}" data-sim="${esc(res.id)}" aria-label="${esc(t('simQ'))}" style="--p:${pos(val)}%">
      </div>
      <div class="presets">
        <button type="button" class="ghost" data-preset="${esc(res.id)}" data-v="${Math.round(cur * 100)}">${t('pNow')} · ${pct(cur)}</button>
        <button type="button" class="ghost" data-preset="${esc(res.id)}" data-v="${Math.round(settings.recordShare * 100)}">${t('pRec')} · ${pct(settings.recordShare)}</button>
        <button type="button" class="ghost" data-preset="${esc(res.id)}" data-v="100">${t('pAll')} · 100%</button>
      </div>
      <div id="simout-${esc(res.id)}" aria-live="polite">${simOutHTML(res, val / 100)}</div>
    </section>`;
  }

  function paceTasks(res) { return res.tasks.filter(r => r.counter && !r.simpleCount && r.primary && r.primary.rate > 0 && r.task.goal); }
  function paceOutHTML(res, m) {
    const H = res.hoursLeft;
    return paceTasks(res).map(r => {
      const tk = r.task;
      const projected = tk.progress + r.primary.rate * m * H;
      const pf = Math.min(1, projected / tk.goal), frac = Math.min(1, tk.progress / tk.goal);
      const need = r.needed / r.primary.rate;
      const ok = projected >= tk.goal;
      return `<div class="sim-task"><div class="row"><span>${taskText(r)}</span><span class="${ok ? 'v-ontrack' : 'v-record'}">${fill(t('paceReach'), { p: projPct(projected / tk.goal) })}${need > 1 ? ' · ' + fill(t('paceNeed'), { m: fmt(need, 1, 1) }) : ''}</span></div>
        <div class="bar">${pf > frac ? `<div class="proj" style="left:${frac * 100}%;width:${(pf - frac) * 100}%"></div>` : ''}<div class="fill" style="width:${frac * 100}%"></div><div class="goal"></div></div></div>`;
    }).join('');
  }
  function paceHTML(res) {
    if (res.ended || !paceTasks(res).length) return '';
    const val = ui.pace[res.id] ?? 100;
    const pos = (v) => ((v - 25) / 375) * 100;
    return `<section class="panel br sim" id="pace-${esc(res.id)}">
      <div class="sec-head"><h3>${t('paceTitle')}</h3></div>
      <p class="q">${t('paceQ')}: <b data-pace-lbl="${esc(res.id)}">×${fmt(val / 100, 2)}</b></p>
      <div class="range-wrap"><span class="range-now" style="left:${pos(100)}%">${t('simNow')}</span>
        <input type="range" min="25" max="400" step="5" value="${val}" data-pace="${esc(res.id)}" aria-label="${esc(t('paceQ'))}" style="--p:${pos(val)}%"></div>
      <div class="sim-tasks" id="paceout-${esc(res.id)}">${paceOutHTML(res, val / 100)}</div>
    </section>`;
  }

  /* a move: what to do, why it matters, what it changes */
  function effectText(e, subject) {
    if (!e) return '';
    const F = (k, p) => fill(t('fx.' + k), p);
    switch (e.kind) {
      case 'eta':
        if (e.next == null || !isFinite(e.next)) return '';
        if (!isFinite(e.now)) return F('etaNever', { planet: planetName(e.planet), next: clock(e.next) });
        return e.now - e.next > 0.5 ? F('eta', { planet: planetName(e.planet), next: clock(e.next), now: clock(e.now), saved: dur(e.now - e.next) }) : '';
      case 'saves': return F('saves', { planet: planetName(e.planet), h: dur(e.hours) });
      case 'decay': return F('decay', { p: pct(e.perHour, 1) });
      case 'gap': {
        if (e.more < 100) return '';
        const N = last ? last.N : 0;
        const w = e.weaponUse ? t('meterWeapon') : '';
        if (N && e.more > N) return F('gapAll', { n: people(e.more), x: fmt(e.more / N, e.more / N < 10 ? 1 : 0) }) + w;
        return (e.hours != null ? F('gapWhen', { n: people(e.more), when: clock(e.hours) }) : F('gap', { n: people(e.more) })) + w;
      }
      case 'proj': return e.next != null && e.next > e.now + 0.005 ? F(e.next < 1 ? 'projOnly' : 'projUp', { what: subject || t('fx.it'), now: pct(e.now), next: pct(Math.min(e.next, 9.99)) }) : F('proj', { now: pct(e.now) });
      case 'region': return F('region', { p: pct(e.knock) });
      default: return '';
    }
  }
  function moveHTML(m, res) {
    const MV = TEXT.mv[m.kind];
    if (!MV) return recItem(m, res);
    const P = (p) => planetName(p);
    const R = (k) => TEXT.r[k];
    const weapon = m.weapon ? fill(t('mvWeapon'), { item: esc(itemName(m.weapon)) }) : '';
    let p = {}, why = MV.why, extra = '';
    switch (m.kind) {
      case 'libFocus': {
        const v = m.variant === 'win' && (m.remaining || 1) <= 1 ? 'winLast' : m.variant;
        why = MV.why[v] || MV.why.more;
        p = { planet: P(m.planet), crowd: crowdText(m.players, m.nowPlayers), players: people(m.players), share: pct(m.share), nowPlayers: fmt(m.nowPlayers) };
        break;
      }
      case 'libWasted': p = { planets: listJoin(m.planets.map(P)), players: fmt(m.players), target: P(m.target) }; break;
      case 'libDecay': p = { planet: P(m.planet), done: pct(m.done), regen: big(m.regen) }; break;
      case 'libDss': p = { p: pct(settings.dssBonus), planet: P(m.planet), from: m.from ? fill(t('mvDssFrom'), { from: P(m.from) }) : '' }; break;
      case 'libRegion': p = { planet: P(m.planet), region: esc(m.region || '?'), hp: big(m.hp), regen: big(m.regen), order: m.order.map(esc).join(' → '),
        spread: m.spread ? fill(t('mvSpread'), { n: m.spread }) : '' }; break;
      case 'libHod': p = { planet: P(m.planet), be: sharePct(m.breakEven) }; break;
      case 'defSend': p = { planet: P(m.planet), when: clock(m.hours), players: people(m.players), nowPlayers: fmt(m.nowPlayers) }; break;
      case 'defWait': p = { left: fmt(m.left) }; break;
      case 'libNFocus': {
        const rest = m.list.slice(1).map(P);
        p = { planet: P(m.planet), left: fmt(m.left), then: rest.length ? fill(R('libNThen'), { list: listJoin(rest) }) : '',
          players: m.players != null ? people(m.players) : '—', share: m.share != null ? pct(m.share) : '—', nowPlayers: fmt(m.nowPlayers) };
        break;
      }
      case 'cntMove': {
        const ahead = m.aheadFrom || (m.idle ? [] : m.from), idle = m.idleFrom || (m.idle ? m.from : []);
        const parts = [];
        if (ahead.length) parts.push(fill(R('cntMoveAhead'), { from: listJoin(ahead.map(facName)), to: facName(m.to), what: counterNoun(res) }));
        if (idle.length) parts.push(fill(R(idle.length > 1 ? 'cntMoveIdleN' : 'cntMoveIdle'), { from: listJoin(idle.map(facName)), to: facName(m.to) }));
        p = { to: facName(m.to), why: parts.join(' '), weapon: '', players: people(m.players), short: m.short ? people(m.short) : '' };
        if (m.short) { why = t('mv.cntMoveShortWhy'); }
        break;
      }
      case 'cntShort': p = { to: facName(m.to), players: people(m.players) }; break;
      case 'cntBehind': p = { task: taskText(m.task), mult: fmt(1 + m.more, 1, 1), weapon: '', needed: big(m.needed), rate: big(m.rate) }; break;
      case 'cntWeapon': p = { item: esc(itemName(m.task.task.itemId) || '') }; break;
      case 'cntStart': p = { task: taskText(m.task), needed: big(m.needed) }; break;
    }
    const subj = m.task && m.task.task ? `${facName(m.task.task.faction)} ${t('what')[m.task.task.type] || t('what')[0]}`.trim() : null;
    let fx = effectText(m.effect, subj);
    if (m.kind === 'cntMove' && m.short) { const g = effectText({ kind: 'gap', more: m.short, weaponUse: m.shortWeaponUse }); if (g) fx = fx ? fx + '. ' + g : g; }
    const nums = MV.nums != null ? MV.nums : (R(m.kind) || [])[2] || '';
    return `<li class="move lvl-${res.verdict === 'nearly_impossible' && (m.level === 'critical' || m.level === 'high') ? 'long' : m.level || 'tip'}">
      <div class="mv-top"><span class="lvl">${esc(t('lv.' + (res.verdict === 'nearly_impossible' && (m.level === 'critical' || m.level === 'high') ? 'long' : m.level || 'tip')))}</span><h4>${fill(m.kind === 'cntMove' && m.short ? t('mv.cntMoveShortHead') : MV.head, p)}</h4></div>
      <p class="mv-why">${fill(why, p)}</p>
      ${m.weapon && (m.kind === 'cntMove' || m.kind === 'cntShort') ? `<p class="mv-req"><span class="label">${esc(t('mvReq'))}</span><b>${esc(itemName(m.weapon))}</b><span>${esc(t('mvReqS'))}</span></p>` : ''}
      ${fx ? `<p class="mv-fx">${ICON.target}<span>${fx}</span></p>` : ''}
      ${nums ? `<div class="nums">${fill(nums, p)}</div>` : ''}${extra}</li>`;
  }

  /* when the order can't be won: say so, and show how it got there instead of a plan */
  function storyFacts(entry) {
    const { res } = entry;
    const counters = res.tasks.filter(r => r.counter && !r.simpleCount && r.task.goal && r.verdict !== 'done' && r.primary && r.needed > 0)
      .map(r => ({ r, f: counterFacts(entry, r) })).sort((a, b) => (a.r.primary.rate / a.r.needed) - (b.r.primary.rate / b.r.needed));
    return { worst: counters[0] || null, counters };
  }
  function tile(label, value, sub, cls = '') {
    return `<div class="pm-tile ${cls}"><span class="label">${esc(label)}</span><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  }
  function factsHTML(entry, compact) {
    const { res } = entry, { worst } = storyFacts(entry), lib = res.liberation;
    const tiles = [];
    if (worst) {
      const { r, f } = worst, noun = `${facName(r.task.faction)} ${t('what')[r.task.type] || t('what')[0]}`.trim();
      if (f.fromStart && !compact) tiles.push(tile(t('pm.tStart'), big(f.fromStart) + '<small>/h</small>', esc(fill(t('pm.tStartS'), { what: noun }))));
      const day = r.primary && r.primary.kind === 'day';
      tiles.push(tile(t(day ? 'pm.tDay' : 'pm.tAvg'), big(f.avg) + '<small>/h</small>', f.fromStart ? esc(fill(t('pm.tAvgS'), { p: pct(f.avg / f.fromStart) })) : ''));
      if (f.best > f.avg * 1.05) tiles.push(tile(t('pm.tBest'), big(f.best) + '<small>/h</small>', esc(t('pm.tBestS'))));
      tiles.push(tile(t('pm.tNeed'), big(f.needed) + '<small>/h</small>', esc(fill(t('pm.tNeedS'), { x: fmt(f.needed / f.avg, 1, 1) })), 'key'));
    } else if (lib && isFinite(lib.currentShare)) {
      tiles.push(tile(t('pm.tPlNow'), pct(lib.currentShare), esc(t('pm.tPlNowS'))));
      tiles.push(tile(t('pm.tPlNeed'), sharePct(lib.seqNeed), esc(fill(t('pm.tPlNeedS'), { n: people((isFinite(lib.seqNeed) ? lib.seqNeed : 5) * res.model.N) })), 'key'));
      tiles.push(tile(t('pm.tRecord'), pct(settings.recordShare), esc(t('pm.tRecordS'))));
    }
    return tiles.length ? `<div class="pm-tiles">${tiles.join('')}</div>` : '';
  }
  function storyHTML(entry) {
    const { res, a } = entry, { worst } = storyFacts(entry);
    const items = [];
    const at = (ms) => new Date(ms).toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    const end = Date.parse(a.expiration);
    const fromDayOne = worst && worst.f.ponr && entry.start && worst.f.ponr - entry.start < 3.6e6;
    if (entry.start && worst) items.push({ t: entry.start, cls: fromDayOne ? 'bad' : '', html: fill(t(fromDayOne ? 'pm.sStartOut' : 'pm.sStart'), { need: worst.f.fromStart ? big(worst.f.fromStart) : '—', best: big(worst.f.best), what: esc(`${facName(worst.r.task.faction)} ${t('what')[worst.r.task.type] || ''}`.trim()) }) });
    else if (entry.start) items.push({ t: entry.start, html: fill(t(res.tasks.length === 1 ? 'pm.sStartAny1' : 'pm.sStartAny'), { d: dur((end - entry.start) / 3.6e6), n: res.tasks.length }) });
    for (const x of alerts.filter(al => al.kind === 'edited' && al.order === String(a.id))) items.push({ t: x.t, html: alertText(x, false) });
    if (worst && worst.f.ponr && !fromDayOne) items.push({ t: worst.f.ponr, cls: 'bad', html: fill(t('pm.sPonr'), { best: big(worst.f.best) }) });
    const lib = res.liberation;
    if (!worst && lib && isFinite(lib.currentShare)) items.push({ t: last.now, cls: 'now', html: fill(t('pm.sNowLib'), { need: sharePct(lib.seqNeed), rec: pct(settings.recordShare) }) });
    for (const r of res.tasks.filter(x => x.verdict === 'done')) items.push({ t: last.now - 1, cls: 'ok', html: fill(t('pm.sDone'), { task: taskText(r) }) });
    if (worst) items.push({ t: last.now, cls: 'now', html: fill(t('pm.sNow'), { p: projPct(worst.r.projection / worst.r.task.goal) }) });
    if (!items.length) return '';
    items.sort((x, y) => x.t - y.t);
    return `<ol class="pm-story">${items.map(it => `<li class="${it.cls || ''}"><span class="when">${esc(it.cls === 'now' ? t('h.now') : it.cls === 'ok' ? t('pm.so') : at(it.t))}</span><p>${it.html}</p></li>`).join('')}</ol>`;
  }
  function postmortemHTML(entry) {
    const { res, a } = entry, lost = res.ended || res.verdict === 'failed';
    return `<section class="plan postmortem" id="steps-${esc(res.id)}">
      <div class="pm-head">${ICON.cross}<div><h3>${esc(t(lost ? 'pm.lostTitle' : 'pm.title'))}</h3><p>${esc(t(lost ? 'pm.lostSub' : 'pm.sub'))}</p></div></div>
      ${factsHTML(entry)}
      <span class="label sub-label">${esc(t('pm.howTitle'))}</span>${storyHTML(entry)}
      <button type="button" class="ghost" data-goto="history" data-scroll="tabs">${esc(t('pm.chart'))} ›</button>
      <div class="pm-still"><span class="label">${esc(t('pm.stillTitle'))}</span><p>${esc(t(lost ? 'pm.stillLost' : 'pm.still'))}</p></div>
    </section>`;
  }
  function strategyHTML(res, entry) {
    if (entry && (res.verdict === 'impossible' || res.verdict === 'failed' || (res.ended && res.verdict !== 'done'))) return postmortemHTML(entry);
    const longShot = entry && res.verdict === 'nearly_impossible' ? `<div class="longshot"><div class="pm-head small">${ICON.warn}<div><h3>${esc(t('pm.longTitle'))}</h3><p>${esc(t('pm.longSub'))}</p></div></div>${factsHTML(entry, true)}</div>` : '';
    const recs = res.recs || [];
    const assess = recs.filter(r => ASSESS.has(r.kind));
    const fine = recs.filter(r => FINE.has(r.kind));
    const order = recs.find(r => r.kind === 'libOrder');
    const all = recs.filter(r => !ASSESS.has(r.kind) && !FINE.has(r.kind) && r.kind !== 'libOrder');
    // the moves that decide the outcome up front, the rest folded away
    const main = all.filter(r => r.level === 'critical' || r.level === 'high').slice(0, 4);
    const tips = all.filter(r => !main.includes(r));
    const moves = main.length ? main : tips.splice(0, 3);
    const sitCls = assess.some(r => r.kind === 'libImpossible') ? 'k-bad' : 'k-warn';
    const lostNow = res.verdict === 'impossible' || (res.directive && res.directive.kind === 'lost');
    return `<section class="plan ${ui.showNums ? 'show-nums' : ''}" id="steps-${esc(res.id)}">
        ${longShot}
        <div class="sec-head"><h3>${t('planTitle')}</h3>
          <button type="button" class="ghost" data-toggle-nums aria-pressed="${ui.showNums}">${ui.showNums ? t('hideNums') : t('showNums')}</button></div>
        ${moves.length ? `<ol class="moves">${moves.map(r => moveHTML(r, res)).join('')}</ol>
          ${tips.length ? `<details class="more-tips"><summary>${ICON.chev}<span>${fill(t('moreTips'), { n: tips.length })}</span></summary><ol class="moves minor" style="counter-reset: mv ${moves.length}">${tips.map(r => moveHTML(r, res)).join('')}</ol></details>` : ''}`
          : res.directive && res.directive.kind === 'play' ? `<p class="empty-moves unknown">${ICON.dots}<span>${t('noMovesUnknown')}</span></p>`
          : res.ended && res.verdict !== 'done' ? `<p class="empty-moves lost">${ICON.cross}<span>${t('noMovesEnded')}</span></p>`
          : lostNow ? `<p class="empty-moves lost">${ICON.cross}<span>${t('noMovesLost')}</span></p>` : `<p class="empty-moves">${ICON.check}<span>${t('noMoves')}</span></p>`}
        ${assess.length || order ? `<span class="label sub-label">${t('bigPicture')}</span>` : ''}
        ${assess.length ? `<div class="situation ${sitCls}"><span class="label">${t('sitTitle')}</span>${assess.map(r => recItem(r, res, 'div')).join('')}</div>` : ''}
        ${order ? `<div class="the-plan"><span class="label">${t(order.partial ? 'planBlockPartial' : res.liberation && !res.liberation.winnableNow ? 'planBlockIf' : 'planBlock')}</span>
          <p>${order.segs.map((s, i) => fill(t(i ? 'orderThen' : 'orderFirst'), { a: planetName(s.planet) })).join('')}.</p>${timelineHTML(order.segs, order.H, `plan:${res.id}`)}</div>` : ''}
        ${fine.length ? `<details class="more-tips fine-box"><summary>${ICON.chev}<span>${fill(t('fineN'), { n: fine.length })}</span></summary><ul class="fine">${fine.map(r => recItem(r, res, 'li', ICON.check)).join('')}</ul></details>` : ''}
      </section>
      ${simHTML(res) || paceHTML(res) ? `<details class="sim-box" data-simbox="${esc(res.id)}" ${ui.simOpen[res.id] ? 'open' : ''}><summary>${ICON.chev}<span>${t('simBox')}</span></summary>${simHTML(res)}${paceHTML(res)}</details>` : ''}`;
  }

  /* ---------- history: how the order got here (interactive charts) ---------- */
  // Each chart: SVG paths drawn in a 1000 x 300 box stretched to the card (strokes keep their width),
  // HTML for every label, and a crosshair + tooltip that follow the pointer.
  const charts = {};
  const HOPELESS = new Set(['impossible', 'nearly_impossible', 'failed']);
  const CW = 1000, CH = 300;
  const hhmm = (ms) => new Date(ms).toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  // one point every 90 s at most (the newest one always kept)
  function thinPts(raw) {
    const pts = [];
    raw.forEach((q, i) => { if (!pts.length || q[0] - pts[pts.length - 1][0] >= 90e3) pts.push(q); else if (i === raw.length - 1) pts[pts.length - 1] = q; });
    return pts;
  }
  function seriesAt(pts, x) {   // value of a polyline at time x (linear between points)
    if (!pts.length || x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= x) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi];
    return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
  }
  function chartHTML(c) {
    const X = (x) => ((x - c.x0) / (c.x1 - c.x0)) * CW, Y = (y) => CH - ((y - c.y0) / (c.y1 - c.y0)) * CH;
    const path = (pts) => pts.map((q, i) => `${i ? 'L' : 'M'}${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join('');
    const pctX = (x) => Math.max(0, Math.min(100, ((x - c.x0) / (c.x1 - c.x0)) * 100));
    const pctY = (y) => Math.max(0, Math.min(100, ((y - c.y0) / (c.y1 - c.y0)) * 100));
    const hidden = ui.chartOff[c.id] || {};
    const lines = c.series.filter(sr => sr.pts.length > 1).map(sr => `<path class="ln ${sr.cls}${hidden[sr.key] ? ' off' : ''}" data-s="${sr.key}" d="${path(sr.pts)}" vector-effect="non-scaling-stroke"/>`
      + (sr.area ? `<path class="area ${sr.cls}${hidden[sr.key] ? ' off' : ''}" data-s="${sr.key}" d="${path(sr.pts)}L${X(sr.pts[sr.pts.length - 1][0]).toFixed(1)},${CH}L${X(sr.pts[0][0]).toFixed(1)},${CH}Z"/>` : '')).join('');
    const bars = (c.bars || []).map(b => `<rect class="bar-r ${b.cls || ''}" x="${X(b.x0).toFixed(1)}" width="${Math.max(1, X(b.x1) - X(b.x0) - 3).toFixed(1)}" y="${Y(b.y).toFixed(1)}" height="${(CH - Y(b.y)).toFixed(1)}"/>`).join('');
    const gaps = (c.gaps || []).map(g => `<div class="ch-gap" style="left:${pctX(g[0])}%;width:${pctX(g[1]) - pctX(g[0])}%"><span>${esc(t('h.unrecorded'))}</span></div>`).join('');
    const yt = c.yTicks.map(v => `<span class="yt" style="bottom:${pctY(v)}%">${c.fmtY(v)}</span><i class="grid" style="bottom:${pctY(v)}%"></i>`).join('');
    const xt = c.xTicks.map(v => `<span class="xt" style="left:${pctX(v)}%">${esc(v.label || new Date(v).toLocaleDateString(locale(), { weekday: 'short' }))}</span>`).join('');
    const marks = (c.marks || []).map(m => `<div class="ch-mark ${m.cls}" style="left:${pctX(m.x)}%"><i class="hd"></i></div>`).join('');
    const hl = (c.hlines || []).map(h => `<div class="ch-h ${h.cls}" style="bottom:${pctY(h.y)}%"><span>${esc(h.label)}</span></div>`).join('');
    const edge = (g) => pctX(g.x) > 98.5;
    const tags = (c.tags || []).map(g => `<span class="ch-tag ${g.cls}${edge(g) ? ' edge' : ''}${hidden[g.key] ? ' off' : ''}" data-s="${g.key}" style="${edge(g) ? '' : `left:${pctX(g.x)}%;`}bottom:${pctY(g.y)}%">${esc(g.text)}</span>`).join('');
    charts[c.id] = c;
    return `<div class="chart${(c.tags || []).some(edge) ? ' has-edge' : ''}" data-chart="${esc(c.id)}" role="img" aria-label="${esc(c.aria || '')}">
      <div class="plot">${yt}${gaps}<svg viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="none" aria-hidden="true">${bars}${lines}</svg>${hl}${marks}${tags}
        <div class="ch-cross"></div><div class="ch-dot"></div><div class="ch-tip" aria-live="polite"></div></div>
      <div class="xaxis">${xt}</div></div>`;
  }
  function legendHTML(id, items) {
    const hidden = ui.chartOff[id] || {};
    return `<div class="ch-legend">${items.map(it => `<button type="button" class="lg ${it.cls}" data-legend="${esc(id)}" data-s="${it.key}" aria-pressed="${!hidden[it.key]}"><i></i>${esc(it.label)}</button>`).join('')}</div>`;
  }
  function niceTicks(max, n = 4) {
    if (!(max > 0)) return [0];
    const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => k >= raw) || raw;
    const out = []; for (let v = 0; v <= max + 1e-9; v += step) out.push(v);
    return out;
  }
  function dayTicks(x0, x1) {
    const out = [], d = new Date(x0); d.setHours(0, 0, 0, 0);
    for (d.setDate(d.getDate() + 1); d.getTime() < x1; d.setDate(d.getDate() + 1)) out.push(d.getTime());   // calendar days (DST-safe)
    return out.length > 8 ? out.filter((_, i) => i % 2 === 0) : out;
  }
  // progress of one counter objective since the order began: recorder points, this browser's samples, now
  function counterSeries(entry, r) {
    const id = String(entry.a.id), i = r.idx, raw = [];
    for (const x of recordProgress?.orders?.[id]?.pts || []) if (x[1 + i] != null) raw.push([x[0], Number(x[1 + i])]);
    for (const sm of samples) {
      const k = sm.prog && Object.keys(sm.prog).find(k2 => k2.startsWith(id + ':'));
      if (k && sm.prog[k] && sm.prog[k][i] != null) raw.push([sm.t, Number(sm.prog[k][i])]);
    }
    raw.push([last.now, Number(r.task.progress)]);
    raw.sort((a, b) => a[0] - b[0]);
    return thinPts(raw);
  }
  // kills (or other counts) per hour, from the stretches actually recorded
  function hourly(pts) {
    const b = new Map();
    for (let k = 1; k < pts.length; k++) {
      const [ta, va] = pts[k - 1], [tb, vb] = pts[k];
      if (tb - ta > 40 * 60e3 || vb < va) continue;
      for (let h = Math.floor(ta / 3.6e6); h * 3.6e6 < tb; h++) {
        const s0 = Math.max(ta, h * 3.6e6), s1 = Math.min(tb, (h + 1) * 3.6e6);
        if (s1 <= s0) continue;
        const e = b.get(h) || { v: 0, span: 0 };
        e.v += (vb - va) * (s1 - s0) / (tb - ta); e.span += s1 - s0; b.set(h, e);
      }
    }
    return [...b.entries()].filter(([, e]) => e.span >= 30 * 60e3).map(([h, e]) => ({ x0: h * 3.6e6, x1: (h + 1) * 3.6e6, rate: e.v * 3.6e6 / e.span }));
  }
  // the moment the order slipped out of reach: from then on, the pace still needed was more than the
  // best hour this order ever had
  function pointOfNoReturn(pts, goal, end, best) {
    if (!(best > 0) || pts.length < 2) return null;
    const need = (tt, v) => end > tt ? (goal - v) * 3.6e6 / (end - tt) : Infinity;
    if (need(pts[pts.length - 1][0], pts[pts.length - 1][1]) <= best) return null;
    let at = null;
    for (let k = pts.length - 1; k > 0; k--) {
      const [ta, va] = pts[k - 1], [tb, vb] = pts[k];
      for (let s = 20; s >= 0; s--) {
        const tt = ta + (tb - ta) * s / 20, v = va + (vb - va) * s / 20;
        if (need(tt, v) > best) at = tt; else return at;
      }
    }
    return at;
  }
  function counterFacts(entry, r) {
    const tk = r.task, end = Date.parse(entry.a.expiration), start = entry.start;
    const pts = counterSeries(entry, r);
    const hours = hourly(pts);
    const recent = r.rates.recent ? r.rates.recent.rate : null;
    const avg = r.primary ? r.primary.rate : null;
    const best = Math.max(0, ...hours.map(h => h.rate), recent || 0, avg || 0);
    const total = start && end > start ? (end - start) / 3.6e6 : null;
    return { pts, hours, end, start, avg, recent, best, needed: r.needed, fromStart: total ? tk.goal / total : null,
      ponr: tk.goal && HOPELESS.has(r.verdict) ? pointOfNoReturn(start ? [[start, 0], ...pts.filter(q => q[0] > start)] : pts, tk.goal, end, best) : null };
  }
  function counterChart(entry, r, mode) {
    const tk = r.task, f = counterFacts(entry, r), now = last.now, H = entry.res.hoursLeft;
    const id = `c:${entry.a.id}:${r.idx}:${mode}`;
    const x0 = f.start || f.pts[0][0], x1 = Math.max(f.end, now);
    const fac = tk.faction ? 'f-' + tk.faction : 'f-none';
    if (mode === 'hour') {
      if (f.hours.length < 2) return `<p class="ch-empty">${esc(t('h.fewHours'))}</p>`;
      const hx0 = f.hours[0].x0, hx1 = Math.max(now, f.hours[f.hours.length - 1].x1);
      const top = Math.max(f.needed || 0, ...f.hours.map(h => h.rate)) * 1.12;
      const c = { id, x0: hx0, x1: hx1, y0: 0, y1: top, series: [], fmtY: big, yTicks: niceTicks(top),
        xTicks: f.hours.filter((h, i) => i % Math.ceil(f.hours.length / 6) === 0).map(h => Object.assign(Number(h.x0), { label: new Date(h.x0).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' }) })),
        bars: f.hours.map(h => ({ x0: h.x0, x1: h.x1, y: h.rate, cls: f.needed && h.rate >= f.needed ? 'ok ' + fac : fac })),
        hlines: [f.needed && r.verdict !== 'done' ? { y: f.needed, cls: 'need', label: fill(t('h.needLine'), { v: big(f.needed) }) } : null, f.avg ? { y: f.avg, cls: 'avg', label: fill(t('h.avgLine'), { v: big(f.avg) }) } : null].filter(Boolean),
        kind: 'hour', hours: f.hours, aria: t('h.hourAria') };
      return chartHTML(c);
    }
    const projEnd = f.avg != null ? tk.progress + f.avg * H : null, recEnd = f.recent != null ? tk.progress + f.recent * H : null;
    // a pace far beyond the goal would squash the chart: lines stop where they cross 1.6x the goal
    const cap = tk.goal ? tk.goal * 1.6 : Infinity;
    const projLine = (endV) => endV <= cap || !(endV > tk.progress) ? [[now, tk.progress], [f.end, endV]] : [[now, tk.progress], [now + (f.end - now) * (cap - tk.progress) / (endV - tk.progress), cap]];
    const top = Math.max(tk.goal || 0, Math.min(cap, Math.max(projEnd || 0, recEnd || 0)), ...f.pts.map(q => q[1])) * 1.08;
    const actual = f.start ? [[f.start, 0], ...f.pts.filter(q => q[0] > f.start)] : f.pts;
    const firstRec = f.pts.find(q => f.start && q[0] > f.start + 60e3);
    const gap = f.start && firstRec && firstRec[0] - f.start > 2 * 3.6e6 ? [f.start, firstRec[0]] : null;
    const done = r.verdict === 'done', ended = entry.res.ended;
    const series = [
      { key: 'act', cls: 'act ' + fac, pts: gap ? actual.filter(q => q[0] >= gap[1]) : actual, area: true, name: t('h.lgAct'), tip: t('h.lnAct') },
      gap ? { key: 'act', cls: 'act gapline ' + fac, pts: [[gap[0], 0], firstRec], name: t('h.lgAct'), tip: t('h.lnGap') } : null,
      !done && !ended ? { key: 'need', cls: 'need', pts: [[now, tk.progress], [f.end, tk.goal]], name: t('h.lgNeed'), tip: fill(t('h.lnNeed'), { v: big(f.needed) }) } : null,
      !done && !ended && projEnd != null ? { key: 'avg', cls: 'proj', pts: projLine(projEnd), name: fill(t('h.lgAvg'), { basis: t('why.basis.' + (r.primary?.kind || 'start')) }), tip: fill(t('h.lnAvg'), { v: big(f.avg), p: projPct(projEnd / tk.goal), basis: t('why.basis.' + (r.primary?.kind || 'start')) }) } : null,
      !done && !ended && recEnd != null && Math.abs(recEnd - (projEnd || 0)) / (tk.goal || 1) > 0.02 ? { key: 'rec', cls: 'proj2', pts: projLine(recEnd), name: t('h.lgRec'), tip: fill(t('h.lnRec'), { v: big(f.recent), p: projPct(recEnd / tk.goal) }) } : null,
    ].filter(Boolean);
    const tagsArr = [];
    if (!done && !ended && projEnd != null) tagsArr.push({ key: 'avg', cls: 'proj', x: projLine(projEnd)[1][0], y: Math.min(projEnd, cap), text: projPct(projEnd / tk.goal) });
    if (series.some(sr => sr.key === 'rec')) tagsArr.push({ key: 'rec', cls: 'proj2', x: projLine(recEnd)[1][0], y: Math.min(recEnd, cap), text: projPct(recEnd / tk.goal) });
    const c = { id, x0, x1, y0: 0, y1: top, series, fmtY: big, yTicks: niceTicks(top), xTicks: dayTicks(x0, x1), gaps: gap ? [gap] : [],
      hlines: tk.goal ? [{ y: tk.goal, cls: 'goal', label: fill(t('h.goal'), { v: big(tk.goal) }) }] : [],
      marks: [{ x: now, cls: 'now', label: t('h.now'), tip: hhmm(now) },
        f.ponr ? { x: f.ponr, cls: 'ponr', label: t('h.ponr'), tip: fill(t('h.ponrTip'), { best: big(f.best) }) } : null,
        f.end > now ? { x: f.end, cls: 'end', label: t('h.deadline'), tip: fill(t('h.endTip'), { when: hhmm(f.end) }) } : null].filter(Boolean),
      tags: tagsArr, kind: 'count', goal: tk.goal, actual, now, progress: tk.progress, end: f.end, avg: f.avg, recent: f.recent, gap, aria: t('h.progAria') };
    return chartHTML(c);
  }
  // liberation of the planets an objective names, over time
  function planetSeries(idx) {
    const p = last.planets[idx], raw = [];
    for (const x of recordProgress?.planets?.[idx] || []) raw.push([x[0], x[1]]);
    const m = p ? (p.event ? p.event.maxHealth : p.maxHealth) : null;
    if (m) for (const sm of samples) { const v = sm.planets && sm.planets[idx]; if (v && v.h != null) raw.push([sm.t, 1 - v.h / m]); }
    if (p && m) raw.push([last.now, 1 - (p.event ? p.event.health : p.health) / m]);
    raw.sort((a, b) => a[0] - b[0]);
    return thinPts(raw);
  }
  function libChart(entry, rows) {
    const id = `l:${entry.a.id}`, now = last.now, end = Date.parse(entry.a.expiration), H = entry.res.hoursLeft;
    const all = rows.map((r, k) => ({ r, k, pts: planetSeries(r.planet.index) })).filter(x => x.pts.length);
    if (!all.length) return '';
    const x0 = Math.min(entry.start || now, ...all.map(x => x.pts[0][0])), x1 = Math.max(end, now);
    const series = [], tags = [];
    all.forEach(({ r, k, pts }) => {
      const key = 'p' + r.planet.index, cls = `pl s${(k % 4) + 1}`;
      series.push({ key, cls, pts, name: plain(planetName(r.planet)), tip: t('h.lnPlanet') });
      if (r.pw && isFinite(r.eta) && r.eta > 0 && !entry.res.ended) {
        const tEnd = now + Math.min(r.eta, H * 1.6) * 3.6e6, frac = pts[pts.length - 1][1];
        const reach = r.eta <= H * 1.6 ? 1 : frac + (1 - frac) * (H * 1.6 / r.eta);
        series.push({ key, cls: cls + ' proj', pts: [[now, frac], [tEnd, reach]], name: plain(planetName(r.planet)), tip: r.eta <= H ? fill(t('h.lnFalls'), { when: clock(r.eta) }) : t('h.lnLate') });
        if (r.eta <= H) tags.push({ key, cls: 'pl s' + ((k % 4) + 1), x: tEnd, y: 1, text: clock(r.eta) });
      }
    });
    const c = { id, x0, x1: Math.max(x1, ...series.map(sr => sr.pts[sr.pts.length - 1][0])), y0: 0, y1: 1.06, series, tags,
      fmtY: (v) => pct(v), yTicks: [0, 0.25, 0.5, 0.75, 1], xTicks: dayTicks(x0, x1),
      hlines: [], marks: [{ x: now, cls: 'now', label: t('h.now'), tip: hhmm(now) }, { x: end, cls: 'end', label: t('h.deadline'), tip: fill(t('h.endTip'), { when: hhmm(end) }) }],
      kind: 'lib', now, planets: all.map(({ r, pts }) => ({ key: 'p' + r.planet.index, name: plain(planetName(r.planet)), pts, proj: (series.find(sr => sr.key === 'p' + r.planet.index && sr.cls.includes('proj')) || {}).pts || null })), aria: t('h.libAria') };
    return chartHTML(c) + legendHTML(id, all.map(({ r, k }) => ({ key: 'p' + r.planet.index, cls: `pl s${(k % 4) + 1}`, label: plain(planetName(r.planet)) })));
  }
  function historyHTML(entry) {
    const { res } = entry;
    const cards = [];
    const libRows = res.tasks.filter(r => r.planet && (r.pw || r.task.type === 11 || r.task.type === 13));
    if (libRows.length) cards.push(`<section class="hist-card panel br"><div class="hc-head"><h4>${esc(t('h.libTitle'))}</h4></div>${libChart(entry, libRows)}</section>`);
    const doneList = res.tasks.filter(x => x.counter && !x.simpleCount && x.task.goal && x.verdict === 'done');
    for (const r of res.tasks.filter(x => x.counter && !x.simpleCount && x.task.goal && x.verdict !== 'done')) {
      const mode = (ui.histMode[`${entry.a.id}:${r.idx}`]) || 'prog';
      const f = counterFacts(entry, r);
      const stat = r.verdict === 'done' ? t('h.statDone') : f.needed && f.avg ? fill(t(f.avg >= f.needed ? 'h.statOk' : 'h.stat'), { need: big(f.needed), avg: big(f.avg), x: fmt(f.needed / f.avg, 1, 1), basis: t('why.basis.' + (r.primary?.kind || 'start')) }) : '';
      const key = `${entry.a.id}:${r.idx}`, cid = `c:${entry.a.id}:${r.idx}:prog`;
      cards.push(`<section class="hist-card panel br">
        <div class="hc-head"><h4>${taskText(r)}</h4>${pill(r.verdict)}
          <div class="seg" role="group" aria-label="${esc(t('h.view'))}">
            <button type="button" data-hmode="${esc(key)}" data-v="prog" aria-pressed="${mode === 'prog'}">${esc(t('h.prog'))}</button>
            <button type="button" data-hmode="${esc(key)}" data-v="hour" aria-pressed="${mode === 'hour'}">${esc(t('h.hour'))}</button></div></div>
        ${stat ? `<p class="hc-stat">${stat}</p>` : ''}
        ${counterChart(entry, r, mode)}
        ${mode === 'prog' ? legendHTML(cid, [{ key: 'act', cls: 'act', label: t('h.lgAct') }, r.verdict !== 'done' && !res.ended ? { key: 'need', cls: 'need', label: t('h.lgNeed') } : null,
          r.verdict !== 'done' && !res.ended && f.avg ? { key: 'avg', cls: 'proj', label: fill(t('h.lgAvg'), { basis: t('why.basis.' + (r.primary?.kind || 'start')) }) } : null,
          r.verdict !== 'done' && !res.ended && f.recent != null ? { key: 'rec', cls: 'proj2', label: t('h.lgRec') } : null].filter(Boolean)) : ''}
      </section>`);
    }
    if (doneList.length) cards.push(`<section class="hist-card panel br done-card">${doneList.map(r => `<div class="hc-head"><h4>${taskText(r)}</h4>${pill('done')}</div>`).join('')}</section>`);
    for (const r of res.tasks.filter(x => x.defense)) {
      cards.push(`<section class="hist-card panel br"><div class="hc-head"><h4>${taskText(r)}</h4>${pill(r.verdict)}</div>${libChart(entry, [r])}</section>`);
    }
    if (!cards.length) return `<p class="empty-moves unknown">${ICON.dots}<span>${esc(t('h.nothing'))}</span></p>`;
    const since = record && record.since ? fill(t('h.foot'), { when: new Date(record.since).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }) : t('h.footLocal');
    return `<div class="history">${cards.join('')}<p class="foot">${esc(since)}</p></div>`;
  }
  // Labels never sit on top of each other, whatever the width: after layout, labels above the plot
  // stack into rows, labels in the right margin spread apart, and line labels that collide swap sides.
  const hit = (a, b) => a.left < b.right + 4 && b.left < a.right + 4 && a.top < b.bottom + 2 && b.top < a.bottom + 2;
  function layoutChart(el) {
    const plot = el.querySelector('.plot'); if (!plot) return;
    const placed = [];
    const edge = [...el.querySelectorAll('.ch-tag.edge')].sort((a, b) => parseFloat(b.style.bottom) - parseFloat(a.style.bottom));
    edge.forEach(g => { g.style.transform = ''; });
    let prevBottom = -Infinity;
    for (const g of edge) {
      const r = g.getBoundingClientRect();
      const shift = Math.max(0, prevBottom + 3 - r.top);
      if (shift) g.style.transform = `translateY(calc(50% + ${shift}px))`;
      prevBottom = r.bottom + shift;
    }
    const inner = [...el.querySelectorAll('.ch-tag:not(.edge)')]; const seen = [];
    for (const g of inner) { g.style.marginBottom = ''; let k = 0, r = g.getBoundingClientRect(); while (k < 4 && seen.some(p => hit(p, r))) { k++; g.style.marginBottom = (k * 20) + 'px'; r = g.getBoundingClientRect(); } seen.push(r); }
    const hl = [...el.querySelectorAll('.ch-h span')]; const hs = [];
    for (const sp of hl) { sp.classList.remove('flip'); const r = sp.getBoundingClientRect(); if (hs.some(p => hit(p, r)) || placed.some(p => hit(p, r))) sp.classList.add('flip'); hs.push(sp.getBoundingClientRect()); }
  }
  // timeline: events close in time take separate lanes under the line instead of piling up
  function layoutIntel() {
    document.querySelectorAll('.it-track').forEach(tr => {
      const dots = [...tr.querySelectorAll('.it-dot')].sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
      const w = tr.getBoundingClientRect().width, lanes = [];
      let maxLane = 0;
      for (const d of dots) {
        const x = parseFloat(d.style.left) / 100 * w;
        let k = 0; while (lanes[k] != null && x - lanes[k] < 30) k++;
        lanes[k] = x; maxLane = Math.max(maxLane, k);
        d.style.top = (-12 + k * 32) + 'px';
      }
      tr.parentElement.style.paddingBottom = (18 + maxLane * 32) + 'px';
      const nowX = w;
      let lastRight = -Infinity;
      tr.querySelectorAll('.it-tick').forEach(tk => {
        tk.style.visibility = '';
        const r = tk.getBoundingClientRect(), x = parseFloat(tk.style.left) / 100 * w;
        const hide = nowX - x < 80 || r.left < lastRight + 24 || r.left < tr.parentElement.getBoundingClientRect().left + 2;
        tk.style.visibility = hide ? 'hidden' : '';
        if (!hide) lastRight = r.right;
      });
    });
  }
  const layoutCharts = () => { document.querySelectorAll('.chart').forEach(layoutChart); layoutIntel(); };
  window.addEventListener('resize', () => { cancelAnimationFrame(layoutCharts.raf); layoutCharts.raf = requestAnimationFrame(layoutCharts); });

  // crosshair + tooltip
  // what is under the pointer: a marker line (now, deadline...) or one of the chart's lines
  function chartTarget(c, el, clientX, clientY) {
    const rect = el.querySelector('.plot').getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    const toPx = (x) => (x - c.x0) / (c.x1 - c.x0) * rect.width, toPy = (y) => rect.height - (y - c.y0) / (c.y1 - c.y0) * rect.height;
    const mark = (c.marks || []).map(m => ({ m, d: Math.abs(toPx(m.x) - px) })).filter(o => o.d < 7).sort((a, b) => a.d - b.d)[0];
    if (mark) return { mark: mark.m };
    const off = ui.chartOff[c.id] || {}, x = c.x0 + px / rect.width * (c.x1 - c.x0);
    let best = null;
    for (const sr of c.series || []) {
      if (off[sr.key] || !sr.name) continue;
      const v = seriesAt(sr.pts, x); if (v == null) continue;
      const d = Math.abs(toPy(v) - py);
      if (d < 14 && (!best || d < best.d)) best = { sr, d };
    }
    return best ? { series: best.sr } : {};
  }
  function chartHover(el, clientX, clientY) {
    const c = charts[el.dataset.chart]; if (!c) return;
    const plot = el.querySelector('.plot'), rect = plot.getBoundingClientRect();
    const fx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const x = c.x0 + fx * (c.x1 - c.x0);
    const tip = el.querySelector('.ch-tip'), cross = el.querySelector('.ch-cross'), dot = el.querySelector('.ch-dot');
    const tg = clientY != null ? chartTarget(c, el, clientX, clientY) : {};
    el.querySelectorAll('.ln, .area').forEach(n => { n.classList.toggle('hl', !!tg.series && n.dataset.s === tg.series.key); n.classList.toggle('dim', !!tg.series && n.dataset.s !== tg.series.key); });
    el.querySelectorAll('.ch-mark').forEach((n, i) => n.classList.toggle('hl', !!tg.mark && c.marks[i] === tg.mark));
    let html = '', y = null;
    if (tg.mark) html += `<em class="what ${tg.mark.cls}">${esc(tg.mark.label)}</em><span class="what-s">${esc(tg.mark.tip || '')}</span>`;
    else if (tg.series) html += `<em class="what ${tg.series.cls}">${esc(tg.series.name)}</em><span class="what-s">${esc(tg.series.tip || '')}</span>`;
    if (c.kind === 'hour') {
      const h = c.hours.find(b => x >= b.x0 && x < b.x1);
      if (!h) { el.classList.remove('hover'); return; }
      html += `<b>${esc(new Date(h.x0).toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' }))}</b><span>${esc(fill(t('h.tipHour'), { v: big(h.rate) }))}</span>`;
      y = h.rate;
    } else if (c.kind === 'count') {
      html += `<b>${esc(hhmm(x))}</b>`;
      if (x <= c.now) {
        y = seriesAt(c.actual, x);
        const inGap = c.gap && x < c.gap[1];
        if (y != null) html += `<span>${esc(fill(t(inGap ? 'h.tipEst' : 'h.tipDone'), { v: big(y), p: c.goal ? pct(y / c.goal) : '' }))}</span>`;
      } else {
        const fr = (x - c.now) / (c.end - c.now);
        const need = c.progress + (c.goal - c.progress) * fr;
        if (c.avg != null) { y = c.progress + c.avg * (x - c.now) / 3.6e6; html += `<span class="proj">${esc(fill(t('h.tipAvg'), { v: big(y), p: projPct(y / c.goal) }))}</span>`; }
        if (c.recent != null) { const yr = c.progress + c.recent * (x - c.now) / 3.6e6; html += `<span class="proj2">${esc(fill(t('h.tipRec'), { v: big(yr), p: projPct(yr / c.goal) }))}</span>`; }
        html += `<span class="need">${esc(fill(t('h.tipNeed'), { v: big(need) }))}</span>`;
      }
    } else if (c.kind === 'lib') {
      html += `<b>${esc(hhmm(x))}</b>`;
      const off = ui.chartOff[c.id] || {};
      for (const pl of c.planets) {
        if (off[pl.key]) continue;
        const v = x <= c.now ? seriesAt(pl.pts, x) : pl.proj ? seriesAt(pl.proj, x) ?? (x > pl.proj[pl.proj.length - 1][0] ? pl.proj[pl.proj.length - 1][1] : null) : null;
        if (v != null) { html += `<span>${esc(pl.name)}: ${pct(Math.min(1, v))}</span>`; if (y == null) y = Math.min(1, v); }
      }
      if (x > c.now) html += `<span class="muted">${esc(t('h.tipFuture'))}</span>`;
    }
    if (tg.series) { const v = seriesAt(tg.series.pts, x); if (v != null) y = v; }
    el.classList.add('hover');
    cross.style.left = fx * 100 + '%';
    if (y != null) { dot.style.display = ''; dot.style.left = fx * 100 + '%'; dot.style.bottom = Math.max(0, Math.min(100, (y - c.y0) / (c.y1 - c.y0) * 100)) + '%'; } else dot.style.display = 'none';
    tip.innerHTML = html;
    tip.classList.toggle('left', fx > 0.6);
    tip.style.left = fx * 100 + '%';
  }

  /* ---------- data tab ---------- */
  function gaugeHTML(lib, id) {
    const max = Math.max(1.2, Math.min(2, (isFinite(lib.seqNeed) ? lib.seqNeed : 2) + 0.1));
    const x = (v) => Math.min(100, (v / max) * 100);
    const need = isFinite(lib.seqNeed) ? lib.seqNeed : max;
    const ticks = [0, 0.25, 0.5, 0.75, 1, 1.5, 2].filter(v => v <= max);
    return `<div class="gauge"><span class="label">${t('gaugeTitle')}</span>
      <div class="gauge-track" role="img" aria-label="${esc(t('gNow'))} ${pct(lib.currentShare)}, ${esc(t('gNeed'))} ${pct(lib.seqNeed)}">
        <div class="gauge-fill" style="width:${x(lib.currentShare)}%"></div>
        <div class="gauge-mark record" style="left:${x(settings.recordShare)}%"></div>
        <div class="gauge-mark full" style="left:${x(1)}%"></div>
        <div class="gauge-mark need" style="left:calc(${x(need)}% - 1px)"></div></div>
      <div class="gauge-scale">${ticks.map(v => `<span style="left:${x(v)}%">${pct(v)}</span>`).join('')}</div>
      <div class="gauge-legend">
        <span><i class="sw" style="background:var(--info)"></i>${t('gNow')}: <b>${pct(lib.currentShare)}</b></span>
        <span><i class="sw" style="background:var(--yellow)"></i>${t('gNeed')}: <b>${isFinite(lib.seqNeed) ? pct(lib.seqNeed) : '>500%'}</b></span>
        <span><i class="sw" style="background:var(--muted)"></i>${t('gRecord')}: <b>${pct(settings.recordShare)}</b></span>
        <span><i class="sw" style="background:var(--bad)"></i>${t('gFull')}</span></div></div>`;
  }
  function planetTableHTML(rows, H) {
    const tr = rows.map(r => {
      const p = r.planet;
      if (!r.pw) return `<tr><td>${planetName(p)}</td><td colspan="6" class="tag">${r.safe ? t('s.safe') : t('s.liberated')}</td></tr>`;
      const tags = [r.onDss ? t('chipDss') : null, r.pw.hasRegions ? t('regions') : null].filter(Boolean);
      return `<tr><td>${planetName(p)}${tags.length ? `<br><span class="tag">${tags.map(esc).join(' · ')}</span>` : ''}</td>
        <td class="num">${pct(p.health / p.maxHealth, 1)}</td>
        <td class="num">${big(r.pw.regen)}<br><span class="tag">${pct(r.pw.regen / p.maxHealth, 2)}</span></td>
        <td class="num">${fmt(p.statistics?.playerCount || 0)}<br><span class="tag">${pct(r.share, 1)}</span></td>
        <td class="num">${pct(r.breakEven)}</td>
        <td class="num">${r.net >= 0 ? '+' : ''}${big(r.net)}<br><span class="tag">${r.observed ? t('obs') : t('model')}</span></td>
        <td class="num">${isFinite(r.eta) ? dur(r.eta) + (r.eta > H ? ' ⚠' : '') : t('never')}</td></tr>`;
    }).join('');
    return `<div class="table-wrap"><table><thead><tr><th>${t('th.planet')}</th><th>${t('th.hp')}</th><th>${t('th.regen')}</th><th>${t('th.divers')}</th><th>${t('th.be')}</th><th>${t('th.net')}</th><th>${t('th.eta')}</th></tr></thead><tbody>${tr}</tbody></table></div>`;
  }
  function counterDataHTML(r, hasStart) {
    const tk = r.task;
    if (r.simpleCount) return `<div class="panel dblock"><h4>${taskText(r)}</h4><div class="kv"><span>${t('done')}: <b>${fmt(tk.progress)}</b> / <b>${fmt(tk.goal)}</b></span></div></div>`;
    const notes = [];
    if (!hasStart) notes.push(t('startUnknown'));
    if (!r.primary) notes.push(t('waitData')); else if (r.primary.hours < 12) notes.push(t('lowConf'));
    return `<div class="panel dblock"><h4>${taskText(r)}</h4>
      <div class="kv"><span>${t('done')}: <b>${big(tk.progress)}</b> / <b>${big(tk.goal)}</b></span>
        <span>${t('needRate')}: <b>${big(r.needed)}${t('perHour')}</b></span>
        <span>${t('rateStart')}: <b>${r.rates.sinceStart ? big(r.rates.sinceStart.rate) + t('perHour') : '—'}</b></span>
        <span>${t('rateRecent')}: <b>${r.rates.recent ? big(r.rates.recent.rate) + t('perHour') : '—'}</b></span>
        <span>${t('proj')}: <b>${r.projection != null ? big(r.projection) + ' (' + projPct(r.projection / tk.goal) + ')' : '—'}</b></span></div>
      ${notes.length ? `<p class="note">${notes.map(esc).join(' ')}</p>` : ''}</div>`;
  }
  function dataHTML(res, start) {
    const H = res.hoursLeft, lib = res.liberation;
    const planetRows = res.tasks.filter(r => r.pw || ((r.task.type === 11 || r.task.type === 13) && !r.defense));
    const dssP = last.dssIdx != null ? last.planets[last.dssIdx] : null;
    const boosts = `<div class="kv boosts">${kv(t('dss'), dssP ? planetName(dssP) : t('none'))}${kv(t('hod'), last.hod ? `×${fmt(settings.hodMult, 2)} · ${t('active')} ${new Date(last.hod.expire).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' })}` : t('inactive'))}</div>`;
    const basis = last.imp && last.K && last.capSrc !== 'capManual' && last.capSrc !== 'capDefault'
      ? fill(t('deepBasisLive'), { per: fmt(last.K * last.imp * 3600, 1), c: big(last.C), imp: fmt(last.imp, 4), src: t(last.capSrc) })
      : fill(t('deepBasis'), { c: big(last.C), src: t(last.capSrc) });
    return `${boosts}<p class="note">${basis}</p>
      ${lib ? `<div class="panel dblock">${gaugeHTML(lib, res.id)}<div class="facts" style="margin-top:8px">
          <div class="fact"><span class="label">${t('fNow')}</span><div class="big">${pct(lib.currentShare)}</div></div>
          <div class="fact key"><span class="label">${t('fNeed')}</span><div class="big">${isFinite(lib.seqNeed) ? pct(lib.seqNeed) : '>500%'}</div></div>
          <div class="fact"><span class="label">${t('fPar')}</span><div class="big">${pct(lib.parNeed)}</div></div>
          <div class="fact"><span class="label">${t('fAtNow')}</span><div class="big">${isFinite(lib.seqAtCurrent) ? dur(lib.seqAtCurrent) : t('never')}</div><span class="tag">${t('of')} ${dur(H)}</span></div>
        </div></div>` : ''}
      ${planetRows.length ? planetTableHTML(planetRows, H) : ''}
      ${res.tasks.filter(r => r.libN && r.libN.rank && r.libN.rank.length).map(r => `<div class="dblock-title"><h4>${taskText(r)}</h4><p class="note">${fill(t('s.cCount'), { p: fmt(r.task.progress), g: fmt(r.task.goal) })} · ${t('libNTable')}</p></div>
        ${planetTableHTML(r.libN.rank.slice(0, 6), H)}`).join('')}
      ${res.tasks.filter(r => r.defense).map(r => `<div class="panel dblock"><h4>${taskText(r)}</h4><div class="kv">
        <span>${t('defEnds')}: <b>${dur(r.defense.hoursToEnd)}</b></span><span>${t('defNeed')}: <b>${pct(r.defense.need)}</b></span><span>${t('th.divers')}: <b>${pct(r.defense.share, 1)}</b></span></div>
        ${r.defense.outlastsMO ? `<p class="note">${t('defOutlasts')}</p>` : ''}</div>`).join('')}
      ${res.tasks.filter(r => r.counter && !(r.libN && r.libN.rank && r.libN.rank.length)).map(r => counterDataHTML(r, !!start)).join('')}`;
  }

  /* ---------- view ---------- */
  const TABS = ['objectives', 'strategy', 'history', 'intel'];
  function viewHTML(entry) {
    const { a, res, start } = entry;
    let tab = ui.tab[a.id] || 'objectives';
    if (tab === 'data') tab = 'history';
    if (!TABS.includes(tab)) tab = 'objectives';
    const panel = tab === 'strategy' ? strategyHTML(res, entry) : tab === 'history' ? historyHTML(entry) : tab === 'intel' ? intelTabHTML(entry) : objectivesHTML(res);
    const ic = intelCount(entry);
    const label = { objectives: t('tObj'), strategy: t('tStrat'), history: t('tHist'), intel: t('tIntel') + (ic.n ? ` <span class="tab-badge ${ic.level}">${ic.n}</span>` : '') };
    return `<div class="order" data-order="${esc(a.id)}">
      ${directiveHTML(res)}
      ${railHTML(res, a)}
      <div class="area-tabs" id="tabs-${esc(a.id)}">
        <div class="tabbar">
          <div class="tabs" role="tablist" aria-label="${esc(clean(txt(a.title) || 'Major Order'))}">${TABS.map((k, i) => `<button type="button" role="tab" class="tab" id="tab-${esc(a.id)}-${k}" data-tab="${k}" aria-selected="${tab === k}" aria-controls="tp-${esc(a.id)}" tabindex="${tab === k ? 0 : -1}">${label[k]}</button>`).join('')}</div>
        </div>
        <div class="tabpanel" id="tp-${esc(a.id)}" role="tabpanel" aria-labelledby="tab-${esc(a.id)}-${tab}">${panel}</div>
      </div>
    </div>`;
  }

  // where the keyboard focus is, as a selector that still matches after the view is rebuilt
  function focusSelector() {
    const el = document.activeElement;
    if (!el || el === document.body || !(el.closest('#view') || el.closest('#order-tabs'))) return null;
    if (el.id) return '#' + CSS.escape(el.id);
    for (const k of ['sim', 'pace', 'copy', 'goto', 'preset', 'brief']) if (el.dataset[k] != null) return `[data-${k}="${CSS.escape(el.dataset[k])}"]${k === 'preset' ? `[data-v="${CSS.escape(el.dataset.v)}"]` : k === 'goto' && el.dataset.scroll ? '[data-scroll]' : k === 'goto' ? ':not([data-scroll])' : ''}`;
    const det = el.closest('details[data-intel]');
    if (det) return `details[data-intel="${CSS.escape(det.dataset.intel)}"] > summary`;
    if (el.hasAttribute('data-toggle-nums')) return '[data-toggle-nums]';
    return null;
  }
  function renderStale() {
    const box = $('stale'); if (!box) return;
    const st = last && last.stale;
    if (!st) { box.innerHTML = ''; return; }
    const mins = Math.max(1, Math.round((Date.now() - st.t) / 60e3));
    const ago = mins < 90 ? fill(t('staleMin'), { n: mins }) : fill(t('staleH'), { n: fmt(mins / 60, 1) });
    box.innerHTML = `<div class="stale-bar" role="status">${ICON.warn}<p>${fill(t('stale'), { when: esc(new Date(st.t).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })), ago: esc(ago), src: esc(t(st.src === 'official' ? 'staleOff' : 'staleCom')) })}</p></div>`;
  }
  /* ---------- archive: every Major Order, and whether it was winnable ---------- */
  let archive = null, archiveT = 0, archiveBusy = false, archiveFail = 0;
  async function loadArchive() {
    if (archiveBusy || (archive && Date.now() - archiveT < 30 * 60e3) || (!archive && Date.now() - archiveFail < 60e3)) return;
    archiveBusy = true;
    try {
      const r = await fetch(RECORD + 'archive.json?t=' + Math.floor(Date.now() / 600e3), { cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      if (j && Array.isArray(j.orders)) { archive = j; archiveT = Date.now(); } else archiveFail = Date.now();
    } catch { archiveFail = Date.now(); } finally { archiveBusy = false; }
    if (ui.view === 'archive') render();
  }
  const CALL_ORDER = ['ontrack', 'focus', 'effort', 'hard', 'record', 'nearly_impossible', 'impossible'];
  const callGroup = (v) => v === 'impossible' ? 'impossible' : v === 'nearly_impossible' ? 'long' : v === 'hard' || v === 'record' ? 'hard' : v ? 'fair' : null;
  // an order's name for the record: the game's title, or (when that is just "MAJOR ORDER") what it asked
  const TASK_OBJ = { 1: 'Extraction', 2: 'Samples', 3: 'Eradicate', 4: 'Objectives', 5: 'Missions', 6: 'Equipment', 7: 'Missions', 9: 'Operations', 10: 'Donation', 11: 'Liberate', 12: 'Defend', 13: 'Hold', 14: 'Liberate', 15: 'Liberate' };
  const noItem = (s) => s.replace(new RegExp(` ${t('with')} ${t('item')} #\\d+`, 'g'), ' ' + t('ar.withW'));
  function orderName(o) {
    const nm = String(o.name || '').replace(/^\s*(major|minor) order\s*[|:\-–]\s*/i, '').trim();
    if (nm && !/^(major|minor) order$/i.test(nm)) return titleCase(nm);
    const ts = (o.tasks || []).map(tk => ENGINE.parseTask(tk, 0));
    if (ts.length && ts.every(tk => tk.type === 3)) {
      // "Kill 150M Terminids · 32.5M Illuminate · 50M Automatons"
      const w = ts.some(tk => tk.itemId) ? ' ' + t('ar.withW') : '';
      return `${t('kill')} ${ts.map(tk => `${big(tk.goal)} ${tk.enemyId ? enemyName(tk.enemyId) : tk.faction && tk.faction !== 'Humans' ? plain(facPlural(tk.faction)) : t('enemies')}`).join(' · ')}${w}`;
    }
    if (ts.length) return noItem(ts.map(tk => plain(taskText({ task: tk, planet: tk.planetIndex != null ? { index: tk.planetIndex, name: (last && last.planets[tk.planetIndex] || {}).name || '#' + tk.planetIndex } : null }))).join(' · '));
    const b = plain(String(o.brief || '')).split(/(?<=[.!?])\s/)[0];
    return b && b.length > 12 ? (b.length > 90 ? b.slice(0, 88).replace(/\s\S*$/, '') + '…' : b.replace(/[.!]$/, '')) : t('ar.unnamed');
  }
  const orderObj = (o) => o.obj || [...new Set((o.tasks || []).map(tk => TASK_OBJ[tk.type]).filter(Boolean))].join('/');
  function archiveHTML() {
    if (!archive) { loadArchive(); return `<section class="arch"><div class="ar-head"><button type="button" class="ghost" data-view="war">← ${esc(t('ar.back'))}</button></div><p class="arch-load">${ICON.dots}<span>${esc(t(archiveFail ? 'ar.notYet' : 'ar.loading'))}</span></p></section>`; }
    const now = Date.now();
    const running = new Set((last && last.results || []).map(x => String(x.a.id)));
    const starts = (last && last.results || []).map(x => x.start).filter(Boolean);
    const GROUPS = ['fair', 'hard', 'long', 'impossible'];
    const all = archive.orders.map(o => {
      const live = (o.watchedId && running.has(String(o.watchedId))) || (o.start && starts.some(st => Math.abs(st - o.start) < 3 * 3.6e6));
      // no result on record long after it ended: say so rather than "result due"
      const result = o.result || (live ? 'running' : o.end && now - o.end > 12 * 3.6e6 ? 'unknown' : 'pending');
      // a check made after the order had been running for hours (first seen late) is no day-one check
      const c0 = o.call && !o.call.late ? o.call : o.retro || null;
      const c = c0 && c0.v && c0.v !== 'unknown' ? c0 : null;
      const defendOnly = /^(defend|hold|control|repel)([\/, ]+(defend|hold|control|repel))*$/i.test(String(o.obj || '').trim());
      const noWhy = !c && result === 'lost' ? (['noTargets', 'noStart', 'notHeld', 'fewTargets', 'type', 'defend'].includes(o.noRetro) ? (o.noRetro === 'type' && defendOnly ? 'defend' : o.noRetro) : o.noRetro ? 'data' : defendOnly ? 'defend' : 'type') : null;
      return { ...o, result, cl: c, live: !!c && c === o.call, grp: c ? callGroup(c.v) : null, noWhy };
    });
    const done = all.filter(o => o.result === 'won' || o.result === 'lost');
    const won = done.filter(o => o.result === 'won').length, lost = done.length - won;
    const yr = done.filter(o => (o.end || o.start) > now - 365 * 24 * 3.6e6), yrWon = yr.filter(o => o.result === 'won').length;
    let streak = 0, sk = null; for (const o of [...done].sort((a, b) => (b.end || b.start) - (a.end || a.start))) { if (sk === null) sk = o.result; if (o.result !== sk) break; streak++; }
    // the defeats, checked: could each one have been won?
    const defeats = all.filter(o => o.result === 'lost');
    const G = { fair: 0, hard: 0, long: 0, impossible: 0, none: 0 }; defeats.forEach(o => G[o.grp || 'none']++);
    const checked = defeats.length - G.none;
    const FILTERS = ['all', 'won', 'lost', ...GROUPS.map(g => 'g-' + g), 'g-none'];
    const f = FILTERS.includes(ui.af) ? ui.af : 'all';
    const match = (o) => f === 'all' || (f.startsWith('g-') ? o.result === 'lost' && (o.grp || 'none') === f.slice(2) : o.result === f);
    const list = all.filter(match);
    const pctx = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
    const day = (ms) => ms ? new Date(ms).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const first = all.length ? Math.min(...all.map(o => o.start || o.end || now)) : now;
    // 1. the record in one line
    const stats = `<dl class="ar-stats">
      <div><dt>${esc(t('ar.total'))}</dt><dd>${fmt(all.length)}</dd></div>
      <div class="ok"><dt>${esc(t('ar.won'))}</dt><dd>${fmt(won)} <small>${pctx(won, done.length)}</small></dd></div>
      <div class="bad"><dt>${esc(t('ar.lost'))}</dt><dd>${fmt(lost)} <small>${pctx(lost, done.length)}</small></dd></div>
      <div><dt>${esc(t('ar.year'))}</dt><dd>${pctx(yrWon, yr.length)} <small>${esc(t('ar.wonS'))}</small></dd></div>
      <div><dt>${esc(t('ar.streak'))}</dt><dd>${streak} <small>${esc(t(sk === 'won' ? 'ar.streakW' : 'ar.streakL'))}</small></dd></div>
    </dl>`;
    // 2. the question this page is for, answered
    const out = G.impossible + G.long;
    const head = !checked ? t('ar.hNone') : out ? fill(t(out === 1 ? 'ar.hOut1' : 'ar.hOut'), { n: out, c: checked }) : fill(t('ar.hFair'), { c: checked });
    const sub = checked ? [out ? fill(t('ar.hSubOut'), { i: G.impossible, l: G.long }) : '', G.hard ? fill(t(G.hard === 1 ? 'ar.hSubRec1' : 'ar.hSubRec'), { n: G.hard }) : '', G.fair ? fill(t(G.fair === 1 ? 'ar.hSubWin1' : 'ar.hSubWin'), { n: G.fair }) : ''].filter(Boolean).join(' ') : '';
    const seg = (g) => G[g] ? `<button type="button" class="sb-seg cg-${g}" style="flex:${G[g]}" data-af="g-${g}" aria-pressed="${f === 'g-' + g}" aria-label="${esc(G[g] + ' ' + t('ar.g.' + g))}"></button>` : '';
    const verdict = `<section class="ar-verdict">
      <span class="label">${esc(t('ar.q'))}</span>
      <p class="sb-head">${esc(head)}</p>
      ${sub ? `<p class="sb-sub">${esc(sub)}</p>` : ''}
      <div class="sb-bar" role="group" aria-label="${esc(fill(t('ar.chkA'), { n: defeats.length }))}">${[...GROUPS, 'none'].map(seg).join('')}</div>
      <ul class="sb-key">${[...GROUPS, 'none'].filter(g => G[g] || g !== 'none').map(g => `<li class="cg-${g}"><button type="button" data-af="g-${g}" aria-pressed="${f === 'g-' + g}"><i></i><b>${G[g]}</b><span>${esc(t('ar.g.' + g))}</span><small>${esc(t('ar.gs.' + g))}</small></button></li>`).join('')}</ul>
      <details class="ar-how"><summary>${esc(t('ar.howT'))}</summary>
        <ul>${t('ar.howL').map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <p class="ar-small">${esc(t('ar.howN'))}</p></details>
    </section>`;
    const tools = `<div class="ar-tools"><h3>${esc(t('ar.listT'))}</h3><div class="nk-filter ar-filter" role="group" aria-label="${esc(t('nw.filter'))}">${['all', 'won', 'lost'].map(k => `<button type="button" data-af="${k}" aria-pressed="${f === k || (k === 'lost' && f.startsWith('g-'))}">${esc(t('ar.f.' + k))}</button>`).join('')}</div>
      ${f.startsWith('g-') ? `<p class="ar-fnow">${esc(fill(t('ar.fNow'), { what: t('ar.g.' + f.slice(2)), n: list.length }))} <button type="button" class="linkish" data-af="all">${esc(t('ar.fClear'))}</button></p>` : ''}</div>`;
    // the bar an order sat on: share of everyone needed (liberation) or best-day pace vs goal (counts)
    const meter = (x, marks, max, g, label) => `<div class="ar-meter cg-${g}" role="img" aria-label="${esc(label)}"><i style="width:${(Math.min(max, x) / max * 100).toFixed(1)}%"></i>${marks.map(s => `<s style="left:${(s / max * 100).toFixed(1)}%" data-l="${Math.round(s * 100)}%"></s>`).join('')}</div>`;
    const goalTxt = (g) => noItem(plain(taskText({ task: { type: g.type, goal: g.goal, faction: g.f, itemId: g.item, enemyId: g.enemy, planetIndex: null, sectorIndex: null }, planet: null })));
    function detailOf(o) {
      const c = o.cl;
      if (!c) {
        if (!o.noWhy) return '';
        const fx = o.facts || {}, lines = [];
        if (fx.held) lines.push(fx.held.fell.length ? fill(t('ar.fxFell'), { p: fx.held.fell.map(x => titleCase(x.n)).join(', '), when: day(fx.held.fell[0].t) }) : t('ar.fxHeld'));
        return `<div class="ar-det">${lines.map(l => `<p class="ar-lead">${esc(l)}</p>`).join('')}<p class="ar-small">${esc(t('ar.no.' + o.noWhy))}</p></div>`;
      }
      const g = o.grp, out = [];
      // the verdict in words first, then the evidence, then where it comes from
      if (c.src === 'attacks' && c.facts?.attacks) {
        const a = c.facts.attacks;
        out.push(`<p class="ar-lead"><b class="cg-${g}">${esc(t('ar.g.' + g))}.</b> ${esc(fill(t(a.came < a.need ? 'ar.atkNo' : 'ar.atkOk'), { need: a.need, came: a.came, won: a.won }))}</p>`);
        out.push(meter(a.came / a.need, [1], 2, g, fill(t('ar.atkA'), { came: a.came, need: a.need })));
        if (c.facts.held?.fell?.length) out.push(`<p>${esc(fill(t('ar.fxFell'), { p: c.facts.held.fell.map(x => titleCase(x.n)).join(', '), when: day(c.facts.held.fell[0].t) }))}</p>`);
      } else if (c.cap != null) {
        out.push(`<p class="ar-lead"><b class="cg-${g}">${esc(t('ar.g.' + g))}.</b> ${fill(esc(t('ar.cap.' + g)), { p: `<b>${pct(c.cap)}</b>` })}</p>`);
        out.push(meter(c.cap, [0.5, 1, 1.3], 1.6, g, fill(t('ar.capA'), { p: pct(c.cap) })));
        if ((c.goals || []).length) out.push(`<ul>${c.goals.map(x => `<li><b>${esc(goalTxt(x))}</b><span>${esc(x.got >= x.goal ? t('ar.gDone') : fill(t('ar.gGot'), { got: pct(x.goal ? x.got / x.goal : 0), cap: x.cap != null ? pct(x.cap) : '—' }))}</span></li>`).join('')}</ul>`);
      } else {
        const inf = c.need == null && c.v === 'impossible';
        out.push(`<p class="ar-lead"><b class="cg-${g}">${esc(t('ar.g.' + g))}.</b> ${inf ? esc(t('ar.needInf')) : fill(esc(t((c.counts ? 'ar.needC.' : 'ar.need.') + g)), { p: `<b>${pct(c.need)}</b>` })}</p>`);
        out.push(meter(inf ? 1.2 : c.need || 0, [0.6, 0.77, 1], 1.2, g, inf ? t('ar.mInf') : fill(t('ar.mA'), { p: pct(c.need) })));
        if ((c.goals || []).length) out.push(`<ul>${c.goals.map(x => `<li><b>${esc(goalTxt(x))}</b><span>${esc(x.got >= x.goal ? t('ar.gDone') : fill(t(x.need != null ? 'ar.gGotN' : 'ar.gGot'), { got: pct(x.goal ? x.got / x.goal : 0), cap: x.cap != null ? pct(x.cap) : '—', need: pct(x.need) }))}</span></li>`).join('')}</ul>`);
        if (c.players && !c.counts) out.push(`<p>${esc(fill(t('ar.atLaunch'), { n: people(c.players), d: dur(c.hours || 0) }))}</p>`);
        if ((c.targets || []).length) out.push(`<ul>${c.targets.map(p => `<li><b>${esc(titleCase(p.n))}</b><span>${esc(fill(t('ar.detP'), { hp: pct(p.max ? p.hp / p.max : 1, 0), regen: pct(p.max ? (p.r * 3600) / p.max : 0, 1), pl: people(p.pl || 0), o: plain(facName(p.o) || p.o || '') }))}</span></li>`).join('')}</ul>`);
      }
      const notes = [c.loose ? t('ar.detLoose') : c.anyOf ? t('ar.detAny') : '', c.count && c.pool === 'faction' ? fill(t('ar.detCount'), { n: c.count, f: plain(facName(c.fac) || c.fac || '') }) : c.count && c.pool === 'named' ? fill(t('ar.detCountN'), { n: c.count }) : '', c.partial ? t('ar.detPartial') : ''].filter(Boolean);
      const src = o.live ? fill(t('ar.srcLive'), { age: dur(c.age || 3) }) : t('ar.src.' + (c.src === 'hs' ? 'hs' : c.src === 'attacks' ? 'attacks' : 'log'));
      return `<div class="ar-det">${out.join('')}<p class="ar-small">${esc([...notes, src].join(' '))}</p></div>`;
    }
    let rows = '', curY = null;
    for (const o of list.slice(0, 300)) {
      const y = new Date(o.start || o.end || now).getFullYear();
      if (y !== curY) { rows += `${curY ? '</ul>' : ''}<h5 class="fd-day">${y}</h5><ul class="ar-list">`; curY = y; }
      const durH = o.start && o.end ? (o.end - o.start) / 3.6e6 : null;
      const res = o.result || 'unknown';
      const detail = detailOf(o);
      const tag = o.cl ? `<span class="ar-call cg-${o.grp}">${esc(t('ar.g.' + o.grp))}</span>` : o.noWhy ? `<span class="ar-call cg-none">${esc(t('ar.g.none'))}</span>` : '<span></span>';
      rows += `<li class="r-${res} ${detail ? 'has-det' : ''}">${detail ? '<details><summary>' : ''}
        <span class="ar-res">${ICON[res === 'won' ? 'trophy' : res === 'lost' ? 'cross' : res === 'running' ? 'target' : 'dots']}</span>
        <div class="ar-main"><b>${esc(orderName(o))}</b>
          <span class="ar-meta">${o.code ? `<span class="ar-code">${esc(o.code)}</span>` : ''}${orderObj(o) ? `<span>${esc(orderObj(o))}</span>` : ''}<span>${esc(day(o.start))}${durH ? ' · ' + esc(dur(durH)) : ''}</span></span></div>
        ${tag}<span class="ar-badge">${esc(t('ar.r.' + res))}</span>${detail ? `</summary>${detail}</details>` : ''}</li>`;
    }
    rows += curY ? '</ul>' : '';
    return `<section class="arch">
      <div class="ar-head"><button type="button" class="ghost" data-view="war">← ${esc(t('ar.back'))}</button>
        <div><h2>${esc(t('ar.title'))}</h2><p>${esc(fill(t('ar.sub'), { when: day(first) }))}</p></div></div>
      ${stats}${verdict}${tools}
      <div class="feed">${rows || `<p class="ar-note">${esc(t('ar.empty'))}</p>`}</div>
      <p class="foot">${esc(fill(t('ar.foot'), { when: archive.upTo ? day(archive.upTo) : '—' }))}</p>
    </section>`;
  }
  function render(opts = {}) {
    if (!last) return;
    const keepFocus = focusSelector();
    renderHud();
    renderStale();
    $('open-archive').setAttribute('aria-pressed', String(ui.view === 'archive'));
    if (ui.view === 'archive') {
      $('order-tabs').hidden = true; $('cross').innerHTML = ''; $('intel').innerHTML = '';
      $('view').innerHTML = archiveHTML();
      document.title = `${t('ar.title')} · Ministry of Victory`;
      return;
    }
    renderOrderTabs();
    renderCross();
    const entry = last.results.find(x => String(x.a.id) === String(ui.order));
    $('intel').innerHTML = '';
    const view = $('view');
    if (!entry) {
      view.innerHTML = `<div class="empty-wrap"><div class="empty-main">
          <p class="empty-line">${ICON.dots}<span>${esc(t('noOrders'))}</span></p>
          ${recapHTML()}${newsHomeHTML()}${frontsHTML()}</div>
        <div class="empty-side">${mapHTML(null)}${joelRecap()}</div></div>`;
      document.title = 'Ministry of Victory';
      return;
    }
    const firstTime = !prev.seen[entry.a.id];
    view.innerHTML = viewHTML(entry);
    if (opts.tabEnter) { const tp = $('tp-' + entry.a.id); if (tp) tp.classList.add('enter', 'anim'); }
    afterRender(entry, firstTime);
    prev.seen[entry.a.id] = true;
    const title = directiveParts(entry.res).title;
    document.title = `${title ? title.charAt(0).toUpperCase() + title.slice(1) + ' · ' : ''}Ministry of Victory`;
    if (keepFocus) { const el = document.querySelector(keepFocus); if (el) el.focus({ preventScroll: true }); }
    try { tick(); } catch {}
  }

  /* ---------- animations ---------- */
  function afterRender(entry, firstTime) {
    const view = $('view');
    layoutCharts();
    if (ui.pcPinned) openCard(true);
    const motion = !reduced();
    if (motion && firstTime) view.querySelector('.order')?.classList.add('anim');
    // bars: from previous width to new width
    const bars = view.querySelectorAll('[data-w]');
    bars.forEach(el => {
      const key = el.dataset.key, w = Number(el.dataset.w);
      const from = motion ? (prev.bars[key] ?? 0) : w;
      el.style.transition = 'none';
      el.style.width = from + '%';
    });
    // orbit rings: same idea, on stroke-dashoffset (pathLength = 100)
    const rings = view.querySelectorAll('[data-ring]');
    rings.forEach(el => {
      const key = el.dataset.ring, f = Number(el.dataset.frac);
      el.style.transition = 'none';
      el.style.strokeDashoffset = String(100 - (motion ? (prev.bars[key] ?? 0) : f));
    });
    void view.offsetWidth;
    requestAnimationFrame(() => {
      bars.forEach(el => {
        el.style.transition = '';
        el.style.width = el.dataset.w + '%';
        prev.bars[el.dataset.key] = Number(el.dataset.w);
      });
      rings.forEach(el => {
        el.style.transition = '';
        el.style.strokeDashoffset = String(100 - Number(el.dataset.frac));
        prev.bars[el.dataset.ring] = Number(el.dataset.frac);
      });
    });
    fitTarget();
    // briefing: no fade or "read more" when the text already fits (skip when hidden, as on phones)
    view.querySelectorAll('.brief-card .text').forEach(el => {
      if (el.classList.contains('open') || !el.clientHeight) return;
      const short = el.scrollHeight <= el.clientHeight + 2;
      el.classList.toggle('short', short);
      const btn = el.parentElement.querySelector('[data-brief]');
      if (btn) btn.hidden = short;
    });
    // numbers
    document.querySelectorAll('[data-count]').forEach(el => countUp(el));
    // stamp
    const stamp = view.querySelector('[data-stamp]');
    if (stamp) {
      const id = String(entry.a.id), v = stamp.dataset.stamp;
      if (motion && prev.verdict[id] !== v) stamp.classList.add('slam');
      prev.verdict[id] = v;
    }
    // directive headline decrypt
    const tgt = view.querySelector('[data-decrypt]');
    if (tgt) {
      const id = String(entry.a.id), text = tgt.dataset.decrypt;
      if (motion && prev.dir[id] !== text) decrypt(tgt, text);
      if (prev.dir[id] != null && prev.dir[id] !== text) toast(fill(t('dirChanged'), { x: directiveParts(entry.res).title }));
      prev.dir[id] = text;
    }
  }

  // shrink the headline until no single word overflows its column (names vary a lot in length)
  function fitTarget() {
    const el = $('view').querySelector('.directive .target');
    if (!el) return;
    el.style.fontSize = ''; el.style.overflowWrap = '';
    let size = parseFloat(getComputedStyle(el).fontSize) || 60, guard = 0;
    while (el.scrollWidth > el.clientWidth + 1 && size > 22 && guard++ < 60) { size -= 2; el.style.fontSize = size + 'px'; }
    if (el.scrollWidth > el.clientWidth + 1) el.style.overflowWrap = 'anywhere';
  }
  let fitRaf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitTarget); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitTarget()).catch(() => {});

  function countUp(el) {
    const key = el.dataset.count, to = Number(el.dataset.to);
    const from = prev.count[key];
    prev.count[key] = to;
    if (reduced() || from == null || from === to || !isFinite(to)) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), D = 900;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$';
  function decrypt(el, text) {
    const chars = [...text];
    let frame = 0;
    const total = 18 + chars.length;
    const run = () => {
      frame++;
      el.innerHTML = chars.map((c, i) => {
        if (c === ' ') return ' ';
        const settle = 6 + i * 1.2;
        if (frame >= settle) return esc(c);
        return `<span class="ch scr">${GLYPHS[Math.floor(Math.random() * GLYPHS.length)]}</span>`;
      }).join('');
      if (frame < total) setTimeout(run, 34); else el.textContent = text;
    };
    run();
  }

  /* ---------- live updates (every second) ---------- */
  function fmtCountdown(ms) {
    if (!isFinite(ms)) return '—';
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const u = t('dhms'), p2 = (n) => String(n).padStart(2, '0');
    return `${d ? d + `<span>${u[0]}</span>` : ''}${p2(h)}<span>${u[1]}</span>${p2(m)}<span>${u[2]}</span>${p2(sec)}<span>${u[3]}</span>`;
  }
  // live counters: between refreshes, objectives count up at the pace just measured
  function tickCounters() {
    const now = Date.now();
    document.querySelectorAll('.tick[data-tick]').forEach(el => {
      const v = Math.min(Number(el.dataset.goal), Number(el.dataset.tick) + Number(el.dataset.rate) * (now - Number(el.dataset.t0)) / 1000);
      el.textContent = fmt(Math.floor(v));
    });
  }
  setInterval(tickCounters, 250);
  function tick() {
    document.querySelectorAll('[data-exp]').forEach(el => {
      const ms = Number(el.dataset.exp) - Date.now();
      el.innerHTML = fmtCountdown(ms);
      const card = el.closest('.timer');
      if (card && !card.classList.contains('finished')) { card.classList.toggle('soon', ms < 24 * 3600e3 && ms >= 6 * 3600e3); card.classList.toggle('urgent', ms < 6 * 3600e3); }
    });
    // live dot goes grey when the data is getting old (failed refreshes)
    const stale = !lastOk || Date.now() - lastOk > 3 * REFRESH_MS;
    document.querySelectorAll('.hud .live, .directive .live').forEach(el => el.classList.toggle('off', stale));
    if (!lastRun) return;
    const left = Math.max(0, REFRESH_MS - (Date.now() - lastRun));
    const ring = $('ring');
    if (ring) ring.style.strokeDashoffset = String(RING * (1 - left / REFRESH_MS));
    const btn = $('refresh');
    btn.title = (last ? fill(t('updatedAt'), { t: new Date(last.now).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' }) }) + ' · ' : '') + fill(t('nextIn'), { s: Math.ceil(left / 1000) });
    btn.setAttribute('aria-label', busy ? t('loading') : t('refresh') + '. ' + btn.title);
    if (left === 0 && !document.hidden && !busy) refresh();
  }

  /* ---------- interaction ---------- */
  function updateSim(id, v) {
    const entry = last && last.results.find(x => String(x.a.id) === String(id));
    if (!entry) return;
    ui.sim[id] = v;
    const out = $('simout-' + id);
    if (out) out.innerHTML = simOutHTML(entry.res, v / 100);
    const input = document.querySelector(`[data-sim="${CSS.escape(String(id))}"]`);
    if (input) { input.value = v; input.style.setProperty('--p', ((v - 5) / 95) * 100 + '%'); }
  }
  function updatePace(id, v) {
    const entry = last && last.results.find(x => String(x.a.id) === String(id));
    if (!entry) return;
    ui.pace[id] = v;
    const out = $('paceout-' + id);
    if (out) out.innerHTML = paceOutHTML(entry.res, v / 100);
    const lbl = document.querySelector(`[data-pace-lbl="${CSS.escape(String(id))}"]`);
    if (lbl) lbl.textContent = '×' + fmt(v / 100, 2);
    const input = document.querySelector(`[data-pace="${CSS.escape(String(id))}"]`);
    if (input) input.style.setProperty('--p', ((v - 25) / 375) * 100 + '%');
  }
  function selectTab(tab, scrollTo) {
    if (!ui.order) return;
    ui.tab[ui.order] = tab; saveUi();
    render({ tabEnter: true });
    if (scrollTo) {
      if (scrollTo === 'sim') { const box = document.querySelector(`[data-simbox="${CSS.escape(String(ui.order))}"]`); if (box) box.open = true; }
      const target = scrollTo === 'sim' ? ($('sim-' + ui.order) || $('pace-' + ui.order) || $('tabs-' + ui.order)) : $('tabs-' + ui.order);
      if (target) target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    }
    const btn = document.querySelector(`.tab[data-tab="${tab}"]`);
    if (btn && !scrollTo) btn.focus({ preventScroll: true });
  }

  function cycleTab(step) {
    if (!ui.order) return;
    const cur = TABS.indexOf(ui.tab[ui.order] || 'objectives');
    selectTab(TABS[(cur + step + TABS.length) % TABS.length]);
  }

  /* share the order of the day as plain text (Discord, Reddit, chat) */
  const plain = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.replace(/\s+/g, ' ').trim(); };
  function shareText(entry) {
    const { a, res } = entry;
    const p = directiveParts(res);
    const left = Date.parse(a.expiration) - Date.now();
    const lines = [
      `MINISTRY OF VICTORY · ${plain(clean(txt(a.title) || 'Major Order')).toUpperCase()}`,
      `${t('dirLabel')}: ${(['steady', 'lost'].includes(p.d.kind) ? p.target : `${p.kicker} ${p.target}`).toUpperCase()}`,
      plain(p.why),
      p.cap ? plain(p.cap) : '',
      `${t('forecast')}: ${t('v.' + res.verdict)} · ${t('timeLeft')}: ${isFinite(left) ? durDown(left / 3.6e6) : '—'}`,
    ];
    return lines.filter(Boolean).join('\n');
  }
  /* ---------- share image: the order of the day as one picture (Reddit, Discord) ----------
     Everything that matters in one PNG, so people get the call without opening the site.
     Drawn on a canvas from the same parts the page shows; times are in UTC (readers are everywhere). */
  const SH_VC = { done: '#5fd38d', ontrack: '#5fd38d', effort: '#6bb7ea', focus: '#6bb7ea', hard: '#ffbb25', record: '#ffbb25', nearly_impossible: '#ff5148', impossible: '#ff5148', failed: '#ff5148', unknown: '#a8aebd' };
  const SH_FAC = { Terminids: '#ffae3a', Automaton: '#ff6767', Illuminate: '#ab8dff', Humans: '#6bb7ea' };
  async function shareImage(entry) {
    const { a, res } = entry;
    try { await Promise.all(['900 40px Archivo', '700 20px "Chakra Petch"', '500 20px "Chakra Petch"', '400 20px "Share Tech Mono"'].map(f => document.fonts.load(f))); } catch {}
    // the page's own words, with times in UTC
    clockUTC = true;
    let p, objs, joel;
    try {
      p = directiveParts(res);
      const box = document.createElement('div'); box.innerHTML = objectivesHTML(res);
      objs = [...box.querySelectorAll('.objective')].map(el => {
        const h = el.querySelector('h4'); const opt = h.querySelector('.opt'); if (opt) opt.remove();
        const fillEl = el.querySelector('.bar .fill'), projEl = el.querySelector('.bar .proj');
        const pillEl = el.querySelector('.pill');
        const v = [...(pillEl?.classList || [])].find(c => c.startsWith('v-'))?.slice(2) || null;
        el.querySelectorAll('.intel, .chipline, .early').forEach(n => n.remove());
        return { title: noItem(plain(h.innerHTML)), v, pill: pillEl ? plain(pillEl.innerHTML) : '', frac: fillEl ? Number(fillEl.dataset.w) / 100 : null,
          proj: projEl ? (parseFloat(projEl.style.left) + parseFloat(projEl.style.width)) / 100 : null, line: noItem(plain(el.querySelector('.line')?.innerHTML || '')),
          fac: [...el.classList].find(c => c.startsWith('fac-'))?.slice(4) || null };
      });
      const it = intelFor(entry), tasks = res.tasks.map(r => r.task);
      joel = [...it.items].sort((x, y) => prioOf(x) - prioOf(y) || y.t - x.t).map(x => joelItem(x, tasks, it.rel, { start: entry.start, end: Date.parse(a.expiration) })).filter(r => !r.earned).slice(0, 2)
        .map(r => ({ title: noItem(plain(r.title)), detail: plain(r.detail || ''), when: r.when || ago(r.t) }));
    } finally { clockUTC = false; }
    const W = 1080, PAD = 64, IN = W - PAD * 2, S = 2;
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    const font = (px, w = 600, fam = 'Chakra Petch', stretch = 'normal') => { ctx.font = `${w} ${px}px "${fam}", sans-serif`; try { ctx.fontStretch = stretch; } catch {} };
    const wrap = (text, maxW, max = 9) => {
      const words = String(text || '').split(/\s+/).filter(Boolean), lines = []; let cur = '';
      for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width <= maxW || !cur) cur = t2; else { lines.push(cur); cur = w; } }
      if (cur) lines.push(cur);
      if (lines.length > max) { lines.length = max; let l = lines[max - 1]; while (l && ctx.measureText(l + '…').width > maxW) l = l.replace(/\s*\S+$/, ''); lines[max - 1] = l + '…'; }
      return lines;
    };
    const vc = SH_VC[res.verdict] || '#a8aebd';
    const left = Date.parse(a.expiration) - (last ? last.now : Date.now());
    // a bare "MAJOR ORDER" title says nothing: name it after what it asks, as the archive does
    const title = orderName({ name: plain(clean(txt(a.title) || '')), tasks: a.tasks, brief: txt(a.briefing) }).toUpperCase();
    const n = last.results.length, k = last.results.indexOf(entry) + 1;
    const stamp = new Date(last.now).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
    // two passes: measure the height, then draw
    function draw(on) {
      let y = 0;
      const R = (x, yy, w, h, c) => { if (on) { ctx.fillStyle = c; ctx.fillRect(x, yy, w, h); } };
      const T = (s, x, yy, c, align = 'left') => { if (on) { ctx.fillStyle = c; ctx.textAlign = align; ctx.fillText(s, x, yy); } };
      // header
      y = 56;
      if (on) {
        ctx.save(); ctx.translate(PAD + 22, y + 22); ctx.strokeStyle = '#ffe900'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, -21); ctx.lineTo(21, 0); ctx.lineTo(0, 21); ctx.lineTo(-21, 0); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = '#ffe900'; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(8, -4); ctx.lineTo(5.3, 1); ctx.lineTo(2.2, 1); ctx.lineTo(2.2, 9); ctx.lineTo(-2.2, 9); ctx.lineTo(-2.2, 1); ctx.lineTo(-5.3, 1); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      font(13, 600); if (on) ctx.letterSpacing = '4px'; T('MINISTRY OF', PAD + 60, y + 14, '#cfd2da'); if (on) ctx.letterSpacing = '0px';
      font(30, 900, 'Archivo', 'expanded'); T('VICTORY', PAD + 58, y + 44, '#ffe900');
      font(15, 700); if (on) ctx.letterSpacing = '3px'; T(t('sh.head').toUpperCase(), W - PAD, y + 16, '#ffe900', 'right'); if (on) ctx.letterSpacing = '0px';
      font(17, 500, 'Share Tech Mono'); T(stamp, W - PAD, y + 42, '#a8aebd', 'right');
      y += 74; R(PAD, y, IN, 1, '#2a2f3d'); y += 46;
      // order
      font(16, 700); if (on) ctx.letterSpacing = '3px';
      const meta = [n > 1 ? fill(t('sh.order'), { n: k, m: n }) : null, isFinite(left) && left > 0 ? fill(t('sh.left'), { d: durDown(left / 3.6e6) }) : null, medalsOf(a) ? fill(t('sh.medals'), { n: medalsOf(a) }) : null].filter(Boolean).join('  ·  ').toUpperCase();
      T(meta, PAD, y, '#a8aebd'); if (on) ctx.letterSpacing = '0px'; y += 16;
      const tpx = title.length > 30 ? 42 : 54; font(tpx, 900, 'Archivo', 'expanded');
      for (const l of wrap(title, IN, 3)) { y += tpx + 4; T(l, PAD, y, '#f1f2f4'); }
      y += 34;
      // forecast
      const fy = y; font(40, 900, 'Archivo', 'expanded'); const vLines = wrap(t('v.' + res.verdict).toUpperCase(), IN - 60, 2);
      font(22, 500); const mLines = wrap(t('m')[res.verdict] || '', IN - 60, 2);
      const fh = 34 + 16 + vLines.length * 44 + 10 + mLines.length * 30 + 26;
      if (on) { ctx.fillStyle = vc + '14'; ctx.fillRect(PAD, fy, IN, fh); ctx.strokeStyle = vc; ctx.lineWidth = 3; ctx.strokeRect(PAD + 1.5, fy + 1.5, IN - 3, fh - 3); }
      y = fy + 40; font(15, 700); if (on) ctx.letterSpacing = '3px'; T(t('forecast').toUpperCase(), PAD + 30, y, '#cfd2da'); if (on) ctx.letterSpacing = '0px';
      font(40, 900, 'Archivo', 'expanded'); for (const l of vLines) { y += 46; T(l, PAD + 30, y, vc); }
      y += 6; font(22, 500); for (const l of mLines) { y += 30; T(l, PAD + 30, y, '#e6e8ee'); }
      y = fy + fh + 84;
      // what to do now
      R(PAD, y - 28, 6, 6, '#5fd38d'); font(16, 700); if (on) ctx.letterSpacing = '3px'; T(t('dirLabel').toUpperCase(), PAD + 16, y - 20, '#ffe900'); if (on) ctx.letterSpacing = '0px';
      const big1 = ['steady', 'lost'].includes(p.d.kind) ? '' : p.kicker.toUpperCase();
      if (big1) { font(26, 800, 'Archivo', 'expanded'); y += 22; T(big1, PAD, y, '#ffe900'); }
      font(p.target.length > 14 ? 64 : 92, 900, 'Archivo', 'expanded');
      for (const l of wrap(p.target.toUpperCase(), IN, 2)) { y += p.target.length > 14 ? 66 : 92; T(l, PAD, y, '#f1f2f4'); }
      y += 18;
      const why = [p.lead, plain(p.why)].filter(Boolean).join(' ');
      font(25, 500); for (const [i, l] of wrap(why, IN, 5).entries()) { y += 35; T(l, PAD, y, i === 0 && p.lead ? vc : '#e6e8ee'); }
      if (p.cap) { y += 22; R(PAD, y, IN, 1, '#2a2f3d'); y += 8; font(22, 700); for (const l of wrap(plain(p.cap), IN, 3)) { y += 32; T(l, PAD, y, '#f1f2f4'); } }
      y += 52;
      // objectives
      font(16, 700); if (on) ctx.letterSpacing = '3px'; T(t('sh.obj').toUpperCase(), PAD, y, '#a8aebd'); if (on) ctx.letterSpacing = '0px'; y += 18;
      for (const o of objs.slice(0, 6)) {
        y += 14; R(PAD, y, IN, 1, '#22262f'); y += 36;
        font(17, 700); ctx.letterSpacing = '1.5px'; const pw = o.pill ? ctx.measureText(o.pill.toUpperCase()).width + 26 : 0; ctx.letterSpacing = '0px';
        if (o.pill && on) { const c = SH_VC[o.v] || '#a8aebd'; ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.strokeRect(W - PAD - pw, y - 24, pw, 32); ctx.letterSpacing = '1.5px'; T(o.pill.toUpperCase(), W - PAD - pw / 2 + 0.75, y - 2, c, 'center'); ctx.letterSpacing = '0px'; }
        font(24, 700); const tl = wrap(o.title, IN - pw - 24, 2); for (const [i, l] of tl.entries()) { if (i) y += 30; T(l, PAD, y, '#f1f2f4'); }
        if (o.frac != null) {
          y += 18; const fc = SH_FAC[o.fac] || '#ffe900';
          R(PAD, y, IN, 12, '#1f232c');
          if (o.proj != null && o.proj > o.frac && on) { ctx.fillStyle = fc + '40'; ctx.fillRect(PAD + IN * o.frac, y, IN * (Math.min(1, o.proj) - o.frac), 12); }
          R(PAD, y, Math.max(3, IN * Math.min(1, o.frac)), 12, fc); y += 12;
        }
        font(20, 500); for (const l of wrap(o.line, IN, 2)) { y += 30; T(l, PAD, y, '#b8bdc9'); }
      }
      if (objs.length > 6) { y += 34; font(19, 500); T(fill(t('sh.more'), { n: objs.length - 6 }), PAD, y, '#a8aebd'); }
      // Joel
      if (joel.length) {
        y += 56; font(16, 700); if (on) ctx.letterSpacing = '3px'; T(t('jo.title').toUpperCase(), PAD, y, '#ffbb25'); if (on) ctx.letterSpacing = '0px'; y += 6;
        for (const j of joel) { y += 34; font(22, 700); T(j.title, PAD, y, '#f1f2f4'); font(19, 500); T(j.when, W - PAD, y, '#a8aebd', 'right'); if (j.detail) { font(19, 500); for (const l of wrap(j.detail, IN, 1)) { y += 28; T(l, PAD, y, '#b8bdc9'); } } }
      }
      // footer
      y += 70; R(PAD, y, IN, 1, '#2a2f3d'); y += 46;
      font(23, 400, 'Share Tech Mono'); T('shibacheemshd.github.io/ministry-of-victory', PAD, y, '#f1f2f4');
      font(17, 500); T(t('sh.foot'), W - PAD, y, '#a8aebd', 'right');
      y += 40;
      if (on) { const hy = y; for (let x = -40; x < W + 40; x += 36) { ctx.fillStyle = '#ffe900'; ctx.beginPath(); ctx.moveTo(x, hy + 16); ctx.lineTo(x + 16, hy); ctx.lineTo(x + 34, hy); ctx.lineTo(x + 18, hy + 16); ctx.closePath(); ctx.fill(); } }
      return y + 16;
    }
    cv.width = W; cv.height = 10; const H = Math.max(1350, Math.ceil(draw(false)));
    cv.width = W * S; cv.height = H * S; ctx.scale(S, S);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d0e12'); bg.addColorStop(1, '#08090b'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const gl = ctx.createRadialGradient(140, 0, 0, 140, 0, 700); gl.addColorStop(0, 'rgba(255,233,0,.10)'); gl.addColorStop(1, 'rgba(255,233,0,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, 700);
    ctx.strokeStyle = 'rgba(255,255,255,.03)'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); } for (let yy = 0; yy < H; yy += 40) { ctx.beginPath(); ctx.moveTo(0, yy + .5); ctx.lineTo(W, yy + .5); ctx.stroke(); }
    ctx.textBaseline = 'alphabetic';
    if (H > 1350) { /* taller than 4:5 for long orders: fine for Reddit */ }
    draw(true);
    return cv;
  }
  async function openShareImage(entry) {
    const dlg = $('dlg-share'), body = $('share-body');
    body.innerHTML = `<p class="arch-load">${ICON.dots}<span>${esc(t('sh.making'))}</span></p>`;
    if (!dlg.open) dlg.showModal();
    let cv;
    try { cv = await shareImage(entry); } catch (e) { body.innerHTML = `<p>${esc(t('sh.fail'))}</p>`; return; }
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const url = URL.createObjectURL(blob);
    const name = `ministry-of-victory-${String(txt(entry.a.title) || 'major-order').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${new Date(last.now).toISOString().slice(0, 10)}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const canCopy = !!(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write);
    body.innerHTML = `<div class="sh-prev"><img src="${url}" alt="${esc(t('sh.alt'))}"></div>
      <p class="sh-note">${esc(t('sh.note'))}</p>
      <div class="sh-actions">
        <a class="btn primary" href="${url}" download="${esc(name)}">${esc(t('sh.dl'))}</a>
        ${canCopy ? `<button type="button" class="btn ghostly" data-shcopy>${ICON.copy}<span>${esc(t('sh.copy'))}</span></button>` : ''}
        ${canShare ? `<button type="button" class="btn ghostly" data-shshare>${esc(t('sh.share'))}</button>` : ''}
      </div>`;
    const cp = body.querySelector('[data-shcopy]');
    if (cp) cp.addEventListener('click', async () => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast(t('sh.copied')); } catch { toast(t('copyFail')); } });
    const sh = body.querySelector('[data-shshare]');
    if (sh) sh.addEventListener('click', async () => { try { await navigator.share({ files: [file], title: plain(clean(txt(entry.a.title) || 'Major Order')), text: 'https://shibacheemshd.github.io/ministry-of-victory/' }); } catch {} });
    dlg.addEventListener('close', () => setTimeout(() => URL.revokeObjectURL(url), 1000), { once: true });
  }
  async function copyText(s) {
    try { if (navigator.clipboard && window.isSecureContext !== false) { await navigator.clipboard.writeText(s); return true; } } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = s; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
  let toastTimer = 0;
  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-otab],[data-tab],[data-goto],[data-toggle-nums],[data-brief],[data-preset],[data-close],[data-copy],[data-shareimg],[data-cycle],[data-hint-close],[data-legend],[data-hmode],[data-ifocus]');
    if (!el) return;
    if (el.dataset.legend) {   // show / hide one line of a chart
      const id = el.dataset.legend, k = el.dataset.s, off = (ui.chartOff[id] ||= {});
      off[k] = !off[k];
      el.setAttribute('aria-pressed', String(!off[k]));
      document.querySelectorAll(`[data-chart="${CSS.escape(id)}"] [data-s="${CSS.escape(k)}"]`).forEach(n => n.classList.toggle('off', off[k]));
      return;
    }
    if (el.dataset.hmode) { ui.histMode[el.dataset.hmode] = el.dataset.v; render(); return; }
    if (el.dataset.ifocus) { const c = $(el.dataset.ifocus); if (c) { c.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); } return; }
    if (el.dataset.otab) { ui.order = el.dataset.otab; saveUi(); render(); return; }
    if (el.dataset.tab) { selectTab(el.dataset.tab); return; }
    if (el.dataset.cycle) { cycleTab(Number(el.dataset.cycle)); return; }
    if (el.dataset.shareimg) {
      const entry = last && last.results.find(x => String(x.a.id) === String(el.dataset.shareimg));
      if (entry) openShareImage(entry);
      return;
    }
    if (el.dataset.copy) {
      const entry = last && last.results.find(x => String(x.a.id) === String(el.dataset.copy));
      if (!entry) return;
      const text = shareText(entry);
      copyText(text).then(ok => {
        toast(ok ? t('copied') : t('copyFail'));
        if (ok) { el.classList.add('done'); setTimeout(() => el.classList.remove('done'), 1600); }
      });
      return;
    }
    if (el.dataset.goto) { selectTab(el.dataset.goto, el.dataset.scroll || 'tabs'); return; }
    if (el.hasAttribute('data-toggle-nums')) {
      ui.showNums = !ui.showNums; saveUi();
      const sec = $('steps-' + ui.order);
      if (sec) sec.classList.toggle('show-nums', ui.showNums);
      el.setAttribute('aria-pressed', String(ui.showNums));
      el.textContent = ui.showNums ? t('hideNums') : t('showNums');
      return;
    }
    if (el.dataset.brief) {
      const id = el.dataset.brief; ui.briefOpen[id] = !ui.briefOpen[id];
      const box = $('brief-' + id); if (box) box.classList.toggle('open', ui.briefOpen[id]);
      el.textContent = ui.briefOpen[id] ? t('less') : t('more');
      el.setAttribute('aria-expanded', String(ui.briefOpen[id]));
      return;
    }
    if (el.dataset.preset) { updateSim(el.dataset.preset, Number(el.dataset.v)); return; }
    if (el.hasAttribute('data-hint-close')) { store.set('hintSeen', true); el.closest('.order')?.classList.remove('has-hint'); el.closest('.hint')?.remove(); return; }
    if (el.hasAttribute('data-close')) { el.closest('dialog')?.close(); }
  });
  let simRaf = 0;
  // a refresh never rebuilds the page under a slider that is being dragged; it waits for the release
  document.addEventListener('pointerdown', (e) => { if (e.target && e.target.type === 'range') dragging = true; });
  const endDrag = () => { if (!dragging) return; dragging = false; if (pendingRender) { pendingRender = false; render(); } };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  // back on the tab after a while: refresh straight away instead of waiting for the next tick
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastRun > REFRESH_MS) refresh(); });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.sim) { const v = Number(el.value), id = el.dataset.sim; el.style.setProperty('--p', ((v - 5) / 95) * 100 + '%'); cancelAnimationFrame(simRaf); simRaf = requestAnimationFrame(() => updateSim(id, v)); }
    if (el.dataset && el.dataset.pace) { const v = Number(el.value), id = el.dataset.pace; cancelAnimationFrame(simRaf); simRaf = requestAnimationFrame(() => updatePace(id, v)); }
  });
  // remember which objective details are open across the 60 s re-renders ('toggle' doesn't bubble)
  document.addEventListener('toggle', (e) => {
    const el = e.target;
    if (el && el.dataset && el.dataset.intel) ui.intelOpen[el.dataset.intel] = el.open;
    if (el && el.dataset && el.dataset.simbox) ui.simOpen[el.dataset.simbox] = el.open;
    if (el && el.dataset && 'cross' in el.dataset) ui.crossOpen = el.open;
    if (el && el.dataset && 'intelstrip' in el.dataset) ui.intelStripOpen = el.open;
  }, true);
  // game-style shortcuts: Q / E switch tab, 1-3 jump to a tab, R refreshes, ? opens the guide
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag) || (e.target && e.target.isContentEditable)) return;
    if (document.querySelector('dialog[open]') || !last) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'q' || k === 'e') { e.preventDefault(); cycleTab(k === 'q' ? -1 : 1); }
    else if (k === '1' || k === '2' || k === '3' || k === '4') { e.preventDefault(); selectTab(TABS[Number(k) - 1]); }
    else if (k === 'r') { e.preventDefault(); refresh(); }
    else if (k === '?') { e.preventDefault(); $('dlg-info').showModal(); }
  });
  // arrow keys inside tab lists
  document.addEventListener('keydown', (e) => {
    const tabEl = e.target.closest && e.target.closest('[role="tab"]');
    if (!tabEl || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const list = [...tabEl.parentElement.querySelectorAll('[role="tab"]')];
    let i = list.indexOf(tabEl);
    i = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
    e.preventDefault();
    list[i].click();
    setTimeout(() => {
      const again = document.getElementById(list[i].id);
      if (again) again.focus();
    }, 0);
  });
  // planet card: opens on hover (mouse) or tap, stays while the pointer is over it, pinned by a click
  let pcTimer = 0;
  function openCard(pin) {
    if (!last) return;
    const forced = ui.pcForce != null && last.planets[ui.pcForce];
    let wrap = document.querySelector('.directive .pc-wrap');
    let entry = last.results.find(x => String(x.a.id) === String(ui.order));
    if ((!wrap || !entry) && forced) {   // no order on screen: the war map still opens planet cards
      wrap = document.querySelector('.pc-wrap.free') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'pc-wrap free', hidden: true }));
      entry = entry || { res: { tasks: [], id: 'none' }, a: {} };
    }
    if (!wrap || !entry) return;
    const cp = forced ? { planet: forced, list: null } : cardPlanets(entry); if (!cp) return;
    wrap.innerHTML = planetCardHTML(cp.planet, entry, cp.list);
    wrap.hidden = false; wrap.classList.add('open');
    if (!store.get('pcSeen', false)) { store.set('pcSeen', true); document.querySelector('[data-globe]')?.classList.remove('g-new'); }
    placeCard();
    if (pin) ui.pcPinned = true;
    wrap.classList.toggle('pinned', !!ui.pcPinned);
    const g = document.querySelector('[data-globe]'); if (g) g.setAttribute('aria-expanded', 'true');
  }
  // desktop: beside the globe, over the side column when it fits there, never over the headline;
  // phones get a bottom sheet from the stylesheet
  function placeCard() {
    const wrap = document.querySelector('.pc-wrap.open'), g = ui.pcAnchor === 'map' ? (document.querySelector(`.mp[data-mp="${ui.pcForce}"]`) || document.querySelector('.war-map')) : document.querySelector('[data-globe]');
    if (!wrap || !g) return;
    if (window.innerWidth <= 760) { wrap.style.left = wrap.style.top = ''; wrap.removeAttribute('data-side'); return; }
    const r = g.getBoundingClientRect(), gap = 14, vw = window.innerWidth, vh = window.innerHeight;
    const roomR = vw - r.right - gap - 16;
    let W = Math.min(400, vw - 32), left, side;
    if (roomR >= 320) { W = Math.min(400, roomR); left = r.right + gap; side = 'right'; }
    else if (r.left - gap - 16 >= W) { left = r.left - gap - W; side = 'left'; }
    else { left = Math.max(16, Math.min(vw - W - 16, r.left + r.width / 2 - W / 2)); side = 'below'; }
    const h = wrap.offsetHeight || 420;
    let top = side === 'below' ? r.bottom + gap : r.top - 10;
    top = Math.max(76, Math.min(vh - h - 12, top));
    wrap.style.width = W + 'px'; wrap.style.left = Math.round(left) + 'px'; wrap.style.top = Math.round(top) + 'px'; wrap.dataset.side = side;
  }
  let placeRaf = 0;
  const placeSoon = () => { if (placeRaf) return; placeRaf = requestAnimationFrame(() => { placeRaf = 0; placeCard(); }); };
  window.addEventListener('scroll', placeSoon, { passive: true });
  window.addEventListener('resize', placeSoon);
  function closeCard(force) {
    if (ui.pcPinned && !force) return;
    ui.pcPinned = false; ui.pcForce = null; ui.pcAnchor = null;
    document.querySelectorAll('.pc-wrap').forEach(wrap => { wrap.hidden = true; wrap.classList.remove('open'); });
    const g = document.querySelector('[data-globe]'); if (g) g.setAttribute('aria-expanded', 'false');
  }
  // war map: tooltip on hover/focus, click opens the planet card for that planet
  function mapTip(g) {
    const wrap = g.closest('.war-map'), tip = wrap && wrap.querySelector('.map-tip'); if (!tip) return;
    const [name, owner, players, kind, lib] = (g.dataset.tip || '').split('|');
    tip.innerHTML = `<b>${esc(name)}</b><span>${esc(owner)}</span><span>${esc(fill(t('map.tipP'), { n: players }))} · ${esc(fill(t(kind === 'def' ? 'map.tipD' : 'map.tipL'), { p: lib }))}</span>`;
    const wr = wrap.getBoundingClientRect(), gr = g.getBoundingClientRect();
    tip.hidden = false;
    const x = gr.left + gr.width / 2 - wr.left, y = gr.top - wr.top;
    tip.style.left = Math.max(4, Math.min(wr.width - tip.offsetWidth - 4, x - tip.offsetWidth / 2)) + 'px';
    tip.style.top = (y - tip.offsetHeight - 8 < 0 ? gr.bottom - wr.top + 8 : y - tip.offsetHeight - 8) + 'px';
    wrap.querySelectorAll('.mp.hot').forEach(x => x.classList.remove('hot')); g.classList.add('hot');
  }
  function mapTipOff(wrap) { const tip = wrap && wrap.querySelector('.map-tip'); if (tip) tip.hidden = true; wrap && wrap.querySelectorAll('.mp.hot').forEach(x => x.classList.remove('hot')); }
  document.addEventListener('pointerover', (e) => { const g = e.target.closest && e.target.closest('.mp'); if (g) mapTip(g); });
  document.addEventListener('pointerout', (e) => { const g = e.target.closest && e.target.closest('.mp'); if (g && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.mp') === g)) mapTipOff(g.closest('.war-map')); });
  document.addEventListener('focusin', (e) => { const g = e.target.closest && e.target.closest('.mp'); if (g) mapTip(g); });
  document.addEventListener('focusout', (e) => { const g = e.target.closest && e.target.closest('.mp'); if (g) mapTipOff(g.closest('.war-map')); });
  document.addEventListener('pointerover', (e) => {
    const inGlobe = e.target.closest && e.target.closest('[data-globe]'), inCard = e.target.closest && e.target.closest('.pc-wrap');
    if ((inGlobe || inCard) && e.pointerType !== 'touch') { clearTimeout(pcTimer); if (inGlobe && !document.querySelector('.pc-wrap.open')) pcTimer = setTimeout(() => openCard(false), 120); }
  });
  document.addEventListener('pointerout', (e) => {
    const from = e.target.closest && (e.target.closest('[data-globe]') || e.target.closest('.pc-wrap'));
    const to = e.relatedTarget && e.relatedTarget.closest && (e.relatedTarget.closest('[data-globe]') || e.relatedTarget.closest('.pc-wrap'));
    if (from && !to && e.pointerType !== 'touch') { clearTimeout(pcTimer); pcTimer = setTimeout(() => closeCard(false), 260); }
  });
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-globe]');
    if (g) { if (ui.pcPinned) closeCard(true); else openCard(true); return; }
    if (e.target.closest('[data-pcclose]')) { closeCard(true); return; }
    const af = e.target.closest('[data-af]');
    if (af) { ui.af = af.dataset.af; render(); return; }
    const vw = e.target.closest('[data-view]');
    if (vw) { setView(vw.dataset.view); return; }
    const nf = e.target.closest('[data-nf]');
    if (nf) { ui.nf = nf.dataset.nf || null; render(); return; }
    const op = e.target.closest('[data-open-planet]');
    if (op) { ui.pcForce = op.dataset.openPlanet; ui.pcAnchor = 'map'; openCard(true); return; }
    const mp = e.target.closest('.mp[data-mp]');
    if (mp) { mapTipOff(mp.closest('.war-map')); ui.pcForce = mp.dataset.mp; ui.pcAnchor = 'map'; openCard(true); return; }
    const tq = e.target.closest('[data-tipq]'); if (tq) { toast(tq.dataset.tipq); return; }
    const tab = e.target.closest('[data-pcplanet]');
    if (tab) { ui.pcPlanet = tab.dataset.pcplanet; openCard(ui.pcPinned); return; }
    if (ui.pcPinned && !e.target.closest('.pc-wrap')) closeCard(true);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.pc-wrap.open')) { closeCard(true); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.mp[data-mp]')) { e.preventDefault(); ui.pcForce = e.target.dataset.mp; ui.pcAnchor = 'map'; openCard(true); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-globe]')) { e.preventDefault(); if (ui.pcPinned) closeCard(true); else openCard(true); }
  });
  // charts: crosshair follows the pointer (mouse, pen or finger)
  document.addEventListener('pointermove', (e) => { const c = e.target.closest && e.target.closest('.chart'); if (c) chartHover(c, e.clientX, e.clientY); });
  document.addEventListener('pointerdown', (e) => { const c = e.target.closest && e.target.closest('.chart'); if (c) chartHover(c, e.clientX, e.clientY); });
  document.addEventListener('pointerout', (e) => { const c = e.target.closest && e.target.closest('.chart'); if (c && !(e.relatedTarget && c.contains(e.relatedTarget))) { c.classList.remove('hover'); c.querySelectorAll('.hl, .dim').forEach(n => n.classList.remove('hl', 'dim')); } });
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  $('open-settings').addEventListener('click', () => $('dlg-settings').showModal());
  $('open-info').addEventListener('click', () => $('dlg-info').showModal());
  // the archive has its own address (#archive), so it can be shared and the back button works
  function setView(v, push = true) {
    ui.view = v === 'archive' ? 'archive' : 'war';
    if (push) { try { history.pushState(null, '', ui.view === 'archive' ? '#archive' : location.pathname + location.search); } catch { } }
    if (ui.view === 'archive') loadArchive();
    render(); window.scrollTo({ top: 0 });
  }
  $('open-archive').addEventListener('click', () => setView(ui.view === 'archive' ? 'war' : 'archive'));
  window.addEventListener('popstate', () => setView(location.hash === '#archive' ? 'archive' : 'war', false));
  if (location.hash === '#archive') ui.view = 'archive';
  $('refresh').addEventListener('click', () => refresh());

  function bindSettings() {
    const map = { 's-capmode': 'capMode', 's-cap': 'capacity', 's-dss': 'dssBonus', 's-hod': 'hodMult', 's-rec': 'recordShare', 's-contact': 'contact', 's-motion': 'motion' };
    for (const [id, key] of Object.entries(map)) {
      const el = $(id);
      el.value = settings[key];
      el.addEventListener('change', () => {
        settings[key] = el.type === 'number' ? Number(el.value) : el.value;
        store.set('settings', settings);
        if (key === 'motion') { document.documentElement.classList.toggle('calm', reduced()); render(); }
        else refresh();
      });
    }
  }

  function applyTexts() {
    document.documentElement.lang = 'en';
    $('tagline').textContent = t('tagline');
    $('settings-title').textContent = t('settings');
    $('info-title').textContent = t('info');
    $('share-title').textContent = t('sh.title');
    $('open-settings').setAttribute('aria-label', t('settings'));
    $('open-settings').title = t('settings');
    $('open-info').setAttribute('aria-label', t('info'));
    $('open-info').title = t('info');
    $('order-tabs').setAttribute('aria-label', 'Major Orders');
    const lbl = { 'l-cap': 'sCap', 'l-capval': 'sCapVal', 'l-dss': 'sDss', 'l-hod': 'sHod', 'l-rec': 'sRec', 'l-contact': 'sContact', 'l-motion': 'sMotion' };
    for (const [id, k] of Object.entries(lbl)) $(id).textContent = t(k);
    $('s-capmode').options[0].textContent = t('sAuto');
    $('s-capmode').options[1].textContent = t('sManual');
    $('s-motion').options[0].textContent = t('mFull');
    $('s-motion').options[1].textContent = t('mReduced');
    $('explain').innerHTML = EXPLAIN;
    $('footer').textContent = t('footer');
    for (const [id, k] of [['l-refresh', 'kh.refresh'], ['l-archive', 'ar.btn'], ['l-info', 'help'], ['l-settings', 'settings']]) { const el = $(id); if (el) el.textContent = t(k); }
    $('boot-skip').textContent = t('skip');
    const note = $('sk-note'); if (note) note.textContent = t('firstLoad');
  }

  /* ---------- boot sequence ---------- */
  let bootStart = performance.now(), bootTimer = 0, bootLines = 0;
  function bootType() {
    const log = $('boot-log');
    const lines = t('boot');
    if (bootLines < lines.length) {
      bootLines++;
      log.innerHTML = lines.slice(0, bootLines).map((l, i) => esc(l) + (i < bootLines - 1 ? ` <span class="ok">${t('bootOk')}</span>` : ' <span class="caret"></span>')).join('\n');
      bootTimer = setTimeout(bootType, 320);
    }
  }
  // state: 'ok' (data in), 'fail' (first load failed), 'wait' (API slow: show the page and keep loading)
  let bootDone = false;
  function bootFinish(state) {
    const boot = $('boot');
    if (!boot || bootDone) return;
    bootDone = true;
    const wait = 0;
    setTimeout(() => {
      clearTimeout(bootTimer);
      const log = $('boot-log');
      const lines = t('boot');
      const lastLine = state === 'ok' ? t('bootReady') : state === 'fail' ? t('bootFail') : t('bootWait');
      log.innerHTML = lines.map((l, i) => `${esc(l)} <span class="${state === 'ok' || i < lines.length - 1 ? 'ok' : 'pending'}">${state === 'ok' || i < lines.length - 1 ? t('bootOk') : '…'}</span>`).join('\n') + '\n' + esc(lastLine);
      setTimeout(() => boot.classList.add('out'), reduced() ? 0 : 120);
    }, wait);
  }
  $('boot-skip').addEventListener('click', () => { bootDone = true; $('boot').classList.add('out'); });
  setTimeout(() => bootFinish('wait'), 4500);

  /* ---------- start ---------- */
  bindSettings();
  applyTexts();
  document.documentElement.classList.toggle('calm', reduced());
  if (reduced()) $('boot').classList.add('out'); else bootType();
  loadNames().then(() => { if (last) render(); });
  {
    const snap = store.get('snap', null);
    if (snap && snap.war && Date.now() - snap.t < 6 * 3600e3) { bootDone = true; $('boot').classList.add('out'); refresh({ seed: snap }); }
    else loadLive().then(l => { if (l && !freshDone) refresh({ seed: l }); });
  }
  refresh();
  setInterval(tick, 1000);
})();
