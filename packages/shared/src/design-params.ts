// FROZEN by the Lead. Every engine constant lives here, labeled with what it is based on.
// "kind: design" = a game-design value, anchored to research where one exists and tuned by simulation.
// Source ids refer to data/sources/sources.yaml.
import type { GroupKey, StatKey } from "./contracts";

export const RULES_VERSION = "mvp-0.1";

type Param<T> = { value: T; rationale: string; basedOn: string[]; calibration: string };

/** Effect size per AI level, as a TOTAL change over the effect's duration. */
export const LEVEL_SCALE: Param<Record<"index" | "gdpGrowth" | "inflation" | "unemployment" | "inequality" | "debt" | "budget", [number, number, number]>> = {
  value: {
    index: [2, 5, 8],          // 0–100 indices, group satisfaction and parliament share
    gdpGrowth: [0.3, 0.8, 1.5],
    inflation: [0.5, 1.5, 3.0],
    unemployment: [0.3, 0.7, 1.2],
    inequality: [0.3, 0.6, 1.0], // Gini points
    debt: [1, 3, 6],           // % of GDP
    budget: [0.1, 0.3, 0.6],   // % of GDP per year of discretionary room
  },
  rationale: "Levels 1–3 map to noticeable / significant / major changes within real yearly ranges.",
  basedOn: ["design.level-scale", "wdi.NY.GDP.MKTP.KD.ZG", "wdi.FP.CPI.TOTL.ZG"],
  calibration: "Bot simulation: yearly change of each stat stays inside the 5th–95th percentile of real yearly changes.",
};

/** Max total change from player actions within one quarter. Disasters use their card's own numbers. */
export const TURN_CAP: Param<Record<StatKey | "group", number>> = {
  value: {
    gdpGrowth: 2, inflation: 3, unemployment: 2, budget: Infinity, debt: 5,
    health: 10, education: 10, crime: 10, inequality: 1,
    corruption: 10, pressFreedom: 10, stability: 10, parliament: 10,
    environment: 10, foreignRelations: 10, group: 10,
  },
  rationale: "Original design cap of ±10 on 0–100 indices, with equivalents for unit stats.",
  basedOn: ["design.cap"],
  calibration: "No single answer can move a stat further than the cap; property test.",
};

export const STAT_RANGE: Record<StatKey, [number, number]> = {
  gdpGrowth: [-15, 15], inflation: [-5, 100], unemployment: [0, 50], budget: [-20, 20], debt: [0, 250],
  health: [0, 100], education: [0, 100], crime: [0, 100], inequality: [20, 70],
  corruption: [0, 100], pressFreedom: [0, 100], stability: [0, 100], parliament: [0, 100],
  environment: [0, 100], foreignRelations: [0, 100],
};

/** One-off cost as % of GDP. Recurring costs use the same table per year. */
export const COST_PCT_GDP: Param<Record<"none" | "XS" | "S" | "M" | "L" | "XL", number>> = {
  value: { none: 0, XS: 0.05, S: 0.2, M: 0.5, L: 1.5, XL: 4 },
  rationale: "XL ≈ the largest one-off programmes governments run (e.g. a 2.9%-of-GDP cash handout).",
  basedOn: ["news.bloomberg.th-wallet-2024"],
  calibration: "A normal-difficulty player can afford about one L action per year.",
};

export const DISCRETIONARY_BUDGET_PCT_GDP: Param<Record<"easy" | "normal" | "hard", number>> = {
  value: { easy: 3, normal: 2, hard: 1 },
  rationale: "Yearly room for new policy, received as 1/4 per quarter; unspent money carries over.",
  basedOn: ["design.budget", "news.bloomberg.th-wallet-2024"],
  calibration: "Bot that spends everything ends the term with debt up 5–15 points of GDP.",
};

export const SCORE_EFFECTS = {
  relevanceIgnoredShare: { value: [1, 0.75, 0.5, 0.25, 0], rationale: "Share of the event's ifIgnored effects that still happen, score 1→5.", basedOn: ["design.rubric"], calibration: "Playtest." },
  feasibilityBase: { value: [20, 35, 50, 65, 80], rationale: "Base success chance in %, score 1→5.", basedOn: ["design.rubric"], calibration: "Bot win rate." },
  specificityAdj: { value: [-10, -5, 0, 5, 10], rationale: "Success chance adjustment, score 1→5.", basedOn: ["design.rubric"], calibration: "Bot win rate." },
  tradeoffMitigation: { value: [0, 0, 0.2, 0.35, 0.5], rationale: "Cut to negative group impacts, score 1→5.", basedOn: ["design.rubric"], calibration: "Playtest." },
  inconsistencyPenalty: { value: -2, rationale: "All groups −2 when consistency is 1–2.", basedOn: ["design.rubric"], calibration: "Playtest." },
  presetSpecificityMax: { value: 3, rationale: "Preset choices cap specificity at 3, so a well-specified typed answer can do better.", basedOn: ["design.choices"], calibration: "Typed answers with full detail beat presets on average in eval." },
} satisfies Record<string, Param<unknown>>;

