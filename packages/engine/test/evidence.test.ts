import { describe, expect, it } from "vitest";
import type { Evidence } from "@ps/shared";
import { effectiveLevel } from "@ps/engine";
import { fixtureEvidence } from "./fixtures/evidence";
import { effect } from "./fixtures/judgments";

const provided = new Map<string, Evidence>(fixtureEvidence.map((e) => [e.id, e]));

describe("evidence.effectiveLevel", () => {
  it("keeps level 2-3 with a matching id, indicator and direction", () => {
    for (const level of ["2", "3"] as const) {
      const e = effect({ indicator: "health", direction: "up", level, evidence_ids: ["ev.test.health-up"] });
      expect(effectiveLevel(e, provided)).toEqual({ level, downgraded: false });
    }
  });

  it("downgrades when the id is not provided", () => {
    const e = effect({ level: "3", evidence_ids: ["ev.unknown"] });
    expect(effectiveLevel(e, provided)).toEqual({ level: "1", downgraded: true });
  });

  it("downgrades when there are no ids at all", () => {
    expect(effectiveLevel(effect({ level: "2", evidence_ids: [] }), provided)).toEqual({ level: "1", downgraded: true });
  });

  it("downgrades on a wrong indicator", () => {
    const e = effect({ indicator: "education", direction: "up", level: "2", evidence_ids: ["ev.test.health-up"] });
    expect(effectiveLevel(e, provided).level).toBe("1");
  });

  it("downgrades on a wrong direction", () => {
    const e = effect({ indicator: "health", direction: "down", level: "2", evidence_ids: ["ev.test.health-up"] });
    expect(effectiveLevel(e, provided)).toEqual({ level: "1", downgraded: true });
  });

  it("allows evidence with direction 'mixed'", () => {
    for (const direction of ["up", "down"] as const) {
      const e = effect({ indicator: "health", direction, level: "3", evidence_ids: ["ev.test.health-mixed"] });
      expect(effectiveLevel(e, provided)).toEqual({ level: "3", downgraded: false });
    }
  });

  it("one valid id among invalid ones is enough", () => {
    const e = effect({ level: "2", evidence_ids: ["nope", "ev.test.crime-down", "ev.test.health-up"] });
    expect(effectiveLevel(e, provided).level).toBe("2");
  });

  it("level 1 is never touched and never reported as downgraded", () => {
    const e = effect({ level: "1", evidence_ids: [] });
    expect(effectiveLevel(e, provided)).toEqual({ level: "1", downgraded: false });
  });
});
