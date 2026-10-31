  /* ---------- war map: the fronts as the game's galaxy map draws them ---------- */
  // Every planet being fought over, at its real galactic position (Super Earth in the centre), in its
  // owner's colour and sized by its Helldivers. The order's planets get a white ring, the planets of
  // "what to do now" yellow brackets; attacks are dashed, supply lines faint. Hover or tap a planet.
  const FAC_VAR = { Terminids: 'var(--f-terminid)', Automaton: 'var(--f-automaton)', Illuminate: 'var(--f-illuminate)', Humans: 'var(--f-human)' };
  function mapHTML(res) {
    const P = Object.values(last.planets || {}).filter(p => p && p.position && isFinite(p.position.x) && isFinite(p.position.y));
    if (P.length < 3) return '';
    const rel = res ? orderPlanets(res) : new Set();
    const cp = res ? cardPlanets({ res }) : null;
    const focus = new Set(cp ? (cp.list || [cp.planet]).map(p => Number(p.index)) : []);
    const maxP = Math.max(1, ...P.map(p => p.statistics?.playerCount || 0));
    const dssI = last.dssIdx != null ? Number(last.dssIdx) : null;
    // galaxy scale: the farthest planet sits near the edge of the disc
    const far = Math.max(0.3, ...P.map(p => Math.hypot(p.position.x, p.position.y)));
    const k = Math.min(1.6, 94 / (far * 100)) * 100;
    // each planet's footprint: its dot plus whatever is drawn around it (ring, defense ring, brackets, DSS)
    const N = P.map(p => {
      const i = Number(p.index), r = 2 + Math.sqrt((p.statistics?.playerCount || 0) / maxP) * 4.2;
      const isF = focus.has(i), isR = rel.has(i);
      const R = Math.max(4.5, r + (isR ? 3 : 0) + (p.event ? 2.4 : 0) + (isF ? 5.5 : 0) + (i === dssI ? (isF ? 5 : 3) : 0));
      const x0 = p.position.x * k, y0 = -p.position.y * k;
      return { p, i, r, R, isF, isR, x0, y0, x: x0, y: y0 };
    });
    // spread overlapping planets apart, as little as possible, keeping them near their real place
    const SE = { x: 0, y: 0, R: 5, fixed: true };
    for (let it = 0; it < 160; it++) {
      let moved = false;
      for (let a = 0; a < N.length; a++) {
        const A = N[a];
        for (let b = a + 1; b <= N.length; b++) {
          const B = b === N.length ? SE : N[b];
          let dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
          const need = A.R + B.R + 1.4;
          if (d >= need) continue;
          if (d < 1e-6) { dx = Math.cos(a + b); dy = Math.sin(a + b); d = 1; }
          const push = (need - d) / (B.fixed ? 1 : 2), ux = dx / d, uy = dy / d;
          A.x -= ux * push; A.y -= uy * push;
          if (!B.fixed) { B.x += ux * push; B.y += uy * push; }
          moved = true;
        }
      }
      for (const n of N) {
        n.x += (n.x0 - n.x) * 0.015; n.y += (n.y0 - n.y) * 0.015;
        const d = Math.hypot(n.x, n.y), lim = 106 - n.R;
        if (d > lim) { n.x *= lim / d; n.y *= lim / d; }
      }
      if (!moved && it > 20) break;
    }
    const at = new Map(N.map(n => [n.i, n]));
    const f1 = (v) => v.toFixed(1);
    const lines = [];
    for (const n of N) {
      for (const w of n.p.waypoints || []) { const q = at.get(Number(w)); if (q && n.i < q.i) lines.push(`<line class="mw" x1="${f1(n.x)}" y1="${f1(n.y)}" x2="${f1(q.x)}" y2="${f1(q.y)}"/>`); }
      for (const tIdx of n.p.attacking || []) { const q = at.get(Number(tIdx)); if (q) lines.push(`<line class="ma" style="--c:${FAC_VAR[factionOfPlanet(n.p)] || 'var(--fg)'}" x1="${f1(n.x)}" y1="${f1(n.y)}" x2="${f1(q.x)}" y2="${f1(q.y)}"/>`); }
    }
    // one label, for the planet of "what to do now", on the first side where it hits nothing
    let label = '';
    const L = cp && at.get(Number(cp.planet.index));
    if (L) {
      const txtL = plain(planetName(L.p)).toUpperCase(), w = txtL.length * 4.9 + 4, h = 9;
      // candidate boxes on rings around the planet, nearest first; a leader line when it had to move away
      const hits = (b) => b.x < -110 || b.x + w > 110 || b.y < -110 || b.y + h > 110
        || N.some(n => n !== L && Math.hypot(Math.max(b.x - n.x, 0, n.x - b.x - w), Math.max(b.y - n.y, 0, n.y - b.y - h)) < n.R + 2)
        || Math.hypot(Math.max(b.x - L.x, 0, L.x - b.x - w), Math.max(b.y - L.y, 0, L.y - b.y - h)) < L.R + 1;
      let pick = null;
      for (let gap = 2; gap <= 40 && !pick; gap += 3) {
        for (const ang of [-90, 90, 0, 180, -45, -135, 45, 135, -65, -115, 65, 115, -20, -160, 20, 160]) {
          const a = ang * Math.PI / 180, dist = L.R + gap;
          const cx = L.x + Math.cos(a) * (dist + w / 2 * Math.abs(Math.cos(a))), cy = L.y + Math.sin(a) * (dist + h / 2 * Math.abs(Math.sin(a)));
          const b = { x: cx - w / 2, y: cy - h / 2 };
          if (!hits(b)) { pick = { ...b, gap, cx, cy }; break; }
        }
      }
      if (!pick) pick = { x: L.x - w / 2, y: L.y - L.R - h - 2, gap: 2, cx: L.x, cy: L.y - L.R - h / 2 - 2 };
      const ex = pick.cx - L.x, ey = pick.cy - L.y, el = Math.hypot(ex, ey) || 1;
      const lead = pick.gap > 5 ? `<line class="lead" x1="${f1(L.x + ex / el * (L.R + 0.5))}" y1="${f1(L.y + ey / el * (L.R + 0.5))}" x2="${f1(Math.max(pick.x, Math.min(pick.x + w, L.x)))}" y2="${f1(Math.max(pick.y, Math.min(pick.y + h, L.y)))}"/>` : '';
      label = `${lead}<text class="lbl" x="${f1(pick.cx)}" y="${f1(pick.cy + 3)}" text-anchor="middle">${esc(txtL)}</text>`;
    }
    const order = [...N].sort((a, b) => (a.isF - b.isF) || (a.isR - b.isR));
    const dots = order.map(n => {
      const p = n.p, owner = p.event ? (p.event.faction || factionOfPlanet(p)) : factionOfPlanet(p), r = n.r;
      const lib = p.event && p.event.maxHealth ? 1 - p.event.health / p.event.maxHealth : p.maxHealth ? 1 - p.health / p.maxHealth : 0;
      const tip = `${plain(planetName(p))}|${plain(facName(owner) || '')}|${people(p.statistics?.playerCount || 0)}|${p.event ? 'def' : 'lib'}|${(lib * 100).toFixed(1)}`;
      let ring = r;
      const parts = [];
      if (p.event) { ring += 2.4; parts.push(`<circle class="evr" r="${f1(ring)}"/>`); }
      if (n.isR) { ring += 2.6; parts.push(`<circle class="ring" r="${f1(ring)}"/>`); }
      if (n.isF) { const b = ring + 3, c = 3.2; parts.push(`<path class="br" d="M${f1(-b)} ${f1(-b + c)}V${f1(-b)}H${f1(-b + c)}M${f1(b - c)} ${f1(-b)}H${f1(b)}V${f1(-b + c)}M${f1(b)} ${f1(b - c)}V${f1(b)}H${f1(b - c)}M${f1(-b + c)} ${f1(b)}H${f1(-b)}V${f1(b - c)}"/>`); }
      if (n.i === dssI) { const o = n.isF ? ring + 3 + 2.6 : (ring + 2.2) * 0.7071; parts.push(`<path class="mdss" d="M${f1(o)} ${f1(-o - 2.2)}l2.2 2.2-2.2 2.2-2.2-2.2z"/>`); }
      return `<g class="mp ${n.isF ? 'focus' : ''} ${n.isR ? 'rel' : ''} ${p.event ? 'ev' : ''}" style="--c:${FAC_VAR[owner] || 'var(--fg)'}" transform="translate(${f1(n.x)} ${f1(n.y)})" data-mp="${n.i}" data-tip="${esc(tip)}" tabindex="0" role="button" aria-label="${esc(plain(planetName(p)))}">
        <circle class="hit" r="${f1(n.R)}"/>${parts.join('')}<circle class="dot" r="${f1(r)}"/></g>`;
    }).join('');
    return `<section class="panel br rail-card map-card">
      <span class="label">${esc(t('map.title'))}</span>
      <div class="war-map ${res ? '' : 'all'}">
        <svg viewBox="-112 -112 224 224" role="group" aria-label="${esc(t('map.aria'))}">
          <circle class="mr" r="106"/><circle class="mr" r="70"/><circle class="mr" r="35"/>
          <g class="mlines">${lines.join('')}</g>
          <circle class="se" r="3"/><circle class="se-c" r="1"/>
          ${dots}${label}
        </svg>
        <div class="map-tip" hidden></div>
      </div>
      <p class="map-key"><span><i class="k-ring"></i>${esc(t('map.kOrder'))}</span>${focus.size ? `<span><i class="k-br"></i>${esc(t('map.kNow'))}</span>` : ''}<span><i class="k-ev"></i>${esc(t('map.kAttack'))}</span>${dssI != null && at.has(dssI) ? `<span><i class="k-dss"></i>DSS</span>` : ''}</p>
    </section>`;
  }
  function railHTML(res, a) {
    const v = res.verdict;
    const alert = v === 'impossible' || v === 'nearly_impossible' || v === 'failed';
    const exp = Date.parse(a.expiration);
    const medals = medalsOf(a);
    const brief = clean(txt(a.briefing));
    const desc = txt(a.description) && txt(a.description) !== txt(a.briefing) ? clean(txt(a.description)) : '';
    const open = !!ui.briefOpen[a.id];
    return `<aside class="area-rail">
      <section class="panel br rail-card verdict-card ${alert ? 'alert' : ''}">
        <span class="label">${t('forecast')}</span>
        <div class="stamp v-${v}" data-stamp="${esc(res.id)}:${v}">${ICON[VICON[v] || 'dots']}<span>${esc(t('v.' + v))}</span></div>
        <p class="meaning">${esc(t('m.' + v))}</p>
        ${whyHTML(res)}
        <div class="timer ${v === 'done' || res.ended ? 'finished' : ''}" title="${esc(fill(t('endsAt'), { when: isFinite(exp) ? new Date(exp).toLocaleString(locale(), { weekday: 'long', hour: 'numeric', minute: '2-digit' }) : '—' }))}">
          <div><span class="label">${t('timeLeft')}</span><div class="count" data-exp="${exp}">—</div></div>
          ${medals ? `<div class="reward">${medalSvg}<span>${fill(t('medals'), { n: fmt(medals) })}</span></div>` : ''}
        </div>
      </section>
      ${mapHTML(res)}
      ${joelActive(res, a)}
      ${brief || desc ? `<section class="panel br rail-card brief-card">
        <span class="label">${t('brief')}</span>
        <div class="text ${open ? 'open' : ''}" id="brief-${esc(a.id)}"><p>${brief}</p>${desc ? `<p style="margin-top:8px">${desc}</p>` : ''}</div>
        <button type="button" class="linkbtn" data-brief="${esc(a.id)}" aria-expanded="${open}" aria-controls="brief-${esc(a.id)}">${open ? t('less') : t('more')}</button>
      </section>` : ''}
    </aside>`;
  }

