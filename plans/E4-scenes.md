# E4 — Consequence scenes in the engine and UI

Owner: worker (Sonnet). Reviewer: Lead. Read `CLAUDE.md` first. Starts after E3 (news ticker) is merged.
Goal: after each decision the result screen leads with **what happened, as situations** ("factories add a night
shift", "farmers block a highway"); numbers move to a details section. Delayed effects and court rulings in later
quarters appear as follow-up scenes in the news log, linked to the measure that caused them.

## Files you own
`packages/engine/src/scenes.ts` (new) + tests, small changes in `packages/engine/src/{resolve,tick,index}.ts`,
`packages/ai-gm/src/routes/narrator.ts` + `prompts/narrator.v1.ts` (add a `<scenes>` block only),
`apps/web/**`, `scripts/simulate.ts`. Frozen: contracts, design-params (`SCENES`), `data/**` (D5 writes
`data/scenes/scenes.yaml`; until it lands, tests use a small fixture library).

## Engine (pure, counter RNG, no magic numbers — use `SCENES`, `LEVEL_SCALE`, goodness direction)
1. `resolveTurn` records each enacted measure in `state.policies` `{ id: policyId, title, quarter }`.
2. `buildTurnScenes({ state, report, card, actions, library, traits })` → `{ state, scenes }`:
   - Outcome scenes for each measure with outcome ≠ success; protest scenes for `protest.happened`. `cause` = measure title.
   - Delta candidates from `report.immediate` with |delta| ≥ `minLevelShare` × level-1 step of that target;
     size large when |delta| ≥ level-2 step. Attribute each target to the measure whose effect on it is largest
     (level × multiplier); else to the event card (`cause` = card title).
   - Rank by |delta| / level-1 step, outcome/protest first, cap at `maxPerTurn`.
   - Pick a template for each: matching trigger, weight 1 × trait multiplier (reuse E3's helper, `traitStrength`),
     avoid a templateId used in the last 4 quarters when another exists; fall back to the other size; skip if none.
   - `tone` from goodness direction (never from text); fill `{measure}`; append `SceneRecord`s to `state.scenes`.
3. `advanceQuarter` (with the library in its content input, like E3's minor events):
   - **Follow-up**: for each policy with a scheduled slice that starts this quarter (after the decision quarter), total =
     deltaPerQuarter × length; if |total| ≥ `followupMinLevelShare` × level-1 step, add a `followup` scene,
     `cause` = policy title. At most `maxFollowupsPerQuarter`, biggest first.
   - **Court**: when a court check suspends a policy, add a `court` scene with that title.
4. Tests: determinism (same seed → same scenes), cap respected, tone matches goodness for every stat (fast-check),
   no scene for changes below the threshold, follow-up appears in the right quarter, old states without
   `policies`/`scenes` still load.

## AI and web
- Narrator: add `<scenes>` (text + cause) to the turn block; one prompt line: "Weave these scenes into the narration;
  never add outcomes or numbers that are not in the report." Mock narrator puts the scene texts into its narration.
- `content.ts` loads and validates `data/scenes/*.yaml` (missing folder → empty library, no crash).
- `decide` returns `scenes`. **ResultScreen**: top section "เกิดอะไรขึ้น" — scene cards (tone colour + icon,
  badge "จากมาตรการ …" or "จากเหตุการณ์ …"); the current measure details and stat/group changes move under a
  collapsible "ดูตัวเลขละเอียด" (keep existing test ids).
- **MainScreen** news log: follow-up and court scenes with a "ผลต่อเนื่อง" badge and the measure title, mixed with minor news by quarter.
- **EndingScreen**: "เส้นทางวาระของคุณ" — chronological list of up to 10 scenes (turn, followup, court).
- `simulate.ts`: report scenes per decision (mean, min, max) and follow-ups per game.
- E2E: the result screen shows at least one scene card; update screenshots.

## Done when
`pnpm test`, `pnpm typecheck`, `next build`, E2E pass. Report the scenes-per-turn numbers and screenshot paths.
