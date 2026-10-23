import { GOODNESS, GROUP_INTERESTS, PILLARS, type GameState, type GroupKey, type StatKey } from "@ps/shared";
import { TICK } from "@ps/shared";
import { at } from "./util";

type Stats = Record<StatKey, number>;

/** 0-100 goodness of a stat value: linear interpolation over GOODNESS points, clamped at both ends. */
export function goodness(stat: StatKey, value: number): number {
  const pts = GOODNESS.value[stat];
  const first = at(pts, 0);
  const last = at(pts, pts.length - 1);
  if (value <= first[0]) return first[1];
  if (value >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = at(pts, i);
    if (value <= x1) {
      const [x0, y0] = at(pts, i - 1);
      return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return last[1];
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Mean goodness of the stats in each pillar. */
export function pillarScores(stats: Stats): Record<"economy" | "society" | "politics" | "other", number> {
  const out = {} as Record<"economy" | "society" | "politics" | "other", number>;
  for (const p of Object.keys(PILLARS) as (keyof typeof PILLARS)[]) {
    out[p] = mean(PILLARS[p].map((k) => goodness(k, stats[k])));
  }
  return out;
}

/** What a group's satisfaction drifts toward: mean goodness of the stats it cares about. */
export function groupTarget(group: GroupKey, stats: Stats): number {
  return mean(GROUP_INTERESTS.value[group].map((k) => goodness(k, stats[k])));
}

/** Σ share × satisfaction. */
export function popularity(groups: GameState["groups"]): number {
  let total = 0;
  for (const g of Object.values(groups)) total += g.share * g.satisfaction;
  return total;
}

/** Satisfaction target: 50 plus the change in the group's goodness since the start of the term, scaled. */
export function relativeGroupTarget(group: GroupKey, stats: Stats, baseline: Stats): number {
  const t = 50 + TICK.targetScale.value * (groupTarget(group, stats) - groupTarget(group, baseline));
  return Math.min(100, Math.max(0, t));
}
