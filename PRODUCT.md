# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single Helldivers 2 player who wants to know where to drop so that their missions count toward the current Major Order. They mostly keep the page open on a second PC screen while they play and glance at it between missions; phones are a secondary use. Community coordinators (Discord, Reddit) use the share image and the copy-for-Discord text, but they are not the primary user.

## Product Purpose

Tell the player, in one line, the move that most changes the outcome of the current Major Order, and how realistic winning is, so the community's missions land where they matter. Success: a player who glances at the page for a few seconds knows which planet or front to pick, and trusts that the call is honest even when the order is out of reach.

## Positioning

The forecast is measured, not guessed: planet health, regen and the players on each planet go into an engine fitted on the community war log, and every call is replayed against what happened. The Archive keeps that track record public (for example "within 25% of the real fall time 81% of the time, 6 hours ahead"), including the defeats. The page says plainly when an order cannot be won.

## Operating Context

- Live data from the community API (api.helldivers2.dev), refreshed every minute; a recorder on GitHub Actions snapshots the war every 10 minutes into a `data` branch (history, archive, intel, RSS feed, optional Discord webhook).
- Several Major Orders can run at once; the page compares them and picks the best bet.
- States the page must handle: one or several active orders, between orders, won, failed, out of reach, measuring (too early to call), API down (fallback data), recorder stale.
- Players share the call through a generated share image (PNG) and a copy-for-Discord text.

## Capabilities and Constraints

- Static single page on GitHub Pages, built by `tools/build.py` from `src/` into one `index.html` with a strict Content-Security-Policy (script hashes; external fetches only from the API, raw.githubusercontent.com and cdn.jsdelivr.net). No framework.
- English only.
- Enemy and weapon names must be the exact in-game names ("Radical kills", not "Automaton kills"); unknown names raise a health alert rather than a guess.
- Terminology: Major Order (MO), objective, liberation, defense, regen, DSS (Democracy Space Station), Heavy Ordnance (HOD), front, Joel (Arrowhead's Game Master), medals.
- Tests: node unit tests, a Playwright page test over every scenario of the mock API, axe-core accessibility test; CI deploys only when they pass.

## Brand Commitments

- Name: Ministry of Victory, an unofficial fan "ministry" beside Super Earth's Ministry of Truth; the voice may carry a light Super Earth propaganda tone, never at the cost of clarity.
- Super Earth yellow and black are kept.
- Everything else about the look may change.

## Evidence on Hand

- The live forecast engine and its replayed track record (README, Archive).
- The full archive of Major Orders since 2024 with outcomes cross-checked against the Helldivers Wiki.
- No testimonials, user counts or official endorsement exist; the site is fan-made and must say so.

## Product Principles

1. One call, stated first: the page leads with the single move that matters, and every other panel supports it.
2. Honest before encouraging: a hopeless order is called hopeless, with the reasons and the order still worth playing.
3. Precise words: the objective's own nouns, one term per concept, one scale for every verdict.
4. Glanceable from a second screen: the call reads in seconds at a distance; detail is there on demand.
5. Show the track record: forecasts are checked against what happened, in public.

## Accessibility & Inclusion

WCAG 2.1 AA: contrast, keyboard use, reduced motion honoured, 44px touch targets on phones.
