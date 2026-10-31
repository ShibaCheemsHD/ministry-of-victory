// The Italian dictionary has exactly the English keys, the same {placeholders} and the same markup,
// so no text can go missing or come out with a raw {name} in either language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const D = vm.runInNewContext(src('i18n.js') + '\n' + src('i18n.it.js') + '\n;({ TEXT, TEXT_IT, EXPLAIN, EXPLAIN_IT })');

const leaves = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' && !Array.isArray(v) ? leaves(v, p + k + '.') : [[p + k, v]]);
const get = (o, path) => path.split('.').reduce((x, k) => x?.[k], o);
const holes = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const tags = (s) => [...String(s).matchAll(/<\/?(\w+)/g)].map(m => m[0]).sort().join(',');

test('every English text has an Italian one, and nothing extra', () => {
  const en = leaves(D.TEXT).map(([k]) => k), it = leaves(D.TEXT_IT).map(([k]) => k);
  assert.deepEqual(en.filter(k => !it.includes(k)), [], 'missing in Italian');
  assert.deepEqual(it.filter(k => !en.includes(k)), [], 'only in Italian');
});

test('same shape, placeholders and markup in both languages', () => {
  for (const [k, v] of leaves(D.TEXT)) {
    const w = get(D.TEXT_IT, k);
    assert.equal(Array.isArray(w), Array.isArray(v), k + ' type');
    const a = Array.isArray(v) ? v : [v], b = Array.isArray(w) ? w : [w];
    assert.equal(b.length, a.length, k + ' length');
    a.forEach((s, i) => {
      assert.equal(typeof b[i], typeof s, `${k}[${i}] type`);
      assert.equal(holes(b[i]), holes(s), `${k}[${i}] placeholders`);
      assert.equal(tags(b[i]), tags(s), `${k}[${i}] markup`);
      if (s !== '') assert.notEqual(b[i], '', `${k}[${i}] empty`);
    });
  }
});

test('the field guide has the same entries', () => {
  const n = (s) => (s.match(/<dt>/g) || []).length;
  assert.equal(n(D.EXPLAIN_IT), n(D.EXPLAIN));
  assert.equal(tags(D.EXPLAIN_IT), tags(D.EXPLAIN));
});
