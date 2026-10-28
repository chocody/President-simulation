// FROZEN CONTRACTS — owned by the Lead. Workers must not edit this file.
// Ask the Lead for a change instead; every lane builds against these shapes.
import { z } from "zod";

// ---------- keys ----------

export const STAT_KEYS = [
  "gdpGrowth", "inflation", "unemployment", "budget", "debt",
  "health", "education", "crime", "inequality",
  "corruption", "pressFreedom", "stability", "parliament",
  "environment", "foreignRelations",
] as const;
export const StatKey = z.enum(STAT_KEYS);
export type StatKey = z.infer<typeof StatKey>;

export const GROUP_KEYS = ["farmers", "urban", "business", "youth", "military"] as const;
export const GroupKey = z.enum(GROUP_KEYS);
export type GroupKey = z.infer<typeof GroupKey>;

/** An effect target is a stat or a voter group's satisfaction. */
export const Target = z.union([StatKey, z.templateLiteral(["group:", GroupKey])]);
export type Target = z.infer<typeof Target>;

export const Difficulty = z.enum(["easy", "normal", "hard"]);
export type Difficulty = z.infer<typeof Difficulty>;

// ---------- provenance ----------

export const Source = z.object({
  id: z.string(),                         // "wdi.FP.CPI.TOTL.ZG", "paper.perez-linan-2007", "design.cap"
  kind: z.enum(["dataset", "research", "design"]),
  title: z.string(),
  publisher: z.string(),
  indicatorCode: z.string().nullable(),
  url: z.string().url(),
  license: z.string(),                    // "CC BY 4.0", "design", ...
  commercialOk: z.boolean(),
  coverage: z.string().nullable(),
  retrievedAt: z.string().nullable(),     // ISO date
  verifiedBy: z.string().nullable(),      // a human who opened the page; null = not yet verified
  note: z.string().nullable(),
});
export type Source = z.infer<typeof Source>;

export const Evidence = z.object({
  id: z.string(),                         // "ev.cash-transfer.001"
  sourceId: z.string(),                   // a research Source id
  url: z.string().url(),                  // page that states the finding
  policyTags: z.array(z.string()).min(1),
  indicator: Target,                      // what the study measured, mapped to the game
  direction: z.enum(["up", "down", "mixed", "none"]),
  strength: z.enum(["rct", "quasi", "observational", "review"]),
  regionTags: z.array(z.string()),
  summaryTh: z.string(),                  // written by the team, 1–2 sentences, no copied abstracts
  summaryEn: z.string(),
  verifiedBy: z.string().nullable(),
});
export type Evidence = z.infer<typeof Evidence>;

/** Where one number came from. sourceId must exist in the sources registry. */
export const Provenance = z.object({
  sourceId: z.string(),
  year: z.number().int().nullable(),      // data year; null for design values
  raw: z.number().nullable(),             // value before scaling; null for design values
});
export type Provenance = z.infer<typeof Provenance>;

// ---------- country traits (derived from real indicators, never from stereotypes) ----------

export const TRAIT_KEYS = ["tourism", "agriculture", "resources", "openness", "ruleOfLaw", "govEffectiveness", "patronage"] as const;
export const TraitKey = z.enum(TRAIT_KEYS);
export type TraitKey = z.infer<typeof TraitKey>;

// ---------- country ----------

export const CountryData = z.object({
  iso3: z.string().length(3),
  nameTh: z.string(),
  nameEn: z.string(),
  region: z.string(),                     // World Bank region name
  population: z.number().positive(),
  baseline: z.record(StatKey, z.number()),            // game-scale values, all 15 keys
  baselineSrc: z.record(StatKey, Provenance),
  groupShares: z.record(GroupKey, z.number().min(0).max(1)),   // sums to 1
  groupSharesSrc: z.record(GroupKey, Provenance),
  /** 0–100 per trait, mapped from real indicators by DATA_MAPPING/TRAITS. Optional so older files still load. */
  traits: z.partialRecord(TraitKey, z.number().min(0).max(100)).optional(),
  traitsSrc: z.partialRecord(TraitKey, Provenance).optional(),
});
export type CountryData = z.infer<typeof CountryData>;

// ---------- AI judgment (same shape for preset choices and free text) ----------

export const Direction = z.enum(["up", "down"]);
export const Level = z.enum(["1", "2", "3"]);
export const Score = z.enum(["1", "2", "3", "4", "5"]);
export const CostSize = z.enum(["none", "XS", "S", "M", "L", "XL"]);
export const RecurringCostSize = z.enum(["none", "XS", "S", "M", "L"]);

