// FROZEN by the Lead. Every engine constant lives here, labeled with what it is based on.
// "kind: design" = a game-design value, anchored to research where one exists and tuned by simulation.
// Source ids refer to data/sources/sources.yaml.
import type { GroupKey, StatKey, TraitKey } from "./contracts";

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
    budget: [0.1, 0.3, 0.6],   // % of GDP, total change to discretionary room over the effect's duration
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
  groupDrift: { value: 0.25, rationale: "S ← S + 0.25 (T − S), T = 50 + targetScale · (goodness of the group's stats now − at the start of the term). Voters judge change, not the level they already had.", basedOn: ["design.tick", "paper.lewis-beck-stegmaier-2000"], calibration: "Passive bot's popularity stays within 40–60 on the real countries." },
  targetScale: { value: 3, rationale: "One point of goodness gained moves the group's target 3 satisfaction points.", basedOn: ["design.tick"], calibration: "Passive bot wins 35–55% of elections on the real countries." },
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
    military: ["stability", "foreignRelations"],
  },
  rationale: "Interests listed in the design's voter-group table. Defence policy has no stat in the MVP, so military uses stability and foreign relations.",
  basedOn: ["design.groups"],
  calibration: "Playtest.",
};

export const PILLARS: Record<"economy" | "society" | "politics" | "other", StatKey[]> = {
  economy: ["gdpGrowth", "inflation", "unemployment", "debt"],   // budget is spending room, not an outcome
  society: ["health", "education", "crime", "inequality"],
  politics: ["corruption", "pressFreedom", "stability", "parliament"],
  other: ["environment", "foreignRelations"],
};

/** Values with no real-data source yet. Shown in the game with a "design value" label. */
export const UNSOURCED_DEFAULTS: Param<{ groupSatisfaction: number; parliament: number; foreignRelations: number; debt: number }> = {
  value: { groupSatisfaction: 50, parliament: 55, foreignRelations: 50, debt: 60 },   // debt: used only when WDI central-government debt is missing or too old
  rationale: "Placeholders until a real source is chosen (see the sources tab of the plan).",
  basedOn: ["design.unsourced"],
  calibration: "Replace with sourced values before launch.",
};

