// Shapes exchanged between the API routes and the client. Contract types come from @ps/shared.
import type { z } from "zod";
import type {
  Card, CardEffect, CountryData, DecideResponse as DecideResponseSchema, GameState, GroupKey, MinorEvent, SceneRecord, Source, TurnReport,
} from "@ps/shared";

export type PublicChoice = Pick<Card["choices"][number],
  "id" | "approach" | "titleTh" | "descTh" | "costHint" | "affectedGroups" | "evidenceIds">;

/** A card as the player sees it: no pre-judged results. */
export type PublicCard = Pick<Card, "id" | "category" | "severity" | "titleTh" | "situationTh"> & {
  choices: PublicChoice[];
};

/** A minor event as the player sees it (no weights, conditions or source ids). */
export interface PublicMinorEvent {
  id: string;
  category: MinorEvent["category"];
  textTh: string;
  effects: Pick<CardEffect, "target" | "delta">[];
}

/** A minor event that happened, with the quarter it happened in. */
export interface PublicNewsItem extends PublicMinorEvent { quarter: number }

export interface GameInfo {
  country: CountryData;
  sources: Source[];
  devFixtures: boolean;
  /** Text and effects of every minor event, so `state.news` ids can be shown (absent in older saved games). */
  minorEvents?: PublicMinorEvent[];
}

export interface CountrySummary { iso3: string; nameTh: string; nameEn: string }

export interface InfoResponse {
  devFixtures: boolean;
  countries: CountrySummary[];
  info?: GameInfo;
}

export interface NewResponse { state: GameState; info: GameInfo }
export interface AdvanceResponse {
  state: GameState;
  log: string[];
  card: PublicCard | null;
  /** Minor events that happened while advancing, oldest first. */
  news: PublicNewsItem[];
  /** Follow-up and court scenes that happened while advancing, oldest first. */
  scenes: SceneRecord[];
}
export type DecideResult = z.infer<typeof DecideResponseSchema> & { headlines: string[]; answerTitle: string; interpretation: string | null };

export type Grade = "A" | "B" | "C" | "D" | "F";
export type PillarKey = "economy" | "society" | "politics" | "other";

export interface EndResponse {
  endReason: GameState["endReason"];
  voteShare: number | null;
  /** Per group: share of the electorate x satisfaction = points of vote share. */
  groups: { group: GroupKey; share: number; satisfaction: number; contribution: number }[];
  /** Vote share not explained by the groups: the economy term and the election noise. */
  otherPart: number | null;
  grades: Record<PillarKey, { change: number; grade: Grade }>;
  legacy: number;
  popularity: number;
  historian: { archetype: string; line: string };
}

export interface ApiError { error: string }
export type { TurnReport };
