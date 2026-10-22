import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { judge } from "../src/routes/judge";
import { JUDGE_RULES } from "../src/prompts/judge.v1";
import { MODEL } from "../src/config";
import { costUsd } from "../src/pricing";
import { card, country, evidence, GOOD_TEXT, mockClient, reply, state, wireJudgment } from "./helpers";

const input = { country, state, card, evidence, playerText: GOOD_TEXT };

function deps(client: ReturnType<typeof mockClient>) {
  const lines: string[] = [];
  let t = 100;
  return { lines, deps: { client, log: (l: string) => lines.push(l), now: () => (t += 125) } };
}

describe("judge: success", () => {
  it("returns a contract Judgment and usage", async () => {
    const client = mockClient(reply(wireJudgment()));
    const { deps: d } = deps(client);
    const r = await judge(input, d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.scores.relevance).toBe("4");
    expect(r.value.actions[0]!.effects[0]!.indicator).toBe("group:urban");
    expect(r.usage.inputTokens).toBe(1000);
    expect(r.usage.cacheReadTokens).toBe(2000);
    expect(r.usage.latencyMs).toBe(125);
    expect(r.usage.costUsd).toBeCloseTo(0.0144, 6);
  });

  it("builds the request as specified", async () => {
    const client = mockClient(reply(wireJudgment()));
    await judge(input, deps(client).deps);
    expect(client.calls).toHaveLength(1);
    const p = client.calls[0]!;
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.model).toBe(MODEL);
    expect(p.output_config.effort).toBe("medium");
    expect(p.output_config.format).toBeDefined();
    expect(p.betas).toContain("server-side-fallback-2026-07-01");
    expect(p.fallbacks).toBe("default");
    // parameters that return 400 on Opus 5.5 must never be sent
    for (const k of ["temperature", "top_p", "top_k", "thinking", "tool_choice", "budget_tokens"]) {
      expect(p).not.toHaveProperty(k);
    }
    // system = rules block + country block, each with a cache breakpoint
    expect(p.system).toHaveLength(2);
    expect(p.system[0].text).toBe(JUDGE_RULES);
    expect(p.system[1].text).toContain(country.nameEn);
    for (const b of p.system) expect(b.cache_control).toEqual({ type: "ephemeral" });
    // one user message, no assistant prefill
    expect(p.messages).toHaveLength(1);
    expect(p.messages[0].role).toBe("user");
    expect(p.messages[0].content).toContain("<player_response>");
  });

  it("logs exactly one JSON line per call", async () => {
    const client = mockClient(reply(wireJudgment()));
    const { lines, deps: d } = deps(client);
    await judge(input, d);
    expect(lines).toHaveLength(1);
    const o = JSON.parse(lines[0]!);
    expect(o).toMatchObject({
      route: "judge", model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 500,
      cache_read_tokens: 2000, cache_write_tokens: 0, stop_reason: "end_turn", latency_ms: 125,
    });
    expect(o.cost_usd).toBeCloseTo(0.0144, 6);
  });
});

describe("judge: input guard", () => {
  it("rejects text under 20 characters before calling the model", async () => {
    const client = mockClient(reply(wireJudgment()));
    const { lines, deps: d } = deps(client);
    const r = await judge({ ...input, playerText: "สั้นไป" }, d);
    expect(r).toMatchObject({ ok: false, reason: "input_too_short" });
    expect(client.calls).toHaveLength(0);
    expect(lines).toHaveLength(0);
  });

  it("rejects text over 800 characters before calling the model", async () => {
    const client = mockClient(reply(wireJudgment()));
    const r = await judge({ ...input, playerText: "ก".repeat(801) }, deps(client).deps);
    expect(r).toMatchObject({ ok: false, reason: "input_too_long" });
    expect(client.calls).toHaveLength(0);
  });

  it("accepts the boundaries 20 and 800", async () => {
    const client = mockClient(reply(wireJudgment()));
    expect((await judge({ ...input, playerText: "ก".repeat(20) }, deps(client).deps)).ok).toBe(true);
    expect((await judge({ ...input, playerText: "ก".repeat(800) }, deps(client).deps)).ok).toBe(true);
  });
});

describe("judge: failure paths", () => {
  it("returns reason refused on stop_reason refusal, without reading the output", async () => {
    const client = mockClient(reply(wireJudgment(), { stop_reason: "refusal" }));
    const r = await judge(input, deps(client).deps);
    expect(r).toMatchObject({ ok: false, reason: "refused" });
    expect(r.usage.stopReason).toBe("refusal");
  });

  it("returns reason invalid when parsed output is missing", async () => {
    const r = await judge(input, deps(mockClient(reply(null))).deps);
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("returns reason invalid when the output has an unknown target", async () => {
    const bad = wireJudgment();
    bad.actions[0].effects[0].indicator = "group:aliens";
    const r = await judge(input, deps(mockClient(reply(bad))).deps);
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("returns reason invalid when the SDK throws a parse error", async () => {
    const r = await judge(input, deps(mockClient(new ZodError([]))).deps);
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("returns reason invalid when the output was cut off at max_tokens", async () => {
    const r = await judge(input, deps(mockClient(reply(wireJudgment(), { stop_reason: "max_tokens" }))).deps);
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("returns reason error (not a throw) when the client fails", async () => {
    const r = await judge(input, deps(mockClient(new Error("socket hang up"))).deps);
    expect(r).toMatchObject({ ok: false, reason: "error" });
    if (!r.ok) expect(r.message).toContain("socket hang up");
  });

  it("still logs a line for refused and failed calls", async () => {
    const { lines, deps: d } = deps(mockClient(reply(null, { stop_reason: "refusal" })));
    await judge(input, d);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).stop_reason).toBe("refusal");
  });
});

describe("costUsd", () => {
  it("uses $4 / $20 per MTok and $0.20 cache read", () => {
    expect(costUsd({ inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeCloseTo(4);
    expect(costUsd({ inputTokens: 0, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeCloseTo(20);
    expect(costUsd({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0 })).toBeCloseTo(0.2);
  });
});
