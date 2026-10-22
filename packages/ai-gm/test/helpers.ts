// Test helpers: mocked client (no network), small fixtures. Values are invented test data.
import type { Card, Evidence, TurnReport } from "@ps/shared";
import { newGame } from "@ps/engine";
import { fixtureCountry } from "../../engine/test/fixtures/country";
import { fixtureDeck } from "../../engine/test/fixtures/cards";
import { fixtureEvidence } from "../../engine/test/fixtures/evidence";
import type { GmClient, GmMessage } from "../src/types";

export interface MockClient extends GmClient {
  calls: Record<string, any>[];
}

/** A client whose `parse` returns the next queued reply (or throws it if it is an Error). */
export function mockClient(...replies: (GmMessage | Error | { name: string })[]): MockClient {
  const calls: Record<string, any>[] = [];
  let i = 0;
  return {
    calls,
    beta: {
      messages: {
        async parse(params) {
          calls.push(params as unknown as Record<string, any>);
          const r = replies[Math.min(i++, replies.length - 1)]!;
          if (!("usage" in r)) throw r;
          return r;
        },
      },
    },
  };
}

export function reply(parsed: unknown, over: Partial<GmMessage> = {}): GmMessage {
  return {
    stop_reason: "end_turn",
    parsed_output: parsed,
    model: "claude-opus-5-5",
    usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0 },
    ...over,
  };
}

export const country = fixtureCountry;
export const state = newGame({ country: fixtureCountry, difficulty: "normal", seed: "ai-gm-test" });
export const card: Card = fixtureDeck[0]!;
export const evidence: Evidence[] = fixtureEvidence.slice(0, 3);

export const report: TurnReport = {
  quarter: 3, cardId: card.id, answerKind: "preset", eventShareApplied: 0.5,
  measures: [{
    title: "TEST measure", parliament: { required: false, vote: null, passed: true }, courtRisk: 0.1,
    protest: { group: null, happened: false }, probability: 60, roll: 42, outcome: "success",
    multiplier: 1, costPctGdp: 0.5, downgradedForEvidence: 0,
  }],
  immediate: { inflation: -0.2 }, scheduledCount: 2, notes: ["TEST note"],
};

/** A valid wire judgment (what the model returns). */
export function wireJudgment(over: Record<string, unknown> = {}): Record<string, any> {
  return {
    input_class: "normal",
    interpretation: "TEST interpretation",
    actions: [{
      title: "TEST action", cost_size: "S", recurring_cost_size: "none", duration_quarters: 4,
      requires_legislation: false, legal_risk: "none",
      effects: [{ indicator: "group:urban", direction: "up", level: "1", start_after_quarters: 0, lasts_quarters: 4, note: "TEST", evidence_ids: [] }],
      group_impacts: [{ group: "business", direction: "down", level: "1", reason: "TEST" }],
      side_effects: [],
    }],
    overreach: false,
    scores: { relevance: "4", feasibility: "3", specificity: "3", tradeoffs: "2", consistency: "3" },
    event_coverage: "2",
    flags: { impossible_claim: false, cruelty: false, rights_violation: false, unconstitutional: false },
    follow_up_hooks: [],
    ...over,
  };
}

export const GOOD_TEXT = "ตั้งกองทุนช่วยเหลือเฉพาะครัวเรือนรายได้น้อย โอนเงินสดตรงภายในสองเดือน ใช้งบไม่เกินร้อยละ 0.5 ของ GDP";
