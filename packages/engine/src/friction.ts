import { FRICTION, type Action, type StatKey } from "@ps/shared";
import { NEUTRAL_TRAIT, type Traits } from "./traits";

/** Direction of change that counts as a reform for each FRICTION.reformTargets stat (spec E3). */
const REFORM_DIRECTION: Partial<Record<StatKey, "up" | "down">> = {
  corruption: "down",
  pressFreedom: "up",
  parliament: "up",
};

/** A reform: some effect lowers corruption or raises press freedom or parliamentary checks. */
export function isReform(action: Action): boolean {
  return action.effects.some((e) => {
    const want = REFORM_DIRECTION[e.indicator as StatKey];
    return want !== undefined && want === e.direction && FRICTION.value.reformTargets.includes(e.indicator as StatKey);
  });
}

export interface Friction {
  reform: boolean;
  patronage: number;
  /** Added to the parliament vote (negative = harder). 0 when not a reform. */
  voteAdjust: number;
  /** Added to the success chance in percentage points. 0 when not a reform. */
  probabilityAdjust: number;
}

/** Institutional friction for one action. Patronage missing = 50 = no friction. */
export function frictionFor(action: Action, traits: Traits | undefined): Friction {
  const patronage = traits?.patronage ?? NEUTRAL_TRAIT;
  if (!isReform(action)) return { reform: false, patronage, voteAdjust: 0, probabilityAdjust: 0 };
  const f = FRICTION.value;
  const gap = patronage - NEUTRAL_TRAIT;
  // `|| 0` turns -0 into 0 when patronage is neutral
  return { reform: true, patronage, voteAdjust: -f.parliamentPerPoint * gap || 0, probabilityAdjust: -f.probabilityPerPoint * gap || 0 };
}

export interface FrictionNote {
  /** Index into TurnReport.measures. */
  measure: number;
  patronage: number;
  vote: number;
  probability: number;
}

const NOTE_RE = /^friction: measure (\d+) is a reform; patronage ([-\d.]+) -> parliament vote ([-+\d.]+), success chance ([-+\d.]+) points$/;

/** The line pushed to TurnReport.notes when friction applied to a measure (so the UI can explain it). */
export function formatFrictionNote(n: FrictionNote): string {
  const sign = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2);
  return `friction: measure ${n.measure} is a reform; patronage ${n.patronage.toFixed(1)} -> parliament vote ${sign(n.vote)}, success chance ${sign(n.probability)} points`;
}

export function parseFrictionNote(note: string): FrictionNote | null {
  const m = NOTE_RE.exec(note);
  if (!m) return null;
  return { measure: Number(m[1]), patronage: Number(m[2]), vote: Number(m[3]), probability: Number(m[4]) };
}
