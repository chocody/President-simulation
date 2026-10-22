# E1 — Game Engine (lane E)

Owner: worker (Sonnet). Reviewer: Lead. Read `CLAUDE.md` first.
Goal: a pure, deterministic engine that plays one 16-quarter term from a `CountryData`,
a deck of `Card`s and one `Judgment` per decision. No AI, no I/O.

## Files you own
`packages/engine/src/*.ts`, `packages/engine/test/**`, `scripts/simulate.ts`.
Import contracts and constants only from `@ps/shared`. Every constant comes from `design-params.ts`;
if you need a number that is not there, stop and ask the Lead.

## Modules and behaviour

### rng.ts — counter-based RNG
- `uniform(seed: string, cursor: number): number` in [0, 1). Hash the seed once (e.g. xmur3/cyrb53),
  mix with the cursor (splitmix32). Same seed + cursor → same value, always.
- `class Rng { constructor(seed, cursor); next(): number; int(min, max): number /*inclusive*/; get cursor() }`.
  Engine functions take an `Rng`, and write `rng.cursor` back into `state.rngCursor`.

### scales.ts
- `levelToDelta(target: Target, level: "1"|"2"|"3", direction): number` using `LEVEL_SCALE`:
  `gdpGrowth`, `inflation`, `unemployment`, `inequality`, `debt`, `budget` use their own row;
  every other stat, `parliament` and `group:*` use `index`. `down` gives a negative number.
  Direction is literal (crime "up" = more crime).
- `costPctGdp(size)`, `recurringPctGdpPerYear(size)` from `COST_PCT_GDP`.

### goodness.ts
- `goodness(stat, value): number` 0–100, linear interpolation over `GOODNESS` points, clamped at the ends.
- `pillarScores(stats)`: mean goodness per pillar in `PILLARS`.
- `groupTarget(group, stats)`: mean goodness of `GROUP_INTERESTS[group]`.
- `popularity(groups)`: Σ share × satisfaction.

### dice.ts
- `successProbability({ feasibility, specificity, corruption, nMeasures, broke, difficulty })`:
  `P = clamp(minP, maxP, Bf + Ms − corruptionWeight·(C − 50) − perExtraMeasure·(n − 1) − brokePenalty·s + D)`.
- `rollOutcome(P, roll)`, checked top-down: `roll >= criticalFailureFrom` → critical_failure;
  `roll <= P/4` → great_success; `roll <= P` → success; `roll <= P + partialBand` → partial; else failure.

### evidence.ts
- `effectiveLevel(effect, provided: Map<string, Evidence>)`: level 2–3 keeps its level only if at least one
  id in `effect.evidence_ids` is in `provided`, its `indicator` equals `effect.indicator`, and its
  `direction` equals `effect.direction` or is `mixed`. Otherwise level becomes "1". Return the level and
  whether it was downgraded. Level 1 never needs evidence.

### init.ts
- `newGame({ country, difficulty, seed }): GameState`, quarter 1, phase "running".
  - `stats` = country.baseline, except `budget` = `DISCRETIONARY_BUDGET_PCT_GDP[difficulty] / 4`.
  - groups: share from `country.groupShares`, satisfaction `UNSOURCED_DEFAULTS.groupSatisfaction`.
  - popularity computed; `pillarsAtStart` = `pillarScores(stats)`; `econHistory` = [economy pillar].

