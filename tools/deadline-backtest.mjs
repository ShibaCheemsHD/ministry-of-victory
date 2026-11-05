// Compare named liberation objectives at fixed checkpoints before the actual order deadline.
// Inputs: CrossWaveOmega historydata.json and resort.json, and the recorder history with hs orders.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { paceCall } from '../recorder/deadlines.mjs';
import { replayContext } from '../recorder/accuracy.mjs';
const E = createRequire(import.meta.url)('../recorder/engine.cjs');
const [history, resort, recorder] = process.argv.slice(2);
if (!recorder) throw new Error('Usage: node tools/deadline-backtest.mjs historydata.json resort.json recorder-history.json');
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const { P, playersAt, capacityAt, end } = replayContext(read(history), read(resort));
const H = 3600000;
const rows = [], skipped = {};
function skip(reason) { skipped[reason] = (skipped[reason] || 0) + 1; }
for (const order of Object.values(read(recorder).hs || {})) {
  if (!order.complete || !order.pts?.length || order.exp > end) continue;
  for (const [k, raw] of order.tasks.entries()) {
    const task = E.parseTask(raw, 0);
    if (task.type !== 11 || task.planetIndex == null) continue;
    const timeline = P[task.planetIndex] || [];
    for (const hours of [24, 12, 6]) {
      const cutoff = order.exp - hours * H;
      if (cutoff < order.start || cutoff > order.last) continue;
      const point = order.pts.findLast(x => x[0] <= cutoff);
      if (!point || point[k + 1] == null || cutoff - point[0] > 2 * H) { skip('missing objective reading'); continue; }
      if (point[k + 1] >= 1) continue;
      const past = timeline.filter(x => x.t <= cutoff);
      const state = past.at(-1);
      if (!state?.o || state.o === 'Humans' || state.reg) { skip('unknown owner, held, or regions'); continue; }
      const boundary = past.findLastIndex(x => x.o !== state.o || x.reg);
      const recent = past.slice(boundary + 1).filter(x => x.t >= cutoff - 24 * H);
      const hp = recent.filter(x => x.hpSet), at = hp.at(-1);
      if (!at || at.hp <= 0 || cutoff - at.t > 1.5 * H) { skip('no recent HP'); continue; }
      const N = playersAt(at.t), C = capacityAt(at.t);
      if (!(N > 0 && C > 0 && Number.isFinite(at.pl) && at.pl >= 0 && at.r != null)) { skip('missing capacity or resistance'); continue; }
      const observed = order.pts.filter(x => x[0] > cutoff && x[0] <= order.exp && x[k + 1] != null);
      const captured = timeline.some(x => x.t > cutoff && x.t <= Math.min(order.last, order.exp) && x.o === 'Humans');
      const won = captured || observed.some(x => x[k + 1] >= 1);
      if (!won && (!observed.length || order.exp - observed.at(-1)[0] > 20 * 60000)) { skip('unconfirmed outcome'); continue; }
      const samples = recent.filter(x => x.t <= at.t).map(x => ({ t: x.t, N: playersAt(x.t), planets: { [task.planetIndex]: { h: x.hpSet ? x.hp : null, p: x.pl, r: x.r } } }));
      const regen = at.r * 3600;
      const work = {work: at.hp, regionHP: 0, regen, activeRegen: regen, queue: [], hasRegions: false};
      const eta = E.forecastFall({index: task.planetIndex, maxHealth: at.max}, work, at.pl / N, C, 1, samples, at.t).eta;
      // Community-inspired benchmark on archived HP, whose cadence differs from War Monitor's.
      const left = (order.exp-at.t)/H;
      rows.push({order: order.id, planet: task.planetIndex, hours, won, model: eta <= left,
        pace: paceCall(hp.map(x=>({t:x.t,h:x.hp})), at.hp, left)});
    }
  }
}
function score(list, key) {
  return {n:list.length, correct:list.filter(x=>x[key]===x.won).length,
    falseWins:list.filter(x=>x[key]&&!x.won).length, missedWins:list.filter(x=>!x[key]&&x.won).length};
}
const results = [24,12,6].map(hours => {
  const group = rows.filter(x => x.hours === hours), paired = group.filter(x => x.pace != null);
  return {hours, all:score(group,'model'), pairedModel:score(paired,'model'), pairedPace:score(paired,'pace')};
});
console.log(JSON.stringify({orders:new Set(rows.map(x=>x.order)).size,results,skipped,rows},null,2));
