import { describe, expect, it } from "vitest";
import { rollOutcome, successProbability } from "@ps/engine";

const base = { feasibility: 3, specificity: 2, corruption: 60, nMeasures: 2, broke: false, difficulty: "normal" } as const;

describe("dice.successProbability", () => {
  it("worked example: feasibility 3, specificity 2, corruption 60, n 2 -> 37", () => {
    expect(successProbability(base)).toBe(37);
  });

  it("applies the broke penalty and the difficulty adjustment", () => {
    expect(successProbability({ ...base, broke: true })).toBe(37 - 15);
    expect(successProbability({ ...base, difficulty: "easy" })).toBe(47);
    expect(successProbability({ ...base, difficulty: "hard" })).toBe(27);
  });

  it("a single measure has no extra-measure penalty", () => {
    expect(successProbability({ ...base, nMeasures: 1 })).toBe(42);
  });

  it("clamps to [5, 95]", () => {
    expect(successProbability({ ...base, feasibility: 1, specificity: 1, corruption: 100, nMeasures: 3, broke: true, difficulty: "hard" })).toBe(5);
    expect(successProbability({ ...base, feasibility: 5, specificity: 5, corruption: 0, nMeasures: 1, difficulty: "easy" })).toBe(95);
  });
});

describe("dice.rollOutcome", () => {
  const P = 37;
  it("critical failure from roll 96, even when it would otherwise succeed", () => {
    expect(rollOutcome(95, 96)).toBe("critical_failure");
    expect(rollOutcome(P, 100)).toBe("critical_failure");
    expect(rollOutcome(95, 95)).toBe("success");
  });
  it("great success when roll <= P/4", () => {
    expect(rollOutcome(P, 9)).toBe("great_success"); // 9.25
    expect(rollOutcome(P, 10)).toBe("success");
    expect(rollOutcome(P, 1)).toBe("great_success");
  });
  it("success up to P, partial up to P + 20, failure after", () => {
    expect(rollOutcome(P, 37)).toBe("success");
    expect(rollOutcome(P, 38)).toBe("partial");
    expect(rollOutcome(P, 57)).toBe("partial");
    expect(rollOutcome(P, 58)).toBe("failure");
    expect(rollOutcome(P, 95)).toBe("failure");
  });
});