### events.ts
- `eligibleCards(state, deck)`: all `conditions` hold (target value from stats or `group:x` satisfaction),
  and the card was not used within `cooldownQ` quarters (default `PACING.cardCooldownDefault` if 0 is not intended — use the card's value).
- `pickCard(state, deck, rng)`: weighted by `baseWeight`; `null` when nothing is eligible.

### gates.ts
- `parliamentVote(state, action, rng)`: conflict = min(conflictMax, conflictPerLevel × Σ level of `down` group_impacts);
  vote = stats.parliament + popularityWeight·(popularity − 50) − conflict + U(−noise, noise); passed if vote > passAbove.
  Only for `requires_legislation`; otherwise `{ required: false, vote: null, passed: true }`.
- `courtCheck(action, quarter, rng)`: legal_risk medium/high → a `CourtCheck` at quarter + int(delayMin..delayMax).
- `protest(state, action, mitigation, rng)`: for each `down` group impact, projected satisfaction =
  current − |levelToDelta| × (1 − mitigation); if below `public.threshold`, protest with `public.chance`:
  stability −`stabilityHit` immediately and the action starts `delayQuarters` later. At most one protest per action.

### resolve.ts — `resolveTurn(state, deck, answer, ctx) → { state, report }`
`answer = { kind: "preset" | "free", judgment: Judgment }`, `ctx = { evidence: Evidence[] }` (the evidence
given to the judge; for presets, the choice's `evidenceIds`).
1. Throw `EngineError` unless phase is "decision" and the card exists for `pendingCardId`.
2. Presets: specificity = min(score, `SCORE_EFFECTS.presetSpecificityMax`).
3. `input_class !== "normal"`: no actions, relevance treated as 1; for "meta" apply `META_PENALTY` to all groups.
4. Event: share = `relevanceIgnoredShare[relevance − 1]`; each `ifIgnored` effect × share is scheduled over
   `over_quarters` from the current quarter (policyId `event:<cardId>`). Event effects ignore `TURN_CAP`.
5. Consistency 1–2: `inconsistencyPenalty` to all groups.
6. For the first 3 actions, in order: parliament → (blocked: no cost, no effects, outcome "blocked", roll null)
   → court check → protest → `broke` = budget < one-off cost → P → roll `rng.int(1, 100)` → outcome.
   - One-off cost is paid unless blocked. Budget below 0: debt += shortfall, budget = 0.
   - Recurring cost (if not blocked) is added to `recurring` until quarter 16.
   - Each effect: `effectiveLevel` → total = levelToDelta × multiplier; side_effects use `sideEffectShare`
     (critical_failure 1, failure 0.5, other outcomes 1) instead of the multiplier.
   - Group impacts: `up` × multiplier; `down` × (1 − mitigation) whenever not blocked.
   - Timing: start = quarter + clamp(start_after_quarters, 0, 16) (+ protest delay), lasts = clamp(1..16);
     deltaPerQuarter = total / lasts. A slice that falls on the current quarter applies now; the rest goes
     to `scheduled` from the next quarter. policyId = `q<quarter>.a<index>`.
7. `TURN_CAP`: in any single quarter, the sum of player-policy deltas per target is capped (stats by their
   key, groups by `group`). Apply this both now and in `tick` for scheduled slices. `event:*` is exempt.
8. Clamp stats to `STAT_RANGE`, satisfaction to 0–100, recompute popularity, phase "running",
   `pendingCardId` null, push `cardHistory`, append short `log` lines. Return a `TurnReport` that matches the contract.

### tick.ts — `advanceQuarter(state, deck) → state`
Throw if phase is not "running". If quarter is 16: run the election and end. Otherwise q' = quarter + 1:
1. Apply scheduled slices covering q' (with the per-quarter cap from step 7 above).
2. Mean reversion `TICK.meanReversion` toward baseline for every stat except budget and debt.
3. Budget: income = (annual − debt interest cut) / 4, where cut = `budgetCutPer10` × floor((debt − 60) / 10) when debt > 60;
   minus active recurring costs / 4; negative → debt += shortfall, budget 0.
4. Court checks due at q': roll; on suspension remove that policy's remaining scheduled slices and recurring cost; log it.
5. Group drift toward `groupTarget`, popularity, push economy pillar to `econHistory`.
6. Early endings (`EARLY_ENDINGS`), each a roll when its condition holds → phase "ended", `endReason` set.
7. If q' is in `PACING.decisionQuarters`: `pickCard`; if one is found, phase "decision" and `pendingCardId` set.

### election.ts / endings.ts
- `runElection(state, rng)`: V = Σ share·S + econWeight·(E − 50) + U(−noise, noise), E = mean of the last
  `econQuarters` entries of `econHistory`. Sets `voteShare`, `endReason` won/lost, phase "ended".
- `grades(state)`: per pillar change vs `pillarsAtStart` → A–F using `GRADES`.
- `legacyScore(state)` using `LEGACY`.

### index.ts — export everything above.

## Tests (write first)
Fixtures go in `packages/engine/test/fixtures/` and are clearly labelled `TEST FIXTURE — invented values, never shipped`.
1. rng: determinism and the distribution of `int(1,100)` (chi-square loose bound over 100k draws).
2. dice: the P formula on the worked example (feasibility 3, specificity 2, corruption 60, n 2 → 37); outcome bands at edges.
3. evidence: downgrade rules (missing id, wrong indicator, wrong direction, mixed allowed, level 1 untouched).
4. resolve: rejects wrong phase/card; blocked measure costs nothing; preset specificity capped; meta penalty;
   relevance 5 removes the event effect; same seed + same inputs → identical state (deep equal).
5. property (fast-check): for any judgment, no stat's player-policy change in one quarter exceeds `TURN_CAP`;
   stats always inside `STAT_RANGE`; satisfaction inside 0–100.
6. full game: newGame → advance/resolve loop with fixture cards reaches phase "ended" by quarter 16 with an endReason.

## scripts/simulate.ts
`pnpm tsx scripts/simulate.ts --games 1000` with the fixture country and fixture deck. Bots: always-a, always-b,
always-c, random. Print per bot: win rate, ending distribution, mean popularity at the end, and the
5th/95th percentile of each stat's yearly change. No AI calls.

## Done when
`pnpm test` and `pnpm typecheck` pass, simulate runs in under a minute, and your report lists anything you could not do.
