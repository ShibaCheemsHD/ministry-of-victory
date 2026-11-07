// Before a retrained model is published: the engine itself must accept it and give the same chances as
// scikit-learn did (fixture written by retrain.py), and more time left must never lower a chance.
// Usage: node verify.mjs REPO MODEL_JSON FIXTURE_JSON
//        node verify.mjs REPO --current OUT_JSON   (writes the model the engine ships, for retrain.py)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const [REPO, a, b] = process.argv.slice(2);
const E = createRequire(import.meta.url)(REPO + '/src/engine.js');
if (a === '--current') { fs.writeFileSync(b, JSON.stringify(E.chanceModel())); process.exit(0); }
const model = JSON.parse(fs.readFileSync(a, 'utf8')), fx = JSON.parse(fs.readFileSync(b, 'utf8'));
const die = (m) => { console.log('::error::' + m); process.exit(1); };
if (!E.useChanceModel(model)) die('the engine refuses the new model');
let worst = 0;
for (const r of fx) worst = Math.max(worst, Math.abs(E.chanceOf(r.x.map(v => v == null ? NaN : v)) - r.p));
if (!(worst < 1e-6)) die('the engine and scikit-learn disagree by ' + worst);
// monotone in the time left, on the fixture's cases
for (const r of fx) {
  let last = -1;
  for (const H of [6, 12, 24, 48, 96, 168]) {
    const x = r.x.slice(), d = Math.log(H) - x[0];
    x[0] = Math.log(H); for (const i of [1, 2, 3]) if (x[i] != null) x[i] -= d;
    const p = E.chanceOf(x.map(v => v == null ? NaN : v));
    if (p < last - 1e-12) die('a longer deadline lowered a chance');
    last = p;
  }
}
console.log(`ok: ${fx.length} cases, largest gap ${worst.toExponential(1)}, ${model.trees.length} trees`);
