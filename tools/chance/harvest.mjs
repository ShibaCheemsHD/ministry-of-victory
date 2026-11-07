// Keeps our own war log for the retraining: one reading an hour of every planet the enemy holds, taken from
// the recorder's history (data branch, which keeps only the last days) and added to learn/warlog/YYYY-MM.json.
// The community war log (CrossWaveOmega) is the main source but lags by days and could stop; this fills the gap.
// Usage: node harvest.mjs HISTORY_JSON LEARN_DIR
// A reading: { t, N, dss, pl: { planet: [enemy HP, players, regen HP/s, max HP, owner, open enemy regions] } }
// with owner 1 Humans, 2 Terminids, 3 Automaton, 4 Illuminate. A planet is kept while the enemy holds it, and
// once more in the reading after it changes hands (that reading is how a fall is seen).
import fs from 'node:fs';
import path from 'node:path';
const [HIST, LEARN] = process.argv.slice(2);
const OWN = { Humans: 1, Terminids: 2, Automaton: 3, Illuminate: 4 };
const H = 3.6e6;
const dir = path.join(LEARN, 'warlog');
fs.mkdirSync(dir, { recursive: true });
const month = (t) => new Date(t).toISOString().slice(0, 7);
const files = new Map();
const load = (m) => {
  if (!files.has(m)) { const f = path.join(dir, m + '.json'); files.set(m, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []); }
  return files.get(m);
};
// the last reading already kept, to continue from it
const known = fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}\.json$/.test(f)).sort();
let prev = null;
if (known.length) { const l = load(known.at(-1).slice(0, 7)); prev = l.at(-1) || null; }
const have = new Set();
for (const m of known) for (const r of load(m.slice(0, 7))) have.add(Math.floor(r.t / H));

const hist = JSON.parse(fs.readFileSync(HIST, 'utf8'));
let added = 0;
const all = (hist.samples || []).slice().sort((a, b) => a.t - b.t);
// the API leaves the DSS out now and then: the hour's position is its last one seen in that hour
const dssOf = new Map();
for (const s of all) if (s.dss != null) dssOf.set(Math.floor(s.t / H), s.dss);
for (const s of all) {
  const hour = Math.floor(s.t / H);
  if (have.has(hour) || !s.pl || !s.N) continue;   // the first sample of each hour
  const pl = {};
  for (const [i, v] of Object.entries(s.pl)) {
    if (!Array.isArray(v)) continue;
    const owner = OWN[v[6]] || 0;
    const enemy = owner > 1;
    if (!enemy && !(prev && prev.pl[i] && prev.pl[i][4] > 1)) continue;
    const regs = Array.isArray(v[9]) ? v[9].filter(g => Array.isArray(g) && g[1] > 0).length : 0;
    pl[i] = [Math.round(v[0] || 0), v[1] || 0, +(+v[2] || 0).toPrecision(6), v[3] || 0, owner, regs];
  }
  const r = { t: s.t, N: s.N, dss: dssOf.get(hour) ?? null, pl };
  load(month(s.t)).push(r); have.add(hour); prev = r; added++;
}
for (const [m, l] of files) {
  if (!l.length) continue;
  l.sort((a, b) => a.t - b.t);
  fs.writeFileSync(path.join(dir, m + '.json'), JSON.stringify(l));
}
console.log('warlog: +' + added + ' hourly readings, ' + have.size + ' in all');