export const DICE: Param<{
  minP: number; maxP: number; corruptionWeight: number; perExtraMeasure: number; brokePenalty: number;
  difficultyAdj: Record<"easy" | "normal" | "hard", number>;
  criticalFailureFrom: number;          // roll >= this is a critical failure
  partialBand: number;                  // roll <= P + band is a partial success
  multipliers: { critical_failure: number; great_success: number; success: number; partial: number; failure: number };
  sideEffectShare: { critical_failure: number; failure: number; other: number };
}> = {
  value: {
    minP: 5, maxP: 95, corruptionWeight: 0.3, perExtraMeasure: 5, brokePenalty: 15,
    difficultyAdj: { easy: 10, normal: 0, hard: -10 },
    criticalFailureFrom: 96, partialBand: 20,
    multipliers: { critical_failure: 0, great_success: 1.25, success: 1, partial: 0.5, failure: 0 },
    sideEffectShare: { critical_failure: 1, failure: 0.5, other: 1 },
  },
  rationale: "P = clamp(5, 95, Bf + Ms − 0.3(C − 50) − 5(n − 1) − 15s + D). Great success when roll ≤ P/4.",
  basedOn: ["design.dice"],
  calibration: "Bot simulation success rate per feasibility score.",
};

export const GATES = {
  parliament: { value: { popularityWeight: 0.2, conflictPerLevel: 2, conflictMax: 8, noise: 4, passAbove: 50 }, rationale: "vote = support + (popularity − 50)·0.2 − conflict + U(−4, 4); passes above 50.", basedOn: ["design.gates"], calibration: "Bot: 60–85% of legislation passes at the starting support." },
  court: { value: { medium: 0.2, high: 0.5, delayMin: 1, delayMax: 3 }, rationale: "Chance a measure is suspended 1–3 quarters after it starts.", basedOn: ["design.gates"], calibration: "Playtest." },
  public: { value: { threshold: 25, chance: 0.5, stabilityHit: 3, delayQuarters: 1 }, rationale: "A losing group pushed below 25 may protest: stability −3 and the measure starts 1 quarter later.", basedOn: ["design.gates", "data.mass-mobilization"], calibration: "Protest frequency close to Mass Mobilization rates for similar regimes." },
} satisfies Record<string, Param<unknown>>;

export const TICK = {
  meanReversion: { value: 0.05, rationale: "Stats drift 5% of the gap back to the country's baseline each quarter.", basedOn: ["design.tick"], calibration: "A passive bot's stats stay near baseline." },
  groupDrift: { value: 0.25, rationale: "S ← S + 0.25 (T − S), T = weighted goodness of the stats the group cares about.", basedOn: ["design.tick"], calibration: "Passive bot's popularity stays within 40–60." },
  debtInterest: { value: { threshold: 60, budgetCutPer10: 0.1 }, rationale: "Above 60% of GDP, next year's budget drops 0.1% of GDP per 10 points over.", basedOn: ["design.tick", "paper.herndon-ash-pollin-2013"], calibration: "No hard cliff at 90%." },
} satisfies Record<string, Param<unknown>>;

/** Goodness 0–100 of a stat value, as piecewise-linear points [value, goodness]. Used for group targets and pillars. */
export const GOODNESS: Param<Record<StatKey, [number, number][]>> = {
  value: {
    gdpGrowth: [[-5, 0], [0, 30], [3, 70], [6, 100]],
    inflation: [[-3, 30], [0, 70], [2, 100], [5, 70], [10, 30], [25, 0]],
    unemployment: [[2, 100], [5, 75], [10, 35], [20, 0]],
    budget: [[-2, 0], [0, 40], [2, 80], [4, 100]],
    debt: [[20, 100], [60, 70], [100, 35], [150, 0]],
    health: [[0, 0], [100, 100]],
    education: [[0, 0], [100, 100]],
    crime: [[0, 100], [100, 0]],
    inequality: [[25, 100], [35, 70], [45, 35], [60, 0]],
    corruption: [[0, 100], [100, 0]],
    pressFreedom: [[0, 0], [100, 100]],
    stability: [[0, 0], [100, 100]],
    parliament: [[30, 0], [50, 50], [70, 100]],
    environment: [[0, 0], [100, 100]],
    foreignRelations: [[0, 0], [100, 100]],
  },
  rationale: "Design curves: inflation is best near 2%, Gini best when low.",
  basedOn: ["design.goodness"],
  calibration: "Pillar grades of real countries at game start spread across B–D.",
};

