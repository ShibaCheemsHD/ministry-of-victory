  /* ---------- Progress: the rack and the war diary (8 Nov 2026) ----------
     Owner, after the line charts: "è sempre un grafico brutto"; then, on the first rack: the days had no
     numbers and the log said too little. Each objective is a glass tank on one scale under one goal line:
     the liquid is where it stands now, a white ring with its day and value where it stood at the end of
     each day, the striped part where today's pace takes it by the deadline; the plate under it says the
     same in words (now, pace, forecast). Below, a diary: one entry per day with how far each objective
     moved and what happened, today's NOW, then the forecast up to the deadline. */
  const PR_HEX = { Terminids: '#fa9f05', Automaton: '#fe3441', Illuminate: '#b48eff', Humans: '#00b0ff' };
  const PR_RGB = { Terminids: '250,159,5', Automaton: '254,52,65', Illuminate: '180,142,255', Humans: '0,176,255' };
  const SE_BLUE = '#00b0ff';
  const hm = (ms) => new Date(ms).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
  const dayName = (ms) => new Date(ms).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' });
  const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const nextDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); return d.getTime(); };
  // where a series stood at the end of each past local day (at most the last four)
  function dayMarks(pts, scale) {
    if (pts.length < 2) return [];
    const out = [];
    for (let d = nextDay(pts[0][0]); d < last.now; d = nextDay(d)) {
      const v = seriesAt(pts, d);
      if (v != null) out.push({ f: Math.max(0, Math.min(1, v / scale)), label: new Date(d - 3.6e6).toLocaleDateString(locale(), { weekday: 'short' }) });
    }
    // rings closer than 7 points would print their labels on each other: keep the later day
    const kept = [];
    for (const m of out.slice(-4).reverse()) if (!kept.some(k => Math.abs(k.f - m.f) < 0.07)) kept.push(m);
    return kept;
  }
  // the pace over the last few hours, from the series (per hour, in the series' unit)
  function recentRate(pts, hours = 6) {
    if (pts.length < 2) return null;
    const t1 = pts[pts.length - 1][0], t0 = Math.max(pts[0][0], t1 - hours * 3.6e6);
    if (t1 - t0 < 1.5 * 3.6e6) return null;
    return (pts[pts.length - 1][1] - seriesAt(pts, t0)) / ((t1 - t0) / 3.6e6);
  }
  function prTank(id, o, first) {
    const W = 150, H = 330, cx = W / 2, rx = 40, ry = 9, top = 46, bot = H - 40;
    const y = (f) => bot - (bot - top) * Math.max(0, Math.min(f, 1));
    const f1 = (x) => x.toFixed(1), g = 'pk' + id, level = Math.max(0, Math.min(1, o.level));
    let seed = 7 + id.length * 13; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const bubbles = level > 0.03 ? Array.from({ length: Math.round(14 * level) + 1 }, () => `<circle cx="${f1(cx - rx + 8 + rnd() * (2 * rx - 16))}" cy="${f1(y(level) + 10 + rnd() * Math.max(0, bot - y(level) - 18))}" r="${[1, 1.4, 2][Math.floor(rnd() * 3)]}" class="pk-bub"/>`).join('') : '';
    // each day's ring, with a flag on the left: its day and where it stood
    const rings = o.marks.map(m => `<path class="pk-ring" d="M${cx - rx} ${f1(y(m.f))}A${rx} ${ry} 0 0 0 ${cx + rx} ${f1(y(m.f))}"/>
      <path class="pk-flag" d="M${cx - rx - 4} ${f1(y(m.f))}l-6 -8h-58v16h58z"/><text class="pk-day" x="${cx - rx - 66}" y="${f1(y(m.f) + 3.5)}"><tspan class="d">${esc(m.label)}</tspan> ${esc(pct(m.f))}</text>`).join('');
    const ghost = o.ghost != null && o.ghost > level + 0.01 ? `<rect x="${cx - rx}" y="${f1(y(o.ghost))}" width="${2 * rx}" height="${f1(y(level) - y(o.ghost))}" fill="url(#${g}h)"/>
      <ellipse class="pk-ghost" cx="${cx}" cy="${f1(y(o.ghost))}" rx="${rx}" ry="${ry}" style="stroke:${o.fill}"/>` : '';
    const liquid = level > 0.01 ? `<rect x="${cx - rx}" y="${f1(y(level))}" width="${2 * rx}" height="${f1(bot - y(level))}" fill="url(#${g}l)"/>
      <ellipse cx="${cx}" cy="${bot}" rx="${rx}" ry="${ry}" fill="${o.fill}" opacity=".9"/>
      <ellipse class="pk-top" cx="${cx}" cy="${f1(y(level))}" rx="${rx}" ry="${ry}" fill="url(#${g}s)"/>${bubbles}` : '';
    // a scale on the right rail: ticks every 10%, numbers every 50%
    const ticks = Array.from({ length: 11 }, (_, i) => `<line class="pk-tick${i % 5 ? '' : ' big'}" x1="${cx + rx + 9}" y1="${f1(y(i / 10))}" x2="${cx + rx + (i % 5 ? 13 : 16)}" y2="${f1(y(i / 10))}"/>`).join('')
      + [0, 0.5, 1].map(v => `<text class="pk-scale" x="${cx + rx + 19}" y="${f1(y(v) + 3.5)}">${v * 100}</text>`).join('');
    const over = o.over ? `<path d="M${cx - 9} ${top - 34}l9 -11 9 11z" fill="${o.fill}" class="pk-glow"/><rect class="pk-over" x="${cx - 26}" y="${top - 31}" width="52" height="16" style="stroke:${o.fill}"/><text class="pk-overt" x="${cx}" y="${top - 19}" style="fill:${o.fill}">${esc(o.over)}</text>` : '';
    // the value now, on the liquid (inside it when the tank is nearly full)
    const pctY = level < 0.8 ? y(level) - 22 : y(level) + 40;
    const bolts = [cx - rx - 6, cx + rx + 6].flatMap(x => [top - 14, bot + 15].map(yy => `<circle cx="${x}" cy="${yy}" r="2" class="pk-bolt"/>`)).join('');
    return `<svg class="pk" viewBox="-72 0 ${W + 72 + 14} ${H}" role="img" aria-label="${esc(o.aria)}">
      <defs>
        <pattern id="${g}z" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#14171c"/><rect width="5" height="10" fill="#fee700"/></pattern>
        <pattern id="${g}h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="6" fill="${o.fill}" opacity=".55"/></pattern>
        <linearGradient id="${g}m" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3a4452"/><stop offset=".5" stop-color="#232a34"/><stop offset="1" stop-color="#151a21"/></linearGradient>
        <linearGradient id="${g}r" x1="0" x2="1"><stop offset="0" stop-color="#1a2029"/><stop offset=".5" stop-color="#3a4452"/><stop offset="1" stop-color="#1a2029"/></linearGradient>
        <linearGradient id="${g}gl" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".16" stop-color="#fff" stop-opacity=".05"/><stop offset=".26" stop-color="#fff" stop-opacity=".28"/><stop offset=".34" stop-color="#fff" stop-opacity=".04"/><stop offset=".8" stop-color="#fff" stop-opacity=".02"/><stop offset=".9" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
        <linearGradient id="${g}l" x1="0" x2="1"><stop offset="0" stop-color="${o.fill}" stop-opacity=".55"/><stop offset=".35" stop-color="${o.fill}"/><stop offset="1" stop-color="${o.fill}" stop-opacity=".6"/></linearGradient>
        <radialGradient id="${g}s" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".65"/><stop offset=".4" stop-color="${o.fill}"/><stop offset="1" stop-color="${o.fill}" stop-opacity=".8"/></radialGradient>
      </defs>
      <line class="pk-goal" x1="-400" y1="${top}" x2="${W + 400}" y2="${top}"/>${first ? `<text class="pk-goalt" x="-70" y="${top - 6}">${esc(t('pr.goal'))}</text>` : ''}
      <rect x="${cx - rx - 8}" y="${top - 6}" width="5" height="${bot - top + 12}" fill="url(#${g}r)"/><rect x="${cx + rx + 3}" y="${top - 6}" width="5" height="${bot - top + 12}" fill="url(#${g}r)"/>${ticks}
      <rect x="${cx - rx}" y="${top}" width="${2 * rx}" height="${bot - top}" fill="${o.tint}"/><ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="${o.tint}"/>
      ${liquid}${ghost}
      <rect x="${cx - rx}" y="${top}" width="${2 * rx}" height="${bot - top}" fill="url(#${g}gl)"/><path class="pk-edge" d="M${cx - rx} ${top}V${bot}M${cx + rx} ${top}V${bot}"/>
      ${rings}
      <rect x="${cx - rx - 12}" y="${top - 22}" width="${2 * rx + 24}" height="18" fill="url(#${g}m)" class="pk-cap"/><rect x="${cx - rx - 12}" y="${top - 8}" width="${2 * rx + 24}" height="5" fill="url(#${g}z)"/>
      <rect x="${cx - rx - 14}" y="${bot + 2}" width="${2 * rx + 28}" height="22" fill="url(#${g}m)" class="pk-cap"/><rect x="${cx - rx - 14}" y="${bot + 2}" width="${2 * rx + 28}" height="5" fill="url(#${g}z)"/>
      ${bolts}<ellipse class="pk-lip" cx="${cx}" cy="${top - 1}" rx="${rx}" ry="${f1(ry * 0.55)}"/>${over}
      <text class="pk-now" x="${cx}" y="${f1(pctY - 20)}">${esc(t('pr.nowS'))}</text><text class="pk-pct" x="${cx}" y="${f1(pctY)}">${esc(pct(level))}</text>
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
        const rate = held ? null : recentRate(pts);
        let ghost = null, fc, cls = 'ok', fallAt = null, band = null;
        if (held) fc = t(r.safe ? 'pr.held' : 'pr.freed');
        else if (done) fc = t('pr.freed');
        else if (res.ended) { fc = fill(t('pr.endedAt'), { p: pct(level) }); cls = 'bad'; }
        else if (r.pw && isFinite(r.eta) && r.eta > 0) {
          ghost = r.eta <= H ? 1 : level + (1 - level) * (H / r.eta);
          if (r.eta <= H) { fc = fill(t('pr.falls'), { when: clock(r.eta) }); cls = 'b'; fallAt = now + r.eta * 3.6e6; band = r.fc?.band || null; }
          else { fc = fill(t('pr.byEnd'), { p: pct(ghost) }); cls = 'bad'; }
        } else { fc = t('pr.stuck'); cls = 'bad'; }
        out.push({ r, kind: 'planet', held, name, fill: SE_BLUE, tint, enemy, level, ghost, over: null, marks: held ? [] : dayMarks(pts, 1), fc, cls, pts, fallAt, band,
          pace: held || done ? null : rate == null ? '—' : `${rate >= 0 ? '+' : '−'}${fmt(Math.abs(rate) * 100, 1)}%/h`, paceBad: rate != null && rate <= 0,
          aria: fill(t('pr.aria'), { name, p: pct(level), more: ' · ' + plain(fc) }) });
      } else if (r.counter && !r.simpleCount && r.rates && tk.goal) {
        const f = counterFacts(entry, r), name = plain(taskText(r)), level = Math.min(1, tk.progress / tk.goal);
        const fillC = PR_HEX[tk.faction] || '#e8f1fa';
        let ghost = null, over = null, fc, cls = 'ok', fullAt = null;
        const projEnd = f.avg != null ? tk.progress + f.avg * H : null;
        if (done) fc = t('pr.done');
        else if (res.ended) { fc = fill(t('pr.endedAt'), { p: pct(level) }); cls = 'bad'; }
        else if (projEnd != null) {
          ghost = projEnd / tk.goal;
          if (ghost >= 1) {
            const h = f.avg > 0 ? (tk.goal - tk.progress) / f.avg : null;
            fc = h != null ? fill(t('pr.full'), { when: clock(h) }) : t('pr.onPace'); fullAt = h != null ? now + h * 3.6e6 : null;
            if (ghost > 1.05) over = projPct(ghost);
          } else { fc = fill(t('pr.byEndShort'), { p: pct(ghost), v: big(tk.goal - projEnd) }); cls = 'bad'; }
        } else { fc = t('pr.wait'); cls = ''; }
        const rate = f.recent ?? f.avg;
        out.push({ r, kind: 'count', name, fill: fillC, tint: 'rgba(4,8,14,.85)', level, ghost, over, marks: dayMarks(f.pts, tk.goal), fc, cls, f, projEnd, fullAt,
          pace: done ? null : rate == null ? '—' : `${big(rate)}/h`, need: !done && f.needed ? `${big(f.needed)}/h` : null, paceBad: rate != null && f.needed && rate < f.needed,
          aria: fill(t('pr.aria'), { name, p: pct(level), more: ' · ' + plain(fc) }) });
      }
    }
    return out;
  }
  // value of an objective's series at a time (planets 0..1, counts as a share of the goal)
  const prAt = (o, ms) => o.kind === 'planet' ? seriesAt(o.pts, ms) : (v => v == null ? null : v / o.r.task.goal)(seriesAt(o.f.pts, ms));
  // what happened: losses, comebacks, liberations, quarters of a goal
  function prHappened(entry, objs) {
    const { res, a } = entry, end = Date.parse(a.expiration), ev = [];
    if (entry.start && entry.start < last.now) {
      const held = objs.filter(o => o.held).map(o => esc(o.name));
      const open = objs.filter(o => !o.held).map(o => { const v = prAt(o, entry.start + 60e3); return v == null ? esc(o.name) : `${esc(o.name)} ${pct(v)}`; });
      ev.push({ t: entry.start, c: 'start', what: t('pr.start'), why: [fill(t(res.tasks.length === 1 ? 'pr.startS1' : 'pr.startS'), { n: res.tasks.length, when: hhmm(end) }),
        open.length ? fill(t('pr.startOpen'), { list: open.join(', ') }) : '', held.length ? fill(t('pr.startHeld'), { list: held.join(', ') }) : ''].filter(Boolean).join(' ') });
    }
    for (const o of objs) {
      if (o.kind === 'planet' && o.pts.length > 1) {
        let peak = o.pts[0], zero = o.pts[0][1] < 0.02, freed = o.pts[0][1] >= 0.999;
        for (const q of o.pts.slice(1)) {
          if (q[1] > peak[1]) peak = q;
          if (!zero && q[1] < 0.02 && peak[1] > 0.1) {
            ev.push({ t: q[0], c: 'bad', big: true, who: o.fill, what: fill(t('pr.lost'), { planet: esc(o.name) }),
              why: fill(t(o.enemy ? 'pr.lostS' : 'pr.lostS0'), { p: pct(peak[1]), when: hhmm(peak[0]), d: dur((q[0] - peak[0]) / 3.6e6), foe: esc(o.enemy ? t('facPl.' + o.enemy) : '') }) });
            zero = true; peak = q; continue;
          }
          if (zero && q[1] > 0.05) { ev.push({ t: q[0], c: 'ok', big: true, who: o.fill, what: fill(t('pr.counter'), { planet: esc(o.name) }), why: t('pr.counterS') }); zero = false; }
          if (!freed && q[1] >= 0.999) { ev.push({ t: q[0], c: 'ok', big: true, who: o.fill, what: fill(t('pr.freedE'), { planet: esc(o.name) }), why: t('pr.freedS') }); freed = true; }
        }
      }
      if (o.kind === 'count' && o.f.pts.length > 1) {
        const tk = o.r.task, pts = entry.start ? [[entry.start, 0], ...o.f.pts.filter(q => q[0] > entry.start)] : o.f.pts;
        for (const m of [0.25, 0.5, 0.75, 1]) {
          const v = m * tk.goal, k = pts.findIndex(q => q[1] >= v);
          if (k <= 0) continue;
          const [ta, va] = pts[k - 1], [tb, vb] = pts[k], at = vb > va ? ta + (tb - ta) * (v - va) / (vb - va) : tb;
          const due = entry.start && end > entry.start ? entry.start + (end - entry.start) * m : null;
          ev.push({ t: at, c: due == null || at <= due ? 'ok' : 'warn', who: o.fill, what: fill(t('pr.mile'), { name: esc(o.name), m: pct(m) }),
            why: fill(t('pr.mileS'), { v: big(v), goal: big(tk.goal) }) + (due == null ? '' : ' ' + fill(t(at <= due ? 'pr.mileEarly' : 'pr.mileLate'), { d: dur(Math.abs(due - at) / 3.6e6) })) });
        }
      }
    }
    return ev.sort((x, y) => x.t - y.t);
  }
  // what comes next, at today's pace
  function prNext(entry, objs) {
    const { res, a } = entry, end = Date.parse(a.expiration), ev = [];
    if (res.ended || end <= last.now) return ev;
    for (const o of objs) {
      if (o.fallAt) ev.push({ t: o.fallAt, c: 'b', big: true, fut: true, who: o.fill, what: fill(t('pr.fallsE'), { planet: esc(o.name) }), tag: t('pr.forecast'),
        why: fill(t('pr.fallsS'), { pace: o.pace || '', d: dur((end - o.fallAt) / 3.6e6) }) + (o.band && o.band.hi > o.band.lo ? ' ' + fill(t('pr.band'), { a: esc(clock(o.band.lo)), b: esc(clock(o.band.hi)) }) : '') });
      if (o.fullAt && o.fullAt < end) ev.push({ t: o.fullAt, c: 'ok', big: true, fut: true, who: o.fill, what: fill(t('pr.fullE'), { name: esc(o.name) }), tag: t('pr.forecast'),
        why: fill(t('pr.fullS'), { pace: o.pace || '', d: dur((end - o.fullAt) / 3.6e6) }) });
    }
    const late = objs.filter(o => !o.held && o.r.verdict !== 'done' && !(o.fallAt || (o.fullAt && o.fullAt < end)));
    const lines = late.map(o => o.ghost != null ? (o.kind === 'count' ? fill(t('pr.endShort'), { name: esc(o.name), p: pct(o.ghost), v: big(Math.max(0, o.r.task.goal - (o.projEnd || 0))) }) : fill(t('pr.endSlow'), { planet: esc(o.name), p: pct(o.ghost) }))
      : fill(t('pr.endStuck'), { name: esc(o.name), p: pct(o.level) }));
    ev.push({ t: end, c: late.length ? 'end bad' : 'end', fut: true, what: t('pr.end'), why: lines.length ? lines.join(' ') : t('pr.endOk') });
    return ev.sort((x, y) => x.t - y.t);
  }
  function prEventHTML(e, withDay) {
    const rel = e.t > last.now ? fill(t('pr.inT'), { d: dur((e.t - last.now) / 3.6e6) }) : fill(t('pr.agoT'), { d: dur((last.now - e.t) / 3.6e6) });
    return `<li class="pl-ev ${e.c}${e.big ? ' big' : ''}${e.fut ? ' fut' : ''}"><span class="pl-when"><b>${esc(withDay ? hhmm(e.t) : hm(e.t))}</b><small>${esc(rel)}</small></span><span class="pl-dot" aria-hidden="true"></span>
      <p class="pl-what">${e.who ? `<span class="pl-who" style="--t:${e.who}" aria-hidden="true"></span>` : ''}${e.what}${e.tag ? `<span class="pl-tag">${esc(e.tag)}</span>` : ''}</p>
      <p class="pl-why">${e.why}</p></li>`;
  }
  // how far each objective moved between two moments, as chips
  function prMoves(objs, t0, t1) {
    return objs.filter(o => !o.held).map(o => {
      const a = prAt(o, t0), b = prAt(o, t1);
      if (a == null || b == null) return '';
      const d = (b - a) * 100, cls = d > 0.4 ? 'up' : d < -0.4 ? 'down' : 'flat';
      const delta = o.kind === 'count' ? `+${big(Math.max(0, (b - a) * o.r.task.goal))}` : `${d >= 0 ? '+' : '−'}${fmt(Math.abs(d), Math.abs(d) < 10 ? 1 : 0)}`;
      return `<span class="pd-mv ${cls}"><i style="--t:${o.fill}" aria-hidden="true"></i><b>${esc(o.name)}</b><span>${pct(a)} → ${pct(b)}</span><em>${cls === 'up' ? '▲' : cls === 'down' ? '▼' : '■'} ${esc(delta)}</em></span>`;
    }).join('');
  }
  function prDiaryHTML(entry, objs) {
    const { res, a } = entry, now = last.now, end = Date.parse(a.expiration);
    const happened = prHappened(entry, objs), next = prNext(entry, objs);
    const first = Math.min(entry.start || now, ...happened.map(e => e.t)), lastT = res.ended ? Math.min(now, end) : Math.max(now, end);
    const days = [];
    for (let d = dayStart(first); d <= lastT; d = nextDay(d)) days.push(d);
    // at most the last six days before today: anything older is told in the first one shown, with its weekday
    const today = dayStart(now), shown = days.filter(d => d >= today - 6 * 864e5 || d > today);
    const html = shown.map(d => {
      const d1 = nextDay(d), isToday = d === today, future = d > today;
      const evPast = happened.filter(e => (e.t >= d || (d === shown[0] && e.t < d)) && e.t < d1);
      const evNext = next.filter(e => e.t >= d && e.t < d1);
      const from = Math.max(d, entry.start || d), to = Math.min(d1, now);
      const moves = future || to <= from ? '' : prMoves(objs, from, to);
      const nowBlock = isToday && !res.ended ? `<li class="pl-now"><span>${esc(fill(t('pr.now'), { when: hm(now) }))}</span></li>` : '';
      const items = evPast.map(e => prEventHTML(e, e.t < d)).join('') + nowBlock + evNext.map(e => prEventHTML(future ? { ...e, tag: null } : e)).join('');
      if (!items && !moves) return '';
      return `<li class="pd${isToday ? ' today' : ''}${future ? ' future' : ''}">
        <h5 class="pd-h" aria-level="4">${isToday ? `<span class="pd-today">${esc(t('pr.today'))}</span>` : ''}${esc(dayName(d))}${future ? `<span class="pd-fc">${esc(t('pr.forecast'))}</span>` : ''}</h5>
        ${moves ? `<div class="pd-moves"><span class="pd-k">${esc(t(isToday ? 'pr.movesToday' : 'pr.movesDay'))}</span>${moves}</div>` : ''}
        ${items ? `<ol class="pr-log">${items}</ol>` : ''}</li>`;
    }).join('');
    return `<ol class="pr-days">${html}</ol>`;
  }
  function historyHTML(entry) {
    const { res } = entry;
    const objs = prObjectives(entry);
    const since = record && record.since ? fill(t('h.foot'), { when: new Date(record.since).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }) : t('h.footLocal');
    if (!objs.length) return `<div class="history"><p class="empty-moves unknown">${ICON.dots}<span>${esc(t('h.nothing'))}</span></p>${forecastEvidenceHTML(res, entry.a)}<p class="foot">${esc(since)}</p></div>`;
    const id = String(res.id).replace(/[^\w-]/g, '');
    const row = (k, v, cls) => v == null ? '' : `<div class="pk-row"><dt>${esc(t(k))}</dt><dd${cls ? ` class="${cls}"` : ''}>${esc(v)}</dd></div>`;
    const rack = objs.map((o, i) => `<figure class="pk-cell">${prTank(id + '-' + i, o, i === 0)}<figcaption class="pk-plate"><b>${esc(o.name)}</b>
      <dl>${row('pr.rowNow', pct(o.level))}${row('pr.rowPace', o.pace, o.paceBad ? 'bad' : '')}${row('pr.rowNeed', o.need, 'y')}${row(o.held || o.r.verdict === 'done' ? 'pr.rowState' : 'pr.rowFc', plain(o.fc), o.cls)}</dl></figcaption></figure>`).join('');
    const sw = (cls, label) => `<span class="pk-k"><i class="${cls}" aria-hidden="true"></i>${esc(t(label))}</span>`;
    return `<div class="history">
      <section class="pr-card"><h4 class="pr-sec" aria-level="3">${esc(t('pr.rackT'))}</h4><div class="pk-rack" tabindex="0" role="region" aria-label="${esc(t('pr.rackT'))}">${rack}</div>
        <p class="pr-key">${sw('k-liq', 'pr.kNow')}${sw('k-ring', 'pr.kDay')}${sw('k-fc', 'pr.kFc')}${sw('k-goal', 'pr.kGoal')}</p></section>
      <section class="pr-card"><h4 class="pr-sec" aria-level="3">${esc(t('pr.logT'))}</h4>${prDiaryHTML(entry, objs)}</section>
      ${forecastEvidenceHTML(res, entry.a)}<p class="foot">${esc(since)}</p></div>`;
  }
