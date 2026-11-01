  /* ---------- views, settings and the page's fixed texts (moved out of the share-image file: audit ARCH-06) ---------- */
  // the archive has its own address (#archive), so it can be shared and the back button works
  function setView(v, push = true) {
    ui.view = v === 'archive' ? 'archive' : 'war';
    if (push) { try { history.pushState(null, '', ui.view === 'archive' ? '#archive' : location.pathname + location.search); } catch { } }
    if (ui.view === 'archive') loadArchive();
    render(); window.scrollTo({ top: 0 });
  }
  $('open-archive').addEventListener('click', () => setView(ui.view === 'archive' ? 'war' : 'archive'));
  // back / forward, and a link to another order opened in this tab: the address decides what shows
  window.addEventListener('popstate', () => {
    const h = readHash();
    if (h.view === 'war' && h.order) { ui.order = h.order; ui.orderManual = true; if (h.tab) { ui.tab[h.order] = h.tab; tabScrollDue = true; } }
    closeCard(true);
    setView(h.view, false);
  });
  if (location.hash === '#archive') ui.view = 'archive';
  $('refresh').addEventListener('click', () => refresh());

  // Settings: what a player changes (animations) first; the forecast model's constants folded away under
  // "Advanced", each with what it does and a reset (critique 1 Nov 2026: raw constants with no guidance)
  const SET_MAP = { 's-capmode': 'capMode', 's-cap': 'capacity', 's-dss': 'dssBonus', 's-hod': 'hodMult', 's-rec': 'recordShare', 's-contact': 'contact', 's-motion': 'motion' };
  const SET_DEF = { capMode: 'auto', capacity: ENGINE.DEFAULTS.capacity, dssBonus: ENGINE.DEFAULTS.dssBonus, hodMult: ENGINE.DEFAULTS.hodMult, recordShare: ENGINE.DEFAULTS.recordShare };
  function syncSettings() {
    for (const [id, key] of Object.entries(SET_MAP)) $(id).value = settings[key];
    $('f-capval').hidden = settings.capMode !== 'manual';
  }
  function bindSettings() {
    for (const [id, key] of Object.entries(SET_MAP)) {
      const el = $(id);
      el.addEventListener('change', () => {
        let v = el.type === 'number' ? Number(el.value) : el.value;
        // out of range or empty: back to the last good value rather than a forecast built on nonsense
        if (el.type === 'number' && (!isFinite(v) || el.value === '' || (el.min !== '' && v < Number(el.min)) || (el.max !== '' && v > Number(el.max)))) { el.value = settings[key]; toast(t('sBad')); return; }
        settings[key] = v;
        store.set('settings', settings);
        syncSettings();
        if (key === 'motion') { document.documentElement.classList.toggle('calm', reduced()); render(); }
        else refresh();
      });
    }
    $('s-reset').addEventListener('click', () => {
      Object.assign(settings, SET_DEF); store.set('settings', settings); syncSettings(); toast(t('sResetDone')); refresh();
    });
    syncSettings();
  }

  // The address carries the order and the tab (#order=123&tab=plan), so a call can be linked to straight
  // (critique 1 Nov 2026: no deep link for Discord); the archive keeps #archive.
  // a link that names a tab lands on that tab, scrolled into view, once the first data is drawn
  let tabScrollDue = false;
  function readHash() {
    const h = location.hash.replace(/^#/, '');
    if (h === 'archive') return { view: 'archive' };
    const q = new URLSearchParams(h);
    const tab = Object.keys(TAB_SLUG).find(k => TAB_SLUG[k] === q.get('tab')) || null;
    return { view: 'war', order: q.get('order'), tab };
  }
  function syncHash() {
    if (ui.view === 'archive' || !last) return;
    const id = last.results.some(x => String(x.a.id) === String(ui.order)) ? String(ui.order) : null;
    const want = id ? `#order=${encodeURIComponent(id)}&tab=${TAB_SLUG[curTab(id)]}` : '';
    if ((location.hash || '') === want) return;
    try { history.replaceState(null, '', want || location.pathname + location.search); } catch { }
  }
  {
    const h = readHash();
    if (h.order) { ui.order = h.order; ui.orderManual = true; if (h.tab) { ui.tab[h.order] = h.tab; tabScrollDue = true; } }
  }

  function applyTexts() {
    document.documentElement.lang = 'en';
    $('ot-nav').setAttribute('aria-label', t('ordersAria'));
    document.querySelectorAll('[data-close]').forEach(b => b.setAttribute('aria-label', t('close')));
    $('tagline').textContent = t('tagline');
    $('settings-title').textContent = t('settings');
    $('info-title').textContent = t('info');
    $('share-title').textContent = t('sh.title');
    $('dlg-share').addEventListener('close', () => { $('share-title').textContent = t('sh.title'); });
    $('order-tabs').setAttribute('aria-label', t('ordersAria'));
    const lbl = { 'l-cap': 'sCap', 'l-capval': 'sCapVal', 'l-dss': 'sDss', 'l-hod': 'sHod', 'l-rec': 'sRec', 'l-contact': 'sContact', 'l-motion': 'sMotion',
      'h-motion': 'hMotion', 'h-cap': 'hCap', 'h-capval': 'hCapVal', 'h-dss': 'hDss', 'h-hod': 'hHod', 'h-rec': 'hRec', 'h-contact': 'hContact', 'h-model': 'hModel',
      'l-g-display': 'gDisplay', 'l-g-model': 'gModel', 'l-g-api': 'gApi', 's-reset': 'sReset' };
    for (const [id, k] of Object.entries(lbl)) $(id).textContent = t(k);
    $('s-capmode').options[0].textContent = t('sAuto');
    $('s-capmode').options[1].textContent = t('sManual');
    $('s-motion').options[0].textContent = t('mFull');
    $('s-motion').options[1].textContent = t('mReduced');
    $('explain').innerHTML = EXPLAIN;
    // a way back to us from the page (audit PO-02): the repo's issue form, no account data sent
    $('footer').innerHTML = `<p class="foot-keys">${t('keysHint')}</p><p>${esc(t('footer'))}</p><p class="foot-links"><a href="https://github.com/ShibaCheemsHD/ministry-of-victory/issues/new" target="_blank" rel="noopener">${esc(t('feedback'))}</a><a href="https://raw.githubusercontent.com/ShibaCheemsHD/ministry-of-victory/data/feed.xml" target="_blank" rel="noopener">${esc(t('rss'))}</a><a href="https://github.com/ShibaCheemsHD/ministry-of-victory" target="_blank" rel="noopener">${esc(t('source'))}</a></p>`;
    for (const [id, k] of [['l-refresh', 'kh.refresh'], ['l-archive', 'ar.btn'], ['l-info', 'help'], ['l-settings', 'settings']]) { const el = $(id); if (el) el.textContent = t(k); }
    const note = $('sk-note'); if (note) note.textContent = t('firstLoad');
  }
