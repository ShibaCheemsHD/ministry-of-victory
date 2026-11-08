  /* ---------- changing tab, the way the game's menus do it (8 Nov 2026) ----------
     One quiet gesture of about 350 ms, each effect on its own part, nothing scaling and nothing flashing:
     the tab fills with the yellow from the left behind a thin lit edge; a fine line drops from the tab and draws
     a faint frame around the panel, which fades; the panel's parts fade up one after the other (five at most,
     only those on screen: the rest is simply there); and the labels decode word by word, as the game decrypts
     intel: every character runs through a few others of its kind, dim, and locks into the text's colour.
     The text keeps its final width and wraps where it will wrap, so nothing moves. Only transform and opacity
     move (the frame is four lines that grow), all the labels share one measuring pass and one loop.
     Never after a key press, never with reduced motion. */
  const TFX_PARTS = '.race, .race-done, .moves > li, .hist-card, .it-card, .situation, .pm-head, .sec-head, .mod-h, .fr-table, .empty-main > *, .empty-side > *';
  const TFX_LABELS = 'h2, h3, h4, h5, b, strong, .race-name, .tag, .req-chip, .stamp, .v, .pb-n, .acc-t b, .mv-top h4';
  const TFX_LET = 'ABCDEFGHJKLMNPRSTUVWXYZ', TFX_DIG = '0123456789';
  const tfxJobs = [];
  let tfxRaf = 0, tfxLast = 0;
  function tabTransition(tp) {
    if (!tp || !fxOn() || viaKeys || !tp.animate) return;
    const area = tp.closest('.area-tabs'), tab = area && area.querySelector('.tabbar .tab[aria-selected="true"]');
    const eIO = 'cubic-bezier(.77,0,.175,1)';
    // 1. the tab: the yellow fills in from the left with a thin lit edge ahead of it. The tab keeps its plain
    // look underneath and a selected copy of its label is uncovered over it, so the colours change exactly at
    // the edge and the label never goes dark
    if (tab) {
      tab.classList.add('tfx');
      tab.insertAdjacentHTML('afterbegin', `<span class="tfx-fill" aria-hidden="true">${[...tab.querySelectorAll(':scope > .tab-ico, :scope > .tab-txt')].map(x => x.outerHTML).join('')}</span><i class="tfx-edge" aria-hidden="true"></i>`);
      const fill = tab.querySelector('.tfx-fill'), edge = tab.querySelector('.tfx-edge'), w = tab.offsetWidth;
      fill.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 160, easing: eIO, fill: 'both' });
      edge.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${w}px)`, opacity: 1, offset: .9 }, { transform: `translateX(${w}px)`, opacity: 0 }], { duration: 170, easing: eIO })
        .finished.catch(() => {}).then(() => { fill.remove(); edge.remove(); tab.classList.remove('tfx'); });
    }
    // 2. the frame: a fine line drops from the tab, runs across, the sides come down, the bottom closes; it fades
    const pr = tp.getBoundingClientRect(), H = Math.min(tp.offsetHeight, Math.max(120, window.innerHeight - Math.max(0, pr.top))), tr = tab ? tab.getBoundingClientRect() : null;
    const cx = Math.max(0, Math.min(pr.width, tr ? tr.left + tr.width / 2 - pr.left : pr.width / 2));
    const g = document.createElement('div');
    g.className = 'tfx-frame'; g.setAttribute('aria-hidden', 'true'); g.style.height = H + 'px';
    g.innerHTML = `<i class="drop" style="left:${cx}px"></i><i class="e t" style="transform-origin:${cx}px 0"></i><i class="e b" style="transform-origin:${cx}px 0"></i><i class="e l"></i><i class="e r"></i><i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i>`;
    tp.append(g);
    const o = { easing: eIO, fill: 'both' };
    g.querySelector('.drop').animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 70, easing: 'ease-out', fill: 'both' });
    g.querySelector('.t').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { ...o, duration: 140, delay: 50 });
    g.querySelectorAll('.l, .r').forEach(x => x.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { ...o, duration: 140, delay: 150 }));
    g.querySelector('.b').animate([{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1 }], { ...o, duration: 110, delay: 250 });
    g.querySelectorAll('.cn').forEach(c => c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 80, delay: 260, fill: 'both' }));
    g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, delay: 330, easing: 'ease-in', fill: 'both' }).finished.catch(() => {}).then(() => g.remove());
    // 3. the parts fade up one after the other: the outermost ones on screen, five at most
    let parts = [...tp.querySelectorAll(TFX_PARTS)];
    if (!parts.length) parts = [...tp.children];
    parts = parts.filter(p => p !== g && !parts.some(q => q !== p && q.contains(p))).filter(p => { const r = p.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; });
    const all = [];
    parts.slice(0, 8).forEach((p, j) => {
      const d = 100 + Math.min(j, 4) * 30;
      p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: d, fill: 'backwards', easing: 'ease-out' });
      // 4. its labels decode as it comes up (the map has its own life: it is left alone)
      if (p.classList.contains('fr-table') || p.closest('.fr-table')) return;
      [...(p.matches(TFX_LABELS) ? [p] : []), ...p.querySelectorAll(TFX_LABELS)]
        .filter(el => !el.children.length && !el.closest('svg, .dg, [data-clock], [data-count], .clock, .fr-table') && /[A-Za-z0-9]/.test(el.textContent) && el.textContent.trim().length <= 48 && el.getBoundingClientRect().top < window.innerHeight)
        .slice(0, 12).forEach((el, k) => all.push({ el, d: d + 10 + k * 15 }));
    });
    const t0 = performance.now();
    requestAnimationFrame(() => { const lag = performance.now() - t0; tfxDecode(all.slice(0, 40).map(x => ({ el: x.el, d: Math.max(0, x.d - lag) }))); });
  }
  function tfxDecode(list) {
    if (!list.length) return;
    const now = performance.now();
    // write: every label as words of characters, with real spaces between the words
    const jobs = list.map(({ el, d }) => {
      const txt = el.textContent;
      el.innerHTML = '<span class="dcb">' + txt.split(' ').map(w => `<span class="dcw">${[...w].map(ch => `<span class="dc">${esc(ch)}</span>`).join('')}</span>`).join(' ') + '</span>';
      return { el, d, txt };
    });
    // read: every character's final width, in one pass
    jobs.forEach(j => { j.sp = [...j.el.querySelectorAll('.dc')]; j.w = j.sp.map(x => x.getBoundingClientRect().width); });
    // write: the widths fixed, the timings set
    jobs.forEach(j => {
      const chars = [...j.txt].filter(ch => ch !== ' '), n = j.txt.length, m = j.sp.length, long = n > 18, span = long ? 120 : Math.min(160, 70 + n * 5), t0 = now + j.d;
      j.sp.forEach((x, k) => { x.style.width = j.w[k] + 'px'; });
      j.chars = chars; j.kind = chars.map(ch => /[0-9]/.test(ch) ? TFX_DIG : /[A-Za-z]/.test(ch) ? TFX_LET : null);
      // each character locks roughly left to right, with a little chance in its timing
      j.lock = j.sp.map((x, k) => t0 + 30 + (m > 1 ? k / (m - 1) : 0) * span * .75 + Math.random() * span * .25);
      j.open = j.kind.map(Boolean); j.left = j.open.filter(Boolean).length; j.t0 = t0;
      if (long) j.el.classList.add('dlong');
      j.sp.forEach((x, k) => { if (j.kind[k]) { x.classList.add('scr'); x.textContent = ' '; } });
      tfxJobs.push(j);
    });
    if (!tfxRaf) tfxRaf = requestAnimationFrame(tfxStep);
  }
  function tfxStep(t) {
    tfxRaf = 0;
    // a new character every 45 ms, not every frame: noise that reads as noise
    const swap = t - tfxLast > 45; if (swap) tfxLast = t;
    for (let q = tfxJobs.length - 1; q >= 0; q--) {
      const j = tfxJobs[q];
      if (!j.el.isConnected) { tfxJobs.splice(q, 1); continue; }
      for (let k = 0; k < j.sp.length; k++) {
        if (!j.open[k]) continue;
        const x = j.sp[k];
        if (t >= j.lock[k]) { x.textContent = j.chars[k]; x.classList.remove('scr'); j.open[k] = false; j.left--; continue; }
        if (swap && t >= j.t0) { const set = j.kind[k]; x.textContent = set[(Math.random() * set.length) | 0]; }
      }
      // done: the plain text back, nothing left behind
      if (j.left <= 0) { j.el.textContent = j.txt; j.el.classList.remove('dlong'); tfxJobs.splice(q, 1); }
    }
    if (tfxJobs.length) tfxRaf = requestAnimationFrame(tfxStep);
  }
