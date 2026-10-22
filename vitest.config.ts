import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@ps/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      "@ps/engine": fileURLToPath(new URL("./packages/engine/src/index.ts", import.meta.url)),
    },
  },
  test: { include: ["packages/*/test/**/*.test.ts", "scripts/**/*.test.ts"] },
});
