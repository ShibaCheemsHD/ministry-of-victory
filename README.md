# Ministry of Victory

**An unofficial tactical terminal for Helldivers 2 Major Orders.** Super Earth has a Ministry of Truth; this is the Ministry of Victory.
Open the page and it tells you, in one line, what the whole community should do right now to win the current Major Order, and how realistic winning is.

## What it does

- **Order of the day:** the single move that changes the outcome the most (which planet to focus, which defense to save, which front needs players).
- **Forecast:** from "On track" to "Impossible", based on planet health, regen, and how many Helldivers are on each planet.
- **When each planet falls**, with the range it will most likely land in. Retrospectively replayed on eligible 2026 liberations in the available archive (32 / 37 / 26 forecasts at 6 / 12 / 24 hours; not an independent prospective validation): within 25% of the real time 81% / 76% / 65% of the time 6 / 12 / 24 hours ahead, up from 72% / 65% / 52%; the range held the real fall 84-94% of the time. Kill and mission counts count the players a finished objective frees for the others: 81% called right a day in, up from 73%. The Archive keeps this track record up to date.
- **Plan:** every useful move ranked by importance, with what it changes ("Fury falls 1d 1h sooner").
- **What if…?:** drag a slider to see what happens with more or fewer players.
- **Numbers:** regen, break-even share, pace per hour, projections.
- Works for liberations, defenses, kill / mission / extraction counts, weapon-specific kills, "liberate N planets" and sector orders. Several orders at once are compared.

The page refreshes itself every minute.

**Following without opening the site:** new Major Orders and how each one ended, as an [RSS feed](https://raw.githubusercontent.com/ShibaCheemsHD/ministry-of-victory/data/feed.xml). For a Discord channel: create a webhook in the channel's settings (Integrations → Webhooks) and save its URL as the repository secret `DISCORD_WEBHOOK` (Settings → Secrets and variables → Actions); the recorder posts there from its next run.

## Data and credits

- Live data: the community API at [api.helldivers2.dev](https://api.helldivers2.dev) ([helldivers-2/api](https://github.com/helldivers-2/api)).
- Enemy and weapon names: [Galactic Wide Web](https://github.com/Stonemercy/Galactic-Wide-Web) and [helldivers-2/json](https://github.com/helldivers-2/json), loaded at runtime.

Estimates are based on observed galactic war behavior, measured on the community war log ([CrossWaveOmega/helldiversplanettable](https://github.com/CrossWaveOmega/helldiversplanettable)) and on the site's own recordings: about 100,000 HP per hour with every player on one planet, no visible DSS bonus, Heavy Ordnance about x1.8 on its planet and x0.7 everywhere else. They are not official numbers: the Game Master can change regen at any time.

## Working on it

- `src/`: the forecast engine (`engine.js`), the texts (`i18n.js`), `style.css`, `body.html`, the mock API used by the tests (`mock.js`), and the page's code in `src/app/`, one file per part of the page, joined in order into one script by the build:
  `00-core` (settings, API, state) · `01-intel` (Joel's moves, news) · `02-directive` (the order of the day) · `03-planet-card` (planet card, several orders, side rail) · `04-between-orders` · `05-war-map` · `06-objectives-strategy` · `07-history-data` (charts) · `08-view-archive` · `09-motion-interaction` · `09b-fx` (effects) · `10-share-image` · `10a-settings-view` (views, settings, fixed texts) · `11-boot`.
- `recorder/`: the GitHub Action that records the war every 10 minutes and writes the `data` branch. Every run also keeps a copy of the history (at its start and end) as an artifact for 30 days: to restore, download it from the run and push it as `history.json` on the `data` branch.
- Publishing: the page goes online from the Tests workflow, only after every test has passed (Pages source: GitHub Actions). The page carries a Content-Security-Policy built with the hashes of its own scripts: a new source of data has to be added to `CONNECT` in `tools/build.py`.
- The recorder reloads itself: when `main` gets new recorder code, the running loop stops after its next snapshot and a fresh run starts on the new code.
- Static checks: ESLint on the assembled page and the engine (`tools/eslint.config.mjs`), in CI. Actions are pinned to commits; Dependabot proposes updates once a month.
- **Plan B if GitHub stops the Actions** (the recorder keeps a runner busy around the clock, which GitHub's terms may not like): the recorder is plain Node 22 with no dependencies, so the same loop runs on any small always-on machine (a free cloud VM, a Raspberry Pi): every 10 minutes `node recorder/record.mjs history.json out/`, then push `out/` to the `data` branch with a deploy key (the steps are in `.github/workflows/record.yml`). The page doesn't care where the data branch is written from. Its last 30 days of history are in the Actions artifacts, and the page falls back to jsDelivr's copy of the files if GitHub's raw files stop answering.
- `python3 tools/build.py` builds `index.html` (minified) and `recorder/engine.cjs` from `src/`, plus `build/test.html` (readable, mock API).
- Tests: `node --test tests/*.test.mjs` (engine maths, reading of the game's texts on real headlines, the recorder on a real snapshot) and `python3 tests/page_test.py` (every scenario and random data in a real browser). `python3 tests/a11y_test.py` runs axe-core on every view and checks the dialogs by keyboard (needs `npm i --no-save axe-core@4.10.2`). They run on every push (`.github/workflows/test.yml`); a bug that reached the site gets a regression test.

## Disclaimer

Fan-made tool, not affiliated with or endorsed by Arrowhead Game Studios or Sony Interactive Entertainment. Helldivers is a trademark of its respective owners.

## Reproducing the forecast check

Run `node tools/backtest.mjs /path/historydata.json /path/resort.json` with the community archive files from CrossWaveOmega/helldiversplanettable. The command records input hashes and prints results by horizon. `--engine /path/older-engine.cjs` compares another engine against the same causal replay; `--since YYYY-MM-DD --until YYYY-MM-DD` selects a chronological evaluation period. Do not tune parameters on the evaluation period and describe it as an untouched holdout. These scores include eligible completed liberations, not failed or stalled campaigns; the site's live recorder is needed to evaluate those as well.
