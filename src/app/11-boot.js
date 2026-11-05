  /* ---------- start ----------
     No boot sequence: the page loads straight into the call, with a skeleton until the first data arrives
     (critique 1 Nov 2026: an orchestrated terminal boot delays the one thing a player came for). */
  function bootFinish() { const sk = $('skeleton'); if (sk) sk.remove(); }
  bindSettings();
  applyTexts();
  document.documentElement.classList.toggle('calm', reduced());
  loadNames().then(() => { if (last) render(); });
  {
    const snap = store.get('snap', null);
    if (snap && snap.war && Date.now() - snap.t < 6 * 3600e3) refresh({ seed: snap });
    else loadLive().then(l => { if (l && !freshDone) refresh({ seed: l }); });
  }
  refresh();
  setInterval(tick, 1000);
