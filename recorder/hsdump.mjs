// One-off: saves every finished order from helldiversstats.com (objectives + progress) for study.
import fs from 'fs';
import { loadHs } from './hs.mjs';
const out = process.argv[2] || 'probe'; fs.mkdirSync(out, { recursive: true });
const hist = {};
const n = await loadHs(hist, Date.now(), { maxNew: 200 });
fs.writeFileSync(out + '/hs.json', JSON.stringify(hist.hs));
console.log('orders', n, Object.values(hist.hs).filter(x => x.complete).length);
