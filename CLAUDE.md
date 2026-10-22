# President Sim — rules for every agent

Educational game: the player leads a real country for one term (16 quarters, MVP).
Plan and design: https://claude.ai/artifact/GUhXCDZuojvrbAtRTDMjEW

## Roles
- The Lead plans, reviews and merges. Workers implement exactly one spec from `plans/`.
- `packages/shared/src/contracts.ts` and `packages/shared/src/design-params.ts` are frozen.
  Workers never edit them. If a spec cannot be met without a change, stop and report what you need.

## Every number needs a source
- Real data: comes from a dataset in `data/sources/sources.yaml`, with year and raw value.
- Design values: live in `design-params.ts` with `basedOn` ids. No magic numbers in engine code.
- AI or written content: cite `evidence` ids or `sources` ids. Never invent a URL, a study or a figure.
  If you cannot find a real source, leave the item out and say so in your report.

## Code
- TypeScript, strict. Engine (`packages/engine`) is pure: no I/O, no Date.now, no Math.random.
- Test first with Vitest; property tests with fast-check where a rule says "never" or "always".
- Run `pnpm test` and `pnpm typecheck` before reporting done. Report failures honestly.
- Do not name real living politicians. Officials are roles ("the finance minister").
