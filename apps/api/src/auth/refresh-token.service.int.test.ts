// F-001 · T-001-05 ★ — DB-backed integration tests for the refresh-token
// security core. Requires a test Postgres (TEST_DATABASE_URL). Skipped when
// absent so the pure-unit suite still runs everywhere; CI (T-001-20) provides
// the DB service. Covers the assertions that CANNOT be proven without a DB:
//  - rotation happy path + old token consumed (I3.1)
//  - reuse (outside leeway) → COMMITTED family revoke + post-commit event (I3.2/H-3)
//  - benign retry (immediate predecessor ≤60s) → NO family revoke (I3.4a/D-011)
//  - family-cap expiry → generic reject, NO burn, familyExpiresAt inherited (I3.4c/D-007)
//  - live-family cap 20 → 21st login LRU-revokes oldest (I3.11/D-017)
//  - stored tokenHash is the keyed HMAC (I3.9/L-3)
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { PrismaClient } from "@omnistock/db";
import { RefreshTokenService } from "./refresh-token.service";
import { SecurityEventsService } from "./security-events.service";
import { hashRefreshToken } from "./refresh-token.crypto";
import { FAMILY_LIFETIME_CAP_MS } from "@omnistock/core-domain";

const TEST_DB = process.env.TEST_DATABASE_URL;
const REFRESH_SECRET = "integration-refresh-secret-32chars-minimum!!";
const d = TEST_DB ? describe : describe.skip;