export const ELECTION: Param<{ econWeight: number; econQuarters: number; noise: number; winAbove: number }> = {
  value: { econWeight: 0.15, econQuarters: 4, noise: 3, winAbove: 50 },
  rationale: "V = Σ w_g S_g + 0.15 (E − 50) + U(−3, 3), E = 50 + (economy pillar over the last 4 quarters − at the start). Direction from economic-voting research.",
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

/**
 * How real indicators become game-scale stats (scripts/build-countries.ts).
 * Each rule lists the WDI/WGI codes it reads. A country missing a required code is left out of the game,
 * never filled with a guess. `linear: [a, b]` maps raw a → 0 and raw b → 100, clamped.
 */
export const DATA_MAPPING: Param<{
  maxDataAgeYears: number;
  /** Per-code age limits that replace maxDataAgeYears. The data year is always shown to the player. */
  maxAgeOverride: Record<string, number>;
  /** Direct stats that fall back to UNSOURCED_DEFAULTS (labelled as design values) instead of skipping the country. */
  optionalDirect: StatKey[];
  direct: Partial<Record<StatKey, { code: string; transform: "identity" | "100-minus" }>>;
  health: { lifeExpectancy: { code: string; linear: [number, number] }; uhc: { code: string } };
  education: { enrollment: { code: string; cap: number }; hci: { code: string; scale: number } };
  crime: { code: string; linear: [number, number] };
  environment: { pm25: { code: string; linear: [number, number] }; forest: { code: string; linear: [number, number] }; co2: { code: string; linear: [number, number] } };
  groups: {
    agriculture: string; rural: string; employers: string; armedForces: string;
    youthBands: string[]; adultTotal: string;
  };
}> = {
  value: {
    maxDataAgeYears: 8,
    // Homicide series are updated irregularly (e.g. latest 2011 for some MVP countries); allow 15 years, year shown.
    maxAgeOverride: { "VC.IHR.PSRC.P5": 15 },
    // WDI central-government debt is missing or decades old for 7 of 10 MVP countries (first live run, 2026-10-23).
    optionalDirect: ["debt"],
    direct: {
      gdpGrowth: { code: "NY.GDP.MKTP.KD.ZG", transform: "identity" },
      inflation: { code: "FP.CPI.TOTL.ZG", transform: "identity" },
      unemployment: { code: "SL.UEM.TOTL.ZS", transform: "identity" },
      debt: { code: "GC.DOD.TOTL.GD.ZS", transform: "identity" },
      inequality: { code: "SI.POV.GINI", transform: "identity" },
      corruption: { code: "GOV_WGI_CC_SC", transform: "100-minus" },
      pressFreedom: { code: "GOV_WGI_VA_SC", transform: "identity" },
      stability: { code: "GOV_WGI_PV_SC", transform: "identity" },
    },
    health: { lifeExpectancy: { code: "SP.DYN.LE00.IN", linear: [50, 85] }, uhc: { code: "SH.UHC.SRVS.CV.XD" } },
    education: { enrollment: { code: "SE.SEC.ENRR", cap: 100 }, hci: { code: "HD.HCI.OVRL", scale: 100 } },
    crime: { code: "VC.IHR.PSRC.P5", linear: [0, 30] },
    environment: {
      pm25: { code: "EN.ATM.PM25.MC.M3", linear: [75, 5] },
      forest: { code: "AG.LND.FRST.ZS", linear: [0, 60] },
      co2: { code: "EN.GHG.CO2.PC.CE.AR5", linear: [20, 0] },
    },
    groups: {
      agriculture: "SL.AGR.EMPL.ZS",
      rural: "SP.RUR.TOTL.ZS",
      employers: "SL.EMP.MPYR.ZS",
      armedForces: "MS.MIL.TOTL.TF.ZS",
      youthBands: ["SP.POP.2024.MA.5Y", "SP.POP.2024.FE.5Y", "SP.POP.2529.MA.5Y", "SP.POP.2529.FE.5Y"],
      adultTotal: "SP.POP.1564.TO.ZS",
    },
  },
  rationale:
    "health = mean(LE scaled 50→85 yrs, UHC index), or LE alone when the UHC index is not served by the WDI API; education = mean(secondary enrollment capped at 100, HCI×100) or enrollment alone when HCI is missing; " +
    "crime = homicides scaled 0→30 per 100k; environment = mean(PM2.5 75→5 µg, forest 0→60 %, CO2 20→0 t per person). " +
    "Groups: farmers ∝ agriculture share of employment, business ∝ employers share, military ∝ armed forces share, youth ∝ ages 20–29 among 15–64 " +
    "(WPP bands via WDI, 18–19 not separable), urban = remainder; shares normalised to 1.",
  basedOn: ["design.mapping"],
  calibration: "Starting stats of the 10 MVP countries spread across the 0–100 range; check by eye before launch.",
};

/** MVP country list (ISO3). Five regions, mixed income levels and political systems. The owner may change it. */
export const MVP_COUNTRIES: Param<string[]> = {
  value: ["THA", "VNM", "IDN", "IND", "NGA", "KEN", "BRA", "MEX", "POL", "DEU"],
  rationale: "Proposed by the Lead for regional spread; not yet confirmed by the owner.",
  basedOn: ["design.mapping"],
  calibration: "Every country passes the data-completeness check in build-countries.",
};

/**
 * Country traits from real indicators (World Bank API). linear [a, b] maps raw a → 0 and b → 100.
 * patronage: no clientelism index is served by the World Bank API, so the MVP uses the inverse of WGI Rule of Law
 * as a proxy; V-Dem's clientelism index is the better source (CC BY-SA) for v1.
 */
export const TRAITS: Param<Record<TraitKey, { code: string; linear: [number, number]; invert?: boolean; optional?: boolean }>> = {
  value: {
    tourism: { code: "ST.INT.RCPT.XP.ZS", linear: [0, 30], optional: true },        // tourism receipts, % of exports
    agriculture: { code: "NV.AGR.TOTL.ZS", linear: [0, 30] },                        // agriculture value added, % of GDP
    resources: { code: "NY.GDP.TOTL.RT.ZS", linear: [0, 20] },                      // natural resource rents, % of GDP
    openness: { code: "NE.EXP.GNFS.ZS", linear: [0, 80] },                          // exports, % of GDP
    ruleOfLaw: { code: "GOV_WGI_RL_SC", linear: [0, 100] },
    govEffectiveness: { code: "GOV_WGI_GE_SC", linear: [0, 100] },
    patronage: { code: "GOV_WGI_RL_SC", linear: [0, 100], invert: true },          // proxy, see above
  },
  rationale: "Each trait is a real indicator rescaled to 0–100 so it can weight events and set institutional friction.",
  basedOn: ["design.traits"],
  calibration: "Trait spread across the 10 MVP countries checked by eye against the raw values.",
};

/** Institutional friction: reforms are harder where patronage is high (and easier where it is low). */
export const FRICTION: Param<{ reformTargets: StatKey[]; parliamentPerPoint: number; probabilityPerPoint: number }> = {
  value: { reformTargets: ["corruption", "pressFreedom", "parliament"], parliamentPerPoint: 0.1, probabilityPerPoint: 0.15 },
  rationale:
    "An action is a reform when an effect lowers corruption or raises press freedom or parliamentary checks. " +
    "Its parliament vote changes by −0.1 × (patronage − 50) and its success chance by −0.15 × (patronage − 50) percentage points.",
  basedOn: ["design.traits", "paper.perez-linan-2007"],
  calibration: "At patronage 80 an anti-corruption law loses about 3 vote points and 4.5 points of success chance.",
};

/** Minor events: the news ticker. Small, frequent, shaped by the country's traits. */
export const MINOR_EVENTS: Param<{ perQuarter: [number, number]; cooldownQ: number; traitStrength: number }> = {
  value: { perQuarter: [1, 3], cooldownQ: 6, traitStrength: 1 },
  rationale: "1–3 small news items each quarter; each item cannot repeat within 6 quarters; trait weights at full strength.",
  basedOn: ["design.minor-events"],
  calibration: "Minor events move each stat by at most a few points per year on average (simulation).",
};
