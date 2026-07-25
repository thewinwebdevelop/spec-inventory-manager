// F-000 · T-000-08 — Redis connection provider, shared by BullMQ + the health
// probe (AC15). Spec: docs/features/F-000/infra.md §9 ("BullMQ boot in F-000
// is intentionally minimal: one Queue instance constructed against the Redis
// connection ... The health probe checks the connection, not a queue's
// job-processing correctness").
import { Redis } from "ioredis";
import type { Env } from "@omnistock/config";

export const REDIS_CONNECTION = Symbol("REDIS_CONNECTION");

/**
 * Builds the ioredis connection BullMQ's Queue also uses. `maxRetriesPerRequest:
 * null` is BullMQ's documented requirement for a connection it manages.
 *
 * `retryStrategy` returns a capped backoff but NEVER `null` (never gives up):
 * a health probe must keep re-attempting so it can flip back to "ok" once
 * Redis comes back — returning `null` after N attempts would leave the
 * connection permanently closed and the probe permanently "fail" even after
 * the dependency recovers, which defeats the point of a liveness probe.
 */
export function createRedisConnection(env: Pick<Env, "REDIS_URL">): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times: number) {
      return Math.min(times * 200, 2000);
    },
  });
}
