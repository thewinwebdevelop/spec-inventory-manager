#!/usr/bin/env -S npx tsx
// Env boot-validation seam (F-000 · T-000-02 · AC14).
//
// This is the exact call apps/api's real bootstrap (main.ts, T-000-08) makes
// before `NestFactory.create(...)`: parse process.env with the shared zod
// schema, exit non-zero with the offending var name(s) on stderr if invalid.
//
// T-000-08 does NOT reimplement this logic — it imports `loadEnv` from
// @omnistock/config and calls it as the first line of `main.ts`. This script
// exists so AC14's positive/negative behavior is provable as a standalone
// process today, without building the NestJS skeleton (out of scope here).
//
// Usage:
//   pnpm --filter api exec tsx scripts/check-env.ts
import { loadEnv } from "@omnistock/config/env";

const env = loadEnv(process.env);

// eslint-disable-next-line no-console
console.log(`env ok — NODE_ENV=${env.NODE_ENV} PORT=${env.PORT}`);
