// TEST FIXTURE — invented values, never shipped
import type { MinorEvent } from "@ps/shared";

const mk = (id: string, over: Partial<MinorEvent> = {}): MinorEvent => ({
  id: `news.test.${id}`,
  category: "economy",
  textTh: "TEST FIXTURE",
  effects: [{ target: "stability", delta: 1, over_quarters: 1 }],
  conditions: [],
  baseWeight: 1,
  sourceIds: ["test.fixture"],
  ...over,
});

/** A small invented news deck with positive and negative items, a trait-weighted one and a conditional one. */
export const fixtureMinorEvents: MinorEvent[] = [
  mk("a", { effects: [{ target: "health", delta: 2, over_quarters: 1 }] }),
  mk("b", { effects: [{ target: "crime", delta: -2, over_quarters: 2 }] }),
  mk("c", { effects: [{ target: "group:urban", delta: 3, over_quarters: 1 }] }),
  mk("d", { effects: [{ target: "group:farmers", delta: -3, over_quarters: 1 }, { target: "inflation", delta: 0.3, over_quarters: 1 }] }),
  mk("e", { effects: [{ target: "gdpGrowth", delta: 0.2, over_quarters: 2 }] }),
  mk("f", { effects: [{ target: "stability", delta: -3, over_quarters: 1 }] }),
  mk("g", { effects: [{ target: "stability", delta: 3, over_quarters: 3 }] }),
  mk("h", { effects: [{ target: "corruption", delta: 2, over_quarters: 1 }], traitWeights: { patronage: 1 } }),
  mk("i", { effects: [{ target: "education", delta: 1, over_quarters: 1 }], conditions: [{ target: "education", op: ">", value: 60 }] }),
  mk("j", { category: "culture", effects: [{ target: "foreignRelations", delta: 1, over_quarters: 1 }], traitWeights: { tourism: 1 } }),
];
