import type { GameState, Target } from "@ps/shared";
import { goodness } from "@ps/engine";
import type { GameInfo, PublicNewsItem } from "./api-types";
import { formatDelta } from "./format";
import { targetLabel } from "./labels";
import { isStatKey } from "./targets";

/** `state.news` with the text and effects of each event. Ids missing from the catalog (older saves) are skipped. */
export function newsFromState(state: GameState, info: GameInfo): PublicNewsItem[] {
  const catalog = new Map((info.minorEvents ?? []).map((e) => [e.id, e]));
  return (state.news ?? []).flatMap((n) => {
    const e = catalog.get(n.id);
    return e ? [{ ...e, quarter: n.quarter }] : [];
  });
}

export interface NewsChip {
  /** "+2.0 สาธารณสุข" */
  text: string;
  tone: "good" | "bad" | "flat";
  /** "+" or "−" */
  sign: "+" | "−";
}

/** Small chip for one effect. Colour is about good or bad for the country (crime up is bad), the sign is the raw change. */
export function newsChip(target: Target, delta: number, stats: GameState["stats"]): NewsChip {
  const sign = delta >= 0 ? "+" : "−";
  let better: number;
  if (isStatKey(target)) better = goodness(target, stats[target] + delta) - goodness(target, stats[target]);
  else better = delta;
  const tone = Math.abs(better) < 1e-9 ? "flat" : better > 0 ? "good" : "bad";
  const kind = isStatKey(target) ? target : "group";
  return { text: `${formatDelta(kind, delta)} ${targetLabel(target)}`, tone, sign };
}
