  /* ---------- animations ---------- */
  function afterRender(entry, firstTime) {
    const view = $('view');
    layoutCharts();
    if (ui.pcPinned) openCard(true);
    const motion = !reduced();
    // the page renders two or three times in its first second (saved snapshot, fresh data, names): a
    // motion started by the first render carries on through the next ones instead of being cut off
    const ord = view.querySelector('.order'), oid = entry ? String(entry.a.id) : '';
    if (motion && ord) {
      if (firstTime) animT0[oid] = performance.now();
      const el = performance.now() - (animT0[oid] ?? -1e9);
      if (el < 700) { ord.classList.add('anim'); ord.style.setProperty('--skip', (-el).toFixed(0) + 'ms'); }
    }
    // bars: from previous width to new width
    const bars = [...view.querySelectorAll('[data-w]')].map(el => ({ el, g: motion ? glide(el.dataset.key, Number(el.dataset.w), 700) : { from: Number(el.dataset.w) } }));
    bars.forEach(({ el, g }) => { el.style.transition = 'none'; el.style.width = g.from + '%'; });
    // orbit rings: same idea, on stroke-dashoffset (pathLength = 100)
    const rings = [...view.querySelectorAll('[data-ring]')].map(el => ({ el, g: motion ? glide(el.dataset.ring, Number(el.dataset.frac), 1200) : { from: Number(el.dataset.frac) } }));
    rings.forEach(({ el, g }) => { el.style.transition = 'none'; el.style.strokeDashoffset = String(100 - g.from); });
    void view.offsetWidth;
    requestAnimationFrame(() => {
      bars.forEach(({ el, g }) => {
        el.style.transition = '';
        if (g.cont) { el.style.transitionDuration = g.dur.toFixed(0) + 'ms'; el.style.transitionDelay = '0s'; }
        el.style.width = el.dataset.w + '%';
        prev.bars[el.dataset.key] = Number(el.dataset.w);
      });
      rings.forEach(({ el, g }) => {
        el.style.transition = '';
        if (g.cont) el.style.transitionDuration = g.dur.toFixed(0) + 'ms';
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
        if (settings.notify === 'on' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification(t('notifyOn'), { body: text, tag: 'mov-call' }); } catch { /* not allowed here */ }
        }
      }
      if (!reduced() && prev.dir[id] !== text) { const c = head.closest('.call'); if (c) { c.classList.add('scan'); setTimeout(() => c.classList.remove('scan'), 1300); } }
      prev.dir[id] = text;
    }
    fxAfterRender(view, entry);
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

  // numbers: the first time one shows it counts up beside its bar or ring; when a refresh changes it, it
  // rolls to the new value and flashes once, so a change is seen without hunting for it. Text is final
  // for screen readers from the start (aria-label), and nothing counts with animations off.
  const animT0 = {}, runs = {}, countRuns = {};
  // where a bar or ring starts: its last value, or the point it had reached if a re-render caught it moving
  function glide(key, to, D) {
    const now = performance.now(), r = runs[key];
    if (r && r.to === to && now - r.t0 < r.D) {
      const k = (now - r.t0) / r.D, e = 1 - Math.pow(1 - k, 3);
      return { from: r.from + (to - r.from) * e, dur: r.D - (now - r.t0), cont: true };
    }
    const from = prev.bars[key] ?? 0;
    if (from !== to) runs[key] = { from, to, t0: now, D };
    return { from, dur: D };
  }
  function countUp(el) {
    const key = el.dataset.count, to = Number(el.dataset.to);
    const show = el.dataset.pct ? (v) => pct(v) : (v) => fmt(v);
    const from = prev.count[key], first = from == null, now = performance.now();
    prev.count[key] = to;
    let r = countRuns[key];
    if (!(r && r.to === to && now - r.t0 < r.D)) {
      // a count (Helldivers online) is never shown passing through numbers it never had: it is set, and
      // flashes when a refresh changed it; only a percentage beside its bar or ring counts up
      if (!el.dataset.pct && !reduced() && !first && from !== to) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      if (reduced() || !isFinite(to) || from === to || !el.dataset.pct) { el.textContent = show(to); return; }
      r = countRuns[key] = { a: first ? 0 : from, to, t0: now, D: first ? 1000 : 650 };
      if (!first) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    }
    el.setAttribute('aria-label', show(to));
    const step = (t) => {
      const k = Math.min(1, (t - r.t0) / r.D), e = 1 - Math.pow(1 - k, 3);
      el.textContent = show(r.a + (to - r.a) * e);
      if (k < 1 && el.isConnected) requestAnimationFrame(step); else el.removeAttribute('aria-label');
    };
    step(now);
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
  // the countdown as the game's split-flap board: digits that change roll in (once a minute at most)
  function rollDigits(el, html) {
    const digits = html.replace(/<span>[^<]*<\/span>/g, '|').replace(/[^0-9|]/g, '');
    const was = el.dataset.dg || '';
    if (was === digits && el.firstChild) return;
    el.dataset.dg = digits;
    let k = 0;
    el.innerHTML = html.replace(/<span>[^<]*<\/span>|\d/g, (m) => {
      if (m.length > 1) { k++; return m; }
      const roll = !reduced() && was.length === digits.length && was[k] !== m;
      k++;
      return `<i class="dg${roll ? ' roll' : ''}">${m}</i>`;
    });
  }
  // live counters: between refreshes, objectives count up at the pace just measured
  function tickCounters() {
    const now = Date.now();
    const still = reduced();
    document.querySelectorAll('.tick[data-tick]').forEach(el => {
      // an estimate between refreshes: shown to the precision it has (critique 8: single kills ticking
      // four times a second claimed more than the data knows), and still with animations off
      const v = Math.min(Number(el.dataset.goal), Number(el.dataset.tick) + (still ? 0 : Number(el.dataset.rate) * (now - Number(el.dataset.t0)) / 1000));
      const s = v >= 1e6 ? (v / 1e6).toFixed(v >= 1e8 ? 1 : 2) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(1) + 'k' : fmt(Math.floor(v));
      if (el.textContent !== s) el.textContent = s;
    });
  }
  setInterval(tickCounters, 250);
  function tick() {
    ageForecastEvidence();
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
