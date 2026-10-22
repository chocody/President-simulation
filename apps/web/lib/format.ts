import type { StatKey } from "@ps/shared";

const PERCENT: StatKey[] = ["gdpGrowth", "inflation", "unemployment"];
const PERCENT_GDP: StatKey[] = ["budget", "debt"];

/** Unit label for a stat, shown next to the number. */
export function statUnit(k: StatKey): string {
  if (PERCENT.includes(k)) return "%";
  if (PERCENT_GDP.includes(k)) return "% ของ GDP";
  if (k === "inequality") return "Gini";
  return "ดัชนี 0–100";
}

export function formatStat(k: StatKey, v: number): string {
  if (PERCENT.includes(k)) return `${v.toFixed(1)}%`;
  if (PERCENT_GDP.includes(k)) return `${v.toFixed(1)}% ของ GDP`;
  return v.toFixed(1);
}

/** Signed change with the stat's unit, e.g. "+1.5%" or "−2.0". */
export function formatDelta(k: StatKey | "group", v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "±";
  // Tiny changes would round to "0.0"; show two decimals instead of a misleading "−0.0".
  const n = Math.abs(v).toFixed(Math.abs(v) < 0.05 ? 2 : 1);
  if (k !== "group" && PERCENT.includes(k)) return `${sign}${n}%`;
  if (k !== "group" && PERCENT_GDP.includes(k)) return `${sign}${n}% GDP`;
  return `${sign}${n}`;
}
