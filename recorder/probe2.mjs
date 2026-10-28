// One-off: two snapshots of the fronts a few minutes apart, to relate missions won to liberation.
import fs from 'fs';
const out = process.argv[2] || 'probe'; fs.mkdirSync(out, { recursive: true });
const U = 'https://api.helldivers2.dev/api/v1/';
const H = { 'Accept-Language': 'en-US', 'X-Super-Client': 'ministry-of-victory-probe', 'X-Super-Contact': 'https://github.com/ShibaCheemsHD/ministry-of-victory' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function get(p) { for (let i = 0; i < 6; i++) { const r = await fetch(U + p, { headers: H }); if (r.ok) return r.json(); await sleep(11000); } throw new Error(p); }
const snaps = [];
for (let k = 0; k < 4; k++) {
  const [war, camp] = [await get('war'), (await sleep(2500), await get('campaigns'))];
  snaps.push({ t: Date.now(), N: war.statistics.playerCount, imp: war.impactMultiplier, planets: camp.map(c => ({ i: c.planet.index, name: c.planet.name, h: c.planet.event ? c.planet.event.health : c.planet.health, m: c.planet.event ? c.planet.event.maxHealth : c.planet.maxHealth, r: c.planet.regenPerSecond, ev: c.planet.event ? 1 : 0, owner: c.planet.currentOwner, regs: (c.planet.regions || []).filter(x => x.isAvailable && x.health > 0).length, won: c.planet.statistics.missionsWon, lost: c.planet.statistics.missionsLost, p: c.planet.statistics.playerCount })) });
  console.log('snap', k, snaps[k].planets.length);
  if (k < 3) await sleep(100000);
}
fs.writeFileSync(out + '/snaps.json', JSON.stringify(snaps));
