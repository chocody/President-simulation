// Bot simulation for the engine. Uses the TEST FIXTURE country and deck (invented values, never shipped).
// Usage: pnpm tsx scripts/simulate.ts --games 1000
import { STAT_KEYS, type Card, type Evidence, type GameState, type StatKey } from "@ps/shared";
import { advanceQuarter, newGame, resolveTurn, uniform } from "../packages/engine/src/index";
import { fixtureCountry } from "../packages/engine/test/fixtures/country";
import { fixtureDeck } from "../packages/engine/test/fixtures/cards";
import { fixtureEvidence } from "../packages/engine/test/fixtures/evidence";

type Bot = "always-a" | "always-b" | "always-c" | "random";
const BOTS: Bot[] = ["always-a", "always-b", "always-c", "random"];
/** Quarters at which stats are snapshotted; consecutive differences are the yearly changes. */
const YEAR_MARKS = [1, 5, 9, 13];

function argGames(): number {
  const i = process.argv.indexOf("--games");
  const n = i >= 0 ? Number(process.argv[i + 1]) : 1000;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1000;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

const evidenceById = new Map<string, Evidence>(fixtureEvidence.map((e) => [e.id, e]));

function chooseId(bot: Bot, game: number, q: number): "a" | "b" | "c" {
  if (bot === "always-a") return "a";
  if (bot === "always-b") return "b";
  if (bot === "always-c") return "c";
  // random bot: deterministic, driven by the engine's counter-based RNG
  return (["a", "b", "c"] as const)[Math.floor(uniform(`bot-random:${game}`, q) * 3)]!;
}

interface Result {
  final: GameState;
  yearly: Map<StatKey, number[]>;
}

function playGame(bot: Bot, game: number, deck: Card[]): Result {
  let s = newGame({ country: fixtureCountry, difficulty: "normal", seed: `sim-${game}` });
  const snapshots = new Map<number, GameState["stats"]>();
  for (let guard = 0; guard < 40 && s.phase !== "ended"; guard++) {
    if (s.phase === "decision") {
      const card = deck.find((c) => c.id === s.pendingCardId)!;
      const choice = card.choices.find((c) => c.id === chooseId(bot, game, s.quarter))!;
      s = resolveTurn(
        s, deck, { kind: "preset", judgment: choice.judgment! },
        { evidence: choice.evidenceIds.map((id) => evidenceById.get(id)).filter((e): e is Evidence => e !== undefined) },
      ).state;
    }
    snapshots.set(s.quarter, { ...s.stats });
    s = advanceQuarter(s, deck);
  }
  const yearly = new Map<StatKey, number[]>(STAT_KEYS.map((k) => [k, []]));
  for (let i = 1; i < YEAR_MARKS.length; i++) {
    const a = snapshots.get(YEAR_MARKS[i - 1]!);
    const b = snapshots.get(YEAR_MARKS[i]!);
    if (!a || !b) continue;
    for (const k of STAT_KEYS) yearly.get(k)!.push(b[k] - a[k]);
  }
  return { final: s, yearly };
}

function run(bot: Bot, games: number): void {
  const endings = new Map<string, number>();
  let popSum = 0;
  let wins = 0;
  const changes = new Map<StatKey, number[]>(STAT_KEYS.map((k) => [k, []]));
  for (let g = 0; g < games; g++) {
    const { final, yearly } = playGame(bot, g, fixtureDeck);
    const reason = final.endReason ?? "none";
    endings.set(reason, (endings.get(reason) ?? 0) + 1);
    if (reason === "won_election") wins++;
    popSum += final.popularity;
    for (const k of STAT_KEYS) changes.get(k)!.push(...yearly.get(k)!);
  }
  const pct = (n: number) => `${((100 * n) / games).toFixed(1)}%`;
  console.log(`\n=== ${bot} (${games} games) ===`);
  console.log(`win rate: ${pct(wins)}`);
  console.log(
    "endings: " + [...endings.entries()].sort((x, y) => y[1] - x[1]).map(([r, n]) => `${r} ${pct(n)}`).join(", "),
  );
  console.log(`mean popularity at the end: ${(popSum / games).toFixed(1)}`);
  console.log("yearly change per stat, 5th / 95th percentile:");
  for (const k of STAT_KEYS) {
    const sorted = [...changes.get(k)!].sort((x, y) => x - y);
    console.log(`  ${k.padEnd(16)} ${percentile(sorted, 0.05).toFixed(2).padStart(8)} ${percentile(sorted, 0.95).toFixed(2).padStart(8)}`);
  }
}

const games = argGames();
console.log(`President Sim engine simulation: TEST FIXTURE country and deck (invented values, never shipped), difficulty normal.`);
for (const bot of BOTS) run(bot, games);
