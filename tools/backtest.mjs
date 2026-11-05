// Offline historical check, with explicit data fingerprints and evaluation period.
// No fetching, credentials, fitting or changes to the dataset.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { liberationBacktest } from '../recorder/accuracy.mjs';
const args = process.argv.slice(2);
const [historyPath, resortPath] = args;
if (!historyPath || !resortPath) {
  console.error('Usage: node tools/backtest.mjs historydata.json resort.json [--engine engine.cjs] [--since YYYY-MM-DD] [--until YYYY-MM-DD]');
  process.exit(1);
}
const options = { since: Date.parse('2026-01-01T00:00:00Z'), until: Infinity };
let enginePath = fileURLToPath(new URL('../src/engine.js', import.meta.url));
for (let i = 2; i < args.length; i += 2) {
  const key = args[i], value = args[i + 1];
  if (!value || !['--engine', '--since', '--until'].includes(key)) throw new Error('Unknown or missing option: ' + key);
  if (key === '--engine') enginePath = path.resolve(value);
  else {
    const ms = Date.parse(value + 'T00:00:00Z');
    if (!Number.isFinite(ms)) throw new Error('Invalid date: ' + value);
    options[key.slice(2)] = ms;
  }
}
if (!(options.until > options.since)) throw new Error('until must be after since');
const read = file => {
  const bytes = fs.readFileSync(file);
  return { data: JSON.parse(bytes), sha256: createHash('sha256').update(bytes).digest('hex') };
};
const history = read(historyPath), resort = read(resortPath);
const E = createRequire(import.meta.url)(enginePath);
const result = liberationBacktest(history.data, resort.data, { ...options, E });
console.log(JSON.stringify({ inputs: { history: history.sha256, resort: resort.sha256,
  engine: createHash('sha256').update(fs.readFileSync(enginePath)).digest('hex'), archiveEnds: history.data.events.at(-1)?.time },
  evaluation: { since: new Date(options.since).toISOString(), until: Number.isFinite(options.until) ? new Date(options.until).toISOString() : null,
    scope: 'eligible completed liberations; retrospective, not prospective validation' }, result }, null, 2));
