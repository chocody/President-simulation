# President Sim

An educational game. The player leads a real country for one term (16 quarters in the MVP). Each quarter the
country faces an event card (a flood, an oil price spike, a strike). The player picks one of three preset
approaches or types their own answer. An AI game master judges the answer against research evidence, the engine
rolls the dice and updates the country, and the game ends with a grade and a short line from the historian.

The game is in Thai. Officials in the game are roles ("the finance minister"), never real people.

Plan and design: https://claude.ai/artifact/GUhXCDZuojvrbAtRTDMjEW

## Every number needs a source

- Real data comes from a dataset listed in `data/sources/sources.yaml`, stored with its year and raw value.
- Design values live in `packages/shared/src/design-params.ts` with `basedOn` ids. No magic numbers in engine code.
- Written or AI content cites `evidence` ids (`data/evidence/evidence.yaml`) or `sources` ids. Nothing is invented:
  no made-up URL, study or figure. If no real source exists, the item is left out.
- Nothing counts as verified until a human opens the page and puts their name in `verifiedBy`.

`pnpm tsx scripts/check-sources.ts` enforces this: every referenced id must exist, ids must be unique, and
uncited items are listed as warnings. `--production` additionally fails while any cited source or evidence item
is unverified (see `docs/RUNNING.md`).

## Repo layout

| Path | What it holds |
| --- | --- |
| `packages/shared` | Frozen contracts (`contracts.ts`) and every engine constant (`design-params.ts`) |
| `packages/engine` | The pure game engine: no I/O, no clock, no randomness except a seeded generator |
| `packages/ai-gm` | The AI game master: judge, narrator and historian prompts, client, pre-judge and smoke eval helpers |
| `apps/web` | The Next.js web app, its API routes and the Playwright E2E test |
| `data/` | Cards, evidence, source registries and (later) country data, all as files |
| `scripts/` | Command-line tools: source checks, pre-judging, simulation |
| `evals/` | The smoke eval for the judge route |
| `plans/` | One spec per work lane. Workers implement exactly one spec |
| `docs/` | Running guide and human review checklists |

## Quick start

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm tsx scripts/check-sources.ts
DEV_FIXTURES=1 pnpm -C apps/web dev   # play with the invented dev country and the mock game master
```

Requires Node 22 and pnpm 10. No API key is needed for any of the above.
See `docs/RUNNING.md` for environment variables, the offline pre-judge run, the smoke eval and the human review steps.

Rules for contributors and agents are in `CLAUDE.md`.
