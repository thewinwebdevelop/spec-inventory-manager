// Pins the AUTH_REDIS wiring (security review of the throttle hang fix). If
// AuthModule went back to the BullMQ-style `createRedisConnection`, nothing else
// would notice: ThrottleService's per-command deadline masks the hang, so every
// throttle test stays green while login waits 250 ms per command during an
// outage and the offline queue grows without bound.
import { describe, it, expect, vi } from "vitest";
import type { Redis } from "ioredis";

vi.mock("@omnistock/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@omnistock/config")>()),
  loadEnv: () => ({ REDIS_URL: "redis://127.0.0.1:1" }),
}));

import { AuthModule, AUTH_REDIS, authRedisProvider } from "./auth.module";

describe("AuthModule · AUTH_REDIS wiring", () => {
  it("AuthModule registers authRedisProvider under AUTH_REDIS", () => {
    const providers = Reflect.getMetadata("providers", AuthModule) as unknown[];
    expect(providers).toContain(authRedisProvider);
    expect(authRedisProvider.provide).toBe(AUTH_REDIS);
  });

  it("the AUTH_REDIS factory builds the fail-fast auth connection (no offline queue, bounded retries)", () => {
    const redis = authRedisProvider.useFactory() as Redis;
    redis.on("error", () => {}); // dead port; reconnect noise is expected
    try {
      expect(redis.options.enableOfflineQueue).toBe(false);
      expect(redis.options.maxRetriesPerRequest).toBe(1);
    } finally {
      redis.disconnect();
    }
  });
});
