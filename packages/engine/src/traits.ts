import type { Card, MinorEvent, TraitKey } from "@ps/shared";
import { clamp } from "./util";

/** A country's traits, 0-100 each. A missing trait counts as NEUTRAL_TRAIT. */
export type Traits = Partial<Record<TraitKey, number>>;
export type TraitWeights = NonNullable<Card["traitWeights"] | MinorEvent["traitWeights"]>;

/** Trait value that changes nothing (spec E3: "a missing trait counts as 50"). */
export const NEUTRAL_TRAIT = 50;
/** Bounds of the combined weight multiplier (spec E3). */
export const TRAIT_MULTIPLIER_RANGE: readonly [number, number] = [0.1, 3];

/**
 * Π over keys of 1 + k × strength × (trait − 50) / 50, clamped to [0.1, 3].
 * No weights, or traits at 50, give exactly 1.
 */
export function traitMultiplier(traits: Traits | undefined, weights: TraitWeights | undefined, strength = 1): number {
  if (!weights) return 1;
  let m = 1;
  for (const [key, k] of Object.entries(weights) as [TraitKey, number | undefined][]) {
    if (k === undefined) continue;
    const t = traits?.[key] ?? NEUTRAL_TRAIT;
    m *= 1 + (k * strength * (t - NEUTRAL_TRAIT)) / NEUTRAL_TRAIT;
  }
  return clamp(m, TRAIT_MULTIPLIER_RANGE[0], TRAIT_MULTIPLIER_RANGE[1]);
}
