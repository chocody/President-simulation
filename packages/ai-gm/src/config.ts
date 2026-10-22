// Fixed settings of the AI game master (spec A1).
export const MODEL = "claude-opus-5-5";

/** `output_config.effort` per route. Set explicitly: thinking cannot be switched off on Opus 5.5. */
export const EFFORT = { judge: "medium", narrator: "low", historian: "medium" } as const;

/** Output budget per route. Includes adaptive thinking tokens. Kept below the non-streaming limit. */
export const MAX_TOKENS = { judge: 12000, narrator: 4000, historian: 4000 } as const;

/** Beta header for `fallbacks: "default"` (server-side retry on another model after a refusal). */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Same bounds as the contract's `Answer` free text. */
export const PLAYER_TEXT_MIN = 20;
export const PLAYER_TEXT_MAX = 800;

/** Number of chronicle lines the judge sees. */
export const CHRONICLE_LINES = 8;

/** Opening words of the historian's line (spec A1). */
export const HISTORIAN_PREFIX = "ประวัติศาสตร์จะจดจำคุณว่า";
export const HISTORIAN_MAX_WORDS = 25;