/** What each voter group cares about (equal weights), from the design's group table. */
export const GROUP_INTERESTS: Param<Record<GroupKey, StatKey[]>> = {
  value: {
    farmers: ["inflation", "environment", "inequality"],
    urban: ["inflation", "unemployment", "crime", "health"],
    business: ["gdpGrowth", "stability", "foreignRelations", "corruption"],
    youth: ["education", "unemployment", "pressFreedom", "environment"],
    military: ["stability", "foreignRelations", "budget"],
  },
  rationale: "Interests listed in the design's voter-group table.",
  basedOn: ["design.groups"],
  calibration: "Playtest.",
};

export const PILLARS: Record<"economy" | "society" | "politics" | "other", StatKey[]> = {
  economy: ["gdpGrowth", "inflation", "unemployment", "budget", "debt"],
  society: ["health", "education", "crime", "inequality"],
  politics: ["corruption", "pressFreedom", "stability", "parliament"],
  other: ["environment", "foreignRelations"],
};

/** Values with no real-data source yet. Shown in the game with a "design value" label. */
export const UNSOURCED_DEFAULTS: Param<{ groupSatisfaction: number; parliament: number; foreignRelations: number }> = {
  value: { groupSatisfaction: 50, parliament: 55, foreignRelations: 50 },
  rationale: "Placeholders until a real source is chosen (see the sources tab of the plan).",
  basedOn: ["design.unsourced"],
  calibration: "Replace with sourced values before launch.",
};

export const ELECTION: Param<{ econWeight: number; econQuarters: number; noise: number; winAbove: number }> = {
  value: { econWeight: 0.15, econQuarters: 4, noise: 3, winAbove: 50 },
  rationale: "V = Σ w_g S_g + 0.15 (E − 50) + U(−3, 3). Direction from economic-voting research.",
  basedOn: ["paper.lewis-beck-stegmaier-2000"],
  calibration: "Passive bot wins 35–55% of elections.",
};

export const EARLY_ENDINGS = {
  impeached: { value: { parliamentBelow: 35, corruptionAbove: 70, chance: 0.15 }, rationale: "Legislative shield + scandal, as in Pérez-Liñán (2007).", basedOn: ["paper.perez-linan-2007"], calibration: "Rare for a passive bot (<2%)." },
  coup: { value: { militaryBelow: 25, stabilityBelow: 30, base: 0.10, perPoint: 0.005 }, rationale: "Military discontent + instability; success defined as in Powell & Thyne.", basedOn: ["data.powell-thyne"], calibration: "Rare for a passive bot (<2%)." },
  uprising: { value: { popularityBelow: 15, stabilityBelow: 20, chance: 0.2 }, rationale: "Mass mobilisation against a deeply unpopular government.", basedOn: ["data.mass-mobilization"], calibration: "Rare for a passive bot (<1%)." },
} satisfies Record<string, Param<unknown>>;

/** MVP pacing: one term, decisions on fixed quarters. */
export const PACING: Param<{ quarters: number; decisionQuarters: number[]; cardCooldownDefault: number }> = {
  value: { quarters: 16, decisionQuarters: [2, 4, 7, 9, 12, 14], cardCooldownDefault: 4 },
  rationale: "6 decisions per term so players do not tire; quarter 16 is the election.",
  basedOn: ["design.pacing"],
  calibration: "Playtest: a full game takes 15–20 minutes.",
};

/** Penalty when the guard/judge classes an answer as "meta" (talking to the AI): the leader made a strange public statement. */
export const META_PENALTY: Param<{ allGroups: number }> = {
  value: { allGroups: -2 },
  rationale: "Strange public statement by the leader: every group −2, no policy effects.",
  basedOn: ["design.rubric"],
  calibration: "Injection attempts never beat a plain relevant answer in eval.",
};

/** Pillar grade from the change of the pillar score (mean goodness) between start and end. */
export const GRADES: Param<{ A: number; B: number; C: number; D: number }> = {
  value: { A: 10, B: 3, C: -3, D: -10 },   // change >= A → A, >= B → B, > C → C, > D → D, else F
  rationale: "A = improved at least 10 points, F = worse by more than 10.",
  basedOn: ["design.grades"],
  calibration: "Passive bot mostly gets C.",
};

/** MVP legacy score 0–100. Long-term effects join in v1. */
export const LEGACY: Param<{ pillarWeight: number; popularityWeight: number; pillarChangeScale: number; earlyEndPenalty: number }> = {
  value: { pillarWeight: 0.75, popularityWeight: 0.25, pillarChangeScale: 2.5, earlyEndPenalty: 30 },
  rationale: "pillarPart = clamp(50 + 2.5 × mean pillar change, 0, 100); legacy = 0.75·pillarPart + 0.25·popularity − 30 if impeached or coup.",
  basedOn: ["design.grades"],
  calibration: "Passive bot scores 40–60.",
};