d("RefreshTokenService (DB-backed, ★ security core)", () => {
  let prisma: PrismaClient;
  let events: SecurityEventsService;
  let seenEvents: Array<{ type: string; payload: Record<string, unknown> }>;
  let userId: string;
  let clockMs: number;

  const prismaServiceStub = () => ({ client: prisma }) as unknown as import("../prisma/prisma.service").PrismaService;

  function makeService(): RefreshTokenService {
    return new RefreshTokenService(prismaServiceStub(), events, REFRESH_SECRET, () => clockMs);
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  beforeEach(async () => {
    events = new SecurityEventsService();
    seenEvents = [];
    events.emitter.on("*", (e) => seenEvents.push(e));
    clockMs = Date.now();
    // Fresh user per test; clean their refresh tokens.
    const user = await prisma.user.create({
      data: { email: `rt-${Date.now()}-${Math.random().toString(36).slice(2)}@t.co`, passwordHash: "x" },
    });
    userId = user.id;
  });

  it("I3.1 rotation happy path — successor inserted, old consumed, chain inherited", async () => {
    const svc = makeService();
    const issued = await svc.issueOnLogin(userId, "dev-1");
    const res = await svc.rotate(issued.value, "dev-1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Old token no longer rotates (it is now consumed; immediate predecessor is
    // benign within leeway → INVALID_REFRESH, family NOT burned).
    const again = await svc.rotate(issued.value, "dev-1");
    expect(again.ok).toBe(false);
    // New token still works.
    const third = await svc.rotate(res.issued.value, "dev-1");
    expect(third.ok).toBe(true);
  });

  it("I3.9 stored tokenHash is the keyed HMAC-SHA-256, not bare SHA-256", async () => {
    const svc = makeService();
    const issued = await svc.issueOnLogin(userId, null);
    const row = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(issued.value, REFRESH_SECRET) },
    });
    expect(row.tokenHash).toBe(createHmac("sha256", REFRESH_SECRET).update(issued.value).digest("hex"));
  });

  it("I3.4a benign retry — immediate predecessor replayed ≤60s → NO family revoke", async () => {
    const svc = makeService();
    const rt1 = await svc.issueOnLogin(userId, null);
    const r2 = await svc.rotate(rt1.value, null); // RT1 → RT2 (within leeway)
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    // Replay RT1 immediately (age 0 < 60s) → benign 401, family NOT burned.
    const replay = await svc.rotate(rt1.value, null);
    expect(replay.ok).toBe(false);
    expect(seenEvents.find((e) => e.type === "auth.refresh.reuse_detected")).toBeUndefined();
    // RT2 (current) still rotates.
    const r3 = await svc.rotate(r2.issued.value, null);
    expect(r3.ok).toBe(true);
    // No family rows revoked.
    const revoked = await prisma.refreshToken.count({ where: { userId, revokedAt: { not: null } } });
    expect(revoked).toBe(0);
  });

  it("I3.2/H-3 reuse outside leeway → COMMITTED family revoke + post-commit event", async () => {
    const svc = makeService();
    const rt1 = await svc.issueOnLogin(userId, null);
    const r2 = await svc.rotate(rt1.value, null);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    // Advance the clock >60s so RT1 replay is genuine reuse.
    clockMs += 61_000;
    const reuse = await svc.rotate(rt1.value, null);
    expect(reuse.ok).toBe(false);
    // Fresh re-query: ALL rows in the family are revoked (committed, not rolled back).
    const familyId = r2.issued.familyId;
    const live = await prisma.refreshToken.count({ where: { familyId, revokedAt: null } });
    expect(live).toBe(0);
    // Post-commit reuse event emitted.
    expect(seenEvents.find((e) => e.type === "auth.refresh.reuse_detected")).toBeDefined();
  });

  it("I3.4b(b) deeper ancestor within 60s → family revoked", async () => {
    const svc = makeService();
    const rt1 = await svc.issueOnLogin(userId, null);
    const r2 = await svc.rotate(rt1.value, null); // RT1→RT2
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    const r3 = await svc.rotate(r2.issued.value, null); // RT2→RT3
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    // Replay RT1 (grandparent) within 60s → still burns (leeway is immediate-only).
    const reuse = await svc.rotate(rt1.value, null);
    expect(reuse.ok).toBe(false);
    const live = await prisma.refreshToken.count({ where: { familyId: r3.issued.familyId, revokedAt: null } });
    expect(live).toBe(0);
    expect(seenEvents.find((e) => e.type === "auth.refresh.reuse_detected")).toBeDefined();
  });

  it("I3.4c family-cap expiry → generic reject, NO burn, familyExpiresAt inherited unchanged", async () => {
    const svc = makeService();
    const rt1 = await svc.issueOnLogin(userId, null);
    const r2 = await svc.rotate(rt1.value, null);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    // Successor inherits familyExpiresAt unchanged (does not slide).
    expect(r2.issued.familyExpiresAt.getTime()).toBe(rt1.familyExpiresAt.getTime());
    // Advance clock past the family cap.
    clockMs = rt1.familyExpiresAt.getTime() + 1000;
    const capped = await svc.rotate(r2.issued.value, null);
    expect(capped.ok).toBe(false);
    // NOT a burn — no reuse event, family not force-revoked by this path.
    expect(seenEvents.find((e) => e.type === "auth.refresh.reuse_detected")).toBeUndefined();
  });

  it("I3.11/D-017 live-family cap 20 — 21st login LRU-revokes the oldest", async () => {
    const svc = makeService();
    // Seed 20 live families with strictly increasing createdAt (oldest first).
    const familyIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      clockMs += 1000; // distinct login times
      const issued = await svc.issueOnLogin(userId, `dev-${i}`);
      familyIds.push(issued.familyId);
    }
    let liveFamilies = await prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
      distinct: ["familyId"],
      select: { familyId: true },
    });
    expect(liveFamilies.length).toBe(20);
    // 21st login → evicts the oldest (familyIds[0]).
    clockMs += 1000;
    await svc.issueOnLogin(userId, "dev-21");
    liveFamilies = await prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
      distinct: ["familyId"],
      select: { familyId: true },
    });
    expect(liveFamilies.length).toBe(20); // still ≤ 20
    const oldestRevoked = await prisma.refreshToken.findFirst({
      where: { familyId: familyIds[0], revokedAt: { not: null } },
    });
    expect(oldestRevoked).not.toBeNull();
    // The eviction is NOT a reuse event.
    expect(seenEvents.find((e) => e.type === "auth.refresh.reuse_detected")).toBeUndefined();
  });

  it("cap constant sanity — family cap is 90 days", () => {
    expect(FAMILY_LIFETIME_CAP_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });
});
