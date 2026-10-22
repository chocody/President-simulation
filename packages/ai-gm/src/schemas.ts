// Wire schemas: what the model is asked to return. They avoid constructs structured outputs may reject
// (the contract's template-literal Target, exact array lengths) and are converted to the strict shapes after parsing.
import { z } from "zod";
import { Action, Effect, GROUP_KEYS, Judgment, STAT_KEYS } from "@ps/shared";
import { HISTORIAN_MAX_WORDS, HISTORIAN_PREFIX } from "./config";

// ---------- judge ----------

export const WIRE_TARGETS = [...STAT_KEYS, ...GROUP_KEYS.map((g) => `group:${g}` as const)] as const;
export const WireTarget = z.enum(WIRE_TARGETS);

const EffectWire = Effect.extend({ indicator: WireTarget });
const ActionWire = Action.extend({ effects: z.array(EffectWire), side_effects: z.array(EffectWire) });

/** Identical to the contract `Judgment`, except `indicator` is a plain enum of the 20 targets. */
export const JudgmentWire = Judgment.extend({ actions: z.array(ActionWire) });
export type JudgmentWire = z.infer<typeof JudgmentWire>;

/** Wire -> contract. Throws a ZodError when the value is not a valid contract Judgment (e.g. an unknown target). */
export function toJudgment(wire: unknown): Judgment {
  return Judgment.parse(wire);
}

// ---------- narrator ----------

/** Sent to the model. The exact count is checked after parsing. */
export const NarratorWire = z.object({
  narration: z.string(),
  headlines: z.array(z.string()).describe("Exactly 3 news headlines."),
  chronicleLine: z.string(),
});

export const Narration = z.object({
  narration: z.string().min(1),
  headlines: z.array(z.string().min(1)).length(3),
  chronicleLine: z.string().min(1),
});
export type Narration = z.infer<typeof Narration>;

export function toNarration(wire: unknown): Narration {
  return Narration.parse(wire);
}

// ---------- historian ----------

export const PILLARS = ["economy", "society", "politics", "other"] as const;

export const HistorianWire = z.object({
  archetype: z.string(),
  line: z.string(),
  gradeNotes: z.object({ economy: z.string(), society: z.string(), politics: z.string(), other: z.string() }),
});

/** Thai has no spaces between words, so count with the ICU word segmenter (falls back to spaces). */
export function countWords(text: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    let n = 0;
    for (const s of seg.segment(text)) if (s.isWordLike) n++;
    return n;
  }
  return text.split(/\s+/).filter(Boolean).length;
}

export const Verdict = HistorianWire.extend({
  archetype: z.string().min(1),
  line: z.string()
    .refine((l) => l.startsWith(HISTORIAN_PREFIX), { message: `line must start with "${HISTORIAN_PREFIX}"` })
    .refine((l) => countWords(l) < HISTORIAN_MAX_WORDS, { message: `line must be under ${HISTORIAN_MAX_WORDS} words` }),
});
export type Verdict = z.infer<typeof Verdict>;

export function toHistorian(wire: unknown): Verdict {
  return Verdict.parse(wire);
}
