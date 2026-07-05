// F-000 · T-000-08 — the one BullMQ Queue instance F-000 boots, purely to
// prove Redis connectivity end to end for AC15. Spec: infra.md §9. No real
// job/worker logic ships here — that's feature-specific work (F-0xx+).
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export const HEALTH_QUEUE_NAME = "omnistock-health-probe";

/** DI token for the health-probe BullMQ Queue instance. */
export const HEALTH_QUEUE_PROVIDER = Symbol("HEALTH_QUEUE_PROVIDER");

export function createHealthQueue(connection: Redis): Queue {
  return new Queue(HEALTH_QUEUE_NAME, { connection });
}
