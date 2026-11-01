// News of the Major Orders without opening the site (audit PO-04):
//  - feed.xml, an RSS feed on the data branch: a new order, and how each one ended;
//  - optionally the same news in a Discord channel, when the repository has a DISCORD_WEBHOOK secret.
// Built from what the recorder already keeps (hist.calls), so it needs no new requests.

const H = 3.6e6;
const SITE = 'https://shibacheemshd.github.io/ministry-of-victory/';
const VERDICT = { done: 'Done', ontrack: 'On track', effort: 'Needs a push', focus: 'Winnable', hard: 'Very hard', record: 'Needs a record',
  nearly_impossible: 'Nearly impossible', impossible: 'Impossible', failed: 'Failed', unknown: 'Analyzing' };

const xml = (s) => String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
// game texts carry markup like <i=3>…</i>: plain text only
const plain = (s) => String(s ?? '').replace(/<\/?[a-z]+(=[^>]*)?>/g, '').replace(/\s+/g, ' ').trim();
const short = (s, n = 90) => { const t = plain(s); const first = t.split(/(?<=[.!?])\s/)[0]; return (first.length <= n ? first : first.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'); };
const name = (c) => { const t = plain(c.title); return t && t.toUpperCase() !== 'MAJOR ORDER' ? t : short(c.brief) || 'Major Order'; };

// the news, newest first: { id, t, title, text }
export function feedItems(calls, now) {
  const out = [];
  for (const c of Object.values(calls || {})) {
    const start = c.firstSeen || c.start;
    if (start) out.push({ id: `mo-${c.id}-new`, t: start, title: `New Major Order: ${name(c)}`,
      text: [plain(c.brief), c.first && !c.first.late ? `Our first call: ${VERDICT[c.first.v] || c.first.v}.` : ''].filter(Boolean).join(' ') });
    if (c.result === 'won' || c.result === 'lost') out.push({ id: `mo-${c.id}-${c.result}`, t: c.resultT || c.last?.t || c.exp || now,
      title: `Major Order ${c.result}: ${name(c)}`,
      text: c.first && !c.first.late ? `We first called it ${VERDICT[c.first.v] || c.first.v}.` : '' });
  }
  return out.filter(x => isFinite(x.t)).sort((a, b) => b.t - a.t).slice(0, 40);
}

export function buildFeed(calls, now) {
  const items = feedItems(calls, now);
  const date = (t) => new Date(t).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>Ministry of Victory · Major Orders</title>
<link>${SITE}</link>
<description>Helldivers 2 Major Orders: when a new one starts and how each one ended, with the Ministry's forecast.</description>
<language>en</language>
<lastBuildDate>${date(now)}</lastBuildDate>
${items.map(x => `<item><title>${xml(x.title)}</title><link>${SITE}</link><guid isPermaLink="false">${xml(x.id)}</guid><pubDate>${date(x.t)}</pubDate><description>${xml(x.text)}</description></item>`).join('\n')}
</channel>
</rss>
`;
}

// Discord: each piece of news once; nothing older than 6 hours (no flood the day it is switched on)
export async function notifyDiscord(hist, now, webhook, send = fetch) {
  if (!webhook) return 0;
  const sent = new Set(hist.posted || []);
  const fresh = feedItems(hist.calls, now).filter(x => !sent.has(x.id) && now - x.t < 6 * H).reverse();
  let n = 0;
  for (const x of fresh) {
    try {
      const r = await send(webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ username: 'Ministry of Victory', allowed_mentions: { parse: [] },
          content: `**${x.title}**${x.text ? '\n' + x.text : ''}\n<${SITE}>`.slice(0, 1900) }) });
      if (!r.ok) break;
      sent.add(x.id); n++;
    } catch { break; }
  }
  // remembered for a while, so an item that leaves the list isn't posted again
  hist.posted = [...sent].slice(-200);
  return n;
}
