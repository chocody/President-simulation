// Claude Opus 5.5 list prices, USD per million tokens (cache read $0.20 per the SDK model table).
// Cache writes are billed at 1.25x the input price (5-minute ephemeral cache).
export const PRICE_PER_MTOK = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 4 * 1.25 } as const;

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function costUsd(t: TokenCounts): number {
  return (
    (t.inputTokens * PRICE_PER_MTOK.input +
      t.outputTokens * PRICE_PER_MTOK.output +
      t.cacheReadTokens * PRICE_PER_MTOK.cacheRead +
      t.cacheWriteTokens * PRICE_PER_MTOK.cacheWrite) /
    1_000_000
  );
}
