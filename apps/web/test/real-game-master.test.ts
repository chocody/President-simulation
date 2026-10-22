import { describe, expect, it } from "vitest";
import { getGameMaster, MockGameMaster } from "../server/game-master";
import { GameMasterError, RealGameMaster } from "../server/real-game-master";
import type { GmClient } from "@ps/ai-gm";
import { newGame } from "@ps/engine";
import { FIXTURE_COUNTRY } from "../dev/fixture-country";

describe("game master selection", () => {
  it("uses the mock without a game key", () => {
    expect(getGameMaster({})).toBeInstanceOf(MockGameMaster);
  });
  it("uses the real game master with a game key", () => {
    expect(getGameMaster({ GAME_ANTHROPIC_API_KEY: "test-key" })).toBeInstanceOf(RealGameMaster);
  });
  it("GAME_MASTER=mock forces the mock", () => {
    expect(getGameMaster({ GAME_ANTHROPIC_API_KEY: "test-key", GAME_MASTER: "mock" })).toBeInstanceOf(MockGameMaster);
  });
  it("maps a refusal to a GameMasterError with reason refused", async () => {
    const client: GmClient = { beta: { messages: { parse: async () => ({
      stop_reason: "refusal", parsed_output: null, usage: { input_tokens: 1, output_tokens: 0 },
    }) } } };
    const gm = new RealGameMaster(client, () => FIXTURE_COUNTRY);
    const state = newGame({ country: FIXTURE_COUNTRY, difficulty: "normal", seed: "t" });
    const err = await gm.judge({ state, card: null as never, playerText: "x".repeat(30), evidence: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(GameMasterError);
    expect((err as GameMasterError).reason).toBe("refused");
  });
});
