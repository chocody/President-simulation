# Pre-judged preset choices

Files here are merged into `choice.judgment` by the web app and the simulator.

**Current files (2026-10-23) were written by the Lead (Claude, in a Claude Code session) by hand following
`packages/ai-gm/src/prompts/judge.v1.ts`, because no `GAME_ANTHROPIC_API_KEY` exists yet.** Source:
`scripts/prejudge-manual/lead-2026-10-23.py`. Each entry says so in its `model` field and has `runs: 1`.
`scripts/test/prejudged.test.ts` checks the schema and the evidence rule for every entry.

Replace them with the API pipeline (3 runs, median) once a key exists:
`GAME_ANTHROPIC_API_KEY=... pnpm tsx scripts/prejudge-choices.ts --force` (about $7).
A human should still review each result and set `reviewedBy` on the choice.
