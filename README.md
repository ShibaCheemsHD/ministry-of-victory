# Ministry of Victory

**An unofficial tactical terminal for Helldivers 2 Major Orders.** Super Earth has a Ministry of Truth; this is the Ministry of Victory.
Open the page and it tells you, in one line, what the whole community should do right now to win the current Major Order, and how realistic winning is.

## What it does

- **Order of the day:** the single move that changes the outcome the most (which planet to focus, which defense to save, which front needs players).
- **Forecast:** from "On track" to "Impossible", based on planet health, regen, and how many Helldivers are on each planet.
- **Plan:** every useful move ranked by importance, with what it changes ("Fury falls 1d 1h sooner").
- **What if…?:** drag a slider to see what happens with more or fewer players.
- **Numbers:** regen, break-even share, pace per hour, projections.
- Works for liberations, defenses, kill / mission / extraction counts, weapon-specific kills, "liberate N planets" and sector orders. Several orders at once are compared.

The page refreshes itself every minute.

## Data and credits

- Live data: the community API at [api.helldivers2.dev](https://api.helldivers2.dev) ([helldivers-2/api](https://github.com/helldivers-2/api)).
- Enemy and weapon names: [Galactic Wide Web](https://github.com/Stonemercy/Galactic-Wide-Web) and [helldivers-2/json](https://github.com/helldivers-2/json), loaded at runtime.

Estimates are based on observed galactic war behavior, measured on the community war log ([CrossWaveOmega/helldiversplanettable](https://github.com/CrossWaveOmega/helldiversplanettable)) and on the site's own recordings: about 100,000 HP per hour with every player on one planet, no visible DSS bonus, Heavy Ordnance about x1.8 on its planet and x0.7 everywhere else. They are not official numbers: the Game Master can change regen at any time.

## Working on it

- `src/`: the page (`app.js`, `i18n.js`, `style.css`, `body.html`), the forecast engine (`engine.js`) and the mock API used by the tests (`mock.js`).
- `recorder/`: the GitHub Action that records the war every 10 minutes and writes the `data` branch.
- `python3 tools/build.py` builds `index.html` (minified) and `recorder/engine.cjs` from `src/`, plus `build/test.html` (readable, mock API).
- Tests: `node --test tests/*.test.mjs` (engine maths, reading of the game's texts on real headlines, the recorder on a real snapshot) and `python3 tests/page_test.py` (every scenario and random data in a real browser). They run on every push (`.github/workflows/test.yml`); a bug that reached the site gets a regression test.

## Disclaimer

Fan-made tool, not affiliated with or endorsed by Arrowhead Game Studios or Sony Interactive Entertainment. Helldivers is a trademark of its respective owners.
