  /* ---------- animations ---------- */
  function afterRender(entry, firstTime) {
    const view = $('view');
    layoutCharts();
    if (ui.pcPinned) openCard(true);
    const motion = !reduced();
    if (motion && firstTime) view.querySelector('.order')?.classList.add('anim');
    // bars: from previous width to new width
    const bars = view.querySelectorAll('[data-w]');
    bars.forEach(el => {
      const key = el.dataset.key, w = Number(el.dataset.w);
      const from = motion ? (prev.bars[key] ?? 0) : w;
      el.style.transition = 'none';
      el.style.width = from + '%';
    });
    // orbit rings: same idea, on stroke-dashoffset (pathLength = 100)
    const rings = view.querySelectorAll('[data-ring]');
    rings.forEach(el => {
      const key = el.dataset.ring, f = Number(el.dataset.frac);
      el.style.transition = 'none';
      el.style.strokeDashoffset = String(100 - (motion ? (prev.bars[key] ?? 0) : f));
    });
    void view.offsetWidth;
    requestAnimationFrame(() => {
      bars.forEach(el => {
        el.style.transition = '';
        el.style.width = el.dataset.w + '%';
        prev.bars[el.dataset.key] = Number(el.dataset.w);
      });
      rings.forEach(el => {
        el.style.transition = '';
        el.style.strokeDashoffset = String(100 - Number(el.dataset.frac));
        prev.bars[el.dataset.ring] = Number(el.dataset.frac);
      });
    });
    fitTarget();
    // briefing: no fade or "read more" when the text already fits (skip when hidden, as on phones)
    view.querySelectorAll('.brief-card .text').forEach(el => {
      if (el.classList.contains('open') || !el.clientHeight) return;
      const short = el.scrollHeight <= el.clientHeight + 2;
      el.classList.toggle('short', short);
      const btn = el.parentElement.querySelector('[data-brief]');
      if (btn) btn.hidden = short;
    });
    // numbers
    document.querySelectorAll('[data-count]').forEach(el => countUp(el));
    // stamp
    const stamp = view.querySelector('[data-stamp]');
    if (stamp) {
      const id = String(entry.a.id), v = stamp.dataset.stamp;
      if (motion && prev.verdict[id] !== v) stamp.classList.add('slam');
      prev.verdict[id] = v;
    }
    // directive headline decrypt
    const tgt = view.querySelector('[data-decrypt]');
    if (tgt) {
      const id = String(entry.a.id), text = tgt.dataset.decrypt;
      if (motion && prev.dir[id] !== text) decrypt(tgt, text);
      if (prev.dir[id] != null && prev.dir[id] !== text) toast(fill(t('dirChanged'), { x: directiveParts(entry.res).title }));
      prev.dir[id] = text;
    }
  }

  // shrink the headline until no single word overflows its column (names vary a lot in length)
  function fitTarget() {
    const el = $('view').querySelector('.directive .target');
    if (!el) return;
    el.style.fontSize = ''; el.style.overflowWrap = '';
    let size = parseFloat(getComputedStyle(el).fontSize) || 60, guard = 0;
    while (el.scrollWidth > el.clientWidth + 1 && size > 22 && guard++ < 60) { size -= 2; el.style.fontSize = size + 'px'; }
    if (el.scrollWidth > el.clientWidth + 1) el.style.overflowWrap = 'anywhere';
  }
  let fitRaf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitTarget); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitTarget()).catch(() => {});

  function countUp(el) {
    const key = el.dataset.count, to = Number(el.dataset.to);
    const from = prev.count[key];
    prev.count[key] = to;
    if (reduced() || from == null || from === to || !isFinite(to)) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), D = 900;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$';
  function decrypt(el, text) {
    const chars = [...text];
    let frame = 0;
    const total = 18 + chars.length;
    const run = () => {
      frame++;
      el.innerHTML = chars.map((c, i) => {
        if (c === ' ') return ' ';
        const settle = 6 + i * 1.2;
        if (frame >= settle) return esc(c);
        return `<span class="ch scr">${GLYPHS[Math.floor(Math.random() * GLYPHS.length)]}</span>`;
      }).join('');
      if (frame < total) setTimeout(run, 34); else el.textContent = text;
    };
    run();
  }

  /* ---------- live updates (every second) ---------- */
  function fmtCountdown(ms) {
    if (!isFinite(ms)) return '—';
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const u = t('dhms'), p2 = (n) => String(n).padStart(2, '0');
    return `${d ? d + `<span>${u[0]}</span>` : ''}${p2(h)}<span>${u[1]}</span>${p2(m)}<span>${u[2]}</span>${p2(sec)}<span>${u[3]}</span>`;
  }
  // live counters: between refreshes, objectives count up at the pace just measured
  function tickCounters() {
    const now = Date.now();
    document.querySelectorAll('.tick[data-tick]').forEach(el => {
      const v = Math.min(Number(el.dataset.goal), Number(el.dataset.tick) + Number(el.dataset.rate) * (now - Number(el.dataset.t0)) / 1000);
      el.textContent = fmt(Math.floor(v));
    });
  }
  setInterval(tickCounters, 250);
  function tick() {
    document.querySelectorAll('[data-exp]').forEach(el => {
      const ms = Number(el.dataset.exp) - Date.now();
      el.innerHTML = fmtCountdown(ms);
      const card = el.closest('.timer');
      if (card && !card.classList.contains('finished')) { card.classList.toggle('soon', ms < 24 * 3600e3 && ms >= 6 * 3600e3); card.classList.toggle('urgent', ms < 6 * 3600e3); }
    });
    // live dot goes grey when the data is getting old (failed refreshes)
    const stale = !lastOk || Date.now() - lastOk > 3 * REFRESH_MS;
    document.querySelectorAll('.hud .live, .directive .live').forEach(el => el.classList.toggle('off', stale));
    if (!lastRun) return;
    const left = Math.max(0, REFRESH_MS - (Date.now() - lastRun));
    const ring = $('ring');
    if (ring) ring.style.strokeDashoffset = String(RING * (1 - left / REFRESH_MS));
    const btn = $('refresh');
    btn.title = (last ? fill(t('updatedAt'), { t: new Date(last.now).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' }) }) + ' · ' : '') + fill(t('nextIn'), { s: Math.ceil(left / 1000) });
    btn.setAttribute('aria-label', busy ? t('loading') : t('refresh') + '. ' + btn.title);
    if (left === 0 && !document.hidden && !busy) refresh();
  }

  /* ---------- interaction ---------- */
  function updateSim(id, v) {
    const entry = last && last.results.find(x => String(x.a.id) === String(id));
    if (!entry) return;
    ui.sim[id] = v;
    const out = $('simout-' + id);
    if (out) out.innerHTML = simOutHTML(entry.res, v / 100);
    const input = document.querySelector(`[data-sim="${CSS.escape(String(id))}"]`);
    if (input) { input.value = v; input.style.setProperty('--p', ((v - 5) / 95) * 100 + '%'); }
  }
  function updatePace(id, v) {
    const entry = last && last.results.find(x => String(x.a.id) === String(id));
    if (!entry) return;
    ui.pace[id] = v;
    const out = $('paceout-' + id);
    if (out) out.innerHTML = paceOutHTML(entry.res, v / 100);
    const lbl = document.querySelector(`[data-pace-lbl="${CSS.escape(String(id))}"]`);
    if (lbl) lbl.textContent = '×' + fmt(v / 100, 2);
    const input = document.querySelector(`[data-pace="${CSS.escape(String(id))}"]`);
    if (input) input.style.setProperty('--p', ((v - 25) / 375) * 100 + '%');
  }
  function selectTab(tab, scrollTo) {
    if (!ui.order) return;
    ui.tab[ui.order] = tab; saveUi();
    render({ tabEnter: true });
    if (scrollTo) {
      if (scrollTo === 'sim') { const box = document.querySelector(`[data-simbox="${CSS.escape(String(ui.order))}"]`); if (box) box.open = true; }
      const target = scrollTo === 'sim' ? ($('sim-' + ui.order) || $('pace-' + ui.order) || $('tabs-' + ui.order)) : $('tabs-' + ui.order);
      if (target) target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    }
    const btn = document.querySelector(`.tab[data-tab="${tab}"]`);
    if (btn && !scrollTo) btn.focus({ preventScroll: true });
  }

  function cycleTab(step) {
    if (!ui.order) return;
    const cur = TABS.indexOf(ui.tab[ui.order] || 'objectives');
    selectTab(TABS[(cur + step + TABS.length) % TABS.length]);
  }

  /* share the order of the day as plain text (Discord, Reddit, chat) */
  const plain = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.replace(/\s+/g, ' ').trim(); };
  function shareText(entry) {
    const { a, res } = entry;
    const p = directiveParts(res);
    const left = Date.parse(a.expiration) - Date.now();
    const lines = [
      `MINISTRY OF VICTORY · ${plain(clean(txt(a.title) || 'Major Order')).toUpperCase()}`,
      `${t('dirLabel')}: ${(['steady', 'lost'].includes(p.d.kind) ? p.target : `${p.kicker} ${p.target}`).toUpperCase()}`,
      plain(p.why),
      p.cap ? plain(p.cap) : '',
      `${t('forecast')}: ${t('v.' + res.verdict)} · ${t('timeLeft')}: ${isFinite(left) ? durDown(left / 3.6e6) : '—'}`,
    ];
    return lines.filter(Boolean).join('\n');
  }
