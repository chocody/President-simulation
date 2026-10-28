// Bot simulation for the engine. Uses the TEST FIXTURE country and deck (invented values, never shipped).
// Usage: pnpm tsx scripts/simulate.ts --games 1000 [--real-countries]
// --real-countries plays the real data/countries/*.json (fixture deck still, since real choices are not pre-judged yet).
// --real-deck also loads data/events/minor.yaml (or --minor <file>) when present (the news ticker) and plays each country with its own traits
// (CountryData.traits, when the file has them). Prints the mean number of news items per quarter and, for the best bot,
// the win rate per country. It also loads data/scenes/*.yaml (consequence scenes) and prints scenes per decision (mean, min,
// max) and follow-up/court scenes per game.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import YAML from "yaml";
import {
  Card as CardSchema, CountryData, Evidence as EvidenceSchema, Judgment, MinorEvent as MinorEventSchema, SceneTemplate as SceneTemplateSchema, STAT_KEYS,
  type Card, type Evidence, type GameState, type MinorEvent, type SceneTemplate, type StatKey,
} from "@ps/shared";
import { advanceQuarter, buildTurnScenes, newGame, resolveTurn, turnActions, uniform } from "../packages/engine/src/index";
import { fixtureCountry } from "../packages/engine/test/fixtures/country";
import { fixtureDeck } from "../packages/engine/test/fixtures/cards";
import { fixtureEvidence } from "../packages/engine/test/fixtures/evidence";

type Bot = "always-a" | "always-b" | "always-c" | "random" | "best";
const BOTS: Bot[] = ["always-a", "always-b", "always-c", "random", "best"];
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



/** "best" stands in for a thoughtful player: the choice with the highest relevance + feasibility + tradeoffs. */
function bestChoice(card: Card): "a" | "b" | "c" {
  const score = (c: Card["choices"][number]) => {
    const s = c.judgment!.scores;
    return Number(s.relevance) + Number(s.feasibility) + Number(s.tradeoffs);
  };
  return [...card.choices].sort((x, y) => score(y) - score(x))[0]!.id as "a" | "b" | "c";
}

function chooseId(bot: Bot, game: number, q: number, card?: Card): "a" | "b" | "c" {
  if (bot === "best" && card) return bestChoice(card);
  if (bot === "always-a") return "a";
  if (bot === "always-b") return "b";
  if (bot === "always-c") return "c";
  // random bot: deterministic, driven by the engine's counter-based RNG
  return (["a", "b", "c"] as const)[Math.floor(uniform(`bot-random:${game}`, q) * 3)]!;
}

interface Result {
  final: GameState;
  yearly: Map<StatKey, number[]>;
  country: string;
  /** Quarters advanced (the news ticker runs once per advanced quarter). */
  quartersAdvanced: number;
  /** Number of scenes shown after each decision. */
  turnScenes: number[];
}

const REAL = process.argv.includes("--real-countries");
const REAL_DECK = process.argv.includes("--real-deck");
/** Real cards with their pre-judged choices merged in (data/prejudged), and the real evidence library. */
const realDeck = REAL_DECK ? loadRealDeck() : null;
const evidenceById = new Map<string, Evidence>((realDeck?.evidence ?? fixtureEvidence).map((e) => [e.id, e]));
const DECK: Card[] = realDeck?.deck ?? fixtureDeck;
/** Minor events: only with --real-deck, and only when the file exists (it is written by another lane). */
const MINOR_ARG = process.argv.indexOf("--minor");
const MINOR_PATH = MINOR_ARG >= 0 ? process.argv[MINOR_ARG + 1]! : "data/events/minor.yaml";
const MINOR: MinorEvent[] = REAL_DECK && existsSync(MINOR_PATH)
  ? (YAML.parse(readFileSync(MINOR_PATH, "utf8")) as unknown[]).map((e) => MinorEventSchema.parse(e))
  : [];

/** Scene templates: only with --real-deck, when data/scenes exists. */
const SCENES_DIR = "data/scenes";
const SCENE_LIBRARY: SceneTemplate[] = REAL_DECK && existsSync(SCENES_DIR)
  ? readdirSync(SCENES_DIR).filter((f) => f.endsWith(".yaml")).sort()
      .flatMap((f) => (YAML.parse(readFileSync(`${SCENES_DIR}/${f}`, "utf8")) as unknown[]).map((x) => SceneTemplateSchema.parse(x)))
  : [];

function loadRealDeck(): { deck: Card[]; evidence: Evidence[] } {
  const deck = readdirSync("data/cards").map((f) => CardSchema.parse(YAML.parse(readFileSync(`data/cards/${f}`, "utf8"))));
  for (const f of readdirSync("data/prejudged").filter((x) => x.endsWith(".json"))) {
    for (const e of JSON.parse(readFileSync(`data/prejudged/${f}`, "utf8"))) {
      deck.find((c) => c.id === e.cardId)!.choices.find((c) => c.id === e.choiceId)!.judgment = Judgment.parse(e.judgment);
    }
  }
  const evidence = (YAML.parse(readFileSync("data/evidence/evidence.yaml", "utf8")) as unknown[]).map((e) => EvidenceSchema.parse(e));
  return { deck, evidence };
}
const countries: CountryData[] = REAL
  ? readdirSync("data/countries").filter((f) => f.endsWith(".json") && !f.startsWith("_"))
      .map((f) => CountryData.parse(JSON.parse(readFileSync(`data/countries/${f}`, "utf8"))))
  : [fixtureCountry];

