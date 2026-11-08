  /* ---------- between orders: report on the last one, and the war right now ---------- */
  // The recorder keeps each order's objectives and its progress every 20 minutes; the last finished
  // one is kept in this browser for a week, so the page has something to say between orders.
  function saveRecap() {
    if (!record || !record.orders || !recordProgress) return;
    const now = Date.now();
    const ended = Object.entries(record.orders).filter(([, o]) => o.exp && o.exp < now).sort((a, b) => b[1].exp - a[1].exp)[0];
    if (!ended) return;
    const [id, o] = ended, pr = recordProgress.orders && recordProgress.orders[id];
    if (!pr || !pr.pts || !pr.pts.length) return;
    const so = soList().filter(n => soOutcome(n.msg) === 'won' && n.t >= (o.start || 0) - 3 * 3.6e6 && n.t <= o.exp + 3 * 3.6e6);
    store.set('recap', { id, title: o.title, start: o.start, exp: o.exp, tasks: o.tasks, pts: pr.pts, so, alerts: (record.alerts || []).filter(a => a.order === id || (a.kind === 'effect' && a.t >= (o.start || 0) && a.t <= o.exp)).slice(-40) });
  }
  function recapHTML() {
    const R = store.get('recap', null);
    if (!R || Date.now() - R.exp > 7 * 24 * 3600e3) return '';
    const fin = R.pts[R.pts.length - 1];
    const rows = (R.tasks || []).map((tk, i) => {
      const p = ENGINE.parseTask(tk, fin[i + 1]);
      const goal = p.goal || ([11, 13].includes(p.type) ? 1 : 0);
      const val = Number(fin[i + 1] || 0), frac = goal ? Math.min(1, val / goal) : 0, done = goal && val >= goal;
      return { i, p, goal, val, frac, done, r: { task: p, planet: p.planetIndex != null && last.planets ? last.planets[p.planetIndex] : null } };
    });
    const won = rows.length && rows.every(x => x.done), nDone = rows.filter(x => x.done).length;
    const t0 = R.pts[0][0], t1 = Math.max(R.exp, fin[0]), W = 200, Hh = 28;
    const xs = (t) => ((t - t0) / Math.max(1, t1 - t0) * W).toFixed(1);
    const facC = (f) => FAC_VAR[f] || 'var(--fg)';
    // each objective: how it moved, against the steady pace that would have finished it on time
    const spark = (x) => {
      if (!(x.goal > 1) || R.pts.length < 2) return '';
      const f0 = Math.min(1, Number(R.pts[0][x.i + 1] || 0) / x.goal), lo = Math.max(0, f0 - 0.04);
      const ys = (f) => (Hh - (Math.min(1, f) - lo) / Math.max(0.04, 1 - lo) * Hh).toFixed(1);
      const d = R.pts.map((pt, k) => `${k ? 'L' : 'M'}${xs(pt[0])} ${ys(Number(pt[x.i + 1] || 0) / x.goal)}`).join('');
      return `<svg class="rc-spark" viewBox="0 -2 ${W} ${Hh + 4}" preserveAspectRatio="none" aria-hidden="true">
        <line class="goal" x1="0" x2="${W}" y1="0" y2="0"/><line class="pace" x1="0" y1="${ys(f0)}" x2="${xs(R.exp)}" y2="0"/><path d="${d}"/></svg>`;
    };
    const fmtDay = (ms) => new Date(ms).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    const durH = (R.exp - (R.start || t0)) / 3600e3;
    const objs = rows.map(x => `<li class="${x.done ? 'ok' : 'no'}" style="--c:${facC(x.p.faction)}">
        <span class="rc-mark">${x.done ? ICON.check : ICON.cross}</span>
        <div><b>${taskText(x.r)}</b>
        <div class="rc-bar"><i style="width:${(x.frac * 100).toFixed(1)}%"></i></div>
        <span class="rc-num">${x.goal > 1 ? `${big(x.val)} / ${big(x.goal)} · ${pct(x.frac)}` : esc(t(x.done ? 'rc.libDone' : 'rc.libNo'))}</span></div>${spark(x)}</li>`).join('');
    const hasSpark = rows.some(x => x.goal > 1) && R.pts.length > 1;
    return `<section class="recap">
      <h2 class="mod-h">${esc(t('rc.label'))}</h2>
      <div class="rc-head"><div><h3 aria-level="2">${esc(clean(R.title || 'Major Order'))}</h3>
        <p class="rc-when">${esc(fill(t('rc.when'), { a: fmtDay(R.start || t0), b: fmtDay(R.exp), d: dur(durH) }))}</p></div>
        <div class="stamp ${won ? 'v-done' : 'v-failed'}">${ICON[won ? 'check' : 'cross']}<span>${esc(t(won ? 'rc.won' : 'rc.lost'))}</span></div></div>
      <p class="rc-sum">${esc(won ? t('rc.sumWon') : fill(t('rc.sumLost'), { k: nDone, n: rows.length }))}</p>
      <ul class="rc-objs">${objs}</ul>
      ${hasSpark ? `<p class="rc-legend"><span><i class="l-prog"></i>${esc(t('rc.lProg'))}</span><span><i class="l-pace"></i>${esc(t('rc.lPace'))}</span><span class="rc-since">${esc(fill(t('rc.since'), { when: fmtDay(t0) }))}</span></p>` : ''}
    </section>`;
  }
  // Hand-made moves, in plain words: Joel (Arrowhead's Game Master) and Super Earth Command
  function soFor(x, start, end, list) {
    const won = (list || soList()).filter(n => soOutcome(n.msg) === 'won');
    if (x.ref === 'briefing') return won.filter(n => n.t >= (start || 0) && (!end || n.t <= end + 3 * 3.6e6)).sort((a, b) => b.t - a.t)[0] || null;
    return won.filter(n => Math.abs(n.t - x.t) < 3 * 3.6e6).sort((a, b) => Math.abs(a.t - x.t) - Math.abs(b.t - x.t))[0] || null;
  }
  function joelItem(x, tasks, rel, ctx = {}) {
    const noun = (i) => { const tk = tasks && tasks[i - 1]; if (!tk) return '#' + i; const p = tk.raw ? tk : ENGINE.parseTask(tk, 0); return plain(taskNoun(p)); };
    if (x.kind === 'edited') {
      const g = (x.diff || []).filter(d => d.kind === 'goal');
      const title = g.length && g.every(d => d.to < d.from) ? t('jo.cut') : g.length && g.every(d => d.to > d.from) ? t('jo.raised') : t('jo.edited');
      const detail = g.map(d => `<span class="jo-d">${esc(noun(d.i))}: ${big(d.from)} → <b>${big(d.to)}</b></span>`).join('');
      const so = soFor(x, ctx.start, ctx.end, ctx.so);
      if (so && (!g.length || g.every(d => d.to < d.from))) {
        const np = newsParts(so.msg);
        return { icon: 'check', earned: true, title: `${title}: ${esc(t('jo.soWon'))}`, detail: detail + `<span class="jo-so">${esc(t('jo.soWhy'))}</span>${np.body ? `<span class="jo-q">“${esc(plain(np.body).slice(0, 160))}${np.body.length > 160 ? '…' : ''}”</span>` : ''}`, t: so.t, when: x.ref === 'briefing' ? t('jo.launch') : null };
      }
      return { icon: 'edit', title, detail, t: x.t, when: x.ref === 'briefing' ? t('jo.launch') : null };
    }
    if (x.kind === 'effect' || x.kind === 'active') {
      const lbl = plain(effectLabel(x.type, x.v, x.eid ?? x.id));
      return { icon: 'fx', title: lbl.charAt(0).toUpperCase() + lbl.slice(1), detail: planetList(x.planets || [], rel && rel.size ? rel : new Set(x.planets || [])), t: x.t, when: x.kind === 'active' ? t('in.now') : null };
    }
    return { icon: KIND_ICON[x.kind] || 'warn', title: alertText(x, true, rel || new Set()), detail: '', t: x.t };
  }
  function joelHTML(list, tasks, rel, more, ctx) {
    const rows = list.map(x => joelItem(x, tasks, rel, ctx)).filter(r => !r.earned).slice(0, 5);
    return `<section class="panel br rail-card joel">
      <h2 class="mod-h">${esc(t('jo.title'))}</h2>
      <p class="jo-sub">${esc(t('jo.sub'))}</p>
      ${rows.length ? `<ul class="jo-list">${rows.map(r => `<li class="${r.earned ? 'earned' : ''}"><span class="jo-ico">${ICON[r.icon] || ''}</span><div><b>${r.title}</b>${r.detail ? `<p>${r.detail}</p>` : ''}</div><span class="jo-when">${esc(r.when || ago(r.t))}</span></li>`).join('')}</ul>`
        : `<p class="jo-none">${esc(t('jo.none'))}</p>`}
      ${more ? `<button type="button" class="linkbtn" data-goto="intel">${esc(t('jo.more'))} ›</button>` : ''}
    </section>`;
  }

  function joelRecap() {
    const R = store.get('recap', null);
    if (!R || Date.now() - R.exp > 7 * 24 * 3600e3) return '';
    const seen = new Set(), list = [];
    for (const a of [...(R.alerts || [])].sort((x, y) => y.t - x.t)) {
      if (a.kind === 'effect' && !a.on) continue;
      const k = a.kind === 'effect' ? 'e' + a.eid : a.kind === 'edited' ? 'ed' : a.kind + a.idx + Math.round(a.t / 3.6e6);
      if (seen.has(k)) continue; seen.add(k); list.push(a);
    }
    return joelHTML(list.sort((a, b) => prioOf(a) - prioOf(b)), R.tasks, new Set(), false, { start: R.start, end: R.exp, so: [...(R.so || []), ...soList()] });
  }
  // Super Earth's dispatches; a won Strategic Opportunity shows the reward it brought
  // Intel feed: one short line per event, grouped by day like a war log. The order's own start and
  // end come from the game data; a dispatch can be opened to read it in full, never cut off.
  function feedRow(r) {
    const tm = new Date(r.t).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
    const head = `<span class="fd-time">${esc(tm)}</span><span class="fd-ico">${ICON[NEWS_ICON[r.k]]}</span><span class="fd-txt"><b>${r.title}</b>${r.sub ? `<span class="fd-sub">${r.sub}</span>` : ''}</span>`;
    return r.body
      ? `<li class="nk-${r.k}"><details class="fd-more"><summary>${head}${ICON.chev}</summary><p>${clean(r.body)}</p></details></li>`
      : `<li class="nk-${r.k}"><div class="fd-row">${head}</div></li>`;
  }
  function feedHTML(rows, cls = '') {
    const day = (tm) => { const d = new Date(tm), n = new Date(last.now); const k = (x) => x.toDateString();
      if (k(d) === k(n)) return t('fd.today'); const y = new Date(n); y.setDate(y.getDate() - 1); if (k(d) === k(y)) return t('fd.yesterday');
      return d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' }); };
    let out = '', cur = null;
    for (const r of rows) { const d = day(r.t); if (d !== cur) { out += `${cur ? '</ul>' : ''}<h3 class="fd-day">${esc(d)}</h3><ul class="fd-list">`; cur = d; } out += feedRow(r); }
    return `<div class="feed ${cls}">${out}${cur ? '</ul>' : ''}</div>`;
  }
  // game titles come in capitals: "VICTORY ON MERIDIA" -> "Victory on Meridia"
  const SMALL = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
  // word by word, so "ARMORED EAGLE-Patriotic Invigoration" and "MEMORIAM ETERNAL-HONOR" both come out right
  const titleCase = (s0) => plain(s0 || '').trim().split(/(\s+|-)/).map((w, i) => {
    if (/^(\s+|-)$/.test(w) || !/[A-Z]{2}/.test(w) || w !== w.toUpperCase() || /^[A-Z]\d|\d/.test(w) || /^[IVX]+$/.test(w)) return w;
    const lw = w.toLowerCase(); return i && SMALL.has(lw) ? lw : lw.replace(/^(\W*)(\w)/, (m, p1, c) => p1 + c.toUpperCase());
  }).join('');
  function dispatchRows(list, events) {
    const rows = [];
    const seen = new Set();
    for (const n of uniqueDispatches(list)) {
      if (!n || seen.has(n.id)) continue; seen.add(n.id);
      const np = newsParts(n.msg), k = newsKind(np.title, np.body);
      // the order's own start or end is already in the log, from the game data
      if ((k === 'order' || k === 'win' || k === 'loss') && /major order/i.test(n.msg) && events.some(e => e.mo && Math.abs(e.t - n.t) < 3 * 3.6e6)) continue;
      rows.push({ t: n.t, k, title: esc(titleCase(np.title)), body: np.body, n });
    }
    return rows;
  }
  function newsHomeHTML() {
    const R = store.get('recap', null);
    const events = [];
    if (R) {
      const rows = (R.tasks || []).map((tk, i) => { const p = ENGINE.parseTask(tk, R.pts[R.pts.length - 1][i + 1]); const goal = p.goal || 1; return Number(R.pts[R.pts.length - 1][i + 1] || 0) >= goal; });
      const won = rows.length && rows.every(Boolean), nd = rows.filter(Boolean).length;
      const name = esc(titleCase(clean(R.title || 'Major Order')));
      if (R.start) events.push({ mo: true, t: R.start, k: 'order', title: fill(t('fd.moStart'), { name }) });
      events.push({ mo: true, t: R.exp, k: won ? 'win' : 'loss', title: fill(t(won ? 'fd.moWon' : 'fd.moLost'), { name }), sub: won ? '' : esc(fill(t('fd.moLostSub'), { k: nd, n: rows.length })) });
      for (const a of R.alerts || []) if (a.kind === 'edited') {
        const it = joelItem(a, R.tasks, new Set(), { start: R.start, end: R.exp, so: [...(R.so || []), ...soList()] });
        const g = (a.diff || []).filter(d => d.kind === 'goal');
        if (g.length) events.push({ t: it.t || a.t, k: it.earned ? 'so' : 'order', title: esc(it.earned ? t('fd.cutSo') : plain(it.title)), sub: g.map(d => `${big(d.from)} → <b>${big(d.to)}</b>`).join(' · ') });
      }
    }
    const disp = dispatchRows([...(news.items || []), ...((R && R.so) || []), ...((record && record.so) || [])], events)
      .filter(r => !(r.k === 'so' && events.some(e => e.k === 'so' && Math.abs(e.t - r.t) < 3 * 3.6e6)));
    const all = [...events, ...disp].sort((x, y) => y.t - x.t).slice(0, 14);
    if (!all.length) return '';
    const kinds = [...new Set(all.map(x => x.k))];
    const f = kinds.includes(ui.nf) && all.filter(x => x.k === ui.nf).length > 1 ? ui.nf : null;
    const shown = all.filter(x => !f || x.k === f);
    // at most four kinds to filter by, the commonest (critique 1 Nov 2026: nine chips of one item each)
    const top = kinds.map(k => [k, all.filter(x => x.k === k).length]).sort((x, y) => y[1] - x[1]).filter(([, n]) => n > 1).slice(0, 4).map(([k]) => k);
    const filters = top.length > 1 ? `<div class="nk-filter" role="group" aria-label="${esc(t('nw.filter'))}"><button type="button" data-nf="" aria-pressed="${!f}">${esc(t('nw.all'))} <small>${all.length}</small></button>${top.map(k => `<button type="button" class="nk-${k}" data-nf="${k}" aria-pressed="${f === k}">${ICON[NEWS_ICON[k]]}${esc(t('nk.' + k))} <small>${all.filter(x => x.k === k).length}</small></button>`).join('')}</div>` : '';
    return `<section class="newsbox"><h2 class="mod-h">${esc(t('nw.title'))}</h2>${filters}${feedHTML(shown)}</section>`;
  }
  // No order running, or this one is over: one concrete place to fight meanwhile (critique 1 Nov 2026).
  // A defense that ends soonest comes first (losing it costs a planet), else the planet most Helldivers are on.
  function meanwhilePick() {
    const P = Object.values(last.planets || {}).filter(p => p && p.currentOwner);
    const now = last.now;
    const defs = P.filter(p => p.event && Date.parse(p.event.endTime) > now).sort((a, b) => Date.parse(a.event.endTime) - Date.parse(b.event.endTime));
    const busy = [...P].filter(p => p.currentOwner !== 'Humans' || p.event).sort((a, b) => (b.statistics?.playerCount || 0) - (a.statistics?.playerCount || 0));
    const p = defs[0] || busy[0];
    if (!p) return null;
    const why = p.event ? fill(t('mw.def'), { when: clock((Date.parse(p.event.endTime) - now) / 3.6e6) }) : fill(t('mw.busy'), { n: people(p.statistics?.playerCount || 0) });
    // the between-orders call says it in full: the Ministry's advice, and why this planet
    const adv = p.event ? fill(t('bw.advDef'), { p: esc(pct(Math.max(0, Math.min(1, 1 - p.event.health / p.event.maxHealth)))), when: `<b>${esc(clock((Date.parse(p.event.endTime) - now) / 3.6e6))}</b>` })
      : fill(t('bw.advBusy'), { n: `<b>${esc(people(p.statistics?.playerCount || 0))}</b>` });
    return { p, why, adv, defend: !!p.event };
  }
  function meanwhileHTML() {
    const m = meanwhilePick();
    if (!m) return '';
    return `<p class="meanwhile">${ICON.target}<span><b>${esc(t('mw.head'))}</b> ${fill(t('mw.go'), { p: planetName(m.p) })} ${m.why}</span>
      <button type="button" class="linkish" data-open-planet="${m.p.index}">${esc(t('mw.open'))} ›</button></p>`;
  }
  // Between orders the call still comes first: where to drop now; the last order's report sits below it
  /* The next Major Order (8 Nov 2026): when Arrowhead tends to put one out, learned from the record. Every hour
     after an order ends is a chance for the next; that chance depends on the day and the hour in Stockholm, where
     the orders are set by hand (a workday between 8 AM and 6 PM nearly always, Tuesday most of all). An hour's
     chance = the orders that arrived in that kind of hour / the hours waited in it, over the last 18 months. */
  const STHLM = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Stockholm', weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
  function nmoCell(ms) {
    const parts = STHLM.formatToParts(new Date(ms)), wd = parts.find(p => p.type === 'weekday').value, h = Number(parts.find(p => p.type === 'hour').value) % 24;
    return (wd === 'Mon' ? 'mon' : wd === 'Tue' ? 'tue' : wd === 'Sat' || wd === 'Sun' ? 'we' : 'mid') + (h < 8 ? 0 : h < 13 ? 1 : h < 18 ? 2 : 3);
  }
  let nmoModel = null, nmoFrom = null;
  function nmoLearn(orders) {
    if (nmoFrom === orders && nmoModel) return nmoModel;
    const HR = 3.6e6, since = Date.now() - 540 * 24 * HR;
    const os = orders.filter(o => Number.isFinite(o.start)).sort((a, b) => a.start - b.start);
    const ev = {}, ex = {};
    let maxEnd = null, n = 0, first = null;
    for (const o of os) {
      if (maxEnd && o.start > maxEnd && o.start > since && o.start - maxEnd < 30 * 24 * HR) {
        for (let tm = maxEnd; tm < o.start; tm += HR) { const c = nmoCell(tm); ex[c] = (ex[c] || 0) + Math.min(1, (o.start - tm) / HR); }
        const c = nmoCell(o.start); ev[c] = (ev[c] || 0) + 1; n++;
        if (first == null) first = maxEnd;
      }
      if (Number.isFinite(o.end)) maxEnd = Math.max(maxEnd || 0, o.end);
    }
    const haz = {};
    for (const c of Object.keys(ex)) haz[c] = ((ev[c] || 0) + 0.05) / (ex[c] + 1);
    nmoFrom = orders; nmoModel = n >= 20 ? { haz, n, first, lastEnd: maxEnd } : null;
    return nmoModel;
  }
  // the chance of the next order in each part of the next 5 local days (night, morning, afternoon, evening),
  // given none has come yet; and when the chance passes one half and nine in ten
  const NMO_PARTS = [0, 8, 13, 18];
  function nmoForecast(model, now) {
    const HR = 3.6e6, d0 = new Date(now); d0.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 5 }, (_, i) => { const d = new Date(d0); d.setDate(d0.getDate() + i); return { d, parts: [0, 0, 0, 0] }; });
    const endT = new Date(days[4].d); endT.setDate(endT.getDate() + 1);
    let S = 1, q50 = null, q90 = null;
    for (let tm = now; tm < endT.getTime(); tm += HR) {
      const p = S * (1 - Math.exp(-(model.haz[nmoCell(tm)] || 0)));
      S -= p;
      const L = new Date(tm), di = Math.round((new Date(L).setHours(0, 0, 0, 0) - d0.getTime()) / 864e5), pi = L.getHours() < 8 ? 0 : L.getHours() < 13 ? 1 : L.getHours() < 18 ? 2 : 3;
      if (days[di]) days[di].parts[pi] += p;
      if (q50 == null && 1 - S >= 0.5) q50 = tm;
      if (q90 == null && 1 - S >= 0.9) q90 = tm;
    }
    let best = null;
    days.forEach((dy, di) => dy.parts.forEach((p, pi) => { if (!best || p > best.p) best = { di, pi, p }; }));
    return { days, best, q50, q90 };
  }
  // the order slot, empty (8 Nov 2026): where the orders stand, a dashed frame says there is none, and when the
  // next is likely; the advice below it is the Ministry's, not an order
  function emptySlotHTML() {
    if (!archive) loadArchive();
    const model = archive ? nmoLearn(archive.orders) : null, now = last.now;
    const R = store.get('recap', null);
    const lastEnd = Math.max(model?.lastEnd || 0, R && R.exp < now ? R.exp : 0) || null;
    const lastName = R && R.exp === lastEnd ? clean(R.title || 'Major Order') : null;
    const when = (ms) => new Date(ms).toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    const silent = lastEnd && now > lastEnd ? `${fill(t('nmo.silent'), { d: `<b>${esc(hmLeft((now - lastEnd) / 3.6e6))}</b>` })} ${lastName ? fill(t('nmo.last'), { title: esc(titleCase(plain(lastName))), when: esc(when(lastEnd)) }) : ''}` : esc(t('nmo.quiet'));
    let right = '';
    const fc = model ? nmoForecast(model, now) : null;
    if (fc) {
      const top = fc.best.p, dayName = (di) => di === 0 ? t('nmo.today') : di === 1 ? t('nmo.tomorrow') : fc.days[di].d.toLocaleDateString(locale(), { weekday: 'long' });
      const head = `${dayName(fc.best.di)} ${t('nmo.parts')[fc.best.pi]}`;
      const nowL = new Date(now), nowX = (nowL.getHours() + nowL.getMinutes() / 60) / 24 * 100;
      const strip = fc.days.map((dy, di) => {
        const bars = dy.parts.map((p, pi) => {
          const end = new Date(dy.d); end.setHours(pi < 3 ? NMO_PARTS[pi + 1] : 24, 0, 0, 0);
          const past = end.getTime() <= now, isTop = di === fc.best.di && pi === fc.best.pi;
          return `<i class="${pi === 0 ? 'night' : ''}${isTop ? ' top' : ''}${past ? ' past' : ''}" style="height:${past ? 3 : Math.max(3, p / top * 100).toFixed(0)}%">${isTop ? `<em>${Math.round(p * 100)}%</em>` : ''}</i>`;
        }).join('');
        return `<div class="nx-day${di === fc.best.di ? ' top' : ''}"><div class="nx-bars">${bars}${di === 0 ? `<span class="nx-now" style="left:${nowX.toFixed(1)}%"><b>${esc(t('fcb.now'))}</b></span>` : ''}</div><span class="nx-dl"><b>${esc(dy.d.toLocaleDateString(locale(), { weekday: 'short' }))}</b> ${dy.d.getDate()}</span></div>`;
      }).join('');
      const hr = (ms) => ms ? new Date(ms).toLocaleString(locale(), { weekday: 'short', hour: 'numeric' }) : '—';
      const aria = fill(t('nmo.aria'), { when: head, a: hr(fc.q50), b: hr(fc.q90) });
      right = `<div class="slot-r"><span class="slot-k2">${esc(t('nmo.next'))}</span><b class="slot-when">${esc(capFirst(head))}</b>
        <div class="nx-strip" role="img" aria-label="${esc(aria)}">${strip}</div>
        <span class="slot-q">${fill(t('nmo.even'), { a: `<b>${esc(hr(fc.q50))}</b>` })} · ${fill(t('nmo.nine'), { b: `<b>${esc(hr(fc.q90))}</b>` })}</span></div>
        <p class="slot-note">${esc(fill(t('nmo.note'), { n: model.n, since: new Date(model.first).toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) }))}</p>`;
    }
    return `<section class="slot${right ? '' : ' solo'}" aria-labelledby="slot-h">
      <div class="slot-l"><span class="slot-k"><i aria-hidden="true"></i>${esc(t('nmo.k'))}</span><h2 class="slot-h" id="slot-h">${esc(t('nmo.h'))}</h2><p class="slot-s">${silent}</p></div>
      ${right}</section>`;
  }
  function betweenCallHTML() {
    const m = meanwhilePick();
    if (!m) return '';
    const fac = factionOfPlanet(m.p);
    return `<section class="call vl-wait state-between" aria-labelledby="dir-between">
      <div class="call-main">
        <div class="call-bar"><span class="call-tag"><i class="live" aria-hidden="true"></i>${esc(t('callTag.between'))}</span>${fac && fac !== 'Humans' ? `<span class="call-front">${factionIcon(fac)}${fill(t('frontOf'), { f: facName(fac) })}</span>` : ''}</div>
        ${holoPlanet({ ring: m.p.maxHealth ? { frac: Math.max(0, Math.min(1, 1 - (m.p.event ? m.p.event.health / m.p.event.maxHealth : m.p.health / m.p.maxHealth))), label: t(m.p.event ? 'gDef' : 'gLib'), tone: 'lib' } : null, planet: m.p, fac }, { id: 'between', tasks: [] })}
        <h2 class="call-head" id="dir-between"><span class="verb">${esc(t(m.defend ? 'bw.pickDef' : 'bw.pickDrop'))}</span> <span class="tgt">${planetName(m.p)}</span></h2>
        <p class="why">${m.adv}</p>
        <div class="call-actions"><button type="button" class="btn primary" data-open-planet="${m.p.index}">${esc(t('gCta'))}${ICON.track}</button></div>
      </div>
    </section>`;
  }
  function frontsHTML() {
    const P = Object.values(last.planets || {}).filter(p => p && p.currentOwner);
    const F = ['Terminids', 'Automaton', 'Illuminate'].map(f => {
      const ps = P.filter(p => p.currentOwner === f || (p.event && p.event.faction === f));
      const pl = ps.reduce((n, p) => n + (p.statistics?.playerCount || 0), 0);
      const defs = ps.filter(p => p.event);
      const top = [...ps].sort((a, b) => (b.statistics?.playerCount || 0) - (a.statistics?.playerCount || 0)).slice(0, 3);
      return { f, ps, pl, defs, top };
    }).filter(x => x.ps.length);
    if (!F.length) return '';
    const N = last.N || F.reduce((n, x) => n + x.pl, 0) || 1;
    return `<section class="fronts"><h2 class="mod-h">${esc(t('rc.fronts'))}</h2>
      <div class="fr-grid">${F.map(x => `<div class="fr" style="--c:${FAC_VAR[x.f]}">
        <h3>${esc(plain(facName(x.f)))}</h3>
        <p class="fr-n"><b>${people(x.pl)}</b> ${esc(t('rc.divers'))} · ${pct(x.pl / N)}</p>
        <div class="fr-bar"><i style="width:${Math.min(100, x.pl / N * 100).toFixed(1)}%"></i></div>
        <p class="fr-s">${esc(fill(t(x.ps.length > 1 ? 'rc.planetsN' : 'rc.planets1'), { n: x.ps.length }))}${x.defs.length ? ` · <b class="fr-def">${esc(fill(t(x.defs.length > 1 ? 'rc.defsN' : 'rc.defs1'), { n: x.defs.length }))}</b>` : ''}</p>
        <ul>${x.top.map(p => `<li><button type="button" class="fr-p mp-link" data-open-planet="${p.index}">${planetName(p)}</button><span>${people(p.statistics?.playerCount || 0)}</span></li>`).join('')}</ul>
      </div>`).join('')}</div></section>`;
  }