export const Effect = z.object({
  indicator: Target,
  direction: Direction,
  level: Level,
  start_after_quarters: z.number().int(),   // engine clamps 0–16
  lasts_quarters: z.number().int(),         // engine clamps 1–16
  note: z.string(),
  evidence_ids: z.array(z.string()),        // level 2–3 without valid ids is downgraded to 1
});
export type Effect = z.infer<typeof Effect>;

export const GroupImpact = z.object({
  group: GroupKey,
  direction: Direction,
  level: Level,
  reason: z.string(),
});
export type GroupImpact = z.infer<typeof GroupImpact>;

export const Action = z.object({
  title: z.string(),
  cost_size: CostSize,
  recurring_cost_size: RecurringCostSize,
  duration_quarters: z.number().int(),
  requires_legislation: z.boolean(),
  legal_risk: z.enum(["none", "low", "medium", "high"]),
  effects: z.array(Effect),
  group_impacts: z.array(GroupImpact),
  side_effects: z.array(Effect),
});
export type Action = z.infer<typeof Action>;

export const Judgment = z.object({
  input_class: z.enum(["normal", "meta", "off_topic", "harmful", "gibberish"]),
  interpretation: z.string(),
  actions: z.array(Action),                 // engine uses the first 3
  overreach: z.boolean(),
  scores: z.object({
    relevance: Score, feasibility: Score, specificity: Score, tradeoffs: Score, consistency: Score,
  }),
  event_coverage: z.enum(["0", "1", "2", "3"]),
  flags: z.object({
    impossible_claim: z.boolean(), cruelty: z.boolean(),
    rights_violation: z.boolean(), unconstitutional: z.boolean(),
  }),
  follow_up_hooks: z.array(z.string()),
});
export type Judgment = z.infer<typeof Judgment>;

// ---------- event cards ----------

export const Condition = z.object({
  target: Target,
  op: z.enum(["<", ">"]),
  value: z.number(),
});

/** Consequence of the event itself, scaled by the relevance score. Totals, spread over `over_quarters`. */
export const CardEffect = z.object({
  target: Target,
  delta: z.number(),
  over_quarters: z.number().int().min(1),
});
export type CardEffect = z.infer<typeof CardEffect>;

export const Choice = z.object({
  id: z.string(),                           // "a" | "b" | "c"
  approach: z.string(),                     // e.g. "state-led", "market-led", "targeted"
  titleTh: z.string(),
  descTh: z.string(),                       // 1–2 sentences shown to the player
  costHint: CostSize,                       // shown as a size, never as numbers
  affectedGroups: z.array(GroupKey),        // shown as "who is affected", no direction
  evidenceIds: z.array(z.string()),
  judgment: Judgment.nullable(),            // filled by the offline pre-judge run; null until then
  reviewedBy: z.string().nullable(),        // human who checked the pre-judged result
});
export type Choice = z.infer<typeof Choice>;

export const Card = z.object({
  id: z.string(),                           // "disaster.flood.major"
  category: z.enum(["disaster", "economy", "society", "health", "politics", "foreign", "opportunity"]),
  severity: z.enum(["minor", "major"]),
  titleTh: z.string(),
  situationTh: z.string(),                  // 80–120 words, generic enough for any country
  conditions: z.array(Condition),           // all must hold for the card to be eligible
  baseWeight: z.number().positive(),
  cooldownQ: z.number().int().min(0),
  ifIgnored: z.array(CardEffect),
  /** Effects that happen when the card appears, whatever the answer (the windfall of good news). Not scaled by relevance. */
  onArrival: z.array(CardEffect).optional(),
  /** Weight multiplier per trait: weight × (1 + k × (trait − 50) / 50). Tourism cards appear more where tourism is big. */
  traitWeights: z.partialRecord(TraitKey, z.number().min(-1).max(1)).optional(),
  sourceIds: z.array(z.string()).min(1),    // what the frequency and effect sizes are based on
  choices: z.array(Choice).length(3),
});
export type Card = z.infer<typeof Card>;

// ---------- minor events (the news ticker: small things that happen every quarter) ----------

