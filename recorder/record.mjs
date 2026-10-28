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
async function get(p) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = lastReq + 2300 - Date.now();
    if (wait > 0) await sleep(wait);
    lastReq = Date.now();
    const url = `${API}${p}${p.includes('?') ? '&' : '?'}culture=en-US`;
    try {
      const r = await fetch(url, { headers: { 'Accept-Language': 'en-US', 'X-Super-Client': CLIENT, 'X-Super-Contact': CONTACT } });
      if (r.status === 429 || r.status >= 500) { seen.push(r.status + ' ' + (r.headers.get('server') || '') + ' ' + (await r.text()).slice(0, 120).replace(/\s+/g, ' ')); await sleep(11000); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status} ${p}`);
      return await r.json();
    } catch (e) {
      seen.push(String(e && e.cause ? e.message + ' / ' + e.cause : e));
      if (attempt === 4) throw new Error(p + ': ' + seen.join(' | '));
      await sleep(5000);
    }
  }
  throw new Error('gave up on ' + p + ': ' + seen.join(' | '));
}

// the game's own API (no browser access, so only the recorder can read it): galactic war effects
const OFFICIAL = 'https://api.live.prod.thehelldiversgame.com/api/';
async function official(p) {
  if (process.env.OFFICIAL_DIR) {   // tests: saved copies of the endpoints
    const f = { 'WarSeason/801/Status': 'status.json', 'WarSeason/GalacticWarEffects': 'effects.json' }[p];
    try { return JSON.parse(fs.readFileSync(path.join(process.env.OFFICIAL_DIR, f), 'utf8')); } catch { return null; }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = lastReq + 1500 - Date.now();
    if (wait > 0) await sleep(wait);
    lastReq = Date.now();
    try {
      const r = await fetch(OFFICIAL + p, { headers: { 'Accept-Language': 'en-US', 'X-Super-Client': CLIENT, 'X-Super-Contact': CONTACT } });
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

const war = await get('/api/v1/war');
const assignments = await get('/api/v1/assignments');
const campaigns = await get('/api/v1/campaigns');
const stations = await get('/api/v2/space-stations').catch(() => []);
const raw = await get('/raw/api/v2/Assignment/War/801').catch(() => []);
const now = Date.now();

const planets = {};
for (const c of campaigns || []) if (c && c.planet) planets[c.planet.index] = c.planet;
const named = new Set();
for (const a of assignments || []) for (const tk of a.tasks || []) {
  const t = E.parseTask(tk, 0);
  if (t.planetIndex != null) named.add(t.planetIndex);
}
for (const i of [...named].filter(i => !planets[i]).slice(0, 10)) {
  const p = await get('/api/v1/planets/' + i).catch(() => null);
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
hist.edits = hist.edits.filter(e => now - e.t < 3 * 24 * H);

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

const found = E.scanHistory(hist.samples, { K, inf, hodMult: E.DEFAULTS.hodMult, factionOf: (i) => hist.factions?.[i] || null });
const alerts = [...found, ...hist.edits, ...hist.effAlerts].filter(a => now - a.t < 3 * 24 * H).map(a => ({ ...a, name: a.idx != null ? hist.names[a.idx] || null : null }));
hist.updated = now; hist.since = hist.samples[0]?.t ?? now; hist.K = K; hist.inf = inf;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'history.json'), JSON.stringify(hist));
fs.writeFileSync(path.join(outDir, 'intel.json'), JSON.stringify({ v: 2, updated: now, since: hist.since, every: 10, K, inf, official: !!status, alerts, effects, orders: hist.orders }));
fs.writeFileSync(path.join(outDir, 'recent.json'), JSON.stringify({ v: 1, updated: now, samples: hist.samples.filter(s => now - s.t < 6 * H) }));
console.log(`snapshot ${new Date(now).toISOString()}: ${Object.keys(sample.pl).length} planets, ${hist.samples.length} samples since ${new Date(hist.since).toISOString()}, K ${K.toFixed(4)}, ${inf.toFixed(0)} HP per won mission per unit of impact, ${effects.length} active effects${status ? '' : ' (official API unreachable)'}, ${alerts.length} alerts`);
