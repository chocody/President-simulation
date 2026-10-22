// Shapes exchanged between the API routes and the client. Contract types come from @ps/shared.
import type { z } from "zod";
import type {
  Card, CountryData, DecideResponse as DecideResponseSchema, GameState, GroupKey, Source, TurnReport,
} from "@ps/shared";

export type PublicChoice = Pick<Card["choices"][number],
  "id" | "approach" | "titleTh" | "descTh" | "costHint" | "affectedGroups" | "evidenceIds">;

/** A card as the player sees it: no pre-judged results. */
export type PublicCard = Pick<Card, "id" | "category" | "severity" | "titleTh" | "situationTh"> & {
  choices: PublicChoice[];
};

export interface GameInfo {
  country: CountryData;
  sources: Source[];
  devFixtures: boolean;
}

export interface CountrySummary { iso3: string; nameTh: string; nameEn: string }

export interface InfoResponse {
  devFixtures: boolean;
  countries: CountrySummary[];
  info?: GameInfo;
}

export interface NewResponse { state: GameState; info: GameInfo }
export interface AdvanceResponse { state: GameState; log: string[]; card: PublicCard | null }
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