function playGame(bot: Bot, game: number, deck: Card[]): Result {
  const country = countries[game % countries.length]!;
  let s = newGame({ country, difficulty: "normal", seed: `sim-${game}` });
  const snapshots = new Map<number, GameState["stats"]>();
  let quartersAdvanced = 0;
  const turnScenes: number[] = [];
  for (let guard = 0; guard < 40 && s.phase !== "ended"; guard++) {
    if (s.phase === "decision") {
      const card = deck.find((c) => c.id === s.pendingCardId)!;
      const choice = card.choices.find((c) => c.id === chooseId(bot, game, s.quarter, card))!;
      const turn = resolveTurn(
        s, deck, { kind: "preset", judgment: choice.judgment! },
        { evidence: choice.evidenceIds.map((id) => evidenceById.get(id)).filter((e): e is Evidence => e !== undefined), traits: country.traits },
      );
      const built = buildTurnScenes({
        state: turn.state, report: turn.report, card, actions: turnActions(choice.judgment!), library: SCENE_LIBRARY, traits: country.traits,
      });
      s = built.state;
      turnScenes.push(built.scenes.length);
    }
    snapshots.set(s.quarter, { ...s.stats });
    const wasRunning = s.quarter < 16;
    s = advanceQuarter(s, deck, MINOR, { traits: country.traits }, SCENE_LIBRARY);
    if (wasRunning) quartersAdvanced++;
  }
  const yearly = new Map<StatKey, number[]>(STAT_KEYS.map((k) => [k, []]));
  for (let i = 1; i < YEAR_MARKS.length; i++) {
    const a = snapshots.get(YEAR_MARKS[i - 1]!);
    const b = snapshots.get(YEAR_MARKS[i]!);
    if (!a || !b) continue;
    for (const k of STAT_KEYS) yearly.get(k)!.push(b[k] - a[k]);
  }
  return { final: s, yearly, country: country.iso3, quartersAdvanced, turnScenes };
}

function run(bot: Bot, games: number): void {
  const endings = new Map<string, number>();
  let popSum = 0;
  let wins = 0;
  let newsItems = 0;
  let quarters = 0;
  const perDecision: number[] = [];
  let followups = 0;
  let courts = 0;
  const byCountry = new Map<string, { games: number; wins: number }>();
  const changes = new Map<StatKey, number[]>(STAT_KEYS.map((k) => [k, []]));
  for (let g = 0; g < games; g++) {
    const { final, yearly, country, quartersAdvanced, turnScenes } = playGame(bot, g, DECK);
    perDecision.push(...turnScenes);
    followups += (final.scenes ?? []).filter((x) => x.kind === "followup").length;
    courts += (final.scenes ?? []).filter((x) => x.kind === "court").length;
    const reason = final.endReason ?? "none";
    endings.set(reason, (endings.get(reason) ?? 0) + 1);
    if (reason === "won_election") wins++;
    newsItems += final.news?.length ?? 0;
    quarters += quartersAdvanced;
    const c = byCountry.get(country) ?? { games: 0, wins: 0 };
    c.games++;
    if (reason === "won_election") c.wins++;
    byCountry.set(country, c);
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
  if (MINOR.length > 0) console.log(`news items per quarter (mean over ${quarters} advanced quarters): ${(newsItems / Math.max(1, quarters)).toFixed(2)}`);
  if (SCENE_LIBRARY.length > 0 && perDecision.length > 0) {
    const mean = perDecision.reduce((a, b) => a + b, 0) / perDecision.length;
    const zero = perDecision.filter((n) => n === 0).length;
    console.log(
      `scenes per decision (${perDecision.length} decisions): mean ${mean.toFixed(2)}, min ${Math.min(...perDecision)}, max ${Math.max(...perDecision)}, ` +
      `none in ${((100 * zero) / perDecision.length).toFixed(1)}%`,
    );
    console.log(`follow-up scenes per game: ${(followups / games).toFixed(2)}, court scenes per game: ${(courts / games).toFixed(2)}`);
  }
  if (bot === "best" && byCountry.size > 1) {
    console.log("win rate per country (best bot):");
    for (const [iso, c] of [...byCountry.entries()].sort()) console.log(`  ${iso} ${((100 * c.wins) / c.games).toFixed(1)}% (${c.games} games)`);
  }
  console.log("yearly change per stat, 5th / 95th percentile:");
  for (const k of STAT_KEYS) {
    const sorted = [...changes.get(k)!].sort((x, y) => x - y);
    console.log(`  ${k.padEnd(16)} ${percentile(sorted, 0.05).toFixed(2).padStart(8)} ${percentile(sorted, 0.95).toFixed(2).padStart(8)}`);
  }
}

const games = argGames();
console.log(
  `President Sim engine simulation: ${REAL ? "real countries" : "TEST FIXTURE country"}, ${REAL_DECK ? "real deck (pre-judged)" : "TEST FIXTURE deck"}, ` +
  `${SCENE_LIBRARY.length > 0 ? `${SCENE_LIBRARY.length} scene templates` : "no scenes"}, ${MINOR.length > 0 ? `${MINOR.length} minor events` : "no minor events"}, difficulty normal.`,
);
for (const bot of BOTS) run(bot, games);
