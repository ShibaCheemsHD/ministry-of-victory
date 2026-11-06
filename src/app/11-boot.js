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
  function preparedSnapshot(bundle) {
    applyRecord(bundle.intel, bundle.recent, bundle.progress);
    recordFetched = Date.now();
    const live = bundle.live;
    // Reuse the recorder's static order metadata and off-campaign planets instead of queuing API calls.
    if (Array.isArray(live.raw)) memo['/raw/api/v2/Assignment/War/801'] = { t: live.t, data: live.raw };
    const extras = store.get('xplanets', {});
    for (const planet of live.extra || []) if (planet?.index != null && (!extras[planet.index] || extras[planet.index].t < live.t))
      extras[planet.index] = { t: live.t, p: planet };
    store.set('xplanets', extras);
    return { ...live, bootstrap: true };
  }
  function initialForecastReady(results, planets, sectorOf) {
    return results.every(({ a, res }) => {
      if (res.verdict === 'unknown' || res.directive?.kind === 'play' || res.directive?.measuring) return false;
      const key = orderKey(a);
      return res.tasks.every(r => {
        if (r.task.planetIndex != null && !planets[r.task.planetIndex]) return false;
        if (r.task.sectorIndex != null && !sectorOf) return false;
        if (!r.counter || r.simpleCount || r.verdict === 'done') return true;
        return Number.isFinite(r.primary?.rate)
          && recordSamples.filter(s => s.prog?.[key]?.[r.idx] != null && s.t <= Date.now()).length >= 2;
      });
    });
  }
  async function initialSnapshot() {
    const cached = store.get('bootstrap', null);
    if (validBootstrap(cached)) {
      return preparedSnapshot(cached);
    }
    try {
      const response = await ghFetch(RECORD + 'bootstrap.json?t=' + Math.floor(Date.now() / 300e3),
        { signal: AbortSignal.timeout(4000) });
      const bundle = response.ok ? await response.json() : null;
      if (validBootstrap(bundle)) {
        store.set('bootstrap', bundle);
        return preparedSnapshot(bundle);
      }
    } catch { /* Older recorder versions and temporarily unavailable bundles use the separate files. */ }
    const ready = loadRecord(Date.now());
    const snap = store.get('snap', null);
    const live = snap?.war && Date.now() - snap.t < 15 * 60000 ? snap : await loadLive();
    await ready;
    return live;
  }
  // A coherent snapshot can paint early only after its actual forecasts pass the readiness gate.
  const initialReady = initialSnapshot().catch(e => console.warn('Initial snapshot unavailable:', e.message));
  initialReady.then(live => {
    if (live?.bootstrap && !freshDone) return refresh({ seed: live, ready: Promise.resolve(true) });
  }).catch(e => console.warn('Initial forecast unavailable:', e.message));
  refresh({ ready: initialReady });
  setInterval(tick, 1000);
