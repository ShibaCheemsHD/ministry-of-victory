  /* ---------- the Fronts tab: the whole galaxy as a war table ---------- */
  // Every world at its place (the fixed shapes ship with the page: src/game/galaxy.json, made by
  // tools/galaxy_geo.py), who holds it now (the recorder's galaxy.json, the page's own campaigns on top), seen
  // from above, at the war table's angle or from low orbit. Each fight stands up as a beam as tall as its
  // Helldivers; the order's worlds are in the yellow sights, with the route to a target behind enemy lines;
  // attacks are striped in the attacker's colour, with their countdown; the DSS and the road it took.
  // Drag to move (it glides), scroll or pinch to zoom (eased), point at a world for its card, click for all of it.
  // The map is one element kept across renders: the page rebuilds its view every refresh, the map is put back
  // in its slot with its camera, filters and open card as they were (8 Nov 2026).
  const FRONTS = (() => {
    const GAL = GAME.gal;
    if (!GAL || !Array.isArray(GAL.p) || GAL.p.length < 50) return null;
    const L = t('fr');
    const COL = { Terminids: '#fa9f05', Automaton: '#fe3441', Illuminate: '#b48eff', Humans: '#00b0ff' };
    const FN = L.fac;
    const OWN = { H: 'Humans', T: 'Terminids', A: 'Automaton', I: 'Illuminate' };
    const ENEMIES = ['Terminids', 'Automaton', 'Illuminate'];
    const IC = (f) => GAME.icons?.['faction-' + f]?.src || '';
    const SE_Y = '#fee700', DSS_C = '#a2ebff', GAIN_C = '#3fc483';
    const motion = () => !reduced();
    const ENV = Object.fromEntries(Object.values(GAME.env || {}).filter(x => x && x.n).map(x => [x.n, x.d || '']));
    const BIOD = Object.fromEntries(Object.values(GAME.bio || {}).filter(x => x && x.n).map(x => [x.n, String(x.d || '').replace(/\s*\(UNOFFICIAL\)/i, '')]));
    const STAT = GAL.p.map(([i, n, x, y, s, b, hz, w, blob]) => ({ i, n, x, y, s, b, hzN: hz || [], w: w || [], blob }));
    const SEC = GAL.s || {};
    const ADJ = new Map(STAT.map(p => [p.i, new Set()]));
    STAT.forEach(p => p.w.forEach(j => { if (ADJ.has(j)) { ADJ.get(p.i).add(j); ADJ.get(j).add(p.i); } }));
    const secName = (s) => s === 'Sol' ? L.sol : s;
    const left = (end) => hmLeft(Math.max(0, (end - Date.now()) / 3.6e6));
    const when = (ms) => new Date(ms).toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' });

    /* ---------- the live war on the map ---------- */
    let live = null, liveAt = 0, liveBusy = false;
    function load(force) {
      if (liveBusy || (!force && Date.now() - liveAt < 5 * 60e3)) return;
      liveBusy = true; liveAt = Date.now();
      ghFetch(RECORD + 'galaxy.json?t=' + Math.floor(Date.now() / 300e3), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)
        .then(j => {
          liveBusy = false;
          if (!j || j.v !== 1 || !j.pl || typeof j.pl !== 'object' || Date.now() - j.t > 24 * 3600e3) return;
          const was = !!live; live = j; stamp = null;
          if (!was && last && document.querySelector('#view .map-tab')) { if (dragging) pendingRender = true; else render(); } else if (root && root.isConnected) update();
        });
    }
    const ready = () => !!live;

    // the planets: the fixed map, the recorder's state, then the page's own campaigns (fresher) on top
    let P = [], byI = new Map(), war = [], top = [], F = [], N = 1, PICK = null, MO = new Set(), MOT = '', MOW = new Map(), ROUTES = [], STEP = new Map(), DSS = null, stamp = null, curRes = null;
    function fxOf() {
      const out = new Map();
      for (const x of (record && record.effects) || []) {
        if (!x || !Array.isArray(x.planets)) continue;
        const id = x.eid ?? x.id, seaf = isSeafEffect({ type: x.type, eid: id });
        const pctv = valOf(x.v, 2);
        const kind = seaf || x.type === 32 || (x.type === 1 && pctv > 0) ? 'good' : x.type === 40 || (x.type === 72 && pctv > 100) || x.type === 49 ? 'foe' : 'mod';
        const name = plain(effectLabel(x.type, x.v, id)), desc = plain(effectExplanation({ ...x, kind: 'active' })) || plain(clean(GAME.fx?.[String(id)]?.d || ''));
        const f = { id: Number(id), type: x.type, v: x.v, n: name.charAt(0).toUpperCase() + name.slice(1), d: desc, k: kind };
        for (const i of x.planets) (out.get(i) || out.set(i, []).get(i)).push(f);
      }
      return out;
    }
    function model(res) {
      const lp = (last && last.planets) || {}, camp = last && last.camp, FX = fxOf(), lv = live || { pl: {}, ev: {} };
      P = STAT.map(s => {
        const a = lp[s.i], Lp = lv.pl[s.i], e = lv.ev && lv.ev[s.i];
        const p = { ...s, o: 'Humans', pl: 0, lib: null, def: false, acc: false, rg: null, gr: Lp ? Lp[5] : null, ev: null, st: null, reg: [],
          hz: s.hzN.map(n => [n, ENV[n] || '']), bd: BIOD[s.b] || '', fx: FX.get(s.i) || [] };
        if (Lp) { p.o = OWN[Lp[0]] || 'Humans'; p.lib = Lp[1]; p.pl = Lp[2] || 0; p.rg = Lp[3]; p.acc = !!Lp[4]; }
        if (e) { p.def = true; p.ev = { f: OWN[e[0]] || 'Automaton', end: e[1], from: e[2] }; }
        if (a) {
          const ev = a.event;
          p.o = a.currentOwner || p.o;
          p.pl = a.statistics?.playerCount ?? p.pl;
          if (camp) p.acc = camp.has(s.i);
          if (ev) {
            p.def = true;
            p.ev = { f: ev.faction || p.ev?.f || 'Automaton', end: Date.parse(ev.endTime) || p.ev?.end || null, from: p.ev?.from ?? null };
            p.lib = ev.maxHealth ? 1 - ev.health / ev.maxHealth : p.lib;
          } else {
            p.def = false; p.ev = null;
            p.lib = p.o !== 'Humans' && a.maxHealth ? 1 - a.health / a.maxHealth : null;
          }
          p.rg = !ev && p.o !== 'Humans' && a.maxHealth ? +(a.regenPerSecond * 3600 / a.maxHealth * 100).toFixed(2) : null;
          p.rps = !ev && p.o !== 'Humans' ? a.regenPerSecond : null;
          // no pace from the recorder yet: the page's own samples of this campaign, over the last 3 hours
          if (p.gr == null) { try { const se = planetSeries(s.i).filter(x => x[0] >= (last.now || Date.now()) - 3.3 * 3600e3); if (se.length > 2 && se[se.length - 1][0] - se[0][0] > 1.5 * 3600e3) p.gr = +((se[se.length - 1][1] - se[0][1]) / ((se[se.length - 1][0] - se[0][0]) / 3.6e6) * 100).toFixed(2); } catch { p.gr = null; } }
          if (Array.isArray(a.hazards)) p.hz = a.hazards.filter(h => h && h.name && h.name !== 'None').map(h => [h.name, h.description || ENV[h.name] || '']);
          if (a.biome && a.biome.description) p.bd = String(a.biome.description).replace(/\s*\(UNOFFICIAL\)/i, '');
          const st = a.statistics;
          if (st) p.st = [st.missionsWon || 0, st.missionsLost || 0, st.missionSuccessRate || 0, st.deaths || 0, (st.terminidKills || 0) + (st.automatonKills || 0) + (st.illuminateKills || 0)];
          p.reg = (a.regions || []).filter(r => r).map(r => [titleCase(txt(r.name) || L.region), r.size ? titleCase(String(r.size)) : '', r.maxHealth && r.health != null ? 1 - r.health / r.maxHealth : null, !!r.isAvailable, r.players || 0]);
        }
        if (p.ev && p.ev.from == null) {
          // where the attack comes from: a neighbouring world the attacker holds
          const nb = [...(ADJ.get(s.i) || [])].find(j => { const q = lv.pl[j]; return q && OWN[q[0]] === p.ev.f; });
          p.ev.from = nb ?? null;
        }
        if (!p.def && p.o === 'Humans') p.lib = null;
        p.f = p.def && p.ev ? p.ev.f : p.o;
        if (p.i === 0) { p.o = 'Humans'; p.f = 'Humans'; p.acc = false; }
        return p;
      });
      byI = new Map(P.map(p => [p.i, p]));
      war = P.filter(p => p.acc && p.i !== 0 && p.f !== 'Humans');
      top = [...war].sort((a, b) => b.pl - a.pl);
      N = Math.max(1, (last && last.N) || P.reduce((a, p) => a + p.pl, 0));
      F = ENEMIES.map(f => { const ps = top.filter(p => p.f === f); return { f, ps, n: ps.reduce((a, p) => a + p.pl, 0) }; }).filter(x => x.ps.length).sort((a, b) => b.n - a.n);
      // the order: the worlds its objectives name; with none (liberate N, kill), the worlds the call sends you to
      MO = new Set(); MOT = ''; MOW = new Map();
      if (res && !res.ended && res.verdict !== 'done') {
        const open = (res.tasks || []).filter(r => r && r.verdict !== 'done');
        open.forEach(r => { const i = r.task?.planetIndex ?? r.planet?.index; if (i == null || !byI.has(Number(i))) return; MO.add(Number(i)); if (!MOW.has(Number(i))) try { MOW.set(Number(i), plain(taskText(r))); } catch { /* the HUD's line stands in */ } });
        const named = open.find(r => r.planet) || open[0];
        try { MOT = named ? plain(taskText(named)) : ''; } catch { MOT = ''; }
        if (!MO.size) { const cp = cardPlanets({ res }); (cp ? cp.list || [cp.planet] : []).forEach(p => { if (p && byI.has(Number(p.index))) MO.add(Number(p.index)); }); }
        if (open.length > 1) MOT += ' ' + fill(L.moMore, { n: open.length - 1 });
      }
      // between orders the Ministry's pick takes the order's place on the map (8 Nov 2026: not an order, a pointer)
      PICK = null;
      if (!res && !MO.size) { try { const m = meanwhilePick(); if (m && byI.has(Number(m.p.index))) PICK = Number(m.p.index); } catch { PICK = null; } }
      ROUTES = [...MO].map(i => byI.get(i)).filter(p => p && p.o !== 'Humans').map(p => ({ t: p, path: routeTo(p.i) }));
      STEP = new Map();
      ROUTES.forEach(r => { if (!r.path) return; const en = r.path.filter(p => p.o !== 'Humans'); en.forEach((p, k) => { if (!STEP.has(p.i)) STEP.set(p.i, { k: k + 1, n: en.length, t: r.t }); }); });
      // the DSS: where it is now (the page's own reading first), the road it took, its actions
      const at = last && last.dssIdx != null ? Number(last.dssIdx) : live && live.dss ? live.dss.at : null;
      DSS = at != null && byI.has(at) ? { at, vote: live?.dss?.vote || null, route: (live?.dss?.route || []).filter(([i]) => byI.has(i)), acts: live?.dss?.acts || [] } : null;
      if (DSS && (!DSS.route.length || DSS.route[DSS.route.length - 1][0] !== at)) DSS.route.push([at, Date.now()]);
      if (openP) openP = byI.get(openP.i) || null;
    }
    /* The route planner: a world can only be attacked from one of ours along a supply line, so an order's target
       behind enemy lines needs the worlds in between taken first. The fewest enemy worlds from our territory to
       the target; among equal routes, the one through worlds already open to drops and further liberated. */
    function routeTo(tg) {
      const enemy = p => p.o !== 'Humans', cost = p => enemy(p) ? 1 - .25 * (p.acc ? 1 : 0) - .2 * (p.lib || 0) : 0, dist = new Map(), prev = new Map(), todo = [];
      P.forEach(p => { if (!enemy(p)) { dist.set(p.i, 0); todo.push(p.i); } });
      while (todo.length) {
        todo.sort((a, b) => dist.get(a) - dist.get(b));
        const u = todo.shift(); if (u === tg) break;
        for (const v of ADJ.get(u) || []) { const d = dist.get(u) + cost(byI.get(v)) + .001; if (d < (dist.get(v) ?? 1e9)) { dist.set(v, d); prev.set(v, u); if (!todo.includes(v)) todo.push(v); } }
      }
      if (!dist.has(tg)) return null;
      const out = [tg];
      while (prev.has(out[0]) && enemy(byI.get(out[0]))) out.unshift(prev.get(out[0]));
      return out.map(i => byI.get(i));
    }
    const gaining = p => p.gr != null && p.gr > 0.01;
    const shown = p => p.acc && p.pl >= 20;   // Helldivers shown only where they can drop and are 20 or more
    const FIL = { off: new Set(), gain: false };
    const ownerOf = p => p.def && p.ev ? p.ev.f : p.o;
    const statusTxt = p => p.def ? fill(L.underAtt, { f: FN[p.ev?.f] || L.enemy }) : p.o === 'Humans' ? L.heldSE : fill(L.heldBy, { f: FN[p.o] });
    const libTxt = p => p.lib != null ? `${p.def ? L.defended : L.liberated} <b>${Math.round(p.lib * 100)}%</b>` : esc(L.heldSE);

    /* ---------- worlds drawn by their biome ---------- */
    const BIO = { 'Plains': ['#b8d47e', '#6f9a43', '#2c4218', 'cloud'], 'Ionic Crimson': ['#ff8a8a', '#b02a3a', '#4a0d18', 'bands'], 'Icy Glaciers': ['#f2faff', '#a8d0ea', '#3d6a8c', 'ice'],
      'Desert Dunes': ['#f6dc98', '#cc9840', '#6a4416', 'bands'], 'Rocky Canyons': ['#e0a676', '#9a5a35', '#4a2814', 'bands'], 'Basic Swamp': ['#9cba84', '#4e6b3c', '#20301a', 'cloud'],
      'Tundra': ['#e2eaee', '#93aab1', '#3e5157', 'ice'], 'Boneyard': ['#e2ddcc', '#9a9484', '#45413a', 'craters'], 'Ethereal Jungle': ['#bff5e6', '#3fa98f', '#11463c', 'cloud'],
      'Volcanic Jungle': ['#8fbf58', '#3a5a22', '#1a2a10', 'cracks'], 'Acidic Badlands': ['#eef07a', '#9aa23a', '#3e4214', 'bands'], 'Haunted Swamp': ['#a2b2b8', '#4a5a62', '#1e2a30', 'cloud'],
      'Scorched Moor': ['#d6966a', '#7a4a2a', '#2e1a10', 'craters'], 'Ionic Jungle': ['#b0ecff', '#3a8fb0', '#103a4e', 'cloud'], 'Deadlands': ['#c6b69e', '#6e6050', '#2e2820', 'craters'],
      'Moon': ['#dfe2e8', '#8a8f98', '#3a3e46', 'craters'], 'Desert Cliffs': ['#efc488', '#b07a3e', '#5a3816', 'bands'], 'Magma': ['#ffbe5a', '#c2401a', '#3a0e06', 'cracks'],
      'Hive World': ['#ecae5e', '#8a5a20', '#3a2408', 'craters'], 'Supercolony': ['#ecae5e', '#8a5a20', '#3a2408', 'craters'], 'Desert Oasis': ['#f4d898', '#b89a50', '#5a4a20', 'cloud'],
      'Deciduous Autumn Forest': ['#f0aa5a', '#a85a20', '#4a2410', 'cloud'], 'Deciduous Forest': ['#9ade7a', '#3e8a2a', '#173a10', 'cloud'], 'Cyberstan Megafactory': ['#a8aeb6', '#5a5f66', '#22252a', 'grid'] };
    const bio = p => BIO[p.b] || ['#c8ccd4', '#7a808a', '#30343a', 'craters'];
    const rnd = (i, k2) => { const x = Math.sin(i * 127.1 + k2 * 311.7) * 43758.5453; return x - Math.floor(x); };
    const BID = Object.fromEntries(Object.keys(BIO).map((b, i) => [b, 'frbio' + i]));
    const bioDefs = Object.entries(BIO).map(([b, c]) => `<radialGradient id="${BID[b]}" cx="34%" cy="30%" r="75%"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></radialGradient>`).join('')
      + '<radialGradient id="frbioX" cx="34%" cy="30%" r="75%"><stop offset="0" stop-color="#c8ccd4"/><stop offset=".55" stop-color="#7a808a"/><stop offset="1" stop-color="#30343a"/></radialGradient>'
      + '<radialGradient id="frshade" cx="30%" cy="28%" r="85%"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>'
      + '<clipPath id="frball" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath>'
      + ENEMIES.concat('Humans').map(f => `<linearGradient id="frbeam-${f}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${COL[f]}" stop-opacity=".85"/><stop offset="1" stop-color="${COL[f]}" stop-opacity=".05"/></linearGradient>`).join('')
      + ENEMIES.map(f => `<pattern id="frha-${f}" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><rect width="2.2" height="5" fill="${COL[f]}"/></pattern>`).join('');
    // one world: the sphere, its surface, the night side, a rim in its owner's colour
    function ballSVG(p, r, c) {
      const [l, , d, ty0] = bio(p), i = p.i; let art = '';
      if (ty0 === 'bands') for (let k2 = 0; k2 < 3; k2++) { const y = (-.55 + k2 * .5 + rnd(i, k2) * .2) * r; art += `<path d="M${-r} ${y.toFixed(1)}Q0 ${(y + r * (rnd(i, k2 + 3) - .5) * .5).toFixed(1)} ${r} ${y.toFixed(1)}" stroke="${k2 % 2 ? d : l}" stroke-opacity=".55" stroke-width="${(r * (.12 + rnd(i, k2 + 6) * .14)).toFixed(1)}" fill="none"/>`; }
      if (ty0 === 'ice') art += `<ellipse cx="${-r * .1}" cy="${-r * .85}" rx="${r * .9}" ry="${r * .42}" fill="#fff" fill-opacity=".85"/><ellipse cx="${r * .15}" cy="${r * .95}" rx="${r * .7}" ry="${r * .3}" fill="#fff" fill-opacity=".6"/>`;
      if (ty0 === 'craters') for (let k2 = 0; k2 < 4; k2++) { const a = rnd(i, k2) * 6.28, q = rnd(i, k2 + 5) * .65 * r, cr = r * (.12 + rnd(i, k2 + 9) * .16); art += `<circle cx="${(Math.cos(a) * q).toFixed(1)}" cy="${(Math.sin(a) * q).toFixed(1)}" r="${cr.toFixed(1)}" fill="${d}" fill-opacity=".45" stroke="${l}" stroke-opacity=".35" stroke-width="${(cr * .25).toFixed(1)}"/>`; }
      if (ty0 === 'cracks') { let x = -r, y = (rnd(i, 1) - .5) * r, pp = `M${x} ${y.toFixed(1)}`; for (let k2 = 0; k2 < 6; k2++) { x += r / 3; y += (rnd(i, k2 + 2) - .5) * r * .7; pp += `L${x.toFixed(1)} ${y.toFixed(1)}`; } art += `<path d="${pp}" stroke="#ffb340" stroke-width="${Math.max(.8, r * .09).toFixed(1)}" fill="none" stroke-linejoin="round"/><path d="${pp}" transform="translate(${r * .1} ${r * .55}) rotate(18)" stroke="#ff7a1a" stroke-opacity=".7" stroke-width="${Math.max(.6, r * .06).toFixed(1)}" fill="none"/>`; }
      if (ty0 === 'cloud') for (let k2 = 0; k2 < 3; k2++) { const y = (-.55 + k2 * .5) * r + rnd(i, k2) * r * .2, w = r * (.7 + rnd(i, k2 + 4) * .7); art += `<ellipse cx="${((rnd(i, k2 + 8) - .5) * r).toFixed(1)}" cy="${y.toFixed(1)}" rx="${w.toFixed(1)}" ry="${(r * .12).toFixed(1)}" fill="#fff" fill-opacity=".38"/>`; }
      if (ty0 === 'grid') for (let k2 = -2; k2 <= 2; k2++) art += `<line x1="${-r}" y1="${k2 * r * .38}" x2="${r}" y2="${k2 * r * .38}" stroke="#ff3a3a" stroke-opacity=".55" stroke-width="${Math.max(.6, r * .05)}"/><line x1="${k2 * r * .38}" y1="${-r}" x2="${k2 * r * .38}" y2="${r}" stroke="#20242a" stroke-width="${Math.max(.6, r * .05)}"/>`;
      return `<circle r="${(r + 1.7).toFixed(1)}" fill="none" stroke="${c}" stroke-width="2"/><circle class="core" r="${r.toFixed(1)}" fill="url(#${BID[p.b] || 'frbioX'})"/>
        <g clip-path="url(#frball)"><rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" fill="none"/>${art}<circle r="${r}" fill="url(#frshade)"/></g><circle r="${r * .3}" cx="${-r * .38}" cy="${-r * .4}" fill="#fff" fill-opacity=".22"/>`;
    }
    // the conditions: the game's hazard, its icon, and the Ministry's advice for it
    const HZI = { 'Extreme Cold': '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>', 'Intense Heat': '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
      'Acid Storms': '<path d="M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z"/>', 'Ion Storms': '<path d="M13 2L5 13h6l-1 9 8-12h-6z"/>', 'Sandstorms': '<path d="M3 8h12a3 3 0 1 0-3-3M3 13h16a3 3 0 1 1-3 3M3 18h8"/>',
      'Blizzards': '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15M8 19l1-2M13 21l1-2M18 19l1-2"/>', 'Thick Fog': '<path d="M3 8h18M5 12h14M3 16h18M7 20h10"/>', 'Rainstorms': '<path d="M6 14a4 4 0 0 1 1-8 5 5 0 0 1 10 1 3.5 3.5 0 0 1 0 7z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
      'Tremors': '<path d="M2 12h4l2-5 3 10 3-12 3 9 2-2h3"/>', 'Meteor Storms': '<circle cx="16" cy="16" r="4"/><path d="M3 3l10 10M8 3l6 6M3 8l6 6"/>', 'Volcanic Activity': '<path d="M3 21l6-10h6l6 10z"/><path d="M10 7l-1-3M14 7l1-3M12 6V2"/>',
      'Fire Tornadoes': '<path d="M4 4h16M6 8h12M8 12h8M10 16h5M11 20h2"/>' };
    const hzTip = n => tHas('tips.hz.' + String(n).toLowerCase().replace(/\s+/g, '_'));
    const hzIcon = n => `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="hx" d="M12 1 22 6.5v11L12 23 2 17.5v-11Z"/><g transform="translate(6 6) scale(.5)" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${HZI[n] || '<circle cx="12" cy="12" r="3"/>'}</g></svg>`;

    /* ---------- the element, built once ---------- */
    let root = null, tb, plane, svw, world, ov, edge, hr, tipEl, dr, dw, hfEl;
    const q$ = (s) => root.querySelector(s);
    const CAMS = { top: { a: 0, oy: .5 }, table: { a: 52, oy: .6 }, orbit: { a: 70, oy: .72 } };
    let camName = CAMS[store.get('frCam', 'table')] ? store.get('frCam', 'table') : 'table';
    // the tilted board is drawn larger than it shows and scaled down: a browser rasterises a 3D-turned layer at
    // its own size, so drawn at 1:1 the near half of the table, magnified by the perspective, came out soft and
    // pixelated. Strokes that keep their width on screen are drawn SS times as wide to come out the same (9 Nov 2026)
    const SS = (window.devicePixelRatio || 1) >= 2 ? 1.5 : 2, sw = (n) => +(n * SS).toFixed(2), da = (a, b) => `${sw(a)} ${sw(b)}`;
    let cam = { ...CAMS[camName] }, PP = 1400, W = 0, H = 0, k = 1, tx = 0, ty = 0, kFit = 1, homed = false;
    function build() {
      root = document.createElement('section');
      root.className = 'fr-table'; root.setAttribute('aria-label', L.aria);
      const camBtn = (c) => `<button type="button" class="fr-cam" data-cam="${c}" aria-pressed="${camName === c}">${esc(L.cams[c])}</button>`;
      root.innerHTML = `<div class="fr-bg"><div class="sky"></div><div class="horizon"></div>
        <div class="plane"><svg class="svw"><g class="world"></g></svg></div>
        <svg class="over" aria-hidden="false"></svg></div>
        <div class="edge"></div>
        <div class="corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="hud h-fronts"></div>
        <div class="hud h-read" aria-live="polite"></div>
        <div class="fr-tip" aria-hidden="true"></div>
        <aside class="drawer" aria-label="${esc(L.cardAria)}" aria-hidden="true" inert><div class="dw"></div></aside>
        <div class="hud h-cam" role="group" aria-label="${esc(L.camAria)}">${Object.keys(CAMS).map(camBtn).join('')}</div>
        <div class="hud h-zoom"><span>${esc(L.dragHelp)}</span><button class="zb" type="button" data-z="out" aria-label="${esc(L.zOut)}">−</button><button class="zb" type="button" data-z="in" aria-label="${esc(L.zIn)}">+</button><button class="zb" type="button" data-z="home" aria-label="${esc(L.zHome)}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="5"/><path d="M8 0v4M8 12v4M0 8h4M12 8h4"/></svg></button></div>`;
      tb = root; plane = q$('.plane'); plane.style.setProperty('--ss', SS); plane.style.width = plane.style.height = SS * 100 + '%'; svw = q$('.svw'); world = q$('.world'); ov = q$('.over'); edge = q$('.edge'); hr = q$('.h-read'); tipEl = q$('.fr-tip'); dr = q$('.drawer'); dw = q$('.dw'); hfEl = q$('.h-fronts');
      bind();
      try { new ResizeObserver(() => { if (root.isConnected) resized(); }).observe(root); } catch { /* old browsers: the window's resize event */ }
      window.addEventListener('resize', () => { if (root.isConnected) resized(); });
      window.addEventListener('keydown', e => { if (e.key === 'Escape' && openP && root.isConnected) closeCard(); });
      // the countdowns of the attacks move on
      setInterval(() => { if (root.isConnected && !document.hidden) apply(); }, 30000);
    }
    // the map spans the whole window, outside the page's column
    function size() {
      const cw = document.documentElement.clientWidth, par = root.parentElement;
      if (par) { const pr = par.getBoundingClientRect(); root.style.width = cw + 'px'; root.style.marginLeft = (-pr.left) + 'px'; }
      const r = tb.getBoundingClientRect(); W = r.width; H = r.height; kFit = Math.min(W, H) / 1060; PP = Math.max(900, H * 1.6);
      svw.setAttribute('viewBox', `0 0 ${W} ${H}`);
    }
    function resized() {
      const w0 = W, h0 = H, mid = w0 ? unproj(w0 / 2, h0 * cam.oy) : null, g = mid ? { x: (mid.x - tx) / k, y: (mid.y - ty) / k } : null;
      size();
      if (!W || !H) return;
      if (!homed) { homed = true; home(false); return; }
      if (g && (w0 !== W || h0 !== H)) { const a = aim(g.x, g.y, W / 2, H * cam.oy, k * Math.min(W, H) / Math.max(1, Math.min(w0, h0))); k = a.k; tx = a.tx; ty = a.ty; }
      apply();
    }

    /* ---------- the flat world: drawn again when the war changes ---------- */
    function drawWorld() {
      let s = '<circle class="rim" r="503"/>', defs = '';
      for (let d = 0; d < 360; d += 2) { const a = d * Math.PI / 180, l = d % 30 === 0 ? 14 : d % 10 === 0 ? 8 : 4; s += `<line class="rtick" x1="${(Math.cos(a) * 506).toFixed(1)}" y1="${(Math.sin(a) * 506).toFixed(1)}" x2="${(Math.cos(a) * (506 + l)).toFixed(1)}" y2="${(Math.sin(a) * (506 + l)).toFixed(1)}" stroke-width="${sw(d % 30 === 0 ? 1.3 : .8)}"/>`; }
      // the enemy's territory: each world's ground merged into one shape per faction, outlined only on its edge
      ENEMIES.forEach(f => {
        const d = P.filter(p => p.o === f && p.blob).map(p => p.blob).join('');
        if (!d) return;
        defs += `<mask id="frtm-${f}" maskUnits="userSpaceOnUse" x="-620" y="-620" width="1240" height="1240"><rect x="-620" y="-620" width="1240" height="1240" fill="#fff"/><path d="${d}" fill="#000"/></mask>`;
        s += `<g class="terr" data-f="${f}"><path d="${d}" fill="${COL[f]}" fill-opacity=".16"/><path d="${d}" fill="none" stroke="${COL[f]}" stroke-opacity=".8" stroke-width="${sw(2.8)}" mask="url(#frtm-${f})" style="vector-effect:non-scaling-stroke"/></g>`;
      });
      s += Object.entries(SEC).map(([n, q]) => `<path class="sec" data-s="${esc(n)}" d="${q[0]}"/>`).join('');
      const seen = new Set();
      P.forEach(p => p.w.forEach(j => {
        const q = byI.get(j); if (!q) return;
        const kk = p.i < j ? p.i + '-' + j : j + '-' + p.i; if (seen.has(kk)) return; seen.add(kk);
        const en = p.o !== 'Humans' && p.o === q.o;
        s += `<line class="lane" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"${en ? ` style="stroke:${COL[p.o]};stroke-opacity:.5"` : ''}/>`;
      }));
      // a world under attack: its ground striped in the attacker's colour, an arrow from where the attack comes
      P.filter(p => p.def && p.ev).forEach(p => {
        const c = COL[p.ev.f], id = 'frhw' + p.i, q = byI.get(p.ev.from);
        defs += `<pattern id="${id}" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><rect width="3" height="7" fill="${c}" fill-opacity=".55"/></pattern>`;
        s += `<circle class="atkg" data-f="${p.f}" cx="${p.x}" cy="${p.y}" r="30" fill="url(#${id})" stroke="${c}" stroke-width="${sw(1.4)}" stroke-dasharray="${da(4, 3)}" style="vector-effect:non-scaling-stroke"/>`;
        if (q) {
          const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, x1 = q.x + ux * 14, y1 = q.y + uy * 14, x2 = p.x - ux * 34, y2 = p.y - uy * 34;
          if (d > 50) s += `<g class="atkg" data-f="${p.f}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${sw(2.2)}" stroke-dasharray="${da(6, 4)}" style="vector-effect:non-scaling-stroke"/><path d="M${x2 + ux * 9} ${y2 + uy * 9}L${x2 - uy * 6} ${y2 + ux * 6}L${x2 + uy * 6} ${y2 - ux * 6}Z" fill="${c}"/></g>`;
        }
      });
      // the DSS's road: where it has been, to where it is now
      const rt = (DSS ? DSS.route : []).map(([i]) => byI.get(i)).filter(Boolean);
      if (rt.length > 1) {
        s += `<polyline points="${rt.map(p => p.x + ',' + p.y).join(' ')}" fill="none" stroke="${DSS_C}" stroke-opacity=".75" stroke-width="${sw(1.6)}" stroke-dasharray="${da(2, 5)}" stroke-linecap="round" style="vector-effect:non-scaling-stroke"/>`;
        rt.slice(0, -1).forEach(p => { s += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="none" stroke="${DSS_C}" stroke-opacity=".7" stroke-width="${sw(1.2)}" style="vector-effect:non-scaling-stroke"/>`; });
      }
      world.innerHTML = `<defs>${defs}</defs>` + s;
    }

    /* ---------- the projection: the plane is pitched back by a around its centre line ---------- */
    const rad = p => war.includes(p) ? 6 + Math.sqrt(p.pl / Math.max(1, top[0]?.pl || 1)) * 17 : (p.o === 'Humans' ? 2.6 : 3.6);
    function proj(X, Y) { const a = cam.a * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), ox = W / 2, oy = H * cam.oy, y = Y - oy, z = y * s, f = PP / (PP - z); return { x: ox + (X - ox) * f, y: oy + y * c * f, f }; }
    function unproj(Xs, Ys) { const a = cam.a * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), ox = W / 2, oy = H * cam.oy, d = Ys - oy, y = d * PP / (c * PP + d * s), f = PP / (PP - y * s); return { x: ox + (Xs - ox) / f, y: oy + y }; }
    const S = p => proj(p.x * k + tx, p.y * k + ty);
    const tg = r => { const b = r * .45; return `M${-r} ${-r + b}V${-r}H${-r + b}M${r - b} ${-r}H${r}V${-r + b}M${r} ${r - b}V${r}H${r - b}M${-r + b} ${r}H${-r}V${r - b}`; };
    let lastBoxes = [];
    function drawOver() {
      const a = cam.a * Math.PI / 180, sa = Math.sin(a), ca = Math.cos(a), phone = W < 700, z = k / kFit, topPl = Math.max(1, top[0]?.pl || 1);
      let s = `<defs>${bioDefs}</defs>`, Lb = '';
      const tr = tb.getBoundingClientRect(), boxes = [...tb.querySelectorAll('.hud')].map(e => { const r = e.getBoundingClientRect(); return { x0: r.left - tr.left - 8, x1: r.right - tr.left + 8, y0: r.top - tr.top - 8, y1: r.bottom - tr.top + 8, hud: 1 }; });
      const items = [...war].sort((p, q) => S(p).y - S(q).y);   // far first
      const se = S({ x: 0, y: 0 });
      // the quiet worlds: small dots in their biome's colour, ringed in the enemy's colour where he holds them
      P.forEach(p => {
        if (p.i === 0 || war.includes(p) || FIL.off.has(p.o)) return;
        const b = S(p); if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) return;
        const f = Math.max(.75, Math.min(1.2, b.f)), en = p.o !== 'Humans';
        s += `<g class="qp${FIL.gain ? ' dim' : ''}" data-i="${p.i}" data-f="${p.o}" transform="translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})"><circle r="8" fill="transparent"/>${en ? `<circle r="${(3.4 * f).toFixed(1)}" fill="${bio(p)[1]}" stroke="${COL[p.o]}" stroke-width="1.5"/>` : `<circle r="${(2.4 * f).toFixed(1)}" fill="${bio(p)[0]}" fill-opacity=".7"/>`}</g>`;
      });
      // the route to the order's target: a dashed yellow line with a glow, a chevron on every leg
      ROUTES.forEach(r => {
        if (!r.path || r.path.length < 2) return;
        const pts = r.path.map(p => S(p)), pl = pts.map(q => q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' ');
        s += `<polyline points="${pl}" fill="none" stroke="${SE_Y}" stroke-opacity=".22" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${pl}" fill="none" stroke="${SE_Y}" stroke-width="2" stroke-dasharray="7 6" stroke-linecap="round"/>`;
        pts.slice(1).forEach((q, j) => {
          const p = pts[j], d = Math.hypot(q.x - p.x, q.y - p.y); if (d < 28) return;
          const ux = (q.x - p.x) / d, uy = (q.y - p.y) / d, mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
          const ch = `M${(mx - ux * 5 - uy * 6).toFixed(1)} ${(my - uy * 5 + ux * 6).toFixed(1)}L${(mx + ux * 4).toFixed(1)} ${(my + uy * 4).toFixed(1)}L${(mx - ux * 5 + uy * 6).toFixed(1)} ${(my - uy * 5 - ux * 6).toFixed(1)}`;
          s += `<path d="${ch}" fill="none" stroke="#07080b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="${ch}" fill="none" stroke="${SE_Y}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
        });
      });
      war.forEach(p => { p._top = null; }); P.forEach(p => { p._rt = null; });
      items.forEach(p => {
        if (FIL.off.has(p.f)) return;
        const b = S(p); if (b.x < -80 || b.x > W + 80 || b.y < -200 || b.y > H + 80) return;
        const dimp = FIL.gain && !gaining(p), f = b.f, r = rad(p) * Math.min(1.25, Math.max(.55, f)), c = COL[p.f];
        const h = sa * (18 + Math.sqrt(p.pl / topPl) * (phone ? 150 : 240)) * f;   // the beam: Helldivers as height
        const R = r + 5.5, C = 2 * Math.PI * R, ty2 = b.y - h;
        let g = '';
        if (h > 2) {   // the pool on the table: the liberation ring lies flat on the ground
          g += `<ellipse rx="${(R * 1.5).toFixed(1)}" ry="${(R * 1.5 * ca).toFixed(1)}" fill="${c}" fill-opacity=".18"/>`;
          g += `<g transform="scale(1 ${ca.toFixed(3)})"><circle class="ringbg" r="${R.toFixed(1)}"/>${p.lib > 0.004 ? `<circle class="ring" r="${R.toFixed(1)}" stroke-dasharray="${(p.lib * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90)"/>` : ''}</g>`;
          g += `<rect x="${(-Math.max(1.5, r * .28)).toFixed(1)}" y="${(-h).toFixed(1)}" width="${Math.max(3, r * .56).toFixed(1)}" height="${h.toFixed(1)}" fill="url(#frbeam-${p.f})"/><line y2="${(-h).toFixed(1)}" stroke="${c}" stroke-width="1" stroke-opacity=".9"/>`;
          g += `<g transform="translate(0 ${(-h).toFixed(1)})"><circle r="${(r * 1.9).toFixed(1)}" fill="${c}" opacity=".16"/>${ballSVG(p, r, c)}<path class="tgt" d="${tg(r + 7)}"/></g>`;
        } else g += `<circle class="ringbg" r="${R + 1}"/>${p.lib > 0.004 ? `<circle class="ring" r="${R + 1}" stroke-dasharray="${(p.lib * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90)"/>` : ''}${ballSVG(p, r, c)}<path class="tgt" d="${tg(R + 6)}"/>`;
        if (p.def && p.ev) {   // under attack: the world pulses, a striped halo in the attacker's colour
          g += `<g transform="translate(0 ${h > 2 ? (-h).toFixed(1) : 0})"><circle class="atkp" r="${r + 3}" stroke="${c}" stroke-width="2"/><circle r="${r + 7}" fill="none" stroke="url(#frha-${p.ev.f})" stroke-width="5"/></g>`;
        }
        s += `<g class="pl${MO.has(p.i) || p.i === PICK ? ' mo' : ''}${dimp ? ' dim' : ''}" data-i="${p.i}" tabindex="0" role="button" aria-label="${esc(fill(L.openAria, { p: p.n }))}" transform="translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})">${g}<rect x="${-r - 4}" y="${(-h - r - 4).toFixed(1)}" width="${2 * r + 8}" height="${(h + 2 * r + 8).toFixed(1)}" fill="transparent"/></g>`;
        const pad = p.def ? 9 : 4;
        boxes.push({ x0: b.x - r - pad, x1: b.x + r + pad, y0: ty2 - r - pad, y1: ty2 + r + pad, p: p.i });
        if (h > 2) boxes.push({ x0: b.x - R * 1.5, x1: b.x + R * 1.5, y0: b.y - R * 1.5 * ca, y1: b.y + R * 1.5 * ca, p: p.i, g: 1 });
        p._top = dimp ? null : { x: b.x, y: ty2, r };
        // the DSS in orbit: a badge on the world's shoulder
        if (DSS && p.i === DSS.at && !dimp) {
          const bx = b.x - r - 24, by = ty2 - r - 6;
          s += `<g class="dssb" transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})"><path d="M0 -9L15 -9L20 0L15 9L0 9L-5 0Z" fill="${DSS_C}"/><text x="7.5" y="3.2" text-anchor="middle">DSS</text></g><line x1="${bx + 15}" y1="${by + 5}" x2="${b.x - r * .6}" y2="${ty2 - r * .6}" stroke="${DSS_C}" stroke-width="1.2"/>`;
          boxes.push({ x0: bx - 7, x1: bx + 22, y0: by - 11, y1: by + 11, p: p.i });
        }
      });
      // the DSS over a quiet world: the same badge on the dot
      if (DSS && !war.some(p => p.i === DSS.at)) {
        const p = byI.get(DSS.at), b = p && S(p);
        if (b && b.x > 0 && b.x < W && b.y > 0 && b.y < H) { s += `<g class="dssb" transform="translate(${(b.x - 26).toFixed(1)} ${(b.y - 12).toFixed(1)})"><path d="M0 -9L15 -9L20 0L15 9L0 9L-5 0Z" fill="${DSS_C}"/><text x="7.5" y="3.2" text-anchor="middle">DSS</text></g>`; boxes.push({ x0: b.x - 33, x1: b.x - 4, y0: b.y - 23, y1: b.y - 1, p: p.i }); }
      }
      // the route's steps: a ring on each quiet world's ground, the target with a dot
      STEP.forEach((st, i) => {
        const p = byI.get(i); if (FIL.off.has(p.f)) return;
        const b = S(p); if (b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) return;
        const isT = st.t.i === i;
        if (!war.includes(p)) s += `<circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${isT ? 7 : 5.5}" fill="#07080b" stroke="${SE_Y}" stroke-width="2"/>${isT ? `<circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="2.6" fill="${SE_Y}"/>` : ''}`;
        boxes.push({ x0: b.x - 7, x1: b.x + 7, y0: b.y - 7, y1: b.y + 7, p: i });
        if (!p._top) p._rt = { x: b.x, y: b.y, r: 6 };
      });
      // the order's worlds that nobody can drop on yet, outside the route: the yellow sights on the dot
      [...MO, ...(PICK != null ? [PICK] : [])].forEach(i => { const p = byI.get(i); if (!p || war.includes(p) || STEP.has(i)) return; const b = S(p); if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) return; s += `<path class="tgt on" transform="translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})" d="${tg(9)}" style="opacity:1"/>`; if (!p._top) p._rt = { x: b.x, y: b.y, r: 8 }; });
      // Super Earth stands on the table too
      if (se.x > -60 && se.x < W + 60 && se.y > -60 && se.y < H + 60) {
        const hS = sa * 60 * se.f, fS = Math.max(.6, Math.min(1.2, se.f));
        s += `<g transform="translate(${se.x.toFixed(1)} ${se.y.toFixed(1)})">${hS > 2 ? `<ellipse rx="${34 * fS}" ry="${34 * fS * ca}" fill="none" stroke="${SE_Y}" stroke-opacity=".5" stroke-dasharray="3 4"/><line y2="${-hS}" stroke="${SE_Y}" stroke-opacity=".7"/>` : ''}
          <g transform="translate(0 ${-hS})"><circle r="${24 * fS}" fill="#07080b" stroke="${SE_Y}" stroke-width="2"/>${hS > 2 ? '' : `<circle r="${31 * fS}" fill="none" stroke="${SE_Y}" stroke-opacity=".35" stroke-dasharray="3 4"/>`}<image href="${IC('Humans')}" x="${-17 * fS}" y="${-17 * fS}" width="${34 * fS}" height="${34 * fS}"/><text class="lbl" y="${44 * fS}" text-anchor="middle" style="fill:${SE_Y};font-size:11px;letter-spacing:.2em">${esc(L.superEarth)}</text></g></g>`;
        boxes.push({ x0: se.x - 60, x1: se.x + 60, y0: se.y - hS - 34, y1: Math.max(se.y + 20, se.y - hS + 56) });
      }
      // names: the fights at the top of their beams, then (closer) the enemy's worlds and sectors on the ground
      const must = new Set([top[0], ...F.map(x => x.ps[0]), ...war.filter(p => MO.has(p.i) || p.def), ...[...STEP.keys(), ...MO, ...(PICK != null ? [PICK] : [])].map(i => byI.get(i))].filter(Boolean).map(p => p.i));
      const lines = (p, f) => {
        const out = [], st = STEP.get(p.i), num = st && !MO.has(p.i) ? String(st.k) : null;
        if (MO.has(p.i)) out.push(['mo', '◆ ' + L.moTag, f * .75]); else if (p.i === PICK) out.push(['mo', '◆ ' + L.pickTag, f * .75]);
        out.push(['', num ? num + '  ' + p.n : p.n, f, num]);
        if (shown(p)) out.push(['n', fmt(p.pl), f * .85]);
        if (p.def && p.ev && p.ev.end) out.push(['cd', '⚠ ' + fill(L.left, { t: left(p.ev.end) }), f * .85]);
        if (FIL.gain && gaining(p)) out.push(['gr', '▲ +' + fmt(p.gr, 2) + L.perH, f * .85]);
        return out;
      };
      const lab = (ls, x, y0, an, col) => { let y = y0, o = ''; ls.forEach(([c, tx0, sz, pre]) => { y += sz; const body = pre ? `<tspan style="fill:${SE_Y}">${esc(pre)}</tspan>${esc(tx0.slice(pre.length))}` : esc(tx0); o += `<text class="lbl ${c}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${an}" style="font-size:${sz.toFixed(1)}px${c === 'cd' ? ';fill:' + col : ''}">${body}</text>`; y += sz * .18; }); return o; };
      const lh = ls => ls.reduce((a2, l) => a2 + l[2] * 1.18, 0);
      const fit = (b) => b.x0 > 6 && b.x1 < W - 6 && b.y0 > 4 && b.y1 < H - 4 && !boxes.some(q => b.x0 < q.x1 && q.x0 < b.x1 && b.y0 < q.y1 && q.y0 < b.y1 && q.p !== b.p);
      [...top.filter(p => p._top), ...P.filter(p => p._rt)].filter(p => !phone || z > 1.6 || p.pl > 700 || must.has(p.i)).sort((a2, b2) => must.has(b2.i) - must.has(a2.i)).forEach(p => {
        const tt = p._top || p._rt, f = phone ? 11 : 13, ls = lines(p, f), tw = Math.max(...ls.map(l => l[1].length * l[2] * .74)) + 6, th = lh(ls), r = tt.r + 9, col = COL[p.ev ? p.ev.f : p.f];
        // beside, above, below, then the four corners; the worlds that must be named take the first place free of the HUD
        const place = (sx, sy) => { const bx = sx > 0 ? tt.x + r : sx < 0 ? tt.x - r - tw : tt.x - tw / 2, by = sy < 0 ? tt.y - r * (sx ? .4 : 1) - th : sy > 0 ? tt.y + r * (sx ? .4 : 1) : tt.y - th / 2; return { x0: bx, x1: bx + tw, y0: by, y1: by + th, p: p.i, sx }; };
        let b = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 1], [-1, -1], [-1, 1]].map(([sx, sy]) => place(sx, sy)).find(fit), lead = null;
        // no room beside it: a world that must be named gets its name in the nearest free spot, joined by a leader line
        if (!b && must.has(p.i)) for (let d = r + 30; d < 260 && !b; d += 22) for (let k2 = 0; k2 < 16 && !b; k2++) {
          const an2 = -Math.PI / 2 + k2 * Math.PI / 8 * (k2 % 2 ? 1 : -1), cx = tt.x + Math.cos(an2) * d, cy = tt.y + Math.sin(an2) * d, sx = Math.cos(an2) > .3 ? 1 : Math.cos(an2) < -.3 ? -1 : 0;
          const q = { x0: sx > 0 ? cx : sx < 0 ? cx - tw : cx - tw / 2, y0: cy - th / 2, p: p.i, sx }; q.x1 = q.x0 + tw; q.y1 = q.y0 + th;
          if (fit(q)) { b = q; lead = [cx, cy]; }
        }
        if (!b) return;
        boxes.push(b);
        const x = b.sx > 0 ? b.x0 : b.sx < 0 ? b.x1 : (b.x0 + b.x1) / 2, an = b.sx > 0 ? 'start' : b.sx < 0 ? 'end' : 'middle', lc = MO.has(p.i) || p.i === PICK ? SE_Y : col;
        if (lead) Lb += `<line x1="${tt.x.toFixed(1)}" y1="${tt.y.toFixed(1)}" x2="${lead[0].toFixed(1)}" y2="${lead[1].toFixed(1)}" stroke="${lc}" stroke-opacity=".8" stroke-width="1"/><circle cx="${lead[0].toFixed(1)}" cy="${lead[1].toFixed(1)}" r="2" fill="${lc}"/>`;
        Lb += lab(ls, lead && b.sx > 0 ? x + 5 : lead && b.sx < 0 ? x - 5 : x, b.y0, an, col);
      });
      if (z > 1.3 && cam.a < 60 && !FIL.gain) P.filter(p => p.o !== 'Humans' && !war.includes(p) && !FIL.off.has(p.o) && !p._rt).forEach(p => { const b = S(p), f = 10.5, tw = p.n.length * f * .74 + 6, bb = { x0: b.x + 6, x1: b.x + 6 + tw, y0: b.y - f * .8, y1: b.y + f * .5 }; if (!fit(bb)) return; boxes.push(bb); Lb += `<text class="lbl qn" x="${(b.x + 6).toFixed(1)}" y="${(b.y + f * .35).toFixed(1)}">${esc(p.n)}</text>`; });
      if (z > 1.7) Object.entries(SEC).forEach(([n, q]) => { if (n === 'Sol') return; const b = S({ x: q[1], y: q[2] }), w = secName(n).length * 10.5 + 16, bb = { x0: b.x - w / 2, x1: b.x + w / 2, y0: b.y - 8, y1: b.y + 6 }; if (!fit(bb)) return; boxes.push(bb); Lb += `<text class="lbl s" data-s="${esc(n)}" x="${b.x.toFixed(1)}" y="${(b.y + 4).toFixed(1)}" text-anchor="middle">${esc(secName(n))}</text>`; });
      ov.setAttribute('viewBox', `0 0 ${W} ${H}`);
      ov.innerHTML = s + Lb;
      lastBoxes = boxes.filter(q => !q.hud);
      mark();
      world.querySelectorAll('[data-f]').forEach(e => { const off = FIL.off.has(e.dataset.f); e.style.opacity = off ? (e.classList.contains('terr') ? .18 : 0) : FIL.gain && !e.classList.contains('terr') ? .25 : ''; });
    }
    function apply() {
      if (!W) return;
      const a = cam.a;
      world.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(5)})`);
      // the same turn about the same point as before, applied to a board SS times larger and scaled back down
      const ox = W / 2, oy = H * cam.oy;
      plane.style.transform = a ? `translate(${ox}px, ${oy}px) perspective(${PP}px) rotateX(${a}deg) translate(${-ox}px, ${-oy}px) scale(${1 / SS})` : `scale(${1 / SS})`;
      q$('.sky').style.transform = `translate(${((tx * .04) % 620).toFixed(1)}px, ${((ty * .04) % 520).toFixed(1)}px)`;
      // the glow lies on the table around Super Earth, the middle of the map, flattened by the camera's angle
      const mid = S({ x: 0, y: 0 }), hz = q$('.horizon').style, rw = 330 * k * mid.f;
      hz.setProperty('--hx', mid.x.toFixed(0) + 'px'); hz.setProperty('--hy', mid.y.toFixed(0) + 'px'); hz.setProperty('--hw', rw.toFixed(0) + 'px'); hz.setProperty('--hh', (rw * Math.cos(a * Math.PI / 180)).toFixed(0) + 'px');
      drawOver(); edges();
    }
    // one redraw a frame, however many moves the pointer sends
    let rq = 0;
    const req = () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; apply(); }); };
    function edges() {
      let h = '';
      const cx = W / 2, cy = H / 2, mi = 8;
      top.slice(0, W < 700 ? 3 : 6).forEach(p => {
        if (FIL.off.has(p.f)) return;
        const b = S(p), x = b.x, y = b.y;
        if (x > mi && x < W - mi && y > mi && y < H - mi) return;
        if (p._top && p._top.x > 0 && p._top.x < W && p._top.y > 0 && p._top.y < H) return;
        if (lastBoxes.some(q => q.p === p.i && q.y1 > 0 && q.y0 < H && q.x1 > 0 && q.x0 < W)) return;
        const dx = x - cx, dy = y - cy, tt = Math.min((dx > 0 ? W - 46 - cx : 46 - cx) / dx || 1e9, (dy > 0 ? H - 46 - cy : 46 - cy) / dy || 1e9);
        const ex = cx + dx * Math.abs(tt), ey = cy + dy * Math.abs(tt), an = Math.atan2(dy, dx) * 180 / Math.PI;
        h += `<button type="button" class="fr-chip" data-go="${p.i}" style="--c:${COL[p.f]};left:${Math.max(70, Math.min(W - 70, ex)).toFixed(0)}px;top:${Math.max(24, Math.min(H - 24, ey)).toFixed(0)}px"><i style="transform:rotate(${an.toFixed(0)}deg)"></i>${esc(p.n)}${shown(p) ? `<small>${fmt(p.pl)}</small>` : ''}</button>`;
      });
      edge.innerHTML = h;
      if (!h) return;
      const er = edge.getBoundingClientRect(), hit = (a, b) => a.l < b.r + 6 && b.l < a.r + 6 && a.t < b.b + 6 && b.t < a.b + 6;
      const placed = [...tb.querySelectorAll('.hud')].map(e => { const r = e.getBoundingClientRect(); return { l: r.left - er.left, r: r.right - er.left, t: r.top - er.top, b: r.bottom - er.top }; }), names = lastBoxes.map(q => ({ l: q.x0, r: q.x1, t: q.y0, b: q.y1 }));
      edge.querySelectorAll('.fr-chip').forEach(c => {
        let x = parseFloat(c.style.left), y = parseFloat(c.style.top), ok = false;
        const w = c.offsetWidth, hh = c.offsetHeight, side = (y <= 30 || y >= H - 30) ? 'h' : 'v';
        for (let it = 0; it < 14; it++) {
          const r = { l: x - w / 2, r: x + w / 2, t: y - hh / 2, b: y + hh / 2 }, q = placed.find(o => hit(r, o)) || names.find(o => hit(r, o));
          if (!q) { ok = true; break; }
          if (side === 'h') x = x < W / 2 ? q.r + w / 2 + 8 : q.l - w / 2 - 8; else y = y < H / 2 ? q.b + hh / 2 + 8 : q.t - hh / 2 - 8;
        }
        if (!ok || x - w / 2 < 4 || x + w / 2 > W - 4 || y - hh / 2 < 4 || y + hh / 2 > H - 4) { c.remove(); return; }
        c.style.left = x + 'px'; c.style.top = y + 'px'; placed.push({ l: x - w / 2, r: x + w / 2, t: y - hh / 2, b: y + hh / 2 });
      });
    }

    /* ---------- the camera moves ---------- */
    let tw = 0, zRaf = 0, zT = null, zA = null;
    function stopMoves() { cancelAnimationFrame(tw); cancelAnimationFrame(glide); cancelAnimationFrame(zRaf); zRaf = 0; zT = null; }
    function animate(to, anim) {
      stopMoves();
      if (!anim || !motion()) { Object.assign(cam, to.cam || {}); if (to.k != null) { k = to.k; tx = to.tx; ty = to.ty; } apply(); return; }
      const a0 = { ...cam, k, tx, ty }, t0 = performance.now(), D = 650, e = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      (function st(now) {
        const q = Math.min(1, (now - t0) / D), v = e(q);
        if (to.cam) { cam.a = a0.a + (to.cam.a - a0.a) * v; cam.oy = a0.oy + (to.cam.oy - a0.oy) * v; }
        if (to.k != null) { k = a0.k * Math.pow(to.k / a0.k, v); tx = a0.tx + (to.tx - a0.tx) * v; ty = a0.ty + (to.ty - a0.ty) * v; }
        apply(); if (q < 1) tw = requestAnimationFrame(st);
      })(t0);
    }
    // put galaxy point (gx,gy) under screen point (sx,sy) at zoom nk
    function aim(gx, gy, sx, sy, nk) { const pl = unproj(sx, sy); return { k: nk, tx: pl.x - gx * nk, ty: pl.y - gy * nk }; }
    const clampK = (x) => Math.max(kFit * .9, Math.min(kFit * 9, x));
    // home: Super Earth in the middle of what the fronts panel leaves free
    function home(anim) { const nk = kFit * (W < 700 ? 1.05 : camName === 'orbit' ? 2.1 : camName === 'table' ? 1.85 : 1.7), sy = camName === 'top' ? H * .5 : H * (camName === 'orbit' ? .62 : .55), hw = W < 700 ? 0 : Math.min(W * .3, hfEl.offsetWidth + 30); animate(aim(0, 0, (W + hw) / 2, sy, nk), anim); }
    function flyTo(p, sx) { const nk = Math.max(k, kFit * 3); animate(aim(p.x, p.y, sx ?? W / 2, camName === 'top' ? H / 2 : H * .62, nk), true); }
    function zoomAt(f, cx, cy) { const nk = clampK(k * f), pl = unproj(cx, cy), gx = (pl.x - tx) / k, gy = (pl.y - ty) / k, a = aim(gx, gy, cx, cy, nk); k = a.k; tx = a.tx; ty = a.ty; req(); }
    // the eased zoom: the wheel and the buttons set where the zoom is going, each frame goes a quarter of the way
    // there, and the point under the pointer stays under it
    function zoomTo(f, cx, cy) {
      if (!motion()) { zoomAt(f, cx, cy); return; }
      cancelAnimationFrame(tw); cancelAnimationFrame(glide);
      zT = clampK((zT ?? k) * f);
      const pl = unproj(cx, cy); zA = { gx: (pl.x - tx) / k, gy: (pl.y - ty) / k, cx, cy };
      if (!zRaf) zRaf = requestAnimationFrame(zStep);
    }
    function zStep() {
      zRaf = 0; if (zT == null) return;
      const l = Math.log(zT / k), nk = Math.abs(l) < .002 ? zT : k * Math.exp(l * .22), a = aim(zA.gx, zA.gy, zA.cx, zA.cy, nk);
      k = a.k; tx = a.tx; ty = a.ty; apply();
      if (nk === zT) zT = null; else zRaf = requestAnimationFrame(zStep);
    }
    function frame(ps, sx, pad, cap) {
      if (!ps.length) return;
      const xs = ps.map(p => p.x), ys = ps.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const nk = Math.min(kFit * cap, Math.min(W * .55 / (x1 - x0 + pad), H * .65 / (y1 - y0 + pad)));
      animate(aim((x0 + x1) / 2, (y0 + y1) / 2, W * sx, camName === 'top' ? H / 2 : H * .6, nk), true);
    }
    function setCam(c) {
      if (!CAMS[c] || c === camName) return;
      camName = c; store.set('frCam', c);
      root.querySelectorAll('[data-cam]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.cam === c)));
      // the camera tilts around the point at the middle of the screen
      const mid = unproj(W / 2, H * cam.oy), gx = (mid.x - tx) / k, gy = (mid.y - ty) / k, to = CAMS[c], save = { ...cam };
      Object.assign(cam, to); const tt = aim(gx, gy, W / 2, H * to.oy, k); Object.assign(cam, save);
      animate({ cam: to, ...tt }, true);
    }

    /* ---------- pointing, dragging, clicking ---------- */
    const pts = new Map();
    let moved = 0, vx = 0, vy = 0, lt = 0, glide = 0, pinch = null, downT = null, curS = null, curP = null;
    function bind() {
      tb.addEventListener('pointerdown', e => {
        downT = e.target; moved = 0;
        if (e.target.closest('.hud,.fr-chip,.drawer')) return;
        try { tb.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); stopMoves(); tb.classList.add('drag');
        dragging = true;   // a refresh waits until the drag ends (the map would lose the pointer)
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k }; }
      });
      // a drag moves the table under the pointer: the point grabbed stays under the finger, in any camera
      tb.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) { hover(e); return; }
        const r = tb.getBoundingClientRect(), p0 = pts.get(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); zoomAt(pinch.k * d / pinch.d / k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); return; }
        const A = unproj(p0.x - r.left, p0.y - r.top), B = unproj(e.clientX - r.left, e.clientY - r.top), dx = B.x - A.x, dy = B.y - A.y;
        moved += Math.abs(e.clientX - p0.x) + Math.abs(e.clientY - p0.y); tx += dx; ty += dy;
        const now = performance.now(), dt = Math.max(1, now - lt); vx = dx / dt * 16; vy = dy / dt * 16; lt = now;
        if (moved > 4) tipOff();
        req();
      });
      const up = e => {
        pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (pts.size) return;
        tb.classList.remove('drag');
        if (moved > 4 && motion() && Math.hypot(vx, vy) > 1 && performance.now() - lt < 80) (function g() { vx *= .92; vy *= .92; tx += vx; ty += vy; apply(); if (Math.hypot(vx, vy) > .3) glide = requestAnimationFrame(g); })();
      };
      tb.addEventListener('pointerup', up); tb.addEventListener('pointercancel', up);
      tb.addEventListener('wheel', e => { if (e.target.closest('.drawer')) return; e.preventDefault(); const r = tb.getBoundingClientRect(), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; zoomTo(Math.exp(-Math.max(-240, Math.min(240, dy)) * .0018), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
      tb.addEventListener('dblclick', e => { if (e.target.closest('.hud,.fr-chip,.drawer')) return; const r = tb.getBoundingClientRect(); zoomTo(2, e.clientX - r.left, e.clientY - r.top); });
      tb.addEventListener('pointerleave', () => { curS = curP = null; mark(); read(); tipOff(); });
      tb.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const pl = e.target.closest && e.target.closest('.over .pl'), hf = e.target.closest && e.target.closest('.hf[data-f]'), mr = e.target.closest && e.target.closest('[data-more]');
        if (mr) { e.preventDefault(); mr.classList.toggle('open'); return; }
        if (pl) { e.preventDefault(); openCard(byI.get(Number(pl.dataset.i)), true); } else if (hf) { e.preventDefault(); hf.click(); }
      });
      dr.addEventListener('pointerdown', e => e.stopPropagation());
      dr.addEventListener('click', e => {
        e.stopPropagation();
        if (e.target.closest('[data-close]')) { closeCard(); return; }
        const mr = e.target.closest('[data-more]'); if (mr) { mr.classList.toggle('open'); return; }
        const o = e.target.closest('[data-open]'); if (o) openCard(byI.get(Number(o.dataset.open)), true);
      });
      tb.addEventListener('click', e => {
        if (moved > 4) return;
        const ff = e.target.closest('[data-ff]');
        if (ff) { const f = ff.dataset.ff; if (FIL.off.has(f)) FIL.off.delete(f); else if (FIL.off.size < F.length - 1) FIL.off.add(f); hud(); apply(); return; }
        if (e.target.closest('[data-fg]')) { FIL.gain = !FIL.gain; hud(); apply(); return; }
        const cm = e.target.closest('[data-cam]'); if (cm) { setCam(cm.dataset.cam); return; }
        if (e.target.closest('[data-mo]')) { frame([...MO].map(i => byI.get(i)).concat(ROUTES.flatMap(r => r.path || [])).filter(Boolean), .58, 120, 4); return; }
        if (e.target.closest('[data-pick]')) { if (PICK != null) openCard(byI.get(PICK), true); return; }
        if (e.target.closest('[data-dss]')) { if (DSS) openCard(byI.get(DSS.at), true); return; }
        const c = e.target.closest('[data-go]'); if (c) { flyTo(byI.get(Number(c.dataset.go))); return; }
        const zb = e.target.closest('[data-z]'); if (zb) { const d = zb.dataset.z; if (d === 'home') home(true); else zoomTo(d === 'in' ? 1.6 : 1 / 1.6, W / 2, H * cam.oy); return; }
        const fr = e.target.closest('.hf[data-f]'); if (fr) { const x = F.find(y => y.f === fr.dataset.f); if (x) frame(x.ps, .56, 80, 5); return; }
        const tg0 = downT && downT.closest && e.target === tb ? downT : e.target, pl0 = tg0.closest('.pl,.qp');
        const pl = pl0 && !pl0.classList.contains('dim') && !(pl0.classList.contains('qp') && FIL.off.has(pl0.dataset.f)) ? pl0 : null;
        if (pl) { openCard(byI.get(Number(pl.dataset.i)), true); return; }
        if (!tg0.closest('.drawer,.hud')) closeCard();
      });
    }
    function mark() {
      const op = openP ? openP.i : null;
      world.querySelectorAll('.sec').forEach(e => e.classList.toggle('on', e.dataset.s === curS));
      const on = world.querySelector('.sec.on'), lane = world.querySelector('.lane'); if (on && lane) on.parentNode.insertBefore(on, lane);
      ov.querySelectorAll('.pl').forEach(e => e.classList.toggle('on', e.dataset.i === String(curP) || e.dataset.i === String(op)));
      ov.querySelectorAll('.lbl.s').forEach(e => e.classList.toggle('on', e.dataset.s === curS));
    }
    function hover(e) {
      if (e.target.closest('.hud,.fr-chip,.drawer')) { tipOff(); return; }
      const pl = e.target.closest('.pl,.qp'), sc = e.target.closest('.sec'), pp = pl ? byI.get(Number(pl.dataset.i)) : null;
      const s = pp ? pp.s : sc ? sc.dataset.s : null, p = pp ? pp.i : null;
      if (pp) tipAt(pp, e); else tipOff();
      if (s === curS && p === curP) return;
      curS = s; curP = p; mark(); read();
    }
    function tipAt(p, e) {
      const r = tb.getBoundingClientRect(); tipEl.style.setProperty('--c', COL[ownerOf(p)]);
      const lib = p.lib != null ? `<span class="row"><span class="lb"><i style="width:${(p.lib * 100).toFixed(1)}%"></i></span>${esc(p.def ? L.defended : L.liberated)} <b>${Math.round(p.lib * 100)}%</b></span>` : '';
      const st0 = STEP.get(p.i);
      const items = [...(MO.has(p.i) ? [`<li class="y">◆ <b>${esc(L.moObj)}</b></li>`] : p.i === PICK ? [`<li class="y">◆ <b>${esc(L.pickObj)}</b></li>`] : st0 ? [`<li class="y">◆ <b>${esc(fill(L.stepOf, { k: st0.k, n: st0.n, p: st0.t.n }))}</b></li>`] : []),
        ...(p.def && p.ev && p.ev.end ? [`<li style="color:${COL[p.ev.f]}">⚠ <b>${esc(fill(L.attLeft, { t: left(p.ev.end) }))}</b></li>`] : []),
        ...p.hz.map(([n]) => `<li class="hz">${hzIcon(n)}<span>${esc(n)}</span></li>`),
        ...p.fx.slice(0, 4).map(f => `<li><i class="dot ${f.k}"></i>${esc(SUB[f.id] ? SUB[f.id].name : f.n)}</li>`)];
      const pace = p.gr != null && p.acc ? `<span class="row">${gaining(p) ? `<b style="color:${GAIN_C}">▲ +${fmt(p.gr, 2)}%</b> ${esc(L.anHour3)}` : esc(L.notGaining)}</span>` : '';
      tipEl.innerHTML = `<span class="k">${esc(secName(p.s))} · ${esc(p.b)}</span><h4>${esc(p.n)}</h4><span class="row">${esc(statusTxt(p))}${shown(p) ? ` · <b>${fmt(p.pl)}</b> ${esc(L.hd)}` : p.acc ? '' : ' · ' + esc(L.closed)}</span>${lib}${pace}
        ${items.length ? `<ul>${items.join('')}</ul>` : `<span class="row">${esc(L.nothing)}</span>`}<span class="more">${esc(L.clickCard)}</span>`;
      const x = e.clientX - r.left, y = e.clientY - r.top, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
      tipEl.style.left = (x + 18 + w > W ? x - 18 - w : x + 18) + 'px'; tipEl.style.top = Math.max(10, Math.min(H - h - 10, y - h / 2)) + 'px'; tipEl.classList.add('on');
    }
    function tipOff() { tipEl.classList.remove('on'); }
    function read() {
      if (curP != null) {
        const p = byI.get(curP);
        hr.innerHTML = `<span class="k">${esc(secName(p.s))}${p.s === 'Sol' ? '' : ' ' + esc(L.sector)} · ${esc(p.b)} · ${esc(FN[p.o])}</span><span class="t">${esc(p.n)}</span><span class="m">${p.lib != null ? `<span class="lb"><i style="width:${(p.lib * 100).toFixed(1)}%"></i></span>` : ''}${libTxt(p)}${shown(p) ? ` · <b>${fmt(p.pl)}</b> ${esc(L.hd)}` : p.acc ? '' : ' · ' + esc(L.closed)}</span>`;
        return;
      }
      if (curS) {
        const ps = P.filter(p => p.s === curS && p.i !== 0), own = {}; ps.forEach(p => { own[p.o] = (own[p.o] || 0) + 1; });
        const hd = ps.filter(shown).reduce((a, p) => a + p.pl, 0), nw = ps.length;
        hr.innerHTML = `<span class="k">${esc(fill(nw === 1 ? L.secWorlds1 : L.secWorlds, { n: nw }))}</span><span class="t">${esc(secName(curS))}</span><span class="m"><span>${esc(L.heldByLbl)}</span>${Object.entries(own).sort((a, b) => b[1] - a[1]).map(([o, c]) => `<span><b style="color:${COL[o]}">■</b> ${esc(FN[o])}: <b>${c}</b></span>`).join('')}${hd ? `<span>· <b>${fmt(hd)}</b> ${esc(L.hd)}</span>` : ''}</span>`;
        return;
      }
      const p = top[0];
      hr.innerHTML = p ? `<span class="k">${esc(L.biggest)} · ${esc(secName(p.s))} · ${esc(p.b)}</span><span class="t">${esc(p.n)}</span><span class="m">${p.lib != null ? `<span class="lb"><i style="width:${(p.lib * 100).toFixed(1)}%"></i></span>` : ''}${libTxt(p)} · <b>${fmt(p.pl)}</b> ${esc(L.hd)}</span>` : '';
    }
    function hud() {
      const onF = F.reduce((a, x) => a + x.n, 0);
      hfEl.innerHTML = `<span class="t"><b>${fmt(N)}</b> ${esc(L.online)}</span>`
        + F.map(x => { const sh = x.n / N * 100; return `<div class="hf" data-f="${x.f}" style="--c:${COL[x.f]}" role="button" tabindex="0" aria-label="${esc(fill(L.frameAria, { f: FN[x.f] }))}"><img src="${IC(x.f)}" alt=""><span class="nm"><b>${esc(FN[x.f])}</b><span>${fmt(x.n)}</span></span><span class="pc">${Math.round(sh)}%</span><div class="fr-seg">${Array.from({ length: 25 }, (_, i) => `<i class="${i < Math.round(sh / 4) ? 'on' : ''}"></i>`).join('')}</div></div>`; }).join('')
        + (onF ? '' : `<span class="t">${esc(L.noFights)}</span>`)
        + (F.length ? `<div class="flt" role="group" aria-label="${esc(L.filters)}">${F.map(x => `<button type="button" class="fb" data-ff="${x.f}" style="--c:${COL[x.f]}" aria-pressed="${!FIL.off.has(x.f)}"><i></i>${esc(FN[x.f])}</button>`).join('')}${war.some(p => p.gr != null) ? `<button type="button" class="fb gain" data-fg aria-pressed="${FIL.gain}"><i></i>${esc(L.gaining)}</button>` : ''}</div>` : '')
        + (MO.size ? `<button type="button" class="hl" data-mo style="--c:${SE_Y}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 2h4M2 2v4M14 2h-4M14 2v4M2 14h4M2 14v-4M14 14h-4M14 14v-4"/></svg><b>${esc(L.mo)}</b><span>${esc(MOT || fill(MO.size === 1 ? L.moWorlds1 : L.moWorlds, { n: MO.size }))}${ROUTES.some(r => r.path && r.path.length > 2) ? ' · ' + esc(fill(L.routeOf, { n: Math.max(...ROUTES.map(r => r.path ? r.path.filter(p => p.o !== 'Humans').length : 0)) })) : ''}</span></button>` : '')
        + (PICK != null ? `<button type="button" class="hl" data-pick style="--c:${SE_Y}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 2h4M2 2v4M14 2h-4M14 2v4M2 14h4M2 14v-4M14 14h-4M14 14v-4"/></svg><b>${esc(L.pick)}</b><span>${esc(byI.get(PICK).n)}</span></button>` : '')
        + (DSS ? `<button type="button" class="hl" data-dss style="--c:${DSS_C}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10l3 4-3 4H3L0 8Z" fill="currentColor"/></svg><b>DSS</b><span>${esc(fill(L.dssOver, { p: byI.get(DSS.at).n }))}</span></button>` : '');
    }

    /* ---------- the planet card ---------- */
    let openP = null;
    /* The card reads in order of importance, with no boxes (8 Nov 2026): the order or the pick, who holds the
       world, one number with the word for it, the bar with its ends and one sentence on how it goes; then what you
       will meet (the enemy's special forces, each with its official emblem, the game's words and the units it
       fields), the conditions, the active effects, what is on your side; regions and neighbours last, quietly.
       The unit renders (src/game/units.json) are fetched when a card first opens. */
    const SUB = {
      1202: { e: 'Jet Brigade', n: 'Jet Brigade', u: ['Jet Brigade Trooper', 'Jet Brigade Commissar', 'Assault Raider', 'Jet Brigade MG Raider', 'Jet Brigade Devastator', 'Jet Brigade Hulk Bruiser', 'Jet Brigade Hulk Scorcher'], pre: 'Jet Brigade ' },
      1248: { e: 'Incineration Corps', n: 'Incineration Corps', u: ['Pyro Trooper', 'Incendiary Rocket Raider', 'Incendiary MG Devastator', 'Conflagration Devastator', 'Hulk Firebomber'] },
      1360: { e: 'Cyborgs', n: 'Cyborg Legion', u: ['Radical', 'Agitator', 'Vox Engine'] },
      1243: { e: 'Predator Strain', n: 'Predator Strain', u: ['Predator Hunter', 'Predator Stalker'], pre: 'Predator ' },
      1244: { e: 'Spore Burst Strain', n: 'Spore Burst Strain', u: ['Spore Burst Scavenger', 'Spore Burst Hunter', 'Spore Burst Warrior', 'Spore Burst Bile Titan'], pre: 'Spore Burst ' },
      1303: { e: 'Rupture Strain', n: 'Rupture Strain', u: ['Rupture Warrior', 'Rupture Spewer', 'Rupture Charger'], pre: 'Rupture ' },
      1430: { e: 'Caustic Strain', n: 'Caustic Strain', u: ['Caustic Spitter', 'Caustic Warrior', 'Caustic Spewer', 'Caustic Charger'], pre: 'Caustic ' },
      1377: { e: 'Mindless Masses', n: 'Mindless Masses', u: ['Voteless', 'Fleshmob'] },
      1402: { e: 'Vote Snatchers', n: 'Vote Snatchers', u: ['Wretch', 'Crusher'] },
      1413: { e: 'Invasion Fleet', n: 'Invasion Fleet', u: ['Overseer', 'Elevated Overseer', 'Crescent Overseer', 'Watcher', 'Harvester', 'Fleshmob', 'Stingray', 'Warp Ship'] },
      1380: { e: 'Appropriators', n: 'Appropriators', u: ['Gatekeeper', 'Obtruder', 'Veracitor'] },
      1306: { e: 'Dragonroach', n: 'Dragonroaches', u: ['Dragonroach'] },
      1307: { e: 'Hive Lord', n: 'Hive Lords', u: ['Hive Lord'] },
      1400: { e: 'Heavy SEAF Presence', n: 'Heavy SEAF presence', help: true },
      1401: { e: 'Heavy SEAF Presence', n: 'Heavy SEAF presence', help: true },
    };
    const EMB = GAME.emb || {};
    let UNITS = null, unitsBusy = false;
    function loadUnits() {
      if (UNITS || unitsBusy) return;
      unitsBusy = true;
      ghFetch('https://raw.githubusercontent.com/ShibaCheemsHD/ministry-of-victory/main/src/game/units.json').then(r => r.ok ? r.json() : null).catch(() => null)
        .then(j => { unitsBusy = false; if (!j || typeof j !== 'object') return; UNITS = j; if (openP && root && root.isConnected) dw.querySelectorAll('.fc-u[data-u]').forEach(e => { const a = UNITS[e.dataset.u]; if (a && !e.querySelector('img')) { const im = new Image(); im.alt = ''; im.src = a[0]; e.classList.toggle('op', !!a[1]); e.querySelector('.fc-t').append(im); } }); });
    }
    const logo = (key) => EMB[key] ? `<i class="fc-logo" style="--m:url('${EMB[key]}')"></i>` : `<i class="fc-logo none"></i>`;
    const GL = {
      clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>', cool: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4h4M12 8v4l2.5 2"/>',
      lock: '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', shield: '<path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
      up: '<path d="M12 20V5M6 11l6-6 6 6"/>', pod: '<path d="M12 2v6M8 8h8l-1 10H9z"/><path d="M6 22h12"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
      q: '<path d="M12 2 21 7v10l-9 5-9-5V7z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>' };
    const gl = (k) => `<i class="fc-gl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GL[k] || GL.gear}</svg></i>`;
    const GLOF = { 21: 'clock', 36: 'cool', 92: 'lock', 74: 'shield', 77: 'shield', 49: 'shield', 48: 'lock', 89: 'lock', 47: 'lock', 88: 'clock', 90: 'shield', 1: 'up', 32: 'pod', 72: 'q' };
    // the sentence under the bar: how it is going, and when it ends
    function sayOf(p) {
      const left0 = (1 - (p.lib || 0)) * 100;
      if (p.def && p.ev) {
        const h = p.ev.end ? Math.max(0, (p.ev.end - Date.now()) / 3.6e6) : null;
        if (h == null || p.gr == null) return null;
        const need = left0 / Math.max(h, .01), eta = p.gr > 0 ? left0 / p.gr : Infinity;
        return eta <= h ? { c: 'var(--v-done)', s: fill(L.fc.holds, { t: dur(h - eta) }) } : { c: 'var(--fr-nil)', s: fill(L.fc.falls, { t: dur(h), need: fmt(need, 1), make: fmt(Math.max(0, p.gr), 1) }) };
      }
      if (p.o === 'Humans') return { c: 'var(--se-blue)', s: L.fc.ours };
      if (!p.acc) return { c: 'var(--dim)', s: L.fc.closed };
      if (p.lib != null && p.lib < .002 && p.rg > 0) {
        const per = last && last.C && last.N ? last.C / last.N : null, need = per && p.rps ? p.rps * 3600 / per : null;
        return { c: 'var(--dim)', s: fill(L.fc.stuck, { f: FN[p.o], r: fmt(p.rg, 1), n: fmt(p.pl) }) + (need && need > p.pl ? ' ' + fill(L.fc.stuckNeed, { n: fmt(Math.ceil(need / 1000) * 1000) }) : '') };
      }
      if (p.gr == null) return null;
      if (p.gr < .05) return { c: 'var(--dim)', s: L.fc.flat };
      const eta = left0 / p.gr;
      const at = Date.now() + eta * 3.6e6;
      return { c: 'var(--v-done)', s: fill(L.fc.eta, { t: dur(eta), when: eta > 120 ? new Date(at).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' }) : when(at) }) };
    }
    const dur = (h) => { const m = Math.round(h * 60); return m < 60 ? fill(L.fc.min, { n: m }) : h < 48 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : fill(L.fc.days, { n: fmt(h / 24) }); };
    function orbSVG(p) {
      const r = 100, c = COL[ownerOf(p)], [l, m, d, ty0] = bio(p), i = p.i; let art = '';
      for (let rep = 0; rep < 2; rep++) {
        const o = rep * 2 * r;
        if (ty0 === 'bands' || ty0 === 'cloud') for (let k2 = 0; k2 < 5; k2++) { const y = (-.8 + k2 * .4 + rnd(i, k2) * .18) * r; art += `<path d="M${o - r} ${y.toFixed(1)}Q${o} ${(y + r * (rnd(i, k2 + 3) - .5) * .5).toFixed(1)} ${o + r} ${y.toFixed(1)}" stroke="${k2 % 2 ? d : l}" stroke-opacity="${ty0 === 'cloud' ? .45 : .5}" stroke-width="${(r * (.08 + rnd(i, k2 + 6) * .12)).toFixed(1)}" fill="none" stroke-linecap="round"/>`; }
        if (ty0 === 'ice') art += `<ellipse cx="${o - 10}" cy="${-r * .86}" rx="${r * .9}" ry="${r * .4}" fill="#fff" fill-opacity=".8"/>`;
        if (ty0 === 'craters' || ty0 === 'cracks' || ty0 === 'grid') for (let k2 = 0; k2 < 7; k2++) { const x = o + (rnd(i, k2) - .5) * 1.6 * r, y = (rnd(i, k2 + 5) - .5) * 1.5 * r, cr = r * (.06 + rnd(i, k2 + 9) * .12); art += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${cr.toFixed(1)}" fill="${d}" fill-opacity=".42" stroke="${ty0 === 'cracks' ? '#ffb340' : l}" stroke-opacity=".35" stroke-width="${(cr * .22).toFixed(1)}"/>`; }
      }
      // the surface turns slowly under the night side (not with reduced motion)
      const spin = motion() ? `<animateTransform attributeName="transform" type="translate" from="0 0" to="${-2 * r} 0" dur="80s" repeatCount="indefinite"/>` : '';
      const atk = p.def && p.ev ? `<circle r="${r + 12}" fill="none" stroke="url(#frha-${p.ev.f})" stroke-width="9" opacity=".9"/>` : '';
      return `<svg viewBox="-125 -125 250 250" aria-hidden="true"><defs><radialGradient id="fcg" cx="34%" cy="30%" r="75%"><stop offset="0" stop-color="${l}"/><stop offset=".55" stop-color="${m}"/><stop offset="1" stop-color="${d}"/></radialGradient><radialGradient id="fcs" cx="28%" cy="26%" r="90%"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient><clipPath id="fcc"><circle r="${r}"/></clipPath></defs>
        ${atk}<circle r="${r + 3}" fill="none" stroke="${c}" stroke-width="2.5"/><circle r="${r}" fill="url(#fcg)"/><g clip-path="url(#fcc)"><g>${art}${spin}</g><circle r="${r}" fill="url(#fcs)"/></g><circle r="${r * .22}" cx="${-r * .42}" cy="${-r * .44}" fill="#fff" fill-opacity=".16"/></svg>`;
    }
    function cardHTML(p) {
      const own = ownerOf(p), C = L.fc, sy = sayOf(p), st = STEP.get(p.i), pct = p.def || p.o !== 'Humans' ? (p.lib || 0) * 100 : 100;
      const nb = [...(ADJ.get(p.i) || [])].map(i => byI.get(i)).filter(q => q && q.i !== 0);
      const nil = (b, rest) => `<p class="fc-nil"><i></i><span><b>${esc(b)}</b>${esc(rest)}</span></p>`;
      // the order, or between orders the Ministry's pick, before everything
      const tag = MO.has(p.i) ? `<div class="fc-tag"><span>◆ ${esc(L.mo)}</span>${esc(MOW.get(p.i) || MOT || '')}</div>`
        : st ? `<div class="fc-tag"><span>◆ ${esc(L.mo)}</span>${esc(fill(L.stepOf, { k: st.k, n: st.n, p: st.t.n }))}</div>`
        : p.i === PICK ? `<div class="fc-tag"><span>◆ ${esc(L.pick)}</span>${esc(C.pickTxt)}</div>` : '';
      const lft = p.def && p.ev && p.ev.end ? p.ev.end : null;
      const side = lft ? `<div class="fc-side" style="color:${COL[p.ev.f]}"><small>${esc(L.attEnds)}</small><span data-clock="${lft}">${esc(left(lft))}</span></div>`
        : p.acc && p.gr != null && !(p.lib < .002 && p.rg > 0) && p.o !== 'Humans' ? `<div class="fc-side" style="color:${gaining(p) ? 'var(--v-done)' : 'var(--dim)'}"><small>${esc(C.last3)}</small>${gaining(p) ? '▲ +' : ''}${fmt(p.gr, 2)}%/h</div>` : '';
      const proj = p.gr > 0 && (p.def || p.o !== 'Humans') ? Math.min(100 - pct, p.gr * (lft ? Math.max(0, (lft - Date.now()) / 3.6e6) : 6)) : 0;
      const here = [shown(p) ? `<span>${C.icPeople}<b>${fmt(p.pl)}</b> ${esc(fill(C.here, { x: p.pl / N < .01 ? C.under1 : fmt(p.pl / N * 100) + '%' }))}</span>` : '',
        p.acc && p.rg != null && !p.def && !(p.lib < .002 && p.rg > 0) ? `<span>${C.icRes}${esc(fill(C.resist, { x: fmt(p.rg, 2) }))}</span>` : ''].join('');
      // what you will meet: the enemy's special forces, with the units they field
      const subs = p.fx.filter(f => SUB[f.id] && !SUB[f.id].help), unk = p.fx.filter(f => f.type === 40 && !SUB[f.id] && !isSeafEffect({ type: 40, eid: f.id }));
      const forces = subs.map(f => { const S0 = SUB[f.id]; return `<div class="fc-sf">${logo(S0.e)}<div><h4>${esc(S0.n)}</h4><p data-more tabindex="0">${esc(f.d)}</p></div>
          <div class="fc-units">${S0.u.map((u, j) => { const a = UNITS && UNITS[u]; return `<span class="fc-u${a && a[1] ? ' op' : ''}" data-u="${esc(u)}" style="--j:${j}" title="${esc(u)}"><span class="fc-t">${a ? `<img src="${a[0]}" alt="">` : ''}</span><span class="fc-n">${esc(S0.pre && u.startsWith(S0.pre) ? u.slice(S0.pre.length) : u)}</span></span>`; }).join('')}</div></div>`; }).join('')
        + unk.map(() => `<div class="fc-row">${gl('q')}<div><b>${esc(C.unkDep)}</b><p>${esc(C.unkDepT)}</p></div></div>`).join('');
      const ground = p.hz.length ? p.hz.map(([n, d]) => `<div class="fc-row hz">${EMB[n] ? logo(n) : `<i class="fc-gl">${hzIcon(n)}</i>`}<div><b>${esc(n)}</b><p>${esc(hzTip(n) || plain(d))}</p></div></div>`).join('') : nil(C.noHz, C.noHzT);
      const mods = p.fx.filter(f => !SUB[f.id] && f.type !== 40 && f.k !== 'good');
      const modRows = mods.length ? mods.map(f => `<div class="fc-row mod">${gl(GLOF[f.type])}<div><b>${esc(f.n)}</b>${f.d ? `<p>${esc(f.d)}</p>` : ''}</div></div>`).join('') : nil(C.noFx, C.noFxT);
      // on your side: SEAF, free stratagems, boosts, the DSS and what it is doing
      const dssAct = DSS && p.i === DSS.at ? (DSS.acts || []).filter(([, , s2, ex]) => s2 === 2 && ex > Date.now()) : [];
      const help = [...p.fx.filter(f => SUB[f.id] && SUB[f.id].help || isSeafEffect({ type: f.type, eid: f.id })).map(f => `<div class="fc-row ally">${logo('Heavy SEAF Presence')}<div><b>${esc(L.fc.seaf)}</b><p>${esc(f.d)}</p></div></div>`),
        ...p.fx.filter(f => f.k === 'good' && !SUB[f.id] && !isSeafEffect({ type: f.type, eid: f.id })).map(f => `<div class="fc-row ally">${gl(GLOF[f.type])}<div><b>${esc(f.n)}</b>${f.d ? `<p>${esc(f.d)}</p>` : ''}</div></div>`),
        ...(DSS && p.i === DSS.at ? [`<div class="fc-row ally dss">${logo('DSS')}<div><b>${esc(L.dssH)}</b><p>${dssAct.length ? dssAct.map(([n, , , ex]) => `<b>${esc(titleCase(n))}</b> ${esc(fill(L.until, { t: when(ex) }))}`).join(' · ') : esc(C.dssHere)}${DSS.vote && DSS.vote > Date.now() ? ' · ' + fill(esc(L.vote), { t: `<b>${esc(when(DSS.vote))}</b>` }) : ''}</p></div></div>`] : [])].join('');
      const route = (() => {
        const r = st ? ROUTES.find(x => x.t === st.t) : MO.has(p.i) ? ROUTES.find(x => x.t === p) : null;
        if (!r) return '';
        if (!r.path) return `<div class="fc-ln"><span>${esc(C.route)}</span><span>${esc(L.noLine)}</span></div>`;
        const en = r.path.filter(q => q.o !== 'Humans');
        return en.length > 1 ? `<div class="fc-ln"><span>${esc(C.route)}</span><span>${esc(r.path[0].n)} ${en.map((q, j) => `→ <button type="button" data-open="${q.i}" class="lk${q === p ? ' me' : ''}"><b>${j + 1}</b> ${esc(q.n)}</button>`).join(' ')}</span></div>` : '';
      })();
      const open = p.reg.filter(r => r[3]);
      const regs = p.reg.length ? `<div class="fc-ln"><span>${esc(C.regions)}</span><span><b>${esc(fill(C.regOpen, { a: open.length, b: p.reg.length }))}</b>${open.length ? ': ' + open.map(([n, , fr, , pl]) => `${esc(n)}${fr ? ' ' + fmt(fr * 100) + '%' : ''}${p.acc && pl >= 20 ? ' · ' + fmt(pl) + ' ' + esc(C.inR) : ''}`).join(', ') : ''}</span></div>` : '';
      return `<button type="button" class="dx" data-close aria-label="${esc(L.close)}">✕</button>
        <div class="fc-orb" style="--c:${COL[own]}">${orbSVG(p)}</div>
        ${tag}<div class="fc-where">${esc(secName(p.s))}${p.s === 'Sol' ? '' : ' ' + esc(L.sector)} · ${esc(p.b)}</div>
        <h3 class="fc-name">${esc(p.n)}</h3>
        <div class="fc-who" style="--c:${COL[own]}"><img src="${IC(own) || IC('Humans')}" alt="">${esc(p.def && p.ev ? fill(L.underAtt, { f: C.one[p.ev.f] }) : p.o === 'Humans' ? C.seWorld : fill(C.world, { f: C.one[p.o] }))}</div>
        <section class="fc-state" style="--vc:${sy ? sy.c : 'var(--fg)'}">
          <div class="fc-top"><div class="fc-big"><b data-count="${pct.toFixed(2)}">${fmt(motion() ? 0 : pct, pct > 0 && pct < 10 ? 1 : 0)}%</b><span>${esc(p.def ? L.defended : p.o === 'Humans' ? C.ours0 : L.liberated)}</span></div>${side}</div>
          <div class="fc-bar"><i class="f${p.gr > .05 && motion() ? ' move' : ''}" data-w="${pct.toFixed(2)}"></i>${proj > .2 ? `<i class="pj" style="left:${pct.toFixed(2)}%;width:${proj.toFixed(2)}%"></i>` : ''}<i class="goal"></i></div>
          <div class="fc-scale"><span>${esc(p.def ? C.falls : '0')}</span><span>${esc(p.def ? C.held : L.liberated)} · 100%</span></div>
          ${sy ? `<p class="fc-say">${sy.s}</p>` : ''}${here ? `<div class="fc-here">${here}</div>` : ''}
        </section>
        ${own !== 'Humans' ? `<section class="fc-sec"><h5>${esc(C.forces)}</h5>${forces || nil(C.noSub, fill(C.noSubT, { f: C.one[own] }))}</section>` : ''}
        <section class="fc-sec"><h5>${esc(L.conditions)}</h5>${ground}</section>
        <section class="fc-sec"><h5>${esc(L.effects)}</h5>${modRows}</section>
        ${help ? `<section class="fc-sec"><h5>${esc(C.side)}</h5>${help}</section>` : ''}
        <section class="fc-more">${route}${regs}${nb.length ? `<div class="fc-ln"><span>${esc(C.next)}</span><span>${nb.map(q => `<button type="button" class="lk" data-open="${q.i}" style="--c:${COL[ownerOf(q)]}"><i></i>${esc(q.n)}${p.ev && p.ev.from === q.i ? ` <em>${esc(C.attacking)}</em>` : ''}</button>`).join(' ')}</span></div>` : ''}</section>`;
    }
    // the card arrives: the number counts up while the bar fills; an attack's clock runs every second
    let clockT = 0;
    function liven(anim = true) {
      window.clearInterval(clockT);
      if (!motion()) anim = false;
      const b = dw.querySelector('[data-count]'), f = dw.querySelector('.fc-bar .f'), to = b ? Number(b.dataset.count) : 0, d = to > 0 && to < 10 ? 1 : 0;
      if (f) { if (anim) requestAnimationFrame(() => requestAnimationFrame(() => { f.style.width = f.dataset.w + '%'; })); else f.style.width = f.dataset.w + '%'; }
      if (b && !anim) b.textContent = fmt(to, d) + '%';
      if (b && anim) { const t0 = performance.now(); (function st(t) { const q = Math.min(1, (t - t0) / 900), v = 1 - Math.pow(1 - q, 3); b.textContent = fmt(to * v, d) + '%'; if (q < 1 && b.isConnected) requestAnimationFrame(st); })(t0); }
      const cl = dw.querySelector('[data-clock]');
      if (cl) { const end = Number(cl.dataset.clock), tick = () => { const s2 = Math.max(0, (end - Date.now()) / 1e3); cl.textContent = [s2 / 3600, s2 % 3600 / 60, s2 % 60].map(x => String(Math.floor(x)).padStart(2, '0')).join(':'); }; tick(); clockT = setInterval(() => { if (!cl.isConnected) { window.clearInterval(clockT); return; } tick(); }, 1000); }
    }
    function openCard(p, fly) {
      if (!p) return;
      tipOff();
      const first = !openP; openP = p; dr.style.setProperty('--c', COL[ownerOf(p)]);
      loadUnits();
      const paint = () => { dw.innerHTML = cardHTML(p); dw.classList.remove('fade'); dr.scrollTop = 0; dw.classList.remove('in'); void dw.offsetWidth; dw.classList.add('in'); liven(); };
      if (first || !motion()) paint(); else { dw.classList.add('fade'); setTimeout(paint, 120); }
      dr.classList.add('on'); dr.setAttribute('aria-hidden', 'false'); dr.removeAttribute('inert'); mark();
      // the world goes to the middle of what the card leaves free
      if (fly) { const dwid = W < 700 ? 0 : dr.offsetWidth, nk = Math.max(k, kFit * 2.6), sy = W < 700 ? H * .24 : camName === 'top' ? H / 2 : H * .6; animate(aim(p.x, p.y, (W - dwid) / 2, sy, nk), true); }
    }
    function closeCard() { if (!openP) return; openP = null; window.clearInterval(clockT); dr.classList.remove('on'); dr.setAttribute('aria-hidden', 'true'); dr.setAttribute('inert', ''); mark(); }

    /* ---------- in the page ---------- */
    function update() {
      const key = [last && last.now, live && live.t, record && record.t, curRes && curRes.verdict, curRes && (curRes.tasks || []).length].join('|');
      if (key !== stamp) {
        stamp = key; model(curRes); drawWorld(); hud(); read();
        if (openP) { const sc = dr.scrollTop; dw.innerHTML = cardHTML(openP); dr.scrollTop = sc; liven(false); }
      }
      apply();
    }
    function slotHTML(res) { if (curRes !== res) { curRes = res; stamp = null; } load(false); return '<div class="fr-slot"></div>'; }
    function mount() {
      const slot = document.querySelector('#view .fr-slot');
      if (!slot) return;
      if (!root) build();
      const sc = dr.scrollTop;
      slot.replaceWith(root);
      dr.scrollTop = sc;
      size();
      if (!homed && W && H) { homed = true; model(curRes); stamp = null; home(false); }
      update();
    }
    return { ready, load, slotHTML, mount };
  })();
