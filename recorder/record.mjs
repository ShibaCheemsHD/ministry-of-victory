// Ministry of Victory - war recorder.
// Runs every ~10 minutes on GitHub Actions: takes one snapshot of the war, keeps the history since the
// start of the running Major Orders, and looks through it for things the players can't explain
// (hand-made jumps and setbacks, resistance changes, new attacks, edited objectives).
//   node record.mjs <history.json> <out dir>
// Writes history.json (everything), intel.json (alerts, small) and recent.json (last 6 hours, for the page).
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
async function get(p) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = lastReq + 2300 - Date.now();
    if (wait > 0) await sleep(wait);
    lastReq = Date.now();
    const url = `${API}${p}${p.includes('?') ? '&' : '?'}culture=en-US`;
    try {
      const r = await fetch(url, { headers: { 'Accept-Language': 'en-US', 'X-Super-Client': CLIENT, 'X-Super-Contact': CONTACT } });
      if (r.status === 429 || r.status >= 500) { await sleep(11000); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status} ${p}`);
      return await r.json();
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(5000);
    }
  }
  throw new Error('gave up on ' + p);
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

// one snapshot: per planet [enemy HP, players, regen HP/s, max HP, event id, open regions, owner, event end]
const N = war?.statistics?.playerCount || 0;
const imp = Number(war?.impactMultiplier) || null;
const sample = { t: now, N, imp, dss, hod, pl: {}, prog: {} };
for (const [i, p] of Object.entries(planets)) {
  const ev = p.event;
  sample.pl[i] = [ev ? ev.health : p.health, p.statistics?.playerCount || 0, ev ? 0 : (p.regenPerSecond || 0), ev ? ev.maxHealth : p.maxHealth,
    ev ? (ev.id ?? 1) : 0, (p.regions || []).filter(r => r && r.isAvailable && (r.health || 0) > 0).length, p.currentOwner, ev ? (Date.parse(ev.endTime) || 0) : 0];
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
  if (hist.orders[id] && hist.orders[id].key !== key) hist.edits.push({ kind: 'edited', order: id, t: now });
  hist.orders[id] = { key, start, title: txt(a.title), exp: Date.parse(a.expiration) || null, seen: now };
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

const found = E.scanHistory(hist.samples, { K, hodMult: E.DEFAULTS.hodMult, factionOf: (i) => hist.factions?.[i] || null });
const alerts = [...found, ...hist.edits].filter(a => now - a.t < 3 * 24 * H).map(a => ({ ...a, name: a.idx != null ? hist.names[a.idx] || null : null }));
hist.updated = now; hist.since = hist.samples[0]?.t ?? now; hist.K = K;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'history.json'), JSON.stringify(hist));
fs.writeFileSync(path.join(outDir, 'intel.json'), JSON.stringify({ v: 1, updated: now, since: hist.since, every: 10, K, alerts, orders: hist.orders }));
fs.writeFileSync(path.join(outDir, 'recent.json'), JSON.stringify({ v: 1, updated: now, samples: hist.samples.filter(s => now - s.t < 6 * H) }));
console.log(`snapshot ${new Date(now).toISOString()}: ${Object.keys(sample.pl).length} planets, ${hist.samples.length} samples since ${new Date(hist.since).toISOString()}, K ${K.toFixed(4)}, ${alerts.length} alerts`);
