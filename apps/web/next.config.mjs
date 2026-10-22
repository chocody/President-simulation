import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The workspace packages ship TypeScript sources.
  transpilePackages: ["@ps/shared", "@ps/engine"],
  reactStrictMode: true,
  // Monorepo root, so file tracing and the lockfile check look at the right place.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
};

export default nextConfig;
