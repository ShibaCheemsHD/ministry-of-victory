  const API = 'https://api.helldivers2.dev';
  const NAMES = {
    items: 'https://raw.githubusercontent.com/helldivers-2/json/master/items/item_names.json',
  };
  // GitHub's raw files, with jsDelivr's copy of the same file as the fallback when raw is down or
  // throttled (audit ARCH-05). jsDelivr can be a few hours behind, which the callers' age checks handle.
  async function ghFetch(url, opts) {
    try {
      const r = await fetch(url, opts);
      if (r.ok || (r.status < 500 && r.status !== 429)) return r;
    } catch (e) { if (e && e.name === 'AbortError') throw e; }
    const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/([^?]+)/.exec(url);
    if (!m) throw new TypeError('Failed to fetch');
    return fetch(`https://cdn.jsdelivr.net/gh/${m[1]}/${m[2]}@${m[3]}/${m[4]}`, { ...opts, cache: 'no-store' });
  }
  const REFRESH_MS = 60000;
  // damage constant K (HP per second per player per unit of impact multiplier): reference value measured
  // live on 28 Oct 2026; plausible range used to reject bad measurements
  const K_REF = 0.027, K_MIN = 0.005, K_MAX = 0.2;
  const KEEP_MS = 48 * 3600e3;

  /* ---------- storage (per-browser conveniences; never required) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mocheck.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('mocheck.' + k, JSON.stringify(v)); } catch {} },
  };

  /* ---------- texts + formatting (English only) ---------- */
  const look = (o, k) => k.split('.').reduce((o2, p) => o2?.[p], o);
  const t = (k) => {
    const v = look(TEXT, k);
    // the test page lists every text the code asks for and the dictionary doesn't have
    if (v == null && window.__mockLog) (window.__missingT ||= new Set()).add(k);
    return v ?? k;
  };
  // an optional text: null when there is none (never logged as missing)
  const tHas = (k) => look(TEXT, k) ?? null;
  // the browser's own English variant if it has one, otherwise en-GB (24-hour clock)
  const LOCALE = (() => { const n = (navigator.language || '').trim(); return /^en(-|$)/i.test(n) ? n : 'en-GB'; })();
  const locale = () => LOCALE;
  // numbers always in English format (36,000), whatever the browser's region
  const fmt = (n, d = 0, min = d) => (n == null || !isFinite(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: min });
  const plainCap = (s) => String(s).replace(/<[^>]+>/g, '');
  // a value just under 1 never rounds up to "100%" (8 Nov 2026: a planet at 99.6% read 100% before it fell)
  const pct = (x, d = 0) => (x == null || !isFinite(x)) ? '—' : x < 1 && Math.round(x * 100 * 10 ** d) >= 100 * 10 ** d ? fmt(Math.floor(x * 1000) / 10, 1) + '%' : fmt(x * 100, d) + '%';
  // a projection of the goal: past three times it, the exact figure means nothing
  const projPct = (x) => x > 3 ? '>300%' : pct(x);
  // shares in the plan texts: "83%", or "over 500%" when even 5x the playerbase isn't enough
  // a share of everyone online: past twice everyone, "x times everyone" says it better than 23,083%
  const sharePct = (x, d = 0) => (x == null || !isFinite(x)) ? t('shareInf') : x > 2 ? fill(t('shareX'), { x: fmt(x, x < 10 ? 1 : 0) }) : pct(x, d);
  // the same inside a sentence, as a whole phrase: "45% of everyone online", "3× everyone online", "more than everyone online"
  const shareOf = (x) => (x == null || !isFinite(x)) || x > 2 ? sharePct(x) : fill(t('shareOf'), { p: pct(x) });
  const big = (n) => {
    if (n == null || !isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a >= 1e9) return fmt(n / 1e9, 2, 0) + t('u.B');
    if (a >= 1e6) return fmt(n / 1e6, 2, 0) + t('u.M');
    if (a >= 1e4) return fmt(n / 1e3, 1, 0) + t('u.k');
    return fmt(n);
  };
  const people = (n) => n == null || !isFinite(n) ? '—' : fmt(Math.round(n / 100) * 100);
  const dur = (h) => {
    if (h == null || !isFinite(h)) return t('never');
    const U = t('u');
    if (h < 1) return Math.max(1, Math.round(h * 60)) + ' ' + U.min;
    // round to whole hours first, so 4d 23.6h reads "5d", never "4d 24h"
    const H = Math.round(h), d = Math.floor(H / 24), hh = H - d * 24;
    return d ? (hh ? `${d}${U.d} ${hh}${U.h}` : `${d}${U.d}`) : `${H}${U.h}`;
  };
  // time left, rounded down like the countdown (2d 18h 59m -> "2d 18h")
  const durDown = (h) => {
    if (h == null || !isFinite(h)) return '—';
    const U = t('u');
    if (h < 1) return Math.max(0, Math.floor(h * 60)) + ' ' + U.min;
    const d = Math.floor(h / 24), hh = Math.floor(h - d * 24);
    return d ? `${d}${U.d} ${hh}${U.h}` : `${hh}${U.h}`;
  };
  // time left with minutes under a day ("2h 05m"), as durDown otherwise
  const hmLeft = (h) => {
    if (!(h >= 1 && h < 24)) return durDown(h);
    const U = t('u'), m = Math.floor((h % 1) * 60);
    return `${Math.floor(h)}${U.h} ${String(m).padStart(2, '0')}${U.m}`;
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clean = (s) => esc(String(s ?? '').replace(/<\/?i(=\d+)?>/g, ''));
  // API texts are requested in English; if an object with every language ever comes back, take English
  const txt = (m) => m && typeof m === 'object' ? (m['en-US'] || m['en-GB'] || m.en || Object.values(m)[0] || '') : (m || '');
  const fill = (str, params) => String(str).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
  const listJoin = (a) => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' ' + t('and') + ' ' + a[a.length - 1];
  const facName = (f) => esc(t('fac')[f] || f || '');
  // "Terminid kills"
  const facWhat = (f, type) => fill(t('facWhat'), { f: f && f !== 'Humans' ? facName(f) : '', what: t('what')[type] || t('what')[0] }).replace(/\s+/g, ' ').trim();
  const facPlural = (f) => esc(t('facPl')[f] || t('fac')[f] || f || '');
  // the API writes some names in capitals: "Achernar Secundus" inside a sentence, never "ACHERNAR SECUNDUS"
  const planetName = (p) => p ? esc(titleCase(txt(p.name)) || ('#' + p.index)) : '—';
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
    hodMult: ENGINE.DEFAULTS.hodMult, recordShare: ENGINE.DEFAULTS.recordShare, contact: '', motion: 'full', layout: 'full', notify: 'off' }, store.get('settings', {}));
  if (settings.contact === 'ministry-of-victory-user') settings.contact = '';
  // the glance view is gone (7 Nov 2026): the page itself is the glance now
  settings.layout = 'full';
  // 1.3 was the old default for Heavy Ordnance, measured on one order; the war log since 2025 says x1.8
  if (settings.hodMult === 1.3) settings.hodMult = ENGINE.DEFAULTS.hodMult;
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => settings.motion === 'reduced' || mq.matches;
  // the forecast runs on numbers set by hand: said beside it, on the image and in the copied text, so a test
  // never travels as the live forecast (critique 1 Nov 2026)
  const customModel = () => settings.capMode === 'manual' || ['dssBonus', 'hodMult', 'recordShare'].some(k => Number(settings[k]) !== ENGINE.DEFAULTS[k]);

  /* ---------- enemy / item names (best effort) ---------- */
  const names = { enemies: store.get('names.enemies', null), enemy1: store.get('names.enemy1', null), items: store.get('names.items', null), strats: store.get('names.strats', null) };
  async function loadNames(force = false) {
    const age = Date.now() - store.get('names.t', 0);
    if (names.items && age < (force ? 15 * 60e3 : 24 * 3600e3)) return;
    // enemies come with the page (GAME.foe, src/game/enemies.json): the community enemy and stratagem lists
    // went offline in Oct 2026, so only the item list is fetched; older copies in this browser still help
    try {
      const itemList = await ghFetch(NAMES.items).then(r => r.ok ? r.json() : null).catch(() => null);
      if (itemList) { names.items = Object.fromEntries(Object.entries(itemList).map(([k, v]) => [k, v.name])); store.set('names.items', names.items); }
      store.set('names.t', Date.now());
    } catch {}
  }
  // a name the lists don't have yet (a brand-new weapon or enemy): plain words, never a raw id
  const itemKnown = (id) => id ? (GAME.item?.[id] || names.items?.[id] || names.strats?.[id] || (record && record.itemHints ? record.itemHints[id] : null) || null) : null;
  const itemName = (id) => id ? (itemKnown(id) || t('itemAny')) : null;
  // an enemy unit not in our list yet: said as "Automaton targets of one kind", never as all Automatons
  const foeHint = (id) => record && record.foeHints ? record.foeHints[id] : null;
  const enemyName = (id, fac) => id ? (GAME.foe?.[id]?.many || foeHint(id)?.many || names.enemies?.[id] || (fac && fac !== 'Humans' ? fill(t('enemyAnyF'), { f: facName(fac) }) : t('enemyAny'))) : null;
  const enemyOne = (id, fac) => id ? (GAME.foe?.[id]?.one || foeHint(id)?.one || names.enemy1?.[id] || (fac && fac !== 'Humans' ? fill(t('enemyOneF'), { f: facName(fac) }) : t('enemyAny'))) : null;
  const enemyKnown = (id) => !!(GAME.foe?.[id] || foeHint(id) || names.enemies?.[id]);
  const capFirst = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const unknownNames = (results) => results.some(({ res }) => res.tasks.some(r =>
    r.task.itemId && !itemKnown(r.task.itemId)));

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
  const saveUi = () => store.set('ui', { order: ui.order, orderManual: !!ui.orderManual, tab: ui.tab, showNums: ui.showNums, celebrated: ui.celebrated || {}, calls: ui.calls || {}, bands: ui.bands || {}, nf: ui.nf || null, histMode: ui.histMode, simOpen: ui.simOpen });
  const prev = { bars: {}, count: {}, dir: {}, verdict: {}, seen: {} };
  const $ = (id) => document.getElementById(id);
  // An order is identified by its id *and* its task list: if Super Earth edits an order in place,
  // its pace history starts over instead of mixing old and new objectives.
  const hashStr = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const orderKey = (a) => `${a.id}:${hashStr(JSON.stringify((a.tasks || []).map(tk => [tk.type, tk.values, tk.valueTypes])))}`;
  let known = new Set(store.get('known', []));   // orders this browser has already shown
  const fresh = new Set();                       // orders that arrived while the page was open
  let dragging = false, pendingRender = false;

