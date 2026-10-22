// TEST FIXTURE — invented values, never shipped
import type { Evidence } from "@ps/shared";

function ev(id: string, indicator: Evidence["indicator"], direction: Evidence["direction"]): Evidence {
  return {
    id, sourceId: "test.fixture", url: "https://example.com/test-fixture", policyTags: ["test"],
    indicator, direction, strength: "review", regionTags: [],
    summaryTh: "TEST FIXTURE — invented values, never shipped",
    summaryEn: "TEST FIXTURE — invented values, never shipped",
    verifiedBy: null,
  };
}

export const fixtureEvidence: Evidence[] = [
  ev("ev.test.health-up", "health", "up"),
  ev("ev.test.health-mixed", "health", "mixed"),
  ev("ev.test.crime-down", "crime", "down"),
  ev("ev.test.econ-up", "gdpGrowth", "up"),
  ev("ev.test.infl-down", "inflation", "down"),
  ev("ev.test.unemp-down", "unemployment", "down"),
];
