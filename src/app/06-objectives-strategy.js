  /* ---------- objectives tab ---------- */
  const kv = (label, value) => `<span>${esc(label)}: <b>${value}</b></span>`;
  // per-objective numbers, folded away until asked for
  function intelHTML(r, res, key) {
    const tk = r.task, p = r.planet, rows = [];
    if (r.pw && p) {
      rows.push(kv(t('iHp'), `${big(p.health)} / ${big(p.maxHealth)}`));
      rows.push(kv(t('iRegen'), `${big(r.pw.regen)} HP${t('perHour')}`));
      rows.push(kv(t('th.divers'), `${fmt(p.statistics?.playerCount || 0)} (${pct(r.share, 1)})`));
      rows.push(kv(t('iNet'), `${r.net >= 0 ? '+' : ''}${big(r.net)} HP${t('perHour')} · ${r.observed ? t('obs') : t('model')}`));
      rows.push(kv(t('iBe'), pct(r.breakEven)));
      if (r.pw.hasRegions) rows.push(kv(t('iRegions'), r.pw.queue.filter(q => q.hp > 0).map(q => `${esc(q.name || '?')} ${big(q.hp)} (${fmt(q.players)})`).join(' · ')));
    } else if (r.defense && p) {
      rows.push(kv(t('defEnds'), dur(r.defense.hoursToEnd)));
      rows.push(kv(t('th.divers'), `${fmt(p.statistics?.playerCount || 0)} (${pct(r.defense.share, 1)})`));
      rows.push(kv(t('defNeed'), `${people(r.defense.need * res.model.N)} (${pct(r.defense.need)})`));
    } else if (r.counter && !r.simpleCount) {
      rows.push(kv(t('done'), `${big(tk.progress)} / ${big(tk.goal)}`));
      rows.push(kv(t('needRate'), `${big(r.needed)}${t('perHour')}`));
      rows.push(kv(t('rateStart'), r.rates.sinceStart ? big(r.rates.sinceStart.rate) + t('perHour') : esc(t('notYet'))));
      rows.push(kv(t('rateRecent'), r.rates.recent ? big(r.rates.recent.rate) + t('perHour') : esc(t('notYet'))));
    } else if (r.libN && r.libN.rank) {
      rows.push(kv(t('iQuickest'), r.libN.rank.slice(0, 4).map(x => planetName(x.planet)).join(', ')));
      rows.push(kv(t('iFront'), `${fmt(Math.round(r.libN.frontShare * res.model.N))} (${pct(r.libN.frontShare, 1)})`));
    } else if (r.defenses && r.defenses.length) {
      rows.push(kv(t('iAttacks'), r.defenses.map(d => `${planetName(d.planet)} · ${dur(d.hoursToEnd)}`).join(', ')));
    }
    if (!rows.length) return '';
    const open = !!ui.intelOpen[key];
    return `<details class="intel" data-intel="${esc(key)}" ${open ? 'open' : ''}><summary>${ICON.chev}<span>${t('intel')}</span></summary><div class="kv">${rows.join('')}</div></details>`;
  }

  // The races: every objective on one shared scale, each bar ending at its goal, with the bracket showing
  // where today's pace lands by the deadline (the desk's signature: a race is called only once it's settled)
  function racesHTML(res, a) {
    const id = String(a.id);
    const brief = clean(txt(a.briefing));
    const desc = txt(a.description) && txt(a.description) !== txt(a.briefing) ? clean(txt(a.description)) : '';
    const open = !!ui.briefOpen[id];
    return `<section class="races" aria-labelledby="races-${esc(id)}">
      <div class="sec-bar"><h2 id="races-${esc(id)}">${esc(t(res.ended ? 'races.titleEnded' : 'races.title'))}</h2>${res.ended ? `<p class="sec-note">${esc(t('races.noteEnded'))}</p>` : `<p class="race-key" aria-label="${esc(t('races.note'))}"><span><i class="k-done"></i>${esc(t('lgDone'))}</span><span><i class="k-pace"></i>${esc(t('lgPace'))}</span><span><i class="k-goal"></i>${esc(t('lgGoal'))}</span><span><i class="k-front"></i>${esc(t('lgFront'))}</span></p>`}</div>
      <div class="race-list">${objectivesHTML(res)}</div>
      ${brief || desc ? `<details class="brief" data-brief="${esc(id)}" ${open ? 'open' : ''}><summary>${ICON.chev}<span>${esc(t('brief'))}</span></summary><div class="brief-text"><p>${brief}</p>${desc ? `<p>${desc}</p>` : ''}</div></details>` : ''}
    </section>`;
  }

  function objectivesHTML(res) {
    const H = res.hoursLeft;
    const S = (k, p = {}) => fill(t('s.' + k), p);
    const banner = res.anyOf ? `<p class="anyof">${ICON.target}<span>${fill(t('anyOf'), { k: res.pick + 1 })}</span></p>` : '';
    return banner + res.tasks.map((r, i) => {
      const tk = r.task;
      const p = r.planet;
      const fac = p ? factionOfPlanet(p) : tk.faction;
      let bar = '', line = '', chips = [];
      const key = `${res.id}:${r.idx}`;
      if (r.pw || ((tk.type === 11 || tk.type === 13) && !r.defense)) {
        if (!r.pw) { bar = `<div class="bar lib fac-Humans">${barFill(key, 1)}</div>`; line = r.safe ? S('safe') : S('liberated'); }
        else {
          const frac = Math.max(0, 1 - p.health / p.maxHealth);
          bar = `<div class="bar lib ${r.net > 0 ? 'moving' : 'stuck'}" role="img" aria-label="${pct(frac)}">${barFill(key, frac)}</div>`;
          const L = res.liberation, seg = L && L.plan && isFinite(L.seqNeed) && L.seqNeed <= 1 ? L.plan.segs.findIndex(sg => sg.target === r) : -1;
          const planned = seg > 0 && !(r.eta <= H) ? fill(t('libPlan'), { prev: planetName(L.plan.segs[seg - 1].target.planet), a: clock(L.plan.segs[seg].start), b: clock(L.plan.segs[seg].end) }) : null;
          line = `<b>${S('pct', { p: pct(frac) })}</b> · ${res.ended ? S('missed') : r.eta <= H ? S('fallsAt', { when: clock(r.eta) }) + ` · ${esc(fill(t('s.ahead'), { d: dur(H - r.eta) }))}` + (r.fc?.band ? ` <span class="band" title="${esc(S('fallsTip', { when: clock(r.eta), a: clock(r.fc.band.lo), b: clock(r.fc.band.hi) }))}">${S('range', { a: clockNear(r.fc.band.lo, r.eta), b: clockNear(r.fc.band.hi, r.eta) })}</span>` : '') : planned || (r.net <= 0 ? S('stuck') : S('slow'))}`;
          if (r.onDss) chips.push(`<span class="chip" style="color:var(--info)">${t('chipDss')}</span>`);
          if (r.onDss && last.hod) chips.push(`<span class="chip" style="color:var(--yellow)">${t('chipHod')}</span>`);
          if (r.holdLost) chips.push(`<span class="chip" style="color:var(--warn)">${t('chipRetake')}</span>`);
        }
      } else if (r.defense) {
        bar = `<div class="bar def">${barFill(key, r.defense.progress)}</div>`;
        line = r.defense.outlastsMO ? S('defOut') : r.defense.verdict === 'ontrack' ? S('defOk') : S('defHelp', { when: clock(r.defense.hoursToEnd) });
      } else if (r.counter && !r.simpleCount) {
        const frac = tk.goal ? Math.min(1, tk.progress / tk.goal) : 0;
        // the pale band is today's pace, as on the Progress chart and in the simulator; when the objective
        // gets there only with players switching over, that is a second number, named (critique 1 Nov 2026)
        const own = r.freed ? r.freed.plain : r.projection;
        const pf = own != null && tk.goal ? Math.min(1, own / tk.goal) : null;
        const proj = r.projection != null && tk.goal ? projPct(r.projection / tk.goal) : null;
        bar = `<div class="bar">${pf != null && pf > frac ? `<div class="proj" style="left:${frac * 100}%;width:${(pf - frac) * 100}%"></div>` : ''}${barFill(key, frac)}<div class="goal"></div></div>`;
        const rate = r.rates && (r.rates.recent || r.primary) ? (r.rates.recent || r.primary).rate : null;
        const live = r.verdict !== 'done' && !res.ended && tk.goal && rate > 0
          ? `<span class="tick-wrap"><i class="live"></i><span class="tick" data-tick="${tk.progress}" data-rate="${(rate / 3600).toFixed(3)}" data-goal="${tk.goal}" data-t0="${last.now}">${fmt(tk.progress)}</span> / ${big(tk.goal)}</span> · ` : '';
        // far ahead: "done by Sun 14:00" reads better than "about 5,575% by the deadline"
        const doneIn = r.verdict === 'ontrack' && r.primary && r.primary.rate > 0 && r.projection / tk.goal > 1.5 ? (tk.goal - tk.progress) / r.primary.rate : null;
        line = `${r.early ? `<span class="chip early" title="${esc(t('earlyWhy'))}">${esc(t('early'))}</span> ` : ''}<b>${pct(frac)}</b> · ${live}${r.verdict === 'done' ? S('cDone') : res.ended ? S('missed') : !proj || r.verdict === 'unknown' ? S('cWait') : doneIn != null ? S('cOkBy', { when: clock(doneIn) }) : r.verdict === 'ontrack' ? (r.freed ? S('cOkFreed', { plain: projPct(r.freed.plain / tk.goal), proj }) : S('cOk', { proj })) : S('cBehind', { proj })}`;
      } else {
        const frac = tk.goal ? Math.min(1, tk.progress / tk.goal) : null;
        if (frac != null) bar = `<div class="bar">${barFill(key, frac)}<div class="goal"></div></div>`;
        line = tk.goal ? S('cCount', { p: fmt(tk.progress), g: fmt(tk.goal) }) : fmt(tk.progress);
        if (r.libN && r.libN.first && r.verdict !== 'done') line += ` · ${S('nNext', { planet: planetName(r.libN.first.planet) })}`;
        if (r.defenses && r.verdict !== 'done') line += ` · ${r.defenses.length > 1 ? S('nAttacks', { n: r.defenses.length }) : r.defenses.length ? S('nAttack1') : S('nNoAttack')}`;
      }
      // the race's own call: per objective, on the same five-step scale as the order (a planet that falls in
      // time inside an order that is still short says so in words, not with a green tick)
      // every race says one of the five calls (critique 1 Nov 2026: "Falls in time", "on pace" and "Called: done"
      // sat beside them); on track only if players switch over is a push, not on track
      const rv = raceVerdict(r, res);
      const pv = pill(rv);
      // liberation that falls before the deadline: the bracket runs to the goal line
      if (r.pw && r.eta <= H && !res.ended && r.verdict !== 'done') { const frac = Math.max(0, 1 - p.health / p.maxHealth); bar = bar.replace('<div class="fill"', `<div class="proj" style="left:${frac * 100}%;width:${(1 - frac) * 100}%"></div><div class="fill"`).replace(/<\/div>$/, '<div class="goal"></div></div>'); }
      return `<article class="race vl-${lvl(rv)}${fac ? ' fac-' + esc(fac) : ''}" style="--i:${i}${p ? ';--fc:' + planetTone(res, p) : ''}">
        <div class="race-head"><h3 class="race-name">${res.anyOf ? `<span class="opt ${i === res.pick ? 'best' : ''}">${fill(t('option'), { n: i + 1 })}</span>` : ''}${taskText(r)}</h3>
          <span class="race-call">${pv}</span></div>
        <div class="meta">${bar}<p class="line">${line}</p>${chips.length ? `<div class="chipline">${chips.join('')}</div>` : ''}${r.verdict === 'done' ? '' : intelHTML(r, res, key)}</div>
      </article>`;
    }).join('');
  }

  /* ---------- strategy tab ---------- */
  function timelineHTML(segs, H, key, res) {
    if (!segs || !segs.length) return '';
    const span = Math.max(H, segs[segs.length - 1].end);
    const x = (h) => (h / span) * 100;
    const segHtml = segs.map((s, i) => `<div class="tl-seg${s.end > H + 0.01 ? ' late' : ''}" style="--i:${i};--fc:${planetTone(res, s.planet)};left:${x(s.start)}%;width:${x(s.end - s.start)}%" title="${esc(txt(s.planet.name))}">${planetName(s.planet)}</div>`).join('');
    const list = segs.map((s, i) => `<span><i class="sw2" style="--fc:${planetTone(res, s.planet)}"></i><b>${planetName(s.planet)}</b> ${s.start < 0.05 ? t('now') : clock(s.start)} → ${clock(s.end)}</span>`).join('');
    return `<div class="timeline" data-tl="${esc(key)}">
      <div class="tl-track" aria-hidden="true">${segHtml}<div class="tl-deadline" style="left:calc(${Math.min(100, x(H))}% - 1px)" title="${esc(t('deadline'))}"></div></div>
      <div class="tl-list">${list}<span>· ${t('deadline')}: <b>${clock(H)}</b></span></div></div>`;
  }

  function recItem(rec, res, tag = 'li', icon = '') {
    const R = (k) => tHas('r.' + k);
    const P = (p) => planetName(p);
    let key = rec.kind, params = {}, cls = '', minor = false, extra = '';
    switch (rec.kind) {
      case 'libImpossible': params = { need: shareOf(rec.need) }; cls = 'k-bad'; if (rec.none) key = 'libImpossibleNone'; break;
      case 'libNFocus': {
        const rest = rec.list.slice(1).map(P);
        params = { planet: P(rec.planet), left: fmt(rec.left), then: rest.length ? fill(R('libNThen'), { list: listJoin(rest) }) : '',
          players: rec.players != null ? people(rec.players) : '—', share: rec.share != null ? pct(rec.share) : '—', nowPlayers: fmt(rec.nowPlayers) };
        if (rec.verdict === 'impossible') cls = 'k-warn';
        break;
      }
      case 'libNOk': params = { task: taskText(rec.task) }; minor = true; break;
      case 'defWait': params = { left: fmt(rec.left) }; minor = true; break;
      case 'libPartial': params = { k: rec.k, n: rec.n, share: pct(rec.share), need: shareOf(rec.need), planets: listJoin(rec.planets.map(P)) }; cls = 'k-warn'; break;
      case 'libFocus':
        key = { win: 'libFocusWin', more: 'libFocusMore', partial: 'libFocusPartial' }[rec.variant];
        params = { planet: P(rec.planet), players: people(rec.players), share: pct(rec.share), nowPlayers: fmt(rec.nowPlayers), when: rec.hours != null ? clock(rec.hours) : '', crowd: crowdText(rec.players, rec.nowPlayers) };
        break;
      case 'libWasted': params = { planet: P(rec.planet), players: fmt(rec.players), regen: big(rec.regen), target: P(rec.target) }; break;
      case 'libDecay': params = { planet: P(rec.planet), done: pct(rec.done), regen: big(rec.regen) }; break;
      case 'libOrder':
        if (rec.partial) key = 'libOrderPartial';
        params = { order: rec.segs.map((s, i) => fill(t(i ? 'orderThen' : 'orderFirst'), { a: P(s.planet) })).join('') + '.' };
        extra = timelineHTML(rec.segs, rec.H, `plan:${res.id}`, res); break;
      case 'libRegion':
        params = { planet: P(rec.planet), region: esc(rec.region || '?'), knock: rec.knock != null ? pct(rec.knock) : '—', hp: big(rec.hp), regen: big(rec.regen),
          order: rec.order.map(esc).join(' → '), spread: rec.spread ? fill(R('libRegionSpread'), { n: rec.spread }) : '' };
        break;
      case 'libDss': params = { p: pct(settings.dssBonus), planet: P(rec.planet), from: rec.from ? fill(R('libDssFrom'), { from: P(rec.from) }) : '' }; minor = true; break;
      case 'libHod': params = { planet: P(rec.planet), be: shareOf(rec.breakEven) }; minor = true; break;
      case 'defSend': params = { planet: P(rec.planet), when: clock(rec.hours), players: people(rec.players), nowPlayers: fmt(rec.nowPlayers) }; break;
      case 'defSkip': params = { planet: P(rec.planet) }; minor = true; break;
      case 'cntMove': {
        const ahead = rec.aheadFrom || (rec.idle ? [] : rec.from), idle = rec.idleFrom || (rec.idle ? rec.from : []);
        const parts = [];
        if (ahead.length) parts.push(fill(R('cntMoveAhead'), { from: listJoin(ahead.map(facName)), to: facName(rec.to), what: counterNoun(res) }));
        if (idle.length) parts.push(fill(R(idle.length > 1 ? 'cntMoveIdleN' : 'cntMoveIdle'), { from: listJoin(idle.map(facName)), to: facName(rec.to) }));
        params = { players: people(rec.players), from: listJoin(rec.from.map(facName)), to: facName(rec.to), why: parts.join(' ') };
        break;
      }
      case 'cntShort': params = { players: people(rec.players), to: facName(rec.to) }; cls = 'k-warn'; break;
      case 'cntBehind': {
        const tk = rec.task.task;
        params = { task: taskText(rec.task), more: projPct(rec.more), needed: big(rec.needed), rate: big(rec.rate), proj: rec.task.projection != null && tk.goal ? projPct(rec.task.projection / tk.goal) : '—' };
        break;
      }
      case 'cntStart': params = { task: taskText(rec.task), needed: big(rec.needed) }; break;
      case 'cntWeapon': params = { item: esc(itemName(rec.task.task.itemId) || '') }; minor = true; break;
      case 'cntOk': params = { task: taskText(rec.task) }; minor = true; break;
      case 'cntFreed': {
        const from = (rec.from || []).filter(Boolean).map(f => facName(f));
        if (!from.length || !rec.to) key = 'cntFreedAny';
        const tk = rec.task.task, pl = rec.task.freed?.plain;
        params = { task: taskText(rec.task), from: from.join(' and '), to: rec.to ? facName(rec.to) : '', plain: pl != null && tk.goal ? projPct(pl / tk.goal) : '—' };
        break;
      }
    }
    const [head, detail, nums] = R(key) || [key, '', ''];
    return `<${tag} class="${minor ? 'minor ' : ''}${cls}">${icon ? `<span class="fi">${icon}</span>` : ''}<div>
      <div class="head">${fill(head, params)}</div>
      ${detail ? `<div class="detail">${fill(detail, params)}</div>` : ''}
      ${nums ? `<div class="nums">${fill(nums, params)}</div>` : ''}${extra}</div></${tag}>`;
  }
  // situation (what the numbers say) / moves (what to do) / already fine (nothing to do)
  const ASSESS = new Set(['libImpossible', 'libPartial']);
  const FINE = new Set(['cntOk', 'defSkip', 'libNOk', 'allDone']);

  function simOutHTML(res, share) {
    const sm = ENGINE.simulate(res, share);
    if (!sm) return '';
    const N = res.model.N;
    let cls, bigTxt, sub;
    if (sm.wins) { cls = 'v-ontrack'; bigTxt = t('simWin'); sub = fill(t('simWinSub'), { when: clock(sm.total) }); }
    else if (sm.count > 0) { cls = 'v-record'; bigTxt = fill(t('simPartial'), { k: sm.count, n: sm.n }); sub = fill(t('simPartialSub'), { list: listJoin(sm.taken.map(planetName)) }); }
    else { cls = 'v-impossible'; bigTxt = t('simNone'); sub = t('simNoneSub'); }
    return `<div class="sim-out ${cls}">
      <div class="big">${esc(bigTxt)}</div>
      <div class="sub">${fill(t('simShare'), { pct: `<b>${pct(share)}</b>`, players: people(share * N) })}</div>
      <div class="sub">${sub}</div>
      ${sm.wins || sm.count ? timelineHTML(sm.wins ? sm.segs : sm.segs.filter(s => sm.taken.includes(s.planet)), res.model.H, `sim:${res.id}`, res) : ''}
    </div>`;
  }

  function simHTML(res) {
    const lib = res.liberation;
    if (!lib || res.ended) return '';
    const cur = Math.max(0.05, Math.min(1, lib.currentShare));
    const val = ui.sim[res.id] ?? Math.round(cur * 100);
    const pos = (v) => ((v - 5) / 95) * 100;
    return `<section class="panel br sim" id="sim-${esc(res.id)}">
      <div class="sec-head"><h3>${t('simTitle')}</h3></div>
      <p class="q">${t('simQ')}</p>
      <div class="range-wrap">
        <span class="range-now" style="left:${pos(cur * 100)}%">${t('simNow')} ${pct(cur)}</span>
        <input type="range" min="5" max="100" step="1" value="${val}" data-sim="${esc(res.id)}" aria-label="${esc(t('simQ'))}" style="--p:${pos(val)}%">
      </div>
      <div class="presets">
        <button type="button" class="ghost" data-preset="${esc(res.id)}" data-v="${Math.round(cur * 100)}">${t('pNow')} · ${pct(cur)}</button>
        <button type="button" class="ghost" data-preset="${esc(res.id)}" data-v="${Math.round(settings.recordShare * 100)}">${t('pRec')} · ${pct(settings.recordShare)}</button>
        <button type="button" class="ghost" data-preset="${esc(res.id)}" data-v="100">${t('pAll')} · 100%</button>
      </div>
      <div id="simout-${esc(res.id)}" aria-live="polite">${simOutHTML(res, val / 100)}</div>
    </section>`;
  }

  function paceTasks(res) { return res.tasks.filter(r => r.counter && !r.simpleCount && r.primary && r.primary.rate > 0 && r.task.goal); }
  function paceOutHTML(res, m) {
    const H = res.hoursLeft;
    return paceTasks(res).map(r => {
      const tk = r.task;
      const projected = tk.progress + r.primary.rate * m * H;
      const pf = Math.min(1, projected / tk.goal), frac = Math.min(1, tk.progress / tk.goal);
      const need = r.needed / r.primary.rate;
      const ok = projected >= tk.goal;
      return `<div class="sim-task"><div class="row"><span>${taskText(r)}</span><span class="${ok ? 'v-ontrack' : 'v-record'}">${fill(t('paceReach'), { p: projPct(projected / tk.goal) })}${need > 1 ? ' · ' + fill(t('paceNeed'), { m: fmt(need, 1, 1) }) : ''}</span></div>
        <div class="bar">${pf > frac ? `<div class="proj" style="left:${frac * 100}%;width:${(pf - frac) * 100}%"></div>` : ''}<div class="fill" style="width:${frac * 100}%"></div><div class="goal"></div></div></div>`;
    }).join('');
  }
  function paceHTML(res) {
    if (res.ended || !paceTasks(res).length) return '';
    const val = ui.pace[res.id] ?? 100;
    const pos = (v) => ((v - 25) / 375) * 100;
    return `<section class="panel br sim" id="pace-${esc(res.id)}">
      <div class="sec-head"><h3>${t('paceTitle')}</h3></div>
      <p class="q">${t('paceQ')}: <b data-pace-lbl="${esc(res.id)}">×${fmt(val / 100, 2)}</b></p>
      <div class="range-wrap"><span class="range-now" style="left:${pos(100)}%">${t('simNow')}</span>
        <input type="range" min="25" max="400" step="5" value="${val}" data-pace="${esc(res.id)}" aria-label="${esc(t('paceQ'))}" style="--p:${pos(val)}%"></div>
      <div class="sim-tasks" id="paceout-${esc(res.id)}">${paceOutHTML(res, val / 100)}</div>
    </section>`;
  }

  /* a move: what to do, why it matters, what it changes */
  function effectText(e, subject) {
    if (!e) return '';
    const F = (k, p) => fill(t('fx.' + k), p);
    switch (e.kind) {
      case 'eta':
        if (e.next == null || !isFinite(e.next)) return '';
        if (!isFinite(e.now)) return F('etaNever', { planet: planetName(e.planet), next: clock(e.next) });
        return e.now - e.next > 0.5 ? F('eta', { planet: planetName(e.planet), next: clock(e.next), now: clock(e.now), saved: dur(e.now - e.next) }) : '';
      case 'saves': return F('saves', { planet: planetName(e.planet), h: dur(e.hours) });
      case 'decay': return F('decay', { p: pct(e.perHour, 1) });
      case 'gap': {
        if (e.more < 100) return '';
        const N = last ? last.N : 0;
        const w = e.weaponUse ? t('meterWeapon') : '';
        if (N && e.more > N) return F('gapAll', { n: people(e.more), x: fmt(e.more / N, e.more / N < 10 ? 1 : 0) }) + w;
        return (e.hours != null ? F('gapWhen', { n: people(e.more), when: clock(e.hours) }) : F('gap', { n: people(e.more) })) + w;
      }
      case 'proj': return e.next != null && e.next > e.now + 0.005 ? F(e.next < 1 ? 'projOnly' : 'projUp', { what: subject || t('fx.it'), now: pct(e.now), next: pct(Math.min(e.next, 9.99)) }) : F('proj', { now: pct(e.now) });
      case 'region': return F('region', { p: pct(e.knock) });
      default: return '';
    }
  }
  function moveHTML(m, res) {
    const MV = tHas('mv.' + m.kind);
    if (!MV) return recItem(m, res);
    const P = (p) => planetName(p);
    const R = (k) => tHas('r.' + k);
    let p = {}, why = MV.why, extra = '';
    switch (m.kind) {
      case 'libFocus': {
        const v = m.variant === 'win' && (m.remaining || 1) <= 1 ? 'winLast' : m.variant;
        why = MV.why[v] || MV.why.more;
        p = { planet: P(m.planet), crowd: crowdText(m.players, m.nowPlayers), players: people(m.players), share: pct(m.share), nowPlayers: fmt(m.nowPlayers) };
        break;
      }
      case 'libWasted': p = { planets: listJoin(m.planets.map(P)), players: fmt(m.players), target: P(m.target) }; break;
      case 'libDecay': p = { planet: P(m.planet), done: pct(m.done), regen: big(m.regen) }; break;
      case 'libDss': p = { p: pct(settings.dssBonus), planet: P(m.planet), from: m.from ? fill(t('mvDssFrom'), { from: P(m.from) }) : '' }; break;
      case 'libRegion': p = { planet: P(m.planet), region: esc(m.region || '?'), hp: big(m.hp), regen: big(m.regen), order: m.order.map(esc).join(' → '),
        spread: m.spread ? fill(t('mvSpread'), { n: m.spread }) : '' }; break;
      case 'libHod': p = { planet: P(m.planet), be: shareOf(m.breakEven) }; break;
      case 'defSend': p = { planet: P(m.planet), when: clock(m.hours), players: people(m.players), nowPlayers: fmt(m.nowPlayers) }; break;
      case 'defWait': p = { left: fmt(m.left) }; break;
      case 'libNFocus': {
        const rest = m.list.slice(1).map(P);
        p = { planet: P(m.planet), left: fmt(m.left), then: rest.length ? fill(R('libNThen'), { list: listJoin(rest) }) : '',
          players: m.players != null ? people(m.players) : '—', share: m.share != null ? pct(m.share) : '—', nowPlayers: fmt(m.nowPlayers) };
        break;
      }
      case 'cntMove': {
        const ahead = m.aheadFrom || (m.idle ? [] : m.from), idle = m.idleFrom || (m.idle ? m.from : []);
        const parts = [];
        if (ahead.length) parts.push(fill(R('cntMoveAhead'), { from: listJoin(ahead.map(facName)), to: facName(m.to), what: counterNoun(res) }));
        if (idle.length) parts.push(fill(R(idle.length > 1 ? 'cntMoveIdleN' : 'cntMoveIdle'), { from: listJoin(idle.map(facName)), to: facName(m.to) }));
        p = { to: facName(m.to), why: parts.join(' '), weapon: '', players: people(m.players), short: m.short ? people(m.short) : '' };
        if (m.short) { why = t('mv.cntMoveShortWhy'); }
        break;
      }
      case 'cntShort': p = { to: facName(m.to), players: people(m.players) }; break;
      case 'cntBehind': p = { task: taskText(m.task), mult: fmt(1 + m.more, 1, 1), weapon: '', needed: big(m.needed), rate: big(m.rate) }; break;
      case 'cntWeapon': p = { item: esc(itemName(m.task.task.itemId) || '') }; break;
      case 'cntStart': p = { task: taskText(m.task), needed: big(m.needed) }; break;
    }
    const subj = m.task && m.task.task ? taskNoun(m.task.task) : null;
    let fx = effectText(m.effect, subj);
    if (m.kind === 'cntMove' && m.short) { const g = effectText({ kind: 'gap', more: m.short, weaponUse: m.shortWeaponUse }); if (g) fx = fx ? fx + '. ' + g : g; }
    const nums = MV.nums != null ? MV.nums : (R(m.kind) || [])[2] || '';
    return `<li class="move lvl-${res.verdict === 'nearly_impossible' && (m.level === 'critical' || m.level === 'high') ? 'long' : m.level || 'tip'}">
      <div class="mv-top"><span class="lvl">${esc(t('lv.' + (res.verdict === 'nearly_impossible' && (m.level === 'critical' || m.level === 'high') ? 'long' : m.level || 'tip')))}</span><h4>${fill(m.kind === 'cntMove' && m.short ? t('mv.cntMoveShortHead') : MV.head, p)}</h4></div>
      <p class="mv-why">${fill(why, p)}</p>
      ${m.weapon && (m.kind === 'cntMove' || m.kind === 'cntShort') ? `<p class="mv-req"><span class="label">${esc(t('mvReq'))}</span><b>${esc(itemName(m.weapon))}</b><span>${esc(t('mvReqS'))}</span></p>` : ''}
      ${fx ? `<p class="mv-fx">${ICON.target}<span>${fx}</span></p>` : ''}
      ${nums ? `<div class="nums">${fill(nums, p)}</div>` : ''}${extra}</li>`;
  }

  /* when the order can't be won: say so, and show how it got there instead of a plan */
  function storyFacts(entry) {
    const { res } = entry;
    const counters = res.tasks.filter(r => r.counter && !r.simpleCount && r.task.goal && r.verdict !== 'done' && r.primary && r.needed > 0)
      .map(r => ({ r, f: counterFacts(entry, r) })).sort((a, b) => (a.r.primary.rate / a.r.needed) - (b.r.primary.rate / b.r.needed));
    return { worst: counters[0] || null, counters };
  }
  function tile(label, value, sub, cls = '') {
    return `<div class="pm-tile ${cls}"><span class="label">${esc(label)}</span><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  }
  function factsHTML(entry, compact) {
    const { res } = entry, { worst } = storyFacts(entry), lib = res.liberation;
    const tiles = [];
    if (worst) {
      const { r, f } = worst, noun = plain(taskNoun(r.task));
      if (f.fromStart && !compact) tiles.push(tile(t('pm.tStart'), big(f.fromStart) + '<small>/h</small>', esc(fill(t('pm.tStartS'), { what: noun }))));
      const day = r.primary && r.primary.kind === 'day';
      tiles.push(tile(t(day ? 'pm.tDay' : 'pm.tAvg'), big(f.avg) + '<small>/h</small>', f.fromStart ? esc(fill(t('pm.tAvgS'), { p: pct(f.avg / f.fromStart) })) : ''));
      if (f.best > f.avg * 1.05) tiles.push(tile(t('pm.tBest'), big(f.best) + '<small>/h</small>', esc(t('pm.tBestS'))));
      tiles.push(tile(t('pm.tNeed'), big(f.needed) + '<small>/h</small>', esc(fill(t('pm.tNeedS'), { x: fmt(f.needed / f.avg, 1, 1) })), 'key'));
    } else if (lib && isFinite(lib.currentShare)) {
      // in Helldivers, as everywhere else on the page; the share of everyone online underneath
      tiles.push(tile(t('pm.tPlNow'), people(lib.currentShare * res.model.N), esc(fill(t('pm.tPlNowS'), { p: pct(lib.currentShare) }))));
      tiles.push(tile(t('pm.tPlNeed'), people((isFinite(lib.seqNeed) ? lib.seqNeed : 5) * res.model.N), esc(fill(t('pm.tPlNeedS'), { x: sharePct(lib.seqNeed) })), 'key'));
      tiles.push(tile(t('pm.tRecord'), people(settings.recordShare * res.model.N), esc(fill(t('pm.tRecordS'), { p: pct(settings.recordShare) }))));
    }
    return tiles.length ? `<div class="pm-tiles">${tiles.join('')}</div>` : '';
  }
  function storyHTML(entry) {
    const { res, a } = entry, { worst } = storyFacts(entry);
    const items = [];
    const at = (ms) => new Date(ms).toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    const end = Date.parse(a.expiration);
    const fromDayOne = worst && worst.f.ponr && entry.start && worst.f.ponr - entry.start < 3.6e6;
    if (entry.start && worst) items.push({ t: entry.start, cls: fromDayOne ? 'bad' : '', html: fill(t(fromDayOne ? 'pm.sStartOut' : 'pm.sStart'), { need: worst.f.fromStart ? big(worst.f.fromStart) : '—', best: big(worst.f.best), what: esc(`${facName(worst.r.task.faction)} ${t('what')[worst.r.task.type] || ''}`.trim()) }) });
    else if (entry.start) items.push({ t: entry.start, html: fill(t(res.tasks.length === 1 ? 'pm.sStartAny1' : 'pm.sStartAny'), { d: dur((end - entry.start) / 3.6e6), n: res.tasks.length }) });
    for (const x of alerts.filter(al => al.kind === 'edited' && al.order === String(a.id))) items.push({ t: x.t, html: alertText(x, false) });
    if (worst && worst.f.ponr && !fromDayOne) items.push({ t: worst.f.ponr, cls: 'bad', html: fill(t('pm.sPonr'), { best: big(worst.f.best) }) });
    const lib = res.liberation;
    if (!worst && lib && isFinite(lib.currentShare)) items.push({ t: last.now, cls: 'now', html: fill(t('pm.sNowLib'), { need: people((isFinite(lib.seqNeed) ? lib.seqNeed : 5) * res.model.N), rec: pct(settings.recordShare), recN: people(settings.recordShare * res.model.N) }) });
    for (const r of res.tasks.filter(x => x.verdict === 'done')) items.push({ t: last.now - 1, cls: 'ok', html: fill(t('pm.sDone'), { task: taskText(r) }) });
    if (worst) items.push({ t: last.now, cls: 'now', html: fill(t('pm.sNow'), { p: projPct(worst.r.projection / worst.r.task.goal) }) });
    if (!items.length) return '';
    items.sort((x, y) => x.t - y.t);
    return `<ol class="pm-story">${items.map(it => `<li class="${it.cls || ''}"><span class="when">${esc(it.cls === 'now' ? t('h.now') : it.cls === 'ok' ? t('pm.so') : at(it.t))}</span><p>${it.html}</p></li>`).join('')}</ol>`;
  }
  function postmortemHTML(entry) {
    const { res } = entry, lost = res.ended || res.verdict === 'failed';
    return `<section class="plan postmortem" id="steps-${esc(res.id)}">
      <div class="pm-head">${ICON.cross}<div><h3>${esc(t(lost ? 'pm.lostTitle' : 'pm.title'))}</h3><p>${esc(t(lost ? 'pm.lostSub' : 'pm.sub'))}</p></div></div>
      ${factsHTML(entry)}
      <h4 class="mod-h">${esc(t('pm.howTitle'))}</h4>${storyHTML(entry)}
      <button type="button" class="ghost" data-goto="history" data-scroll="tabs">${esc(t('pm.chart'))} ›</button>
      <div class="pm-still"><h4 class="mod-h">${esc(t('pm.stillTitle'))}</h4><p>${esc(t(lost ? 'pm.stillLost' : 'pm.still'))}</p></div>
    </section>`;
  }
  function strategyHTML(res, entry) {
    if (entry && (res.verdict === 'impossible' || res.verdict === 'failed' || (res.ended && res.verdict !== 'done'))) return postmortemHTML(entry);
    const longShot = entry && res.verdict === 'nearly_impossible' ? `<div class="longshot"><div class="pm-head small">${ICON.warn}<div><h3>${esc(t('pm.longTitle'))}</h3><p>${esc(t('pm.longSub'))}</p></div></div>${factsHTML(entry, true)}</div>` : '';
    const recs = res.recs || [];
    const assess = recs.filter(r => ASSESS.has(r.kind));
    const fine = recs.filter(r => FINE.has(r.kind));
    const order = recs.find(r => r.kind === 'libOrder');
    const all = recs.filter(r => !ASSESS.has(r.kind) && !FINE.has(r.kind) && r.kind !== 'libOrder');
    // the moves that decide the outcome up front, the rest folded away
    const main = all.filter(r => r.level === 'critical' || r.level === 'high').slice(0, 4);
    const tips = all.filter(r => !main.includes(r));
    const moves = main.length ? main : tips.splice(0, 3);
    const sitCls = assess.some(r => r.kind === 'libImpossible') ? 'k-bad' : 'k-warn';
    const lostNow = res.verdict === 'impossible' || (res.directive && res.directive.kind === 'lost');
    const across = crossHTML();
    return `<section class="plan ${ui.showNums ? 'show-nums' : ''}" id="steps-${esc(res.id)}">
        ${longShot}
        <div class="sec-head"><h3>${t('planTitle')}</h3>
          <button type="button" class="ghost" data-toggle-nums aria-pressed="${ui.showNums}">${ui.showNums ? t('hideNums') : t('showNums')}</button></div>
        ${across}
        ${moves.length ? `<ol class="moves">${moves.map(r => moveHTML(r, res)).join('')}</ol>
          ${tips.length ? `<details class="more-tips"><summary>${ICON.chev}<span>${fill(t('moreTips'), { n: tips.length })}</span></summary><ol class="moves minor" style="counter-reset: mv ${moves.length}">${tips.map(r => moveHTML(r, res)).join('')}</ol></details>` : ''}`
          : res.directive && res.directive.kind === 'play' ? `<p class="empty-moves unknown">${ICON.dots}<span>${t('noMovesUnknown')}</span></p>`
          : res.ended && res.verdict !== 'done' ? `<p class="empty-moves lost">${ICON.cross}<span>${t('noMovesEnded')}</span></p>`
          : lostNow ? `<p class="empty-moves lost">${ICON.cross}<span>${t('noMovesLost')}</span></p>` : `<p class="empty-moves">${ICON.check}<span>${t(res.verdict === 'done' ? 'noMovesDone' : 'noMoves')}</span></p>`}
        ${assess.length || order ? `<h4 class="mod-h">${t('bigPicture')}</h4>` : ''}
        ${assess.length ? `<div class="situation ${sitCls}"><h5 class="sit-h">${t('sitTitle')}</h5>${assess.map(r => recItem(r, res, 'div')).join('')}</div>` : ''}
        ${order ? `<div class="the-plan"><h5 class="sit-h">${t(order.partial ? 'planBlockPartial' : res.liberation && !res.liberation.winnableNow ? 'planBlockIf' : 'planBlock')}</h5>
          <p>${order.segs.map((s, i) => fill(t(i ? 'orderThen' : 'orderFirst'), { a: planetName(s.planet) })).join('')}.</p>${timelineHTML(order.segs, order.H, `plan:${res.id}`, res)}</div>` : ''}
        ${fine.length && res.verdict !== 'done' ? `<details class="more-tips fine-box"><summary>${ICON.chev}<span>${fill(t('fineN'), { n: fine.length })}</span></summary><ul class="fine">${fine.map(r => recItem(r, res, 'li', ICON.check)).join('')}</ul></details>` : ''}
      </section>
      ${simHTML(res) || paceHTML(res) ? `<details class="sim-box" data-simbox="${esc(res.id)}" ${ui.simOpen[res.id] ? 'open' : ''}><summary>${ICON.chev}<span>${t('simBox')}</span></summary>${simHTML(res)}${paceHTML(res)}</details>` : ''}`;
  }

