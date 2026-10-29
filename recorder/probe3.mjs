// One-off: saves pages and API answers from community war-history sites, to study what they keep.
import fs from 'fs';
const out = process.argv[2] || 'probe3'; fs.mkdirSync(out, { recursive: true });
const H = { 'User-Agent': 'ministry-of-victory (https://github.com/ShibaCheemsHD/ministry-of-victory)', Accept: '*/*', 'X-Super-Client': 'ministry-of-victory-probe', 'X-Super-Contact': 'https://github.com/ShibaCheemsHD/ministry-of-victory' };
const urls = (process.env.URLS || '').split(/\s+/).filter(Boolean);
let n = 0;
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(30000) });
    const t = await r.text();
    const f = `${out}/${String(++n).padStart(2, '0')}_${u.replace(/^https?:\/\//, '').replace(/[^a-z0-9.]+/gi, '_').slice(0, 80)}`;
    fs.writeFileSync(f, t);
    console.log(r.status, t.length, u, r.headers.get('content-type'));
  } catch (e) { console.log('ERR', u, e.message); }
  await new Promise(r => setTimeout(r, 1500));
}
