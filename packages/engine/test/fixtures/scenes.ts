// TEST FIXTURE — invented values, never shipped
import { GROUP_KEYS, STAT_KEYS, type SceneTemplate, type Target } from "@ps/shared";

const TARGETS: Target[] = [...STAT_KEYS, ...GROUP_KEYS.map((g) => `group:${g}` as const)];

/** One plain template per target x direction x size, so the engine always finds a match. */
const deltaScenes: SceneTemplate[] = TARGETS.flatMap((target, i) =>
  (["up", "down"] as const).flatMap((direction) =>
    (["small", "large"] as const).map((size): SceneTemplate => ({
      id: `scene.test.t${i}.${direction}.${size}`,
      trigger: { kind: "delta", target, direction, size },
      textTh: `TEST FIXTURE ${target} ${direction} ${size}`,
      sourceIds: ["test.fixture"],
    }))));

const outcomeScenes: SceneTemplate[] = (["blocked", "critical_failure", "great_success", "partial", "failure"] as const).map((outcome) => ({
  id: `scene.test.outcome.${outcome.replace("_", "-")}`,
  trigger: { kind: "outcome", outcome },
  textTh: `TEST FIXTURE ${outcome} {measure}`,
  sourceIds: ["test.fixture"],
}));

const protestScenes: SceneTemplate[] = GROUP_KEYS.map((group) => ({
  id: `scene.test.protest.${group}`,
  trigger: { kind: "protest", group },
  textTh: `TEST FIXTURE protest ${group} {measure}`,
  sourceIds: ["test.fixture"],
}));

const courtScene: SceneTemplate = {
  id: "scene.test.court.1",
  trigger: { kind: "court" },
  textTh: "TEST FIXTURE court {measure}",
  sourceIds: ["test.fixture"],
};

export const fixtureScenes: SceneTemplate[] = [...deltaScenes, ...outcomeScenes, ...protestScenes, courtScene];

/** Id of the plain fixture template for a delta trigger. */
export function deltaSceneId(target: Target, direction: "up" | "down", size: "small" | "large"): string {
  return `scene.test.t${TARGETS.indexOf(target)}.${direction}.${size}`;
}
