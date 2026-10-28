// Helpers for showing consequence scenes. Pure, no React.
import type { GameState, Scene, SceneRecord, TurnReport } from "@ps/shared";

/** Most scenes shown in the ending's "เส้นทางวาระของคุณ" (spec E4). */
export const PATH_MAX_SCENES = 10;

export type SceneBadge = { kind: "measure" | "event" | "followup"; label: string };

/**
 * Badge for a scene's cause. A turn scene is "จากมาตรการ …" when the cause is one of this turn's measures and
 * "จากเหตุการณ์ …" otherwise (the event card); follow-up and court scenes are "ผลต่อเนื่อง" with the measure title.
 * No cause, no badge.
 */
export function sceneBadge(scene: Pick<Scene, "kind" | "cause">, report?: Pick<TurnReport, "measures">): SceneBadge | null {
  if (scene.cause === null) return scene.kind === "turn" ? null : { kind: "followup", label: "ผลต่อเนื่อง" };
  if (scene.kind !== "turn") return { kind: "followup", label: `ผลต่อเนื่อง · ${scene.cause}` };
  const isMeasure = (report?.measures ?? []).some((m) => m.title === scene.cause);
  return isMeasure ? { kind: "measure", label: `จากมาตรการ ${scene.cause}` } : { kind: "event", label: `จากเหตุการณ์ ${scene.cause}` };
}

/** Follow-up and court scenes, newest first: what the news log shows next to the minor news. */
export function followupScenes(state: Pick<GameState, "scenes">): SceneRecord[] {
  return (state.scenes ?? []).filter((s) => s.kind !== "turn").reverse();
}

/**
 * The term's story for the ending: up to `max` scenes in time order. The lead scene of each decision comes first,
 * then follow-up and court scenes, then other turn scenes, until the list is full.
 */
export function termPath(state: Pick<GameState, "scenes">, max: number = PATH_MAX_SCENES): SceneRecord[] {
  const all = state.scenes ?? [];
  const leadSeen = new Set<number>();
  const lead: number[] = [];
  const later: number[] = [];
  const rest: number[] = [];
  all.forEach((s, i) => {
    if (s.kind !== "turn") later.push(i);
    else if (!leadSeen.has(s.quarter)) { leadSeen.add(s.quarter); lead.push(i); }
    else rest.push(i);
  });
  const chosen = [...lead, ...later, ...rest].slice(0, max).sort((a, b) => a - b);
  return chosen.map((i) => all[i]!);
}
