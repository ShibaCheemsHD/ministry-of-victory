// The live war on every planet, for the page's Fronts map (galaxy.json on the data branch). The map's fixed
// shapes ship with the page (src/game/galaxy.json); this file says who holds each world now, how far each
// fight is, which worlds take drops, the attacks under way and where they come from, the pace of each fight
// over the last hours, and the DSS: where it is, the road it took, its actions.
const LETTER = { Humans: 'H', Terminids: 'T', Automaton: 'A', Illuminate: 'I' };
const H = 3600e3;
export function galaxyFile({ all, campaigns, stations, hist, now }) {
  const list = Array.isArray(all) ? all : all && typeof all === 'object' ? Object.values(all) : [];
  if (!list.length) return null;
  const acc = new Set((campaigns || []).map(c => c && c.planet && c.planet.index).filter(i => i != null));
  const from = {};
  for (const p of list) for (const j of p.attacking || []) (from[j] ||= []).push(p.index);
  const pl = {}, ev = {}, frac = {};
  for (const p of list) {
    if (!p || p.index == null) continue;
    const e = p.event, o = LETTER[p.currentOwner] || '?';
    const f = e && e.maxHealth ? 1 - e.health / e.maxHealth : p.currentOwner !== 'Humans' && p.maxHealth ? 1 - p.health / p.maxHealth : null;
    const regen = !e && p.currentOwner !== 'Humans' && p.maxHealth ? +(p.regenPerSecond * 3600 / p.maxHealth * 100).toFixed(2) : null;
    pl[p.index] = [o, f == null ? null : +f.toFixed(4), p.statistics?.playerCount || 0, regen, acc.has(p.index) ? 1 : 0, null];
    if (acc.has(p.index) && f != null) frac[p.index] = f;
    if (e) {
      const att = (from[p.index] || []).find(j => list.find(q => q.index === j)?.currentOwner === e.faction) ?? (from[p.index] || [])[0] ?? null;
      ev[p.index] = [LETTER[e.faction] || '?', Date.parse(e.endTime) || null, att];
    }
  }
  // each fight's pace: the change since about three hours ago, in % of the planet an hour
  hist.galPace = (Array.isArray(hist.galPace) ? hist.galPace : []).filter(x => x && now - x.t < 4.5 * H);
  hist.galPace.push({ t: now, f: Object.fromEntries(Object.entries(frac).map(([i, v]) => [i, +v.toFixed(5)])) });
  const old = hist.galPace.filter(x => now - x.t >= 1.5 * H).sort((a, b) => Math.abs(now - a.t - 3 * H) - Math.abs(now - b.t - 3 * H))[0];
  if (old) for (const [i, v] of Object.entries(frac)) if (old.f[i] != null && pl[i]) pl[i][5] = +((v - old.f[i]) / ((now - old.t) / H) * 100).toFixed(3);
  // the DSS: its planet, the vote for its next jump, its road over the last week, its tactical actions
  const st = (stations || [])[0];
  let dss = null;
  if (st && st.planet) {
    const route = [];
    for (const s of hist.samples || []) if (s && s.dss != null && now - s.t < 7 * 24 * H && (!route.length || route[route.length - 1][0] !== s.dss)) route.push([s.dss, s.t]);
    const clean = (x) => String(x || '').replace(/<[^>]*>/g, '').replace(/>/g, '').trim();
    dss = { at: st.planet.index, vote: Date.parse(st.electionEnd) || null, route: route.slice(-6),
      acts: (st.tacticalActions || []).map(a => [String(a.name || ''), clean(a.strategicDescription), a.status ?? null, Date.parse(a.statusExpire) || null]) };
  }
  return { v: 1, t: now, pl, ev, dss };
}
