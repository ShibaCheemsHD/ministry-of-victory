# Forecast review — 5 November 2026

## Changes supported by regressions

- Fit K and capacity using resistance recorded at each interval, falling back to current resistance only for legacy samples without it. A drop in resistance must not rewrite the inferred damage of previous missions. In the regression, historical net damage of 10k HP/h plus 20k HP/h resistance implies 30k gross HP/h. The old K fit used today's zero resistance and inferred only one third of the true capacity.
- Use the same DSS/Heavy Ordnance multiplier when computing defense need and ETA. At 500k HP, 10h left and 100k HP/h total capacity, DSS +10% and HOD x1.8 require 25.3% of the playerbase, rather than the old 45.5%. Away from that station, HOD x0.72 requires 69.4%, rather than 45.5%.
- Exclude samples after the forecast timestamp from observed pace and calibration. Count rates also reject pre-order samples and negative recent rates after a counter decrease. Missing/nonfinite HP cannot become zero HP through arithmetic coercion in calibration.
- Preserve the complete ETA uncertainty range in objective text, even when it extends beyond the Major Order deadline. Clipping the upper bound to the deadline understated uncertainty.
- Key retrospective capacity caches by the exact forecast cutoff. Previously the first horizon evaluated could supply a later same-day capacity to an earlier horizon. A regression checks invariance to horizon order.

No growth, shrinkage or uncertainty-band parameters were retuned.

## Replayed data

Inputs: the public CrossWaveOmega/helldiversplanettable files `src/data/historydata.json` and `src/data/resort.json`, fetched 5 November 2026. The downloaded archive ends 30 October 2026 at 21:36 UTC: these are not current live measurements. It contains 12130 events and 278 planet timelines. The 2026 eligible completed-liberation evaluation covers 56 distinct planet/fall combinations, with 32, 37 and 26 usable forecasts at the three horizons.

| Horizon | Original replay within 25% | Causal replay within 25% | Causal median absolute error | Causal interval coverage |
|---|---:|---:|---:|---:|
| 6h | 81% | 81% | 0.6h | 94% |
| 12h | 76% | 76% | 1.9h | 84% |
| 24h | 62% | 65% | 5.1h | 92% |

The change in the 24h score is caused by correcting the replay. Old and corrected engines obtain the same completed-liberation replay scores under the corrected evaluator: that evaluator supplies historical capacity directly, so it does not exercise the live K-calibration or defense fixes. The numerical examples above and regression tests validate those fixes; a broad real-world accuracy improvement remains to be measured prospectively.

Do not generalize these percentages to all Major Orders: the evaluation selects completed liberations with sufficient data and excludes stalled/failed campaigns, regional campaigns and defenses. The coefficients and bands have been evaluated repeatedly on this period, so it is not an untouched holdout. The live recorder's forecasts should be retained and checked on later outcomes before claiming a new model is better.

Reproduce with `node tools/backtest.mjs HISTORY RESORT`; the output contains SHA-256 fingerprints of both inputs and the engine. Use `--engine`, `--since` and `--until` for controlled comparisons. The script reads local files and does not change them.

## Existing tools and sources

- Community API: https://github.com/helldivers-2/api — source of live inputs, not a ground-truth forecast.
- War History Central: https://crosswaveomega.github.io/helldiversplanettable/get_game_data — historical outcomes and timelines used in the replay.
- Helldivers Stats API: https://www.helldiversstats.com/api-docs — documents planet history and diver series. Any series using Steam alone must not be substituted for the all-platform player count.

A next model experiment should compare current growth assumptions with a constant-pace baseline on identical eligible rows, use a fixed chronological fit/evaluation split, and report sample count, error and interval coverage separately for liberations, defenses and count objectives. Do not replace the current model merely because another site's ETA differs.
