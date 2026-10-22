import { describe, expect, it } from "vitest";
import { GameState, PACING } from "@ps/shared";
import { advanceQuarter, newGame, resolveTurn } from "@ps/engine";
import { fixtureCountry } from "./fixtures/country";
import { fixtureDeck } from "./fixtures/cards";
import { fixtureEvidence } from "./fixtures/evidence";

const byId = new Map(fixtureEvidence.map((e) => [e.id, e]));

function playGame(seed: string, pick: "a" | "b" | "c") {
  let s = newGame({ country: fixtureCountry, difficulty: "normal", seed });
  const decisionQuarters: number[] = [];
  for (let guard = 0; guard < 40 && s.phase !== "ended"; guard++) {
    if (s.phase === "decision") {
      const card = fixtureDeck.find((c) => c.id === s.pendingCardId)!;
      const choice = card.choices.find((c) => c.id === pick)!;
      decisionQuarters.push(s.quarter);
      s = resolveTurn(s, fixtureDeck, {
        kind: "preset", judgment: choice.judgment!,
      }, { evidence: choice.evidenceIds.map((id) => byId.get(id)!).filter(Boolean) }).state;
    }
    s = advanceQuarter(s, fixtureDeck);
  }
  return { s, decisionQuarters };
}

describe("full game", () => {
  it("fixtures: the deck parses against the contract", async () => {
    const { Card, CountryData } = await import("@ps/shared");
    for (const c of fixtureDeck) expect(() => Card.parse(c)).not.toThrow();
    expect(() => CountryData.parse(fixtureCountry)).not.toThrow();
  });

  it("newGame builds the documented starting state", () => {
    const s = newGame({ country: fixtureCountry, difficulty: "hard", seed: "init" });
    expect(() => GameState.parse(s)).not.toThrow();
    expect(s.quarter).toBe(1);
    expect(s.phase).toBe("running");
    expect(s.stats.budget).toBeCloseTo(0.25, 10); // hard: 1% of GDP / 4
    expect(s.stats.debt).toBe(fixtureCountry.baseline.debt);
    expect(s.groups.urban).toEqual({ share: 0.35, satisfaction: 50 });
    expect(s.popularity).toBeCloseTo(50, 10);
    expect(s.econHistory).toHaveLength(1);
    expect(s.pillarsAtStart.economy).toBe(s.econHistory[0]);
    expect(s.rngCursor).toBe(0);
  });

  it.each(["a", "b", "c"] as const)("always-%s reaches phase 'ended' by quarter 16 with an endReason", (pick) => {
    for (let i = 0; i < 25; i++) {
      const { s, decisionQuarters } = playGame(`game-${i}`, pick);
      expect(() => GameState.parse(s)).not.toThrow();
      expect(s.phase).toBe("ended");
      expect(s.quarter).toBeLessThanOrEqual(16);
      expect(s.endReason).not.toBeNull();
      expect(s.pendingCardId).toBeNull();
      for (const q of decisionQuarters) expect(PACING.value.decisionQuarters).toContain(q);
      if (s.endReason === "won_election" || s.endReason === "lost_election") {
        expect(s.quarter).toBe(16);
        expect(s.voteShare).not.toBeNull();
      }
    }
  });

  it("is reproducible: same seed and choices give the same final state", () => {
    expect(playGame("repro", "b").s).toEqual(playGame("repro", "b").s);
  });

  it("different seeds do not all give the same game", () => {
    const shares = new Set<number | null>();
    for (let i = 0; i < 10; i++) shares.add(playGame(`var-${i}`, "b").s.voteShare);
    expect(shares.size).toBeGreaterThan(3);
  });

  it("advanceQuarter refuses a state that is not running", () => {
    const s = newGame({ country: fixtureCountry, difficulty: "normal", seed: "x" });
    expect(() => advanceQuarter({ ...s, phase: "decision" }, fixtureDeck)).toThrow();
    expect(() => advanceQuarter({ ...s, phase: "ended" }, fixtureDeck)).toThrow();
  });
});
