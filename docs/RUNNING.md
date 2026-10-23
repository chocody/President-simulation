# Running President Sim

## Local development

```sh
pnpm install
DEV_FIXTURES=1 pnpm -C apps/web dev
```

Open http://localhost:3000. Without real country data in `data/countries/`, the game only works with
`DEV_FIXTURES=1`, which adds one clearly labelled fictional country. Presets that have no pre-judged result get a
mock judgment, so the whole game can be played offline with no API key.

Checks you should run before pushing (CI runs the same):

```sh
pnpm typecheck
pnpm test
pnpm tsx scripts/check-sources.ts
pnpm -C apps/web build
```

The browser test (`pnpm -C apps/web e2e`) builds and serves the app with `DEV_FIXTURES=1` and a fixed seed. It
uses the Chromium path in `PS_CHROMIUM` (default `/opt/pw-browsers/chromium`). In CI only, the workflow installs
the browser with `npx playwright install --with-deps chromium`.

## Environment variables

| Variable | Used by | Meaning |
| --- | --- | --- |
| `GAME_ANTHROPIC_API_KEY` | web app, `prejudge-choices.ts`, `run-smoke.ts` | The game's own Claude API key. When set, the web app uses the real AI game master. Scripts need it unless run with `--dry`. |
| `GAME_MASTER` | web app | `GAME_MASTER=mock` forces the mock game master even if the key is set. |
| `DEV_FIXTURES` | web app | `DEV_FIXTURES=1` enables the fictional dev country and mock judgments for unjudged presets. Never set it in production. |
| `PS_COMMERCIAL` | `check-sources.ts --production` | `PS_COMMERCIAL=1` makes the production check fail on any cited source with `commercialOk: false`. |

Optional: `PS_SEED` (fixed game seed, honoured only under `DEV_FIXTURES=1`), `PS_DATA_DIR` (alternative data
directory), `PS_CHROMIUM` (browser for E2E).

**Warning: never use ANTHROPIC_API_KEY for this project. The game reads only GAME_ANTHROPIC_API_KEY, so a key meant for other tools is never picked up by accident.**

Keep the key in your shell or a local `.env` file (git-ignored). It is never committed and CI does not need it.

## Building country data

Country files are built from World Bank data by `scripts/build-countries.ts` (spec D2) into
`data/countries/<ISO3>.json`. The script needs network access to `api.worldbank.org`; it supports `--dry`
(print the planned requests, no network), `--fixtures <dir>` (read saved responses) and `--save-raw <dir>`.
It skips any country with a missing required indicator rather than guessing. Every value is stored with its
source id, year and raw value, and `check-sources.ts` verifies those source ids exist.

## Pre-judging the preset choices (offline, costs money)

Every preset choice is judged once offline, three runs each, and the run closest to the median is stored in
`data/prejudged/<cardId>.json`. Always look at the plan and cost first:

```sh
pnpm tsx scripts/prejudge-choices.ts --dry
```

Current estimate from `--dry`: 12 cards, 36 choices, 108 judge calls, about $7.19 without caching (upper bound),
$6.73 if the system prompt is cached. Then run it for real:

```sh
GAME_ANTHROPIC_API_KEY=... pnpm tsx scripts/prejudge-choices.ts            # skips cards already done
GAME_ANTHROPIC_API_KEY=... pnpm tsx scripts/prejudge-choices.ts --only economy.oil.spike
GAME_ANTHROPIC_API_KEY=... pnpm tsx scripts/prejudge-choices.ts --force      # re-judge existing cards
```

The estimate is recomputed from the current cards, so re-run `--dry` after the content changes.
A human then reads each pre-judged result and sets `reviewedBy` on the choice.

## Smoke eval (costs money)

A fixed set of 20 typed answers (normal, impossible, prompt injection, cruel) is sent to the judge and checked
against expected behaviour.

```sh
pnpm tsx evals/run-smoke.ts --dry
```

Current estimate from `--dry`: about $1.34 without caching (upper bound), $1.26 if cached. Run it for real with
`GAME_ANTHROPIC_API_KEY=... pnpm tsx evals/run-smoke.ts`. It exits non-zero if any case fails.

## Source checks

```sh
pnpm tsx scripts/check-sources.ts               # must pass; uncited items are warnings
pnpm tsx scripts/check-sources.ts --production  # release gate: fails while cited items are unverified
```

The production run is expected to fail until the human review below is done.

## Human review steps (before any release)

1. Open `docs/review-day1.md`. For each evidence link, open the page and check that it states the finding and
   that the license allows our use.
2. Put your name in `verifiedBy` for that source in `data/sources/research-sources.yaml` and for each matching
   item in `data/evidence/evidence.yaml`.
3. Do the same for dataset sources in `data/sources/sources.yaml` (open the indicator page, confirm the code and
   the license) and for the design sources, which point to the plan.
4. Fill in the missing details noted in the `note` fields (for example exact article URLs).
5. Review the pre-judged results and set `reviewedBy` on each choice.
6. Run `pnpm tsx scripts/check-sources.ts --production` (with `PS_COMMERCIAL=1` if the game will be commercial).
   It must pass before release.
