  /* ---------- holographic interface (Nov 2026) ----------
     Everything here is decoration: it runs only with full animations on (Settings, and the system's
     reduced-motion preference), only animates transform / opacity, and never delays a click. */
  const fxOn = () => !reduced();
  const finePointer = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : { matches: false };

  // 1. Holo panels: a light that follows the pointer, and a slight tilt towards it, on the cards that
  //    carry the order (order of the day, forecast, side cards). Positions are eased, not snapped.
  const HOLO = '.directive, .rail-card, .objective, .hist-card, .acc-card';
  let holoEl = null, holoRaf = 0;
  const holo = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  function holoFrame() {
    holoRaf = 0;
    if (!holoEl) return;
    holo.x += (holo.tx - holo.x) * 0.18; holo.y += (holo.ty - holo.y) * 0.18;
    holoEl.style.setProperty('--mx', (holo.x * 100).toFixed(1) + '%');
    holoEl.style.setProperty('--my', (holo.y * 100).toFixed(1) + '%');
    // small cards tilt towards the pointer; the order of the day doesn't (its planet card is pinned to the
    // screen, and a transformed parent would carry it along), long rows only a hair
    const k = holoEl.classList.contains('directive') ? 0 : holoEl.classList.contains('objective') ? 0.5 : 1.6;
    if (k) holoEl.style.transform = `perspective(1100px) rotateX(${((0.5 - holo.y) * k).toFixed(2)}deg) rotateY(${((holo.x - 0.5) * k).toFixed(2)}deg)`;
    if (Math.abs(holo.tx - holo.x) > 0.001 || Math.abs(holo.ty - holo.y) > 0.001) holoRaf = requestAnimationFrame(holoFrame);
  }
  function holoLeave() {
    if (!holoEl) return;
    const el = holoEl; holoEl = null;
    el.classList.remove('holo-on');
    el.style.transform = '';
    const g = el.querySelector(':scope > .holo-glare'); if (g) { g.classList.add('out'); setTimeout(() => g.remove(), 300); }
  }
  document.addEventListener('pointermove', (e) => {
    if (!fxOn() || !finePointer.matches || e.pointerType !== 'mouse') return;
    const el = e.target.closest ? e.target.closest(HOLO) : null;
    if (!el) { holoLeave(); return; }
    if (el !== holoEl) {
      holoLeave();
      holoEl = el; el.classList.add('holo-on');
      if (!el.querySelector(':scope > .holo-glare')) el.insertAdjacentHTML('beforeend', '<i class="holo-glare" aria-hidden="true"></i>');
      const r0 = el.getBoundingClientRect();
      holo.x = holo.tx = (e.clientX - r0.left) / r0.width; holo.y = holo.ty = (e.clientY - r0.top) / r0.height;
    }
    const r = el.getBoundingClientRect();
    holo.tx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    holo.ty = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    if (!holoRaf) holoRaf = requestAnimationFrame(holoFrame);
  }, { passive: true });
  document.addEventListener('pointerleave', holoLeave);
  window.addEventListener('blur', holoLeave);

  // 2. The tab underline slides from the tab you left to the one you picked (FLIP on the hatch).
  const tabInk = {};
  function slideTabInk(root) {
    root.querySelectorAll('.order').forEach(o => {
      const id = o.dataset.order, sel = o.querySelector('.tab[aria-selected="true"]');
      if (!sel) return;
      const r = sel.getBoundingClientRect(), was = tabInk[id];
      tabInk[id] = { tab: sel.dataset.tab, x: r.left, w: r.width };
      if (!fxOn() || !was || was.tab === sel.dataset.tab || !sel.animate) return;
      try {
        sel.animate([{ transform: `translateX(${(was.x - r.left).toFixed(1)}px) scaleX(${(was.w / r.width).toFixed(3)})`, transformOrigin: 'left center' },
          { transform: 'translateX(0) scaleX(1)', transformOrigin: 'left center' }], { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', pseudoElement: '::after' });
      } catch {}
    });
  }

  // 3. Scan sweep: the order of the day gets one pass of the scanner when it changes or first shows.
  const scanned = {};
  function scanSweep(root, entry) {
    const d = root.querySelector('.directive');
    if (!d || !fxOn()) return;
    // behind the boot screen nobody would see it: wait until it has gone
    const boot = $('boot');
    if (boot && !boot.classList.contains('out')) { setTimeout(() => scanSweep(root, entry), 400); return; }
    const key = String(entry?.a?.id) + ':' + (d.querySelector('[data-decrypt]')?.dataset.decrypt || '');
    if (scanned[key]) return;
    scanned[key] = true;
    d.style.setProperty('--scan-h', d.offsetHeight + 'px');
    d.classList.remove('scan'); void d.offsetWidth; d.classList.add('scan');
    setTimeout(() => d.classList.remove('scan'), 1600);
  }

  function fxAfterRender(entry, firstTime) {
    const view = $('view');
    if (!view) return;
    // a re-render replaces the element under the pointer: start the light again on the new one
    if (holoEl && !document.contains(holoEl)) { holoEl = null; }
    slideTabInk(view);
    scanSweep(view, entry);
  }
