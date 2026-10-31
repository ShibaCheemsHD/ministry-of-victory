// What each Super Earth dispatch announces, read from its headline. The cases are real headlines from the
// war log since February 2024; the regressions at the bottom are bugs that reached the live site once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const E = createRequire(import.meta.url)('../src/engine.js');

const HEADLINES = [["MAJOR ORDER WON","win"],["MAJOR ORDER FAILED","loss"],["MAJOR ORDER LOST","loss"],["NEW MAJOR ORDER","order"],["MAJOR ORDER UPDATE","order"],["NEW STRATEGIC OPPORTUNITY","order"],["STRATEGIC OPPORTUNITY SEIZED","so"],["STRATEGIC OPPORTUNITY LOST","solost"],["STRATEGIC OPPORTUNITY","order"],["STRATEGIC IMPERATIVE SEIZED","win"],["STRATEGIC IMPERATIVE FAILED","loss"],["STRATEGIC IMPERATIVE MET","win"],["NEW STRATEGIC IMPERATIVE","order"],["STRATEGIC DIRECTIVE COMPLETED","win"],["HEETH DEFENDED","win"],["TURING SECURED","win"],["77TH RESCUED","win"],["MALEVELON CREEK LIBERATED","win"],["ACHERNAR SECUNDUS FALLEN","loss"],["MATAR BAY HAS FALLEN","loss"],["OP SWIFT DISASSEMBLY, PHASE II—FAILED","loss"],["OP SWIFT DISASSEMBLY, PHASE III—COMPLETED","win"],["ARSENAL AUGMENTATION","gear"],["ARSENAL AUGMENTATION ENDED","gear"],["STRATAGEM GRANTED","gear"],["EXOSUIT COOLDOWN INCREASE","gear"],["COMMEMORATIVE CAPE","gear"],["MEGACITY UNDER ATTACK","threat"],["GLOOM SPREAD DETECTED","threat"],["INCURSION ALERT","threat"],["PREDATOR STRAIN OUTBREAK","threat"],["AUTOMATON COUNTERATTACK","threat"],["STRATEGIC UPDATE","info"],["THIS DAY IN DEMOCRACY","info"],["DSS STATUS UPDATE","info"],["VOTING HAS BEGUN","info"],["DENIAL OF RESURGENCE VOTING CONCLUDED","info"],["MEGACITY NEARING COLLAPSE","info"],["ILLUMINATE NEARING DEFEAT","info"],["IMPACT STABILIZED","info"]];

test('real headlines get the right kind', () => {
  for (const [h, k] of HEADLINES) assert.equal(E.dispatchKind(h, 'Story text that mentions victory, defeat, weapons and an attack.').kind, k, h);
});

test('the body never decides when there is a headline', () => {
  assert.equal(E.dispatchKind('THIS DAY IN DEMOCRACY', 'Malevelon Creek was liberated after a heroic defense.').kind, 'info');
  assert.equal(E.dispatchKind('STRATEGIC UPDATE', 'The Automatons have fallen back.').kind, 'info');
});

test('headline and text split, in every format the game and the war log use', () => {
  assert.deepEqual(E.splitDispatch('<i=3>MAJOR ORDER WON</i>\n\nThe Helldivers have done it.'), { title: 'MAJOR ORDER WON', body: 'The Helldivers have done it.' });
  assert.equal(E.splitDispatch('NEW MAJOR ORDER\nHold the line.').title, 'NEW MAJOR ORDER');
  assert.equal(E.splitDispatch('NEW MAJOR ORDER. The Helldivers are ordered to hold.').title, 'NEW MAJOR ORDER');
  assert.equal(E.splitDispatch('NEW MAJOR ORDER The Illuminate have launched an attack.').title, 'NEW MAJOR ORDER');
  assert.equal(E.splitDispatch('Untitled dispatch with no headline at all, just text.').title, '');
  assert.equal(E.splitDispatch('<i=3></i>\n\nEmpty headline.').title, '');
});

test('Super Earth\'s word on a Major Order comes from the headline only', () => {
  assert.equal(E.moOutcome('<i=3>MAJOR ORDER WON</i>\n\nDone.'), 'won');
  assert.equal(E.moOutcome('<i=3>MAJOR ORDER FAILED</i>\n\nNot done.'), 'lost');
  assert.equal(E.moOutcome('<i=3>NEW MAJOR ORDER</i>\n\nAfter the last major order failed, High Command...'), null);
  assert.equal(E.moOutcome('<i=3>STRATEGIC UPDATE</i>\n\nThe major order was won by the Helldivers.'), null);
  assert.equal(E.moOutcome('MAJOR ORDER WON The Helldivers have defended the planet.'), 'won');
});

// --- regressions ---
test('regression 31 Oct 2026: a NEW Strategic Opportunity is not an "opportunity missed"', () => {
  for (const h of ['NEW STRATEGIC OPPORTUNITY', 'STRATEGIC OPPORTUNITY']) {
    const k = E.dispatchKind(h, 'Securing this intel could make the difference. Success depends on you.');
    assert.equal(k.kind, 'order'); assert.equal(k.so, 'new');
  }
  assert.equal(E.dispatchKind('STRATEGIC OPPORTUNITY SEIZED', '').so, 'won');
  assert.equal(E.dispatchKind('STRATEGIC OPPORTUNITY LOST', '').so, 'lost');
});
test('regression 31 Oct 2026: "MAJOR ORDER WON" is a victory, not a new order', () => {
  assert.equal(E.dispatchKind('MAJOR ORDER WON', '').kind, 'win');
});
