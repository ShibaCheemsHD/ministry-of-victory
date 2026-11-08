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
    const permits = fx.filter(e => e.type === 32), allies = fx.filter(isSeafEffect), divs = fx.filter(e => !isSeafEffect(e) && (e.type === 40 || e.type === 72));
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
      <button type="button" class="pc-x mbtn icon-only" data-pcclose aria-label="${esc(t('pc.close'))}">${ICON.cross}</button>
      <div class="pc-head">${factionIcon(fac || owner)}<div><h2 class="pc-name">${planetName(p)}</h2><span class="pc-sub">${esc(p.event && fac ? fill(t('pc.attacked'), { f: plain(facName(fac)) }) : fac && owner !== 'Humans' ? fill(t('pc.held'), { f: plain(facName(fac)) }) : t('pc.ours'))}${p.sector ? ' · ' + esc(p.sector) : ''}</span></div></div>
      <div class="pc-stats">
        <div><span class="label">${esc(t(p.event ? 'pc.defended' : 'pc.lib'))}</span><b>${pct(lib, 1)}</b>${sp}</div>
        <div><span class="label">${esc(t('pc.players'))}</span><b>${people(p.statistics?.playerCount || 0)}</b></div>
        ${!p.event && regen ? `<div><span class="label">${esc(t('pc.regen'))}</span><b>${pct(regen, 1)}/h</b></div>` : ''}
        ${task && task.pw && isFinite(task.eta) ? `<div><span class="label">${esc(t('pc.falls'))}</span><b>${esc(task.eta <= res.hoursLeft ? clock(task.eta) : t('pc.late'))}</b></div>` : ''}
        ${(() => { const w = missionWorth(p); return w ? `<div><span class="label">${esc(t('pc.mission'))}</span><b>+${tinyPct(w.frac)}</b></div>` : ''; })()}
      </div>
      <div class="pc-sections"><section class="pc-section"><h3 class="label pc-sec">${esc(t('pc.where'))}</h3>
      <ul class="pc-list">
        ${p.biome ? row(hzIcon(null), esc(p.biome.name), esc((p.biome.description || (G.bio[bioKey] || {}).d || '').split(/(?<=\.)\s/)[0]), '', '') : ''}
        ${hz.length ? hz.map(x => row(hzIcon(x.k), esc(x.name), esc(x.d || ''), hzTip(x.k), hzTip(x.k) ? HZ_SRC[x.k] || 'game' : '')).join('') : `<li class="muted"><span class="pc-ic"></span><div><p>${esc(t('pc.noHz'))}</p></div></li>`}
      </ul></section>
      ${fac && FAC_TIP(fac) ? `<section class="pc-section"><h3 class="label pc-sec">${esc(t('pc.enemy'))}</h3><ul class="pc-list">
        ${row(`${factionIcon(fac)}`, esc(plain(facPlural(fac))), '', FAC_TIP(fac), '')}
        ${divs.map(e => { const n = fxName(e.id) || effectLabel(e.type, e.v, e.id); const tip = divTip(n); return row(ICON.fx, esc(n), esc((G.fx[String(e.id)] || {}).d || ''), tip || '', ''); }).join('')}
      </ul></section>` : ''}
      ${allies.length ? `<section class="pc-section pc-allies"><h3 class="label pc-sec">${esc(t('it.allies'))}</h3><ul class="pc-list">${allies.map(e => row(ICON.seaf, esc(effectLabel(e.type, e.v, e.id)), esc(t('in.fx.seafDetail')), '', '')).join('')}</ul></section>` : ''}
      ${weapons.length || permits.length ? `<section class="pc-section"><h3 class="label pc-sec">${esc(t('pc.order'))}</h3><ul class="pc-list">
        ${weapons.map(w => row(ICON.target, esc(w), esc(t('pc.reqS')), '', '')).join('')}
        ${permits.map(e => row(stratagemIcon(itemKnown(valOf(e.v, 4))) || ICON.plus, esc(itemKnown(valOf(e.v, 4)) || fxName(e.id) || capFirst(t('in.fx.permitAny'))), esc(t('pc.freeS')), '', '')).join('')}
      </ul></section>` : ''}
      </div><p class="pc-foot">${esc(t('pc.foot'))}</p>
      <button type="button" class="btn ghostly pc-close2" data-pcclose>${esc(t('pc.close'))}</button>
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

  // The order still worth playing when this one is won or out of reach: the best of the others
  function nextOrder(res) {
    const others = (last.results || []).filter(x => x.res !== res && !x.res.ended && x.res.verdict !== 'done' && x.res.verdict !== 'impossible' && x.res.verdict !== 'failed');
    return others.sort((x, y) => (RANK_V[x.res.verdict] ?? 9) - (RANK_V[y.res.verdict] ?? 9))[0] || null;
  }
  const RANK_V = { ontrack: 0, effort: 1, focus: 1, hard: 2, record: 2, nearly_impossible: 3, unknown: 4 };

  /* ---------- several orders at once ---------- */
  // the desk's comparison of every running order, worked out once per refresh
  let crossMemo = null, crossFor = null;
  function crossNow() {
    if (!last) return null;
    if (crossFor !== last) {
      crossFor = last;
      crossMemo = last.results.length > 1 ? ENGINE.crossOrders(last.results.map(({ a, res }) => ({ id: String(a.id), title: titleCase(clean(txt(a.title) || 'Major Order')), medals: medalsOf(a), res })), settings.recordShare) : null;
    }
    return crossMemo;
  }
  // a share of everyone online, said as Helldivers (critique 1 Nov 2026: "1.2x too few", "twice the players
  // there now" and "79% of everyone online" for one idea): "about 74,500"
  const divers = (share) => share == null || !isFinite(share) ? '—' : people(share * (last ? last.N : 0));
  // The comparison across orders: the order tabs mark the best bet and the call says it when you look at
  // another order, so the numbers behind it live in the plan (critique 1 Nov 2026: said three times)
  function renderCross() { $('cross').innerHTML = ''; }
  function crossHTML() {
    const cx = crossNow();
    if (!cx) return '';
    const pick = cx.orders.find(o => o.id === cx.pick);
    const n = fmt(last.N);
    const msg = cx.verdict === 'all' ? fill(t('xAll'), { total: divers(cx.total), n })
      : cx.verdict === 'pick' ? fill(t('xPick'), { total: divers(cx.total), n, rec: divers(settings.recordShare), title: esc(pick.title), need: divers(pick.need) })
      : fill(t(cx.orders.some(o => o.unknown) ? 'xNoneU' : 'xNone'), { total: divers(cx.total), n });
    const note = cx.orders.some(o => o.unknown) ? ` ${t('xUnknown')}` : '';
    return `<div class="situation across x-${cx.verdict}"><h4 class="sit-h">${esc(fill(t('xLabelN'), { n: cx.orders.length }))}</h4><p>${msg}${note}</p></div>`;
  }

  // What the main button does: the plan while there is one; once the order is won, share it and point to
  // the next order still running; once it is out of reach, the order still worth playing and the reasons.
  // When the desk's best bet is another order, switching to it is the main button (critique 1 Nov 2026).
  function endAction(res, alt) {
    const lost = res.verdict === 'impossible' || res.verdict === 'failed' || (res.ended && res.verdict !== 'done');
    const next = (res.verdict === 'done' || lost) ? nextOrder(res) : null;
    const nextBtn = next ? `<button type="button" class="btn ${res.verdict === 'done' ? 'ghostly' : 'primary'} next-order" data-otab="${esc(next.a.id)}" data-pick>${esc(fill(t(res.verdict === 'done' ? 'endNextDone' : 'endNextLost'), { title: titleCase(clean(txt(next.a.title) || 'Major Order')) }))}${ICON.track}</button>` : '';
    if (res.verdict === 'done') return `<button type="button" class="btn primary" data-shareimg="${esc(res.id)}">${ICON.image}<span>${esc(t('shareWin'))}</span></button>${nextBtn}`;
    if (lost) return `${nextBtn}<button type="button" class="btn ${next ? 'ghostly' : 'primary'}" data-goto="strategy">${esc(t(res.ended || res.verdict === 'failed' ? 'seeWhy' : 'seeWhyOut'))}${ICON.track}</button>`;
    if (alt) return `<button type="button" class="btn primary" data-otab="${esc(alt.id)}" data-pick>${esc(fill(t('endNextLost'), { title: alt.title }))}${ICON.track}</button><button type="button" class="btn ghostly" data-goto="strategy">${esc(t('seePlan'))}${ICON.track}</button>`;
    // an order still running: the plan is one tab away, not a second button under the call (7 Nov 2026)
    return '';
  }

  /* ---------- the call: the desk's one move, with the order's forecast beside it ---------- */
  // What the call says, for the page, the share image and the copied text alike (critique 1 Nov 2026: the
  // image and the Discord text said "OUT OF REACH" where the page said "Drop on Hellmire"). An order out of
  // reach (or over) hands the headline to the move still worth making: the other order that can still be
  // won, else the planet where a mission counts most; a long shot with nothing better keeps its own move.
  function callMove(res, p = directiveParts(res)) {
    const v = res.verdict, out = !res.ended && v !== 'done' && lvl(v) === 'out';
    const state = p.state === 'go' && out ? 'out' : p.state;
    const stopped = state === 'done' || state === 'out' || state === 'ended';
    const next = stopped ? nextOrder(res) : null;
    const mw = stopped && !next && (state === 'ended' || v === 'impossible' || v === 'failed' || p.d.kind === 'lost') ? meanwhilePick() : null;
    const moveOn = state !== 'done' && !!(next || mw);
    const verb0 = ['steady', 'lost'].includes(p.d.kind) ? '' : p.d.kind === 'ended' ? p.kicker + ':' : p.kicker;
    let verb = verb0, target = p.target, why = `${p.lead ? `<b class="lead">${esc(p.lead)}</b>` : ''}${p.why}`, planet = p.planet;
    const lead = res.ended ? t('bw.overWhy') : t('bw.outLead');
    if (moveOn && next) { verb = t('bw.play'); target = titleCase(clean(txt(next.a.title) || 'Major Order')); why = `${esc(lead)} ${esc(t(lvl(next.res.verdict) === 'record' || lvl(next.res.verdict) === 'out' ? 'bw.nextHard' : 'bw.nextWhy'))}`; planet = null; }
    else if (moveOn && mw) { verb = t(mw.defend ? 'bw.defend' : 'bw.drop'); target = plain(planetName(mw.p)); why = `${esc(lead)} ${esc(t('bw.still'))} ${planetName(mw.p)}: ${mw.why}`; planet = mw.p; }
    const tag = state === 'out' && !moveOn ? t('callTag.outLong') : t('callTag.' + state);
    return { state, next, mw, moveOn, verb, target, why, tag, planet, suggest: moveOn && !next };
  }
  function callHTML(res, a) {
    const p = directiveParts(res), id = String(a.id), m = callMove(res, p);
    const cx = crossNow();
    const alt = cx && cx.verdict === 'pick' && String(cx.pick) !== id && !res.ended && res.verdict !== 'done' && !m.moveOn ? cx.orders.find(o => o.id === String(cx.pick)) : null;
    // a won order gets one short celebration, the first time this browser sees it won (not at every refresh)
    const party = res.verdict === 'done' && !(ui.celebrated ||= {})[res.id];
    if (party) { ui.celebrated[res.id] = Date.now(); const ids = Object.keys(ui.celebrated); if (ids.length > 30) delete ui.celebrated[ids[0]]; saveUi(); }
    const long = (m.target || '').length > 16;
    const fac = m.planet ? factionOfPlanet(m.planet) : p.fac;
    const facOk = fac && fac !== 'Humans' ? fac : null;
    const exp = Date.parse(a.expiration), medals = medalsOf(a);
    const v = res.verdict, L = lvl(v);
    const left = isFinite(exp) ? (exp - Date.now()) / 3.6e6 : null;
    const lost = res.ended || v === 'failed';
    // won: the time it had to spare when it was won (the fall of its last planet), else the time left now
    const won = m.state === 'done' ? wonBy(res, a) : null, spare = won && isFinite(exp) ? (exp - won.ft) / 3.6e6 : left;
    const clockRow = m.state === 'done' ? `<div><dt>${esc(t('cl.won'))}</dt><dd class="plain">${esc(spare != null && spare > 0 ? fill(t('cl.spare'), { d: hmLeft(spare) }) : t('cl.inTime'))}</dd></div>`
      : res.ended ? `<div><dt>${esc(t('cl.ended'))}</dt><dd class="plain">${esc(isFinite(exp) ? new Date(exp).toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '—')}</dd></div>`
      : `<div class="timer"><dt>${esc(t('timeLeft'))}</dt><dd class="count" data-exp="${exp}" title="${esc(fill(t('endsAt'), { when: isFinite(exp) ? new Date(exp).toLocaleString(locale(), { weekday: 'long', hour: 'numeric', minute: '2-digit' }) : '—' }))}">—</dd><dd class="deadline-date">${esc(isFinite(exp) ? new Date(exp).toLocaleString(locale(), { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "—")}</dd></div>`;
    // the reward: on a won order the medals stand where the planet does; on a lost one they are not earned
    const reward = medals && m.state !== 'done' ? `<div><dt>${esc(t(lost ? 'rewardLost' : 'reward'))}</dt><dd class="reward${lost ? ' lost' : ''}">${medalSvg}<span>${fill(t('medals'), { n: fmt(medals) })}</span></dd></div>` : '';
    const meanwhile = m.state === 'done' && !m.next ? meanwhileHTML() : '';
    // the call's planet as the war table's hologram (also the planet a lost order suggests)
    const ringOf = (pl) => pl && pl.maxHealth ? { frac: Math.max(0, Math.min(1, 1 - (pl.event ? pl.event.health / pl.event.maxHealth : pl.health / pl.maxHealth))), label: t(pl.event ? 'gDef' : 'gLib'), tone: 'lib' } : null;
    const art = m.state === 'done' ? `<div class="holo won" aria-hidden="true">${medalSvg}${medals ? `<b>+${fmt(medals)}</b><span>${esc(t('cl.medals'))}</span>` : ''}</div>`
      : m.moveOn ? (m.mw ? holoPlanet({ ring: ringOf(m.mw.p), planet: m.mw.p, fac: factionOfPlanet(m.mw.p) }, res, t(m.mw.defend ? 'capDef' : res.tasks.some(r => r.planet && String(r.planet.index) === String(m.mw.p.index)) ? 'capBusyIn' : 'capBusy')) : '') : holoPlanet(p, res, null, false);
    // actions: the move first, then one quieter line to pass the call on
    const primary = m.moveOn && m.next ? `<button type="button" class="btn primary" data-otab="${esc(m.next.a.id)}" data-pick>${esc(fill(t('endNextLost'), { title: m.target }))}${ICON.track}</button><button type="button" class="btn ghostly" data-goto="strategy">${esc(t(lost ? 'seeWhy' : 'seeWhyOut'))}${ICON.track}</button>`
      : m.moveOn && m.mw ? `<button type="button" class="btn primary" data-open-planet="${m.mw.p.index}">${esc(t('gCta'))}${ICON.track}</button><button type="button" class="btn ghostly" data-goto="strategy">${esc(t(lost ? 'seeWhy' : 'seeWhyOut'))}${ICON.track}</button>`
      : p.d.kind === 'steady' ? `<button type="button" class="btn primary" data-goto="history">${esc(t('seeProg'))}${ICON.track}</button>`
      : endAction(res, alt);
    // under 6 hours and not safe: the hazard rail crawls, the one motion that means "hurry"
    const urgent = (m.state === 'go' || m.state === 'wait') && isFinite(res.hoursLeft) && res.hoursLeft < 6 && !['done', 'ontrack'].includes(v);
    const go = m.state === 'go' || m.state === 'wait';
    const r = !m.moveOn ? callTarget(res, p) : null, eta = r && isFinite(r.eta) && isFinite(res.hoursLeft) && res.hoursLeft > 0 ? r.eta : null;
    const ends = isFinite(exp) ? new Date(exp).toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
    // the clock rides in the yellow band (7 Nov 2026): the side column is the planet's now
    const barClock = go && isFinite(exp) && !res.ended ? `<span class="call-clock" title="${esc(fill(t('endsAt'), { when: ends }))}"><span class="count" data-exp="${exp}">—</span> ${esc(t('fcb.left'))} · ${esc(fill(t('fcb.ends'), { when: ends }))}</span>` : '';
    const block = go && !m.moveOn ? forecastBlock(res, r, eta, L, v) : '';
    // the hour-by-hour radar takes the hologram's place when the call is a liberation with a forecast
    const proj = go && r && eta != null ? ENGINE.hourlyProjection(r, res.hoursLeft, res.model.N, res.model.C, samples, last.now, record && record.nProfile) : null;
    // the radar's picture stands at the side; its words, and the turnout it asks for, under the forecast
    // (7 Nov 2026: the side had grown twice as tall as the call, leaving a hole under the four numbers)
    const rd = proj && proj.hours.length ? radarHTML(res, r, proj) : null, radar = rd ? rd.dial : '';
    const turnout = rd ? turnoutHTML(res, r, proj) : '';
    // with the forecast's own time on screen the sentence and the turnout bar would say it twice
    const said = !!(block && eta != null);
    const band = dispatchBand(res, a, r);
    return `<section class="call vl-${L} state-${m.state}${alt ? ' not-pick' : ''}${m.suggest ? ' suggest' : ''}${party ? ' celebrate' : ''}${urgent ? ' urgent' : ''}" aria-labelledby="dir-${esc(id)}">
      <i class="rails" aria-hidden="true"></i>
      <div class="call-bar"><span class="call-tag"><i class="live" aria-hidden="true"></i>${esc(m.tag)}${facOk ? ` · <span class="call-front">${factionIcon(facOk)}${fill(t('frontOf'), { f: facName(facOk) })}</span>` : ''}</span>${barClock}</div>
      ${band}
      <div class="call-main">
        ${alt ? `<div class="call-alt" role="note">${ICON.target}<p>${fill(t('xNotPick'), { title: `<b>${esc(alt.title)}</b>` })}</p></div>` : ''}
        <h2 class="call-head${long && !m.moveOn ? ' long' : ''}" id="dir-${esc(id)}">${m.verb ? `<span class="verb"><span class="wings" aria-hidden="true"><i></i><i></i><i></i></span>${esc(m.verb)}</span> ` : ''}<span class="tgt">${esc(m.target)}</span></h2>
        ${p.req && !m.moveOn ? `<p class="req-chip">${ICON.warn}<b>${esc(t('req'))}</b><span>${esc(p.req)}</span></p>` : ''}
        ${block}
        ${turnout}${rd ? rd.text : ''}
        ${said ? '' : `<p class="why">${m.why}</p>`}
        ${m.moveOn || said ? '' : p.meter}
        ${!m.moveOn && go ? migrationHTML(res, m.planet) : ''}
        ${meanwhile}
        <div class="call-actions">${primary}
          ${res.verdict === 'done' ? `<button type="button" class="btn quiet" data-copy="${esc(res.id)}">${ICON.copy}<span>${t('copy')}</span><span class="kcap sm" aria-hidden="true">C</span></button>`
            : `<details class="share-menu"><summary class="btn quiet">${ICON.image}<span>${esc(t('shareMenu'))}</span>${ICON.chev}</summary><div class="sm-list">
              <button type="button" class="sm-item" data-shareimg="${esc(res.id)}">${ICON.image}<span>${esc(t('sh.btn'))}</span><span class="kcap sm" aria-hidden="true">S</span></button>
              <button type="button" class="sm-item" data-copy="${esc(res.id)}">${ICON.copy}<span>${esc(t('copy'))}</span><span class="kcap sm" aria-hidden="true">C</span></button></div></details>`}
        </div>
      </div>
      <div class="call-side">
        ${radar || art}
        ${m.moveOn ? '' : planetBtn(res)}
        ${go ? '' : `<p class="stamp vl-${L}">${ICON[VICON[v] || 'dots']}<span>${esc(t('v.' + v))}</span></p><p class="meaning">${esc(t(v === 'focus' && res.liberation?.close ? 'm.close' : 'm.' + v))}</p>`}
        ${go && reward === '' ? '' : `<dl class="clock">${go ? '' : clockRow}${reward}</dl>`}
        ${customModel() ? `<p class="model-note">${ICON.edit}<span>${esc(t('modelNote'))}</span><button type="button" class="linkish" data-model-reset>${esc(t('modelReset'))}</button></p>` : ''}
        ${logNote(res, a)}
      </div>
    </section>`;
  }
  /* The dispatch band (8 Nov 2026): what just happened to this order, in one line under the bar that stays until
     the next thing happens: the planet whose fall won it (8 Nov: the planet "vanished" from the page when it fell),
     the call that changed and what it was, the order that has just arrived. It rolls in once per browser; with
     reduced motion it is simply there. */
  function fallTime(idx, from) {
    const s = planetSeries(idx), HR = 3.6e6;
    for (let k = s.length - 1; k > 0; k--) {
      if (s[k][1] < 1) return null;
      if (s[k - 1][1] >= 1) continue;
      if (s[k][0] < from) return null;
      const [t0, v0] = s[k - 1];
      // the pace just before, carried on to 100%: the fall happened between the two points
      let rate = null;
      for (let j = k - 2; j >= 0; j--) if (t0 - s[j][0] >= 1.5 * HR) { rate = (v0 - s[j][1]) / (t0 - s[j][0]); break; }
      const est = rate > 0 ? t0 + (1 - v0) / rate : (t0 + s[k][0]) / 2;
      return Math.min(s[k][0], Math.max(t0, est));
    }
    return null;
  }
  // the call's level as this browser last saw it: a change seen live (the page open, or seen in the last 3 hours)
  // is kept with what it was for 12 hours; after a long absence the page does not know when it changed
  function callChange(res, a) {
    const id = String(a.id), L = lvl(res.verdict), calls = (ui.calls ||= {}), was = calls[id], now = last.now;
    if (!last.seeded) {
      if (!was || was.L !== L) {
        calls[id] = was && now - (was.seen || was.t) < 3 * 3.6e6 ? { L, t: now, seen: now, was: was.L } : { L, t: now, seen: now };
        const ids = Object.keys(calls); if (ids.length > 20) delete calls[ids[0]];
        saveUi();
      } else if (now - (was.seen || 0) > 5 * 60e3) { was.seen = now; saveUi(); }
    }
    const c = calls[id];
    // "Too early to call" is not a call: moving to or from it is not a change worth a band
    return c && c.was && c.was !== c.L && c.was !== 'wait' && c.L !== 'wait' && last.now - c.t < 12 * 3.6e6 ? c : null;
  }
  const BAND_ICON = {
    good: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 15V1.5M3.5 2h9l-2 3 2 3h-9" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    warn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 15 14H1Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 6.2v3.8M8 11.4v1.6" stroke="currentColor" stroke-width="1.8"/></svg>',
    new: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2.2"/></svg>',
  };
  // the planet whose fall won the order, and when: only when the planets were the whole order (then the last
  // to fall is the one that won it)
  function wonBy(res, a) {
    const entry = last.results.find(x => x.a === a), exp = Date.parse(a.expiration);
    if (res.verdict !== 'done' || !res.tasks.length || !res.tasks.every(x => x.planet && x.planet.index != null)) return null;
    let best = null;
    for (const x of res.tasks) { const ft = fallTime(x.planet.index, entry?.start || exp - 30 * 24 * 3.6e6); if (ft && !(ft > exp) && (!best || ft > best.ft)) best = { ft, p: x.planet }; }
    return best;
  }
  function dispatchBand(res, a, r) {
    const entry = last.results.find(x => x.a === a), exp = Date.parse(a.expiration), id = String(a.id);
    const hm = (ms) => new Date(ms).toLocaleString(locale(), new Date(ms).toDateString() === new Date(last.now).toDateString() ? { hour: 'numeric', minute: '2-digit' } : { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    let b = null;
    if (res.verdict === 'done') {
      const best = wonBy(res, a);
      if (best) b = { kind: 'good', key: `fell:${id}`, t: best.ft, title: fill(t('band.fell'), { planet: planetName(best.p) }), sub: esc(fill(t(isFinite(exp) ? 'band.fellS' : 'band.fellS0'), { when: hm(best.ft), margin: hmLeft(Math.max(0, exp - best.ft) / 3.6e6) })) };
    } else if (!res.ended) {
      const c = callChange(res, a);
      if (c) {
        const now = r && isFinite(r.eta) && r.planet && res.hoursLeft > 0 ? ' ' + fill(t('band.eta'), { planet: planetName(r.planet), eta: esc(clock(r.eta)) }) : '';
        b = { kind: ['ok', 'done'].includes(c.L) ? 'good' : 'warn', key: `call:${id}:${c.t}`, t: c.t, title: esc(fill(t('band.changed'), { v: t('callLv.' + c.L) })), sub: esc(fill(t('band.was'), { was: t('callLv.' + c.was), when: hm(c.t) })) + now };
      } else if (entry && entry.start && last.now - entry.start < 6 * 3.6e6 && last.now >= entry.start) {
        b = { kind: 'new', key: `new:${id}`, t: entry.start, title: esc(t('band.newT')), sub: esc(fill(t('band.newS'), { when: hm(entry.start), left: durDown(res.hoursLeft) })) };
      }
    }
    if (!b) return '';
    // rolls in the first time this browser shows it (the page renders two or three times in its first second:
    // the roll carries on through them instead of starting again)
    const seen = (ui.bands ||= {});
    if (!seen[b.key]) { seen[b.key] = Date.now(); const ks = Object.keys(seen); if (ks.length > 40) delete seen[ks[0]]; saveUi(); }
    const age = Date.now() - seen[b.key], roll = age < 1400 && !reduced();
    return `<div class="dispatch ${b.kind}${roll ? ' roll' : ''}" role="status"${roll ? ` style="--skip:-${age}ms"` : ''}><div><div class="dp"><span class="dp-ico">${BAND_ICON[b.kind]}</span><p class="dp-t"><b>${b.title}</b><span>${b.sub}</span></p><span class="dp-time">${esc(hm(b.t))}</span></div></div></div>`;
  }
  /* The radar (7 Nov 2026): the call's planet at the centre and the hours until the deadline (24 at most) around
     it as a clock face, 12 at the top and 6 at the bottom; the first 12 hours on the inner ring, the next 12 on the
     outer one; the hand points at now. Each hour's wedge fills to how far the liberation should be by then, and
     its yellow mark is how far it needs to be to make the deadline: blue ahead, red behind. Outside the rings, the
     arc of the forecast's range (8 times in 10 the fall lands inside it), and what is coming at its hour: Heavy
     Ordnance ending, a defense ending, Helldivers usually arriving from another objective. Hover or focus a wedge
     for its numbers (10-share-image.js); the hour's counts follow the daily cycle of players online. */
  const DN_ICON = {
    day: '<svg class="dn-ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="currentColor"/><path d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15M3 3l1.6 1.6M11.4 11.4L13 13M3 13l1.6-1.6M11.4 4.6L13 3" stroke="currentColor" stroke-width="1.5"/></svg>',
    night: '<svg class="dn-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 1.8a6.3 6.3 0 1 0 3.7 10.4A5.2 5.2 0 0 1 10.5 1.8z" fill="currentColor"/></svg>',
  };
  function radarHTML(res, r, proj) {
    // One 24-hour dial (7 Nov 2026, after two rings of 12 h read as "day ring / night ring"): noon at the top,
    // midnight at the bottom, 6 AM left and 6 PM right, so the day is the half above the horizon line and the
    // night the half below it, as in the sky. A day fits in one turn: no hour ever sits on another.
    const S = 380, C = S / 2, RA = 80, RO = 136, gap = 0.008, H = res.hoursLeft;
    const at = (t) => new Date(last.now + t * 3.6e6);
    const ang = (t) => { const d = at(t); return (d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600) / 24 * 2 * Math.PI + Math.PI / 2; };
    const pt = (rad, a) => [C + rad * Math.cos(a), C + rad * Math.sin(a)];
    const f1 = (x) => x.toFixed(1);
    const unwrap = (a1, a2) => a2 <= a1 ? a2 + 2 * Math.PI : a2;
    const sector = (r1, r2, a1, a2) => {
      const big = a2 - a1 > Math.PI ? 1 : 0, [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1);
      return `M${f1(x1)} ${f1(y1)}A${r2} ${r2} 0 ${big} 1 ${f1(x2)} ${f1(y2)}L${f1(x3)} ${f1(y3)}A${r1} ${r1} 0 ${big} 0 ${f1(x4)} ${f1(y4)}Z`;
    };
    const arc = (rad, t0, t1) => { const a1 = ang(t0), a2 = unwrap(a1, ang(t1)), big = a2 - a1 > Math.PI ? 1 : 0, [x1, y1] = pt(rad, a1), [x2, y2] = pt(rad, a2); return `M${f1(x1)} ${f1(y1)}A${rad} ${rad} 0 ${big} 1 ${f1(x2)} ${f1(y2)}`; };
    const hm = (d) => d.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
    const L = 24 - 1e-3;
    // day (6 AM – 6 PM) or night, by the local hour: for the tooltip's sun or moon and the wedge's ground
    const isNight = (tm) => { const hr = at(tm + 1e-4).getHours(); return hr < 6 || hr >= 18; };
    const pl = r.planet, N = res.model.N || 0, gid = 'rd' + String(res.id).replace(/[^\w-]/g, '');
    // what is coming, at its hour
    const ev = [];
    if (r.onDss && last.hod && last.hod.expire) { const tm = (last.hod.expire - last.now) / 3.6e6; if (tm > 0 && tm < proj.span) ev.push({ t: tm, text: t('rd.evHod') }); }
    const mg = res.migration;
    if (mg && mg.to && mg.to.index === pl.index && mg.at > 0 && mg.at < proj.span) ev.push({ t: mg.at, text: fill(t('rd.evMig'), { n: people(mg.players * 0.78), planet: planetName(mg.from) }) });
    for (const x of res.tasks) if (x !== r && x.defense && x.verdict !== 'done' && x.defense.hoursToEnd > 0 && x.defense.hoursToEnd < proj.span && !(mg && mg.defense && mg.from === x.planet)) ev.push({ t: x.defense.hoursToEnd, text: fill(t('rd.evDef'), { planet: planetName(x.planet) }) });
    ev.sort((a, b) => a.t - b.t);
    const tracks = [], wedges = [];
    proj.hours.filter(h => h.t0 < L - 1e-6).forEach((h, i) => {
      const ra = RA, rb = RO, night = isNight(h.t0);
      const a1 = ang(h.t0) + gap, a2 = unwrap(a1, ang(h.t1) - gap), mid = (a1 + a2) / 2;
      const fell = h.lib >= 0.999, behind = h.libNeed != null && h.lib < h.libNeed - 0.002;
      const re = ra + (rb - ra) * Math.max(0.04, h.lib), rn = h.libNeed != null ? ra + (rb - ra) * h.libNeed : null;
      const time = `${i === 0 ? t('fcb.now') : hm(at(h.t0))} – ${hm(at(h.t1))}`;
      const evs = ev.filter(x => x.t >= h.t0 && x.t < h.t1).map(x => `${hm(at(x.t))} · ${plain(x.text)}`).join(' | ');
      const tag = fell ? t('rd.tagFell') : h.libNeed == null ? t('rd.all') : behind ? fill(t('rd.behind'), { n: fmt((h.libNeed - h.lib) * 100, 1) }) : fill(t('rd.ahead'), { n: fmt((h.lib - h.libNeed) * 100, 1) });
      tracks.push(`<path class="rd-track ${night ? 'night' : 'day'}" d="${sector(ra, rb, a1, a2)}"/>`);
      wedges.push(`<g class="rd-w${behind ? ' low' : ''}${fell ? ' fell' : ''}" data-dn="${night ? 'night' : 'day'}" style="--i:${i};--dx:${f1(Math.cos(mid) * 8)}px;--dy:${f1(Math.sin(mid) * 8)}px" data-rw="${i}" tabindex="0" role="img"
        aria-label="${esc(fill(t('rd.hourAria'), { time, lib: pct(h.lib), need: h.libNeed != null ? pct(h.libNeed) : '—', n: people(h.exp) }) + (evs ? '. ' + evs : ''))}"
        data-time="${esc(time)}" data-lib="${esc(pct(h.lib))}" data-need="${esc(h.libNeed != null ? pct(h.libNeed) : '—')}" data-n="${esc(N ? people(h.exp) : '—')}" data-tag="${esc(tag)}" data-low="${behind ? 1 : 0}" data-ev="${esc(evs)}"
        data-x="${f1(pt(rb + 12, mid)[0] / S * 100)}" data-y="${f1(pt(rb + 12, mid)[1] / S * 100)}">
        <path class="rd-fill" d="${sector(ra, re, a1, a2)}"/>${rn != null ? `<path class="rd-need" d="M${f1(pt(rn, a1)[0])} ${f1(pt(rn, a1)[1])}A${rn} ${rn} 0 0 1 ${f1(pt(rn, a2)[0])} ${f1(pt(rn, a2)[1])}"/>` : ''}<path class="rd-hit" d="${sector(ra, rb + 4, a1, a2)}"/></g>`);
    });
    // the forecast's range, outside the rings: the part past the deadline in red
    const band = proj.band, RB = 146;
    let bandSvg = '';
    if (band && band.lo < proj.span) {
      const lo = Math.max(0.02, band.lo), hi = Math.min(band.hi, proj.span - 0.01, L - 0.01);
      if (hi > lo) bandSvg += `<path class="rd-band" d="${arc(RB, lo, Math.min(hi, H))}"/>`;
      if (band.hi > H && H < proj.span + 0.01 && H > lo) bandSvg += `<path class="rd-band late" d="${arc(RB, H, Math.min(band.hi, Math.max(H + 0.05, proj.span >= H ? Math.min(band.hi, L - 0.01) : proj.span)))}"/>`;
    }
    const tick = (tm, cls) => { if (!(tm >= 0 && tm <= Math.min(L, proj.span) + 1e-6)) return ''; const a = ang(tm), [x1, y1] = pt(RA - 4, a), [x2, y2] = pt(RB + 6, a); return `<line class="${cls}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`; };
    const dia = (tm, cls) => { if (!(tm >= 0 && tm < L)) return ''; const [x, y] = pt(RB, ang(tm)); return `<rect class="${cls}" x="${f1(x - 6)}" y="${f1(y - 6)}" width="12" height="12" transform="rotate(45 ${f1(x)} ${f1(y)})"/>`; };
    const evMarks = ev.filter(x => x.t < L).map(x => { const [cx, cy] = pt(RO + 4, ang(x.t)); return `<circle class="rd-ev" cx="${f1(cx)}" cy="${f1(cy)}" r="4"/>`; }).join('');
    // the sky: the sun over noon, the moon under midnight, sunrise and sunset at the ends of the horizon
    const hr = (n) => { const d = new Date(last.now); d.setHours(n, 0, 0, 0); return d.toLocaleTimeString(locale(), { hour: 'numeric' }); };
    const RD = RB + 10, stars = [[100, 158], [118, 150], [135, 157], [62, 153], [80, 151], [45, 158]].map(([deg, rr]) => { const [x, y] = pt(rr, deg * Math.PI / 180); return `<circle class="rd-star" cx="${f1(x)}" cy="${f1(y)}" r="1.1"/>`; }).join('');
    const sky = `<path class="rd-sky day" d="M${C - RD} ${C}A${RD} ${RD} 0 0 1 ${C + RD} ${C}Z"/><path class="rd-sky night" d="M${C + RD} ${C}A${RD} ${RD} 0 0 1 ${C - RD} ${C}Z"/>${stars}<line class="rd-horizon" x1="${C - RD - 4}" y1="${C}" x2="${C + RD + 4}" y2="${C}"/>`;
    const nums = `<g class="rd-sun" transform="translate(${C - 10} ${C - RD - 22}) scale(1.25)">${DN_ICON.day.replace(/<\/?svg[^>]*>/g, '')}</g><g class="rd-moon" transform="translate(${C - 10} ${C + RD + 2}) scale(1.25)">${DN_ICON.night.replace(/<\/?svg[^>]*>/g, '')}</g>`
      + `<text class="rd-num" x="${f1(C - RD - 2)}" y="${C - 7}" style="text-anchor:end">${esc(hr(6))}</text><text class="rd-num" x="${f1(C + RD + 2)}" y="${C - 7}" style="text-anchor:start">${esc(hr(18))}</text>`;
    const [hx, hy] = pt(RB + 4, ang(0)), [hx0, hy0] = pt(70, ang(0));
    const frac = Math.max(0, Math.min(1, 1 - pl.health / pl.maxHealth)), fc = FAC_VAR[factionOfPlanet(pl)] || 'var(--fg)';
    const hi = band && band.hi > H ? band.hi : null;
    // close only when the verdict says so (8 Nov 2026: with a 95% chance the call said "On track" while the radar
    // said "Every hour counts... the order fails", because its slow end alone fell after the deadline)
    const key = !isFinite(proj.need0) ? 'all' : r.eta > H ? 'late' : r.close ? 'close' : 'ok';
    const P = { planet: planetName(pl), when: esc(clock(r.eta)), margin: esc(dur(Math.max(0, H - r.eta))), safe: '' };
    // the same figures as the gauge under the forecast
    const nd = callNeed(res, r, proj), mn = nd.min != null && isFinite(nd.min) ? nd.min : proj.need0;
    P.need = people(mn * N); P.more = people(Math.max(0, mn - r.share) * N);
    if (key === 'close' && nd.safe != null && isFinite(nd.safe) && nd.safe > mn + 0.005) P.safe = fill(t('rd.closeSafe'), { s: people(nd.safe * N) });
    const warn = key === 'close' ? `<div class="rd-warn" tabindex="0"><p class="rd-warn-h"><i aria-hidden="true"></i><span>${esc(t('rd.warnT'))}</span><span class="rd-why" aria-hidden="true">${esc(t('rd.why'))} ▾</span></p><div class="rd-more"><div><p>${fill(t('rd.warnB'), { ...P, hi: esc(clock(hi != null ? hi : r.eta)) })}</p></div></div></div>` : '';
    const coming = ev.length ? `<ul class="rd-events">${ev.slice(0, 3).map(x => `<li><b>${esc(hm(at(x.t)))}</b><span>${x.text}</span></li>`).join('')}</ul>` : '';
    const dial = `<div class="cradar" style="--fc:${fc}">
      <div class="rd-box">
        <svg viewBox="0 0 ${S} ${S}" role="group" aria-label="${esc(t('rd.aria'))}">
          <defs><radialGradient id="${gid}" cx="34%" cy="30%" r="80%"><stop offset="0" class="g-s0"/><stop offset=".55" class="g-s1"/><stop offset="1" class="g-s2"/></radialGradient></defs>
          <circle class="rd-dial" cx="${C}" cy="${C}" r="${RD}"/>
          ${sky}
          ${tracks.join('')}
          <g class="rd-sweep" aria-hidden="true"><path d="${sector(RA, RO, ang(0), ang(0) + 0.26)}"/></g>
          ${wedges.join('')}
          ${bandSvg}${tick(H, 'rd-end')}${evMarks}${dia(r.eta, 'rd-fall')}${hi != null ? dia(hi, 'rd-slow') : ''}
          <line class="rd-hand" x1="${f1(hx0)}" y1="${f1(hy0)}" x2="${f1(hx)}" y2="${f1(hy)}"/><circle class="rd-hand-tip" cx="${f1(hx)}" cy="${f1(hy)}" r="3.5"/>
          <circle cx="${C}" cy="${C}" r="68" class="rd-arc-track"/><circle cx="${C}" cy="${C}" r="68" class="rd-arc" pathLength="100" transform="rotate(-90 ${C} ${C})" style="stroke-dasharray:${f1(frac * 100)} 100"/>
          <circle cx="${C}" cy="${C}" r="58" fill="url(#${gid})" class="rd-planet"/>
          <text class="rd-pct" x="${C}" y="${C + 5}">${pct(frac)}</text><text class="rd-lbl" x="${C}" y="${C + 24}">${esc(t('gLib'))}</text>
          ${nums}
        </svg>
        <div class="rd-tip" hidden></div>
      </div>
      <ul class="rd-key" aria-hidden="true"><li><i class="k-w"></i>${esc(t('rd.lgExp'))}</li><li><i class="k-n"></i>${esc(t('rd.lgNeed'))}</li><li><i class="k-f"></i>${esc(t('rd.lgBand'))}</li><li><i class="k-h"></i>${esc(t('rd.lgNow'))}</li></ul>
    </div>`;
    // "On course all the way" only said again what the verdict and the time line say (8 Nov 2026): the words
    // stand under the forecast only when they add something, a close call, a shortfall or an hour to watch
    const text = key === 'ok' && !warn && !coming ? '' : `<div class="rd-text">
        <span class="rd-k">${esc(t(proj.span < H ? 'rd.k24' : 'rd.k'))}</span>
        <h3 class="rd-h rd-${key}">${esc(t('rd.' + key + 'T'))}</h3>
        <p class="rd-s">${fill(t('rd.' + key + 'S'), P)}</p>
        ${warn}${coming}
      </div>`;
    return { dial, text };
  }
  // the Helldivers on the planet against the Helldivers it needs, as a gauge of everyone online (the Plan's)
  // Helldivers there now against the fewest that still make the deadline and, on a close call, the number that
  // stays in time even at the slow end of the forecast. One gauge for the call and the Plan (8 Nov 2026: they
  // said 12,800, 25,900 and 31,500 "needed" for the same planet).
  function turnoutGauge(key, there, N, minS, safeS, cls = '') {
    if (!(N > 0) || !(there >= 0)) return '';
    const mn = minS != null && isFinite(minS) && minS > 0 ? Math.min(1, minS) : null;
    const sf = safeS != null && isFinite(safeS) && (mn == null || safeS > mn + 0.005) ? Math.min(1, safeS) : null;
    if (mn == null && sf == null) return '';
    const now = Math.min(1, there / N), state = mn != null && now < mn ? ' short' : sf != null && now < sf ? ' tight' : '';
    const aria = fill(t('planVisual.gaugeAria'), { now: people(there), need: mn != null ? people(mn * N) : people(sf * N) }) + (sf != null && mn != null ? fill(t('planVisual.gaugeSafe'), { s: people(sf * N) }) : '');
    const mark = (v, c) => `<i class="mvg-need${c}" style="left:${(v * 100).toFixed(2)}%"></i>`;
    const num = (v, k) => `<span><b class="yellow">${people(v * N)}</b> ${esc(fill(t(k), { p: pct(v) }))}</span>`;
    return `<div class="mv-gauge${cls}" role="img" aria-label="${esc(aria)}">
      <div class="mvg-scale" aria-hidden="true"><span>${esc(t('planVisual.everyone'))}</span><span>100%</span></div>
      <div class="mvg-bar" aria-hidden="true"><i class="mvg-now${state}" data-w="${(now * 100).toFixed(2)}" data-key="${esc(key)}" style="width:${(now * 100).toFixed(2)}%"></i>${mn != null ? mark(mn, '') : ''}${sf != null ? mark(sf, ' safe') : ''}</div>
      <div class="mvg-nums" aria-hidden="true"><span><b class="blue">${people(there)}</b> ${esc(fill(t('planVisual.thereNow'), { p: pct(now) }))}</span>${mn != null ? num(mn, 'planVisual.minimum') : ''}${sf != null ? num(sf, 'planVisual.safe') : ''}</div></div>`;
  }
  // the share of everyone the call needs on its planet: the fewest that make it, and on a close call the share
  // that is safe. With more planets after it, the plan's figure (it leaves time for the rest), as the Plan shows.
  function callNeed(res, r, proj) {
    const mv = (res.recs || []).find(m => m.kind === 'libFocus' && m.planet === r.planet && (m.remaining || 1) > 1);
    if (mv) return { min: mv.minShare ?? (mv.safe ? null : mv.share), safe: mv.safe ? mv.share : null };
    const safe = r.close ? ENGINE.safeShare(r, res.hoursLeft, res.model.C, samples, last.now) : null;
    return { min: proj.need0, safe };
  }
  function turnoutHTML(res, r, proj) {
    const N = res.model.N || 0;
    if (!N || !(r.share > 0) || !isFinite(proj.need0)) return '';
    const nd = callNeed(res, r, proj);
    return turnoutGauge('cg:' + res.id, r.share * N, N, nd.min, nd.safe, ' call-gauge');
  }
  // the liberation the call points at (its planet among the order's targets)
  function callTarget(res, p) {
    const pl = p.d && p.d.kind === 'liberate' ? p.d.planet : null;
    return pl ? res.tasks.find(x => x.pw && x.planet && x.planet.index === pl.index) || null : null;
  }
  // The forecast as the call reads it (7 Nov 2026): the verdict, then the time the planet falls in big type,
  // a time line from now to the deadline, and four numbers players can act on.
  function forecastBlock(res, r, eta, L, v) {
    const meaning = esc(t(v === 'focus' && res.liberation?.close ? 'm.close' : 'm.' + v));
    const chip = `<span class="fcb-v">${ICON[VICON[v] || 'dots']}<span>${esc(t('v.' + v))}</span></span>`;
    if (eta == null) return `<div class="fcb vl-${L}">${chip}<div class="fcb-body"><p class="fcb-mean">${meaning}</p></div></div>`;
    const H = res.hoursLeft, late = eta > H, pl = r.planet;
    const head = `<div class="fcb vl-${L}">${chip}<div class="fcb-body"><span class="fcb-k">${esc(t(late ? 'fcb.late' : 'fcb.when'))}</span><b class="fcb-t">${esc(clock(eta))}</b><p class="fcb-mean">${meaning}</p></div></div>`;
    const span = Math.max(H, eta), fx = eta / span * 100, dx = H / span * 100;
    const dayT = (ms) => new Date(ms).toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    const nowT = dayT(last.now), endT = dayT(last.now + H * 3.6e6);
    // labels that would collide are left out (the marks and the aria-label still say it all)
    const near = Math.abs(fx - dx) < 16, early = fx < 30, two = dx < 72;
    const line = `<div class="ftl${late ? ' late' : ''}" role="img" aria-label="${esc(fill(t('fcb.lineAria'), { now: nowT, fall: clock(eta), end: clock(H) }))}">
      <div class="ftl-track"><i class="ftl-run" style="width:${fx.toFixed(1)}%"></i><i class="ftl-now"></i><i class="ftl-fall" style="left:${fx.toFixed(1)}%"></i><i class="ftl-end" style="left:${dx.toFixed(1)}%"></i></div>
      <div class="ftl-lab${two ? ' two' : ''}" aria-hidden="true"><span class="ftl-l-now">${esc(t('fcb.now'))} · ${esc(nowT)}</span>${near || early ? '' : `<span class="ftl-l-fall" style="left:${fx.toFixed(1)}%">${esc(t(late ? 'fcb.fallLate' : 'fcb.fall'))}</span>`}<span class="ftl-l-end" style="left:${dx.toFixed(1)}%">${esc(t('fcb.end'))} · ${esc(endT)}</span></div></div>`;
    const left = Math.max(0, pl.health / pl.maxHealth);
    const pace = left / eta * 100, need = left / H * 100, N = res.model.N || 0;
    const pp = (x) => fmt(x, x < 10 ? 1 : 0) + '%';
    const tiles = [
      [t('fcb.pace'), `+${pp(pace)}<small>/h</small>`, 'blue', t('fcb.paceTip'), momentumHTML(pl)],
      [t('fcb.need'), `${pp(need)}<small>/h</small>`, '', t('fcb.needTip')],
      r.chance != null ? [t('fcb.chance'), r.chance >= 0.95 ? '95%+' : r.chance < 0.05 ? '&lt;5%' : Math.round(r.chance * 20) * 5 + '%', '', t('s.chanceTip')] : null,
      N ? [t('fcb.there'), people(r.share * N), '', ''] : null,
    ].filter(Boolean);
    return head + line + `<div class="fcb-tiles">${tiles.map(([k, val, cls, tip, mom]) => `<div class="fcb-tile ${cls}"${tip ? ` title="${esc(tip)}"` : ''}><span>${esc(k)}${mom || ''}</span><b>${val}</b></div>`).join('')}</div>`;
  }
  /* Momentum (8 Nov 2026): the liberation the planet gained in the last 3 hours against the 6 before, from the
     recorded series. No day/night correction: a planet's pace follows its share of everyone online, so the night
     empties it no more than the others (8 Nov: Achernar Secundus held 3.5%/h while its Helldivers fell from 41,000
     to 24,000 overnight); a change here means Helldivers coming to the planet or leaving it. Within ±10% it is
     steady; with under 9 hours recorded, a gap, or hardly any pace before, nothing is said. */
  function momentumOf(pl) {
    if (!pl || pl.event || (pl.currentOwner === 'Humans')) return null;
    const s = planetSeries(pl.index), now = last.now, HR = 3.6e6;
    if (s.length < 6 || s[0][0] > now - 9 * HR + 6e5) return null;
    const at = (tm) => {
      let k = s.findIndex(x => x[0] >= tm);
      if (k < 0) return null;
      if (k === 0) return s[0][1];
      const [t0, v0] = s[k - 1], [t1, v1] = s[k];
      return t1 - t0 > 1.5 * HR ? null : v0 + (v1 - v0) * (tm - t0) / (t1 - t0);
    };
    const v = Array.from({ length: 10 }, (_, i) => at(now - (9 - i) * HR));
    if (v.some(x => x == null)) return null;
    const before = (v[6] - v[0]) / 6, recent = (v[9] - v[6]) / 3;
    if (!(before > 0.002)) return null;
    const ch = recent / before - 1;
    return { ch, recent, before, hours: v.slice(1).map((x, i) => x - v[i]), dir: ch >= 0.1 ? 'up' : ch <= -0.1 ? 'down' : 'flat' };
  }
  const MOM_ICON = {
    up: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 11l5-6 5 6"/></svg>',
    down: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5l5 6 5-6"/></svg>',
    flat: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M10 5l3 3-3 3"/></svg>',
  };
  // on the pace's label line (no taller tile); its numbers and the last 9 hours open on hover or focus
  function momentumHTML(pl) {
    const m = momentumOf(pl);
    if (!m) return '';
    const p1 = (x) => fmt(x * 100, 1) + '%', top = Math.max(...m.hours, 1e-6);
    const word = t('mom.' + m.dir), ch = (m.ch > 0 ? '+' : '−') + fmt(Math.abs(m.ch) * 100, 0) + '%';
    const say = fill(t('mom.s' + m.dir), { r: p1(m.recent), b: p1(m.before), ch });
    return `<span class="mom ${m.dir}" tabindex="0" aria-label="${esc(word + '. ' + say)}">${MOM_ICON[m.dir]}<span class="mom-w" aria-hidden="true">${esc(word)}</span>
      <span class="mom-pop" role="tooltip" aria-hidden="true"><span class="mp-s"><b>${esc(word)}.</b> ${esc(say)}</span>
      <span class="mp-bars">${m.hours.map((x, i) => `<i class="${i > 5 ? 'r' : ''}" style="height:${Math.max(4, x / top * 100).toFixed(0)}%"></i>`).join('')}</span>
      <span class="mp-ax"><span>${esc(t('mom.ago'))}</span><span>${esc(t('fcb.now'))}</span></span></span></span>`;
  }
  // something new in the command log for this order: said beside the call, one click from the log
  // (critique 1 Nov 2026: a hand-made change only showed as a badge on a tab far below)
  function logNote(res, a) {
    const entry = last.results.find(x => x.a === a);
    if (!entry) return '';
    const ic = intelCount(entry);
    return ic.n ? `<button type="button" class="log-note ${ic.level}" data-goto="intel">${ICON.warn}<span>${esc(fill(t(ic.n === 1 ? 'logNote1' : 'logNoteN'), { n: ic.n }))}</span>${ICON.track}</button>` : '';
  }

  const medalsOf = (a) => (a.rewards && a.rewards.length ? a.rewards : [a.reward]).filter(Boolean).reduce((s, x) => s + (x.type === 1 ? Number(x.amount) : 0), 0);

