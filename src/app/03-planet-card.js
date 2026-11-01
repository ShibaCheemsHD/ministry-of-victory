  /* ---------- planet card: hover (or tap) the planet in the order of the day ---------- */
  // Conditions and enemies come straight from the game (texts via github.com/helldivers-2/json);
  // the advice under them is ours, checked against the Helldivers Wiki (numbers noted where it has them).
  const G = (typeof GAME !== 'undefined') ? GAME : { env: {}, bio: {}, fx: {} };
  const envKey = (name) => Object.keys(G.env).find(k => (G.env[k].n || '').toLowerCase() === String(name || '').toLowerCase()) || null;
  const HZ_ICON = {
    extreme_cold: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />',
    intense_heat: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    acid_storms: '<path d="M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z"/>',
    ion_storms: '<path d="M13 2L5 13h6l-1 9 8-12h-6z"/>',
    sandstorms: '<path d="M3 8h12a3 3 0 1 0-3-3M3 13h16a3 3 0 1 1-3 3M3 18h8"/>',
    blizzards: '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15M8 19l1-2M13 21l1-2M18 19l1-2"/>',
    thick_fog: '<path d="M3 8h18M5 12h14M3 16h18M7 20h10"/>',
    rainstorms: '<path d="M6 14a4 4 0 0 1 1-8 5 5 0 0 1 10 1 3.5 3.5 0 0 1 0 7z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    tremors: '<path d="M2 12h4l2-5 3 10 3-12 3 9 2-2h3"/>',
    meteor_storms: '<circle cx="16" cy="16" r="4"/><path d="M3 3l10 10M8 3l6 6M3 8l6 6"/>',
    volcanic_activity: '<path d="M3 21l6-10h6l6 10z"/><path d="M10 7l-1-3M14 7l1-3M12 6V2"/>',
    fire_tornadoes: '<path d="M4 4h16M6 8h12M8 12h8M10 16h5M11 20h2"/>',
  };
  const hzIcon = (k) => `<svg class="hz-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 22 6.5v11L12 23 2 17.5v-11Z" class="hex"/><g transform="translate(6 6) scale(.5)">${HZ_ICON[k] || '<circle cx="12" cy="12" r="3"/>'}</g></svg>`;
  // tips: texts in the dictionary (tips.hz / tips.fac / tips.div), sources here
  const HZ_SRC = { extreme_cold: 'wiki', intense_heat: 'wiki' };
  const hzTip = (k) => tHas('tips.hz.' + k);
  const FAC_TIP = (f) => tHas('tips.fac.' + f);
  const DIV_RE = [['jet', /jet brigade/i], ['predator', /predator/i], ['rupture', /rupture/i], ['spore', /spore burst/i], ['incin', /incinerat/i], ['dragon', /dragonroach/i]];
  const divTip = (n) => { const d = DIV_RE.find(([, re]) => re.test(n)); return d ? t('tips.div.' + d[0]) : null; };
  const fxName = (id) => { const f = G.fx[String(id)]; return f && f.n ? f.n.replace(/\s*\((enemies)\)\s*$/i, '').trim() : null; };
  function planetCardHTML(p, entry, frontPlanets) {
    if (!p) return '';
    const res = entry.res, owner = factionOfPlanet(p), fac = owner && owner !== 'Humans' ? owner : (p.event ? p.event.faction : null);
    const m = p.event ? p.event.maxHealth : p.maxHealth, h = p.event ? p.event.health : p.health;
    const lib = m ? 1 - h / m : 0, regen = p.regenPerSecond && p.maxHealth ? p.regenPerSecond * 3600 / p.maxHealth : 0;
    const task = res.tasks.find(r => r.planet && r.planet.index === p.index);
    const fx = (record?.effects || []).filter(e => e.planets.includes(p.index) || e.planets.includes(-1));
    const permits = fx.filter(e => e.type === 32), divs = fx.filter(e => e.type === 40 || e.type === 72);
    const weapons = res.tasks.filter(r => r.verdict !== 'done' && r.task.itemId && (!r.task.faction || r.task.faction === fac)).map(r => itemName(r.task.itemId));
    const bioKey = p.biome && Object.keys(G.bio).find(k => G.bio[k].n === p.biome.name);
    const hz = (p.hazards || []).map(x => ({ k: envKey(x.name), name: x.name, d: x.description || (G.env[envKey(x.name)] || {}).d })).filter(x => x.k !== 'none' && x.k !== 'normal_temp');
    const spark = planetSeries(p.index).filter(q => last.now - q[0] < 24 * 3.6e6);
    const sp = spark.length > 2 ? (() => { const t0 = spark[0][0], t1 = spark[spark.length - 1][0], lo = Math.min(...spark.map(q => q[1])), hi = Math.max(...spark.map(q => q[1]), lo + 0.01);
      return `<svg class="pc-spark" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true"><path d="${spark.map((q, i) => `${i ? 'L' : 'M'}${((q[0] - t0) / Math.max(1, t1 - t0) * 120).toFixed(1)},${(28 - (q[1] - lo) / (hi - lo) * 26).toFixed(1)}`).join('')}" vector-effect="non-scaling-stroke"/></svg>`; })() : '';
    const tabs = frontPlanets && frontPlanets.length > 1 ? `<div class="pc-tabs" role="tablist">${frontPlanets.map(fp => `<button type="button" role="tab" data-pcplanet="${fp.index}" aria-selected="${fp.index === p.index}">${planetName(fp)} <small>${people(fp.statistics?.playerCount || 0)}</small></button>`).join('')}</div>` : '';
    const row = (icon, title, body, tip, src) => `<li><span class="pc-ic">${icon}</span><div><b>${title}</b>${body ? `<p>${body}</p>` : ''}${tip ? `<p class="tip"><i>›</i>${esc(tip)}${src ? ` <span class="src">${esc(t('pc.src.' + src))}</span>` : ''}</p>` : ''}</div></li>`;
    return `<div class="pcard fac-${esc(fac || 'none')}" role="dialog" aria-label="${esc(plain(planetName(p)))}">
      ${tabs}
      <button type="button" class="pc-x" data-pcclose aria-label="${esc(t('pc.close'))}">✕</button>
      <div class="pc-head"><span class="pc-hex"></span><div><h4>${planetName(p)}</h4><span class="pc-sub">${esc(fac ? fill(t('pc.held'), { f: plain(facName(fac)) }) : t('pc.ours'))}${p.sector ? ' · ' + esc(p.sector) : ''}</span></div></div>
      <div class="pc-stats">
        <div><span class="label">${esc(t(p.event ? 'pc.defended' : 'pc.lib'))}</span><b>${pct(lib, 1)}</b>${sp}</div>
        <div><span class="label">${esc(t('pc.players'))}</span><b>${people(p.statistics?.playerCount || 0)}</b></div>
        ${!p.event && regen ? `<div><span class="label">${esc(t('pc.regen'))}</span><b>${pct(regen, 1)}/h</b></div>` : ''}
        ${task && task.pw && isFinite(task.eta) ? `<div><span class="label">${esc(t('pc.falls'))}</span><b>${esc(task.eta <= res.hoursLeft ? clock(task.eta) : t('pc.late'))}</b></div>` : ''}
      </div>
      <span class="label pc-sec">${esc(t('pc.where'))}</span>
      <ul class="pc-list">
        ${p.biome ? row(hzIcon(null), esc(p.biome.name), esc((p.biome.description || (G.bio[bioKey] || {}).d || '').split(/(?<=\.)\s/)[0]), '', '') : ''}
        ${hz.length ? hz.map(x => row(hzIcon(x.k), esc(x.name), esc(x.d || ''), hzTip(x.k), hzTip(x.k) ? HZ_SRC[x.k] || 'game' : '')).join('') : `<li class="muted"><span class="pc-ic"></span><div><p>${esc(t('pc.noHz'))}</p></div></li>`}
      </ul>
      ${fac && FAC_TIP(fac) ? `<span class="label pc-sec">${esc(t('pc.enemy'))}</span><ul class="pc-list">
        ${row(`<span class="pc-fdot"></span>`, esc(plain(facPlural(fac))), '', FAC_TIP(fac), '')}
        ${divs.map(e => { const n = fxName(e.id) || effectLabel(e.type, e.v); const tip = divTip(n); return row(ICON.fx, esc(n), esc((G.fx[String(e.id)] || {}).d || ''), tip || '', ''); }).join('')}
      </ul>` : ''}
      ${weapons.length || permits.length ? `<span class="label pc-sec">${esc(t('pc.order'))}</span><ul class="pc-list">
        ${weapons.map(w => row(ICON.target, esc(w), esc(t('pc.reqS')), '', '')).join('')}
        ${permits.map(e => row(ICON.plus, esc(itemKnown(valOf(e.v, 4)) || fxName(e.id) || capFirst(t('in.fx.permitAny'))), esc(t('pc.freeS')), '', '')).join('')}
      </ul>` : ''}
      <p class="pc-foot">${esc(t('pc.foot'))}</p>
    </div>`;
  }
  // which planet the card shows: the target, or for a whole front its busiest planets
  function cardPlanets(entry) {
    const p = directiveParts(entry.res);
    if (p.planet) return { list: null, planet: p.planet };
    const fac = p.fac || (entry.res.directive && entry.res.directive.faction);
    if (!fac) return null;
    const list = Object.values(last.planets).filter(x => factionOfPlanet(x) === fac && x.currentOwner !== 'Humans' || (x.event && x.event.faction === fac))
      .sort((a, b) => (b.statistics?.playerCount || 0) - (a.statistics?.playerCount || 0)).slice(0, 3);
    if (!list.length) return null;
    const pick = list.find(x => String(x.index) === String(ui.pcPlanet)) || list[0];
    return { list, planet: pick };
  }

  // Phones: the forecast card sits below the tabs, so the verdict and the time left also go here, right
  // under the order of the day (critique 1 Nov 2026: "how realistic" was ~1,500 px down). Hidden above 640 px.
  function phoneForecast(res, a) {
    const v = res.verdict, exp = a ? Date.parse(a.expiration) : NaN;
    if (!v || v === 'unknown') return '';
    return `<div class="dir-fc" role="group" aria-label="${esc(t('forecast'))}">
      <span class="pill v-${esc(v)}">${ICON[VICON[v] || 'dots']}${esc(t('v.' + v))}</span>
      ${isFinite(exp) && !res.ended ? `<span class="dir-fc-t"><span class="label">${t('timeLeft')}</span><span class="dir-fc-count" data-exp="${exp}">—</span></span>` : ''}
      <button type="button" class="linkish dir-fc-more" data-goto-fc>${esc(t('fcWhy'))} ›</button>
    </div>`;
  }
  function directiveHTML(res, a) {
    const p = directiveParts(res);
    const long = (p.target || '').length > 14;
    const globe = globeHTML(p, res);
    const tint = p.fac ? 'fac-' + esc(p.fac) : `k-${esc(p.d.kind)}`;
    return `<div class="area-dir"><section class="panel br directive ${globe ? 'has-globe' : ''} ${tint}" aria-labelledby="dir-${esc(res.id)}">
      <i class="hatch-rail l y" aria-hidden="true"></i>
      <div class="glow-clip" aria-hidden="true"><div class="glow"></div></div>
      <div class="dir-head"><span class="label"><i class="live"></i>${t('dirLabel')}</span>${p.fac ? `<span class="fchip">${facName(p.fac)}</span>` : ''}</div>
      <div class="dir-title">
        <div class="kicker">${esc(p.kicker)}</div>
        <h2 class="target ${long ? 'long' : ''}" id="dir-${esc(res.id)}" data-decrypt="${esc(p.target)}">${esc(p.target)}</h2>
        ${p.req ? `<p class="req-chip">${ICON.warn}<b>${esc(t('req'))}</b><span>${esc(p.req)}</span></p>` : ''}
      </div>
      ${globe}${globe ? '<div class="pc-wrap" hidden></div>' : ''}
      <p class="why">${p.lead ? `<b class="lead v-${esc(res.verdict)}">${esc(p.lead)}</b>` : ''}${p.why}</p>
      ${p.meter}
      <div class="dir-actions">${phoneForecast(res, a)}
        <button type="button" class="btn primary" data-goto="strategy">${t(res.verdict === 'impossible' || res.verdict === 'failed' || (res.ended && res.verdict !== 'done') ? 'seeWhy' : 'seePlan')} ›</button>
        <button type="button" class="btn ghostly" data-shareimg="${esc(res.id)}" aria-label="${esc(t('sh.btn'))}">${ICON.image}<span data-short="${esc(t('sh.short'))}">${t('sh.btn')}</span></button>
        <button type="button" class="btn ghostly" data-copy="${esc(res.id)}" aria-label="${esc(t('copy'))}">${ICON.copy}<span data-short="${esc(t('copyShort'))}">${t('copy')}</span></button>
      </div>
    </section></div>`;
  }

  const medalsOf = (a) => (a.rewards && a.rewards.length ? a.rewards : [a.reward]).filter(Boolean).reduce((s, x) => s + (x.type === 1 ? Number(x.amount) : 0), 0);

  /* ---------- several orders at once ---------- */
  function renderCross() {
    const box = $('cross');
    const cx = ENGINE.crossOrders(last.results.map(({ a, res }) => ({ id: String(a.id), title: plain(clean(txt(a.title) || 'Major Order')), medals: medalsOf(a), res })), settings.recordShare);
    if (!cx) { box.innerHTML = ''; return; }
    const pick = cx.orders.find(o => o.id === cx.pick);
    const msg = cx.verdict === 'all' ? fill(t('xAll'), { total: shareOf(cx.total) })
      : cx.verdict === 'pick' ? fill(t('xPick'), { total: shareOf(cx.total), title: esc(pick.title), need: shareOf(pick.need) })
      : fill(t(cx.orders.some(o => o.unknown) ? 'xNoneU' : 'xNone'), { total: shareOf(cx.total) });
    // the total is less than the sum when the orders share an enemy: said, or it reads as a sum gone wrong
    const sum = cx.orders.reduce((a, o) => a + (o.unknown ? 0 : o.need || 0), 0);
    const overlap = sum > cx.total + 0.02 ? ' ' + t('xOverlap') : '';
    const note = cx.orders.some(o => o.unknown) ? ` ${t('xUnknown')}` : '';
    const chips = cx.orders.map(o => `<button type="button" class="xchip ${o.id === cx.pick ? 'pick' : ''}" data-otab="${esc(o.id)}">
      <span>${esc(o.title)}</span><b>${o.unknown ? '?' : sharePct(o.need)}</b></button>`).join('');
    const short = cx.verdict === 'all' ? fill(t('xShortAll'), { n: cx.orders.length }) : cx.verdict === 'pick' ? fill(t('xShortPick'), { title: esc(pick.title) }) : t('xShortNone');
    box.innerHTML = `<details class="cross v-${cx.verdict}" data-cross ${ui.crossOpen ? 'open' : ''}>
      <summary><span class="label">${fill(t('xLabelN'), { n: cx.orders.length })}</span><span class="xs">${short}</span>${ICON.chev}</summary>
      <p>${msg}${overlap}${note}</p><div class="xchips">${chips}</div></details>`;
  }

  /* ---------- rail ---------- */
  // the forecast's "why": what we do against what it takes, one meter per open objective
  function whyHTML(res) {
    if (res.verdict === 'done' || res.verdict === 'unknown') return '';
    const meters = [];
    const meter = (label, have, need, sub, mark, key, few = false) => {
      const ratio = need > 0 ? have / need : 1;
      const ok = ratio >= 1;
      const fillW = Math.max(2, Math.min(100, ratio * 100)), markW = mark != null && need > 0 ? Math.min(100, (mark / need) * 100) : null;
      meters.push({ sev: ratio, html: `<div class="why-m ${ok ? 'ok' : ratio < 0.5 ? 'bad' : 'warn'}">
        <div class="wm-top"><span class="wm-l">${label}</span><span class="wm-x">${ok ? esc(t('why.ok')) : esc(fill(t(few ? 'why.few' : 'why.slow'), { x: fmt(1 / Math.max(ratio, 0.01), 1, 1) }))}</span></div>
        <div class="wm-bar" role="img" aria-label="${esc(plain(sub))}"><div class="fill" data-key="why:${esc(key)}" data-w="${fillW}"></div>${markW != null ? `<i class="wm-mark" style="left:${markW}%"></i>` : ''}</div>
        <div class="wm-sub">${sub}</div></div>` });
    };
    for (const r of res.anyOf ? [res.tasks[res.pick]] : res.tasks) {
      if (r.verdict === 'done') continue;
      if (r.counter && !r.simpleCount && r.needed > 0 && r.primary) {
        const noun = taskNoun(r.task);
        const rec0 = r.rates.recent ? r.rates.recent.rate : null;
        // the last hour is worth showing only when it differs from the main pace
        const rec = rec0 != null && r.primary.rate > 0 && Math.abs(rec0 / r.primary.rate - 1) > 0.1 ? rec0 : null;
        // on track thanks to players switching over from finished objectives: the meter shows that pace, said so
        const fr = r.verdict === 'ontrack' && r.freed && r.freed.rate > 0 ? r.freed.rate : null;
        if (fr != null) { meter(noun, fr, r.needed, fill(t('why.paceFreed'), { have: big(r.primary.rate), eff: big(fr), need: big(r.needed) }), null, `${res.id}:${r.idx}`); continue; }
        meter(noun, r.primary.rate, r.needed,
          fill(t(rec != null && r.primary.kind !== 'recent' ? 'why.paceRec' : 'why.pace'), { have: big(r.primary.rate), rec: big(rec), need: big(r.needed), basis: t('why.basis.' + (r.primary.kind || 'start')) }), r.primary.kind !== 'recent' ? rec : null, `${res.id}:${r.idx}`);
      } else if (r.defense && !r.defense.outlastsMO) {
        meter(fill(t('why.def'), { planet: planetName(r.planet) }), r.defense.share, r.defense.need,
          fill(t('why.players'), { have: pct(r.defense.share), need: shareOf(r.defense.need) }), null, `${res.id}:${r.idx}`, true);
      }
    }
    const lib = res.liberation;
    if (lib && isFinite(lib.currentShare) && lib.seqNeed > 0 && lib.verdict !== 'done' && lib.verdict !== 'ontrack')
      meter(esc(t(lib.count > 1 ? 'why.libN' : 'why.lib1')), lib.currentShare, isFinite(lib.seqNeed) ? lib.seqNeed : 5,
        fill(t('why.players'), { have: pct(lib.currentShare), need: shareOf(lib.seqNeed) }), null, `${res.id}:lib`, true);
    if (!meters.length) return '';
    meters.sort((x, y) => x.sev - y.sev);
    const doneN = res.tasks.filter(r => r.verdict === 'done').length;
    return `<div class="fwhy">${meters.slice(0, 3).map(m => m.html).join('')}
      ${doneN ? `<p class="why-done">${ICON.check}<span>${fill(t('why.done'), { k: doneN, n: res.tasks.length })}</span></p>` : ''}</div>`;
  }
