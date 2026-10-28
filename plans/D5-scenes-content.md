# D5 — Consequence scene library (content lane)

Owner: worker (Sonnet). Reviewer: Lead. Read `CLAUDE.md` first.
Goal: the player sees **situations**, not only bars. Write the library of scene templates that the engine
(lane E4) picks from after each decision and when delayed effects arrive.

## Files you own
`data/scenes/scenes.yaml` (new), `scripts/validate-content.test.ts` (add a scenes block). Read only: contracts
(`SceneTemplate`, `SceneTrigger`), design-params (`SCENES`, `LEVEL_SCALE`, `GOODNESS`, `TRAITS`), `data/sources/*`.

## Contract (frozen)
`SceneTemplate = { id: "scene.<...>", trigger, textTh, traitWeights?, sourceIds (min 1) }`, triggers:
- `delta` `{ target, direction: up|down, size: small|large }` — large means |change| >= level-2 step.
- `outcome` `{ outcome: blocked|critical_failure|great_success|partial|failure }` (plain success has no scene).
- `protest` `{ group }`; `court` `{}`.

## What to write (about 100 templates)
1. **Delta scenes**: every target (15 stats + 5 `group:*`) × up/down × small/large = 80 keys, **at least 1 each**;
   2 variants for the 8 most common targets (gdpGrowth, inflation, unemployment, budget, stability, group:farmers,
   group:urban, group:business).
2. **Outcome** 5 keys × 2 variants; **protest** 5 groups × 1; **court** 2 variants.
3. Optional trait-flavoured variants (≤15) with `traitWeights`, e.g. gdpGrowth up + tourism → hotels and
   restaurants busy; group:farmers down + agriculture → farmers block a highway. Only where the trait's data
   (see `TRAITS`) makes the link plain.

## Writing rules
- Thai, one or two short sentences, under 30 words. Concrete and visible: who does what, where
  ("โรงงานในนิคมเพิ่มกะกลางคืน", "แม่ค้าในตลาดบ่นว่าต้นทุนขึ้นทุกสัปดาห์"). No digits, no country or city names, no real people,
  no party names. Officials are roles.
- The text must match the direction's real meaning: inflation up / unemployment up / crime up / corruption up /
  inequality up / debt up are **bad**; budget down means less fiscal room. `large` scenes are visibly bigger than `small`.
- `{measure}` placeholder (the measure title) only in outcome, protest and court templates, optional elsewhere.
- Describe typical, well-documented mechanisms, never a specific historical event.
- `sourceIds`: always `design.scenes`; add an existing research source id from `data/sources/research-sources.yaml`
  only where that study clearly documents the mechanism in the text. Never invent a source.

## Tests (write first, in `scripts/validate-content.test.ts`)
Every template parses as `SceneTemplate`; ids unique; all 80 delta keys + 5 outcome + 5 protest + court covered;
text has no digits and no country names (reuse the D4 country-name list), under 30 words; `{measure}` is the only
placeholder; every sourceId exists; trait keys valid.

## Done when
`pnpm test` and `pnpm typecheck` pass. Report counts per trigger kind, and which items cite research sources.
