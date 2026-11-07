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
    const clockRow = m.state === 'done' ? `<div><dt>${esc(t('cl.won'))}</dt><dd class="plain">${esc(left != null && left > 0 ? fill(t('cl.spare'), { d: durDown(left) }) : t('cl.inTime'))}</dd></div>`
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
    // with the forecast's own time on screen the sentence and the turnout bar would say it twice
    const said = !!(block && eta != null);
    return `<section class="call vl-${L} state-${m.state}${alt ? ' not-pick' : ''}${m.suggest ? ' suggest' : ''}${party ? ' celebrate' : ''}${urgent ? ' urgent' : ''}" aria-labelledby="dir-${esc(id)}">
      <i class="rails" aria-hidden="true"></i>
      <div class="call-bar"><span class="call-tag"><i class="live" aria-hidden="true"></i>${esc(m.tag)}${facOk ? ` · <span class="call-front">${factionIcon(facOk)}${fill(t('frontOf'), { f: facName(facOk) })}</span>` : ''}</span>${barClock}</div>
      <div class="call-main">
        ${alt ? `<div class="call-alt" role="note">${ICON.target}<p>${fill(t('xNotPick'), { title: `<b>${esc(alt.title)}</b>` })}</p></div>` : ''}
        <h2 class="call-head${long && !m.moveOn ? ' long' : ''}" id="dir-${esc(id)}">${m.verb ? `<span class="verb"><span class="wings" aria-hidden="true"><i></i><i></i><i></i></span>${esc(m.verb)}</span> ` : ''}<span class="tgt">${esc(m.target)}</span></h2>
        ${p.req && !m.moveOn ? `<p class="req-chip">${ICON.warn}<b>${esc(t('req'))}</b><span>${esc(p.req)}</span></p>` : ''}
        ${block}
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
        ${art}
        ${m.moveOn ? '' : planetBtn(res)}
        ${go ? '' : `<p class="stamp vl-${L}">${ICON[VICON[v] || 'dots']}<span>${esc(t('v.' + v))}</span></p><p class="meaning">${esc(t(v === 'focus' && res.liberation?.close ? 'm.close' : 'm.' + v))}</p>`}
        ${go && reward === '' ? '' : `<dl class="clock">${go ? '' : clockRow}${reward}</dl>`}
        ${customModel() ? `<p class="model-note">${ICON.edit}<span>${esc(t('modelNote'))}</span><button type="button" class="linkish" data-model-reset>${esc(t('modelReset'))}</button></p>` : ''}
        ${logNote(res, a)}
      </div>
    </section>`;
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
    const nowT = new Date(last.now).toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    // labels that would collide are left out (the marks and the aria-label still say it all)
    const near = Math.abs(fx - dx) < 16, early = fx < 30;
    const line = `<div class="ftl${late ? ' late' : ''}" role="img" aria-label="${esc(fill(t('fcb.lineAria'), { now: nowT, fall: clock(eta), end: clock(H) }))}">
      <div class="ftl-track"><i class="ftl-run" style="width:${fx.toFixed(1)}%"></i><i class="ftl-now"></i><i class="ftl-fall" style="left:${fx.toFixed(1)}%"></i><i class="ftl-end" style="left:${dx.toFixed(1)}%"></i></div>
      <div class="ftl-lab" aria-hidden="true"><span class="ftl-l-now">${esc(t('fcb.now'))} · ${esc(nowT)}</span>${near || early ? '' : `<span class="ftl-l-fall" style="left:${fx.toFixed(1)}%">${esc(t(late ? 'fcb.fallLate' : 'fcb.fall'))}</span>`}<span class="ftl-l-end" style="left:${dx.toFixed(1)}%">${esc(t('fcb.end'))}</span></div></div>`;
    const left = Math.max(0, pl.health / pl.maxHealth);
    const pace = left / eta * 100, need = left / H * 100, N = res.model.N || 0;
    const pp = (x) => fmt(x, x < 10 ? 1 : 0) + '%';
    const tiles = [
      [t('fcb.pace'), `+${pp(pace)}<small>/h</small>`, 'blue', t('fcb.paceTip')],
      [t('fcb.need'), `${pp(need)}<small>/h</small>`, '', t('fcb.needTip')],
      r.chance != null ? [t('fcb.chance'), r.chance >= 0.95 ? '95%+' : r.chance < 0.05 ? '&lt;5%' : Math.round(r.chance * 20) * 5 + '%', '', t('s.chanceTip')] : null,
      N ? [t('fcb.there'), people(r.share * N), '', ''] : null,
    ].filter(Boolean);
    return head + line + `<div class="fcb-tiles">${tiles.map(([k, val, cls, tip]) => `<div class="fcb-tile ${cls}"${tip ? ` title="${esc(tip)}"` : ''}><span>${esc(k)}</span><b>${val}</b></div>`).join('')}</div>`;
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

