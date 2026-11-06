  /* ---------- errors ---------- */
  const embedded = (() => { try { return window.top !== window.self; } catch { return true; } })();
  function renderErrors(errs) {
    if (!errs.length) { $('errors').innerHTML = ''; return; }
    const blocked = errs.some(e => /failed to fetch|networkerror|load failed|blocked/i.test(e));
    const help = blocked ? `<div class="help"><p><b>${esc(t('helpTitle'))}</b></p><ol>
        ${embedded ? `<li>${esc(t('helpPreview'))}</li>` : ''}
        ${location.protocol === 'file:' ? `<li>${esc(t('helpBrowser'))}</li>` : `<li>${esc(t('helpOnline'))}</li>`}<li>${esc(t('helpBlocker'))}</li>
        <li>${esc(t('helpTest'))} <a href="${esc(apiUrl('/api/v1/war'))}" target="_blank" rel="noopener">${esc(API)}/api/v1/war</a></li></ol></div>` : '';
    $('errors').innerHTML = `<div class="err" role="alert"><p class="err-h">${esc(t('errApiH'))}</p><p>${esc(t('errApi'))} <button type="button" class="linkish" data-retry>${esc(t('retry'))}</button></p>${help}<details class="tech"><summary>${esc(t('techDetails'))}</summary><pre>${esc([...new Set(errs)].join('\n') + (lastStack ? '\n' + lastStack : ''))}</pre></details></div>`;
  }

  /* ---------- what one mission is worth ----------
     The game splits the war's damage among everyone playing (the impact multiplier falls as more missions are
     won), so estimate a mission's average worth from observed HP lost per mission, per unit
     of multiplier (the recorder's "inf"), times the multiplier right now, times the planet's boosts. */
  function missionWorth(p) {
    if (!last || !p || !last.imp || (!p.event && p.currentOwner === 'Humans')) return null;
    const inf = Number.isFinite(last.inf) && last.inf > 0 ? last.inf : 100, here = last.dssIdx != null && String(last.dssIdx) === String(p.index);
    const boost = (here ? 1 + settings.dssBonus : 1) * (last.hod ? (here ? settings.hodMult : ENGINE.DEFAULTS.hodOther) : 1);
    const hp = inf * last.imp * boost;
    const max = p.event ? p.event.maxHealth : p.maxHealth, h = p.event ? p.event.health : p.health;
    if (!(hp > 0) || !Number.isFinite(hp) || !(max > 0) || !Number.isFinite(max) || !Number.isFinite(h)) return null;
    const evidence = last.infMeasurement;
    const measured = evidence?.source === 'measured' && evidence.value === inf && evidence.samples >= 10;
    // Open regions have their own health and capture bonus: a planet-only total is misleading.
    const hasRegions = !p.event && (p.regions || []).some(r => r && r.isAvailable && r.health > 0);
    return { hp, frac: hp / max, per1: Math.max(1, Math.round(0.01 * max / hp)), left: hasRegions ? null : Math.max(0, Math.ceil(h / hp)),
      vsDay: last.impDay ? last.imp / last.impDay : null, defend: !!p.event, measured };
  }
  // a tiny percentage, to two significant figures (0.00035%), never rounded to 0
  // an estimate shown to two significant figures: 129,134 → 130k, 3,228 → 3,200
  const nice = (n) => { if (!isFinite(n)) return '—'; if (n < 1000) return fmt(Math.round(n)); const r = Number(n.toPrecision(2)); return r >= 1e6 ? fmt(r / 1e6, 1) + 'M' : r >= 1e4 ? fmt(r / 1e3) + 'k' : fmt(r); };
  const tinyPct = (f) => { const v = f * 100; return (v >= 0.01 ? v.toFixed(2) : v.toPrecision(2)) + '%'; };
  function missionLine(p) {
    const w = missionWorth(p);
    if (!w) return '';
    // one quiet line under the turnout: a detail for the curious, not a headline (owner, 2 Nov 2026)
    return `<p class="mworth"${w.measured ? ' data-measured' : ''}>${esc(t(w.measured ? 'worth.measured' : 'worth.default'))} ${fill(t('worth.line'), { m: `<b>+${tinyPct(w.frac)}</b>`, op: `+${tinyPct(w.frac * 3)}`, n: nice(w.per1), left: nice(w.left), goal: esc(t(w.defend ? 'worth.hold' : 'worth.free')) })}${w.left != null ? ' ' + fill(t(w.defend ? 'worth.remainingDefense' : 'worth.remaining'), { n: nice(w.left) }) : ''} <button type="button" class="linkish" data-faq="worth">${esc(t('worth.how'))}</button></p>`;
  }

  /* ---------- small components ---------- */
  const ICON = {
    seaf: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 5a4 4 0 0 1 8 0H2ZM3 5v2a3 3 0 0 0 6 0V5M2 11l1-2h6l1 2M6 1v3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    image: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.2" y="2" width="9.6" height="8" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 9l2.6-3 2 2 1.4-1.4L10 9" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="4.4" r=".9" fill="currentColor"/></svg>',
    check: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="2"/></svg>',
    target: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="6" r="1.2" fill="currentColor"/></svg>',
    warn: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5L11 10.5H1z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 5v2.5" stroke="currentColor" stroke-width="1.6"/></svg>',
    cross: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="2"/></svg>',
    dots: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/></svg>',
    copy: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 2H1.5v6.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    chev: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    up: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10V2M2.5 5.5L6 2l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    down: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2.5 6.5L6 10l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    shield: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1l4.5 1.6v3.2C10.5 8.4 8.6 10.3 6 11 3.4 10.3 1.5 8.4 1.5 5.8V2.6z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    regen: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M10 6a4 4 0 1 1-1.2-2.9M10 1.5v2.4H7.6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    edit: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 10l.6-2.6L8.2 1.8l2 2-5.6 5.6zM7 3l2 2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    fx: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1l1.3 3.7L11 6 7.3 7.3 6 11 4.7 7.3 1 6l3.7-1.3z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    trophy: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1.5h5v3a2.5 2.5 0 0 1-5 0zM3.5 2.5H1.5c0 1.6.8 2.6 2.2 2.8M8.5 2.5h2c0 1.6-.8 2.6-2.2 2.8M6 7v2M4 10.5h4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    box: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 3.5L6 1.5l4.5 2v5L6 10.5l-4.5-2zM1.5 3.5L6 5.5l4.5-2M6 5.5v5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    flag: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 11V1.5M2.5 2h7l-1.6 2.2L9.5 6.5h-7" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    news: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 3.5L9 1v10L1.5 8.5zM9 4.5h1.5v3H9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    data: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><ellipse cx="6" cy="3" rx="4" ry="1.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 3v6c0 .9 1.8 1.6 4 1.6s4-.7 4-1.6V3M2 6c0 .9 1.8 1.6 4 1.6S10 6.9 10 6" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    lens: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><circle cx="5" cy="5" r="3.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7.5 7.5L11 11" stroke="currentColor" stroke-width="1.6"/></svg>',
    track: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 6h8M6.5 2.8 9.7 6 6.5 9.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  };
  // One scale for every call on the page (critique 1 Nov 2026: about ten labels in three colours, and the same
  // state called "Long shot" in yellow in one panel and "Nearly impossible" in red in another). Five steps, each
  // with its own colour and icon: Done, On track, Needs a push, Needs a record, Out of reach; "Too early to
  // call" sits outside the scale. The engine keeps its finer verdicts; only what the page shows is collapsed.
  const LVL = { done: 'done', ontrack: 'ok', planet: 'ok', effort: 'push', focus: 'push', hard: 'record', record: 'record', nearly_impossible: 'out', impossible: 'out', failed: 'out', unknown: 'wait' };
  const LICON = { done: 'check', ok: 'track', push: 'plus', record: 'warn', out: 'cross', wait: 'dots' };
  const lvl = (v) => LVL[v] || 'wait';
  const VICON = Object.fromEntries(Object.keys(LVL).map(v => [v, LICON[lvl(v)]]));
  // the call an objective shows, the same in every panel (critique 1 Nov 2026: the Progress tab said
  // "On track" where the races said "Needs a push"): over and missed is Failed, on track only if players
  // switch over is a push
  const raceVerdict = (r, res) => res.ended && r.verdict !== 'done' ? 'failed' : r.verdict === 'ontrack' && r.freed ? 'effort' : r.verdict;
  const pill = (v, label) => `<span class="pill vl-${lvl(v)}">${ICON[VICON[v] || 'dots']}<span>${esc(label || t('v.' + v))}</span></span>`;
  function gameIcon(key, classes = '') {
    const asset = GAME.icons?.[key];
    return asset ? '<img class="game-icon ' + esc(classes) + '" src="' + esc(asset.src) + '" alt="" aria-hidden="true" decoding="async">' : '';
  }
  const factionIcon = faction => gameIcon('faction-' + faction, 'faction-icon');
  const medalSvg = gameIcon('medal', 'medal');
  function stratagemIcon(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('maxigun')) return gameIcon('stratagem-maxigun', 'stratagem-icon');
    if (/^resupply$/.test(n)) return gameIcon('stratagem-resupply', 'stratagem-icon');
    if (/^eagle airstrike$/.test(n)) return gameIcon('stratagem-eagle-airstrike', 'stratagem-icon');
    return '';
  }
  function taskGameIcon(r) {
    if (r.task.type === 2 && r.task.itemId) {
      const match = itemName(r.task.itemId).match(/\b(common|rare|super) samples?\b/i);
      if (match) return gameIcon('sample-' + match[1].toLowerCase(), 'sample-icon');
    }
    return factionIcon(r.task.faction || factionOfPlanet(r.planet));
  }


  // "Common Sample" -> "Common Samples" when there are several (the item lists name one)
  const pluralItem = (name, n) => n === 1 || !name ? name : /sample$/i.test(name) ? name + 's' : name;
  // What an objective counts, precisely, for labels and sentences ("Radical kills", "Common Samples from
  // Automaton worlds"): the enemy, item and faction the objective names, never a generic "Automaton kills"
  // when it asks for one kind of enemy (1 Nov 2026: a Cyborg Radicals order showed as "Automaton kills").
  function taskNoun(tk) {
    if (!tk) return '';
    const fac = tk.faction && tk.faction !== 'Humans' ? tk.faction : null;
    const item = tk.itemId ? esc(itemName(tk.itemId)) : '';
    switch (tk.type) {
      case 3: {
        const who = tk.enemyId ? (enemyKnown(tk.enemyId) ? esc(enemyOne(tk.enemyId)) : null) : fac ? facName(fac) : '';
        if (who === null) return fill(t('nKillsUnit'), { f: fac ? facName(fac) : t('enemy') }) + (item ? ` ${t('with')} ${item}` : '');
        return fill(t(who ? 'nKills' : 'nKillsAny'), { who }) + (item ? ` ${t('with')} ${item}` : '');
      }
      case 2: return (item ? esc(pluralItem(itemName(tk.itemId), 2)) : capFirst(t('samples'))) + (fac ? ' ' + fill(t('fromFac'), { f: facName(fac) }) : '');
      case 6: return fill(t('nUses'), { item: item || t('itemAny') });
      case 10: return fill(t('nDonations'), { item: item || t('resources') });
      default: return capFirst(facWhat(fac, tk.type));
    }
  }
  // One colour per planet, the same in every tab (critique 1 Nov 2026: Fury was red in Objectives and blue
  // in the Plan): its faction's colour, in a lighter or darker shade when the order has several planets of
  // that faction, in a fixed order (by planet number) so a planet keeps its shade as the plan changes.
  const SHADES = [(c) => c, (c) => `color-mix(in oklab, ${c} 62%, #fff)`, (c) => `color-mix(in oklab, ${c} 66%, #000)`, (c) => `color-mix(in oklab, ${c} 40%, #fff)`];
  function planetTone(res, planet) {
    if (!planet) return 'var(--fg)';
    const fac = factionOfPlanet(planet);
    const same = [...new Set((res?.tasks || []).flatMap(r => [r.planet, ...(r.libN?.rank || []).map(x => x.planet)]).filter(p => p && factionOfPlanet(p) === fac).map(p => p.index))].sort((a, b) => a - b);
    const k = Math.max(0, same.indexOf(planet.index));
    return SHADES[k % SHADES.length](FAC_VAR[fac] || 'var(--fg)');   // FAC_VAR: 05-war-map.js
  }
  function taskText(r) {
    const tk = r.task, n = big(tk.goal);
    // "Liberate 1 planet", not "1 planets"
    const fillN = (key, params) => fill(tk.goal === 1 && tHas(key + '1') ? t(key + '1') : t(key), params);
    const sector = tk.sectorIndex != null && last && last.sectorName ? last.sectorName[tk.sectorIndex] : null;
    const where = r.planet ? ` ${t('on')} ${planetName(r.planet)}` : sector ? ` ${fill(t('inSector'), { s: esc(sector) })}` : tk.sectorIndex != null ? ` ${t('inASector')}` : '';
    const fac = tk.faction && tk.faction !== 'Humans' ? tk.faction : null;
    const diff = tk.minDifficulty ? ` (${fill(t('minDiff'), { d: tk.minDifficulty })})` : '';
    switch (tk.type) {
      case 3: {
        // "Kill 1 Terminid", not "Kill 1 Terminids"
        const one = tk.goal === 1;
        const target = tk.enemyId ? esc(one ? enemyOne(tk.enemyId, fac) : enemyName(tk.enemyId, fac)) : fac ? (one ? facName(fac) : facPlural(fac)) : t(one ? 'enemy' : 'enemies');
        const item = tk.itemId ? ` ${t('with')} ${esc(itemName(tk.itemId))}` : '';
        return `${t('kill')} ${n} ${target}${item}${where}${diff}`;
      }
      case 1: return fillN('extractN', { n }) + (fac ? ` · ${facName(fac)}` : '') + where + diff;
      // "Extract 35M Common Samples from Automaton worlds": the faction says where they come from (1 Nov 2026)
      case 2: return fill(t('extractWith'), { n, item: tk.itemId ? esc(pluralItem(itemName(tk.itemId), tk.goal)) : t('samples') }) + (fac ? ' ' + fill(t('fromFac'), { f: facName(fac) }) : '') + where;
      case 4: return fillN('objectives', { n }) + where + diff;
      case 5: return fillN('play', { n }) + where + diff;
      case 6: return fillN('use', { item: esc(itemName(tk.itemId) || ''), n }) + where;
      case 7: return fillN('missions', { n }) + (fac ? ` · ${facName(fac)}` : '') + where + diff;
      case 9: return fillN('operations', { n }) + (fac ? ` · ${facName(fac)}` : '') + where + diff;
      case 10: return fill(t('donate'), { n, item: tk.itemId ? esc(itemName(tk.itemId)) : t('resources') });
      case 11: return fill(t('liberate'), { p: planetName(r.planet) });
      case 12: return fillN('defendN', { n }) + (fac ? ` · ${facName(fac)}` : '');
      case 13: return fill(t('hold'), { p: planetName(r.planet) });
      case 14: return (fac ? fillN('liberateNf', { n, f: facName(fac) }) : fillN('liberateN', { n })) + where;
      case 15: return t('net');
      default: return fill(t('unknownTask'), { n: tk.type }) + (tk.goal ? ` (${n})` : '');
    }
  }
  const crowdText = (need, now) => {
    const r = now > 0 ? need / now : 99, c = t('crowd');
    return r < 1.15 ? c[0] : r < 1.6 ? c[1] : r < 2.4 ? c[2] : r < 3.5 ? c[3] : c[4];
  };
  // bar helper: widths animate from the previous value (data-key) to the new one
  const barFill = (key, frac, cls = 'fill') => `<div class="${cls}" data-key="${esc(key)}" data-w="${Math.max(0, Math.min(1, frac || 0)) * 100}"></div>`;

  /* ---------- masthead ---------- */
  function renderHud() {
    const Ls = last;
    $('hud-stats').innerHTML = `
      <div class="stat"><span class="v"><i class="live ${Ls.stale ? 'warn' : ''}" aria-hidden="true"></i><b data-count="players" data-to="${Ls.N}">${fmt(Ls.N)}</b></span><span class="stat-l">${t('players')} · ${esc(fill(t(Ls.stale ? 'dataFrom' : 'updatedShort'), { t: new Date(Ls.stale ? Ls.stale.t : Ls.now).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' }) }))}</span></div>`;
  }

  /* ---------- order switcher ---------- */
  // Several orders at once: each tab carries its own call, and the desk's best bet is marked on its tab.
  // With no order picked by hand, the page opens on the best bet (critique 1 Nov 2026: it opened on order 1
  // while the strip above said the other order was the better bet).
  function renderOrderTabs() {
    const rs = last.results, box = $('order-tabs');
    if (!rs.length) { box.innerHTML = ''; $('ot-nav').hidden = true; return; }
    $('ot-nav').hidden = rs.length < 2;
    const cx = crossNow(), bestId = cx && cx.verdict === 'pick' ? String(cx.pick) : null;
    if (!rs.some(x => String(x.a.id) === String(ui.order))) ui.orderManual = false;
    if (!ui.orderManual) ui.order = bestId || String(rs[0].a.id);
    fresh.delete(String(ui.order));
    // forget the tabs of orders that are gone
    for (const k of Object.keys(ui.tab)) if (!rs.some(x => String(x.a.id) === k)) delete ui.tab[k];
    saveUi();
    box.innerHTML = rs.map(({ a, res }, i) => {
      const id = String(a.id), sel = id === String(ui.order);
      return `<button type="button" role="tab" class="otab ${fresh.has(id) ? 'is-new' : ''}" id="otab-${esc(id)}" data-otab="${esc(id)}" aria-selected="${sel}" aria-controls="view" tabindex="${sel ? 0 : -1}">
        <span class="ot-top"><span class="ot-k">${fill(t('order'), { n: i + 1 })}</span>${id === bestId ? `<span class="ot-best">${esc(t('xBest'))}</span>` : ''}${fresh.has(id) ? `<span class="new-tag">${t('newTag')}</span>` : ''}</span>
        <span class="ot-n">${clean(txt(a.title) || 'Major Order')}</span>${pill(res.verdict)}</button>`;
    }).join('');
  }

  // "kills" when every counted objective is a kill count, otherwise the neutral "objectives"
  const counterNoun = (res) => res.tasks.filter(r => r.counter && !r.simpleCount).every(r => r.task.type === 3) ? t('what')[3] : t('what')[0];

  /* ---------- directive (the ONE thing) ---------- */
  function directiveParts(res) {
    const d = res.directive || { kind: 'steady' };
    const D = t('d');
    let kicker = '', target = '', why = '', fac = null, meter = '', ring = null, planet = null, cap = '', req = '';
    const projTxt = d.proj != null ? projPct(d.proj) : '—';
    // players there now vs players needed; `where` says where ("on Fury", "on the Terminid front")
    const meterPips = (now, need, where, weaponUse = false, needKey = null) => {
      if (need == null || !isFinite(need)) return '';
      const N = res.model.N || 0;
      const ok = now >= need * 0.98, tooMany = N && need > N;
      const frac = Math.max(0, Math.min(1, need > 0 ? now / need : 1));
      const left = (n) => fill(t('meterNow'), { n, where });
      const times = N ? fmt(need / N, need / N < 10 ? 1 : 0) : '';
      const right = (n) => ok ? t('meterEnough')
        : fill(t(tooMany ? 'meterAll' : 'meterNeed'), { n, x: times }) + (weaponUse ? t('meterWeapon') : '');
      cap = plainCap(`${left(people(now))} · ${right(people(need))}`);
      const rightNoW = (n) => ok ? t('meterEnough') : fill(t(needKey && !tooMany ? needKey : tooMany ? 'meterAll' : 'meterNeed'), { n, x: times });
      return `<div class="dir-meter turnout ${ok ? 'ok' : ''}" ${weaponUse ? `title="${esc(t('meterWeaponTip'))}"` : ''}>
        <div class="to-bar" role="img" aria-label="${esc(cap)}">${barFill(`to:${res.id}`, frac, 'fill')}<i class="to-goal" aria-hidden="true"></i></div>
        <div class="cap"><span>${left(`<b>${people(now)}</b>`)}</span><span>${rightNoW(`<b>${people(need)}</b>`)}${weaponUse && !ok ? ` <button type="button" class="q" data-tipq="${esc(t('meterWeaponTip'))}" aria-label="${esc(t('meterWeaponTip'))}">?</button>` : ''}</span></div></div>`;
    };
    const meterProj = (r) => {
      const tk = r.task, frac = tk.goal ? Math.min(1, tk.progress / tk.goal) : 0;
      const pf = r.projection != null && tk.goal ? Math.min(1, r.projection / tk.goal) : null;
      const right = d.measuring ? t('s.cWait') : fill(t('meterProj'), { p: `<b>${projTxt}</b>` });
      cap = `${fill(t('s.progress'), { p: pct(frac) })} · ${d.measuring ? t('s.cWait') : fill(t('meterProj'), { p: projTxt })}`;
      return `<div class="dir-meter"><div class="bar" style="height:16px">
          ${pf != null && pf > frac ? `<div class="proj" style="left:${frac * 100}%;width:${(pf - frac) * 100}%"></div>` : ''}${barFill(`dir:${res.id}`, frac)}<div class="goal"></div></div>
        <div class="cap"><span>${fill(t('s.progress'), { p: `<b>${pct(frac)}</b>` })}</span><span>${right}</span></div></div>`;
    };
    const taskRing = (r) => r && r.task && r.task.goal ? { frac: Math.min(1, r.task.progress / r.task.goal), label: t('what')[r.task.type] ? fill(t('gProgW'), { what: t('what')[r.task.type] }) : t('gProg'), tone: 'cnt' } : null;
    const libRing = (p) => p && p.maxHealth ? { frac: Math.max(0, Math.min(1, 1 - p.health / p.maxHealth)), label: t('gLib'), tone: 'lib' } : null;
    switch (d.kind) {
      case 'liberate': {
        planet = d.planet; fac = factionOfPlanet(d.planet);
        kicker = D.liberate.k; target = txt(d.planet.name);
        let v = d.variant;
        if (v === 'more' && d.wasted >= 1000) v = 'moreWasted';
        if (v === 'win' && (d.remaining || 1) <= 1) v = 'winLast';
        if (v === 'n') v = d.verdict === 'impossible' ? 'nImp' : d.left === 1 ? 'n1' : 'n';
        why = fill(D.liberate.why[v] || D.liberate.why.more, { when: d.hours != null ? clock(d.hours) : '', crowd: crowdText(d.need, d.now), planet: planetName(d.planet), left: fmt(d.left) })
          + (d.region ? fill(D.liberate.region, { region: esc(d.region) }) : '');
        meter = meterPips(d.now, d.need, fill(t('onPlanet'), { p: planetName(d.planet) }), false, d.variant === 'win' ? 'meterFocus' : d.variant === 'more' && d.remaining > 1 ? 'meterNeedAll' : null); ring = libRing(d.planet);
        break;
      }
      case 'defend': {
        planet = d.planet; fac = factionOfPlanet(d.planet); kicker = D.defend.k; target = txt(d.planet.name);
        why = fill(D.defend.why, { when: clock(d.hours) }); meter = meterPips(d.now, d.need, fill(t('onPlanet'), { p: planetName(d.planet) }));
        const e = d.planet.event; ring = e && e.maxHealth ? { frac: Math.max(0, Math.min(1, 1 - e.health / e.maxHealth)), label: t('gDef'), tone: 'lib' } : null;
        break;
      }
      case 'front': {
        fac = d.faction; kicker = D.front.k; target = fill(D.front.target, { f: t('fac')[d.faction] || d.faction });
        const ahead = d.aheadFrom || [];
        const tt = d.task ? d.task.task.type : 3;
        // what exactly is behind, as the objective names it ("Radical kills", not "Automaton kills")
        why = (d.task ? fill(D.front.whyTask, { what: taskNoun(d.task.task), proj: projTxt }) : fill(D.front.why, { f: facName(d.faction), what: t('what')[tt] || t('what')[0], proj: projTxt }))
          + (ahead.length ? fill(D.front.whyFrom, { from: listJoin(ahead.map(facName)), what: counterNoun(res) }) : '');
        if (d.task && tt === 3 && d.task.task.itemId) req = itemName(d.task.task.itemId);
        meter = meterPips(d.now, d.need, fill(t('onFront'), { f: facName(d.faction) }), !!(d.task && tt === 3 && d.task.task.itemId));
        ring = taskRing(d.task); break;
      }
      case 'weapon':
        fac = d.faction; kicker = D.weapon.k; target = itemName(d.item) || '';
        why = d.measuring ? D.measuring : fill(D.weapon.why, { proj: projTxt }); meter = meterProj(d.task); ring = taskRing(d.task); break;
      case 'counter': {
        fac = d.faction; const tk = d.task.task;
        const enemyTarget = () => tk.enemyId ? enemyName(tk.enemyId, tk.faction) : (tk.faction ? (t('facPl')[tk.faction] || t('fac')[tk.faction]) : t('tgtEnemies'));
        const C = {
          3: [D.kill, enemyTarget],
          1: [D.extract, () => t('tgtExtractions')],
          2: [D.extract, () => tk.itemId ? itemName(tk.itemId) : t('tgtSamples')],
          4: [D.objectives, () => t('tgtObjectives')],
          5: [D.playN, () => t('tgtMissions')],
          6: [D.useItem, () => tk.itemId ? itemName(tk.itemId) : t('tgtGear')],
          7: [D.complete, () => t('tgtMissions')],
          9: [D.complete, () => t('tgtOps')],
          10: [D.donate, () => tk.itemId ? itemName(tk.itemId) : t('tgtResources')],
        }[tk.type] || [D.complete, () => t('tgtMissions')];
        kicker = C[0].k; target = C[1](); why = fill(C[0].why, { proj: projTxt });
        if (tk.type === 3 && tk.itemId) req = itemName(tk.itemId);
        if (d.measuring) why = D.measuring;
        meter = meterProj(d.task); ring = taskRing(d.task); break;
      }
      case 'waitDefense':
        fac = d.faction; kicker = D.waitDefense.k; target = D.waitDefense.target;
        why = fill(D.waitDefense.why, { left: fmt(d.left) }); break;
      case 'lost':
        kicker = D.lost.k; target = D.lost.target; why = D.lost.why; break;
      case 'ended':
        kicker = D.ended.k; target = D.ended.target; why = D.ended.why; break;
      case 'play': {
        const P = res.tasks.some(r => r.task.type === 15 && r.verdict !== 'done') ? D.net : D.play;
        kicker = P.k; target = P.target; why = P.why; break;
      }
      case 'done':
        kicker = D.done.k; target = D.done.target; why = D.done.why; break;
      default:
        kicker = D.steady.k; target = D.steady.target; why = D.steady.why;
    }
    const title = ['steady', 'lost'].includes(d.kind) ? target : d.kind === 'ended' ? `${kicker}: ${target}` : `${kicker} ${target}`;
    // the hero must agree with the forecast: a hard or hopeless order says so before telling you where to go
    const leadOk = !res.ended && !d.measuring && (['front', 'counter', 'weapon', 'defend'].includes(d.kind) || (d.kind === 'liberate' && !['nImp', 'partial'].includes(d.variant) && d.verdict !== 'impossible'));
    const lead = leadOk ? (t('lead')[res.verdict] || '') : '';
    // what kind of call this is: the label over the call and the live dot follow it (critique 1 Nov 2026:
    // "What to do now" with a green dot stayed on won, lost and stale orders)
    const state = res.verdict === 'done' ? 'done' : res.ended ? 'ended' : (d.kind === 'lost' || res.verdict === 'impossible' || res.verdict === 'failed') ? 'out' : (d.measuring || d.kind === 'play' || res.verdict === 'unknown') ? 'wait' : 'go';
    return { d, kicker, target, why, fac, meter, ring, planet, cap, title, req, lead, state };
  }

  // The planet the call points at, as a plain button: its conditions and loadout open in the planet card.
  function planetBtn(res) {
    const cp = cardPlanets({ res });
    if (!cp) return '';
    const pl = cp.planet, dss = !!(last && last.dssIdx === pl.index);
    return `<button type="button" class="planet-btn" data-globe aria-haspopup="dialog" aria-expanded="false">
      ${miniGlobe(FAC_VAR[factionOfPlanet(pl)] || 'var(--fg)')}<span class="pb-n">${planetName(pl)}${cp.list && cp.list.length > 1 ? ` <small>+${cp.list.length - 1}</small>` : ''}</span>
      <span class="pb-t">${esc(t('gCta'))}</span>${dss ? `<span class="pb-dss" title="${esc(t(last.hod ? 'gDssHodT' : 'gDssT'))}">${esc(t(last.hod ? 'gDssHod' : 'gDss'))}</span>` : ''}${ICON.chev}</button>`;
  }

  // The planet of the call as the game's war-table hologram: its faction's colour, slowly turning, with the
  // objective's progress as an orbit ring and the DSS in orbit when it is there. Decoration beside the
  // headline (the planet button carries the same planet for keyboards and screen readers); wide screens only.
  function surfaceSVG(seed) {
    let s = (Math.abs(Math.floor(seed)) % 233280) || 7;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const blobs = Array.from({ length: 10 }, () => ({ x: rnd() * 156, y: 46 + rnd() * 148, rx: 8 + rnd() * 30, ry: 3 + rnd() * 9, d: rnd() > 0.45 }));
    const copy = (off) => blobs.map(b => `<ellipse cx="${(42 + off + b.x).toFixed(1)}" cy="${b.y.toFixed(1)}" rx="${b.rx.toFixed(1)}" ry="${b.ry.toFixed(1)}" class="${b.d ? 'd' : 'l'}"/>`).join('');
    return copy(-156) + copy(0) + copy(156);
  }
  // a small planet in the faction's colour, for the planet button on narrow screens
  const miniGlobe = (fc) => `<i class="pb-globe" style="--fc:${fc}" aria-hidden="true"></i>`;
  function holoPlanet(p, res, cap, trigger) {
    const r = p.ring;
    if (!r) return '';
    // the call's planet opens its briefing (conditions and loadout), labelled under the globe
    const cp = trigger ? cardPlanets({ res }) : null;
    const id = 'gl' + String(res.id).replace(/[^\w-]/g, '');
    const seed = p.planet ? Number(p.planet.index) * 37 + 11 : String(p.fac || 'x').length * 131;
    const dss = !!(p.planet && last && last.dssIdx === p.planet.index);
    // the faction's own colour (owner, 2 Nov 2026), not a shade of it
    const fac = p.planet ? factionOfPlanet(p.planet) : p.fac, fc = FAC_VAR[fac] || 'var(--fg)';
    const tag = cp ? 'button' : 'div';
    const attrs = cp ? `type="button" data-globe aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(plain(planetName(cp.planet)) + ': ' + t('gCta'))}"` : 'aria-hidden="true"';
    return `<${tag} class="holo ${r.tone}${cp ? ' holo-btn' : ''}" style="--fc:${fc}" ${attrs}>
      <svg viewBox="0 0 240 240" focusable="false">
        <defs>
          <radialGradient id="${id}b" cx="34%" cy="30%" r="80%"><stop offset="0" class="g-s0"/><stop offset=".55" class="g-s1"/><stop offset="1" class="g-s2"/></radialGradient>
          <radialGradient id="${id}t" cx="32%" cy="28%" r="92%"><stop offset=".42" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>
          <clipPath id="${id}c"><circle cx="120" cy="120" r="78"/></clipPath>
        </defs>
        <circle class="g-ticks" cx="120" cy="120" r="114"/>
        <circle class="g-track" cx="120" cy="120" r="102"/>
        <circle class="g-arc" cx="120" cy="120" r="102" pathLength="100" transform="rotate(-90 120 120)" data-ring="ring:${esc(res.id)}" data-frac="${(r.frac * 100).toFixed(2)}"/>
        <circle cx="120" cy="120" r="78" fill="url(#${id}b)"/>
        <g clip-path="url(#${id}c)"><g class="g-surf">${surfaceSVG(seed)}</g><g class="g-scan"><rect x="0" y="0" width="240" height="3"/><rect x="0" y="12" width="240" height="3"/><rect x="0" y="24" width="240" height="3"/></g></g>
        <circle cx="120" cy="120" r="78" fill="url(#${id}t)"/>
        <circle class="g-rim" cx="120" cy="120" r="78"/>
        ${dss ? `<g class="g-sat ${last.hod ? 'hod' : ''}"><path d="M120 6.5l6.5 6.5-6.5 6.5-6.5-6.5z"/></g>` : ''}
      </svg>
      <span class="g-val" aria-hidden="true"><b data-count="holo:${esc(res.id)}" data-to="${r.frac}" data-pct="1">${pct(r.frac)}</b><span>${esc(r.label)}</span></span>${cap ? `<span class="g-cap">${cap.split(' · ').map(x => `<span>${esc(x)}</span>`).join('')}</span>` : ''}
      ${cp ? `<span class="g-cta" aria-hidden="true"><span class="g-cta-n">${planetName(cp.planet)}${cp.list && cp.list.length > 1 ? ` <small>+${cp.list.length - 1}</small>` : ''}</span><span class="g-cta-t">${esc(t('gCta'))} ›</span></span>` : ''}
    </${tag}>`;
  }
