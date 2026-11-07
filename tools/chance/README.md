# The chance a planet falls in time

How the model in `src/engine.js` (`CHANCE`, `fallChance`) was built and checked, 7 Nov 2026.

1. `node features.mjs WAR_DIR ARCHIVE_JSON HISTORY_JSON REPO feat.csv`: every planet under liberation every 3 hours
   in the CrossWaveOmega war log (2024-26), with what was known then (HP left, regen, share of players and how
   it moved, pace over 1-24 h, the engine's forecast, straight-line extrapolations, order membership, DSS) and
   what happened (hours to the fall, or censored).
   WAR_DIR holds `historydata.json` and `resort.json` from CrossWaveOmega/helldiversplanettable; ARCHIVE_JSON and
   HISTORY_JSON are `archive.json` and `history.json` from the `data` branch.
2. `python3 model.py feat.csv`: the engine, straight lines, their average, logistic regression, gradient boosting
   per horizon, an AFT survival model (XGBoost) - fitted on 2024-25, scored on 2026 only.
3. `python3 model2.py feat.csv lean`: one gradient-boosted model for any deadline (the deadline is a feature,
   monotone), with calibration and the fall-time check. `check.py` and `rule.py`: against the strict
   "On track" rule, and a bootstrap over planets of the Brier gain.
4. `python3 export.py`: refit on all years, export the trees (`chance_model.json`) and a parity fixture
   (`tests/fixtures/chance-fixture.json`, checked by `tests/engine.test.mjs`).

Held-out 2026 (fitted on 2024-25), "does it fall within H hours?":

| | 24 h | 48 h | 72 h |
|---|---|---|---|
| right, engine verdict (eta <= H) | 91.8% | 85.5% | 81.9% |
| right, model | 93.6% | 89.4% | 86.3% |
| Brier, engine (calibrated) | 0.059 | 0.110 | 0.139 |
| Brier, model | 0.049 | 0.078 | 0.102 |

95% bootstrap intervals of the Brier gain (over planets): [0.005, 0.015], [0.024, 0.041], [0.028, 0.046].
"On track" with the model (in time, and slow end in time with a chance >= 50%, or a chance >= 90%), 2026,
2 days out: right 91% of the time instead of 86%, calling 80% of the falls instead of 82%; on order planets
unchanged. The fall time stays the engine's: it is better at it (52% within 25% against the model's 49%).
Tried and not kept: straight lines alone (fewer false wins, worse times), adding where freed players go
(more false wins), a survival model's median as the fall time (24% within 25%).
