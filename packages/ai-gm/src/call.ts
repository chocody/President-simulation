// One model call, shared by the three routes: build the request, check refusal, parse, log one JSON line.
import { outputFormat } from "./output-format";
import type { z } from "zod";
import { FALLBACK_BETA, MODEL } from "./config";
import { costUsd } from "./pricing";
import type { FailReason, GmMessage, ParseParams, RouteDeps, RouteResult, Usage } from "./types";

export interface RunOptions<T> {
  route: "judge" | "narrator" | "historian";
  deps: RouteDeps;
  /** System text blocks, stable parts first. Each gets its own cache breakpoint. */
  system: string[];
  /** The turn block (single user message). */
  turn: string;
  /** Schema sent to the model (structured output). */
  wire: z.ZodType;
  effort: "low" | "medium" | "high";
  maxTokens: number;
  /** Strict conversion of the parsed wire value; may throw. */
  convert: (wire: unknown) => T;
}

const stdoutLog = (line: string): void => {
  process.stdout.write(line + "\n");
};

export function emptyUsage(): Usage {
  return {
    model: MODEL, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
    costUsd: 0, latencyMs: 0, stopReason: null,
  };
}

function usageOf(msg: GmMessage, latencyMs: number): Usage {
  const t = {
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
    cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: msg.usage.cache_creation_input_tokens ?? 0,
  };
  return { model: msg.model ?? MODEL, ...t, costUsd: costUsd(t), latencyMs, stopReason: msg.stop_reason };
}

/** Errors thrown by the SDK's own parsing of the structured output (bad JSON or schema mismatch). */
function isParseError(e: unknown): boolean {
  // zod v4 errors are not always `instanceof Error`, so look at the name too.
  const name = (e as { name?: unknown } | null)?.name;
  const message = e instanceof Error ? e.message : "";
  return name === "ZodError" || e instanceof SyntaxError || /Failed to parse structured output/.test(message);
}

export async function runRoute<T>(o: RunOptions<T>): Promise<RouteResult<T>> {
  const log = o.deps.log ?? stdoutLog;
  const now = o.deps.now ?? Date.now;

  const params: ParseParams = {
    model: MODEL,
    max_tokens: o.maxTokens,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: o.system.map((text) => ({ type: "text" as const, text, cache_control: { type: "ephemeral" as const } })),
    messages: [{ role: "user", content: o.turn }],
    // No temperature, prefill, forced tool_choice or `thinking: disabled`: all return 400 on Opus 5.5.
    output_config: { effort: o.effort, format: outputFormat(o.wire) },
  };

  const started = now();
  let msg: GmMessage;
  try {
    msg = await o.deps.client.beta.messages.parse(params);
  } catch (e) {
    const usage = { ...emptyUsage(), latencyMs: now() - started };
    const reason: FailReason = isParseError(e) ? "invalid" : "error";
    const message = e instanceof Error ? e.message : String(e);
    logLine(log, o.route, usage, reason === "invalid" ? "parse_error" : "error");
    return { ok: false, reason, message, usage };
  }
  const usage = usageOf(msg, now() - started);
  logLine(log, o.route, usage, usage.stopReason);

  // Refusal first: its content must not be read.
  if (msg.stop_reason === "refusal") return { ok: false, reason: "refused", usage };
  if (msg.stop_reason === "max_tokens") return { ok: false, reason: "invalid", message: "output cut off at max_tokens", usage };
  if (msg.parsed_output === null || msg.parsed_output === undefined) {
    return { ok: false, reason: "invalid", message: "no parsed output", usage };
  }
  try {
    return { ok: true, value: o.convert(msg.parsed_output), usage };
  } catch (e) {
    return { ok: false, reason: "invalid", message: e instanceof Error ? e.message : String(e), usage };
  }
}

function logLine(log: (l: string) => void, route: string, u: Usage, stopReason: string | null): void {
  log(JSON.stringify({
    route,
    model: u.model,
    input_tokens: u.inputTokens,
    output_tokens: u.outputTokens,
    cache_read_tokens: u.cacheReadTokens,
    cache_write_tokens: u.cacheWriteTokens,
    cost_usd: Number(u.costUsd.toFixed(6)),
    latency_ms: u.latencyMs,
    stop_reason: stopReason,
  }));
}
