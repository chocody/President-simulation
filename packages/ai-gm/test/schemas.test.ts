import { describe, it, expect } from "vitest";
import { outputFormat } from "../src/output-format";
import { Judgment } from "@ps/shared";
import {
  HistorianWire, JudgmentWire, NarratorWire, WIRE_TARGETS, toHistorian, toJudgment, toNarration,
} from "../src/schemas";
import { wireJudgment } from "./helpers";

describe("JudgmentWire", () => {
  it("lists the 15 stats and 5 groups as plain enum values", () => {
    expect(WIRE_TARGETS).toHaveLength(20);
    expect(WIRE_TARGETS).toContain("group:military");
    expect(WIRE_TARGETS).toContain("foreignRelations");
  });

  it("accepts a valid wire judgment", () => {
    expect(JudgmentWire.safeParse(wireJudgment()).success).toBe(true);
  });

  it("is accepted by zodOutputFormat (structured-output schema conversion)", () => {
    expect(() => outputFormat(JudgmentWire)).not.toThrow();
    expect(() => outputFormat(NarratorWire)).not.toThrow();
    expect(() => outputFormat(HistorianWire)).not.toThrow();
  });

  it("keeps real enums in the JSON schema (the SDK helper alone turns them into prose)", () => {
    const schema = JSON.stringify(outputFormat(JudgmentWire).schema);
    expect(schema).toContain('"enum":["gdpGrowth"');
    expect(schema).toContain('"group:military"');
    expect(schema).toContain('"enum":["up","down"]');
    expect(schema).toContain('"enum":["normal","meta","off_topic","harmful","gibberish"]');
  });

  it("does not emit the contract's template-literal pattern", () => {
    const json = JSON.stringify(outputFormat(JudgmentWire));
    expect(json).not.toContain("^group:");
  });
});

describe("toJudgment", () => {
  it("converts a wire judgment to the contract Judgment", () => {
    const j = toJudgment(JudgmentWire.parse(wireJudgment()));
    expect(Judgment.safeParse(j).success).toBe(true);
    expect(j.actions[0]!.effects[0]!.indicator).toBe("group:urban");
  });

  it("rejects an unknown target", () => {
    const bad = wireJudgment();
    bad.actions[0].effects[0].indicator = "group:aliens";
    expect(() => toJudgment(bad)).toThrow();
    expect(JudgmentWire.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown target in side_effects too", () => {
    const bad = wireJudgment();
    bad.actions[0].side_effects = [{ ...bad.actions[0].effects[0], indicator: "happiness" }];
    expect(() => toJudgment(bad)).toThrow();
  });
});

describe("narrator and historian outputs", () => {
  it("narration needs exactly 3 headlines", () => {
    const ok = { narration: "n", headlines: ["a", "b", "c"], chronicleLine: "l" };
    expect(toNarration(ok).headlines).toHaveLength(3);
    expect(() => toNarration({ ...ok, headlines: ["a", "b"] })).toThrow();
  });

  const notes = { economy: "e", society: "s", politics: "p", other: "o" };
  it("historian line must start with the required phrase", () => {
    const ok = { archetype: "ผู้ปฏิรูป", line: "ประวัติศาสตร์จะจดจำคุณว่า ผู้นำที่เลือกทางสายกลาง", gradeNotes: notes };
    expect(toHistorian(ok).archetype).toBe("ผู้ปฏิรูป");
    expect(() => toHistorian({ ...ok, line: "คุณเป็นผู้นำที่ดี" })).toThrow();
  });

  it("historian line must be under 25 words", () => {
    const long = "ประวัติศาสตร์จะจดจำคุณว่า " + Array.from({ length: 30 }, () => "word").join(" ");
    expect(() => toHistorian({ archetype: "x", line: long, gradeNotes: notes })).toThrow();
  });
});
