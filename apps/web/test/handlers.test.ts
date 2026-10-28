import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { DecideResponse, GameState } from "@ps/shared";
import { loadContent, type Content } from "../server/content";
import { MockGameMaster, type GameMaster } from "../server/game-master";
import {
  handleAdvance, handleDecide, handleEnd, handleInfo, handleNew, pickCountry, type Deps,
} from "../server/handlers";
import { FIXTURE_COUNTRY } from "../dev/fixture-country";

const DATA = resolve(import.meta.dirname, "../../../data");
const content: Content = loadContent({ dataDir: DATA, devFixtures: true });
const noFixtures: Content = loadContent({ dataDir: DATA, devFixtures: false });
const noCountries: Content = { ...noFixtures, countries: [] };

function deps(over: Partial<Deps> = {}): Deps {
  return { content, gm: new MockGameMaster(), seed: () => "handler-test-seed", random: () => 0.5, ...over };
}

type Body = Record<string, any>;

async function started(d = deps()): Promise<GameState> {
  const r = await handleNew({ difficulty: "normal" }, d);
  expect(r.status).toBe(200);
  return (r.body as Body).state as GameState;
}

async function toDecision(d = deps()): Promise<{ state: GameState; card: Body }> {
  const s = await started(d);
  const r = await handleAdvance({ state: s }, d);
  expect(r.status).toBe(200);
  const b = r.body as Body;
  expect(b.state.phase).toBe("decision");
  return { state: b.state, card: b.card };
}

describe("handleInfo", () => {
  it("lists the fixture country and the dev flag", async () => {
    const r = await handleInfo({}, deps());
    expect(r.status).toBe(200);
    const b = r.body as Body;
    expect(b.devFixtures).toBe(true);
    expect(b.countries.map((c: Body) => c.iso3)).toEqual([FIXTURE_COUNTRY.iso3]);
  });

  it("returns country and sources for an iso3", async () => {
    const r = await handleInfo({ iso3: FIXTURE_COUNTRY.iso3 }, deps());
    const b = r.body as Body;
    expect(b.info.country.iso3).toBe(FIXTURE_COUNTRY.iso3);
    expect(b.info.sources.length).toBeGreaterThan(0);
  });

  it("lists the real countries without fixtures", async () => {
    const r = await handleInfo({}, deps({ content: noFixtures }));
    expect((r.body as Body).countries.length).toBe(10);
    expect((r.body as Body).devFixtures).toBe(false);
  });

  it("404s on an unknown iso3", async () => {
    expect((await handleInfo({ iso3: "QQQ" }, deps())).status).toBe(404);
  });
});

describe("pickCountry", () => {
  const mk = (iso3: string, population: number) => ({ ...FIXTURE_COUNTRY, iso3, population });
  it("weights by population", () => {
    const cs = [mk("AAA", 1), mk("BBB", 3)];
    expect(pickCountry(cs, 0.0)?.iso3).toBe("AAA");
    expect(pickCountry(cs, 0.24)?.iso3).toBe("AAA");
    expect(pickCountry(cs, 0.26)?.iso3).toBe("BBB");
    expect(pickCountry(cs, 0.999)?.iso3).toBe("BBB");
  });
  it("returns null for no countries", () => {
    expect(pickCountry([], 0.5)).toBeNull();
  });
});

describe("POST new", () => {
  it("creates a valid state for the fixture country", async () => {
    const s = await started();
    expect(GameState.safeParse(s).success).toBe(true);
    expect(s.countryIso3).toBe(FIXTURE_COUNTRY.iso3);
    expect(s.quarter).toBe(1);
    expect(s.phase).toBe("running");
    expect(s.seed).toBe("handler-test-seed");
  });

  it("returns the country info with it", async () => {
    const r = await handleNew({ difficulty: "easy", iso3: FIXTURE_COUNTRY.iso3 }, deps());
    const b = r.body as Body;
    expect(b.info.country.nameEn).toContain("DEV FIXTURE");
    expect(b.info.devFixtures).toBe(true);
  });

  it("says there is no real country data when there are none", async () => {
    const r = await handleNew({ difficulty: "normal" }, deps({ content: noCountries }));
    expect(r.status).toBe(409);
    expect((r.body as Body).error).toContain("ยังไม่มีข้อมูลประเทศจริง");
  });

  it("400s with a Thai message on a bad body", async () => {
    const r = await handleNew({ difficulty: "impossible" }, deps());
    expect(r.status).toBe(400);
    expect((r.body as Body).error).toMatch(/[฀-๿]/);
  });

  it("404s on an unknown iso3", async () => {
    expect((await handleNew({ difficulty: "normal", iso3: "QQQ" }, deps())).status).toBe(404);
  });

  it("uses a random seed by default", async () => {
    const d = deps();
    delete d.seed;
    const a = await started(d);
    const b = await started(d);
    expect(a.seed).not.toBe(b.seed);
    expect(a.seed.length).toBeGreaterThanOrEqual(8);
  });
});

