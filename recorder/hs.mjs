// Past Major Orders with their exact objectives and progress over time, from the public records kept by
// helldiversstats.com (since May 2026): its order list and progress series (/api/v1/...), and each
// order's page for the raw objectives. Each finished order is fetched once and kept for good.
const BASE = 'https://www.helldiversstats.com';
const H = 3.6e6;
const HEAD = { 'User-Agent': 'ministry-of-victory (https://github.com/ShibaCheemsHD/ministry-of-victory)', Accept: '*/*' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchText(u) {
  const r = await fetch(u, { headers: HEAD, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.text();
}
// the site's times are written as UTC but are its server's clock, 5 hours behind (checked against the
// game's own expiry and the war log on every order from May to October 2026)
// If they ever fix their clock, the orders this recorder watched itself (exact start from the game) say so:
// the offset is re-measured on them, and 5 hours is only the fallback.
let OFFSET = 5 * H;
const at = (s) => Date.parse(String(s).replace(/Z$/, '') + 'Z') + OFFSET;

export async function loadHs(hist, now, { maxNew = 8 } = {}) {
  hist.hs ||= {};
  const list = JSON.parse(await fetchText(`${BASE}/api/v1/historical-major-orders?limit=500`));
  const offs = (list.items || []).map(x => { const o = hist.orders?.[String(x.orderId32)]; const raw = Date.parse(String(x.firstSeenAt).replace(/Z$/, '') + 'Z');
    return o && o.start && isFinite(raw) ? o.start - raw : null; }).filter(v => v != null && Math.abs(v) < 24 * H).sort((a, b) => a - b);
  if (offs.length) OFFSET = offs[offs.length >> 1];
  let fetched = 0;
  for (const x of list.items || []) {
    const id = String(x.orderId32);
    if (hist.hs[id]?.complete) continue;
    const start = at(x.firstSeenAt), last = at(x.lastSeenAt), exp = last + (Number(x.expiresInLastSeen) || 0) * 1000;
    if (now - last < 2 * H) continue;   // still running (or just ended): the recorder watches those live
    if (fetched >= maxNew) break;        // a few per run: the first backfill spreads over several runs
    fetched++;
    try {
      const page = await fetchText(`${BASE}/major-orders/${id}`);
      const tasks = [];
      for (const m of page.matchAll(/type=(\d+)\s+values=\[([^\]]*)\]\s+valueTypes=\[([^\]]*)\]/g)) {
        if (tasks.length >= (x.taskCount || 99)) break;
        tasks.push({ type: Number(m[1]), values: m[2].split(',').map(Number), valueTypes: m[3].split(',').map(Number) });
      }
      await sleep(1500);
      const pts = [];
      for (let pg = 1; pg <= 10; pg++) {
        const j = JSON.parse(await fetchText(`${BASE}/api/v1/historical-major-orders/${id}/progress?limit=2000&page=${pg}`));
        for (const p of j.items || []) { try { pts.push([at(p.timestamp), ...JSON.parse(p.progress)]); } catch { } }
        await sleep(1500);
        if (pg >= (j.totalPages || 1)) break;
      }
      pts.sort((a, b) => a[0] - b[0]);
      // every point of the first 30 hours (the day-one checks), then one an hour
      const keep = []; let lastKept = 0;
      for (const p of pts) if (p[0] <= start + 30 * H || p[0] - lastKept >= H || p === pts[pts.length - 1]) { keep.push(p); lastKept = p[0]; }
      hist.hs[id] = { id, kind: String(x.title || ''), flags: Number(x.flags) || 0, brief: String(x.brief || '').slice(0, 600), start, last, exp, tasks, pts: keep, complete: tasks.length > 0 };
    } catch (e) { console.log('::warning::helldiversstats ' + id + ': ' + String(e).slice(0, 160)); }
  }
  return fetched;
}
