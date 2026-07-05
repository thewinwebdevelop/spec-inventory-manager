// Environment variable validation (F-000 · T-000-02 · AC14).
// Spec: docs/features/F-000/infra.md §8.1/§8.2.
//
// This module owns the SHAPE of process.env that apps/api needs to boot.
// The list of required vars mirrors .env.example at the repo root exactly —
// as backend-api's features land, both files grow together.
//
// Consumers call `loadEnv(process.env)` (or `envSchema.parse(...)` directly)
// as the very first thing at boot, before any framework bootstrap. On
// failure this module prints the offending variable name(s) to stderr and
// exits the process non-zero — it does not throw past the caller, so a
// missing var can never surface as an unhandled framework stack trace.
import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .min(1, "DATABASE_URL is required")
    .url("DATABASE_URL must be a valid connection string URL"),
  REDIS_URL: z
    .string({ required_error: "REDIS_URL is required" })
    .min(1, "REDIS_URL is required")
    .url("REDIS_URL must be a valid connection string URL"),
  JWT_ACCESS_SECRET: z
    .string({ required_error: "JWT_ACCESS_SECRET is required" })
    .min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z
    .string({ required_error: "JWT_REFRESH_SECRET is required" })
    .min(1, "JWT_REFRESH_SECRET is required"),
  PORT: z
    .string({ required_error: "PORT is required" })
    .min(1, "PORT is required")
    .regex(/^\d+$/, "PORT must be numeric"),
  NODE_ENV: z.enum(["development", "test", "production"], {
    required_error: "NODE_ENV is required",
    invalid_type_error: "NODE_ENV must be one of development|test|production",
  }),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses & validates `source` (normally `process.env`) against `envSchema`.
 * Returns the typed, validated env on success; never returns on failure —
 * prints every offending variable name + reason to stderr and calls
 * `process.exit(1)`.
 *
 * This is the seam every app boot (apps/api's main.ts, T-000-08) calls
 * before `NestFactory.create(...)`.
 */
export function loadEnv(
  source: NodeJS.ProcessEnv = process.env,
): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const offending = result.error.issues.map((issue) => {
      const varName = issue.path.join(".") || "(unknown)";
      return `${varName}: ${issue.message}`;
    });

    // eslint-disable-next-line no-console
    console.error("Invalid environment variables:");
    for (const line of offending) {
      // eslint-disable-next-line no-console
      console.error(`  - ${line}`);
    }

    process.exit(1);
  }

  return result.data;
}
