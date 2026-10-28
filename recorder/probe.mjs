// One-off: saves every official game API endpoint we know of, to study what it tells for certain.
import fs from 'fs';
const B = 'https://api.live.prod.thehelldiversgame.com/api/';
const H = { 'Accept-Language': 'en-US', 'X-Super-Client': 'ministry-of-victory-probe', 'X-Super-Contact': 'https://github.com/ShibaCheemsHD/ministry-of-victory' };
const out = process.argv[2] || 'probe'; fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function save(name, p) {
  try {
    const r = await fetch(B + p, { headers: H });
    const t = await r.text();
    fs.writeFileSync(`${out}/${name}.json`, t);
    console.log(name, r.status, t.length);
    return r.ok ? JSON.parse(t) : null;
  } catch (e) { console.log(name, 'ERR', e.message); return null; }
  finally { await sleep(1500); }
}
const id = (await save('warid', 'WarSeason/current/WarID'))?.id || 801;
const status = await save('status', `WarSeason/${id}/Status`);
await save('warinfo', `WarSeason/${id}/WarInfo`);
await save('effects', 'WarSeason/GalacticWarEffects');
await save('assignments', `v2/Assignment/War/${id}`);
await save('news', `NewsFeed/${id}?maxEntries=60`);
await save('summary', `Stats/War/${id}/Summary`);
await save('episode', `Episode/${id}`);
for (const s of status?.spaceStations || []) await save('station_' + s.id32, `v2/SpaceStation/War/${id}/${s.id32}`);
await save('rewards', 'Mission/RewardEntries');
