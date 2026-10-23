# D3 — Good-news cards (lane D, content)

Owner: worker (Sonnet). Reviewer: Lead. Read `CLAUDE.md` and `plans/D1-content.md` (same hard rules) first.
Why: 11 of 12 cards are crises, so even the best play loses (see `docs/balance-real-deck-2026-10-23.md`).
Goal: **6 new cards that start from good news**, each with 3 preset choices, backed by real evidence.

## Files you own
New files in `data/cards/`, appended items in `data/evidence/evidence.yaml` and
`data/sources/research-sources.yaml`. Do not edit existing cards, contracts, design-params or plans.

## Card rules (in addition to D1)
- Ideas: export boom from a trade deal, tourism surge, discovery of an energy resource, a large foreign grant
  for infrastructure, a domestic tech firm grows fast, a bumper harvest. Spread across categories
  (`opportunity`, `economy`, `foreign`, `society`). `severity: minor` unless the windfall is large.
- New field **`onArrival`**: 1–3 positive effects that happen whatever the player answers (the windfall),
  sized with the level scale (index +2/+5, GDP +0.3/+0.8). Back the direction with `sourceIds`.
- `ifIgnored`: 1–2 small **negative** effects for wasting the chance (e.g. a group −2), never larger than the
  windfall. The total of `onArrival` must be clearly net positive versus `ifIgnored`.
- Choices: three different approaches for using the windfall (e.g. save it in a fund, spend it on services,
  cut taxes / let the market use it). Each has a real cost or a losing group. Same evidence rules as D1:
  only studies found via web search in this task, or existing evidence ids; empty `evidenceIds` is fine.
- `judgment: null`, `reviewedBy: null`, `verifiedBy: null`. Thai text, no country names, no invented statistics.

## Tests
Extend `scripts/validate-content.test.ts` only where needed (e.g. its "12 cards" count becomes 18, the category
mix check). Add a check: for cards with `onArrival`, the summed index-scale delta of `onArrival` is greater
than that of `ifIgnored`. `pnpm test` and `pnpm typecheck` must pass. Note `scripts/test/prejudged.test.ts`
will fail until the Lead pre-judges your new choices — that is expected; say so in the report.

## Report
Card ids with their approaches, onArrival/ifIgnored per card, evidence added, choices without evidence.
