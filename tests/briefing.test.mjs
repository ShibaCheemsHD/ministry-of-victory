// Goals in the launch briefing vs the order as it stands ("goals cut / raised since launch").
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const E = createRequire(import.meta.url)('../src/engine.js');
const kill = (f, goal, enemy = 0, item = 0) => ({ type: 3, values: [f, 0, goal, enemy, item ? 1 : 0, item, 0, 0, 0, 0], valueTypes: [1, 2, 3, 4, 6, 5, 8, 9, 11, 12] });
const samples = (f, goal) => ({ type: 2, values: [f, 0, goal, 1, 3992382197, 0, 0, 0, 0], valueTypes: [1, 2, 3, 6, 5, 8, 9, 11, 12] });

test('kill counts per faction are read from the launch text', () => {
  assert.deepEqual(E.briefingGoals('The Helldivers are ordered to kill 300,000,000 Terminids, 65,000,000 Illuminates, and 50,000,000 Automatons to ensure this story is told.'),
    { Terminids: 300e6, Illuminate: 65e6, Automaton: 50e6 });
  assert.deepEqual(E.briefingGoals('Helldivers are ordered to liberate SENGE 23 and eliminate 400,000,000 Illuminate hostiles.'), { Illuminate: 400e6 });
});

test('Democratic Sniper: goals halved after launch are found', () => {
  const tasks = [kill(2, 150e6, 0, 3827587060), kill(4, 32.5e6, 0, 376960160), kill(3, 50e6, 0, 2197477188)];
  assert.deepEqual(E.briefingDiff('The Helldivers are ordered to kill 300,000,000 Terminids, 65,000,000 Illuminates, and 50,000,000 Automatons.', tasks),
    [{ i: 1, kind: 'goal', from: 300e6, to: 150e6 }, { i: 2, kind: 'goal', from: 65e6, to: 32.5e6 }]);
});

test('regression 31 Oct 2026: a sample count is not a kill goal (Interrogation Enhancement)', () => {
  const tasks = [samples(3, 35e6), kill(3, 60e6, 23741406)];
  for (const text of ['the Helldivers are ordered to acquire 60,000,000 Automaton samples and kill 35,000,000 Radicals.',
    'the Helldivers are ordered to acquire 35,000,000 Automaton samples and kill 60,000,000 Radicals.']) {
    assert.deepEqual(E.briefingGoals(text), {});
    assert.deepEqual(E.briefingDiff(text, tasks), []);
  }
});

test('kills of one enemy type are never compared with a faction-wide count', () => {
  assert.deepEqual(E.briefingDiff('Kill 35,000,000 Automatons.', [kill(3, 60e6, 23741406)]), []);
});
