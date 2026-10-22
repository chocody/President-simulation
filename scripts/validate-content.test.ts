import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { Card, Evidence, Source } from "@ps/shared";

const root = join(import.meta.dirname, "..");
const load = (rel: string): unknown => parse(readFileSync(join(root, rel), "utf8"));

const cardFiles = readdirSync(join(root, "data/cards")).filter((f) => f.endsWith(".yaml")).sort();
const evidenceRaw = load("data/evidence/evidence.yaml") as unknown[];
const researchRaw = load("data/sources/research-sources.yaml") as unknown[];
const sourcesRaw = load("data/sources/sources.yaml") as unknown[];

const research = researchRaw.map((s) => Source.parse(s));
const allSources = sourcesRaw.map((s) => Source.parse(s));
const evidence = evidenceRaw.map((e) => Evidence.parse(e));
const parsedCards = cardFiles.map((f) => Card.parse(load(`data/cards/${f}`)));

const dup = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe("research sources", () => {
  it("all parse as Source with kind research, unverified, and a search note", () => {
    expect(research.length).toBeGreaterThan(0);
    for (const s of research) {
      expect(s.kind).toBe("research");
      expect(s.verifiedBy).toBeNull();
      expect(s.note ?? "").toMatch(/search/i);
    }
  });
  it("ids are unique and do not collide with sources.yaml", () => {
    expect(dup(research.map((s) => s.id))).toEqual([]);
    const main = new Set(allSources.map((s) => s.id));
    expect(research.filter((s) => main.has(s.id)).map((s) => s.id)).toEqual([]);
  });
  it("every research source is cited by some evidence item", () => {
    const used = new Set(evidence.map((e) => e.sourceId));
    expect(research.filter((s) => !used.has(s.id)).map((s) => s.id)).toEqual([]);
  });
});

describe("evidence", () => {
  it("has about 20 items", () => {
    expect(evidence.length).toBeGreaterThanOrEqual(15);
    expect(evidence.length).toBeLessThanOrEqual(30);
  });
  it("ids are unique", () => {
    expect(dup(evidence.map((e) => e.id))).toEqual([]);
  });
  it("every sourceId exists in research-sources.yaml", () => {
    const ids = new Set(research.map((s) => s.id));
    expect(evidence.filter((e) => !ids.has(e.sourceId)).map((e) => e.id)).toEqual([]);
  });
  it("verifiedBy is null", () => {
    expect(evidence.filter((e) => e.verifiedBy !== null).map((e) => e.id)).toEqual([]);
  });
});

describe("cards", () => {
  it("there are 12 card files, each parsing as Card", () => {
    expect(cardFiles.length).toBe(12);
    expect(parsedCards.length).toBe(12);
  });
  it("card ids are unique and match the file name", () => {
    expect(dup(parsedCards.map((c) => c.id))).toEqual([]);
    parsedCards.forEach((c, i) => expect(cardFiles[i]).toBe(`${c.id}.yaml`));
  });
  it("category mix covers the spec", () => {
    const n = (cat: string) => parsedCards.filter((c) => c.category === cat).length;
    expect(n("disaster")).toBeGreaterThanOrEqual(2);
    expect(n("economy")).toBeGreaterThanOrEqual(2);
    expect(n("society")).toBeGreaterThanOrEqual(2);
    expect(n("health")).toBeGreaterThanOrEqual(2);
    expect(n("politics")).toBeGreaterThanOrEqual(1);
    expect(n("foreign")).toBeGreaterThanOrEqual(1);
    expect(n("opportunity")).toBeGreaterThanOrEqual(1);
  });
  it("choice ids are exactly a, b, c", () => {
    for (const c of parsedCards) expect(c.choices.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("choices in a card have three distinct approaches", () => {
    for (const c of parsedCards) expect(new Set(c.choices.map((x) => x.approach)).size).toBe(3);
  });
  it("every choice evidenceId exists in evidence.yaml", () => {
    const ids = new Set(evidence.map((e) => e.id));
    for (const c of parsedCards)
      for (const ch of c.choices)
        expect(ch.evidenceIds.filter((id) => !ids.has(id)), `${c.id}.${ch.id}`).toEqual([]);
  });
  it("choice evidenceIds have no duplicates", () => {
    for (const c of parsedCards)
      for (const ch of c.choices) expect(dup(ch.evidenceIds), `${c.id}.${ch.id}`).toEqual([]);
  });
  it("every card sourceId exists in sources.yaml or research-sources.yaml", () => {
    const ids = new Set([...allSources, ...research].map((s) => s.id));
    for (const c of parsedCards) expect(c.sourceIds.filter((id) => !ids.has(id)), c.id).toEqual([]);
  });
  it("every card cites design.level-scale plus one research or dataset source", () => {
    const kind = new Map([...allSources, ...research].map((s) => [s.id, s.kind]));
    for (const c of parsedCards) {
      expect(c.sourceIds, c.id).toContain("design.level-scale");
      expect(c.sourceIds.some((id) => kind.get(id) === "research" || kind.get(id) === "dataset"), c.id).toBe(true);
    }
  });
  it("judgment and reviewedBy are null", () => {
    for (const c of parsedCards)
      for (const ch of c.choices) {
        expect(ch.judgment).toBeNull();
        expect(ch.reviewedBy).toBeNull();
      }
  });
  it("ifIgnored has 2-4 effects; cooldownQ is 8; non-1 baseWeight has a comment", () => {
    for (const c of parsedCards) {
      expect(c.ifIgnored.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.ifIgnored.length, c.id).toBeLessThanOrEqual(4);
      expect(c.cooldownQ, c.id).toBe(8);
      if (c.baseWeight !== 1) {
        const text = readFileSync(join(root, "data/cards", `${c.id}.yaml`), "utf8");
        expect(text, `${c.id} needs a comment explaining baseWeight`).toMatch(/#.*weight/i);
      }
    }
  });
  it("situation text is Thai, long enough, has no digits and no country names", () => {
    for (const c of parsedCards) {
      expect(c.situationTh, c.id).toMatch(/[฀-๿]/);
      expect(c.situationTh.length, c.id).toBeGreaterThan(150);
      const words = [...new Intl.Segmenter("th", { granularity: "word" }).segment(c.situationTh)].filter((x) => x.isWordLike).length;
      expect(words, `${c.id} has ${words} words`).toBeGreaterThanOrEqual(80);
      expect(words, `${c.id} has ${words} words`).toBeLessThanOrEqual(120);
      expect(c.situationTh, c.id).not.toMatch(/[0-9๐-๙]/);
      expect(c.situationTh, c.id).not.toMatch(/ไทย|สหรัฐ|จีน|ญี่ปุ่น|รัสเซีย|อินเดีย|ยูเครน|เมียนมา|อเมริกา/);
    }
  });
  it("every choice has a real cost and names affected groups", () => {
    for (const c of parsedCards)
      for (const ch of c.choices) {
        expect(ch.costHint, `${c.id}.${ch.id}`).not.toBe("none");
        expect(ch.affectedGroups.length, `${c.id}.${ch.id}`).toBeGreaterThan(0);
      }
  });
});
