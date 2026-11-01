  /* ---------- boot sequence ---------- */
  let bootTimer = 0, bootLines = 0, bootChars = 0;
  // a terminal typing: each line letter by letter, then its OK
  function bootType() {
    const log = $('boot-log');
    const lines = t('boot');
    if (bootLines >= lines.length) return;
    const line = lines[bootLines];
    bootChars = Math.min(line.length, bootChars + 3);
    const done = lines.slice(0, bootLines).map(l => `${esc(l)} <span class="ok">${t('bootOk')}</span>`);
    log.innerHTML = [...done, esc(line.slice(0, bootChars)) + '<span class="caret"></span>'].join('\n');
    if (bootChars >= line.length) { bootLines++; bootChars = 0; bootTimer = setTimeout(bootType, 140); }
    else bootTimer = setTimeout(bootType, 16);
  }
  // state: 'ok' (data in), 'fail' (first load failed), 'wait' (API slow: show the page and keep loading)
  let bootDone = false;
  function bootFinish(state) {
    const boot = $('boot');
    if (!boot || bootDone) return;
    bootDone = true;
    const wait = 0;
    setTimeout(() => {
      clearTimeout(bootTimer);
      const log = $('boot-log');
      const lines = t('boot');
      const lastLine = state === 'ok' ? t('bootReady') : state === 'fail' ? t('bootFail') : t('bootWait');
      log.innerHTML = lines.map((l, i) => `${esc(l)} <span class="${state === 'ok' || i < lines.length - 1 ? 'ok' : 'pending'}">${state === 'ok' || i < lines.length - 1 ? t('bootOk') : '…'}</span>`).join('\n') + '\n' + esc(lastLine);
      setTimeout(() => boot.classList.add('out'), reduced() ? 0 : 120);
    }, wait);
  }
  $('boot-skip').addEventListener('click', () => { bootDone = true; $('boot').classList.add('out'); });
  setTimeout(() => bootFinish('wait'), 4500);

  /* ---------- start ---------- */
  bindSettings();
  applyTexts();
  document.documentElement.classList.toggle('calm', reduced());
  if (reduced()) $('boot').classList.add('out'); else bootType();
  loadNames().then(() => { if (last) render(); });
  {
    const snap = store.get('snap', null);
    if (snap && snap.war && Date.now() - snap.t < 6 * 3600e3) { bootDone = true; $('boot').classList.add('out'); refresh({ seed: snap }); }
    else loadLive().then(l => { if (l && !freshDone) refresh({ seed: l }); });
  }
  refresh();
  setInterval(tick, 1000);
