// TEST FIXTURE — invented values, never shipped
import type { Action, Effect, GroupImpact, Judgment } from "@ps/shared";

export function effect(over: Partial<Effect> = {}): Effect {
  return {
    indicator: "health", direction: "up", level: "2",
    start_after_quarters: 0, lasts_quarters: 4, note: "TEST FIXTURE", evidence_ids: [],
    ...over,
  };
}

export function impact(over: Partial<GroupImpact> = {}): GroupImpact {
  return { group: "urban", direction: "up", level: "1", reason: "TEST FIXTURE", ...over };
}

export function action(over: Partial<Action> = {}): Action {
  return {
    title: "TEST FIXTURE action", cost_size: "S", recurring_cost_size: "none", duration_quarters: 4,
    requires_legislation: false, legal_risk: "none",
    effects: [effect()], group_impacts: [], side_effects: [],
    ...over,
  };
}

export function judgment(over: Partial<Judgment> = {}): Judgment {
  return {
    input_class: "normal", interpretation: "TEST FIXTURE", actions: [action()], overreach: false,
    scores: { relevance: "3", feasibility: "3", specificity: "3", tradeoffs: "3", consistency: "3" },
    event_coverage: "2",
    flags: { impossible_claim: false, cruelty: false, rights_violation: false, unconstitutional: false },
    follow_up_hooks: [],
    ...over,
  };
}
