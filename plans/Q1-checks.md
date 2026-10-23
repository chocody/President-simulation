# Q1 — Source checks, CI and run docs (lane Q)

Owner: worker (Sonnet). Reviewer: Lead. Read `CLAUDE.md` first.

## Files you own
`scripts/check-sources.ts`, `scripts/test/check-sources.test.ts`, `.github/workflows/ci.yml`, `README.md`,
`docs/RUNNING.md`. Edit nothing else.

## check-sources.ts (`pnpm tsx scripts/check-sources.ts [--production]`)
Load `data/sources/sources.yaml` + `research-sources.yaml`, `data/evidence/evidence.yaml`, `data/cards/*.yaml`,
`data/countries/*.json` (may be empty), and `design-params.ts` (import it). Fail with a list of problems when:
1. any id referenced anywhere (country provenance, card `sourceIds`, evidence `sourceId`, choice `evidenceIds`,
   design-param `basedOn`) does not exist; 2. duplicate ids across registries; 3. a source or evidence item is
   cited nowhere (warning only); 4. with `--production`: any cited source/evidence has `verifiedBy: null`, or any
   cited source has `commercialOk: false` while `PS_COMMERCIAL=1`. Print a summary table (counts, unverified).
Today `--production` is expected to fail (nothing is verified yet); the plain run must pass.

## CI (`.github/workflows/ci.yml`)
On push and pull request: pnpm install (frozen lockfile), `pnpm typecheck`, `pnpm test`,
`pnpm tsx scripts/check-sources.ts`, `pnpm -C apps/web build`. Node 22, pnpm 10. No secrets needed; never
reference `ANTHROPIC_API_KEY`. Playwright E2E as a separate job using `npx playwright install --with-deps chromium`
(allowed in CI only).

## Docs
`README.md`: what the game is, repo layout, the "every number needs a source" rule, quick start.
`docs/RUNNING.md`: local dev (`DEV_FIXTURES=1 pnpm -C apps/web dev`), env vars (`GAME_ANTHROPIC_API_KEY`,
`GAME_MASTER=mock`, `DEV_FIXTURES`, `PS_COMMERCIAL`) with the warning never to use `ANTHROPIC_API_KEY`,
building country data, pre-judging choices and the smoke eval (with their cost estimates from `--dry`), and the
human review steps (verify links in docs/review-day1.md, set `verifiedBy`).

## Done when
`pnpm test`, `pnpm typecheck` and the plain check-sources run pass; the workflow YAML is valid
(parse it in a test). Report the check-sources summary.
