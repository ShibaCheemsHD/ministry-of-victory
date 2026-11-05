  // The same update may arrive from browser history and the recorder, or in planet batches.
  // Compare event data, not translated titles; opposite changes and distinct times remain separate.
  function uniqueIntelEvents(events) {
    const out = [];
    for (const x of events) {
      const effect = x.kind === 'effect' || x.kind === 'active';
      const key = JSON.stringify(effect ? [x.kind, x.eid, x.type, x.on, x.v]
        : [x.kind, x.idx, x.order, x.from, x.to, x.pct, x.mins, x.attack, x.end, x.diff, x.ref]);
      const same = out.find(y => y.key === key && Number.isFinite(x.t) && Math.abs(y.item.t - x.t) <= 90e3);
      if (same && effect) same.item.planets = [...new Set([...(same.item.planets || []), ...(x.planets || [])])];
      else if (!same) out.push({ key, item: { ...x } });
    }
    return out.map(x => x.item);
  }
  function uniqueDispatches(list) {
    const out = [];
    for (const x of list) {
      if (!x) continue;
      const text = String(x.msg || '').trim().replace(/\s+/g, ' ');
      if (!out.some(y => x.id != null && String(y.id) === String(x.id) || text && text === String(y.msg || '').trim().replace(/\s+/g, ' ') && Number.isFinite(x.t) && x.t === y.t)) out.push(x);
    }
    return out;
  }
  // Correlate two observations from one recorder window, preserving both sources in one card.
  // Never merge different planets, distant changes, galaxy-wide settings or unrelated effect types.
  function mergeResistanceEvents(events) {
    const out = uniqueIntelEvents(events).map(x => ({ ...x, ...(x.resistanceEffects ? { resistanceEffects: [...x.resistanceEffects] } : {}) }));
    const numeric = out.filter(x => x.kind === 'regen' && Number.isFinite(x.t) && Number.isFinite(x.from) && Number.isFinite(x.to) && x.from !== x.to);
    const removed = new Set();
    for (const effect of out) {
      if (effect.kind !== 'effect' || ![74, 77].includes(effect.type) || !Number.isFinite(effect.t) || !Array.isArray(effect.planets)) continue;
      const unmatched = [];
      for (const idx of effect.planets) {
        const match = Number(idx) === -1 ? null : numeric.filter(x => String(x.idx) === String(idx) && Math.abs(x.t - effect.t) <= 12 * 60e3)
          .sort((a, b) => Math.abs(a.t - effect.t) - Math.abs(b.t - effect.t))[0];
        if (!match) { unmatched.push(idx); continue; }
        (match.resistanceEffects ||= []).push({ ...effect, planets: [idx] });
      }
      if (!unmatched.length) removed.add(effect);
      else if (unmatched.length !== effect.planets.length) effect.planets = unmatched;
    }
    return out.filter(x => !removed.has(x));
  }
  function unrepresentedEffectPlanets(effect, events) {
    return (effect.planets || []).filter(idx => !events.some(x =>
      x.kind === 'effect' && x.on && x.eid === effect.id && x.planets?.some(i => String(i) === String(idx)) ||
      x.resistanceEffects?.some(e => e.on && e.eid === effect.id && e.planets.some(i => String(i) === String(idx)))));
  }
