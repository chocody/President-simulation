import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "../src/client";

describe("createClient", () => {
  it("throws a clear error when the game key is missing", () => {
    expect(() => createClient({})).toThrow(/GAME_ANTHROPIC_API_KEY/);
  });

  it("builds a client from the game key only", () => {
    const c = createClient({ GAME_ANTHROPIC_API_KEY: "test-key-not-real" });
    expect(typeof c.beta.messages.parse).toBe("function");
  });

  it("ignores the generic Anthropic variable (it would switch the developer's billing)", () => {
    const other = "ANTHROPIC_" + "API_KEY";
    expect(() => createClient({ [other]: "x" })).toThrow(/GAME_ANTHROPIC_API_KEY/);
  });
});

describe("key hygiene", () => {
  const root = join(import.meta.dirname, "../../..");
  const forbidden = new RegExp("(?<![A-Z_])ANTHROPIC_" + "API_KEY");

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules") continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|json|md)$/.test(name)) out.push(p);
    }
    return out;
  }

  it("no source, script or eval mentions the generic variable name", () => {
    const files = [
      ...walk(join(root, "packages/ai-gm")),
      ...walk(join(root, "evals")),
      join(root, "scripts/prejudge-choices.ts"),
    ];
    const bad = files.filter((f) => !f.endsWith("client.test.ts") && forbidden.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
