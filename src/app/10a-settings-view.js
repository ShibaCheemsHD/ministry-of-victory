  /* ---------- views, settings and the page's fixed texts (moved out of the share-image file: audit ARCH-06) ---------- */
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
    // a way back to us from the page (audit PO-02): the repo's issue form, no account data sent
    $('footer').innerHTML = `${esc(t('footer'))} <a href="https://github.com/ShibaCheemsHD/ministry-of-victory/issues/new" target="_blank" rel="noopener">${esc(t('feedback'))}</a> · <a href="https://raw.githubusercontent.com/ShibaCheemsHD/ministry-of-victory/data/feed.xml" target="_blank" rel="noopener">${esc(t('rss'))}</a>`;
    for (const [id, k] of [['l-refresh', 'kh.refresh'], ['l-archive', 'ar.btn'], ['l-info', 'help'], ['l-settings', 'settings']]) { const el = $(id); if (el) { el.textContent = t(k); el.parentElement.setAttribute('aria-label', t(k)); } }
    $('boot-skip').textContent = t('skip');
    const note = $('sk-note'); if (note) note.textContent = t('firstLoad');
  }
  // "Why ›" in the phone forecast strip: down to the forecast card and its reasons
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-goto-fc]');
    if (!b) return;
    const card = b.closest('.order')?.querySelector('.verdict-card');
    if (!card) return;
    card.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
    card.setAttribute('tabindex', '-1'); card.focus({ preventScroll: true });
  });
