  /* ---------- errors ---------- */
  const embedded = (() => { try { return window.top !== window.self; } catch { return true; } })();
  function renderErrors(errs) {
    if (!errs.length) { $('errors').innerHTML = ''; return; }
    const blocked = errs.some(e => /failed to fetch|networkerror|load failed|blocked/i.test(e));
    const help = blocked ? `<div class="help"><p><b>${esc(t('helpTitle'))}</b></p><ol>
        ${embedded ? `<li>${esc(t('helpPreview'))}</li>` : ''}
        <li>${esc(t('helpBrowser'))}</li><li>${esc(t('helpBlocker'))}</li>
        <li>${esc(t('helpTest'))} <a href="${esc(apiUrl('/api/v1/war'))}" target="_blank" rel="noopener">${esc(API)}/api/v1/war</a></li></ol></div>` : '';
    const tech = lastStack ? `<details class="tech"><summary>${esc(t('techDetails'))}</summary><pre>${esc(lastStack)}</pre></details>` : '';
    $('errors').innerHTML = `<div class="err">${esc(fill(t('errApi'), { e: [...new Set(errs)].join(', ') }))}${help}${tech}</div>`;
  }

  /* ---------- small components ---------- */
  const ICON = {
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
  };
  const VICON = { done: 'check', ontrack: 'check', effort: 'plus', focus: 'target', hard: 'warn', record: 'warn', nearly_impossible: 'cross', impossible: 'cross', failed: 'cross', unknown: 'dots' };
  const pill = (v) => `<span class="pill v-${v}">${ICON[VICON[v] || 'dots']}${esc(t('v.' + v))}</span>`;
  const medalSvg = '<svg class="medal" viewBox="0 0 26 26" aria-hidden="true"><path d="M8 1h10l-2 8h-6z" fill="var(--info)"/><circle cx="13" cy="16" r="8" fill="none" stroke="var(--yellow)" stroke-width="2"/><path d="M13 11.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="var(--yellow)"/></svg>';

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
        const target = tk.enemyId ? esc(one ? enemyOne(tk.enemyId) : enemyName(tk.enemyId)) : fac ? (one ? facName(fac) : facPlural(fac)) : t(one ? 'enemy' : 'enemies');
        const item = tk.itemId ? ` ${t('with')} ${esc(itemName(tk.itemId))}` : '';
        return `${t('kill')} ${n} ${target}${item}${where}${diff}`;
      }
      case 1: return fillN('extractN', { n }) + (fac ? ` · ${facName(fac)}` : '') + where + diff;
      case 2: return `${t('extract')} ${n} ${tk.itemId ? esc(itemName(tk.itemId)) : t('samples')}${where}`;
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

  /* ---------- HUD ---------- */
  function renderHud() {
    const Ls = last;
    $('hud-stats').innerHTML = `
      <div class="stat" title="${esc(t('players'))}"><span class="label">${t('players')}</span><span class="v"><i class="live ${Ls.stale ? 'warn' : ''}"></i><span data-count="players" data-to="${Ls.N}">${fmt(Ls.N)}</span><small class="m-only"> ${t('online')}</small></span></div>`;
  }

  /* ---------- order tabs ---------- */
  function renderOrderTabs() {
    const rs = last.results;
    if (!rs.length) { $('order-tabs').innerHTML = ''; return; }
    $('order-tabs').hidden = rs.length < 2;
    if (!rs.some(x => String(x.a.id) === String(ui.order))) ui.order = String(rs[0].a.id);
    fresh.delete(String(ui.order));
    // forget the tabs of orders that are gone
    for (const k of Object.keys(ui.tab)) if (!rs.some(x => String(x.a.id) === k)) delete ui.tab[k];
    saveUi();
    $('order-tabs').innerHTML = rs.map(({ a, res }, i) => {
      const sel = String(a.id) === String(ui.order);
      return `<button type="button" role="tab" class="otab ${fresh.has(String(a.id)) ? 'is-new' : ''}" id="otab-${esc(a.id)}" data-otab="${esc(a.id)}" aria-selected="${sel}" tabindex="${sel ? 0 : -1}">
        <span class="k"><i class="dot v-${res.verdict}"></i>${fill(t('order'), { n: i + 1 })}<span class="kv-v"> · ${esc(t('v.' + res.verdict))}</span>${fresh.has(String(a.id)) ? `<span class="new-tag">${t('newTag')}</span>` : ''}</span>
        <span class="n">${clean(txt(a.title) || 'Major Order')}</span><span class="idx">${i + 1}</span></button>`;
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
      const on = Math.max(0, Math.min(20, Math.round((need > 0 ? now / need : 1) * 20)));
      const pips = Array.from({ length: 20 }, (_, i) => `<i class="pip ${i < on ? 'on' : ''} ${ok && i < on ? 'ok' : ''}" style="--i:${i}"></i>`).join('');
      const left = (n) => fill(t('meterNow'), { n, where });
      const times = N ? fmt(need / N, need / N < 10 ? 1 : 0) : '';
      const right = (n) => ok ? t('meterEnough')
        : fill(t(tooMany ? 'meterAll' : 'meterNeed'), { n, x: times }) + (weaponUse ? t('meterWeapon') : '');
      cap = plainCap(`${left(people(now))} · ${right(people(need))}`);
      const rightNoW = (n) => ok ? t('meterEnough') : fill(t(needKey && !tooMany ? needKey : tooMany ? 'meterAll' : 'meterNeed'), { n, x: times });
      return `<div class="dir-meter" ${weaponUse ? `title="${esc(t('meterWeaponTip'))}"` : ''}><div class="pips" aria-hidden="true">${pips}</div>
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
        meter = meterPips(d.now, d.need, fill(t('onPlanet'), { p: planetName(d.planet) }), false, d.variant === 'win' ? 'meterFocus' : null); ring = libRing(d.planet);
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
        why = fill(D.front.why, { f: facName(d.faction), what: t('what')[tt] || t('what')[0], proj: projTxt })
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
        const enemyTarget = () => tk.enemyId ? enemyName(tk.enemyId) : (tk.faction ? (t('facPl')[tk.faction] || t('fac')[tk.faction]) : t('tgtEnemies'));
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
        kicker = D.done.k; target = D.done.target; why = D.done.why;
        meter = `<div class="dir-done"><div class="big-check">${ICON.check.replace('class="ico"', 'style="width:34px;height:34px"')}</div></div>`; break;
      default:
        kicker = D.steady.k; target = D.steady.target; why = D.steady.why;
    }
    const title = ['steady', 'lost'].includes(d.kind) ? target : d.kind === 'ended' ? `${kicker}: ${target}` : `${kicker} ${target}`;
    // the hero must agree with the forecast: a hard or hopeless order says so before telling you where to go
    const leadOk = !res.ended && !d.measuring && (['front', 'counter', 'weapon', 'defend'].includes(d.kind) || (d.kind === 'liberate' && !['nImp', 'partial'].includes(d.variant) && d.verdict !== 'impossible'));
    const lead = leadOk ? (t('lead')[res.verdict] || '') : '';
    return { d, kicker, target, why, fac, meter, ring, planet, cap, title, req, lead };
  }

  // a planet in the faction's colour, with the objective's progress as an orbit ring
  function surfaceSVG(seed) {
    let s = (Math.abs(Math.floor(seed)) % 233280) || 7;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const blobs = Array.from({ length: 10 }, () => ({ x: rnd() * 156, y: 46 + rnd() * 148, rx: 8 + rnd() * 30, ry: 3 + rnd() * 9, d: rnd() > 0.45 }));
    const copy = (off) => blobs.map(b => `<ellipse cx="${(42 + off + b.x).toFixed(1)}" cy="${b.y.toFixed(1)}" rx="${b.rx.toFixed(1)}" ry="${b.ry.toFixed(1)}" class="${b.d ? 'd' : 'l'}"/>`).join('');
    return copy(-156) + copy(0) + copy(156);
  }
  function globeHTML(p, res) {
    const r = p.ring;
    if (!r) return '';
    const id = 'gl' + String(res.id).replace(/[^\w-]/g, '');
    const seed = p.planet ? Number(p.planet.index) * 37 + 11 : String(p.fac || 'x').length * 131;
    const dss = !!(p.planet && last && last.dssIdx === p.planet.index);
    // the planet card has to announce itself: a visible label under the globe, pulsing until first opened
    const cp = cardPlanets({ res });
    const cta = cp ? `<span class="g-cta"><span class="g-cta-n">${planetName(cp.planet)}${cp.list && cp.list.length > 1 ? ` <small>+${cp.list.length - 1}</small>` : ''}</span><span class="g-cta-t">${esc(t('gCta'))} ›</span><span class="g-cta-s">${esc(t('gCtaS'))} ›</span></span>` : '';
    const fresh = cp && !store.get('pcSeen', false);
    return `<div class="globe ${r.tone} ${fresh ? 'g-new' : ''}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${esc(t('pc.open'))}" data-globe>
      <svg viewBox="0 0 240 240" focusable="false">
        <defs>
          <radialGradient id="${id}b" cx="34%" cy="30%" r="80%"><stop offset="0" class="g-s0"/><stop offset=".55" class="g-s1"/><stop offset="1" class="g-s2"/></radialGradient>
          <radialGradient id="${id}t" cx="32%" cy="28%" r="92%"><stop offset=".42" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>
          <radialGradient id="${id}a" cx="50%" cy="50%" r="50%"><stop offset=".8" class="g-a0"/><stop offset=".86" class="g-a1"/><stop offset="1" class="g-a0"/></radialGradient>
          <clipPath id="${id}c"><circle cx="120" cy="120" r="78"/></clipPath>
        </defs>
        <circle class="g-ticks" cx="120" cy="120" r="114"/>
        <circle class="g-track" cx="120" cy="120" r="103"/>
        <circle class="g-arc" cx="120" cy="120" r="103" pathLength="100" transform="rotate(-90 120 120)" data-ring="ring:${esc(res.id)}" data-frac="${(r.frac * 100).toFixed(2)}"/>
        <circle cx="120" cy="120" r="97" fill="url(#${id}a)"/>
        <circle cx="120" cy="120" r="78" fill="url(#${id}b)"/>
        <g clip-path="url(#${id}c)"><g class="g-surf">${surfaceSVG(seed)}</g></g>
        <circle cx="120" cy="120" r="78" fill="url(#${id}t)"/>
        ${dss ? `<g class="g-sat ${last.hod ? 'hod' : ''}"><path d="M120 6.5l6.5 6.5-6.5 6.5-6.5-6.5z"/></g>` : ''}
      </svg>
      <div class="g-val"><b data-count="globe:${esc(res.id)}" data-to="${r.frac}" data-pct="1">${pct(r.frac)}</b><span>${esc(r.label)}</span>${dss ? `<i>${esc(last.hod ? t('gDssHod') : t('gDss'))}</i>` : ''}</div>
      ${cta}
    </div>`;
  }

