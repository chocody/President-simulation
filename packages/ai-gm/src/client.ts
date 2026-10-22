import Anthropic from "@anthropic-ai/sdk";
import type { GmClient } from "./types";

/**
 * Real client for scripts and the server. The key comes only from the game-specific variable, so a
 * developer's own Claude Code billing is never touched. Tests inject a mock `GmClient` instead.
 */
export function createClient(env: Record<string, string | undefined> = process.env): GmClient {
  const apiKey = env.GAME_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("GAME_ANTHROPIC_API_KEY is not set. Set it to the game's API key, or run the script with --dry.");
  }
  // authToken: null keeps the SDK from also picking up a bearer token from the environment.
  const sdk = new Anthropic({ apiKey, authToken: null });
  return { beta: { messages: { parse: (params) => sdk.beta.messages.parse(params) } } };
}
