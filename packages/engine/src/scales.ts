import { COST_PCT_GDP, LEVEL_SCALE, type Target } from "@ps/shared";
import { at } from "./util";

type Level = "1" | "2" | "3";
type Row = keyof typeof LEVEL_SCALE.value;

const OWN_ROW = new Set<string>(["gdpGrowth", "inflation", "unemployment", "inequality", "debt", "budget"]);

/** Total change for one effect level. "down" is negative; direction is literal (crime "up" = more crime). */
export function levelToDelta(target: Target, level: Level, direction: "up" | "down"): number {
  const row: Row = OWN_ROW.has(target) ? (target as Row) : "index";
  const magnitude = at(LEVEL_SCALE.value[row], Number(level) - 1);
  return direction === "down" ? -magnitude : magnitude;
}

type CostSize = keyof typeof COST_PCT_GDP.value;

/** One-off cost, % of GDP. */
export function costPctGdp(size: CostSize): number {
  return COST_PCT_GDP.value[size];
}

/** Recurring cost, % of GDP per year (same table as the one-off cost). */
export function recurringPctGdpPerYear(size: CostSize): number {
  return COST_PCT_GDP.value[size];
}
