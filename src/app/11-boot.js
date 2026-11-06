  /* ---------- start ----------
     No boot sequence: the page loads straight into the call, with a skeleton until the first data arrives
     (critique 1 Nov 2026: an orchestrated terminal boot delays the one thing a player came for). */
  function bootFinish() { document.body.classList.remove('data-loading'); const sk = $('skeleton'); if (sk) sk.remove(); }
  bindSettings();
  applyTexts();
  document.documentElement.classList.toggle('calm', reduced());
  loadNames().then(() => { if (last) render(); });
  function validBootstrap(bundle) {
    const live = bundle?.live;
    return bundle?.v === 1 && Number.isFinite(bundle.t) && bundle.t <= Date.now() + 60000
      && Date.now() - bundle.t < 15 * 60000 && live?.v === 1 && live.t === bundle.t
      && live.war && Array.isArray(live.assignments) && Array.isArray(live.campaigns)
      && bundle.intel?.updated === bundle.t && Array.isArray(bundle.intel.alerts)
      && bundle.recent?.updated === bundle.t && Array.isArray(bundle.recent.samples);
  }
  async function initialSnapshot() {
    const cached = store.get('bootstrap', null);
    if (validBootstrap(cached)) {
      applyRecord(cached.intel, cached.recent, cached.progress);
      return cached.live;
    }
    try {
      const response = await ghFetch(RECORD + 'bootstrap.json?t=' + Math.floor(Date.now() / 300e3),
        { signal: AbortSignal.timeout(4000) });
      const bundle = response.ok ? await response.json() : null;
      if (validBootstrap(bundle)) {
        applyRecord(bundle.intel, bundle.recent, bundle.progress);
        recordFetched = Date.now();
        store.set('bootstrap', bundle);
        return bundle.live;
      }
    } catch { /* Older recorder versions and temporarily unavailable bundles use the separate files. */ }
    const ready = loadRecord(Date.now());
    const snap = store.get('snap', null);
    const live = snap?.war && Date.now() - snap.t < 15 * 60000 ? snap : await loadLive();
    await ready;
    return live;
  }
  // Hydrate history in parallel, but reveal the first call only after the live refresh completes.
  const initialReady = initialSnapshot().catch(e => console.warn('Initial snapshot unavailable:', e.message));
  refresh({ ready: initialReady });
  setInterval(tick, 1000);
