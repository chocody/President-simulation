// API handlers as plain functions: (body, deps) -> { status, body }. The route files only wrap these.
//
// ACCEPTED MVP TRADE-OFF: there is no database. The client keeps the GameState in localStorage and sends it with
// every request; the server validates its shape with the contract schema but cannot know whether the player
// edited the numbers. Fine for a single-player educational game; revisit before any leaderboard or share feature.
import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import {
  DecideRequest, GROUP_KEYS, GameState, Judgment, NewGameRequest,
  type CountryData, type Evidence, type Judgment as JudgmentT, type Scene,
} from "@ps/shared";
import { advanceQuarter, buildTurnScenes, EngineError, grades, legacyScore, newGame, resolveTurn, turnActions } from "@ps/engine";
import type { Content } from "./content";
import { MockGameMaster, mockPresetJudgment, type GameMaster } from "./game-master";
import { GameMasterError } from "./real-game-master";
import type {
  AdvanceResponse, DecideResult, EndResponse, GameInfo, InfoResponse, NewResponse, PublicCard, PublicMinorEvent, PublicNewsItem,
} from "../lib/api-types";

export interface Deps {
  content: Content;
  gm: GameMaster;
  /** Seed source for new games. Default: crypto random (or PS_SEED, only under DEV_FIXTURES=1, for E2E). */
  seed?: () => string;
  /** Uniform [0,1) source for the weighted country pick. Default: crypto random. */
  random?: () => number;
}

export interface ApiResult { status: number; body: unknown }

const ok = (body: unknown): ApiResult => ({ status: 200, body });
const fail = (status: number, error: string): ApiResult => ({ status, body: { error } });

const StateBody = z.object({ state: GameState });

function badBody(e: z.ZodError): ApiResult {
  const i = e.issues[0];
  const where = i && i.path.length > 0 ? ` (${i.path.join(".")})` : "";
  return fail(400, `ข้อมูลที่ส่งมาไม่ถูกต้อง${where}`);
}

function defaultSeed(content: Content): string {
  if (content.devFixtures && process.env.PS_SEED) return process.env.PS_SEED;
  return randomBytes(8).toString("hex");
}

function defaultRandom(): number {
  return randomInt(0, 2 ** 31) / 2 ** 31;
}

/** Weighted by population. `u` in [0,1). */
export function pickCountry(countries: CountryData[], u: number): CountryData | null {
  if (countries.length === 0) return null;
  const total = countries.reduce((a, c) => a + c.population, 0);
  let r = u * total;
  for (const c of countries) {
    r -= c.population;
    if (r < 0) return c;
  }
  return countries[countries.length - 1] ?? null;
}

function gameInfo(content: Content, country: CountryData): GameInfo {
  const ids = new Set(
    [...Object.values(country.baselineSrc), ...Object.values(country.groupSharesSrc), ...Object.values(country.traitsSrc ?? {})]
      .map((p) => p.sourceId),
  );
  return {
    country,
    sources: content.sources.filter((s) => ids.has(s.id)),
    devFixtures: content.devFixtures,
    minorEvents: content.minorEvents.map(publicMinorEvent),
  };
}

function publicMinorEvent(e: Content["minorEvents"][number]): PublicMinorEvent {
  return { id: e.id, category: e.category, textTh: e.textTh, effects: e.effects.map((x) => ({ target: x.target, delta: x.delta })) };
}

/** The country behind a saved state. Unknown (e.g. content changed since the save) means neutral traits. */
function countryOf(content: Content, state: GameState): CountryData | undefined {
  return content.countries.find((c) => c.iso3 === state.countryIso3);
}

function publicCard(card: Content["cards"][number]): PublicCard {
  return {
    id: card.id, category: card.category, severity: card.severity, titleTh: card.titleTh, situationTh: card.situationTh,
    choices: card.choices.map((c) => ({
      id: c.id, approach: c.approach, titleTh: c.titleTh, descTh: c.descTh, costHint: c.costHint,
      affectedGroups: c.affectedGroups, evidenceIds: c.evidenceIds,
    })),
  };
}

// ---------- GET info ----------

