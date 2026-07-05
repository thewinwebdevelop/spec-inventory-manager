// Entry point for @omnistock/config.
// Re-exports the zod env schema (packages/config/src/env.ts, T-000-02/AC14) so
// consumers whose TS `moduleResolution` doesn't follow package.json `exports`
// subpaths (e.g. apps/api's default "node" resolution) can still import
// `loadEnv`/`Env` from the package root instead of the `./env` subpath.
// `@omnistock/config/env` remains valid wherever subpath exports resolve
// (e.g. tsx-run scripts) — this barrel is an additive, equivalent path.
export { envSchema, loadEnv } from "./env";
export type { Env } from "./env";
