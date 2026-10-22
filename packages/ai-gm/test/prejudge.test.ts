import { describe, it, expect } from "vitest";
import type { Judgment } from "@ps/shared";
import { buildPlayerText, estimatePrejudgeCost, median, pickMedianRun, planPrejudge } from "../src/prejudge";
import { loadCards, loadEvidence } from "../src/content";
import { PLAYER_TEXT_MAX, PLAYER_TEXT_MIN } from "../src/config";
import { wireJudgment } from "./helpers";
import { toJudgment } from "../src/schemas";

function withScores(s: [string, string, string, string, string]): Judgment {
  return toJudgment(wireJudgment({
    scores: { relevance: s[0], feasibility: s[1], specificity: s[2], tradeoffs: s[3], consistency: s[4] },
  }));
}

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("pickMedianRun", () => {
  it("picks the run closest to the per-criterion median", () => {
    const runs = [
      withScores(["2", "2", "2", "2", "2"]),
      withScores(["3", "3", "3", "3", "3"]),
      withScores(["5", "5", "5", "5", "5"]),
    ];
    expect(pickMedianRun(runs)).toBe(1);
  });

  it("works per criterion, not on the total", () => {
    const runs = [
      withScores(["5", "1", "3", "3", "3"]),
      withScores(["3", "3", "3", "3", "3"]),
      withScores(["1", "5", "3", "3", "3"]),
    ];
    // medians are 3,3,3,3,3 -> the middle run
    expect(pickMedianRun(runs)).toBe(1);
  });

  it("breaks ties by the earliest run", () => {
    const same = withScores(["3", "3", "3", "3", "3"]);
    expect(pickMedianRun([same, same, same])).toBe(0);
  });

  it("rejects an empty list", () => {
    expect(() => pickMedianRun([])).toThrow();
  });
});

describe("planPrejudge on the real cards", () => {
  const cards = loadCards();
  const evidence = loadEvidence();
  const plan = planPrejudge(cards, evidence);

  it("plans one entry per choice (3 per card)", () => {
    expect(plan).toHaveLength(cards.length * 3);
  });

  it("player text is titleTh + descTh and passes the length guard", () => {
    for (const p of plan) {
      expect(p.playerText.length).toBeGreaterThanOrEqual(PLAYER_TEXT_MIN);
      expect(p.playerText.length).toBeLessThanOrEqual(PLAYER_TEXT_MAX);
    }
    const c = cards[0]!.choices[0]!;
    expect(buildPlayerText(c)).toContain(c.titleTh);
    expect(buildPlayerText(c)).toContain(c.descTh);
  });

  it("attaches exactly the choice's evidence", () => {
    for (const p of plan) {
      const choice = cards.find((c) => c.id === p.cardId)!.choices.find((c) => c.id === p.choiceId)!;
      expect(p.evidence.map((e) => e.id)).toEqual(choice.evidenceIds);
    }
  });

  it("estimates a positive cost for 3 runs per choice", () => {
    const est = estimatePrejudgeCost(plan, 3);
    expect(est.calls).toBe(plan.length * 3);
    expect(est.costUsd).toBeGreaterThan(0);
  });
});
