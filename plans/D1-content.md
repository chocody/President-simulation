# D1 — Event cards, choices and evidence (lane D, content)

Owner: worker (Sonnet). Reviewer: Lead, then a human checks every link. Read `CLAUDE.md` first.
Goal: 12 decision cards, each with 3 preset choices, backed by a small evidence library of real studies.

## Files you own
- `data/evidence/evidence.yaml` — list of `Evidence` (contracts.ts)
- `data/sources/research-sources.yaml` — list of `Source` with `kind: research`, one per study you cite
- `data/cards/*.yaml` — one file per card, each a `Card`
- `scripts/validate-content.test.ts` — validation test (below)
Do not edit `data/sources/sources.yaml`; the Lead merges your research sources into it.

## Hard rules
- Every study must be one you actually found with web search in this task. The `url` must be a page from
  your search results that states the finding. Never invent titles, authors, years, URLs or effect sizes.
- If you cannot find solid evidence for a choice, give it fewer `evidenceIds` (can be empty) and say so in
  your report. The engine will then keep that choice's effects at level 1. That is acceptable.
- `verifiedBy` and `reviewedBy` stay `null`. `judgment` stays `null` (filled later by an offline AI run).
- `summaryTh` / `summaryEn` are your own 1–2 sentence summaries. Do not copy abstracts.
- Situations are generic: no country names, no real politicians, no real party names. Thai language.

## Evidence library (~20 items)
Search 3ie Development Evidence Portal, J-PAL, IMF/World Bank working papers and peer-reviewed studies.
Cover the policy areas the cards need, e.g. cash transfers, fuel subsidies vs targeted support, flood/drought
infrastructure and insurance, minimum wage, policing, public health response, anti-corruption, trade policy,
foreign direct investment incentives. Map `indicator` to a game `Target` (a stat key or `group:<key>`) and set
`direction` to what the study found for that indicator. Prefer RCTs, quasi-experiments and reviews.

## Cards (12)
Two per category for disaster, economy, society, health; one each for politics, foreign, opportunity, plus one
more of your choice. Ideas from the plan: major flood, drought, oil price spike, currency crash, general strike,
crime surge, epidemic, hospitals overwhelmed, cabinet scandal, import tariffs raised on us, foreign investment offer.

Each card:
- `id` like `disaster.flood.major`; `severity`; Thai `titleTh`; `situationTh` 80–120 Thai words with 2–3
  key facts but **no invented statistics** (describe in words, e.g. "หลายจังหวัดน้ำท่วมสูง").
- `conditions` from the plan's event table (e.g. economy cards when inflation > 10 or debt > 90).
- `baseWeight` 1 (use 0.5–2 only with a reason in a YAML comment); `cooldownQ` 8.
- `ifIgnored`: 2–4 effects. Size them with the plan's level scale (index ±2/5/8, GDP ±0.3/0.8/1.5,
  inflation ±0.5/1.5/3, unemployment ±0.3/0.7/1.2) and keep the sign consistent with your evidence.
- `sourceIds`: at least `design.level-scale` plus one research or dataset source that supports the direction.
- `choices`: exactly 3 (`a`, `b`, `c`) with **different approaches** (e.g. state-led, market-led, targeted).
  None may be free or obviously best: each has a real cost or losing group. `costHint`, `affectedGroups`,
  `evidenceIds` (ids from your library), `descTh` in 1–2 sentences.

## Validation test (write first)
`scripts/validate-content.test.ts` (Vitest):
1. Every card file parses with `Card` from `@ps/shared`; ids unique; choice ids exactly a, b, c.
2. Every evidence item parses with `Evidence`; ids unique; every `sourceId` exists in research-sources.yaml.
3. Every `evidenceIds` in a choice exists in evidence.yaml.
4. Every card `sourceIds` exists in `data/sources/sources.yaml` or research-sources.yaml.
5. Choices within a card have three distinct `approach` values.

## Done when
`pnpm test` passes (including your test) and your report lists: card ids, evidence count, any choice with no
evidence, and anything you could not source.
