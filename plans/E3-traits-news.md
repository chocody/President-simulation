# E3 — Country traits, institutional friction and the news ticker (lane E)

Owner: worker (Sonnet). Reviewer: Lead. Read `CLAUDE.md` first. New contracts: `TraitKey`, `CountryData.traits/traitsSrc`,
`Card.traitWeights`, `MinorEvent`, `GameState.news`. New params: `TRAITS`, `FRICTION`, `MINOR_EVENTS`.

## Files you own
`packages/engine/**`, `scripts/build-countries.ts`, `scripts/lib/**`, `scripts/test/**` (except validate-content and
prejudged tests), `scripts/simulate.ts`, `apps/web/**`. You may append entries to `data/sources/sources.yaml` for the new
indicator codes (`verifiedBy: null`). Do not edit contracts, design-params, cards, evidence or plans.

## 1. Traits in the data pipeline
- `build-countries` also fetches every `TRAITS` code (dedupe with codes already fetched), maps each with its `linear`
  (and `invert`), writes `traits` and `traitsSrc` (provenance = the code's `wdi.`/`wgi.` source, year, raw).
- A missing optional trait (tourism) is left out of `traits` with a build-report note; a missing required trait skips
  nothing — record it in the report and leave it out (traits are optional in the contract). Same age rules as stats.
- Tests with fixture responses (extend the existing fixtures, labelled as invented).

## 2. Engine
- `traitMultiplier(country traits, weights)`: Π over keys of `1 + k × (trait − 50) / 50`, clamped to [0.1, 3]; a missing
  trait counts as 50. Use it in `pickCard` (card.traitWeights) and in minor-event selection.
- The engine needs the country's traits: add `traits` to the inputs where needed **without changing `GameState`'s
  required fields** — e.g. `newGame` copies `country.traits` into `state.log`? No: pass a `ctx: { traits }` argument to
  `advanceQuarter`/`resolveTurn` (optional, default all 50). Keep existing call sites working.
- **Friction** (`FRICTION`): an action is a reform if any effect has indicator in `reformTargets` with the reform
  direction (corruption down; pressFreedom or parliament up). For reforms: parliament vote += −parliamentPerPoint ×
  (patronage − 50); success probability += −probabilityPerPoint × (patronage − 50). Report both numbers in
  `MeasureReport` notes (`report.notes`) so the UI can explain "ระบบอุปถัมภ์ทำให้ปฏิรูปยากขึ้น".
- **Minor events** (`MINOR_EVENTS`): in `advanceQuarter`, after step 5, draw `rng.int(perQuarter)` distinct eligible
  events (conditions hold, not used within cooldownQ), weighted by baseWeight × traitMultiplier; apply each effect
  immediately as an `event:news:<id>` slice over its `over_quarters`; push `{ quarter, id }` to `state.news`
  (create the array if missing) and a log line. Deck of minor events is a new argument (`minorEvents: MinorEvent[]`,
  default []).
- Property test: minor events never move a stat by more than 3 index points / 0.5 unit points in one quarter in total.

## 3. Simulation
`scripts/simulate.ts --real-deck` also loads `data/events/minor.yaml` when present and passes traits from country
files. Print the mean per-quarter count of news items and the per-country win rate of the best bot.

## 4. Web app
- Load `data/events/minor.yaml` (validate with `MinorEvent`), pass minor events + country traits to the engine.
- Main screen: a **news ticker / log** listing this quarter's and recent `news` items (text from the event, small
  coloured +/- chips for its effects). `advance` returns the news produced while advancing.
- Charter and a "ลักษณะประเทศ" panel: each trait as a labelled bar with its source on tap (same dialog as stats),
  e.g. "การท่องเที่ยว: รายได้ท่องเที่ยว x% ของการส่งออก (WDI, ปี y)". patronage must say it is a proxy from WGI
  Rule of Law.
- Result screen: when friction applied, show one line explaining it.
- Update unit tests and the E2E (dev fixture country gets invented traits, labelled).

## Done when
`pnpm test`, `pnpm typecheck`, `pnpm -C apps/web typecheck`, `next build` and the E2E pass. Report what you changed in
call signatures.