export async function handleInfo(query: { iso3?: string | null }, deps: Deps): Promise<ApiResult> {
  const { content } = deps;
  const body: InfoResponse = {
    devFixtures: content.devFixtures,
    countries: content.countries.map((c) => ({ iso3: c.iso3, nameTh: c.nameTh, nameEn: c.nameEn })),
  };
  if (query.iso3) {
    const country = content.countries.find((c) => c.iso3 === query.iso3);
    if (!country) return fail(404, "ไม่พบประเทศที่ระบุ");
    body.info = gameInfo(content, country);
  }
  return ok(body);
}

// ---------- POST new ----------

export async function handleNew(body: unknown, deps: Deps): Promise<ApiResult> {
  const parsed = NewGameRequest.safeParse(body);
  if (!parsed.success) return badBody(parsed.error);
  const { content } = deps;
  if (content.countries.length === 0) {
    return fail(409, "ยังไม่มีข้อมูลประเทศจริง จึงยังเริ่มเกมไม่ได้");
  }
  const { difficulty, iso3 } = parsed.data;
  const country = iso3
    ? content.countries.find((c) => c.iso3 === iso3)
    : pickCountry(content.countries, (deps.random ?? defaultRandom)());
  if (!country) return fail(404, "ไม่พบประเทศที่ระบุ");
  const seed = (deps.seed ?? (() => defaultSeed(content)))();
  const state = newGame({ country, difficulty, seed });
  const res: NewResponse = { state, info: gameInfo(content, country) };
  return ok(res);
}

// ---------- POST advance ----------

export async function handleAdvance(body: unknown, deps: Deps): Promise<ApiResult> {
  const parsed = StateBody.safeParse(body);
  if (!parsed.success) return badBody(parsed.error);
  let state = parsed.data.state;
  const { content } = deps;
  if (state.phase === "ended") return fail(400, "เกมจบแล้ว ไม่สามารถเดินเวลาต่อได้");
  const logStart = state.log.length;
  const newsStart = state.news?.length ?? 0;
  const scenesStart = state.scenes?.length ?? 0;
  const traits = countryOf(content, state)?.traits;
  try {
    // Running -> next decision or the end. A pending decision is returned as is (safe to call twice).
    for (let i = 0; i < 20 && state.phase === "running"; i++) {
      state = advanceQuarter(state, content.cards, content.minorEvents, { traits }, content.scenes);
    }
  } catch (e) {
    if (e instanceof EngineError) return fail(400, "สถานะเกมไม่ถูกต้อง ไม่สามารถเดินเวลาต่อได้");
    throw e;
  }
  const card = state.phase === "decision" ? content.cards.find((c) => c.id === state.pendingCardId) : undefined;
  if (state.phase === "decision" && !card) return fail(400, "ไม่พบการ์ดเหตุการณ์ของเกมนี้");
  const byId = new Map(content.minorEvents.map((e) => [e.id, e]));
  const news: PublicNewsItem[] = (state.news ?? []).slice(newsStart).flatMap((n) => {
    const e = byId.get(n.id);
    return e ? [{ ...publicMinorEvent(e), quarter: n.quarter }] : [];
  });
  const res: AdvanceResponse = {
    state,
    log: state.log.slice(logStart),
    card: card ? publicCard(card) : null,
    news,
    scenes: (state.scenes ?? []).slice(scenesStart),
  };
  return ok(res);
}

// ---------- POST decide ----------

