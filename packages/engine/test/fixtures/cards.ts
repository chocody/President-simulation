// TEST FIXTURE — invented values, never shipped
import type { Action, Card, CardEffect, Choice, GroupKey, StatKey, Target } from "@ps/shared";

type CostSize = Action["cost_size"];
import { action, effect, impact, judgment } from "./judgments";

interface Spec {
  id: string;
  category: Card["category"];
  severity: Card["severity"];
  stat: StatKey;            // the main stat the card is about
  statDir: "up" | "down";   // direction the good response moves it
  evidence: string;         // evidence id (fixtures/evidence.ts) that backs level 2-3 on `stat`
  ifIgnored: CardEffect[];
  conditions?: Card["conditions"];
  loser: GroupKey;
}

function choice(id: "a" | "b" | "c", s: Spec): Choice {
  const level = id === "a" ? "3" : id === "b" ? "2" : "1";
  const cost: CostSize = id === "a" ? "M" : id === "b" ? "S" : "XS";
  const j = judgment({
    scores: {
      relevance: "4", feasibility: id === "a" ? "3" : "4", specificity: "4",
      tradeoffs: id === "c" ? "4" : "3", consistency: "4",
    },
    actions: [
      action({
        title: `TEST FIXTURE ${s.id} ${id}`,
        cost_size: cost,
        recurring_cost_size: id === "a" ? "XS" : "none",
        requires_legislation: id === "a",
        legal_risk: id === "a" ? "medium" : "none",
        effects: [effect({ indicator: s.stat, direction: s.statDir, level, evidence_ids: [s.evidence] })],
        group_impacts: [impact({ group: s.loser, direction: "down", level: id === "a" ? "2" : "1" }),
                        impact({ group: "urban", direction: "up", level: "1" })],
        side_effects: id === "a" ? [effect({ indicator: "inequality", direction: "up", level: "1" })] : [],
      }),
    ],
  });
  return {
    id,
    approach: id === "a" ? "state-led" : id === "b" ? "market-led" : "targeted",
    titleTh: "TEST FIXTURE", descTh: "TEST FIXTURE — invented values, never shipped",
    costHint: cost, affectedGroups: [s.loser, "urban"],
    evidenceIds: [s.evidence], judgment: j, reviewedBy: null,
  };
}

function card(s: Spec): Card {
  return {
    id: s.id, category: s.category, severity: s.severity,
    titleTh: "TEST FIXTURE", situationTh: "TEST FIXTURE — invented values, never shipped",
    conditions: s.conditions ?? [], baseWeight: 1, cooldownQ: 8,
    ifIgnored: s.ifIgnored, sourceIds: ["test.fixture"],
    choices: [choice("a", s), choice("b", s), choice("c", s)],
  };
}

const fx = (target: Target, delta: number, over_quarters: number): CardEffect => ({ target, delta, over_quarters });

export const fixtureDeck: Card[] = [
  card({ id: "test.disaster.flood", category: "disaster", severity: "major", stat: "health", statDir: "up",
    evidence: "ev.test.health-up", loser: "business",
    ifIgnored: [fx("stability", -6, 4), fx("health", -5, 4), fx("group:farmers", -6, 2)] }),
  card({ id: "test.disaster.drought", category: "disaster", severity: "minor", stat: "gdpGrowth", statDir: "up",
    evidence: "ev.test.econ-up", loser: "urban",
    ifIgnored: [fx("gdpGrowth", -0.8, 4), fx("group:farmers", -8, 3)] }),
  card({ id: "test.economy.inflation", category: "economy", severity: "major", stat: "inflation", statDir: "down",
    evidence: "ev.test.infl-down", loser: "business",
    ifIgnored: [fx("inflation", 1.5, 4), fx("group:urban", -5, 3)] }),
  card({ id: "test.economy.jobs", category: "economy", severity: "minor", stat: "unemployment", statDir: "down",
    evidence: "ev.test.unemp-down", loser: "business",
    ifIgnored: [fx("unemployment", 0.7, 4), fx("group:youth", -5, 3)] }),
  card({ id: "test.society.crime", category: "society", severity: "minor", stat: "crime", statDir: "down",
    evidence: "ev.test.crime-down", loser: "youth",
    ifIgnored: [fx("crime", 5, 4), fx("stability", -3, 3)] }),
  card({ id: "test.society.strike", category: "society", severity: "major", stat: "stability", statDir: "up",
    evidence: "ev.test.econ-up", loser: "business",
    conditions: [{ target: "unemployment", op: ">", value: 3 }],
    ifIgnored: [fx("stability", -5, 3), fx("gdpGrowth", -0.3, 2)] }),
  card({ id: "test.health.epidemic", category: "health", severity: "major", stat: "health", statDir: "up",
    evidence: "ev.test.health-mixed", loser: "business",
    ifIgnored: [fx("health", -8, 4), fx("group:urban", -5, 2)] }),
  card({ id: "test.health.hospitals", category: "health", severity: "minor", stat: "health", statDir: "up",
    evidence: "ev.test.health-up", loser: "farmers",
    ifIgnored: [fx("health", -4, 4)] }),
  card({ id: "test.politics.scandal", category: "politics", severity: "minor", stat: "corruption", statDir: "down",
    evidence: "ev.test.crime-down", loser: "military",
    ifIgnored: [fx("corruption", 5, 3), fx("parliament", -4, 3)] }),
  card({ id: "test.foreign.tariff", category: "foreign", severity: "major", stat: "foreignRelations", statDir: "up",
    evidence: "ev.test.econ-up", loser: "farmers",
    ifIgnored: [fx("gdpGrowth", -0.8, 4), fx("foreignRelations", -5, 3)] }),
  card({ id: "test.opportunity.investment", category: "opportunity", severity: "minor", stat: "gdpGrowth", statDir: "up",
    evidence: "ev.test.econ-up", loser: "farmers",
    ifIgnored: [fx("gdpGrowth", -0.3, 2)] }),
];
