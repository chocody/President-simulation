// The GameState lives in the browser (no database). Every access is guarded: storage can be blocked.
import type { GameState } from "@ps/shared";
import type { DecideResult, EndResponse, GameInfo, PublicCard, PublicNewsItem } from "./api-types";

export type Screen = "charter" | "main" | "decision" | "result" | "ending";

export interface SavedGame {
  v: 1;
  state: GameState;
  info: GameInfo;
  screen: Screen;
  card: PublicCard | null;
  result: DecideResult | null;
  ending: EndResponse | null;
  log: string[];
  /** Minor events from the last advance (absent in older saves). */
  news?: PublicNewsItem[];
}

const KEY = "president-sim.game.v1";

export function loadSaved(): SavedGame | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as SavedGame;
    return g && g.v === 1 && g.state && g.info ? g : null;
  } catch {
    return null;
  }
}

export function saveGame(g: SavedGame): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(g));
  } catch {
    // storage unavailable: the game still works until the page is closed
  }
}

export function clearSaved(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
