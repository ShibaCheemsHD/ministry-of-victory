  /* ---------- share image: the order of the day as one picture (Reddit, Discord) ----------
     Everything that matters in one PNG, so people get the call without opening the site.
     Drawn on a canvas from the same parts the page shows; times are in UTC (readers are everywhere). */
  // the page's colours: the five-step call scale, and the factions for the bars
  const SH_LV = { done: '#3fc483', ok: '#2fc6b8', push: '#efc63a', record: '#ff8040', out: '#a0a9bb', wait: '#a0a9bb' };
  const SH_VC = Object.fromEntries(Object.keys(LVL).map(v => [v, SH_LV[lvl(v)]]));
  const SH_FAC = { Terminids: '#f5a83c', Automaton: '#ff6159', Illuminate: '#b48eff', Humans: '#67b7ee' };
  const SH_D = 'Saira', SH_U = 'Saira';
  async function shareImage(entry) {
    const { a, res } = entry;
    try { await Promise.all(['900 40px Saira', '800 40px Saira', '700 20px Saira', '500 20px Saira'].map(f => document.fonts.load(f))); } catch {}
    // the page's own words, with times in UTC
    clockUTC = true;
    let p, mv, objs, joel;
    try {
      p = directiveParts(res); mv = callMove(res, p);
      const box = new DOMParser().parseFromString(objectivesHTML(res), 'text/html').body;
      objs = [...box.querySelectorAll('.race')].map(el => {
        const h = el.querySelector('.race-name'); const opt = h.querySelector('.opt'); if (opt) opt.remove();
        const fillEl = el.querySelector('.bar .fill'), projEl = el.querySelector('.bar .proj');
        const pillEl = el.querySelector('.pill, .called');
        const lv = [...el.classList].find(c => c.startsWith('vl-'))?.slice(3) || 'wait';
        el.querySelectorAll('.intel, .chipline, .early').forEach(n => n.remove());
        return { title: noItem(plain(h.innerHTML)), lv, pill: pillEl ? plain(pillEl.innerHTML) : '', frac: fillEl ? Number(fillEl.dataset.w) / 100 : null,
          proj: projEl ? (parseFloat(projEl.style.left) + parseFloat(projEl.style.width)) / 100 : null, line: noItem(plain(el.querySelector('.line')?.innerHTML || '')),
          fac: [...el.classList].find(c => c.startsWith('fac-'))?.slice(4) || null };
      });
      const it = intelFor(entry), tasks = res.tasks.map(r => r.task);
      joel = [...it.items].sort((x, y) => prioOf(x) - prioOf(y) || y.t - x.t).map(x => joelItem(x, tasks, it.rel, { start: entry.start, end: Date.parse(a.expiration) })).filter(r => !r.earned).slice(0, 2)
        .map(r => ({ title: noItem(plain(r.title)), detail: plain(r.detail || ''), when: r.when || ago(r.t) }));
    } finally { clockUTC = false; }
    const W = 1080, PAD = 64, IN = W - PAD * 2, S = 2;
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    // titles in the page's wide capitals, the rest in its interface face (sizes scaled for the wide face)
    const font = (px, w = 600, fam = SH_U) => { const wide = fam === SH_D; ctx.font = `${w} ${wide ? Math.round(px * 0.74) : px}px "${fam}", sans-serif`; try { ctx.fontStretch = wide ? 'expanded' : 'normal'; } catch {} };
    const wrap = (text, maxW, max = 9) => {
      const words = String(text || '').split(/\s+/).filter(Boolean), lines = []; let cur = '';
      for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width <= maxW || !cur) cur = t2; else { lines.push(cur); cur = w; } }
      if (cur) lines.push(cur);
      if (lines.length > max) { lines.length = max; let l = lines[max - 1]; while (l && ctx.measureText(l + '…').width > maxW) l = l.replace(/\s*\S+$/, ''); lines[max - 1] = l + '…'; }
      return lines;
    };
    const vc = SH_VC[res.verdict] || '#a0a9bb';
    const pickTxt = pickLine(entry);
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
      // header: the network band, Super Earth yellow with black type
      y = 0;
      R(0, 0, W, 96, '#ffe900');
      // the game's hazard stripe under the band
      if (on) { for (let x = -20; x < W + 20; x += 24) { ctx.fillStyle = '#ffe900'; ctx.beginPath(); ctx.moveTo(x, 110); ctx.lineTo(x + 12, 98); ctx.lineTo(x + 24, 98); ctx.lineTo(x + 12, 110); ctx.closePath(); ctx.fill(); } }
      if (on) {
        ctx.save(); ctx.translate(PAD + 20, 48); ctx.strokeStyle = '#0a0a07'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(19, 0); ctx.lineTo(0, 19); ctx.lineTo(-19, 0); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = '#0a0a07'; ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(7, -4); ctx.lineTo(4.8, 0.5); ctx.lineTo(2, 0.5); ctx.lineTo(2, 8); ctx.lineTo(-2, 8); ctx.lineTo(-2, 0.5); ctx.lineTo(-4.8, 0.5); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      font(40, 900, SH_D); T('MINISTRY OF VICTORY', PAD + 56, 62, '#0a0a07');
      font(15, 800); if (on) ctx.letterSpacing = '2px'; T(t('sh.head').toUpperCase(), W - PAD, 44, '#0a0a07', 'right'); if (on) ctx.letterSpacing = '0px';
      font(15, 600); T(stamp, W - PAD, 68, '#0a0a07', 'right');
      y = 96 + 56;
      // order
      font(16, 700); if (on) ctx.letterSpacing = '3px';
      const meta = [n > 1 ? fill(t('sh.order'), { n: k, m: n }) : null, isFinite(left) && left > 0 ? fill(t('sh.left'), { d: durDown(left / 3.6e6) }) : null, medalsOf(a) ? fill(t('sh.medals'), { n: medalsOf(a) }) : null].filter(Boolean).join('  ·  ').toUpperCase();
      T(meta, PAD, y, '#b4bdce'); if (on) ctx.letterSpacing = '0px'; y += 16;
      const tpx = title.length > 30 ? 50 : 62; font(tpx, 900, SH_D);
      for (const l of wrap(title, IN, 3)) { y += tpx; T(l, PAD, y, '#eef2f8'); }
      // several orders: the desk's best bet, so a shared call never sends people to the worse order
      if (pickTxt) { y += 26; font(21, 700); const pl = wrap(pickTxt, IN - 30, 3); const ph = pl.length * 30 + 22; R(PAD, y, IN, ph, '#1c1d22'); R(PAD, y, 5, ph, '#ffe900'); let py = y + 8; for (const l of pl) { py += 28; T(l, PAD + 22, py - 6, '#eef2f8'); } y += ph; }
      y += 34;
      // the call
      y += 40;
      font(16, 800); if (on) ctx.letterSpacing = '2px'; for (const l of wrap(mv.tag.toUpperCase(), IN, 2)) { T(l, PAD, y - 20, '#ffe900'); y += 22; } y -= 22; if (on) ctx.letterSpacing = '0px';
      const big1 = (mv.verb || '').toUpperCase();
      if (big1) { font(44, 900, SH_D); y += 30; T(big1, PAD, y, '#ffe900'); }
      font(mv.target.length > 14 ? 84 : 120, 900, SH_D);
      for (const [i, l] of wrap(mv.target.toUpperCase(), IN, 2).entries()) { y += (mv.target.length > 14 ? 82 : 112) - (i === 0 && big1 ? 18 : 0); T(l, PAD, y, '#eef2f8'); }
      y += 18;
      const why = plain(mv.why);
      font(25, 500); for (const [i, l] of wrap(why, IN, 5).entries()) { y += 35; T(l, PAD, y, i === 0 && p.lead && !mv.moveOn ? vc : '#eef2f8'); }
      if (p.cap && !mv.moveOn) { y += 22; R(PAD, y, IN, 1, '#484b53'); y += 8; font(22, 700); for (const l of wrap(plain(p.cap), IN, 3)) { y += 32; T(l, PAD, y, '#eef2f8'); } }
      y += 52;
      // the order's forecast, after the call (the call comes first, as on the page)
      y += 4;
      // forecast
      const fy = y; font(46, 900, SH_D); const vLines = wrap(t('v.' + res.verdict).toUpperCase(), IN - 60, 2);
      font(22, 500); const mLines = wrap(t('m')[res.verdict] || '', IN - 60, 2);
      const fh = 34 + 16 + vLines.length * 44 + 10 + mLines.length * 30 + 26;
      if (on) { ctx.fillStyle = '#1c1d22'; ctx.fillRect(PAD, fy, IN, fh); ctx.fillStyle = vc; ctx.fillRect(PAD, fy, 6, fh); }
      y = fy + 40; font(15, 700); if (on) ctx.letterSpacing = '2px'; T(t('forecast').toUpperCase(), PAD + 30, y, '#b4bdce'); if (on) ctx.letterSpacing = '0px';
      font(46, 900, SH_D); for (const l of vLines) { y += 46; T(l, PAD + 30, y, vc); }
      y += 6; font(22, 500); for (const l of mLines) { y += 30; T(l, PAD + 30, y, '#eef2f8'); }
      y = fy + fh + 40;
      // objectives
      y += 20; font(34, 900, SH_D); T(t('races.title').toUpperCase(), PAD, y, '#eef2f8'); y += 18;
      for (const o of objs.slice(0, 6)) {
        y += 14; R(PAD, y, IN, 1, '#2b2d33'); y += 36;
        font(17, 700); ctx.letterSpacing = '1.5px'; const pw = o.pill ? ctx.measureText(o.pill.toUpperCase()).width + 26 : 0; ctx.letterSpacing = '0px';
        if (o.pill && on) { const c = SH_LV[o.lv] || '#a0a9bb'; ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.strokeRect(W - PAD - pw, y - 24, pw, 32); ctx.letterSpacing = '1.5px'; T(o.pill.toUpperCase(), W - PAD - pw / 2 + 0.75, y - 2, c, 'center'); ctx.letterSpacing = '0px'; }
        font(30, 800, SH_D); const tl = wrap(o.title.toUpperCase(), IN - pw - 24, 2); for (const [i, l] of tl.entries()) { if (i) y += 32; T(l, PAD, y, '#eef2f8'); }
        if (o.frac != null) {
          y += 18; const fc = SH_FAC[o.fac] || SH_LV[o.lv] || '#eef2f8';
          R(PAD, y, IN, 12, '#25272d'); R(PAD + IN - 2, y - 4, 2, 20, '#eef2f8');
          if (o.proj != null && o.proj > o.frac && on) { ctx.fillStyle = fc + '40'; ctx.fillRect(PAD + IN * o.frac, y, IN * (Math.min(1, o.proj) - o.frac), 12); }
          R(PAD, y, Math.max(3, IN * Math.min(1, o.frac)), 12, fc); y += 12;
        }
        font(20, 500); for (const l of wrap(o.line, IN, 2)) { y += 30; T(l, PAD, y, '#b4bdce'); }
      }
      if (objs.length > 6) { y += 34; font(19, 500); T(fill(t('sh.more'), { n: objs.length - 6 }), PAD, y, '#b4bdce'); }
      // Joel
      if (joel.length) {
        y += 60; font(30, 900, SH_D); T(t('jo.title').toUpperCase(), PAD, y, '#eef2f8'); y += 6;
        for (const j of joel) { y += 36; font(22, 700); T(j.title, PAD, y, '#eef2f8'); font(19, 500); T(j.when, W - PAD, y, '#b4bdce', 'right'); if (j.detail) { font(19, 500); for (const l of wrap(j.detail, IN, 1)) { y += 28; T(l, PAD, y, '#b4bdce'); } } }
      }
      // footer
      y += 70; R(PAD, y, IN, 2, '#eef2f8'); R(PAD, y - 1, 64, 4, '#ffe900'); y += 46;
      font(23, 700); T('shibacheemshd.github.io/ministry-of-victory', PAD, y, '#eef2f8');
      font(17, 500); T(t('sh.foot'), W - PAD, y, '#b4bdce', 'right');
      // a screenshot travels without the page: one line on what the verdict is and isn't (audit PO-06)
      y += 34; font(16, 500); for (const l of wrap(t('sh.method') + (customModel() ? ' ' + t('modelNote') + '.' : ''), IN, 3)) { T(l, PAD, y, '#8d98ae'); y += 24; }
      return y + 40;
    }
    cv.width = W; cv.height = 10; const H = Math.max(1350, Math.ceil(draw(false)));
    cv.width = W * S; cv.height = H * S; ctx.scale(S, S);
    ctx.fillStyle = '#121317'; ctx.fillRect(0, 0, W, H);
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
  function toast(msg, ms = 2400) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  /* ---------- Managed Democracy for Dummies: the questions every Helldiver asks before dropping ---------- */
  const FAQ_SRC = [['Helldivers Wiki: Second Galactic War mechanics', 'https://helldivers.wiki.gg/wiki/Liberation'],
    ['Switchblade Gaming: Galactic War guide (April 2026)', 'https://www.switchbladegaming.com/helldivers-2/galactic-war-guide/'],
    ['FRVR: Major Order rewards change (April 2026)', 'https://frvr.com/blog/helldivers-2-makes-huge-major-order-change/']];
  function faqLive() {
    if (!last) return t('faq.noLive');
    const e = last.results.find(x => String(x.a.id) === String(ui.order)) || last.results[0];
    const pl = (e && directiveParts(e.res).planet) || (meanwhilePick() || {}).p;
    const w = pl && missionWorth(pl);
    if (!w) return t('faq.noLive');
    const day = w.vsDay && Math.abs(w.vsDay - 1) >= 0.1 ? esc(fill(t(w.vsDay > 1 ? 'worth.more' : 'worth.less'), { p: Math.round(Math.abs(w.vsDay - 1) * 100) + '%' })) : '';
    return fill(t('faq.live'), { source: esc(t(w.measured ? 'worth.measured' : 'worth.default')), remaining: w.left == null ? '' : fill(t(w.defend ? 'worth.remainingDefense' : 'worth.remaining'), { n: nice(w.left) }), planet: planetName(pl), m: tinyPct(w.frac), n: nice(w.per1), left: nice(w.left), goal: esc(t(w.defend ? 'worth.hold' : 'worth.free')), day });
  }
  function openFaq(id) {
    const F = t('faq'), dlg = $('dlg-faq');
    $('faq-title').textContent = F.title;
    $('faq-body').innerHTML = `<p class="faq-intro">${esc(F.intro)}</p><div class="faq-guide"><button type="button" class="btn ghostly" data-open-guide>${ICON.track}<span>${esc(t('faqGuide'))}</span></button><p class="faq-keys">${t('keysHint')}</p></div><div class="faq-list">${F.items.map(it => `<details class="faq" id="faq-${it.id}"${it.id === id ? ' open' : ''}><summary>${esc(it.q)}</summary><div class="faq-a">${fill(it.a, { live: faqLive(), unsure: esc(F.unsure), dss: Math.round(settings.dssBonus * 100) + '%', hod: String(settings.hodMult), other: String(settings.hodOther ?? ENGINE.DEFAULTS.hodOther) })}</div></details>`).join('')}</div>
      <div class="faq-foot"><p>${esc(F.checked)}</p><ul>${FAQ_SRC.map(([n, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join('')}</ul><p><a href="https://github.com/ShibaCheemsHD/ministry-of-victory/issues/new" target="_blank" rel="noopener">${esc(F.sources)}</a></p></div>`;
    document.querySelectorAll('dialog[open]').forEach(d => { if (d !== dlg) d.close(); });
    if (!dlg.open) dlg.showModal();
    const el = id && $('faq-' + id);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  }
  document.addEventListener('click', (e) => {
    const f = e.target.closest && e.target.closest('[data-faq]');
    if (f) { e.preventDefault(); openFaq(f.dataset.faq); return; }
    const h = e.target.closest && e.target.closest('[data-help]');
    if (h) { $('dlg-faq').close(); $('dlg-info').showModal(); const s = $(h.dataset.help); if (s) requestAnimationFrame(() => s.scrollIntoView({ block: 'start' })); }
  });

  // the planet's trigger that is on screen: the globe on wide screens, the planet button on narrow ones
  const globeEl = () => [...document.querySelectorAll('[data-globe]')].find(e => e.getClientRects().length) || null;
  function setGlance(on) { settings.layout = on ? 'glance' : 'full'; store.set('settings', settings); if ($('s-layout')) $('s-layout').value = settings.layout; render(); }
  // one Share menu: closes on a pick, on a click elsewhere and on Escape
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.share-menu[open]').forEach(d => { if (!d.contains(e.target) || e.target.closest('.sm-item')) d.open = false; });
  }, true);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-glance]')) { setGlance(false); return; }
    if (e.target.closest('[data-glance-on]')) { setGlance(true); window.scrollTo({ top: 0 }); return; }
    const el = e.target.closest('[data-retry],[data-follow],[data-otab],[data-tab],[data-goto],[data-toggle-nums],[data-preset],[data-close],[data-copy],[data-shareimg],[data-cycle],[data-hint-close],[data-legend],[data-hmode],[data-igroup],[data-intelfilter],[data-iclear]');
    if (!el) return;
    if (el.dataset.legend) {   // show / hide one line of a chart
      const id = el.dataset.legend, k = el.dataset.s, off = (ui.chartOff[id] ||= {});
      off[k] = !off[k];
      el.setAttribute('aria-pressed', String(!off[k]));
      document.querySelectorAll(`[data-chart="${CSS.escape(id)}"] [data-s="${CSS.escape(k)}"]`).forEach(n => n.classList.toggle('off', off[k]));
      return;
    }
    if (el.dataset.hmode) { ui.histMode[el.dataset.hmode] = el.dataset.v; saveUi(); render(); return; }
    if (el.dataset.intelfilter) {
      intelState(el.dataset.iorder).filter = el.dataset.intelfilter;
      intelState(el.dataset.iorder).selected = [];
      render();
      document.querySelector(`[data-intelfilter="${CSS.escape(el.dataset.intelfilter)}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (el.dataset.igroup) { selectIntelEvents(el.dataset.igroup.split(','), el.dataset.iorder, el); return; }
    if (el.hasAttribute('data-iclear')) { selectIntelEvents([], el.dataset.iorder, el); return; }
    if (el.hasAttribute('data-retry')) { refresh(); return; }
    if (el.hasAttribute('data-follow')) { ui.orderManual = false; saveUi(); render(); return; }
    if (el.dataset.otab) { ui.order = el.dataset.otab; ui.orderManual = true; saveUi(); render(); if (el.hasAttribute('data-pick')) window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); return; }
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
        if (!ok) { $('share-title').textContent = t('copy'); $('share-body').innerHTML = `<p class="sh-note">${esc(t('copyBox'))}</p><textarea class="copy-box" readonly rows="8">${esc(text)}</textarea>`; const d = $('dlg-share'); if (!d.open) d.showModal(); const ta = $('share-body').querySelector('textarea'); ta.focus(); ta.select(); return; }
        toast(t('copied'));
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
    if (el.id === 'ar-q') { ui.arq = el.value; cancelAnimationFrame(simRaf); simRaf = requestAnimationFrame(() => { render(); const q = $('ar-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }); return; }
    if (el.dataset && el.dataset.sim) { const v = Number(el.value), id = el.dataset.sim; el.style.setProperty('--p', ((v - 5) / 95) * 100 + '%'); cancelAnimationFrame(simRaf); simRaf = requestAnimationFrame(() => updateSim(id, v)); }
    if (el.dataset && el.dataset.pace) { const v = Number(el.value), id = el.dataset.pace; cancelAnimationFrame(simRaf); simRaf = requestAnimationFrame(() => updatePace(id, v)); }
  });
  // remember which objective details are open across the 60 s re-renders ('toggle' doesn't bubble)
  document.addEventListener('toggle', (e) => {
    const el = e.target;
    if (el && el.dataset && el.dataset.planDetail) planDetailsOpen[el.dataset.planDetail] = el.open;
    if (el && el.dataset && el.dataset.evidence) evidenceOpen[el.dataset.evidence] = el.open;
    if (el && el.dataset && el.dataset.intel) ui.intelOpen[el.dataset.intel] = el.open;
    if (el && el.dataset && el.dataset.simbox) { ui.simOpen[el.dataset.simbox] = el.open; saveUi(); }
    if (el && el.dataset && el.dataset.brief) ui.briefOpen[el.dataset.brief] = el.open;
    if (el && el.dataset && el.dataset.doneOpen) (ui.doneOpen ||= {})[el.dataset.doneOpen] = el.open;
    if (el && el.dataset && 'cross' in el.dataset) ui.crossOpen = el.open;
    if (el && el.dataset && 'intelstrip' in el.dataset) ui.intelStripOpen = el.open;
    if (el && el.dataset && el.dataset.year) (ui.arYears ||= {})[el.dataset.year] = el.open;
  }, true);
  // game-style shortcuts: Q / E switch tab, 1-3 jump to a tab, R refreshes, ? opens the guide
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag) || (e.target && e.target.isContentEditable)) return;
    if (document.querySelector('dialog[open]') || !last) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // a key switches the tab and brings it on screen (critique 1 Nov 2026: the tabs changed off-screen)
    if (k === 'q' || k === 'e') { e.preventDefault(); cycleTab(k === 'q' ? -1 : 1, true); }
    else if (/^[1-4]$/.test(k)) { e.preventDefault(); selectTab(TABS[Number(k) - 1], 'tabs'); }
    else if (k === 'a') { e.preventDefault(); setView(ui.view === 'archive' ? 'war' : 'archive'); }
    else if (k === 'p' && document.querySelector('[data-globe]')) { e.preventDefault(); if (ui.pcPinned) closeCard(true); else openCard(true); }
    else if (k === 'Escape' && document.querySelector('.share-menu[open]')) document.querySelectorAll('.share-menu[open]').forEach(d => { d.open = false; d.querySelector('summary').focus(); });
    else if (k === 'Escape' && $('view').querySelector('.pc-wrap.open')) closeCard(true);
    else if (k === 'c' && $('view').querySelector('[data-copy]')) { e.preventDefault(); $('view').querySelector('[data-copy]').click(); }
    else if (k === 's' && $('view').querySelector('[data-shareimg]')) { e.preventDefault(); $('view').querySelector('[data-shareimg]').click(); }
    else if (k === '/') { e.preventDefault(); if (ui.view !== 'archive') setView('archive'); setTimeout(() => $('ar-q')?.focus(), 0); }
    else if (k === 'r') { e.preventDefault(); refresh(); }
    else if (k === '?') { e.preventDefault(); $('dlg-info').showModal(); }
    else if (k === 'f') { e.preventDefault(); openFaq('count'); }
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
    // the card lives at the end of the page, outside the cut-corner panels (a clip-path also clips fixed
    // children: critique 1 Nov 2026, its title and close button were cut off)
    const wrap = document.querySelector('.pc-wrap.free') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'pc-wrap free', hidden: true }));
    let entry = last.results.find(x => String(x.a.id) === String(ui.order));
    if (!entry && forced) entry = { res: { tasks: [], id: 'none' }, a: {} };
    if (!wrap || !entry) return;
    const cp = forced ? { planet: forced, list: null } : cardPlanets(entry); if (!cp) return;
    wrap.innerHTML = planetCardHTML(cp.planet, entry, cp.list);
    wrap.hidden = false; wrap.classList.add('open');
    if (!store.get('pcSeen', false)) { store.set('pcSeen', true); document.querySelectorAll('[data-globe]').forEach(g => g.classList.remove('g-new')); }
    placeCard();
    if (pin) ui.pcPinned = true;
    wrap.classList.toggle('pinned', !!ui.pcPinned);
    document.querySelectorAll('[data-globe]').forEach(g => g.setAttribute('aria-expanded', 'true'));
  }
  // desktop: beside the globe, over the side column when it fits there, never over the headline;
  // phones get a bottom sheet from the stylesheet
  function placeCard() {
    const wrap = document.querySelector('.pc-wrap.open'), g = ui.pcAnchor === 'map' ? (document.querySelector(`.mp[data-mp="${ui.pcForce}"]`) || document.querySelector('.war-map')) : globeEl();
    if (!wrap || !g) return;
    const r = g.getBoundingClientRect(), gap = 14, vw = window.innerWidth, vh = window.innerHeight;
    const W = Math.min(780, vw - (vw <= 760 ? 16 : 32));
    wrap.style.width = W + 'px'; // Measure height at the final width, not the previous popup width.
    const h = wrap.offsetHeight, right = vw - r.right - gap - 16;
    let left, top, side;
    if (right >= W) { left = r.right + gap; side = 'right'; }
    else if (r.left >= W + gap + 16) { left = r.left - W - gap; side = 'left'; }
    else { left = Math.max(8, Math.min(vw - W - 8, r.left + r.width / 2 - W / 2)); side = 'below'; }
    top = side === 'below' ? r.bottom + gap : r.top - 10;
    if (h <= vh - 96) top = Math.max(76, Math.min(vh - h - 12, top));
    else top = Math.max(76, r.top - 10);
    // An unusually long briefing can extend with the document, never inside a scrolling card.
    wrap.style.left = Math.round(left + window.scrollX) + 'px';
    wrap.style.top = Math.round(top + window.scrollY) + 'px'; wrap.dataset.side = side;
  }
  let placeRaf = 0;
  const placeSoon = () => { if (placeRaf) return; placeRaf = requestAnimationFrame(() => { placeRaf = 0; placeCard(); }); };
  window.addEventListener('resize', placeSoon);
  function closeCard(force) {
    if (ui.pcPinned && !force) return;
    ui.pcPinned = false; ui.pcForce = null; ui.pcAnchor = null;
    document.querySelectorAll('.pc-wrap').forEach(wrap => { wrap.hidden = true; wrap.classList.remove('open'); });
    document.querySelectorAll('[data-globe]').forEach(g => g.setAttribute('aria-expanded', 'false'));
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
    if ((inGlobe || inCard) && e.pointerType !== 'touch') { clearTimeout(pcTimer); if (inGlobe && !document.querySelector('.pc-wrap.open')) pcTimer = setTimeout(() => openCard(false), 450); }
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
    if (vw) { if (vw.hasAttribute('data-acc')) wantAcc = true; setView(vw.dataset.view); scrollToAcc(); return; }
    const nf = e.target.closest('[data-nf]');
    if (nf) { ui.nf = nf.dataset.nf || null; saveUi(); render(); return; }
    const op = e.target.closest('[data-open-planet]');
    if (op) { ui.pcForce = op.dataset.openPlanet; ui.pcAnchor = 'map'; openCard(true); return; }
    const mp = e.target.closest('.mp[data-mp]');
    if (mp) { mapTipOff(mp.closest('.war-map')); ui.pcForce = mp.dataset.mp; ui.pcAnchor = 'map'; openCard(true); return; }
    const tq = e.target.closest('[data-tipq]'); if (tq) { toast(tq.dataset.tipq, 8000); return; }
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
  // the field guide opens from the FAQ (7 Nov 2026: Help and FAQ were two buttons for one question)
  $('dlg-faq').addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-open-guide]')) { $('dlg-faq').close(); $('dlg-info').showModal(); } });
