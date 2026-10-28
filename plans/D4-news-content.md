# D4 — Minor events (news ticker) and trait weights for cards (lane D)

Owner: worker (Sonnet). Reviewer: Lead. Read `CLAUDE.md` and `plans/D1-content.md` (same hard rules) first.

## Files you own
`data/events/minor.yaml` (new), `traitWeights` lines added to existing `data/cards/*.yaml` (only that field),
appended items in `data/evidence/evidence.yaml` / `data/sources/research-sources.yaml` if you cite new studies,
`scripts/test/validate-content.test.ts`. Edit nothing else.

## Minor events (~40)
Contract `MinorEvent`. The 1in8B feel: many small things happen every quarter.
- Balanced: about half positive, half negative. Categories spread across all 8.
- Each event: one Thai line under 25 words, no country names, no invented statistics; 1–2 effects that are small
  (index ±1 to ±3; GDP/inflation/unemployment ±0.1 to ±0.3; group satisfaction ±1 to ±3), `over_quarters` 1–2.
- `traitWeights` where the link is real and data-based: tourism news ↑ with `tourism`, crop/price news ↑ with
  `agriculture`, commodity news ↑ with `resources`, export orders ↑ with `openness`, petty-corruption or favour-trading
  news ↑ with `patronage`, service-delivery wins ↑ with `govEffectiveness`. Values −1..1.
- `sourceIds`: at least `design.minor-events`; add a dataset/research id when an effect's direction is backed.
- Include a handful about patronage and influence (e.g. a contract goes to a connected firm, a reshuffle rewards
  allies) — describe them neutrally, as institutions, never as a culture or a nationality.

## Trait weights on the 18 cards
Add `traitWeights` only where the link is clear: tourism card ↑ tourism; harvest & drought ↑ agriculture; energy
discovery ↑ resources; export boom & tariff ↑ openness; cabinet scandal ↑ patronage; hospitals ↓ govEffectiveness.
Leave others without the field.

## Tests
Extend `validate-content.test.ts`: minor events parse, unique ids, 30–60 events, roughly balanced signs (40–60%
positive), magnitudes within the limits above, every sourceId exists, traitWeights keys valid.

## Report
Counts by category and sign, the trait-weighted events, the card weights you added, any new evidence.
