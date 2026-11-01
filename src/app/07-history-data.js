  /* ---------- history: how the order got here (interactive charts) ---------- */
  // Each chart: SVG paths drawn in a 1000 x 300 box stretched to the card (strokes keep their width),
  // HTML for every label, and a crosshair + tooltip that follow the pointer.
  const charts = {};
  const HOPELESS = new Set(['impossible', 'nearly_impossible', 'failed']);
  const CW = 1000, CH = 300;
  const hhmm = (ms) => new Date(ms).toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  // one point every 90 s at most (the newest one always kept)
  function thinPts(raw) {
    const pts = [];
    raw.forEach((q, i) => { if (!pts.length || q[0] - pts[pts.length - 1][0] >= 90e3) pts.push(q); else if (i === raw.length - 1) pts[pts.length - 1] = q; });
    return pts;
  }
  function seriesAt(pts, x) {   // value of a polyline at time x (linear between points)
    if (!pts.length || x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= x) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi];
    return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
  }
  function chartHTML(c) {
    const X = (x) => ((x - c.x0) / (c.x1 - c.x0)) * CW, Y = (y) => CH - ((y - c.y0) / (c.y1 - c.y0)) * CH;
    const path = (pts) => pts.map((q, i) => `${i ? 'L' : 'M'}${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join('');
    const pctX = (x) => Math.max(0, Math.min(100, ((x - c.x0) / (c.x1 - c.x0)) * 100));
    const pctY = (y) => Math.max(0, Math.min(100, ((y - c.y0) / (c.y1 - c.y0)) * 100));
    const hidden = ui.chartOff[c.id] || {};
    const lines = c.series.filter(sr => sr.pts.length > 1).map(sr => `<path class="ln ${sr.cls}${hidden[sr.key] ? ' off' : ''}"${sr.sty ? ` style="${sr.sty}"` : ''} data-s="${sr.key}" d="${path(sr.pts)}" vector-effect="non-scaling-stroke"/>`
      + (sr.area ? `<path class="area ${sr.cls}${hidden[sr.key] ? ' off' : ''}" data-s="${sr.key}" d="${path(sr.pts)}L${X(sr.pts[sr.pts.length - 1][0]).toFixed(1)},${CH}L${X(sr.pts[0][0]).toFixed(1)},${CH}Z"/>` : '')).join('');
    const bars = (c.bars || []).map(b => `<rect class="bar-r ${b.cls || ''}" x="${X(b.x0).toFixed(1)}" width="${Math.max(1, X(b.x1) - X(b.x0) - 3).toFixed(1)}" y="${Y(b.y).toFixed(1)}" height="${(CH - Y(b.y)).toFixed(1)}"/>`).join('');
    const gaps = (c.gaps || []).map(g => `<div class="ch-gap" style="left:${pctX(g[0])}%;width:${pctX(g[1]) - pctX(g[0])}%"><span>${esc(t('h.unrecorded'))}</span></div>`).join('');
    const yt = c.yTicks.map(v => `<span class="yt" style="bottom:${pctY(v)}%">${c.fmtY(v)}</span><i class="grid" style="bottom:${pctY(v)}%"></i>`).join('');
    const xt = c.xTicks.map(v => `<span class="xt" style="left:${pctX(v)}%">${esc(v.label || new Date(v).toLocaleDateString(locale(), { weekday: 'short' }))}</span>`).join('');
    const marks = (c.marks || []).map(m => `<div class="ch-mark ${m.cls}" style="left:${pctX(m.x)}%"><i class="hd"></i></div>`).join('');
    const hl = (c.hlines || []).map(h => `<div class="ch-h ${h.cls}" style="bottom:${pctY(h.y)}%"><span>${esc(h.label)}</span></div>`).join('');
    const edge = (g) => pctX(g.x) > 98.5;
    const tags = (c.tags || []).map(g => `<span class="ch-tag ${g.cls}${edge(g) ? ' edge' : ''}${hidden[g.key] ? ' off' : ''}" data-s="${g.key}" style="${g.sty ? g.sty + ';' : ''}${edge(g) ? '' : `left:${pctX(g.x)}%;`}bottom:${pctY(g.y)}%">${esc(g.text)}</span>`).join('');
    charts[c.id] = c;
    return `<div class="chart${(c.tags || []).some(edge) ? ' has-edge' : ''}" data-chart="${esc(c.id)}" role="img" aria-label="${esc(c.aria || '')}">
      <div class="plot">${yt}${gaps}<svg viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="none" aria-hidden="true">${bars}${lines}</svg>${hl}${marks}${tags}
        <div class="ch-cross"></div><div class="ch-dot"></div><div class="ch-tip" aria-live="polite"></div></div>
      <div class="xaxis">${xt}</div></div>`;
  }
  function legendHTML(id, items) {
    const hidden = ui.chartOff[id] || {};
    return `<div class="ch-legend">${items.map(it => `<button type="button" class="lg ${it.cls}"${it.sty ? ` style="${it.sty}"` : ''} data-legend="${esc(id)}" data-s="${it.key}" aria-pressed="${!hidden[it.key]}"><i></i>${esc(it.label)}</button>`).join('')}</div>`;
  }
  function niceTicks(max, n = 4) {
    if (!(max > 0)) return [0];
    const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => k >= raw) || raw;
    const out = []; for (let v = 0; v <= max + 1e-9; v += step) out.push(v);
    return out;
  }
  function dayTicks(x0, x1) {
    const out = [], d = new Date(x0); d.setHours(0, 0, 0, 0);
    for (d.setDate(d.getDate() + 1); d.getTime() < x1; d.setDate(d.getDate() + 1)) out.push(d.getTime());   // calendar days (DST-safe)
    return out.length > 8 ? out.filter((_, i) => i % 2 === 0) : out;
  }
  // progress of one counter objective since the order began: recorder points, this browser's samples, now
  function counterSeries(entry, r) {
    const id = String(entry.a.id), i = r.idx, raw = [];
    for (const x of recordProgress?.orders?.[id]?.pts || []) if (x[1 + i] != null) raw.push([x[0], Number(x[1 + i])]);
    for (const sm of samples) {
      const k = sm.prog && Object.keys(sm.prog).find(k2 => k2.startsWith(id + ':'));
      if (k && sm.prog[k] && sm.prog[k][i] != null) raw.push([sm.t, Number(sm.prog[k][i])]);
    }
    raw.push([last.now, Number(r.task.progress)]);
    raw.sort((a, b) => a[0] - b[0]);
    return thinPts(raw);
  }
  // kills (or other counts) per hour, from the stretches actually recorded
  function hourly(pts) {
    const b = new Map();
    for (let k = 1; k < pts.length; k++) {
      const [ta, va] = pts[k - 1], [tb, vb] = pts[k];
      if (tb - ta > 40 * 60e3 || vb < va) continue;
      for (let h = Math.floor(ta / 3.6e6); h * 3.6e6 < tb; h++) {
        const s0 = Math.max(ta, h * 3.6e6), s1 = Math.min(tb, (h + 1) * 3.6e6);
        if (s1 <= s0) continue;
        const e = b.get(h) || { v: 0, span: 0 };
        e.v += (vb - va) * (s1 - s0) / (tb - ta); e.span += s1 - s0; b.set(h, e);
      }
    }
    return [...b.entries()].filter(([, e]) => e.span >= 30 * 60e3).map(([h, e]) => ({ x0: h * 3.6e6, x1: (h + 1) * 3.6e6, rate: e.v * 3.6e6 / e.span }));
  }
  // the moment the order slipped out of reach: from then on, the pace still needed was more than the
  // best hour this order ever had
  function pointOfNoReturn(pts, goal, end, best) {
    if (!(best > 0) || pts.length < 2) return null;
    const need = (tt, v) => end > tt ? (goal - v) * 3.6e6 / (end - tt) : Infinity;
    if (need(pts[pts.length - 1][0], pts[pts.length - 1][1]) <= best) return null;
    let at = null;
    for (let k = pts.length - 1; k > 0; k--) {
      const [ta, va] = pts[k - 1], [tb, vb] = pts[k];
      for (let s = 20; s >= 0; s--) {
        const tt = ta + (tb - ta) * s / 20, v = va + (vb - va) * s / 20;
        if (need(tt, v) > best) at = tt; else return at;
      }
    }
    return at;
  }
  function counterFacts(entry, r) {
    const tk = r.task, end = Date.parse(entry.a.expiration), start = entry.start;
    const pts = counterSeries(entry, r);
    const hours = hourly(pts);
    const recent = r.rates.recent ? r.rates.recent.rate : null;
    const avg = r.primary ? r.primary.rate : null;
    const best = Math.max(0, ...hours.map(h => h.rate), recent || 0, avg || 0);
    const total = start && end > start ? (end - start) / 3.6e6 : null;
    return { pts, hours, end, start, avg, recent, best, needed: r.needed, fromStart: total ? tk.goal / total : null,
      ponr: tk.goal && HOPELESS.has(r.verdict) ? pointOfNoReturn(start ? [[start, 0], ...pts.filter(q => q[0] > start)] : pts, tk.goal, end, best) : null };
  }
  function counterChart(entry, r, mode) {
    const tk = r.task, f = counterFacts(entry, r), now = last.now, H = entry.res.hoursLeft;
    const id = `c:${entry.a.id}:${r.idx}:${mode}`;
    const x0 = f.start || f.pts[0][0], x1 = Math.max(f.end, now);
    const fac = tk.faction ? 'f-' + tk.faction : 'f-none';
    if (mode === 'hour') {
      if (f.hours.length < 2) return `<p class="ch-empty">${esc(t('h.fewHours'))}</p>`;
      const hx0 = f.hours[0].x0, hx1 = Math.max(now, f.hours[f.hours.length - 1].x1);
      const top = Math.max(f.needed || 0, ...f.hours.map(h => h.rate)) * 1.12;
      const c = { id, x0: hx0, x1: hx1, y0: 0, y1: top, series: [], fmtY: big, yTicks: niceTicks(top),
        xTicks: f.hours.filter((h, i) => i % Math.ceil(f.hours.length / 6) === 0).map(h => Object.assign(Number(h.x0), { label: new Date(h.x0).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' }) })),
        bars: f.hours.map(h => ({ x0: h.x0, x1: h.x1, y: h.rate, cls: f.needed && h.rate >= f.needed ? 'ok ' + fac : fac })),
        hlines: [f.needed && r.verdict !== 'done' ? { y: f.needed, cls: 'need', label: fill(t('h.needLine'), { v: big(f.needed) }) } : null, f.avg ? { y: f.avg, cls: 'avg', label: fill(t('h.avgLine'), { v: big(f.avg) }) } : null].filter(Boolean),
        kind: 'hour', hours: f.hours, aria: t('h.hourAria') };
      return chartHTML(c);
    }
    const projEnd = f.avg != null ? tk.progress + f.avg * H : null, recEnd = f.recent != null ? tk.progress + f.recent * H : null;
    // a pace far beyond the goal would squash the chart: lines stop where they cross 1.6x the goal
    const cap = tk.goal ? tk.goal * 1.6 : Infinity;
    const projLine = (endV) => endV <= cap || !(endV > tk.progress) ? [[now, tk.progress], [f.end, endV]] : [[now, tk.progress], [now + (f.end - now) * (cap - tk.progress) / (endV - tk.progress), cap]];
    const top = Math.max(tk.goal || 0, Math.min(cap, Math.max(projEnd || 0, recEnd || 0)), ...f.pts.map(q => q[1])) * 1.08;
    const actual = f.start ? [[f.start, 0], ...f.pts.filter(q => q[0] > f.start)] : f.pts;
    const firstRec = f.pts.find(q => f.start && q[0] > f.start + 60e3);
    const gap = f.start && firstRec && firstRec[0] - f.start > 2 * 3.6e6 ? [f.start, firstRec[0]] : null;
    const done = r.verdict === 'done', ended = entry.res.ended;
    const series = [
      { key: 'act', cls: 'act ' + fac, pts: gap ? actual.filter(q => q[0] >= gap[1]) : actual, area: true, name: t('h.lgAct'), tip: t('h.lnAct') },
      gap ? { key: 'act', cls: 'act gapline ' + fac, pts: [[gap[0], 0], firstRec], name: t('h.lgAct'), tip: t('h.lnGap') } : null,
      !done && !ended ? { key: 'need', cls: 'need', pts: [[now, tk.progress], [f.end, tk.goal]], name: t('h.lgNeed'), tip: fill(t('h.lnNeed'), { v: big(f.needed) }) } : null,
      !done && !ended && projEnd != null ? { key: 'avg', cls: 'proj', pts: projLine(projEnd), name: fill(t('h.lgAvg'), { basis: t('why.basis.' + (r.primary?.kind || 'start')) }), tip: fill(t('h.lnAvg'), { v: big(f.avg), p: projPct(projEnd / tk.goal), basis: t('why.basis.' + (r.primary?.kind || 'start')) }) } : null,
      !done && !ended && recEnd != null && Math.abs(recEnd - (projEnd || 0)) / (tk.goal || 1) > 0.02 ? { key: 'rec', cls: 'proj2', pts: projLine(recEnd), name: t('h.lgRec'), tip: fill(t('h.lnRec'), { v: big(f.recent), p: projPct(recEnd / tk.goal) }) } : null,
    ].filter(Boolean);
    const tagsArr = [];
    if (!done && !ended && projEnd != null) tagsArr.push({ key: 'avg', cls: 'proj', x: projLine(projEnd)[1][0], y: Math.min(projEnd, cap), text: projPct(projEnd / tk.goal) });
    if (series.some(sr => sr.key === 'rec')) tagsArr.push({ key: 'rec', cls: 'proj2', x: projLine(recEnd)[1][0], y: Math.min(recEnd, cap), text: projPct(recEnd / tk.goal) });
    const c = { id, x0, x1, y0: 0, y1: top, series, fmtY: big, yTicks: niceTicks(top), xTicks: dayTicks(x0, x1), gaps: gap ? [gap] : [],
      hlines: tk.goal ? [{ y: tk.goal, cls: 'goal', label: fill(t('h.goal'), { v: big(tk.goal) }) }] : [],
      marks: [{ x: now, cls: 'now', label: t('h.now'), tip: hhmm(now) },
        f.ponr ? { x: f.ponr, cls: 'ponr', label: t('h.ponr'), tip: fill(t('h.ponrTip'), { best: big(f.best) }) } : null,
        f.end > now ? { x: f.end, cls: 'end', label: t('h.deadline'), tip: fill(t('h.endTip'), { when: hhmm(f.end) }) } : null].filter(Boolean),
      tags: tagsArr, kind: 'count', goal: tk.goal, actual, now, progress: tk.progress, end: f.end, avg: f.avg, recent: f.recent, gap, aria: t('h.progAria') };
    return chartHTML(c);
  }
  // liberation of the planets an objective names, over time
  function planetSeries(idx) {
    const p = last.planets[idx], raw = [];
    for (const x of recordProgress?.planets?.[idx] || []) raw.push([x[0], x[1]]);
    const m = p ? (p.event ? p.event.maxHealth : p.maxHealth) : null;
    if (m) for (const sm of samples) { const v = sm.planets && sm.planets[idx]; if (v && v.h != null) raw.push([sm.t, 1 - v.h / m]); }
    if (p && m) raw.push([last.now, 1 - (p.event ? p.event.health : p.health) / m]);
    raw.sort((a, b) => a[0] - b[0]);
    return thinPts(raw);
  }
  function libChart(entry, rows) {
    const id = `l:${entry.a.id}`, now = last.now, end = Date.parse(entry.a.expiration), H = entry.res.hoursLeft;
    const all = rows.map((r, k) => ({ r, k, pts: planetSeries(r.planet.index) })).filter(x => x.pts.length);
    if (!all.length) return '';
    const x0 = Math.min(entry.start || now, ...all.map(x => x.pts[0][0])), x1 = Math.max(end, now);
    const series = [], tags = [];
    all.forEach(({ r, k, pts }) => {
      const key = 'p' + r.planet.index, cls = 'pl', sty = `--sc:${planetTone(entry.res, r.planet)}`;
      series.push({ key, cls, sty, pts, name: plain(planetName(r.planet)), tip: t('h.lnPlanet') });
      if (r.pw && isFinite(r.eta) && r.eta > 0 && !entry.res.ended) {
        const tEnd = now + Math.min(r.eta, H * 1.6) * 3.6e6, frac = pts[pts.length - 1][1];
        const reach = r.eta <= H * 1.6 ? 1 : frac + (1 - frac) * (H * 1.6 / r.eta);
        series.push({ key, cls: cls + ' proj', sty, pts: [[now, frac], [tEnd, reach]], name: plain(planetName(r.planet)), tip: r.eta <= H ? fill(t('h.lnFalls'), { when: clock(r.eta) }) : t('h.lnLate') });
        if (r.eta <= H) tags.push({ key, cls: 'pl', sty, x: tEnd, y: 1, text: clock(r.eta) });
      }
    });
    const c = { id, x0, x1: Math.max(x1, ...series.map(sr => sr.pts[sr.pts.length - 1][0])), y0: 0, y1: 1.06, series, tags,
      fmtY: (v) => pct(v), yTicks: [0, 0.25, 0.5, 0.75, 1], xTicks: dayTicks(x0, x1),
      hlines: [], marks: [{ x: now, cls: 'now', label: t('h.now'), tip: hhmm(now) }, { x: end, cls: 'end', label: t('h.deadline'), tip: fill(t('h.endTip'), { when: hhmm(end) }) }],
      kind: 'lib', now, planets: all.map(({ r, pts }) => ({ key: 'p' + r.planet.index, name: plain(planetName(r.planet)), pts, proj: (series.find(sr => sr.key === 'p' + r.planet.index && sr.cls.includes('proj')) || {}).pts || null })), aria: t('h.libAria') };
    return chartHTML(c) + legendHTML(id, all.map(({ r }) => ({ key: 'p' + r.planet.index, cls: 'pl', sty: `--sc:${planetTone(entry.res, r.planet)}`, label: plain(planetName(r.planet)) })));
  }
  function historyHTML(entry) {
    const { res } = entry;
    const cards = [];
    const libRows = res.tasks.filter(r => r.planet && (r.pw || r.task.type === 11 || r.task.type === 13));
    if (libRows.length) cards.push(`<section class="hist-card panel br"><div class="hc-head"><h4 aria-level="3">${esc(t('h.libTitle'))}</h4></div>${libChart(entry, libRows)}</section>`);
    const doneList = res.tasks.filter(x => x.counter && !x.simpleCount && x.task.goal && x.verdict === 'done');
    for (const r of res.tasks.filter(x => x.counter && !x.simpleCount && x.task.goal && x.verdict !== 'done')) {
      const mode = (ui.histMode[`${entry.a.id}:${r.idx}`]) || 'prog';
      const f = counterFacts(entry, r);
      const stat = r.verdict === 'done' ? t('h.statDone') : f.needed && f.avg ? fill(t(f.avg >= f.needed ? 'h.statOk' : 'h.stat'), { need: big(f.needed), avg: big(f.avg), x: fmt(f.needed / f.avg, 1, 1), basis: t('why.basis.' + (r.primary?.kind || 'start')) }) : '';
      const key = `${entry.a.id}:${r.idx}`, cid = `c:${entry.a.id}:${r.idx}:prog`;
      cards.push(`<section class="hist-card panel br">
        <div class="hc-head"><h4 aria-level="3">${taskText(r)}</h4>${pill(r.verdict)}
          <div class="seg" role="group" aria-label="${esc(t('h.view'))}">
            <button type="button" data-hmode="${esc(key)}" data-v="prog" aria-pressed="${mode === 'prog'}">${esc(t('h.prog'))}</button>
            <button type="button" data-hmode="${esc(key)}" data-v="hour" aria-pressed="${mode === 'hour'}">${esc(t('h.hour'))}</button></div></div>
        ${stat ? `<p class="hc-stat">${stat}</p>` : ''}
        ${counterChart(entry, r, mode)}
        ${mode === 'prog' ? legendHTML(cid, [{ key: 'act', cls: 'act', label: t('h.lgAct') }, r.verdict !== 'done' && !res.ended ? { key: 'need', cls: 'need', label: t('h.lgNeed') } : null,
          r.verdict !== 'done' && !res.ended && f.avg ? { key: 'avg', cls: 'proj', label: fill(t('h.lgAvg'), { basis: t('why.basis.' + (r.primary?.kind || 'start')) }) } : null,
          r.verdict !== 'done' && !res.ended && f.recent != null ? { key: 'rec', cls: 'proj2', label: t('h.lgRec') } : null].filter(Boolean)) : ''}
      </section>`);
    }
    if (doneList.length) cards.push(`<section class="hist-card panel br done-card">${doneList.map(r => `<div class="hc-head"><h4 aria-level="3">${taskText(r)}</h4>${pill('done')}</div>`).join('')}</section>`);
    for (const r of res.tasks.filter(x => x.defense)) {
      cards.push(`<section class="hist-card panel br"><div class="hc-head"><h4 aria-level="3">${taskText(r)}</h4>${pill(r.verdict)}</div>${libChart(entry, [r])}</section>`);
    }
    if (!cards.length) return `<p class="empty-moves unknown">${ICON.dots}<span>${esc(t('h.nothing'))}</span></p>`;
    const since = record && record.since ? fill(t('h.foot'), { when: new Date(record.since).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }) : t('h.footLocal');
    return `<div class="history">${cards.join('')}<p class="foot">${esc(since)}</p></div>`;
  }
  // Labels never sit on top of each other, whatever the width: after layout, labels above the plot
  // stack into rows, labels in the right margin spread apart, and line labels that collide swap sides.
  const hit = (a, b) => a.left < b.right + 4 && b.left < a.right + 4 && a.top < b.bottom + 2 && b.top < a.bottom + 2;
  function layoutChart(el) {
    const plot = el.querySelector('.plot'); if (!plot) return;
    const placed = [];
    const edge = [...el.querySelectorAll('.ch-tag.edge')].sort((a, b) => parseFloat(b.style.bottom) - parseFloat(a.style.bottom));
    edge.forEach(g => { g.style.transform = ''; });
    let prevBottom = -Infinity;
    for (const g of edge) {
      const r = g.getBoundingClientRect();
      const shift = Math.max(0, prevBottom + 3 - r.top);
      if (shift) g.style.transform = `translateY(calc(50% + ${shift}px))`;
      prevBottom = r.bottom + shift;
    }
    const inner = [...el.querySelectorAll('.ch-tag:not(.edge)')]; const seen = [];
    for (const g of inner) { g.style.marginBottom = ''; let k = 0, r = g.getBoundingClientRect(); while (k < 4 && seen.some(p => hit(p, r))) { k++; g.style.marginBottom = (k * 20) + 'px'; r = g.getBoundingClientRect(); } seen.push(r); }
    const hl = [...el.querySelectorAll('.ch-h span')]; const hs = [];
    for (const sp of hl) { sp.classList.remove('flip'); const r = sp.getBoundingClientRect(); if (hs.some(p => hit(p, r)) || placed.some(p => hit(p, r))) sp.classList.add('flip'); hs.push(sp.getBoundingClientRect()); }
  }
  // timeline: events close in time take separate lanes under the line instead of piling up
  function layoutIntel() {
    document.querySelectorAll('.it-track').forEach(tr => {
      const dots = [...tr.querySelectorAll('.it-dot')].sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
      const w = tr.getBoundingClientRect().width, lanes = [];
      let maxLane = 0;
      for (const d of dots) {
        const x = parseFloat(d.style.left) / 100 * w;
        let k = 0; while (lanes[k] != null && x - lanes[k] < 30) k++;
        lanes[k] = x; maxLane = Math.max(maxLane, k);
        d.style.top = (-12 + k * 32) + 'px';
      }
      tr.parentElement.style.paddingBottom = (18 + maxLane * 32) + 'px';
      const nowX = w;
      let lastRight = -Infinity;
      tr.querySelectorAll('.it-tick').forEach(tk => {
        tk.style.visibility = '';
        const r = tk.getBoundingClientRect(), x = parseFloat(tk.style.left) / 100 * w;
        const hide = nowX - x < 80 || r.left < lastRight + 24 || r.left < tr.parentElement.getBoundingClientRect().left + 2;
        tk.style.visibility = hide ? 'hidden' : '';
        if (!hide) lastRight = r.right;
      });
    });
  }
  const layoutCharts = () => { document.querySelectorAll('.chart').forEach(layoutChart); layoutIntel(); };
  window.addEventListener('resize', () => { cancelAnimationFrame(layoutCharts.raf); layoutCharts.raf = requestAnimationFrame(layoutCharts); });

  // crosshair + tooltip
  // what is under the pointer: a marker line (now, deadline...) or one of the chart's lines
  function chartTarget(c, el, clientX, clientY) {
    const rect = el.querySelector('.plot').getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    const toPx = (x) => (x - c.x0) / (c.x1 - c.x0) * rect.width, toPy = (y) => rect.height - (y - c.y0) / (c.y1 - c.y0) * rect.height;
    const mark = (c.marks || []).map(m => ({ m, d: Math.abs(toPx(m.x) - px) })).filter(o => o.d < 7).sort((a, b) => a.d - b.d)[0];
    if (mark) return { mark: mark.m };
    const off = ui.chartOff[c.id] || {}, x = c.x0 + px / rect.width * (c.x1 - c.x0);
    let best = null;
    for (const sr of c.series || []) {
      if (off[sr.key] || !sr.name) continue;
      const v = seriesAt(sr.pts, x); if (v == null) continue;
      const d = Math.abs(toPy(v) - py);
      if (d < 14 && (!best || d < best.d)) best = { sr, d };
    }
    return best ? { series: best.sr } : {};
  }
  function chartHover(el, clientX, clientY) {
    const c = charts[el.dataset.chart]; if (!c) return;
    const plot = el.querySelector('.plot'), rect = plot.getBoundingClientRect();
    const fx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const x = c.x0 + fx * (c.x1 - c.x0);
    const tip = el.querySelector('.ch-tip'), cross = el.querySelector('.ch-cross'), dot = el.querySelector('.ch-dot');
    const tg = clientY != null ? chartTarget(c, el, clientX, clientY) : {};
    el.querySelectorAll('.ln, .area').forEach(n => { n.classList.toggle('hl', !!tg.series && n.dataset.s === tg.series.key); n.classList.toggle('dim', !!tg.series && n.dataset.s !== tg.series.key); });
    el.querySelectorAll('.ch-mark').forEach((n, i) => n.classList.toggle('hl', !!tg.mark && c.marks[i] === tg.mark));
    let html = '', y = null;
    if (tg.mark) html += `<em class="what ${tg.mark.cls}">${esc(tg.mark.label)}</em><span class="what-s">${esc(tg.mark.tip || '')}</span>`;
    else if (tg.series) html += `<em class="what ${tg.series.cls}">${esc(tg.series.name)}</em><span class="what-s">${esc(tg.series.tip || '')}</span>`;
    if (c.kind === 'hour') {
      const h = c.hours.find(b => x >= b.x0 && x < b.x1);
      if (!h) { el.classList.remove('hover'); return; }
      html += `<b>${esc(new Date(h.x0).toLocaleString(locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' }))}</b><span>${esc(fill(t('h.tipHour'), { v: big(h.rate) }))}</span>`;
      y = h.rate;
    } else if (c.kind === 'count') {
      html += `<b>${esc(hhmm(x))}</b>`;
      if (x <= c.now) {
        y = seriesAt(c.actual, x);
        const inGap = c.gap && x < c.gap[1];
        if (y != null) html += `<span>${esc(fill(t(inGap ? 'h.tipEst' : 'h.tipDone'), { v: big(y), p: c.goal ? pct(y / c.goal) : '' }))}</span>`;
      } else {
        const fr = (x - c.now) / (c.end - c.now);
        const need = c.progress + (c.goal - c.progress) * fr;
        if (c.avg != null) { y = c.progress + c.avg * (x - c.now) / 3.6e6; html += `<span class="proj">${esc(fill(t('h.tipAvg'), { v: big(y), p: projPct(y / c.goal) }))}</span>`; }
        if (c.recent != null) { const yr = c.progress + c.recent * (x - c.now) / 3.6e6; html += `<span class="proj2">${esc(fill(t('h.tipRec'), { v: big(yr), p: projPct(yr / c.goal) }))}</span>`; }
        html += `<span class="need">${esc(fill(t('h.tipNeed'), { v: big(need) }))}</span>`;
      }
    } else if (c.kind === 'lib') {
      html += `<b>${esc(hhmm(x))}</b>`;
      const off = ui.chartOff[c.id] || {};
      for (const pl of c.planets) {
        if (off[pl.key]) continue;
        const v = x <= c.now ? seriesAt(pl.pts, x) : pl.proj ? seriesAt(pl.proj, x) ?? (x > pl.proj[pl.proj.length - 1][0] ? pl.proj[pl.proj.length - 1][1] : null) : null;
        if (v != null) { html += `<span>${esc(pl.name)}: ${pct(Math.min(1, v))}</span>`; if (y == null) y = Math.min(1, v); }
      }
      if (x > c.now) html += `<span class="muted">${esc(t('h.tipFuture'))}</span>`;
    }
    if (tg.series) { const v = seriesAt(tg.series.pts, x); if (v != null) y = v; }
    el.classList.add('hover');
    cross.style.left = fx * 100 + '%';
    if (y != null) { dot.style.display = ''; dot.style.left = fx * 100 + '%'; dot.style.bottom = Math.max(0, Math.min(100, (y - c.y0) / (c.y1 - c.y0) * 100)) + '%'; } else dot.style.display = 'none';
    tip.innerHTML = html;
    tip.classList.toggle('left', fx > 0.6);
    tip.style.left = fx * 100 + '%';
  }


