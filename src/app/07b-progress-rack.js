  /* ---------- Progress: the rack and the combat log (8 Nov 2026) ----------
     Owner, after the line charts: "è sempre un grafico brutto". Each objective is a glass tank on one
     scale under one goal line: the liquid is where it stands, white rings where it stood at the end of
     each day, the striped part where today's pace takes it by the deadline. Below, the order's story
     as a log: what happened, a NOW line, and what the forecast says comes next. */
  const PR_HEX = { Terminids: '#fa9f05', Automaton: '#fe3441', Illuminate: '#b48eff', Humans: '#00b0ff' };
  const PR_RGB = { Terminids: '250,159,5', Automaton: '254,52,65', Illuminate: '180,142,255', Humans: '0,176,255' };
  const SE_BLUE = '#00b0ff';
  // the value a series had at the end of each past local day (most recent last, at most four)
  function dayMarks(pts, scale) {
    if (pts.length < 2) return [];
    const out = [], d = new Date(pts[0][0]); d.setHours(0, 0, 0, 0);
    for (d.setDate(d.getDate() + 1); d.getTime() < last.now; d.setDate(d.getDate() + 1)) {
      const v = seriesAt(pts, d.getTime());
      if (v == null) continue;
      const day = new Date(d.getTime() - 3.6e6).toLocaleDateString(locale(), { weekday: 'short' });
      out.push({ f: Math.max(0, Math.min(1, v / scale)), label: day });
    }
    // rings closer than 6 points would print their labels on each other: keep the later day
    const kept = [];
    for (const m of out.slice(-4).reverse()) if (!kept.some(k => Math.abs(k.f - m.f) < 0.06)) kept.push(m);
    return kept;
  }
  function prTank(id, o, first) {
    const W = 150, H = 330, cx = W / 2, rx = 40, ry = 9, top = 46, bot = H - 40;
    const y = (f) => bot - (bot - top) * Math.max(0, Math.min(f, 1));
    const f1 = (x) => x.toFixed(1), g = 'pk' + id, level = Math.max(0, Math.min(1, o.level));
    let seed = 7 + id.length * 13; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const bubbles = level > 0.03 ? Array.from({ length: Math.round(14 * level) + 1 }, () => `<circle cx="${f1(cx - rx + 8 + rnd() * (2 * rx - 16))}" cy="${f1(y(level) + 10 + rnd() * Math.max(0, bot - y(level) - 18))}" r="${[1, 1.4, 2][Math.floor(rnd() * 3)]}" class="pk-bub"/>`).join('') : '';
    const rings = o.marks.map(m => `<path class="pk-ring" d="M${cx - rx} ${f1(y(m.f))}A${rx} ${ry} 0 0 0 ${cx + rx} ${f1(y(m.f))}"/>
      <path class="pk-flag" d="M${cx - rx - 4} ${f1(y(m.f))}h-8l-4 -6h-28v12h28z"/><text class="pk-day" x="${cx - rx - 30}" y="${f1(y(m.f) + 3.5)}">${esc(m.label)}</text>`).join('');
    const ghost = o.ghost != null && o.ghost > level + 0.01 ? `<rect x="${cx - rx}" y="${f1(y(o.ghost))}" width="${2 * rx}" height="${f1(y(level) - y(o.ghost))}" fill="url(#${g}h)"/>
      <ellipse class="pk-ghost" cx="${cx}" cy="${f1(y(o.ghost))}" rx="${rx}" ry="${ry}" style="stroke:${o.fill}"/>` : '';
    const liquid = level > 0.01 ? `<rect x="${cx - rx}" y="${f1(y(level))}" width="${2 * rx}" height="${f1(bot - y(level))}" fill="url(#${g}l)"/>
      <ellipse cx="${cx}" cy="${bot}" rx="${rx}" ry="${ry}" fill="${o.fill}" opacity=".9"/>
      <ellipse class="pk-top" cx="${cx}" cy="${f1(y(level))}" rx="${rx}" ry="${ry}" fill="url(#${g}s)"/>${bubbles}` : '';
    const ticks = Array.from({ length: 11 }, (_, i) => `<line class="pk-tick${i % 5 ? '' : ' big'}" x1="${cx + rx + 9}" y1="${f1(y(i / 10))}" x2="${cx + rx + (i % 5 ? 13 : 16)}" y2="${f1(y(i / 10))}"/>`).join('');
    const over = o.over ? `<path d="M${cx - 9} ${top - 34}l9 -11 9 11z" fill="${o.fill}" class="pk-glow"/><rect class="pk-over" x="${cx - 26}" y="${top - 31}" width="52" height="16" style="stroke:${o.fill}"/><text class="pk-overt" x="${cx}" y="${top - 19}" style="fill:${o.fill}">${esc(o.over)}</text>` : '';
    const pctY = level < 0.8 ? y(level) - 16 : y(level) + 44;
    const bolts = [cx - rx - 6, cx + rx + 6].flatMap(x => [top - 14, bot + 15].map(yy => `<circle cx="${x}" cy="${yy}" r="2" class="pk-bolt"/>`)).join('');
    return `<svg class="pk" viewBox="-40 0 ${W + 40} ${H}" role="img" aria-label="${esc(o.aria)}">
      <defs>
        <pattern id="${g}z" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#14171c"/><rect width="5" height="10" fill="#fee700"/></pattern>
        <pattern id="${g}h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="6" fill="${o.fill}" opacity=".55"/></pattern>
        <linearGradient id="${g}m" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3a4452"/><stop offset=".5" stop-color="#232a34"/><stop offset="1" stop-color="#151a21"/></linearGradient>
        <linearGradient id="${g}r" x1="0" x2="1"><stop offset="0" stop-color="#1a2029"/><stop offset=".5" stop-color="#3a4452"/><stop offset="1" stop-color="#1a2029"/></linearGradient>
        <linearGradient id="${g}gl" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".16" stop-color="#fff" stop-opacity=".05"/><stop offset=".26" stop-color="#fff" stop-opacity=".28"/><stop offset=".34" stop-color="#fff" stop-opacity=".04"/><stop offset=".8" stop-color="#fff" stop-opacity=".02"/><stop offset=".9" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
        <linearGradient id="${g}l" x1="0" x2="1"><stop offset="0" stop-color="${o.fill}" stop-opacity=".55"/><stop offset=".35" stop-color="${o.fill}"/><stop offset="1" stop-color="${o.fill}" stop-opacity=".6"/></linearGradient>
        <radialGradient id="${g}s" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".65"/><stop offset=".4" stop-color="${o.fill}"/><stop offset="1" stop-color="${o.fill}" stop-opacity=".8"/></radialGradient>
      </defs>
      <line class="pk-goal" x1="-400" y1="${top}" x2="${W + 400}" y2="${top}"/>${first ? `<text class="pk-goalt" x="-38" y="${top - 6}">${esc(t('pr.goal'))}</text>` : ''}
      <rect x="${cx - rx - 8}" y="${top - 6}" width="5" height="${bot - top + 12}" fill="url(#${g}r)"/><rect x="${cx + rx + 3}" y="${top - 6}" width="5" height="${bot - top + 12}" fill="url(#${g}r)"/>${ticks}
      <rect x="${cx - rx}" y="${top}" width="${2 * rx}" height="${bot - top}" fill="${o.tint}"/><ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="${o.tint}"/>
      ${liquid}${ghost}
      <rect x="${cx - rx}" y="${top}" width="${2 * rx}" height="${bot - top}" fill="url(#${g}gl)"/><path class="pk-edge" d="M${cx - rx} ${top}V${bot}M${cx + rx} ${top}V${bot}"/>
      ${rings}
      <rect x="${cx - rx - 12}" y="${top - 22}" width="${2 * rx + 24}" height="18" fill="url(#${g}m)" class="pk-cap"/><rect x="${cx - rx - 12}" y="${top - 8}" width="${2 * rx + 24}" height="5" fill="url(#${g}z)"/>
      <rect x="${cx - rx - 14}" y="${bot + 2}" width="${2 * rx + 28}" height="22" fill="url(#${g}m)" class="pk-cap"/><rect x="${cx - rx - 14}" y="${bot + 2}" width="${2 * rx + 28}" height="5" fill="url(#${g}z)"/>
      ${bolts}<ellipse class="pk-lip" cx="${cx}" cy="${top - 1}" rx="${rx}" ry="${f1(ry * 0.55)}"/>${over}
      <text class="pk-pct" x="${cx}" y="${f1(pctY)}">${esc(pct(level))}</text>
    </svg>`;
  }
  // one tank per objective that has a level: planets (liberation, defense, holding) and counted goals
  function prObjectives(entry) {
    const { res } = entry, H = res.hoursLeft, now = last.now, out = [];
    const order = raceOrder(res);
    for (const r of [...res.tasks].sort((a, b) => order.indexOf(a) - order.indexOf(b))) {
      const tk = r.task, done = r.verdict === 'done';
      if (r.planet && (r.defense || r.pw || tk.type === 11 || tk.type === 13)) {
        const pl = r.planet, fac = factionOfPlanet(pl), name = plain(planetName(pl));
        const enemy = fac && fac !== 'Humans' ? fac : r.defense?.faction || null;
        const tint = enemy && PR_RGB[enemy] ? `rgba(${PR_RGB[enemy]},.2)` : 'rgba(4,8,14,.85)';
        // a planet already ours (nothing to liberate) is a full tank: the recorder's history reads 0% for it
        const held = !r.pw && !r.defense;
        const pts = held ? [] : planetSeries(pl.index);
        const level = held ? 1 : pts.length ? pts[pts.length - 1][1] : 0;
        let ghost = null, status, cls = 'ok', fallAt = null;
        if (held) status = t(r.safe ? 'pr.held' : 'pr.freed');
        else if (done) status = t('pr.freed');
        else if (res.ended) { status = fill(t('pr.endedAt'), { p: pct(level) }); cls = 'bad'; }
        else if (r.pw && isFinite(r.eta) && r.eta > 0) {
          ghost = r.eta <= H ? 1 : level + (1 - level) * (H / r.eta);
          if (r.eta <= H) { status = '◆ ' + fill(t('pr.falls'), { when: clock(r.eta) }); cls = 'b'; fallAt = now + r.eta * 3.6e6; }
          else { status = fill(t('pr.byEnd'), { p: pct(ghost) }); cls = 'bad'; }
        } else { status = t('pr.stuck'); cls = 'bad'; }
        out.push({ r, kind: 'planet', name, fill: SE_BLUE, tint, level, ghost, over: null, marks: held ? [] : dayMarks(pts, 1), status, cls, pts, fallAt,
          aria: fill(t('pr.aria'), { name, p: pct(level), more: ' · ' + plain(status) }) });
      } else if (r.counter && !r.simpleCount && r.rates && tk.goal) {
        const f = counterFacts(entry, r), name = plain(taskText(r)), level = Math.min(1, tk.progress / tk.goal);
        const fillC = PR_HEX[tk.faction] || '#e8f1fa';
        let ghost = null, over = null, status, cls = 'ok', fullAt = null;
        const projEnd = f.avg != null ? tk.progress + f.avg * H : null;
        if (done) status = t('pr.done');
        else if (res.ended) { status = fill(t('pr.endedAt'), { p: pct(level) }); cls = 'bad'; }
        else if (projEnd != null) {
          ghost = projEnd / tk.goal;
          if (ghost >= 1) {
            const h = f.avg > 0 ? (tk.goal - tk.progress) / f.avg : null;
            status = h != null ? fill(t('pr.full'), { when: clock(h) }) : t('pr.onPace'); fullAt = h != null ? now + h * 3.6e6 : null;
            if (ghost > 1.05) over = projPct(ghost);
          } else { status = fill(t('pr.byEnd'), { p: pct(ghost) }); cls = 'bad'; }
        } else { status = t('pr.wait'); cls = ''; }
        out.push({ r, kind: 'count', name, fill: fillC, tint: 'rgba(4,8,14,.85)', level, ghost, over, marks: dayMarks(f.pts, tk.goal), status, cls, f, projEnd, fullAt,
          aria: fill(t('pr.aria'), { name, p: pct(level), more: ' · ' + plain(status) }) });
      }
    }
    return out;
  }
  // the order's story, from the same series: losses, comebacks, liberations, quarters of a goal; then the forecast
  function prEvents(entry, objs) {
    const { res, a } = entry, now = last.now, end = Date.parse(a.expiration), H = res.hoursLeft, past = [], next = [];
    if (entry.start && entry.start < now) past.push({ t: entry.start, c: 'start', what: t('pr.start'), why: fill(t(res.tasks.length === 1 ? 'pr.startS1' : 'pr.startS'), { n: res.tasks.length, when: hhmm(end) }) });
    for (const o of objs) {
      if (o.kind === 'planet' && o.pts.length > 1) {
        let peak = o.pts[0], zero = o.pts[0][1] < 0.02, freed = o.pts[0][1] >= 0.999;
        for (const q of o.pts.slice(1)) {
          if (q[1] > peak[1]) peak = q;
          if (!zero && q[1] < 0.02 && peak[1] > 0.1) { past.push({ t: q[0], c: 'bad', big: true, who: o.fill, lvl: 0, lvlOf: o, what: fill(t('pr.lost'), { planet: esc(o.name) }), tag: fill(t('pr.lostTag'), { drop: pct(peak[1]), d: dur((q[0] - peak[0]) / 3.6e6) }), why: t('pr.lostS') }); zero = true; peak = q; continue; }
          if (zero && q[1] > 0.05) { past.push({ t: q[0], c: 'ok', big: true, who: o.fill, lvl: q[1], lvlOf: o, what: fill(t('pr.counter'), { planet: esc(o.name) }), why: t('pr.counterS') }); zero = false; }
          if (!freed && q[1] >= 0.999) { past.push({ t: q[0], c: 'ok', big: true, who: o.fill, lvl: 1, lvlOf: o, what: fill(t('pr.freedE'), { planet: esc(o.name) }), why: t('pr.freedS') }); freed = true; }
        }
      }
      if (o.kind === 'count' && o.f.pts.length > 1) {
        const tk = o.r.task, pts = entry.start ? [[entry.start, 0], ...o.f.pts.filter(q => q[0] > entry.start)] : o.f.pts;
        for (const m of [0.25, 0.5, 0.75, 1]) {
          const v = m * tk.goal, k = pts.findIndex(q => q[1] >= v);
          if (k <= 0) continue;
          const [ta, va] = pts[k - 1], [tb, vb] = pts[k], at = vb > va ? ta + (tb - ta) * (v - va) / (vb - va) : tb;
          const sched = entry.start && end > entry.start ? tk.goal * (at - entry.start) / (end - entry.start) : null, ahead = sched == null || v >= sched;
          past.push({ t: at, c: ahead ? 'ok' : 'warn', who: o.fill, lvl: m, lvlOf: o, what: fill(t('pr.mile'), { name: esc(o.name), m: pct(m) }), tag: sched == null ? null : t(ahead ? 'pr.ahead' : 'pr.behind'), why: fill(t('pr.mileS'), { v: big(v), goal: big(tk.goal) }) });
        }
      }
      if (!res.ended && o.fallAt) next.push({ t: o.fallAt, c: 'b', big: true, who: o.fill, fut: true, what: fill(t('pr.fallsE'), { planet: esc(o.name) }), tag: t('pr.forecast'), why: fill(t('pr.beforeEnd'), { d: dur((end - o.fallAt) / 3.6e6) }) });
      if (!res.ended && o.fullAt && o.fullAt < end) next.push({ t: o.fullAt, c: 'ok', big: true, who: o.fill, fut: true, what: fill(t('pr.fullE'), { name: esc(o.name) }), tag: t('pr.forecast'), why: fill(t('pr.beforeEnd'), { d: dur((end - o.fullAt) / 3.6e6) }) });
    }
    if (!res.ended && end > now) {
      const stuck = objs.filter(o => o.cls === 'bad' && o.ghost == null && o.r.verdict !== 'done').map(o => fill(t('pr.endStuck'), { name: esc(o.name), p: pct(o.level) }));
      const short = objs.filter(o => o.cls === 'bad' && o.ghost != null && o.ghost < 1).map(o => o.kind === 'count'
        ? fill(t('pr.endShort'), { name: esc(o.name), p: pct(o.ghost), v: big(Math.max(0, o.r.task.goal - (o.projEnd || 0))) })
        : fill(t('pr.endSlow'), { planet: esc(o.name), p: pct(o.ghost) }));
      next.push({ t: end, c: 'end', fut: true, what: t('pr.end'), why: short.length || stuck.length ? [...short, ...stuck].join(' ') : t(H > 0 ? 'pr.endOk' : 'pr.endNow') });
    }
    past.sort((x, y) => x.t - y.t); next.sort((x, y) => x.t - y.t);
    return { past: past.slice(-8), next };
  }
  function prEventHTML(e) {
    const bar = e.lvlOf ? `<span class="pl-lvl"><i style="background:${e.lvlOf.tint}"><b style="width:${(e.lvl * 100).toFixed(0)}%;background:${e.lvlOf.fill}"></b></i>${esc(pct(e.lvl))}</span>` : '';
    return `<li class="pl-ev ${e.c}${e.big ? ' big' : ''}${e.fut ? ' fut' : ''}"><span class="pl-when">${esc(hhmm(e.t))}</span><span class="pl-dot" aria-hidden="true"></span>
      <p class="pl-what">${e.who ? `<span class="pl-who" style="--t:${e.who}" aria-hidden="true"></span>` : ''}${e.what}${e.tag ? `<span class="pl-tag">${esc(e.tag)}</span>` : ''}</p>
      <p class="pl-why">${e.why}</p>${bar}</li>`;
  }
  function historyHTML(entry) {
    const { res } = entry;
    const objs = prObjectives(entry);
    const since = record && record.since ? fill(t('h.foot'), { when: new Date(record.since).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }) : t('h.footLocal');
    if (!objs.length) return `<div class="history"><p class="empty-moves unknown">${ICON.dots}<span>${esc(t('h.nothing'))}</span></p>${forecastEvidenceHTML(res, entry.a)}<p class="foot">${esc(since)}</p></div>`;
    const id = String(res.id).replace(/[^\w-]/g, '');
    const rack = objs.map((o, i) => `<figure class="pk-cell">${prTank(id + '-' + i, o, i === 0)}<figcaption class="pk-plate"><b>${esc(o.name)}</b><span class="${o.cls}">${esc(plain(o.status))}</span></figcaption></figure>`).join('');
    const ev = prEvents(entry, objs);
    const log = ev.past.map(prEventHTML).join('') + (res.ended ? '' : `<li class="pl-now" aria-label="${esc(fill(t('pr.now'), { when: hhmm(last.now) }))}"><span>${esc(fill(t('pr.now'), { when: hhmm(last.now) }))}</span></li>`) + ev.next.map(prEventHTML).join('');
    return `<div class="history">
      <section class="pr-card"><h4 class="pr-sec" aria-level="3">${esc(t('pr.rackT'))}</h4><div class="pk-rack">${rack}</div><p class="pr-key">${esc(t('pr.key'))}</p></section>
      <section class="pr-card"><h4 class="pr-sec" aria-level="3">${esc(t('pr.logT'))}</h4><ol class="pr-log">${log}</ol></section>
      ${forecastEvidenceHTML(res, entry.a)}<p class="foot">${esc(since)}</p></div>`;
  }