export const MinorEvent = z.object({
  id: z.string(),                           // "news.economy.factory-opens"
  category: z.enum(["disaster", "economy", "society", "health", "politics", "foreign", "opportunity", "culture"]),
  textTh: z.string(),                       // one line, under 25 Thai words, no country names
  effects: z.array(CardEffect).min(1).max(2),   // small: index ±1–3, units within level-1 scale
  conditions: z.array(Condition),
  baseWeight: z.number().positive(),
  traitWeights: z.partialRecord(TraitKey, z.number().min(-1).max(1)).optional(),
  sourceIds: z.array(z.string()).min(1),
});
export type MinorEvent = z.infer<typeof MinorEvent>;

// ---------- game state ----------

export const ScheduledEffect = z.object({
  policyId: z.string(),
  target: Target,
  deltaPerQuarter: z.number(),
  fromQuarter: z.number().int(),            // inclusive, 1–16 (MVP has one term)
  toQuarter: z.number().int(),              // inclusive
});
export type ScheduledEffect = z.infer<typeof ScheduledEffect>;

export const RecurringCost = z.object({
  policyId: z.string(),
  pctGdpPerYear: z.number(),
  untilQuarter: z.number().int(),
});

export const CourtCheck = z.object({
  policyId: z.string(),
  atQuarter: z.number().int(),
  chance: z.number().min(0).max(1),
});

export const Phase = z.enum(["running", "decision", "ended"]);
export type Phase = z.infer<typeof Phase>;

export const EndReason = z.enum(["won_election", "lost_election", "impeached", "coup", "uprising", "resigned"]);
export type EndReason = z.infer<typeof EndReason>;

export const GameState = z.object({
  rulesVersion: z.string(),
  seed: z.string(),
  rngCursor: z.number().int(),
  countryIso3: z.string().length(3),
  difficulty: Difficulty,
  baseline: z.record(StatKey, z.number()),
  quarter: z.number().int().min(1).max(16),
  phase: Phase,
  stats: z.record(StatKey, z.number()),
  groups: z.record(GroupKey, z.object({ share: z.number(), satisfaction: z.number() })),
  popularity: z.number(),
  scheduled: z.array(ScheduledEffect),
  recurring: z.array(RecurringCost),
  courtChecks: z.array(CourtCheck),
  cardHistory: z.array(z.object({ cardId: z.string(), quarter: z.number().int() })),
  pendingCardId: z.string().nullable(),
  econHistory: z.array(z.number()),         // economy pillar score per quarter, for the election
  pillarsAtStart: z.record(z.enum(["economy", "society", "politics", "other"]), z.number()),
  log: z.array(z.string()),                 // short engine log lines, newest last
  news: z.array(z.object({ quarter: z.number().int(), id: z.string() })).optional(),   // minor events that happened
  endReason: EndReason.nullable(),
  voteShare: z.number().nullable(),
});
export type GameState = z.infer<typeof GameState>;

// ---------- engine report (what the narrator and UI read) ----------

export const MeasureReport = z.object({
  title: z.string(),
  parliament: z.object({ required: z.boolean(), vote: z.number().nullable(), passed: z.boolean() }),
  courtRisk: z.number(),                    // chance of later suspension, 0–1
  protest: z.object({ group: GroupKey.nullable(), happened: z.boolean() }),
  probability: z.number(),                  // P in %
  roll: z.number().int().nullable(),        // 1–100, null when blocked before the roll
  outcome: z.enum(["blocked", "critical_failure", "great_success", "success", "partial", "failure"]),
  multiplier: z.number(),
  costPctGdp: z.number(),
  downgradedForEvidence: z.number().int(),  // effects cut to level 1 for missing evidence
});
export type MeasureReport = z.infer<typeof MeasureReport>;

export const TurnReport = z.object({
  quarter: z.number().int(),
  cardId: z.string().nullable(),
  answerKind: z.enum(["preset", "free", "none"]),
  eventShareApplied: z.number(),            // 0–1 share of ifIgnored that still happened
  measures: z.array(MeasureReport),
  immediate: z.record(z.string(), z.number()),   // target -> delta applied this turn after caps
  scheduledCount: z.number().int(),
  notes: z.array(z.string()),
});
export type TurnReport = z.infer<typeof TurnReport>;

// ---------- API ----------

export const Answer = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("preset"), choiceId: z.string() }),
  z.object({ kind: z.literal("free"), text: z.string().min(20).max(800) }),
]);
export type Answer = z.infer<typeof Answer>;

export const NewGameRequest = z.object({ difficulty: Difficulty, iso3: z.string().length(3).optional() });
export const DecideRequest = z.object({ state: GameState, answer: Answer });
export const DecideResponse = z.object({ state: GameState, report: TurnReport, narration: z.string() });