describe("POST advance", () => {
  it("runs to the next decision and returns the card without judgments", async () => {
    const { state, card } = await toDecision();
    expect(state.pendingCardId).toBe(card.id);
    expect(card.choices).toHaveLength(3);
    for (const c of card.choices) {
      expect(c).not.toHaveProperty("judgment");
      expect(c.titleTh).toBeTruthy();
      expect(c.costHint).toBeTruthy();
    }
  });

  it("returns the log lines it produced", async () => {
    const s = await started();
    const r = await handleAdvance({ state: s }, deps());
    const b = r.body as Body;
    expect(Array.isArray(b.log)).toBe(true);
    expect(b.log.length).toBeGreaterThan(0);
    expect(b.state.log.slice(-b.log.length)).toEqual(b.log);
  });

  it("is idempotent while a decision is pending", async () => {
    const { state, card } = await toDecision();
    const r = await handleAdvance({ state }, deps());
    const b = r.body as Body;
    expect(b.state).toEqual(state);
    expect(b.card.id).toBe(card.id);
  });

  it("400s on an invalid state", async () => {
    const r = await handleAdvance({ state: { nope: 1 } }, deps());
    expect(r.status).toBe(400);
    expect((r.body as Body).error).toMatch(/[฀-๿]/);
  });

  it("400s when the game is over", async () => {
    const s = { ...(await started()), phase: "ended" as const };
    expect((await handleAdvance({ state: s }, deps())).status).toBe(400);
  });
});

describe("POST decide", () => {
  it("resolves a preset choice", async () => {
    const { state } = await toDecision();
    const r = await handleDecide({ state, answer: { kind: "preset", choiceId: "a" } }, deps());
    expect(r.status).toBe(200);
    const b = r.body as Body;
    expect(DecideResponse.safeParse(b).success).toBe(true);
    expect(b.state.phase).toBe("running");
    expect(b.state.pendingCardId).toBeNull();
    expect(b.state.cardHistory).toHaveLength(1);
    expect(b.report.answerKind).toBe("preset");
    expect(b.narration.length).toBeGreaterThan(10);
    expect(Array.isArray(b.headlines)).toBe(true);
  });

  it("resolves a typed answer through the game master", async () => {
    const { state } = await toDecision();
    const text = "เพิ่มงบสาธารณสุขและสร้างโรงพยาบาลชุมชนทั่วประเทศภายในสองปี";
    const r = await handleDecide({ state, answer: { kind: "free", text } }, deps());
    expect(r.status).toBe(200);
    const b = r.body as Body;
    expect(b.report.answerKind).toBe("free");
    expect(b.report.measures).toHaveLength(1);
  });

  it("passes the card's evidence to the judge", async () => {
    const { state, card } = await toDecision();
    let seen: string[] = [];
    const spy: GameMaster = {
      ...new MockGameMaster(),
      judge: async (input) => { seen = input.evidence.map((e) => e.id); return new MockGameMaster().judge(input); },
      narrate: (i) => new MockGameMaster().narrate(i),
      historian: (i) => new MockGameMaster().historian(i),
    };
    await handleDecide({ state, answer: { kind: "free", text: "ทำให้ครบถ้วนและโปร่งใสต่อสาธารณะ" } }, deps({ gm: spy }));
    const expected = new Set<string>(card.choices.flatMap((c: Body) => c.evidenceIds));
    expect(new Set(seen)).toEqual(expected);
  });

  it("400s on too-short typed text", async () => {
    const { state } = await toDecision();
    const r = await handleDecide({ state, answer: { kind: "free", text: "สั้น" } }, deps());
    expect(r.status).toBe(400);
    expect((r.body as Body).error).toMatch(/[฀-๿]/);
  });

  it("400s on an unknown choice id and when no decision is pending", async () => {
    const { state } = await toDecision();
    expect((await handleDecide({ state, answer: { kind: "preset", choiceId: "z" } }, deps())).status).toBe(400);
    const running = await started();
    expect((await handleDecide({ state: running, answer: { kind: "preset", choiceId: "a" } }, deps())).status).toBe(400);
  });

  it("returns a clear error for a null judgment when fixtures are off", async () => {
    const { state } = await toDecision();
    const unjudged: Content = { ...noFixtures, cards: noFixtures.cards.map((c) => ({ ...c, choices: c.choices.map((ch) => ({ ...ch, judgment: null })) })) };
    const r = await handleDecide({ state, answer: { kind: "preset", choiceId: "a" } }, deps({ content: unjudged }));
    expect(r.status).toBe(422);
    expect((r.body as Body).error).toContain("ยังไม่ได้ตัดสิน");
  });

  it("uses the pre-judged judgment when present", async () => {
    const { state } = await toDecision();
    const withJudged: Content = {
      ...noFixtures,
      cards: noFixtures.cards.map((c) => ({
        ...c,
        choices: c.choices.map((ch) => ({
          ...ch,
          judgment: new MockGameMaster().judgeSync("ทดสอบการตัดสินที่ตัดสินไว้ล่วงหน้า"),
        })),
      })),
    };
    const r = await handleDecide({ state, answer: { kind: "preset", choiceId: "b" } }, deps({ content: withJudged }));
    expect(r.status).toBe(200);
  });

  it("returns 502 when the game master fails", async () => {
    const { state } = await toDecision();
    const broken: GameMaster = {
      judge: async () => { throw new Error("boom"); },
      narrate: async () => { throw new Error("boom"); },
      historian: async () => { throw new Error("boom"); },
    };
    const r = await handleDecide(
      { state, answer: { kind: "free", text: "ทดสอบคำตอบที่ยาวพอสำหรับการตรวจสอบ" } }, deps({ gm: broken }),
    );
    expect(r.status).toBe(502);
    expect((r.body as Body).error).toMatch(/[฀-๿]/);
  });

  it("is deterministic for the same state and answer", async () => {
    const { state } = await toDecision();
    const a = await handleDecide({ state, answer: { kind: "preset", choiceId: "c" } }, deps());
    const b = await handleDecide({ state, answer: { kind: "preset", choiceId: "c" } }, deps());
    expect(a.body).toEqual(b.body);
  });
});

