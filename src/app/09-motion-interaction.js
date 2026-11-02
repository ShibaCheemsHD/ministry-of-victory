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
    // numbers
    document.querySelectorAll('[data-count]').forEach(el => countUp(el));
    // the call changed since the last refresh: said once, in a toast
    const head = view.querySelector('.call-head');
    if (head) {
      const id = String(entry.a.id), text = head.textContent.replace(/\s+/g, ' ').trim();
      if (prev.dir[id] != null && prev.dir[id] !== text) {
        toast(fill(t('dirChanged'), { x: text }));
        // the change stays said on the call until the player dismisses it (a toast is gone in seconds)
        ui.callChange = { id, was: prev.dir[id], at: Date.now() };
        if (settings.notify === 'on' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification(t('notifyOn'), { body: text, tag: 'mov-call' }); } catch { /* not allowed here */ }
        }
      }
      const cc = ui.callChange, bar = head.closest('.call')?.querySelector('.call-bar');
      if (cc && cc.id === id && bar && !bar.querySelector('.call-new')) {
        bar.insertAdjacentHTML('beforeend', `<span class="call-new">${ICON.flag}<b>${esc(fill(t('callNew'), { t: new Date(cc.at).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' }) }))}</b><span class="was">${esc(fill(t('callWas'), { x: cc.was }))}</span><button type="button" class="cn-x" data-callnew-x aria-label="${esc(t('callNewX'))}">${ICON.cross}</button></span>`);
      }
      if (!reduced() && prev.dir[id] !== text) { const c = head.closest('.call'); if (c) { c.classList.add('scan'); setTimeout(() => c.classList.remove('scan'), 1300); } }
      prev.dir[id] = text;
    }
  }

  // shrink the headline until no single word overflows its column (names vary a lot in length)
  function fitTarget() {
    const el = $('view').querySelector('.call-head');
    if (!el) return;
    el.style.fontSize = ''; el.style.overflowWrap = '';
    let size = parseFloat(getComputedStyle(el).fontSize) || 60, guard = 0;
    while (el.scrollWidth > el.clientWidth + 1 && size > 22 && guard++ < 60) { size -= 2; el.style.fontSize = size + 'px'; }
    if (el.scrollWidth > el.clientWidth + 1) el.style.overflowWrap = 'anywhere';
  }
  let fitRaf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitTarget); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitTarget()).catch(() => {});

  // numbers are set, not counted up: on a screen read in a glance, a rolling number is noise
  function countUp(el) {
    const to = Number(el.dataset.to);
    el.textContent = el.dataset.pct ? pct(to) : fmt(to);
    prev.count[el.dataset.count] = to;
  }

  /* ---------- live updates (every second) ---------- */
  function fmtCountdown(ms) {
    if (!isFinite(ms)) return '—';
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    const u = t('dhms'), p2 = (n) => String(n).padStart(2, '0');
    // days, hours and minutes: on a second screen a ticking seconds field only pulls the eye
    return `${d ? d + `<span>${u[0]}</span>` : ''}${p2(h)}<span>${u[1]}</span>${p2(m)}<span>${u[2]}</span>`;
  }
  function rollDigits(el, html) { if (el.innerHTML !== html) el.innerHTML = html; }
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
      rollDigits(el, fmtCountdown(ms));
      const card = el.closest('.timer');
      if (card) { card.classList.toggle('soon', ms < 24 * 3600e3 && ms >= 6 * 3600e3); card.classList.toggle('urgent', ms < 6 * 3600e3); }
    });
    // the live dot turns amber when the data is getting old (failed refreshes, or the API is down and the
    // page shows the recorder's copy): the call says it is not live (critique 1 Nov 2026)
    const stale = !lastOk || Date.now() - lastOk > 3 * REFRESH_MS || !!(last && last.stale);
    document.querySelectorAll('.mast .live, .call .live').forEach(el => el.classList.toggle('off', stale));
    document.querySelectorAll('.call').forEach(el => el.classList.toggle('is-stale', stale));
    if (!lastRun) return;
    const left = Math.max(0, REFRESH_MS - (Date.now() - lastRun));
    const btn = $('refresh');
    btn.style.setProperty('--left', String(left / REFRESH_MS));
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

  function cycleTab(step, show = false) {
    if (!ui.order) return;
    const cur = TABS.indexOf(curTab(ui.order));
    selectTab(TABS[((cur < 0 ? 0 : cur) + step + TABS.length) % TABS.length], show ? 'tabs' : undefined);
  }

  /* share the order of the day as plain text (Discord, Reddit, chat) */
  // HTML -> its text. Parsed in an inert document: a div made with createElement would load images and run
  // their onerror even off-page, and these strings can come from outside (war log, helldiversstats, the API)
  const plainDoc = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
  const plain = (html) => (plainDoc ? plainDoc.parseFromString(String(html ?? ''), 'text/html').body.textContent || ''
    : String(html ?? '').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
  // the desk's pick across several orders, in one line, for the share image and the copied text
  // (critique 1 Nov 2026: a shared call could send people to the worse order)
  function pickLine(entry) {
    const cx = crossNow();
    if (!cx || cx.verdict !== 'pick') return '';
    const pick = cx.orders.find(o => o.id === String(cx.pick));
    if (!pick) return '';
    return String(cx.pick) === String(entry.a.id) ? fill(t('sh.pickThis'), { n: cx.orders.length }) : fill(t('sh.pickOther'), { title: pick.title, n: cx.orders.length });
  }
  function shareText(entry) {
    const { a, res } = entry;
    // times in UTC, as on the share image: the text is read all over the world
    clockUTC = true;
    let p, m; try { p = directiveParts(res); m = callMove(res, p); } finally { clockUTC = false; }
    const left = Date.parse(a.expiration) - Date.now();
    const lines = [
      `MINISTRY OF VICTORY · ${plain(clean(txt(a.title) || 'Major Order')).toUpperCase()}`,
      pickLine(entry),
      `**${m.tag}: ${(m.verb ? `${m.verb} ${m.target}` : m.target).toUpperCase()}**`,
      plain(m.why),
      p.cap && !m.moveOn ? plain(p.cap) : '',
      `${t('forecast')}: ${t('v.' + res.verdict)} · ${t('timeLeft')}: ${isFinite(left) ? durDown(left / 3.6e6) : '—'}`,
      customModel() ? t('modelNote') + '.' : '',
      `https://shibacheemshd.github.io/ministry-of-victory/#order=${encodeURIComponent(String(a.id))}`,
    ];
    return lines.filter(Boolean).join('\n');
  }
