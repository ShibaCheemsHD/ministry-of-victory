// Builds the community API's v1 shapes (war, assignments, campaigns, planets) from the game's own API,
// following the community API's mappers (github.com/helldivers-2/api, src/Helldivers-2-Core/Mapping/V1),
// so the recorder and the page keep working when api.helldivers2.dev is down.
// Names, biomes and hazards come from github.com/helldivers-2/json, as the community API does.
const FAC = { 1: 'Humans', 2: 'Terminids', 3: 'Automaton', 4: 'Illuminate' };
const STATIC = 'https://raw.githubusercontent.com/helldivers-2/json/master/planets/';

// planets / biomes / hazards / region names, trimmed to what the page uses
export async function loadStatic(fetchJson) {
  const [planets, biomes, env, regions] = await Promise.all(['planets.json', 'biomes.json', 'environmentals.json', 'planetRegion.json'].map(f => fetchJson(STATIC + f)));
  if (!planets || !biomes || !env) return null;
  return {
    planets: Object.fromEntries(Object.entries(planets).map(([i, p]) => [i, { name: p.name, sector: p.sector, biome: p.biome, env: p.environmentals || [] }])),
    biomes, env,
    regions: Object.fromEntries(Object.entries(regions || {}).map(([h, r]) => [h, { name: r.name || null, description: r.description || null }])),
  };
}

const iso = (ms) => new Date(ms).toISOString();

export function mapOfficial({ info, status, summary, assignments, S }, now) {
  if (!info || !status || !Array.isArray(info.planetInfos) || !Array.isArray(status.planetStatus) || !S) return null;
  const rel = now - status.time * 1000;   // the game clock's start, on the real clock
  const st = new Map(status.planetStatus.map(p => [p.index, p]));
  const stats = new Map(((summary && summary.planets_stats) || []).map(p => [p.planetIndex, p]));
  const events = new Map((status.planetEvents || []).map(e => [e.planetIndex, e]));
  const attacks = {};
  for (const a of status.planetAttacks || []) (attacks[a.source] ||= []).push(a.target);
  const regStatus = status.planetRegions || [];
  const planets = {};
  for (const pi of info.planetInfos) {
    const s = st.get(pi.index), m = S.planets[pi.index];
    if (!s || !m || !m.name || !m.sector) continue;
    const e = events.get(pi.index), ps = stats.get(pi.index);
    const regions = (info.planetRegions || []).filter(r => r.planetIndex === pi.index).map(r => {
      const rs = regStatus.find(x => x.planetIndex === pi.index && x.regionIndex === r.regionIndex);
      const rn = S.regions[String(r.settingsHash)];
      return { id: r.regionIndex, hash: r.settingsHash, name: rn ? rn.name : null, description: rn ? rn.description : null,
        health: rs ? rs.health : null, maxHealth: r.maxHealth, size: r.regionSize, regenPerSecond: rs ? rs.regerPerSecond : null,
        availabilityFactor: rs ? rs.availabilityFactor : null, isAvailable: rs ? !!rs.isAvailable : false, players: rs ? rs.players : 0 };
    });
    planets[pi.index] = {
      index: pi.index, name: m.name, sector: m.sector,
      biome: S.biomes[m.biome] || { name: 'Unknown', description: '' },
      hazards: m.env.map(k => S.env[k] || { name: 'Unknown', description: '' }),
      hash: pi.settingsHash, position: pi.position, waypoints: pi.waypoints, maxHealth: pi.maxHealth, health: s.health,
      disabled: pi.disabled, initialOwner: FAC[pi.initialOwner] || '', currentOwner: FAC[s.owner] || '', regenPerSecond: s.regenPerSecond,
      event: e ? { id: e.id, eventType: e.eventType, faction: FAC[e.race] || '', health: e.health, maxHealth: e.maxHealth,
        startTime: iso(rel + e.startTime * 1000), endTime: iso(rel + e.expireTime * 1000), campaignId: e.campaignId, jointOperationIds: e.jointOperationIds || [] } : null,
      statistics: { missionsWon: ps ? ps.missionsWon : 0, missionsLost: ps ? ps.missionsLost : 0, playerCount: s.players },
      attacking: attacks[pi.index] || [], regions,
    };
  }
  const N = Object.values(planets).reduce((n, p) => n + (p.statistics.playerCount || 0), 0);
  const g = (summary && summary.galaxy_stats) || {};
  const war = { started: iso(info.startDate * 1000), ended: iso(info.endDate * 1000), now: iso(status.time * 1000), clientVersion: info.minimumClientVersion,
    impactMultiplier: status.impactMultiplier, statistics: { missionsWon: g.missionsWon || 0, missionsLost: g.missionsLost || 0, playerCount: N } };
  const rw = (r) => r ? { type: r.type, amount: r.amount } : null;
  const asg = (assignments || []).filter(a => a && a.setting).map(a => ({
    id: a.id32, progress: a.progress, title: a.setting.overrideTitle, briefing: a.setting.overrideBrief, description: a.setting.taskDescription,
    tasks: (a.setting.tasks || []).map(tk => ({ type: tk.type, values: tk.values, valueTypes: tk.valueTypes })),
    reward: rw(a.setting.reward), rewards: (a.setting.rewards || []).filter(Boolean).map(rw), expiration: iso(now + a.expiresIn * 1000), flags: a.setting.flags,
  }));
  const campaigns = (status.campaigns || []).filter(c => planets[c.planetIndex]).map(c => ({ id: c.id, planet: planets[c.planetIndex], type: c.type, count: c.count, faction: FAC[c.race] || '' }));
  return { war, assignments: asg, campaigns, planets };
}
