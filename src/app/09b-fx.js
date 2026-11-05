  /* ---------- the game's motion (2 Nov 2026) ----------
     Decoration only, built so that it never costs a reading: it runs only with full animations on (Settings,
     and the system's reduced-motion preference); it moves only transform and opacity; every piece starts
     from the final text or number and lasts well under a second; nothing waits on it, and nothing animates
     after a key press (keys are used many times a minute). */
  const fxOn = () => !reduced();
  const finePointer = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : { matches: false };
  let viaKeys = false;
  document.addEventListener('keydown', () => { viaKeys = true; }, true);
  document.addEventListener('pointerdown', () => { viaKeys = false; }, true);

  // The destination is readable from the first frame; only a decorative underline moves.
  const revealed = new Set();
  function revealCall(view, entry) {
    const head = view.querySelector('.call-head');
    const id = String(entry ? entry.a.id : 'none');
    if (!head || revealed.has(id)) return;
    revealed.add(id);
    if (!fxOn() || viaKeys) return;
    head.classList.add('signal-in');
    setTimeout(() => head.classList.remove('signal-in'), 600);
  }

  // 2. The tab underline slides from the tab you left to the one you picked (pointer only).
  const tabInk = {};
  function slideTabInk(view) {
    view.querySelectorAll('.order').forEach(o => {
      const id = o.dataset.order, sel = o.querySelector('.tab[aria-selected="true"]');
      if (!sel) return;
      const r = sel.getBoundingClientRect(), was = tabInk[id];
      tabInk[id] = { tab: sel.dataset.tab, x: r.left, w: r.width };
      if (!fxOn() || viaKeys || !was || was.tab === sel.dataset.tab || !sel.animate) return;
      try {
        sel.animate([{ transform: `translateX(${(was.x - r.left).toFixed(1)}px) scaleX(${(was.w / r.width).toFixed(3)})`, transformOrigin: 'left center' },
          { transform: 'none', transformOrigin: 'left center' }], { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', pseudoElement: '::after' });
      } catch { /* pseudo-element animation not supported */ }
    });
  }

  // 3. A light follows the pointer across the panels, like the war table's glass. Eased, never snapped.
  // only on panels that are buttons: the light says "this can be pressed"
  const GLARE = '.otab, .planet-btn, .sb-key button, .glance-btn';
  let glEl = null, glRaf = 0;
  const gl = { x: .5, y: .5, tx: .5, ty: .5, w: 0, h: 0 };
  function glFrame() {
    glRaf = 0;
    if (!glEl) return;
    gl.x += (gl.tx - gl.x) * .2; gl.y += (gl.ty - gl.y) * .2;
    const light = glEl.querySelector(':scope > .fx-glare');
    if (light) light.style.transform = `translate(${(gl.x * gl.w - 110).toFixed(1)}px, ${(gl.y * gl.h - 110).toFixed(1)}px)`;
    if (Math.abs(gl.tx - gl.x) > .002 || Math.abs(gl.ty - gl.y) > .002) glRaf = requestAnimationFrame(glFrame);
  }
  function glLeave() {
    if (!glEl) return;
    const g = glEl.querySelector(':scope > .fx-glare');
    glEl.classList.remove('glare-on'); glEl = null;
    if (g) { g.classList.add('out'); setTimeout(() => g.remove(), 260); }
  }
  document.addEventListener('pointermove', (e) => {
    if (!fxOn() || !finePointer.matches || e.pointerType !== 'mouse') return;
    const el = e.target.closest ? e.target.closest(GLARE) : null;
    if (!el) { glLeave(); return; }
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    if (el !== glEl) {
      glLeave();
      glEl = el; el.classList.add('glare-on');
      if (!el.querySelector(':scope > .fx-glare')) el.insertAdjacentHTML('beforeend', '<i class="fx-glare" aria-hidden="true"></i>');
      gl.x = gl.tx = x; gl.y = gl.ty = y;
    }
    gl.tx = x; gl.ty = y; gl.w = r.width; gl.h = r.height;
    if (!glRaf) glRaf = requestAnimationFrame(glFrame);
  }, { passive: true });
  document.addEventListener('pointerleave', glLeave);
  window.addEventListener('blur', glLeave);

  // 4. While the first data loads, the skeleton is a Ministry terminal: the lines appear as they would in
  //    game. It only fills a wait that already exists; it is gone the moment the call is ready.
  (function bootLines() {
    const note = $('sk-note');
    if (!note || !$('skeleton')) return;
    const lines = t('fxBoot');
    if (!Array.isArray(lines)) return;
    const box = document.createElement('ol');
    box.className = 'sk-term'; box.setAttribute('aria-hidden', 'true');
    note.after(box);
    let i = 0;
    const next = () => {
      if (!box.isConnected || i >= lines.length) return;
      box.insertAdjacentHTML('beforeend', `<li>${esc(lines[i++])}</li>`);
      setTimeout(next, fxOn() ? 380 : 0);
    };
    next();
  })();

  function fxAfterRender(view, entry) {
    if (glEl && !document.contains(glEl)) glEl = null;
    slideTabInk(view);
    revealCall(view, entry);
  }
