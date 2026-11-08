  /* ---------- history: how the order got here (interactive charts) ---------- */
  // Each chart: SVG paths drawn in a 1000 x 300 box stretched to the card (strokes keep their width),
  // HTML for every label, and a crosshair + tooltip that follow the pointer.
  const charts = {};
  const HOPELESS = new Set(['impossible', 'nearly_impossible', 'failed']);
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
  // liberation of the planets an objective names, over time
  // the last enemy that held a planet, from the recorded owners (for a planet that is ours now)
  function planetFoe(idx) {
    const pts = recordProgress?.planets?.[idx] || [];
    for (let k = pts.length - 1; k >= 0; k--) { const o = { T: 'Terminids', A: 'Automaton', I: 'Illuminate' }[pts[k][4]]; if (o) return o; }
    return null;
  }
  function planetSeries(idx) {
    // a planet that is ours (no event on it) counts as 100%, not as the 0% its health reads (8 Nov 2026:
    // three planets liberated during the order looked "already ours" from the start)
    const p = last.planets[idx], raw = [];
    for (const x of recordProgress?.planets?.[idx] || []) raw.push([x[0], x[4] === 'H' && !x[2] ? 1 : x[1]]);
    const m = p ? (p.event ? p.event.maxHealth : p.maxHealth) : null;
    if (m) for (const sm of samples) { const v = sm.planets && sm.planets[idx]; if (v && v.h != null) raw.push([sm.t, v.ours ? 1 : 1 - v.h / m]); }
    if (p && m) raw.push([last.now, p.currentOwner === 'Humans' && !p.event ? 1 : 1 - (p.event ? p.event.health : p.health) / m]);
    raw.sort((a, b) => a[0] - b[0]);
    return thinPts(raw);
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
    // a margin label that would run past the card (phones) moves inside the plot, against its right edge
    const box = (el.closest('.hist-card') || el).getBoundingClientRect();
    edge.forEach(g => { g.classList.remove('in'); if (g.getBoundingClientRect().right > box.right - 2) g.classList.add('in'); });
    // the "Now" and "Deadline" marks can sit close together: the later one drops a line
    const marks = [...el.querySelectorAll('.ch-mark span')]; const ms = [];
    for (const sp of marks) { sp.classList.remove('low'); const r = sp.getBoundingClientRect(); if (ms.some(p => hit(p, r))) sp.classList.add('low'); ms.push(sp.getBoundingClientRect()); }
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