describe("POST end", () => {
  it("400s unless the game has ended", async () => {
    expect((await handleEnd({ state: await started() }, deps())).status).toBe(400);
  });

  it("plays a whole term with presets and a typed answer, then reports the ending", async () => {
    const d = deps();
    let state = await started(d);
    let typed = false;
    let decisions = 0;
    for (let i = 0; i < 40 && state.phase !== "ended"; i++) {
      const adv = await handleAdvance({ state }, d);
      expect(adv.status).toBe(200);
      state = (adv.body as Body).state;
      if (state.phase === "decision") {
        decisions++;
        const answer = !typed && decisions === 2
          ? { kind: "free" as const, text: "ลดภาษีให้ผู้มีรายได้น้อยและตรวจสอบงบประมาณอย่างโปร่งใส" }
          : { kind: "preset" as const, choiceId: ["a", "b", "c"][decisions % 3]! };
        if (answer.kind === "free") typed = true;
        const dec = await handleDecide({ state, answer }, d);
        expect(dec.status).toBe(200);
        state = (dec.body as Body).state;
      }
    }
    expect(state.phase).toBe("ended");
    const r = await handleEnd({ state }, d);
    expect(r.status).toBe(200);
    const b = r.body as Body;
    expect(Object.keys(b.grades).sort()).toEqual(["economy", "other", "politics", "society"]);
    for (const g of Object.values(b.grades) as Body[]) expect("ABCDF").toContain(g.grade);
    expect(b.legacy).toBeGreaterThanOrEqual(0);
    expect(b.legacy).toBeLessThanOrEqual(100);
    expect(b.historian.line.startsWith("ประวัติศาสตร์จะจดจำคุณว่า")).toBe(true);
    expect(b.endReason).toBe(state.endReason);
    expect(b.groups).toHaveLength(5);
    for (const g of b.groups) expect(g.contribution).toBeCloseTo(g.share * g.satisfaction, 6);
    if (state.voteShare !== null) {
      expect(b.voteShare).toBe(state.voteShare);
      const sum = b.groups.reduce((a: number, g: Body) => a + g.contribution, 0);
      expect(b.otherPart).toBeCloseTo(state.voteShare - sum, 6);
    }
  });
});

describe("handleNew reroll (exclude)", () => {
  const real = (random: number) => deps({ content: noFixtures, random: () => random });
  it("never offers an excluded country while others are left", async () => {
    const all = noFixtures.countries.map((c) => c.iso3);
    for (let k = 0; k < all.length - 1; k++) {
      const exclude = all.slice(0, k + 1);
      for (const r of [0, 0.3, 0.6, 0.999]) {
        const res = await handleNew({ difficulty: "normal", exclude }, real(r));
        expect(res.status).toBe(200);
        expect(exclude).not.toContain((res.body as { state: GameState }).state.countryIso3);
      }
    }
  });
  it("draws from every country again once all were offered", async () => {
    const all = noFixtures.countries.map((c) => c.iso3);
    const res = await handleNew({ difficulty: "normal", exclude: all }, real(0.5));
    expect(res.status).toBe(200);
    expect(all).toContain((res.body as { state: GameState }).state.countryIso3);
  });
  it("rejects a malformed exclude list", async () => {
    expect((await handleNew({ difficulty: "normal", exclude: ["TOOLONG"] }, real(0.5))).status).toBe(400);
  });
});
