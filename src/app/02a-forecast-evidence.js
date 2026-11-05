  // Evidence coverage only: never alters the forecast or implies a calibrated win probability.
  function forecastEvidence(res, ctx) {
    if (!res || res.ended || ['done', 'failed'].includes(res.verdict)) return null;
    const reasons = new Set(); let level = 2;
    const mark = (n, why) => { level = Math.min(level, n); reasons.add(why); };
    const now = ctx.now, H = 3600e3;
    if (ctx.customized) mark(1, 'custom');
    if (!Number.isFinite(now)) return { level: 0, reasons: ['missing'] };
    if (ctx.stale || ctx.seeded || !Number.isFinite(ctx.updated) || now - ctx.updated > 15 * 60e3 || ctx.updated > now) mark(0, 'stale');
    const points = (read, hours, since = -Infinity) => {
      const byTime = new Map();
      for (const s of ctx.samples || []) {
        if (!s || !Number.isFinite(s.t) || s.t > now || s.t < Math.max(now - hours * H, since)) continue;
        const v = read(s);
        if (v != null && Number.isFinite(v.h) && v.h >= 0) byTime.set(s.t, { ...v, t: s.t });
      }
      return [...byTime.values()].sort((a, b) => a.t - b.t);
    };
    const coverage = (pts, matureHours, matureCount) => {
      if (pts.length < 2 || now - pts.at(-1).t > 15 * 60e3) { mark(0, 'history'); return; }
      const span = (pts.at(-1).t - pts[0].t) / H;
      if (span < 1 || pts.length < 4) mark(0, 'short');
      else if (span < matureHours || pts.length < matureCount) mark(1, 'growing');
      if (pts.some((x, i) => i && x.t - pts[i - 1].t > 45 * 60e3)) mark(1, 'gaps');
    };
    const model = () => {
      if (ctx.customized || ctx.capSrc === 'capManual') mark(1, 'custom');
      else if (!['kMeasured', 'kRecord'].includes(ctx.capSrc)) mark(1, 'reference');
    };
    const planet = (r) => {
      model(); const p = r.planet;
      if (!p) { mark(0, 'missing'); return; }
      const since = p.event?.startTime ? Date.parse(p.event.startTime) : -Infinity;
      const pts = points(s => s.planets?.[p.index], 6, Number.isFinite(since) ? since : -Infinity);
      coverage(pts, 5, 12);
      if (r.pw?.hasRegions) mark(1, 'regions');
      if (r.defense ? !(r.defense.observed?.net > 0) : !r.fc?.localC) mark(1, 'model');
      const max = p.event?.maxHealth || p.maxHealth;
      if (pts.some((x, i) => i && max > 0 && Math.abs(x.h - pts[i - 1].h) > .03 * max)) mark(1, 'changes');
      if (pts.some((x, i) => i && now - x.t <= 90 * 60e3 && Number.isFinite(x.r) && Number.isFinite(pts[i - 1].r) && Math.abs(x.r - pts[i - 1].r) > 1e-8)) mark(1, 'changes');
      const fc = r.fc;
      if (fc && fc.local != null && fc.global != null && fc.local !== fc.global &&
        (!Number.isFinite(fc.local) || !Number.isFinite(fc.global) || Math.max(fc.local, fc.global) > 1.5 * Math.min(fc.local, fc.global))) mark(1, 'pace');
    };
    const active = (res.anyOf ? [res.tasks?.[res.pick]] : res.tasks || []).filter(r => r && r.verdict !== 'done');
    if (!active.length || res.verdict === 'unknown') mark(0, 'missing');
    for (const r of active) {
      if (r.libN) {
        mark(1, 'selection');
        if (!r.libN.pick?.length) mark(0, 'missing');
        for (const target of r.libN.pick || []) planet(target);
      } else if (r.counter && !r.simpleCount) {
        const primary = r.primary, recent = r.rates?.recent;
        const pts = points(s => { const v = s.prog?.[ctx.progKey]?.[r.idx]; return Number.isFinite(v) ? { h: v } : null; }, 26, ctx.start || -Infinity);
        coverage(pts, 20, 12);
        if (!primary || !Number.isFinite(primary.rate) || primary.rate < 0) mark(0, 'missing');
        else if (r.early || primary.hours < 3) mark(0, 'short');
        else if (primary.kind !== 'day') mark(1, 'cycle');
        if (!recent || recent.hours < .5) mark(1, 'recent');
        else if (primary && Number.isFinite(primary.rate) && Number.isFinite(recent.rate) &&
          Math.max(primary.rate, recent.rate) > 1.5 * Math.min(primary.rate, recent.rate)) mark(1, 'pace');
        if (pts.some((x, i) => i && x.h < pts[i - 1].h)) mark(1, 'changes');
      } else if (r.planet && (r.pw || r.defense)) planet(r);
      else mark(0, r.simpleCount ? 'future' : 'missing');
    }
    if (level === 2) reasons.add('observed');
    return { level, reasons: [...reasons] };
  }
  const evidenceOpen = Object.create(null);
  function forecastEvidenceHTML(res, a) {
    const e = forecastEvidence(res, { now: Date.now(), updated: last.now, samples, capSrc: last.capSrc,
      stale: last.stale, seeded: last.seeded, customized: customModel(), progKey: orderKey(a), start: last.results.find(x => x.res === res)?.start });
    if (!e) return '';
    const id = esc(String(res.id));
    return `<details class="forecast-evidence" data-evidence="${id}"${evidenceOpen[res.id] ? ' open' : ''}>
      <summary id="evidence-${id}"><span class="fe-title">${ICON.data}${esc(t('evidence.title'))}</span><span class="fe-level">${esc(t('evidence.levels')[e.level])}</span>${ICON.chev}</summary>
      <div class="fe-body"><ul>${e.reasons.map(r => `<li>${esc(t('evidence.why.' + r))}</li>`).join('')}</ul><p>${esc(t('evidence.note'))}</p></div>
    </details>`;
  }
