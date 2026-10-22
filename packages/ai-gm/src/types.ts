import type Anthropic from "@anthropic-ai/sdk";
import type { CountryData } from "@ps/shared";

/** Request type of `client.beta.messages.parse` (non-streaming). */
export type ParseParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

/** The part of a parsed beta message the routes read. `ParsedBetaMessage` is assignable to it. */
export interface GmMessage {
  stop_reason: string | null;
  parsed_output: unknown;
  model?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
}

/** Injectable client. Tests pass a mock; production uses `createClient()`. */
export interface GmClient {
  beta: { messages: { parse(params: ParseParams): Promise<GmMessage> } };
}

export interface RouteDeps {
  client: GmClient;
  /** One JSON line per model call. Default: stdout. */
  log?: (line: string) => void;
  /** Millisecond clock for latency. Default: Date.now. */
  now?: () => number;
}

export type FailReason = "refused" | "invalid" | "input_too_short" | "input_too_long" | "error";

export interface Usage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  latencyMs: number;
  stopReason: string | null;
}

export type RouteResult<T> =
  | { ok: true; value: T; usage: Usage }
  | { ok: false; reason: FailReason; message?: string; usage: Usage };

/** What the prompts need to know about the country. `CountryData` fits. */
export type CountryContext = Pick<CountryData, "nameEn" | "nameTh" | "region">;
