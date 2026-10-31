  /* ---------- view ---------- */
  const TABS = ['objectives', 'strategy', 'history', 'intel'];
  function viewHTML(entry) {
    const { a, res, start } = entry;
    let tab = ui.tab[a.id] || 'objectives';
    if (tab === 'data') tab = 'history';
    if (!TABS.includes(tab)) tab = 'objectives';
    const panel = tab === 'strategy' ? strategyHTML(res, entry) : tab === 'history' ? historyHTML(entry) : tab === 'intel' ? intelTabHTML(entry) : objectivesHTML(res);
    const ic = intelCount(entry);
    const label = { objectives: t('tObj'), strategy: t('tStrat'), history: t('tHist'), intel: t('tIntel') + (ic.n ? ` <span class="tab-badge ${ic.level}">${ic.n}</span>` : '') };
    return `<div class="order" data-order="${esc(a.id)}">
      ${directiveHTML(res)}
      ${railHTML(res, a)}
      <div class="area-tabs" id="tabs-${esc(a.id)}">
        <div class="tabbar">
          <div class="tabs" role="tablist" aria-label="${esc(clean(txt(a.title) || 'Major Order'))}">${TABS.map((k, i) => `<button type="button" role="tab" class="tab" id="tab-${esc(a.id)}-${k}" data-tab="${k}" aria-selected="${tab === k}" aria-controls="tp-${esc(a.id)}" tabindex="${tab === k ? 0 : -1}">${label[k]}</button>`).join('')}</div>
        </div>
        <div class="tabpanel" id="tp-${esc(a.id)}" role="tabpanel" aria-labelledby="tab-${esc(a.id)}-${tab}">${panel}</div>
      </div>
    </div>`;
  }

  // where the keyboard focus is, as a selector that still matches after the view is rebuilt
  function focusSelector() {
    const el = document.activeElement;
    if (!el || el === document.body || !(el.closest('#view') || el.closest('#order-tabs'))) return null;
    if (el.id) return '#' + CSS.escape(el.id);
    for (const k of ['sim', 'pace', 'copy', 'goto', 'preset', 'brief']) if (el.dataset[k] != null) return `[data-${k}="${CSS.escape(el.dataset[k])}"]${k === 'preset' ? `[data-v="${CSS.escape(el.dataset.v)}"]` : k === 'goto' && el.dataset.scroll ? '[data-scroll]' : k === 'goto' ? ':not([data-scroll])' : ''}`;
    const det = el.closest('details[data-intel]');
    if (det) return `details[data-intel="${CSS.escape(det.dataset.intel)}"] > summary`;
    if (el.hasAttribute('data-toggle-nums')) return '[data-toggle-nums]';
    return null;
  }
  function renderStale() {
    const box = $('stale'); if (!box) return;
    const st = last && last.stale;
    // the live data is fine but the recorder has stopped: history, Joel's moves and the archive are behind
    const recOld = record && record.t && Date.now() - record.t > 2 * 3.6e6 ? record.t : null;
    if (!st && recOld) {
      const h = (Date.now() - recOld) / 3.6e6;
      box.innerHTML = `<div class="stale-bar soft" role="status">${ICON.warn}<p>${fill(t('recStale'), { ago: esc(h < 48 ? fill(t('staleH'), { n: fmt(h, h < 10 ? 1 : 0) }) : fill(t('staleD'), { n: fmt(h / 24, 0) })) })}</p></div>`;
      return;
    }
    if (!st) { box.innerHTML = ''; return; }
    const mins = Math.max(1, Math.round((Date.now() - st.t) / 60e3));
    const ago = mins < 90 ? fill(t('staleMin'), { n: mins }) : fill(t('staleH'), { n: fmt(mins / 60, 1) });
    box.innerHTML = `<div class="stale-bar" role="status">${ICON.warn}<p>${fill(t('stale'), { when: esc(new Date(st.t).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })), ago: esc(ago), src: esc(t(st.src === 'official' ? 'staleOff' : 'staleCom')) })}</p></div>`;
  }
  /* ---------- archive: every Major Order, and whether it was winnable ---------- */
  let archive = null, archiveT = 0, archiveBusy = false, archiveFail = 0;
  async function loadArchive() {
    if (archiveBusy || (archive && Date.now() - archiveT < 30 * 60e3) || (!archive && Date.now() - archiveFail < 60e3)) return;
    archiveBusy = true;
    try {
      const r = await fetch(RECORD + 'archive.json?t=' + Math.floor(Date.now() / 600e3), { cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      if (j && Array.isArray(j.orders)) { archive = j; archiveT = Date.now(); } else archiveFail = Date.now();
    } catch { archiveFail = Date.now(); } finally { archiveBusy = false; }
    if (ui.view === 'archive') render();
  }
  const CALL_ORDER = ['ontrack', 'focus', 'effort', 'hard', 'record', 'nearly_impossible', 'impossible'];
  const callGroup = (v) => v === 'impossible' ? 'impossible' : v === 'nearly_impossible' ? 'long' : v === 'hard' || v === 'record' ? 'hard' : v ? 'fair' : null;
  // an order's name for the record: the game's title, or (when that is just "MAJOR ORDER") what it asked
  const TASK_OBJ = { 1: 'Extraction', 2: 'Samples', 3: 'Eradicate', 4: 'Objectives', 5: 'Missions', 6: 'Equipment', 7: 'Missions', 9: 'Operations', 10: 'Donation', 11: 'Liberate', 12: 'Defend', 13: 'Hold', 14: 'Liberate', 15: 'Liberate' };
  const noItem = (s) => s.replace(new RegExp(` ${t('with')} ${t('item')} #\\d+`, 'g'), ' ' + t('ar.withW'));
  // short: for a headline (the share image), where the objectives are listed just below anyway
  function orderName(o, short = false) {
    const nm = String(o.name || '').replace(/^\s*(major|minor) order\s*[|:\-–]\s*/i, '').trim();
    if (nm && !/^(major|minor) order$/i.test(nm)) return titleCase(nm);
    const ts = (o.tasks || []).map(tk => ENGINE.parseTask(tk, 0));
    if (short && ts.length > 1) {
      const long = orderName({ ...o, name: '' });
      if (long.length <= 44) return long;
      const fronts = new Set(ts.map(tk => tk.faction).filter(f => f && f !== 'Humans')).size;
      return ts.every(tk => tk.type === 3) && fronts > 1 ? fill(t('ar.killFronts'), { n: fronts }) + (ts.some(tk => tk.itemId) ? ' ' + t('ar.withW') : '') : fill(t('ar.nObj'), { n: ts.length });
    }
    if (ts.length && ts.every(tk => tk.type === 3)) {
      // "Kill 150M Terminids · 32.5M Illuminate · 50M Automatons"
      const w = ts.some(tk => tk.itemId) ? ' ' + t('ar.withW') : '';
      return `${t('kill')} ${ts.map(tk => `${big(tk.goal)} ${tk.enemyId ? enemyName(tk.enemyId) : tk.faction && tk.faction !== 'Humans' ? plain(facPlural(tk.faction)) : t('enemies')}`).join(' · ')}${w}`;
    }
    if (ts.length) return noItem(ts.map(tk => plain(taskText({ task: tk, planet: tk.planetIndex != null ? { index: tk.planetIndex, name: (last && last.planets[tk.planetIndex] || {}).name || '#' + tk.planetIndex } : null }))).join(' · '));
    const b = plain(String(o.brief || '')).split(/(?<=[.!?])\s/)[0];
    return b && b.length > 12 ? (b.length > 90 ? b.slice(0, 88).replace(/\s\S*$/, '') + '…' : b.replace(/[.!]$/, '')) : t('ar.unnamed');
  }
  const orderObj = (o) => o.obj || [...new Set((o.tasks || []).map(tk => TASK_OBJ[tk.type]).filter(Boolean))].join('/');
  function archiveHTML() {
    if (!archive) { loadArchive(); return `<section class="arch"><div class="ar-head"><button type="button" class="ghost" data-view="war">← ${esc(t('ar.back'))}</button></div><p class="arch-load">${ICON.dots}<span>${esc(t(archiveFail ? 'ar.notYet' : 'ar.loading'))}</span></p></section>`; }
    const now = Date.now();
    const running = new Set((last && last.results || []).map(x => String(x.a.id)));
    const starts = (last && last.results || []).map(x => x.start).filter(Boolean);
    const GROUPS = ['fair', 'hard', 'long', 'impossible'];
    const all = archive.orders.map(o => {
      const live = (o.watchedId && running.has(String(o.watchedId))) || (o.start && starts.some(st => Math.abs(st - o.start) < 3 * 3.6e6));
      // no result on record long after it ended: say so rather than "result due"
      const result = o.result || (live ? 'running' : o.end && now - o.end > 12 * 3.6e6 ? 'unknown' : 'pending');
      // a check made after the order had been running for hours (first seen late) is no day-one check
      const c0 = o.call && !o.call.late ? o.call : o.retro || null;
      const c = c0 && c0.v && c0.v !== 'unknown' ? c0 : null;
      const defendOnly = /^(defend|hold|control|repel)([\/, ]+(defend|hold|control|repel))*$/i.test(String(o.obj || '').trim());
      const noWhy = !c && result === 'lost' ? (['noTargets', 'noStart', 'notHeld', 'fewTargets', 'type', 'defend'].includes(o.noRetro) ? (o.noRetro === 'type' && defendOnly ? 'defend' : o.noRetro) : o.noRetro ? 'data' : defendOnly ? 'defend' : 'type') : null;
      return { ...o, result, cl: c, live: !!c && c === o.call, grp: c ? callGroup(c.v) : null, noWhy };
    });
    const done = all.filter(o => o.result === 'won' || o.result === 'lost');
    const won = done.filter(o => o.result === 'won').length, lost = done.length - won;
    const yr = done.filter(o => (o.end || o.start) > now - 365 * 24 * 3.6e6), yrWon = yr.filter(o => o.result === 'won').length;
    let streak = 0, sk = null; for (const o of [...done].sort((a, b) => (b.end || b.start) - (a.end || a.start))) { if (sk === null) sk = o.result; if (o.result !== sk) break; streak++; }
    // the defeats, checked: could each one have been won?
    const defeats = all.filter(o => o.result === 'lost');
    const G = { fair: 0, hard: 0, long: 0, impossible: 0, none: 0 }; defeats.forEach(o => G[o.grp || 'none']++);
    const checked = defeats.length - G.none;
    const FILTERS = ['all', 'won', 'lost', ...GROUPS.map(g => 'g-' + g), 'g-none'];
    const f = FILTERS.includes(ui.af) ? ui.af : 'all';
    const match = (o) => f === 'all' || (f.startsWith('g-') ? o.result === 'lost' && (o.grp || 'none') === f.slice(2) : o.result === f);
    const list = all.filter(match);
    const pctx = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
    const day = (ms) => ms ? new Date(ms).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const first = all.length ? Math.min(...all.map(o => o.start || o.end || now)) : now;
    // 1. the record in one line
    const stats = `<dl class="ar-stats">
      <div><dt>${esc(t('ar.total'))}</dt><dd>${fmt(all.length)}</dd></div>
      <div class="ok"><dt>${esc(t('ar.won'))}</dt><dd>${fmt(won)} <small>${pctx(won, done.length)}</small></dd></div>
      <div class="bad"><dt>${esc(t('ar.lost'))}</dt><dd>${fmt(lost)} <small>${pctx(lost, done.length)}</small></dd></div>
      <div><dt>${esc(t('ar.year'))}</dt><dd>${pctx(yrWon, yr.length)} <small>${esc(t('ar.wonS'))}</small></dd></div>
      <div><dt>${esc(t('ar.streak'))}</dt><dd>${streak} <small>${esc(t(sk === 'won' ? 'ar.streakW' : 'ar.streakL'))}</small></dd></div>
    </dl>`;
    // 2. the question this page is for, answered
    const out = G.impossible + G.long;
    const head = !checked ? t('ar.hNone') : out ? fill(t(out === 1 ? 'ar.hOut1' : 'ar.hOut'), { n: out, c: checked }) : fill(t('ar.hFair'), { c: checked });
    const sub = checked ? [out ? fill(t('ar.hSubOut'), { i: G.impossible, l: G.long }) : '', G.hard ? fill(t(G.hard === 1 ? 'ar.hSubRec1' : 'ar.hSubRec'), { n: G.hard }) : '', G.fair ? fill(t(G.fair === 1 ? 'ar.hSubWin1' : 'ar.hSubWin'), { n: G.fair }) : ''].filter(Boolean).join(' ') : '';
    const seg = (g) => G[g] ? `<button type="button" class="sb-seg cg-${g}" style="flex:${G[g]}" data-af="g-${g}" aria-pressed="${f === 'g-' + g}" aria-label="${esc(G[g] + ' ' + t('ar.g.' + g))}"></button>` : '';
    const verdict = `<section class="ar-verdict">
      <span class="label">${esc(t('ar.q'))}</span>
      <p class="sb-head">${esc(head)}</p>
      ${sub ? `<p class="sb-sub">${esc(sub)}</p>` : ''}
      <div class="sb-bar" role="group" aria-label="${esc(fill(t('ar.chkA'), { n: defeats.length }))}">${[...GROUPS, 'none'].map(seg).join('')}</div>
      <ul class="sb-key">${[...GROUPS, 'none'].filter(g => G[g] || g !== 'none').map(g => `<li class="cg-${g}"><button type="button" data-af="g-${g}" aria-pressed="${f === 'g-' + g}"><i></i><b>${G[g]}</b><span>${esc(t('ar.g.' + g))}</span><small>${esc(t('ar.gs.' + g))}</small></button></li>`).join('')}</ul>
      <details class="ar-how"><summary>${esc(t('ar.howT'))}</summary>
        <ul>${t('ar.howL').map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <p class="ar-small">${esc(t('ar.howN'))}</p></details>
    </section>`;
    // 3. how right the forecasts are: replayed on the war's records, and checked live
    const A = archive.accuracy || {};
    const accuracy = (() => {
      const L = A.backtest?.lib, C = A.backtest?.cnt, live = A.live, M = A.measured || {};
      if (!L && !C) return '';
      const cell = (m) => `<div role="cell">${m && m.n ? `<b>${pct(m.within25)}</b><small>${esc(fill(t('acc.miss'), { h: fmt(m.medErrH, 1) }))}</small>` : '—'}</div>`;
      const row = (hz, m, p) => `<div role="row"><div class="acc-l" role="rowheader">${esc(fill(t('acc.hz'), { h: hz }))}</div>${cell(m)}${cell(p)}</div>`;
      const liveN = live ? Object.values(live.lib || {}).reduce((a, x) => a + (x.n || 0), 0) + (live.cnt?.n || 0) + (live.verdicts || []).length : 0;
      const meas = (k, lbl, wiki) => {
        const x = M[k] || { n: 0 };
        // Heavy Ordnance never switched on since recording began: say so, rather than "waiting (0 so far)"
        const v = x.x != null ? '×' + fmt(x.x, 2) : k.startsWith('hod') && M.seen && !M.seen.hod ? t('acc.noHod') : fill(t('acc.wait'), { n: x.n || 0 });
        const on = x.kind ? ' · ' + t('acc.on.' + x.kind) : '';
        return `<li><span>${esc(t(lbl))}</span><b>${esc(v)}</b><small>${esc(wiki + on)}</small></li>`; };
      return `<section class="ar-acc" aria-labelledby="acc-t">
        <span class="label">${esc(t('acc.kicker'))}</span>
        <h3 id="acc-t">${esc(t('acc.title'))}</h3>
        <p class="sb-sub">${esc(t('acc.sub'))}</p>
        <div class="acc-grid">
          ${L ? `<div class="acc-card"><h4>${esc(t('acc.libT'))}</h4>
            <div class="acc-t" role="table" aria-label="${esc(t('acc.libT'))}"><div role="row"><div role="columnheader"><span class="sr-only">${esc(t('acc.hzH'))}</span></div><div class="acc-h" role="columnheader">${esc(t('acc.model'))}</div><div class="acc-h" role="columnheader">${esc(t('acc.pace'))}</div></div>${[6, 12, 24].map(hz => row(hz, L.model?.[hz], L.pace?.[hz])).join('')}</div>
            <p class="ar-small">${esc(fill(t('acc.libN'), { n: L.planets }))}</p></div>` : ''}
          ${C && C.n ? `<div class="acc-card"><h4>${esc(t('acc.cntT'))}</h4>
            <p class="acc-big"><b>${pct(C.calledRight)}</b> ${esc(fill(t('acc.cntRight'), { n: C.n }))}</p>
            <p class="ar-small">${esc(fill(t('acc.cntNote'), { w: C.missedWins, l: C.missedLosses, e: C.medErrPts }))}</p></div>` : ''}
          <div class="acc-card"><h4>${esc(t('acc.liveT'))}</h4>
            ${liveN ? `<ul class="acc-live">${[6, 12, 24].filter(hz => live.lib?.[hz]?.n).map(hz => `<li>${esc(fill(t('acc.liveLib'), { h: hz, n: live.lib[hz].n, p: pct(live.lib[hz].within25), m: fmt(live.lib[hz].medErrH, 1) }))}</li>`).join('')}
              ${live.cnt?.n ? `<li>${esc(fill(t('acc.liveCnt'), { n: live.cnt.n, p: pct(live.cnt.calledRight) }))}</li>` : ''}
              ${(live.verdicts || []).map(v => `<li>${esc(fill(t('acc.liveV'), { title: titleCase(v.title || 'Major Order'), v: t('ar.g.' + callGroup(v.v)), r: t('ar.r.' + v.result) }))}</li>`).join('')}</ul>`
              : `<p class="ar-small">${esc(t('acc.liveNone'))}</p>`}
            <h4 class="acc-sub">${esc(t('acc.measT'))}</h4>
            <ul class="acc-meas">${meas('dss', 'acc.mDss', t('acc.mDssW'))}${meas('hodDss', 'acc.mHod', t('acc.mHodW'))}${meas('hodOther', 'acc.mHodO', t('acc.mHodOW'))}${meas('regionBonus', 'acc.mReg', t('acc.mRegW'))}</ul></div>
        </div>
        <details class="ar-how"><summary>${esc(t('acc.howT'))}</summary><ul>${t('acc.howL').map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>
      </section>`;
    })();
    const tools = `<div class="ar-tools"><h3>${esc(t('ar.listT'))}</h3><div class="nk-filter ar-filter" role="group" aria-label="${esc(t('nw.filter'))}">${['all', 'won', 'lost'].map(k => `<button type="button" data-af="${k}" aria-pressed="${f === k || (k === 'lost' && f.startsWith('g-'))}">${esc(t('ar.f.' + k))}</button>`).join('')}</div>
      ${f.startsWith('g-') ? `<p class="ar-fnow">${esc(fill(t('ar.fNow'), { what: t('ar.g.' + f.slice(2)), n: list.length }))} <button type="button" class="linkish" data-af="all">${esc(t('ar.fClear'))}</button></p>` : ''}</div>`;
    // the bar an order sat on: share of everyone needed (liberation) or best-day pace vs goal (counts)
    const meter = (x, marks, max, g, label) => `<div class="ar-meter cg-${g}" role="img" aria-label="${esc(label)}"><i style="width:${(Math.min(max, x) / max * 100).toFixed(1)}%"></i>${marks.map(s => `<s style="left:${(s / max * 100).toFixed(1)}%" data-l="${Math.round(s * 100)}%"></s>`).join('')}</div>`;
    const goalTxt = (g) => noItem(plain(taskText({ task: { type: g.type, goal: g.goal, faction: g.f, itemId: g.item, enemyId: g.enemy, planetIndex: null, sectorIndex: null }, planet: null })));
    function detailOf(o) {
      const c = o.cl;
      if (!c) {
        if (!o.noWhy) return '';
        const fx = o.facts || {}, lines = [];
        if (fx.held) lines.push(fx.held.fell.length ? fill(t('ar.fxFell'), { p: fx.held.fell.map(x => titleCase(x.n)).join(', '), when: day(fx.held.fell[0].t) }) : t('ar.fxHeld'));
        return `<div class="ar-det">${lines.map(l => `<p class="ar-lead">${esc(l)}</p>`).join('')}<p class="ar-small">${esc(t('ar.no.' + o.noWhy))}</p></div>`;
      }
      const g = o.grp, out = [];
      // the verdict in words first, then the evidence, then where it comes from
      if (c.src === 'attacks' && c.facts?.attacks) {
        const a = c.facts.attacks;
        out.push(`<p class="ar-lead"><b class="cg-${g}">${esc(t('ar.g.' + g))}.</b> ${esc(fill(t(a.came < a.need ? 'ar.atkNo' : 'ar.atkOk'), { need: a.need, came: a.came, won: a.won }))}</p>`);
        out.push(meter(a.came / a.need, [1], 2, g, fill(t('ar.atkA'), { came: a.came, need: a.need })));
        if (c.facts.held?.fell?.length) out.push(`<p>${esc(fill(t('ar.fxFell'), { p: c.facts.held.fell.map(x => titleCase(x.n)).join(', '), when: day(c.facts.held.fell[0].t) }))}</p>`);
      } else if (c.cap != null) {
        out.push(`<p class="ar-lead"><b class="cg-${g}">${esc(t('ar.g.' + g))}.</b> ${fill(esc(t('ar.cap.' + g)), { p: `<b>${pct(c.cap)}</b>` })}</p>`);
        out.push(meter(c.cap, [0.5, 1, 1.3], 1.6, g, fill(t('ar.capA'), { p: pct(c.cap) })));
        if ((c.goals || []).length) out.push(`<ul>${c.goals.map(x => `<li><b>${esc(goalTxt(x))}</b><span>${esc(x.got >= x.goal ? t('ar.gDone') : fill(t('ar.gGot'), { got: pct(x.goal ? x.got / x.goal : 0), cap: x.cap != null ? pct(x.cap) : '—' }))}</span></li>`).join('')}</ul>`);
      } else {
        const inf = c.need == null && c.v === 'impossible';
        out.push(`<p class="ar-lead"><b class="cg-${g}">${esc(t('ar.g.' + g))}.</b> ${inf ? esc(t('ar.needInf')) : fill(esc(t((c.counts ? 'ar.needC.' : 'ar.need.') + g)), { p: `<b>${pct(c.need)}</b>` })}</p>`);
        out.push(meter(inf ? 1.2 : c.need || 0, [0.6, 0.77, 1], 1.2, g, inf ? t('ar.mInf') : fill(t('ar.mA'), { p: pct(c.need) })));
        if ((c.goals || []).length) out.push(`<ul>${c.goals.map(x => `<li><b>${esc(goalTxt(x))}</b><span>${esc(x.got >= x.goal ? t('ar.gDone') : fill(t(x.need != null ? 'ar.gGotN' : 'ar.gGot'), { got: pct(x.goal ? x.got / x.goal : 0), cap: x.cap != null ? pct(x.cap) : '—', need: pct(x.need) }))}</span></li>`).join('')}</ul>`);
        if (c.players && !c.counts) out.push(`<p>${esc(fill(t('ar.atLaunch'), { n: people(c.players), d: dur(c.hours || 0) }))}</p>`);
        if ((c.targets || []).length) out.push(`<ul>${c.targets.map(p => `<li><b>${esc(titleCase(p.n))}</b><span>${esc(fill(t('ar.detP'), { hp: pct(p.max ? p.hp / p.max : 1, 0), regen: pct(p.max ? (p.r * 3600) / p.max : 0, 1), pl: people(p.pl || 0), o: plain(facName(p.o) || p.o || '') }))}</span></li>`).join('')}</ul>`);
      }
      const notes = [c.loose ? t('ar.detLoose') : c.anyOf ? t('ar.detAny') : '', c.count && c.pool === 'faction' ? fill(t('ar.detCount'), { n: c.count, f: plain(facName(c.fac) || c.fac || '') }) : c.count && c.pool === 'named' ? fill(t('ar.detCountN'), { n: c.count }) : '', c.partial ? t('ar.detPartial') : ''].filter(Boolean);
      const src = o.live ? fill(t('ar.srcLive'), { age: dur(c.age || 3) }) : t('ar.src.' + (c.src === 'hs' ? 'hs' : c.src === 'attacks' ? 'attacks' : 'log'));
      return `<div class="ar-det">${out.join('')}<p class="ar-small">${esc([...notes, src].join(' '))}</p></div>`;
    }
    let rows = '', curY = null;
    for (const o of list.slice(0, 300)) {
      const y = new Date(o.start || o.end || now).getFullYear();
      if (y !== curY) { rows += `${curY ? '</ul>' : ''}<h5 class="fd-day" aria-level="4">${y}</h5><ul class="ar-list">`; curY = y; }
      const durH = o.start && o.end ? (o.end - o.start) / 3.6e6 : null;
      const res = o.result || 'unknown';
      const detail = detailOf(o);
      const tag = o.cl ? `<span class="ar-call cg-${o.grp}">${esc(t('ar.g.' + o.grp))}</span>` : o.noWhy ? `<span class="ar-call cg-none">${esc(t('ar.g.none'))}</span>` : '<span></span>';
      rows += `<li class="r-${res} ${detail ? 'has-det' : ''}">${detail ? '<details><summary>' : ''}
        <span class="ar-res">${ICON[res === 'won' ? 'trophy' : res === 'lost' ? 'cross' : res === 'running' ? 'target' : 'dots']}</span>
        <div class="ar-main"><b>${esc(orderName(o))}</b>
          <span class="ar-meta">${o.code ? `<span class="ar-code">${esc(o.code)}</span>` : ''}${orderObj(o) ? `<span>${esc(orderObj(o))}</span>` : ''}<span>${esc(day(o.start))}${durH ? ' · ' + esc(dur(durH)) : ''}</span></span></div>
        ${tag}<span class="ar-badge">${esc(t('ar.r.' + res))}</span>${detail ? `</summary>${detail}</details>` : ''}</li>`;
    }
    rows += curY ? '</ul>' : '';
    return `<section class="arch">
      <div class="ar-head"><button type="button" class="ghost" data-view="war">← ${esc(t('ar.back'))}</button>
        <div><h2>${esc(t('ar.title'))}</h2><p>${esc(fill(t('ar.sub'), { when: day(first) }))}</p></div></div>
      ${stats}${verdict}${accuracy}${tools}
      <div class="feed">${rows || `<p class="ar-note">${esc(t('ar.empty'))}</p>`}</div>
      <p class="foot">${esc(fill(t('ar.foot'), { when: archive.upTo ? day(archive.upTo) : '—' }))}</p>
    </section>`;
  }
  function render(opts = {}) {
    if (!last) return;
    const keepFocus = focusSelector();
    renderHud();
    renderStale();
    $('open-archive').setAttribute('aria-pressed', String(ui.view === 'archive'));
    if (ui.view === 'archive') {
      $('order-tabs').hidden = true; $('cross').innerHTML = ''; $('intel').innerHTML = '';
      $('view').innerHTML = archiveHTML();
      document.title = `${t('ar.title')} · Ministry of Victory`;
      return;
    }
    renderOrderTabs();
    renderCross();
    const entry = last.results.find(x => String(x.a.id) === String(ui.order));
    $('intel').innerHTML = '';
    const view = $('view');
    if (!entry) {
      view.innerHTML = `<div class="empty-wrap"><div class="empty-main">
          <p class="empty-line">${ICON.dots}<span>${esc(t('noOrders'))}</span></p>
          ${recapHTML()}${newsHomeHTML()}${frontsHTML()}</div>
        <div class="empty-side">${mapHTML(null)}${joelRecap()}</div></div>`;
      document.title = 'Ministry of Victory';
      return;
    }
    const firstTime = !prev.seen[entry.a.id];
    view.innerHTML = viewHTML(entry);
    if (opts.tabEnter) { const tp = $('tp-' + entry.a.id); if (tp) tp.classList.add('enter', 'anim'); }
    afterRender(entry, firstTime);
    prev.seen[entry.a.id] = true;
    const title = directiveParts(entry.res).title;
    document.title = `${title ? title.charAt(0).toUpperCase() + title.slice(1) + ' · ' : ''}Ministry of Victory`;
    if (keepFocus) { const el = document.querySelector(keepFocus); if (el) el.focus({ preventScroll: true }); }
    try { tick(); } catch {}
  }

