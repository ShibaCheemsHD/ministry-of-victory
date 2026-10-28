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

Estimates are based on observed galactic war behavior (for example, about 90,000 HP per hour with every player on one planet, measured on *Honour the Fallen*, October 2026). They are not official numbers: the Game Master can change regen at any time.

## Disclaimer

Fan-made tool, not affiliated with or endorsed by Arrowhead Game Studios or Sony Interactive Entertainment. Helldivers is a trademark of its respective owners.
