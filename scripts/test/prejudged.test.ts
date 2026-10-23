// Every pre-judged choice must parse as a Judgment and respect the judge's evidence rule,
// whoever produced it (the API pipeline or the Lead's manual pre-judge).
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { Card, Evidence, Judgment } from "@ps/shared";

const root = join(__dirname, "../..");
const cards = readdirSync(join(root, "data/cards")).map((f) => Card.parse(YAML.parse(readFileSync(join(root, "data/cards", f), "utf8"))));
const evidence = new Map((YAML.parse(readFileSync(join(root, "data/evidence/evidence.yaml"), "utf8")) as unknown[]).map((e) => { const x = Evidence.parse(e); return [x.id, x]; }));
const dir = join(root, "data/prejudged");
const entries = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8"))) : [];

describe("pre-judged choices", () => {
  it("cover every choice of every card exactly once", () => {
    const keys = entries.map((e: { cardId: string; choiceId: string }) => `${e.cardId}.${e.choiceId}`).sort();
    const want = cards.flatMap((c) => c.choices.map((ch) => `${c.id}.${ch.id}`)).sort();
    expect(keys).toEqual(want);
  });
  it.each(entries.map((e: { cardId: string; choiceId: string }) => [`${e.cardId}.${e.choiceId}`, e]))("%s follows the schema and the evidence rule", (_k, e: any) => {
    const j = Judgment.parse(e.judgment);
    const choice = cards.find((c) => c.id === e.cardId)!.choices.find((c) => c.id === e.choiceId)!;
    expect(Number(j.scores.specificity)).toBeLessThanOrEqual(3);            // presets cap specificity
    expect(j.actions.length).toBeGreaterThan(0);
    for (const a of j.actions) {
      for (const eff of [...a.effects, ...a.side_effects]) {
        for (const id of eff.evidence_ids) expect(choice.evidenceIds, `${id} not offered to this choice`).toContain(id);
        if (eff.level !== "1") {
          const ok = eff.evidence_ids.some((id) => {
            const ev = evidence.get(id);
            return ev && ev.indicator === eff.indicator && (ev.direction === eff.direction || ev.direction === "mixed");
          });
          expect(ok, `${eff.indicator} ${eff.direction} level ${eff.level} lacks matching evidence`).toBe(true);
        }
      }
      // every action with a positive effect carries a cost: money, a side effect or a losing group
      const costly = a.cost_size !== "none" || a.side_effects.length > 0 || a.group_impacts.some((g) => g.direction === "down");
      expect(costly).toBe(true);
    }
  });
});
