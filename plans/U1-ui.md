# U1 — Web app and screens (lane U)

Owner: worker (Sonnet). Reviewer: Lead. Read `CLAUDE.md` first.
Goal: `apps/web`, a mobile-first Next.js app that plays a full term against the engine, using a **mock**
game master (lane A builds the real one in parallel; the Lead wires it in later).

## Files you own
`apps/web/**` only. Import `@ps/shared` and `@ps/engine`. Never edit packages, data, contracts or plans.

## Stack
Next.js (App Router) + React + TypeScript + Tailwind CSS. Thai UI text. No database: the client keeps the
`GameState` in `localStorage` and sends it to the API with each request; the server validates it with the
contract `GameState` schema (accepted MVP trade-off, note it in a code comment).

## Game master interface (`apps/web/server/game-master.ts`)
```ts
export interface GameMaster {
  judge(input: { state: GameState; card: Card; playerText: string; evidence: Evidence[] }): Promise<Judgment>;
  narrate(input: { state: GameState; card: Card; report: TurnReport; answerTitle: string }): Promise<{ narration: string; headlines: string[] }>;
  historian(input: { state: GameState; grades: unknown; legacy: number }): Promise<{ archetype: string; line: string }>;
}
```
Provide `MockGameMaster` (deterministic, clearly labelled mock: judge returns one level-1 action from the text,
narration is a template built from the report, historian line starts with "ประวัติศาสตร์จะจดจำคุณว่า").
Select it via `getGameMaster()`; the Lead will add the real one.

## Data loading (`apps/web/server/content.ts`)
Load cards from `data/cards/*.yaml`, evidence from `data/evidence/evidence.yaml`, sources from
`data/sources/*.yaml`, countries from `data/countries/*.json`, pre-judged choices from `data/prejudged/*.json`
(merge into `choice.judgment`). Validate everything with the contract schemas at load.
If `data/countries/` is empty (true today), the start screen says "ยังไม่มีข้อมูลประเทศจริง". Only when
`DEV_FIXTURES=1` may the app use a dev country you define in `apps/web/dev/fixture-country.ts`, labelled
`DEV FIXTURE — invented values`, with a visible banner "ข้อมูลทดสอบ ไม่ใช่ข้อมูลจริง" on every screen.
A preset choice whose `judgment` is null may, only under `DEV_FIXTURES=1`, use a mock judgment; otherwise the
API returns a clear error.

## API routes (`apps/web/app/api/game/*/route.ts`)
- `POST new` `{ difficulty, iso3? }` → `{ state }` (pick a country weighted by population if no iso3; seed from crypto).
- `POST advance` `{ state }` → `{ state }` (calls `advanceQuarter` until the next decision or the end; also
  returns the log lines produced).
- `POST decide` `{ state, answer }` (contract `Answer`) → `DecideResponse`. Preset: use the choice's judgment and
  its evidence. Free text: `gameMaster.judge` with the card's evidence. Then `resolveTurn`, then `narrate`.
- `POST end` `{ state }` → grades, legacy score, historian line.
Validate every body with Zod; return 400 with a Thai message on error.

## Screens
1. **เริ่มเกม**: difficulty, start button, then a "ใบรับตำแหน่ง" card with the country and its starting stats.
2. **หน้าหลัก**: quarter timeline (1–16), popularity, 5 group bars, 15 stats in 4 pillar sections. **Tapping a stat
   opens its source**: dataset title, indicator code, year, license, link — or "ค่าออกแบบ" with the rationale
   from design-params when the value has no real source. Button "เดินเวลาต่อ".
3. **จุดตัดสินใจ**: card title and situation; 3 choice buttons (title, desc, cost size badge, affected groups);
   a 4th option **"พิมพ์คำตอบเอง"** that expands a textarea with a 20–800 character counter. Submit is disabled
   until a choice is picked or the text is long enough.
4. **ผลลัพธ์**: narration, per-measure result (parliament vote, dice roll vs P, outcome), stat and group changes,
   a note when an effect was cut to level 1 for missing evidence.
5. **ตอนจบ**: vote share with per-group contribution, grades A–F per pillar, legacy score, the historian line.
Mobile first (360 px wide), accessible buttons, no animation library needed.

## Tests (write first)
- Vitest for `content.ts` loading/validation and the API handlers (call them as functions with the mock GM).
- Playwright E2E (`apps/web/e2e/full-game.spec.ts`) with `DEV_FIXTURES=1`: start → play all decisions using
  presets and one typed answer → reach the ending screen and see "ประวัติศาสตร์จะจดจำคุณว่า". Chromium is
  pre-installed: use `executablePath: '/opt/pw-browsers/chromium'` if the Playwright version differs; never run
  `playwright install`.

## Done when
`pnpm test`, `pnpm typecheck`, `next build` and the E2E test pass. Report screenshots paths of the 5 screens
(save them under `apps/web/e2e/screenshots/`).
