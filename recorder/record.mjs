// Ministry of Victory - war recorder.
// Runs every ~10 minutes on GitHub Actions: takes one snapshot of the war, keeps the history since the
// start of the running Major Orders, and looks through it for things the players can't explain
// (hand-made jumps and setbacks, resistance changes, new attacks, edited objectives).
//   node record.mjs <history.json> <out dir>
// Writes history.json (everything), intel.json (alerts, small) and recent.json (last 6 hours, for the page).
// Two kinds of finding: things the game states outright (resistance values, attacks, edited objectives,
// the galactic war effects Super Earth Command switches on and off), and things worked out from the
// numbers (a jump no player effort explains), with the planet's own count of missions won as evidence.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const E = require('./engine.cjs');
import { loadStatic, mapOfficial } from './official.mjs';
import { buildRetro } from './retro.mjs';
// failures show up as annotations on the run page
const fail = (e) => { console.log('::error::' + String(e && e.stack || e).replace(/\n/g, '%0A')); process.exit(1); };
process.on('unhandledRejection', fail); process.on('uncaughtException', fail);

const API = 'https://api.helldivers2.dev';
const CLIENT = 'ministry-of-victory-recorder';
const CONTACT = 'https://github.com/ShibaCheemsHD/ministry-of-victory';
const H = 3.6e6;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// the API allows 5 requests per 10 s per address: one every 2.3 s, and wait out a refusal
let lastReq = 0;
const seen = [];
async function get(p, tries = 5) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const wait = lastReq + 2300 - Date.now();
    if (wait > 0) await sleep(wait);
    lastReq = Date.now();
    const url = `${API}${p}${p.includes('?') ? '&' : '?'}culture=en-US`;
    try {
      const r = await fetch(url, { headers: { 'Accept-Language': 'en-US', 'X-Super-Client': CLIENT, 'X-Super-Contact': CONTACT }, signal: AbortSignal.timeout(20000) });
      if (r.status === 429 || r.status >= 500) { seen.push(r.status + ' ' + (r.headers.get('server') || '') + ' ' + (await r.text()).slice(0, 120).replace(/\s+/g, ' ')); await sleep(11000); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status} ${p}`);
      return await r.json();
    } catch (e) {
      seen.push(String(e && e.cause ? e.message + ' / ' + e.cause : e));
      if (attempt === tries - 1) throw new Error(p + ': ' + seen.join(' | '));
      await sleep(5000);
    }
  }
  throw new Error('gave up on ' + p + ': ' + seen.join(' | '));
}

// the game's own API (no browser access, so only the recorder can read it): galactic war effects
const OFFICIAL = 'https://api.live.prod.thehelldiversgame.com/api/';
async function official(p) {
  if (process.env.OFFICIAL_DIR) {   // tests: saved copies of the endpoints
    const f = { 'WarSeason/801/Status': 'status.json', 'WarSeason/GalacticWarEffects': 'effects.json', 'Episode/801': 'episode.json',
      'WarSeason/801/WarInfo': 'warinfo.json', 'v2/Assignment/War/801': 'assignment.json', 'Stats/war/801/summary': 'summary.json' }[p];
    try { return JSON.parse(fs.readFileSync(path.join(process.env.OFFICIAL_DIR, f), 'utf8')); } catch { return null; }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = lastReq + 1500 - Date.now();
    if (wait > 0) await sleep(wait);
    lastReq = Date.now();
    try {
      const r = await fetch(OFFICIAL + p, { headers: { 'Accept-Language': 'en-US', 'X-Super-Client': CLIENT, 'X-Super-Contact': CONTACT }, signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.json();
    } catch { /* try again */ }
    await sleep(5000);
  }
  return null;
}

// same order key as the page: id + a hash of the task list, so an edited order starts a new history
const hashStr = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const orderKey = (a) => `${a.id}:${hashStr(JSON.stringify((a.tasks || []).map(tk => [tk.type, tk.values, tk.valueTypes])))}`;
const txt = (m) => m && typeof m === 'object' ? (m['en-US'] || Object.values(m)[0] || '') : (m || '');

const [, , histPath = 'history.json', outDir = '.'] = process.argv;
let hist = { v: 1, samples: [], orders: {}, edits: [], names: {} };
try { hist = { ...hist, ...JSON.parse(fs.readFileSync(histPath, 'utf8')) }; } catch { /* first run */ }

// the community API first; if it's down, the same data built from the game's own API
let war, assignments, campaigns, stations = [], raw = [], src = 'community', all = null;
try {
  war = await get('/api/v1/war', 3);
  assignments = await get('/api/v1/assignments', 3);
  campaigns = await get('/api/v1/campaigns', 3);
  stations = await get('/api/v2/space-stations', 2).catch(() => []);
  raw = await get('/raw/api/v2/Assignment/War/801', 2).catch(() => []);
} catch (e) {
  console.log('::warning::community API unreachable, reading the official API instead: ' + String(e.message || e).slice(0, 400));
  const fetchJson = async (u) => { try { const r = await fetch(u, { signal: AbortSignal.timeout(20000) }); return r.ok ? await r.json() : null; } catch { return null; } };
  if (!hist.static || Date.now() - hist.static.t > 24 * H) { const S = await loadStatic(fetchJson); if (S) hist.static = { t: Date.now(), ...S }; }
  const [info, status0, summary, asg] = [await official('WarSeason/801/WarInfo'), await official('WarSeason/801/Status'), await official('Stats/war/801/summary'), await official('v2/Assignment/War/801')];
  const o = mapOfficial({ info, status: status0, summary, assignments: asg, S: hist.static }, Date.now());
  if (!o || !Array.isArray(asg)) throw new Error('both APIs unreachable: ' + String(e.message || e).slice(0, 300));
  ({ war, assignments, campaigns } = o); raw = asg; all = o.planets; src = 'official';
}
const now = Date.now();

// Strategic Opportunity dispatches, kept for a week: a goal cut right after one was earned, not hand-made
if (src === 'community') {
  const ds = await get('/api/v1/dispatches', 2).catch(() => []);
  for (const d of ds || []) {
    const msg = txt(d && d.message);
    if (!/strategic opportunity/i.test(msg) || (hist.so || []).some(x => x.id === d.id)) continue;
    (hist.so ||= []).push({ id: d.id, t: Date.parse(d.published) || now, msg: String(msg).slice(0, 800) });
  }
}
hist.so = (hist.so || []).filter(x => now - x.t < 8 * 24 * H);

const planets = {};
for (const c of campaigns || []) if (c && c.planet) planets[c.planet.index] = c.planet;
const named = new Set();
for (const a of assignments || []) for (const tk of a.tasks || []) {
  const t = E.parseTask(tk, 0);
  if (t.planetIndex != null) named.add(t.planetIndex);
}
for (const i of [...named].filter(i => !planets[i]).slice(0, 10)) {
  const p = all ? all[i] : await get('/api/v1/planets/' + i, 2).catch(() => null);
  if (p) planets[p.index] = p;
}
const st = (stations || [])[0];
const dss = st?.planet?.index ?? null;
if (st?.planet && !planets[dss]) planets[dss] = st.planet;
const hod = !!(st?.tacticalActions || []).find(a => /ordnance|ordinance/i.test(a.name || '') && a.status === 2 && Date.parse(a.statusExpire) > now);

// one snapshot: per planet [enemy HP, players, regen HP/s, max HP, event id, open regions, owner, event end, missions won (all time)]
const N = war?.statistics?.playerCount || 0;
const imp = Number(war?.impactMultiplier) || null;
const sample = { t: now, N, imp, dss, hod, pl: {}, prog: {} };
for (const [i, p] of Object.entries(planets)) {
  const ev = p.event;
  sample.pl[i] = [ev ? ev.health : p.health, p.statistics?.playerCount || 0, ev ? 0 : (p.regenPerSecond || 0), ev ? ev.maxHealth : p.maxHealth,
    ev ? (ev.id ?? 1) : 0, (p.regions || []).filter(r => r && r.isAvailable && (r.health || 0) > 0).length, p.currentOwner, ev ? (Date.parse(ev.endTime) || 0) : 0,
    p.statistics?.missionsWon ?? null];
  hist.names[i] = txt(p.name) || hist.names[i];
  if (ev && ev.faction) (hist.factions ||= {})[i] = ev.faction;
}
for (const a of assignments || []) sample.prog[orderKey(a)] = a.progress;

// orders: real start time (startTime is on the game clock, which runs weeks behind the calendar)
const gameNow = Date.parse(war?.now) / 1000;
for (const a of assignments || []) {
  const id = String(a.id), key = orderKey(a);
  const r = (raw || []).find(x => String(x.id32) === id);
  const start = r && isFinite(gameNow) && gameNow > r.startTime ? Math.round(now - (gameNow - r.startTime) * 1000) : (hist.orders[id]?.start ?? now);
  const tasks = (a.tasks || []).map(tk => ({ type: tk.type, values: tk.values, valueTypes: tk.valueTypes }));
  const was = hist.orders[id];
  if (was && was.key !== key) hist.edits.push({ kind: 'edited', order: id, t: now, diff: was.tasks ? E.taskDiff(was.tasks, tasks) : null });
  hist.orders[id] = { key, start, title: txt(a.title), exp: Date.parse(a.expiration) || null, seen: now, tasks };
}
for (const [id, o] of Object.entries(hist.orders)) if (now - o.seen > 3 * 24 * H) delete hist.orders[id];
hist.edits = hist.edits.filter(e => (e.ref === 'briefing' && hist.orders[e.order]) || now - e.t < 3 * 24 * H);

// history since the start of the oldest running order (at least 48 hours, at most 8 days)
hist.samples.push(sample);
const active = (assignments || []).map(a => hist.orders[String(a.id)]?.start).filter(Boolean);
const from = Math.max(now - 8 * 24 * H, Math.min(now - 48 * H, ...(active.length ? active.map(s => s - 2 * H) : [now])));
hist.samples = hist.samples.filter(s => s.t >= from).sort((a, b) => a.t - b.t);
for (const i of Object.keys(hist.names)) if (!hist.samples.some(s => s.pl[i])) delete hist.names[i];

// damage constant measured on this history (as the page does), else the reference
const asPage = (s) => ({ t: s.t, N: s.N, imp: s.imp, dss: s.dss, hod: s.hod, planets: Object.fromEntries(Object.entries(s.pl).map(([i, v]) => [i, { h: v[0], p: v[1] }])) });
const cal = E.calibrateK(hist.samples.map(asPage), planets, now, 0, 1);
const K = cal && cal.K > 0.005 && cal.K < 0.2 ? cal.K : 0.027;

// The Ministry's call on every order it watches: the forecast after the first 3 hours (the "day-one
// call"), after 24 hours, the worst it ever looked, and the last one. Kept for good: this is the
// record that says whether an order was winnable from the start.
{
  const N0 = war?.statistics?.playerCount || 0, imp0 = Number(war?.impactMultiplier) || 0;
  const C = imp0 && N0 ? K * imp0 * N0 * 3600 : E.DEFAULTS.capacity;
  const pageSamples = hist.samples.map(sm => ({ ...asPage(sm), prog: sm.prog || {} }));
  const RANKV = { done: 0, ontrack: 1, effort: 2, focus: 2, hard: 3, record: 3, nearly_impossible: 4, impossible: 5, failed: 6, unknown: -1 };
  hist.calls ||= {};
  for (const a of assignments || []) {
    const id = String(a.id), o = hist.orders[id]; if (!o) continue;
    let res;
    try { res = E.analyzeAssignment(a, { planets, N: N0, now, C, dssIdx: dss, hod: null, settings: { ...E.DEFAULTS }, samples: pageSamples, sectorOf: null, startMs: o.start, progKey: orderKey(a) }); } catch { continue; }
    const need = (() => { try { const n = E.orderNeeds(res); return n && !n.unknown && isFinite(n.total) ? +n.total.toFixed(3) : null; } catch { return null; } })();
    const early = res.tasks.some(r => r.early);
    const snap = { t: now, v: res.verdict, need, early, age: +((now - o.start) / H).toFixed(1) };
    const c = hist.calls[id] ||= { id, title: o.title, start: o.start, exp: o.exp, firstSeen: now, tasks: o.tasks };
    c.title = o.title; c.exp = o.exp; c.tasks = o.tasks;
    if (res.verdict !== 'unknown' && !early) {
      if (!c.first && snap.age >= 3) c.first = { ...snap, late: (c.firstSeen - o.start) / H > 6 };
      if (!c.d1 && snap.age >= 24) c.d1 = snap;
      if (!c.worst || (RANKV[snap.v] ?? 0) > (RANKV[c.worst.v] ?? 0)) c.worst = snap;
    }
    c.last = snap;
    c.prog = a.progress;
  }
  // an order that is gone: done if every objective reached its goal in the last progress seen
  for (const c of Object.values(hist.calls)) {
    if (c.result || (assignments || []).some(a => String(a.id) === c.id)) continue;
    if (c.exp && now < c.exp - 5 * 60e3 && now - (c.last?.t || 0) < 30 * 60e3) continue;
    const parsed = (c.tasks || []).map((tk, i) => E.parseTask(tk, (c.prog || [])[i]));
    const won = parsed.length && parsed.every(p => p.goal ? p.progress >= p.goal : p.progress >= 1);
    c.result = c.exp && (c.last?.t || 0) < c.exp - 30 * 60e3 && !won ? 'won?' : won ? 'won' : 'lost';
    if (c.result === 'won?') c.result = 'won';   // gone before the deadline: Super Earth closed it as done
  }
}

// HP of liberation one won mission is worth, per unit of impact multiplier: measured on stretches of
// this history where nothing else was going on (no event, no open region, not at full health)
const inf = (() => {
  const vals = [];
  for (let k = 1; k < hist.samples.length; k++) {
    const a = hist.samples[k - 1], b = hist.samples[k], dt = (b.t - a.t) / H;
    if (dt <= 0 || dt > 35 / 60 || !a.imp) continue;
    for (const [i, v] of Object.entries(a.pl)) {
      const w = b.pl[i];
      if (!w || v[8] == null || w[8] == null || v[4] || w[4] || v[5] || w[5] || v[6] !== w[6] || v[0] >= 0.99 * v[3] || w[0] <= 0) continue;
      const won = w[8] - v[8];
      if (won < 30) continue;
      vals.push((v[0] - w[0] + v[2] * 3600 * dt) / (won * a.imp));
    }
  }
  vals.sort((x, y) => x - y);
  return vals.length >= 10 ? vals[Math.floor(vals.length / 2)] : 100;
})();

// galactic war effects: what Super Earth Command (or the enemy) has switched on, planet by planet.
// Only the types that change the war or a mission are kept; map decorations are left out.
const KEEP = new Set([1, 74, 77, 90, 88, 47, 48, 49, 89, 92, 32, 72, 40, 21, 36]);
const status = await official('WarSeason/801/Status');
if (!hist.effDefs || now - hist.effDefs.t > 6 * H) {
  const defs = await official('WarSeason/GalacticWarEffects');
  if (Array.isArray(defs)) hist.effDefs = { t: now, map: Object.fromEntries(defs.map(d => [d.id, { type: d.effectType, v: (d.valueTypes || []).map((t, i) => [t, d.values[i]]) }])) };
}
let effects = hist.effects || [];
if (status && hist.effDefs) {
  const on = new Map();
  const put = (id, idx, ev) => {
    const d = hist.effDefs.map[id];
    if (!d || !KEEP.has(d.type)) return;
    const e = on.get(id) || { id, type: d.type, v: d.v, planets: [], events: [] };
    if (!e.planets.includes(idx)) e.planets.push(idx);
    if (ev && !e.events.includes(ev)) e.events.push(ev);
    on.set(id, e);
  };
  for (const x of status.planetActiveEffects || []) put(x.galacticEffectId, x.index, null);
  for (const g of status.globalEvents || []) for (const id of g.effectIds || []) {
    if ((g.planetIndices || []).length) for (const i of g.planetIndices) put(id, i, g.eventId); else put(id, -1, g.eventId);
  }
  const next = [...on.values()];
  if (hist.effects) {
    const was = new Map(hist.effects.map(e => [e.id, e]));
    for (const e of next) {
      const before = was.get(e.id);
      const added = e.planets.filter(i => !before || !before.planets.includes(i));
      if (added.length) (hist.effAlerts ||= []).push({ kind: 'effect', on: true, t: now, eid: e.id, type: e.type, v: e.v, planets: added });
    }
    for (const b of hist.effects) {
      const e = on.get(b.id);
      const gone = b.planets.filter(i => !e || !e.planets.includes(i));
      if (gone.length) (hist.effAlerts ||= []).push({ kind: 'effect', on: false, t: now, eid: b.id, type: b.type, v: b.v, planets: gone });
    }
  }
  hist.effects = effects = next;
}
hist.effAlerts = (hist.effAlerts || []).filter(a => now - a.t < 3 * 24 * H);

// Goals changed since launch: the game's own launch briefing (Episode / control centre) states the
// original numbers ("kill 300,000,000 Terminids..."); the order today may ask for different ones.
if (!hist.episode || now - hist.episode.t > H) {
  const ep = await official('Episode/801');
  if (ep && Array.isArray(ep.episodes)) hist.episode = { t: now, phases: ep.episodes.flatMap(e => e.phases || []).map(ph => ({ title: ph.introTitle || '', intro: ph.introMessage || '' })) };
}
const FAC = { terminid: 'Terminids', automaton: 'Automaton', illuminate: 'Illuminate' };
for (const a of assignments || []) {
  const ge = (status?.globalEvents || []).find(g => String(g.assignmentId32) === String(a.id) && g.title);
  const ph = ge && (hist.episode?.phases || []).find(x => x.title === ge.title);
  if (!ph) continue;
  const said = {};
  for (const m of ph.intro.replace(/<[^>]+>/g, '').matchAll(/(\d[\d,.]*)\s*(?:million\s+)?(Terminids?|Automatons?|Illuminates?)/gi)) {
    const f = FAC[m[2].toLowerCase().replace(/s$/, '')];
    if (f && !(f in said)) said[f] = Number(m[1].replace(/[,.]/g, ''));
  }
  const diff = [];
  (a.tasks || []).forEach((tk, i) => {
    const pt = E.parseTask(tk, 0);
    if (pt.type === 3 && pt.faction && said[pt.faction] && pt.goal && said[pt.faction] !== pt.goal) diff.push({ i: i + 1, kind: 'goal', from: said[pt.faction], to: pt.goal });
  });
  const sig = JSON.stringify(diff);
  if (diff.length && !hist.edits.some(e => e.ref === 'briefing' && e.order === String(a.id) && e.sig === sig))
    hist.edits.push({ kind: 'edited', ref: 'briefing', order: String(a.id), t: now, start: hist.orders[String(a.id)]?.start || null, diff, sig });
}

const found = E.scanHistory(hist.samples, { K, inf, hodMult: E.DEFAULTS.hodMult, factionOf: (i) => hist.factions?.[i] || null });
const alerts = [...found, ...hist.edits, ...hist.effAlerts].filter(a => a.ref === 'briefing' || now - a.t < 3 * 24 * H).map(a => ({ ...a, name: a.idx != null ? hist.names[a.idx] || null : null }));
hist.updated = now; hist.since = hist.samples[0]?.t ?? now; hist.K = K; hist.inf = inf;

// Every Major Order since launch, with its result, from the community war log kept by
// CrossWaveOmega (github.com/CrossWaveOmega/helldiversplanettable), refreshed twice a day.
if (!hist.arch || now - hist.arch.t > 12 * H || !hist.retro) {
  try {
    const r = await fetch('https://raw.githubusercontent.com/CrossWaveOmega/helldiversplanettable/master/src/data/historydata.json', { signal: AbortSignal.timeout(60000) });
    if (r.ok) {
      const j = await r.json(), mos = new Map();
      for (const e of j.events || []) {
        const t = Date.parse(String(e.time).slice(0, 16).replace(' ', 'T') + ':00Z');
        const disp = (e.log || []).find(l => l.type === 'Dispatch' && /major order/i.test(l.text || ''));
        for (const l of e.log || []) {
          const m = /^(Major Order Start|Major Order Won|Major Order Lost)$/.exec(l.type || ''); if (!m) continue;
          const tx = String(l.text || '').replace(/^Major Order \|\s*/, '');
          const code = (tx.match(/A\d+-\d+-\d+/) || [null])[0];
          const name = tx.replace(/A\d+-\d+-\d+\s*/, '').replace(/\s*is\s*(issued|won|failed).*$/i, '').replace(/^[-\s]+/, '').trim();
          const obj = ((tx.match(/Objective:\s*(.*)$/i) || [])[1] || '').trim();
          const key = code || name;
          const x = mos.get(key) || { code, name, obj };
          if (m[1] === 'Major Order Start') { x.start = t; x.name = name || x.name; x.obj = obj || x.obj; if (disp && disp.planet) x.planets = disp.planet.map(p => p[1]).filter(i => i !== 0); }
          else { x.end = t; x.result = m[1] === 'Major Order Won' ? 'won' : 'lost'; x.name = x.name || name; x.obj = x.obj || obj; }
          mos.set(key, x);
        }
      }
      // rebuild the day-one call of past liberation orders from the same log (planet states at launch)
      try {
        const rr = await fetch('https://raw.githubusercontent.com/CrossWaveOmega/helldiversplanettable/master/src/data/resort.json', { signal: AbortSignal.timeout(120000) });
        if (rr.ok) hist.retro = buildRetro(j, await rr.json(), E).map(x => ({ code: x.code, start: x.start, result: x.result, v: x.v, need: x.need, hours: x.hours, anyOf: x.anyOf, players: x.players, C: x.C, targets: x.targets }));
      } catch (e) { console.log('::warning::retro failed: ' + String(e).slice(0, 200)); }
      hist.arch = { t: now, upTo: (j.events || []).length ? Date.parse(String(j.events[j.events.length - 1].time).slice(0, 16).replace(' ', 'T') + ':00Z') : null, orders: [...mos.values()].filter(x => x.start || x.end) };
    }
  } catch (e) { console.log('::warning::war log not reachable: ' + String(e).slice(0, 200)); }
}
const archive = { v: 1, updated: now, source: 'CrossWaveOmega/helldiversplanettable', upTo: hist.arch?.upTo || null,
  orders: (hist.arch?.orders || []).map(x => ({ ...x })), watched: Object.values(hist.calls || {}) };
// rebuilt calls join their order (only lost ones are judged: a won order was winnable by definition)
for (const r of hist.retro || []) {
  if (r.result !== 'lost') continue;
  const m = archive.orders.find(x => (r.code && x.code === r.code) || (x.start && Math.abs(x.start - r.start) < 60e3));
  if (m) m.retro = r;
}
// our own call joins the community log entry that started within 3 hours of it
for (const c of archive.watched) {
  const m = archive.orders.find(x => x.start && Math.abs(x.start - c.start) < 3 * H);
  if (m) { m.call = c.first || c.d1 || null; m.worst = c.worst || null; m.watchedId = c.id; if (!m.result && c.result) m.result = c.result; if (!m.end && c.result) m.end = c.exp; }
  else archive.orders.push({ code: null, name: c.title, obj: '', start: c.start, end: c.result ? c.exp : null, result: c.result || null, call: c.first || c.d1 || null, worst: c.worst || null, watchedId: c.id, ours: true });
}
// orders this recorder saw that the community log doesn't have yet (it can lag by days)
for (const [id, o] of Object.entries(hist.orders)) {
  if (archive.orders.some(x => x.watchedId === id || (x.start && o.start && Math.abs(x.start - o.start) < 3 * H))) continue;
  const lastProg = [...hist.samples].reverse().find(sm => sm.prog && Object.keys(sm.prog).some(k => k.startsWith(id + ':')));
  const prog = lastProg ? lastProg.prog[Object.keys(lastProg.prog).find(k => k.startsWith(id + ':'))] : null;
  const live = (assignments || []).some(a => String(a.id) === id);
  let result = null;
  if (!live && prog) { const ps = (o.tasks || []).map((tk, i) => E.parseTask(tk, prog[i])); result = ps.length && ps.every(p => p.goal ? p.progress >= p.goal : p.progress >= 1) ? 'won' : (o.exp && now >= o.exp - 30 * 60e3 ? 'lost' : 'won'); }
  archive.orders.push({ code: null, name: o.title, obj: '', start: o.start, end: live ? null : o.exp, result, watchedId: id, ours: true });
}
archive.orders.sort((a, b) => (b.start || b.end || 0) - (a.start || a.end || 0));

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'history.json'), JSON.stringify(hist));
// the page's plan B: the war as this snapshot saw it, in the community API's shapes
const inCamp = new Set((campaigns || []).map(c => c && c.planet && c.planet.index));
fs.writeFileSync(path.join(outDir, 'live.json'), JSON.stringify({ v: 1, t: now, src, war, assignments, campaigns, stations: src === 'community' ? stations : [], raw,
  extra: Object.values(planets).filter(p => !inCamp.has(p.index)) }));
fs.writeFileSync(path.join(outDir, 'intel.json'), JSON.stringify({ v: 2, updated: now, since: hist.since, every: 10, K, inf, official: !!status, alerts, effects, orders: hist.orders, so: hist.so }));
// progress history for the page's charts: every running order since recording began (one point per
// 20 minutes), and the liberation of the planets the orders name
const thin = (pts, gap = 20 * 60e3) => { const out = []; for (const x of pts) if (!out.length || x[0] - out[out.length - 1][0] >= gap) out.push(x); if (pts.length && out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]); return out; };
const progress = { v: 1, updated: now, since: hist.since, orders: {}, planets: {} };
for (const [id, o] of Object.entries(hist.orders)) {
  const pts = hist.samples.filter(sm => sm.prog && Object.keys(sm.prog).some(k => k.startsWith(id + ':')))
    .map(sm => [sm.t, ...(sm.prog[Object.keys(sm.prog).find(k => k.startsWith(id + ':'))] || [])]);
  progress.orders[id] = { start: o.start, exp: o.exp, title: o.title, pts: thin(pts) };
}
for (const i of named) {
  const pts = hist.samples.filter(sm => sm.pl[i]).map(sm => { const v = sm.pl[i]; return [sm.t, v[3] ? +(1 - v[0] / v[3]).toFixed(5) : 0, v[4] ? 1 : 0, v[1]]; });
  if (pts.length) progress.planets[i] = thin(pts);
}
fs.writeFileSync(path.join(outDir, 'progress.json'), JSON.stringify(progress));
fs.writeFileSync(path.join(outDir, 'archive.json'), JSON.stringify(archive));
const progDay = thin(hist.samples.filter(s => now - s.t < 26 * H && s.prog).map(s => [s.t, s.prog])).map(([t, prog]) => ({ t, prog }));
fs.writeFileSync(path.join(outDir, 'recent.json'), JSON.stringify({ v: 2, updated: now, samples: hist.samples.filter(s => now - s.t < 6 * H), prog: progDay }));
console.log(`snapshot ${new Date(now).toISOString()}: ${Object.keys(sample.pl).length} planets, ${hist.samples.length} samples since ${new Date(hist.since).toISOString()}, K ${K.toFixed(4)}, ${inf.toFixed(0)} HP per won mission per unit of impact, ${effects.length} active effects${status ? '' : ' (official API unreachable)'}, source ${src}, ${alerts.length} alerts`);
