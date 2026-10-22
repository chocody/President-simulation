// Renders the per-call blocks. The rules text (judge.v1 etc.) stays byte-identical so it can be cached.
import type { Card, Evidence, GameState } from "@ps/shared";
import { CHRONICLE_LINES } from "../config";
import type { CountryContext } from "../types";

/** Player text is data, not markup: neutralise angle brackets so no tag can be imitated or closed. */
export function escapeText(s: string): string {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const num = (n: number): string => String(Number(n.toFixed(2)));

/** Layer 2: the country block. Stable for a whole game, so it carries its own cache breakpoint. */
export function renderCountryBlock(country: CountryContext): string {
  return [
    "<country>",
    `name: ${escapeText(country.nameEn)} (${escapeText(country.nameTh)})`,
    `region: ${escapeText(country.region)}`,
    "political_system: head of government with a parliament, courts and a free press, as modelled by the game",
    "output_language: Thai",
    "</country>",
  ].join("\n");
}

export function renderState(state: GameState | null): string {
  if (!state) {
    return "<state>\nnot specified: judge for a typical middle-income country, without particular figures.\n</state>";
  }
  const stats = Object.entries(state.stats).map(([k, v]) => `  ${k}: ${num(v)}`);
  const groups = Object.entries(state.groups).map(
    ([k, g]) => `  ${k}: share ${num(g.share)}, satisfaction ${num(g.satisfaction)}`,
  );
  return [
    "<state>",
    `quarter: ${state.quarter} of 16`,
    `popularity: ${num(state.popularity)}`,
    "stats:",
    ...stats,
    "groups:",
    ...groups,
    "</state>",
  ].join("\n");
}

export function renderChronicle(state: GameState | null): string {
  const lines = state ? state.log.slice(-CHRONICLE_LINES).map(escapeText) : [];
  return ["<chronicle>", ...lines, "</chronicle>"].join("\n");
}

export function renderEvent(card: Card | null): string {
  if (!card) return "<event>\n</event>";
  return ["<event>", `title: ${escapeText(card.titleTh)}`, `situation: ${escapeText(card.situationTh)}`, "</event>"].join("\n");
}

export function renderEvidence(evidence: Evidence[]): string {
  const items = evidence.map(
    (e) =>
      `- id: ${e.id} | indicator: ${e.indicator} | direction: ${e.direction} | strength: ${e.strength} | summary: ${escapeText(e.summaryEn)}`,
  );
  return ["<evidence>", ...items, "</evidence>"].join("\n");
}

export interface JudgeTurnInput {
  state: GameState | null;
  card: Card | null;
  evidence: Evidence[];
  playerText: string;
}

/** Layer 3: the turn block (user message) for the judge. */
export function renderJudgeTurn(i: JudgeTurnInput): string {
  return [
    renderChronicle(i.state),
    renderState(i.state),
    renderEvent(i.card),
    renderEvidence(i.evidence),
    "<player_response>",
    escapeText(i.playerText),
    "</player_response>",
  ].join("\n");
}