export async function handleDecide(body: unknown, deps: Deps): Promise<ApiResult> {
  const parsed = DecideRequest.safeParse(body);
  if (!parsed.success) return badBody(parsed.error);
  const { state, answer } = parsed.data;
  const { content, gm } = deps;
  if (state.phase !== "decision") return fail(400, "ตอนนี้ไม่มีเหตุการณ์ที่ต้องตัดสินใจ");
  const card = content.cards.find((c) => c.id === state.pendingCardId);
  if (!card) return fail(400, "ไม่พบการ์ดเหตุการณ์ของเกมนี้");

  const byId = new Map<string, Evidence>(content.evidence.map((e) => [e.id, e]));
  const pick = (ids: string[]): Evidence[] => ids.map((id) => byId.get(id)).filter((e): e is Evidence => e !== undefined);

  let judgment: JudgmentT;
  let evidence: Evidence[];
  let answerTitle: string;
  if (answer.kind === "preset") {
    const choice = card.choices.find((c) => c.id === answer.choiceId);
    if (!choice) return fail(400, "ไม่พบตัวเลือกที่เลือก");
    evidence = pick(choice.evidenceIds);
    answerTitle = choice.titleTh;
    if (choice.judgment) {
      judgment = choice.judgment;
    } else if (content.devFixtures) {
      judgment = mockPresetJudgment(choice, content.evidence);
    } else {
      return fail(422, "ตัวเลือกนี้ยังไม่ได้ตัดสินล่วงหน้า (pre-judge) จึงยังเล่นไม่ได้");
    }
  } else {
    const text = answer.text.trim();
    if (text.length < 20) return fail(400, "คำตอบสั้นเกินไป (อย่างน้อย 20 ตัวอักษร)");
    evidence = pick([...new Set(card.choices.flatMap((c) => c.evidenceIds))]);
    answerTitle = text.length > 40 ? `${text.slice(0, 40)}…` : text;
    try {
      judgment = Judgment.parse(await gm.judge({ state, card, playerText: text, evidence }));
    } catch (e) {
      // A refusal is an in-game outcome with its own message; other failures are retryable.
      if (e instanceof GameMasterError && e.reason === "refused") return fail(422, e.message);
      return fail(502, "ผู้ตัดสินคำตอบ (game master) ทำงานผิดพลาด ลองใหม่อีกครั้ง");
    }
  }

  let turn: ReturnType<typeof resolveTurn>;
  let scenes: Scene[];
  try {
    const traits = countryOf(content, state)?.traits;
    turn = resolveTurn(state, content.cards, { kind: answer.kind, judgment }, { evidence, traits });
    const built = buildTurnScenes({
      state: turn.state, report: turn.report, card, actions: turnActions(judgment), library: content.scenes, traits,
    });
    turn = { state: built.state, report: turn.report };
    scenes = built.scenes;
  } catch (e) {
    if (e instanceof EngineError) return fail(400, "สถานะเกมไม่ถูกต้อง ไม่สามารถตัดสินได้");
    throw e;
  }

  // The narrator gets what happened, plus the forecast marked as such (it must not narrate it as done).
  const toNarrate = scenes.map((x) => x.kind === "upcoming"
    ? { ...x, textTh: `[คาดว่าจะตามมาราวไตรมาสที่ ${x.atQuarter ?? "-"}] ${x.textTh}` }
    : x);
  const mockScenes = scenes.filter((x) => x.kind !== "upcoming");
  let narration: { narration: string; headlines: string[] };
  try {
    narration = await gm.narrate({ state: turn.state, card, report: turn.report, answerTitle, scenes: gm instanceof MockGameMaster ? mockScenes : toNarrate });
  } catch {
    // The turn is already resolved; do not lose it. Fall back to the template narration (tagged as such).
    narration = await new MockGameMaster().narrate({ state: turn.state, card, report: turn.report, answerTitle, scenes: mockScenes });
  }

  const res: DecideResult = {
    state: turn.state,
    report: turn.report,
    narration: narration.narration,
    scenes,
    headlines: narration.headlines,
    answerTitle,
    interpretation: answer.kind === "free" ? judgment.interpretation : null,
  };
  return ok(res);
}

// ---------- POST end ----------

export async function handleEnd(body: unknown, deps: Deps): Promise<ApiResult> {
  const parsed = StateBody.safeParse(body);
  if (!parsed.success) return badBody(parsed.error);
  const { state } = parsed.data;
  if (state.phase !== "ended") return fail(400, "เกมยังไม่จบ");
  const g = grades(state);
  const legacy = legacyScore(state);
  let historian: { archetype: string; line: string };
  try {
    historian = await deps.gm.historian({ state, grades: g, legacy });
  } catch {
    historian = await new MockGameMaster().historian({ state, grades: g, legacy });
  }
  const groups = GROUP_KEYS.map((group) => {
    const { share, satisfaction } = state.groups[group];
    return { group, share, satisfaction, contribution: share * satisfaction };
  });
  const sum = groups.reduce((a, x) => a + x.contribution, 0);
  const res: EndResponse = {
    endReason: state.endReason,
    voteShare: state.voteShare,
    groups,
    otherPart: state.voteShare === null ? null : state.voteShare - sum,
    grades: g,
    legacy,
    popularity: state.popularity,
    historian,
  };
  return ok(res);
}

