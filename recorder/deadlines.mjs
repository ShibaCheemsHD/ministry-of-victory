// A short observed-pace comparator inspired by War Monitor. Ignore the newest interval.
// At least three distinct HP readings with timestamps in the preceding six hours are needed.
const HOUR = 3600000;
export function paceCall(points, remainingHP, hoursLeft) {
  if (!Number.isFinite(remainingHP) || remainingHP <= 0 || !(hoursLeft > 0)) return null;
  const window = points.filter(p => Number.isFinite(p.h) && Number.isFinite(p.t)).slice(-3);
  if (window.length < 3) return null;
  const [a, b, latest] = window;
  if (b.t <= a.t || latest.t <= b.t || latest.t - a.t > 6 * HOUR) return null;
  return (a.h - b.h) * HOUR / (b.t - a.t) * hoursLeft >= remainingHP;
}

export function recordDeadlines(call, tasks, samples, now) {
  for (const hours of [24, 12, 6]) {
    const cutoff = call.exp - hours * HOUR;
    if (now > cutoff || now < cutoff - HOUR) continue;
    for (const r of tasks) {
      if (r.task.type !== 11 || !r.planet) continue;
      const index = r.planet.index;
      const key = [call.exp,index,hours].join(':');
      const records = call.deadlineChecks ||= {};
      if (records[key]?.t > now) continue;
      // A planet completed before the checkpoint no longer needs a call.
      if (!r.pw || !(r.eta > 0)) { delete records[key]; continue; }
      const left = (call.exp-now)/HOUR;
      const points = samples.filter(s=>s.t <= now && s.t >= now-6*HOUR && s.planets?.[index]?.h != null)
        .map(s=>({t:s.t,h:s.planets[index].h}));
      records[key] = {t:now, exp:call.exp, index, hours, task:r.idx, byDeadline:r.eta <= left,
        pace:r.pw.hasRegions ? null : paceCall(points,r.planet.health,left)};
    }
  }
}

export function deadlineScores(calls, E) {
  const scores = Object.fromEntries([24,12,6].map(h => [h,{correct:0,falseWins:0,missedWins:0,unknown:0,paired:0,pairedModelCorrect:0,pairedPaceCorrect:0}]));
  for (const call of Object.values(calls || {})) {
    if (!call.result) continue;
    for (const row of Object.values(call.deadlineChecks || {})) {
      const score = scores[row.hours], task = call.tasks?.[row.task];
      if (!score || !task || task.type !== 11 || row.exp !== call.exp || E.parseTask(task,0).planetIndex !== row.index) continue;
      const fell = call.track?.fell?.[row.index], progress = call.prog?.[row.task];
      const last = call.last?.t;
      const observedWin = fell > row.t && fell <= row.exp || progress >= 1 && last >= row.t && last <= row.exp;
      const observedLoss = progress === 0 && last <= row.exp && last >= row.exp - 20 * 60000;
      if (!observedWin && !observedLoss) { score.unknown++; continue; }
      if (observedWin === row.byDeadline) score.correct++;
      else if (row.byDeadline) score.falseWins++;
      else score.missedWins++;
      if (row.pace != null) {
        score.paired++;
        if (row.byDeadline === observedWin) score.pairedModelCorrect++;
        if (row.pace === observedWin) score.pairedPaceCorrect++;
      }
    }
  }
  return scores;
}
