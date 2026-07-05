// F-000 · T-000-08 — HealthService aggregates process liveness, Postgres
// reachability (via PrismaService), and Redis/BullMQ reachability.
// Spec: docs/features/F-000/infra.md §9.
//   "/health response shape: { status: 'ok' | 'degraded', checks: { db:
//    'ok'|'fail', redis: 'ok'|'fail' } }"
// AC3: happy path -> 200 {status:"ok"}.
// AC15: redis key present + "ok" when compose Redis is up; degraded/503 when
// Redis (or Postgres) is down.
//
// Contract note: packages/contracts' HealthResponse (T-000-07) only commits to
// `status: "ok" | "error"` today (the AC11 minimal seam). This service's
// richer `checks` block is additive on top of that shape (see
// health.controller.ts for how the two are reconciled) — contract-evolution
// skill: additive fields, no breaking change to the committed contract.
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS_CONNECTION } from "./redis.provider";
import { HEALTH_QUEUE_PROVIDER } from "./health-queue.provider";

export type CheckStatus = "ok" | "fail";

export interface HealthCheckResult {
  status: "ok" | "degraded";
  checks: {
    db: CheckStatus;
    redis: CheckStatus;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    @Inject(HEALTH_QUEUE_PROVIDER) private readonly queue: Queue,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);

    const status: HealthCheckResult["status"] = db === "ok" && redis === "ok" ? "ok" : "degraded";

    return { status, checks: { db, redis } };
  }

  private async checkDb(): Promise<CheckStatus> {
    try {
      // Bounded by the same timeout as the Redis check (see checkRedis below)
      // so a hung/packet-dropping DB can never stall /health — it fails clean
      // within HEALTH_CHECK_TIMEOUT_MS instead of hanging on the underlying
      // driver's own (much longer) connection/query timeout.
      await withTimeout(this.prisma.ping(), HEALTH_CHECK_TIMEOUT_MS);
      return "ok";
    } catch (err) {
      this.logger.warn(`db health check failed: ${(err as Error).message}`);
      return "fail";
    }
  }

  private async checkRedis(): Promise<CheckStatus> {
    try {
      // PING the same ioredis connection BullMQ's Queue uses (infra.md §9),
      // bounded by an explicit timeout. The connection itself is configured
      // with `maxRetriesPerRequest: null` (BullMQ's requirement — see
      // redis.provider.ts), so a command issued while Redis is down would
      // otherwise wait on ioredis's internal retry loop indefinitely instead
      // of surfacing as a probe failure. `withTimeout` guarantees this check
      // always settles within a bounded window regardless of that policy.
      const pong = await withTimeout(this.redis.ping(), HEALTH_CHECK_TIMEOUT_MS);
      if (pong !== "PONG") return "fail";
      // Touch the queue too, so a live BullMQ/Redis pairing is actually
      // exercised end to end, not just a bare PING (AC15's "BullMQ queue
      // connectivity").
      await withTimeout(this.queue.getJobCounts(), HEALTH_CHECK_TIMEOUT_MS);
      return "ok";
    } catch (err) {
      this.logger.warn(`redis health check failed: ${(err as Error).message}`);
      return "fail";
    }
  }
}

const HEALTH_CHECK_TIMEOUT_MS = 1500;

// exported for unit tests (D-014) — pure helper, no Nest/DB dependency
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`health check timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
