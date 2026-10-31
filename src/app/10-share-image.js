  /* ---------- share image: the order of the day as one picture (Reddit, Discord) ----------
     Everything that matters in one PNG, so people get the call without opening the site.
     Drawn on a canvas from the same parts the page shows; times are in UTC (readers are everywhere). */
  const SH_VC = { done: '#5fd38d', ontrack: '#5fd38d', effort: '#6bb7ea', focus: '#6bb7ea', hard: '#ffbb25', record: '#ffbb25', nearly_impossible: '#ff5148', impossible: '#ff5148', failed: '#ff5148', unknown: '#a8aebd' };
  const SH_FAC = { Terminids: '#ffae3a', Automaton: '#ff6767', Illuminate: '#ab8dff', Humans: '#6bb7ea' };
  async function shareImage(entry) {
    const { a, res } = entry;
    try { await Promise.all(['900 40px Archivo', '700 20px "Chakra Petch"', '500 20px "Chakra Petch"', '400 20px "Share Tech Mono"'].map(f => document.fonts.load(f))); } catch {}
    // the page's own words, with times in UTC
    clockUTC = true;
    let p, objs, joel;
    try {
      p = directiveParts(res);
      const box = document.createElement('div'); box.innerHTML = objectivesHTML(res);
      objs = [...box.querySelectorAll('.objective')].map(el => {
        const h = el.querySelector('h4'); const opt = h.querySelector('.opt'); if (opt) opt.remove();
        const fillEl = el.querySelector('.bar .fill'), projEl = el.querySelector('.bar .proj');
        const pillEl = el.querySelector('.pill');
        const v = [...(pillEl?.classList || [])].find(c => c.startsWith('v-'))?.slice(2) || null;
        el.querySelectorAll('.intel, .chipline, .early').forEach(n => n.remove());
        return { title: noItem(plain(h.innerHTML)), v, pill: pillEl ? plain(pillEl.innerHTML) : '', frac: fillEl ? Number(fillEl.dataset.w) / 100 : null,
          proj: projEl ? (parseFloat(projEl.style.left) + parseFloat(projEl.style.width)) / 100 : null, line: noItem(plain(el.querySelector('.line')?.innerHTML || '')),
          fac: [...el.classList].find(c => c.startsWith('fac-'))?.slice(4) || null };
      });
      const it = intelFor(entry), tasks = res.tasks.map(r => r.task);
      joel = [...it.items].sort((x, y) => prioOf(x) - prioOf(y) || y.t - x.t).map(x => joelItem(x, tasks, it.rel, { start: entry.start, end: Date.parse(a.expiration) })).filter(r => !r.earned).slice(0, 2)
        .map(r => ({ title: noItem(plain(r.title)), detail: plain(r.detail || ''), when: r.when || ago(r.t) }));
    } finally { clockUTC = false; }
    const W = 1080, PAD = 64, IN = W - PAD * 2, S = 2;
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    const font = (px, w = 600, fam = 'Chakra Petch', stretch = 'normal') => { ctx.font = `${w} ${px}px "${fam}", sans-serif`; try { ctx.fontStretch = stretch; } catch {} };
    const wrap = (text, maxW, max = 9) => {
      const words = String(text || '').split(/\s+/).filter(Boolean), lines = []; let cur = '';
      for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width <= maxW || !cur) cur = t2; else { lines.push(cur); cur = w; } }
      if (cur) lines.push(cur);
      if (lines.length > max) { lines.length = max; let l = lines[max - 1]; while (l && ctx.measureText(l + '…').width > maxW) l = l.replace(/\s*\S+$/, ''); lines[max - 1] = l + '…'; }
      return lines;
    };
    const vc = SH_VC[res.verdict] || '#a8aebd';
    const left = Date.parse(a.expiration) - (last ? last.now : Date.now());
    // a bare "MAJOR ORDER" title says nothing: name it after what it asks, as the archive does
    const title = orderName({ name: plain(clean(txt(a.title) || '')), tasks: a.tasks, brief: txt(a.briefing) }, true).toUpperCase();
    const n = last.results.length, k = last.results.indexOf(entry) + 1;
    const stamp = new Date(last.now).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
    // two passes: measure the height, then draw
    function draw(on) {
      let y = 0;
      const R = (x, yy, w, h, c) => { if (on) { ctx.fillStyle = c; ctx.fillRect(x, yy, w, h); } };
      const T = (s, x, yy, c, align = 'left') => { if (on) { ctx.fillStyle = c; ctx.textAlign = align; ctx.fillText(s, x, yy); } };
      // header
      y = 56;
      if (on) {
        ctx.save(); ctx.translate(PAD + 22, y + 22); ctx.strokeStyle = '#ffe900'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, -21); ctx.lineTo(21, 0); ctx.lineTo(0, 21); ctx.lineTo(-21, 0); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = '#ffe900'; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(8, -4); ctx.lineTo(5.3, 1); ctx.lineTo(2.2, 1); ctx.lineTo(2.2, 9); ctx.lineTo(-2.2, 9); ctx.lineTo(-2.2, 1); ctx.lineTo(-5.3, 1); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      font(13, 600); if (on) ctx.letterSpacing = '4px'; T('MINISTRY OF', PAD + 60, y + 14, '#cfd2da'); if (on) ctx.letterSpacing = '0px';
      font(30, 900, 'Archivo', 'expanded'); T('VICTORY', PAD + 58, y + 44, '#ffe900');
      font(15, 700); if (on) ctx.letterSpacing = '3px'; T(t('sh.head').toUpperCase(), W - PAD, y + 16, '#ffe900', 'right'); if (on) ctx.letterSpacing = '0px';
      font(17, 500, 'Share Tech Mono'); T(stamp, W - PAD, y + 42, '#a8aebd', 'right');
      y += 74; R(PAD, y, IN, 1, '#2a2f3d'); y += 46;
      // order
      font(16, 700); if (on) ctx.letterSpacing = '3px';
      const meta = [n > 1 ? fill(t('sh.order'), { n: k, m: n }) : null, isFinite(left) && left > 0 ? fill(t('sh.left'), { d: durDown(left / 3.6e6) }) : null, medalsOf(a) ? fill(t('sh.medals'), { n: medalsOf(a) }) : null].filter(Boolean).join('  ·  ').toUpperCase();
      T(meta, PAD, y, '#a8aebd'); if (on) ctx.letterSpacing = '0px'; y += 16;
      const tpx = title.length > 30 ? 42 : 54; font(tpx, 900, 'Archivo', 'expanded');
      for (const l of wrap(title, IN, 3)) { y += tpx + 4; T(l, PAD, y, '#f1f2f4'); }
      y += 34;
      // forecast
      const fy = y; font(40, 900, 'Archivo', 'expanded'); const vLines = wrap(t('v.' + res.verdict).toUpperCase(), IN - 60, 2);
      font(22, 500); const mLines = wrap(t('m')[res.verdict] || '', IN - 60, 2);
      const fh = 34 + 16 + vLines.length * 44 + 10 + mLines.length * 30 + 26;
      if (on) { ctx.fillStyle = vc + '14'; ctx.fillRect(PAD, fy, IN, fh); ctx.strokeStyle = vc; ctx.lineWidth = 3; ctx.strokeRect(PAD + 1.5, fy + 1.5, IN - 3, fh - 3); }
      y = fy + 40; font(15, 700); if (on) ctx.letterSpacing = '3px'; T(t('forecast').toUpperCase(), PAD + 30, y, '#cfd2da'); if (on) ctx.letterSpacing = '0px';
      font(40, 900, 'Archivo', 'expanded'); for (const l of vLines) { y += 46; T(l, PAD + 30, y, vc); }
      y += 6; font(22, 500); for (const l of mLines) { y += 30; T(l, PAD + 30, y, '#e6e8ee'); }
      y = fy + fh + 84;
      // what to do now
      R(PAD, y - 28, 6, 6, '#5fd38d'); font(16, 700); if (on) ctx.letterSpacing = '3px'; T(t('dirLabel').toUpperCase(), PAD + 16, y - 20, '#ffe900'); if (on) ctx.letterSpacing = '0px';
      const big1 = ['steady', 'lost'].includes(p.d.kind) ? '' : p.kicker.toUpperCase();
      if (big1) { font(26, 800, 'Archivo', 'expanded'); y += 22; T(big1, PAD, y, '#ffe900'); }
      font(p.target.length > 14 ? 64 : 92, 900, 'Archivo', 'expanded');
      for (const l of wrap(p.target.toUpperCase(), IN, 2)) { y += p.target.length > 14 ? 66 : 92; T(l, PAD, y, '#f1f2f4'); }
      y += 18;
      const why = [p.lead, plain(p.why)].filter(Boolean).join(' ');
      font(25, 500); for (const [i, l] of wrap(why, IN, 5).entries()) { y += 35; T(l, PAD, y, i === 0 && p.lead ? vc : '#e6e8ee'); }
      if (p.cap) { y += 22; R(PAD, y, IN, 1, '#2a2f3d'); y += 8; font(22, 700); for (const l of wrap(plain(p.cap), IN, 3)) { y += 32; T(l, PAD, y, '#f1f2f4'); } }
      y += 52;
      // objectives
      font(16, 700); if (on) ctx.letterSpacing = '3px'; T(t('sh.obj').toUpperCase(), PAD, y, '#a8aebd'); if (on) ctx.letterSpacing = '0px'; y += 18;
      for (const o of objs.slice(0, 6)) {
        y += 14; R(PAD, y, IN, 1, '#22262f'); y += 36;
        font(17, 700); ctx.letterSpacing = '1.5px'; const pw = o.pill ? ctx.measureText(o.pill.toUpperCase()).width + 26 : 0; ctx.letterSpacing = '0px';
        if (o.pill && on) { const c = SH_VC[o.v] || '#a8aebd'; ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.strokeRect(W - PAD - pw, y - 24, pw, 32); ctx.letterSpacing = '1.5px'; T(o.pill.toUpperCase(), W - PAD - pw / 2 + 0.75, y - 2, c, 'center'); ctx.letterSpacing = '0px'; }
        font(24, 700); const tl = wrap(o.title, IN - pw - 24, 2); for (const [i, l] of tl.entries()) { if (i) y += 30; T(l, PAD, y, '#f1f2f4'); }
        if (o.frac != null) {
          y += 18; const fc = SH_FAC[o.fac] || '#ffe900';
          R(PAD, y, IN, 12, '#1f232c');
          if (o.proj != null && o.proj > o.frac && on) { ctx.fillStyle = fc + '40'; ctx.fillRect(PAD + IN * o.frac, y, IN * (Math.min(1, o.proj) - o.frac), 12); }
          R(PAD, y, Math.max(3, IN * Math.min(1, o.frac)), 12, fc); y += 12;
        }
        font(20, 500); for (const l of wrap(o.line, IN, 2)) { y += 30; T(l, PAD, y, '#b8bdc9'); }
      }
      if (objs.length > 6) { y += 34; font(19, 500); T(fill(t('sh.more'), { n: objs.length - 6 }), PAD, y, '#a8aebd'); }
      // Joel
      if (joel.length) {
        y += 56; font(16, 700); if (on) ctx.letterSpacing = '3px'; T(t('jo.title').toUpperCase(), PAD, y, '#ffbb25'); if (on) ctx.letterSpacing = '0px'; y += 6;
        for (const j of joel) { y += 34; font(22, 700); T(j.title, PAD, y, '#f1f2f4'); font(19, 500); T(j.when, W - PAD, y, '#a8aebd', 'right'); if (j.detail) { font(19, 500); for (const l of wrap(j.detail, IN, 1)) { y += 28; T(l, PAD, y, '#b8bdc9'); } } }
      }
      // footer
      y += 70; R(PAD, y, IN, 1, '#2a2f3d'); y += 46;
      font(23, 400, 'Share Tech Mono'); T('shibacheemshd.github.io/ministry-of-victory', PAD, y, '#f1f2f4');
      font(17, 500); T(t('sh.foot'), W - PAD, y, '#a8aebd', 'right');
      y += 40;
      if (on) { const hy = y; for (let x = -40; x < W + 40; x += 36) { ctx.fillStyle = '#ffe900'; ctx.beginPath(); ctx.moveTo(x, hy + 16); ctx.lineTo(x + 16, hy); ctx.lineTo(x + 34, hy); ctx.lineTo(x + 18, hy + 16); ctx.closePath(); ctx.fill(); } }
      return y + 16;
    }
    cv.width = W; cv.height = 10; const H = Math.max(1350, Math.ceil(draw(false)));
    cv.width = W * S; cv.height = H * S; ctx.scale(S, S);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d0e12'); bg.addColorStop(1, '#08090b'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const gl = ctx.createRadialGradient(140, 0, 0, 140, 0, 700); gl.addColorStop(0, 'rgba(255,233,0,.10)'); gl.addColorStop(1, 'rgba(255,233,0,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, 700);
    ctx.strokeStyle = 'rgba(255,255,255,.03)'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); } for (let yy = 0; yy < H; yy += 40) { ctx.beginPath(); ctx.moveTo(0, yy + .5); ctx.lineTo(W, yy + .5); ctx.stroke(); }
    ctx.textBaseline = 'alphabetic';
    if (H > 1350) { /* taller than 4:5 for long orders: fine for Reddit */ }
    draw(true);
    return cv;
  }
  async function openShareImage(entry) {
    const dlg = $('dlg-share'), body = $('share-body');
    body.innerHTML = `<p class="arch-load">${ICON.dots}<span>${esc(t('sh.making'))}</span></p>`;
    if (!dlg.open) dlg.showModal();
    let cv;
    try { cv = await shareImage(entry); } catch (e) { body.innerHTML = `<p>${esc(t('sh.fail'))}</p>`; return; }
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const url = URL.createObjectURL(blob);
    const name = `ministry-of-victory-${String(txt(entry.a.title) || 'major-order').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${new Date(last.now).toISOString().slice(0, 10)}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const canCopy = !!(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write);
    body.innerHTML = `<div class="sh-prev" tabindex="0" role="region" aria-label="${esc(t('sh.alt'))}"><img src="${url}" alt="${esc(t('sh.alt'))}"></div>
      <p class="sh-note">${esc(t('sh.note'))}</p>
      <div class="sh-actions">
        <a class="btn primary" href="${url}" download="${esc(name)}">${esc(t('sh.dl'))}</a>
        ${canCopy ? `<button type="button" class="btn ghostly" data-shcopy>${ICON.copy}<span>${esc(t('sh.copy'))}</span></button>` : ''}
        ${canShare ? `<button type="button" class="btn ghostly" data-shshare>${esc(t('sh.share'))}</button>` : ''}
      </div>`;
    const cp = body.querySelector('[data-shcopy]');
    if (cp) cp.addEventListener('click', async () => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast(t('sh.copied')); } catch { toast(t('copyFail')); } });
    const sh = body.querySelector('[data-shshare]');
    if (sh) sh.addEventListener('click', async () => { try { await navigator.share({ files: [file], title: plain(clean(txt(entry.a.title) || 'Major Order')), text: 'https://shibacheemshd.github.io/ministry-of-victory/' }); } catch {} });
    dlg.addEventListener('close', () => setTimeout(() => URL.revokeObjectURL(url), 1000), { once: true });
  }
  async function copyText(s) {
    try { if (navigator.clipboard && window.isSecureContext !== false) { await navigator.clipboard.writeText(s); return true; } } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = s; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
  let toastTimer = 0;
  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-otab],[data-tab],[data-goto],[data-toggle-nums],[data-brief],[data-preset],[data-close],[data-copy],[data-shareimg],[data-cycle],[data-hint-close],[data-legend],[data-hmode],[data-ifocus]');
    if (!el) return;
    if (el.dataset.legend) {   // show / hide one line of a chart
      const id = el.dataset.legend, k = el.dataset.s, off = (ui.chartOff[id] ||= {});
      off[k] = !off[k];
      el.setAttribute('aria-pressed', String(!off[k]));
      document.querySelectorAll(`[data-chart="${CSS.escape(id)}"] [data-s="${CSS.escape(k)}"]`).forEach(n => n.classList.toggle('off', off[k]));
      return;
    }
    if (el.dataset.hmode) { ui.histMode[el.dataset.hmode] = el.dataset.v; render(); return; }
    if (el.dataset.ifocus) { const c = $(el.dataset.ifocus); if (c) { c.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); } return; }
    if (el.dataset.otab) { ui.order = el.dataset.otab; saveUi(); render(); return; }
    if (el.dataset.tab) { selectTab(el.dataset.tab); return; }
    if (el.dataset.cycle) { cycleTab(Number(el.dataset.cycle)); return; }
    if (el.dataset.shareimg) {
      const entry = last && last.results.find(x => String(x.a.id) === String(el.dataset.shareimg));
      if (entry) openShareImage(entry);
      return;
    }
    if (el.dataset.copy) {
      const entry = last && last.results.find(x => String(x.a.id) === String(el.dataset.copy));
      if (!entry) return;
      const text = shareText(entry);
      copyText(text).then(ok => {
        toast(ok ? t('copied') : t('copyFail'));
        if (ok) { el.classList.add('done'); setTimeout(() => el.classList.remove('done'), 1600); }
      });
      return;
    }
    if (el.dataset.goto) { selectTab(el.dataset.goto, el.dataset.scroll || 'tabs'); return; }
    if (el.hasAttribute('data-toggle-nums')) {
      ui.showNums = !ui.showNums; saveUi();
      const sec = $('steps-' + ui.order);
      if (sec) sec.classList.toggle('show-nums', ui.showNums);
      el.setAttribute('aria-pressed', String(ui.showNums));
      el.textContent = ui.showNums ? t('hideNums') : t('showNums');
      return;
    }
    if (el.dataset.brief) {
      const id = el.dataset.brief; ui.briefOpen[id] = !ui.briefOpen[id];
      const box = $('brief-' + id); if (box) box.classList.toggle('open', ui.briefOpen[id]);
      el.textContent = ui.briefOpen[id] ? t('less') : t('more');
      el.setAttribute('aria-expanded', String(ui.briefOpen[id]));
      return;
    }
    if (el.dataset.preset) { updateSim(el.dataset.preset, Number(el.dataset.v)); return; }
    if (el.hasAttribute('data-hint-close')) { store.set('hintSeen', true); el.closest('.order')?.classList.remove('has-hint'); el.closest('.hint')?.remove(); return; }
    if (el.hasAttribute('data-close')) { el.closest('dialog')?.close(); }
  });
  let simRaf = 0;
  // a refresh never rebuilds the page under a slider that is being dragged; it waits for the release
  document.addEventListener('pointerdown', (e) => { if (e.target && e.target.type === 'range') dragging = true; });
  const endDrag = () => { if (!dragging) return; dragging = false; if (pendingRender) { pendingRender = false; render(); } };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  // back on the tab after a while: refresh straight away instead of waiting for the next tick
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastRun > REFRESH_MS) refresh(); });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.sim) { const v = Number(el.value), id = el.dataset.sim; el.style.setProperty('--p', ((v - 5) / 95) * 100 + '%'); cancelAnimationFrame(simRaf); simRaf = requestAnimationFrame(() => updateSim(id, v)); }
    if (el.dataset && el.dataset.pace) { const v = Number(el.value), id = el.dataset.pace; cancelAnimationFrame(simRaf); simRaf = requestAnimationFrame(() => updatePace(id, v)); }
  });
  // remember which objective details are open across the 60 s re-renders ('toggle' doesn't bubble)
  document.addEventListener('toggle', (e) => {
    const el = e.target;
    if (el && el.dataset && el.dataset.intel) ui.intelOpen[el.dataset.intel] = el.open;
    if (el && el.dataset && el.dataset.simbox) ui.simOpen[el.dataset.simbox] = el.open;
    if (el && el.dataset && 'cross' in el.dataset) ui.crossOpen = el.open;
    if (el && el.dataset && 'intelstrip' in el.dataset) ui.intelStripOpen = el.open;
  }, true);
  // game-style shortcuts: Q / E switch tab, 1-3 jump to a tab, R refreshes, ? opens the guide
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag) || (e.target && e.target.isContentEditable)) return;
    if (document.querySelector('dialog[open]') || !last) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'q' || k === 'e') { e.preventDefault(); cycleTab(k === 'q' ? -1 : 1); }
    else if (k === '1' || k === '2' || k === '3' || k === '4') { e.preventDefault(); selectTab(TABS[Number(k) - 1]); }
    else if (k === 'r') { e.preventDefault(); refresh(); }
    else if (k === '?') { e.preventDefault(); $('dlg-info').showModal(); }
  });
  // arrow keys inside tab lists
  document.addEventListener('keydown', (e) => {
    const tabEl = e.target.closest && e.target.closest('[role="tab"]');
    if (!tabEl || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const list = [...tabEl.parentElement.querySelectorAll('[role="tab"]')];
    let i = list.indexOf(tabEl);
    i = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
    e.preventDefault();
    list[i].click();
    setTimeout(() => {
      const again = document.getElementById(list[i].id);
      if (again) again.focus();
    }, 0);
  });
  // planet card: opens on hover (mouse) or tap, stays while the pointer is over it, pinned by a click
  let pcTimer = 0;
  function openCard(pin) {
    if (!last) return;
    const forced = ui.pcForce != null && last.planets[ui.pcForce];
    let wrap = document.querySelector('.directive .pc-wrap');
    let entry = last.results.find(x => String(x.a.id) === String(ui.order));
    if ((!wrap || !entry) && forced) {   // no order on screen: the war map still opens planet cards
      wrap = document.querySelector('.pc-wrap.free') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'pc-wrap free', hidden: true }));
      entry = entry || { res: { tasks: [], id: 'none' }, a: {} };
    }
    if (!wrap || !entry) return;
    const cp = forced ? { planet: forced, list: null } : cardPlanets(entry); if (!cp) return;
    wrap.innerHTML = planetCardHTML(cp.planet, entry, cp.list);
    wrap.hidden = false; wrap.classList.add('open');
    if (!store.get('pcSeen', false)) { store.set('pcSeen', true); document.querySelector('[data-globe]')?.classList.remove('g-new'); }
    placeCard();
    if (pin) ui.pcPinned = true;
    wrap.classList.toggle('pinned', !!ui.pcPinned);
    const g = document.querySelector('[data-globe]'); if (g) g.setAttribute('aria-expanded', 'true');
  }
  // desktop: beside the globe, over the side column when it fits there, never over the headline;
  // phones get a bottom sheet from the stylesheet
  function placeCard() {
    const wrap = document.querySelector('.pc-wrap.open'), g = ui.pcAnchor === 'map' ? (document.querySelector(`.mp[data-mp="${ui.pcForce}"]`) || document.querySelector('.war-map')) : document.querySelector('[data-globe]');
    if (!wrap || !g) return;
    if (window.innerWidth <= 760) { wrap.style.left = wrap.style.top = ''; wrap.removeAttribute('data-side'); return; }
    const r = g.getBoundingClientRect(), gap = 14, vw = window.innerWidth, vh = window.innerHeight;
    const roomR = vw - r.right - gap - 16;
    let W = Math.min(400, vw - 32), left, side;
    if (roomR >= 320) { W = Math.min(400, roomR); left = r.right + gap; side = 'right'; }
    else if (r.left - gap - 16 >= W) { left = r.left - gap - W; side = 'left'; }
    else { left = Math.max(16, Math.min(vw - W - 16, r.left + r.width / 2 - W / 2)); side = 'below'; }
    const h = wrap.offsetHeight || 420;
    let top = side === 'below' ? r.bottom + gap : r.top - 10;
    top = Math.max(76, Math.min(vh - h - 12, top));
    wrap.style.width = W + 'px'; wrap.style.left = Math.round(left) + 'px'; wrap.style.top = Math.round(top) + 'px'; wrap.dataset.side = side;
  }
  let placeRaf = 0;
  const placeSoon = () => { if (placeRaf) return; placeRaf = requestAnimationFrame(() => { placeRaf = 0; placeCard(); }); };
  window.addEventListener('scroll', placeSoon, { passive: true });
  window.addEventListener('resize', placeSoon);
  function closeCard(force) {
    if (ui.pcPinned && !force) return;
    ui.pcPinned = false; ui.pcForce = null; ui.pcAnchor = null;
    document.querySelectorAll('.pc-wrap').forEach(wrap => { wrap.hidden = true; wrap.classList.remove('open'); });
    const g = document.querySelector('[data-globe]'); if (g) g.setAttribute('aria-expanded', 'false');
  }
  // war map: tooltip on hover/focus, click opens the planet card for that planet
  function mapTip(g) {
    const wrap = g.closest('.war-map'), tip = wrap && wrap.querySelector('.map-tip'); if (!tip) return;
    const [name, owner, players, kind, lib] = (g.dataset.tip || '').split('|');
    tip.innerHTML = `<b>${esc(name)}</b><span>${esc(owner)}</span><span>${esc(fill(t('map.tipP'), { n: players }))} · ${esc(fill(t(kind === 'def' ? 'map.tipD' : 'map.tipL'), { p: lib }))}</span>`;
    const wr = wrap.getBoundingClientRect(), gr = g.getBoundingClientRect();
    tip.hidden = false;
    const x = gr.left + gr.width / 2 - wr.left, y = gr.top - wr.top;
    tip.style.left = Math.max(4, Math.min(wr.width - tip.offsetWidth - 4, x - tip.offsetWidth / 2)) + 'px';
    tip.style.top = (y - tip.offsetHeight - 8 < 0 ? gr.bottom - wr.top + 8 : y - tip.offsetHeight - 8) + 'px';
    wrap.querySelectorAll('.mp.hot').forEach(x => x.classList.remove('hot')); g.classList.add('hot');
  }
  function mapTipOff(wrap) { const tip = wrap && wrap.querySelector('.map-tip'); if (tip) tip.hidden = true; wrap && wrap.querySelectorAll('.mp.hot').forEach(x => x.classList.remove('hot')); }
  document.addEventListener('pointerover', (e) => { const g = e.target.closest && e.target.closest('.mp'); if (g) mapTip(g); });
  document.addEventListener('pointerout', (e) => { const g = e.target.closest && e.target.closest('.mp'); if (g && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.mp') === g)) mapTipOff(g.closest('.war-map')); });
  document.addEventListener('focusin', (e) => { const g = e.target.closest && e.target.closest('.mp'); if (g) mapTip(g); });
  document.addEventListener('focusout', (e) => { const g = e.target.closest && e.target.closest('.mp'); if (g) mapTipOff(g.closest('.war-map')); });
  document.addEventListener('pointerover', (e) => {
    const inGlobe = e.target.closest && e.target.closest('[data-globe]'), inCard = e.target.closest && e.target.closest('.pc-wrap');
    if ((inGlobe || inCard) && e.pointerType !== 'touch') { clearTimeout(pcTimer); if (inGlobe && !document.querySelector('.pc-wrap.open')) pcTimer = setTimeout(() => openCard(false), 120); }
  });
  document.addEventListener('pointerout', (e) => {
    const from = e.target.closest && (e.target.closest('[data-globe]') || e.target.closest('.pc-wrap'));
    const to = e.relatedTarget && e.relatedTarget.closest && (e.relatedTarget.closest('[data-globe]') || e.relatedTarget.closest('.pc-wrap'));
    if (from && !to && e.pointerType !== 'touch') { clearTimeout(pcTimer); pcTimer = setTimeout(() => closeCard(false), 260); }
  });
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-globe]');
    if (g) { if (ui.pcPinned) closeCard(true); else openCard(true); return; }
    if (e.target.closest('[data-pcclose]')) { closeCard(true); return; }
    const af = e.target.closest('[data-af]');
    if (af) { ui.af = af.dataset.af; render(); return; }
    const vw = e.target.closest('[data-view]');
    if (vw) { setView(vw.dataset.view); return; }
    const nf = e.target.closest('[data-nf]');
    if (nf) { ui.nf = nf.dataset.nf || null; render(); return; }
    const op = e.target.closest('[data-open-planet]');
    if (op) { ui.pcForce = op.dataset.openPlanet; ui.pcAnchor = 'map'; openCard(true); return; }
    const mp = e.target.closest('.mp[data-mp]');
    if (mp) { mapTipOff(mp.closest('.war-map')); ui.pcForce = mp.dataset.mp; ui.pcAnchor = 'map'; openCard(true); return; }
    const tq = e.target.closest('[data-tipq]'); if (tq) { toast(tq.dataset.tipq); return; }
    const tab = e.target.closest('[data-pcplanet]');
    if (tab) { ui.pcPlanet = tab.dataset.pcplanet; openCard(ui.pcPinned); return; }
    if (ui.pcPinned && !e.target.closest('.pc-wrap')) closeCard(true);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.pc-wrap.open')) { closeCard(true); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.mp[data-mp]')) { e.preventDefault(); ui.pcForce = e.target.dataset.mp; ui.pcAnchor = 'map'; openCard(true); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-globe]')) { e.preventDefault(); if (ui.pcPinned) closeCard(true); else openCard(true); }
  });
  // charts: crosshair follows the pointer (mouse, pen or finger)
  document.addEventListener('pointermove', (e) => { const c = e.target.closest && e.target.closest('.chart'); if (c) chartHover(c, e.clientX, e.clientY); });
  document.addEventListener('pointerdown', (e) => { const c = e.target.closest && e.target.closest('.chart'); if (c) chartHover(c, e.clientX, e.clientY); });
  document.addEventListener('pointerout', (e) => { const c = e.target.closest && e.target.closest('.chart'); if (c && !(e.relatedTarget && c.contains(e.relatedTarget))) { c.classList.remove('hover'); c.querySelectorAll('.hl, .dim').forEach(n => n.classList.remove('hl', 'dim')); } });
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  $('open-settings').addEventListener('click', () => $('dlg-settings').showModal());
  $('open-info').addEventListener('click', () => $('dlg-info').showModal());
  // the archive has its own address (#archive), so it can be shared and the back button works
  function setView(v, push = true) {
    ui.view = v === 'archive' ? 'archive' : 'war';
    if (push) { try { history.pushState(null, '', ui.view === 'archive' ? '#archive' : location.pathname + location.search); } catch { } }
    if (ui.view === 'archive') loadArchive();
    render(); window.scrollTo({ top: 0 });
  }
  $('open-archive').addEventListener('click', () => setView(ui.view === 'archive' ? 'war' : 'archive'));
  window.addEventListener('popstate', () => setView(location.hash === '#archive' ? 'archive' : 'war', false));
  if (location.hash === '#archive') ui.view = 'archive';
  $('refresh').addEventListener('click', () => refresh());

  function bindSettings() {
    const map = { 's-capmode': 'capMode', 's-cap': 'capacity', 's-dss': 'dssBonus', 's-hod': 'hodMult', 's-rec': 'recordShare', 's-contact': 'contact', 's-motion': 'motion' };
    for (const [id, key] of Object.entries(map)) {
      const el = $(id);
      el.value = settings[key];
      el.addEventListener('change', () => {
        settings[key] = el.type === 'number' ? Number(el.value) : el.value;
        store.set('settings', settings);
        if (key === 'motion') { document.documentElement.classList.toggle('calm', reduced()); render(); }
        else refresh();
      });
    }
  }

  function applyTexts() {
    document.documentElement.lang = 'en';
    $('ot-nav').setAttribute('aria-label', t('ordersAria'));
    document.querySelectorAll('[data-close]').forEach(b => b.setAttribute('aria-label', t('close')));
    $('tagline').textContent = t('tagline');
    $('settings-title').textContent = t('settings');
    $('info-title').textContent = t('info');
    $('share-title').textContent = t('sh.title');
    $('open-settings').setAttribute('aria-label', t('settings'));
    $('open-settings').title = t('settings');
    $('open-info').setAttribute('aria-label', t('info'));
    $('open-info').title = t('info');
    $('order-tabs').setAttribute('aria-label', t('ordersAria'));
    const lbl = { 'l-cap': 'sCap', 'l-capval': 'sCapVal', 'l-dss': 'sDss', 'l-hod': 'sHod', 'l-rec': 'sRec', 'l-contact': 'sContact', 'l-motion': 'sMotion' };
    for (const [id, k] of Object.entries(lbl)) $(id).textContent = t(k);
    $('s-capmode').options[0].textContent = t('sAuto');
    $('s-capmode').options[1].textContent = t('sManual');
    $('s-motion').options[0].textContent = t('mFull');
    $('s-motion').options[1].textContent = t('mReduced');
    $('explain').innerHTML = EXPLAIN;
    $('footer').textContent = t('footer');
    for (const [id, k] of [['l-refresh', 'kh.refresh'], ['l-archive', 'ar.btn'], ['l-info', 'help'], ['l-settings', 'settings']]) { const el = $(id); if (el) { el.textContent = t(k); el.parentElement.setAttribute('aria-label', t(k)); } }
    $('boot-skip').textContent = t('skip');
    const note = $('sk-note'); if (note) note.textContent = t('firstLoad');
  }

