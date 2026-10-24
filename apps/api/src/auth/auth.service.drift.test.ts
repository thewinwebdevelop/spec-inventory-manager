// F-003 · T-003-B20 ★ (review of B05) — `authority_rule_drift` is a 404, never a 500.
//
// `mapResetAuthorityRefusal` used to THROW when `decideMemberAuthority` answered
// something admin-reset cannot produce (the rules drifted apart). Thrown inside
// the transaction, that reached the wire as a 500: a status that stands out
// against the endpoint's uniform 404. The pure half is pinned in core-domain
// (`admin-reset-authz.test.ts`). This file pins the service half: the drift
// refusal answers the SAME 404 body as "not a member", writes nothing, emits
// no security event (it says nothing about the target), and is logged at
// error level so it stays loud.
//
// The drift cannot be reached through the real rule (that is the point of a
// drift), so `decideAdminReset` is replaced here. Everything else in
// core-domain stays real.
import { describe, it, expect, vi, afterEach } from "vitest";
import { HttpException, Logger } from "@nestjs/common";
import { CAPABILITY_MANAGE_MEMBERS } from "@omnistock/core-domain";
import { AuthService } from "./auth.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { HashingService } from "./hashing.service";
import type { RefreshTokenService } from "./refresh-token.service";
import type { AccessTokenService } from "./access-token.service";
import type { ThrottleService } from "./throttle.service";
import { SecurityEventsService, collectSecurityEvents } from "./security-events.service";

const drift = vi.hoisted(() => ({ on: false }));

vi.mock("@omnistock/core-domain", async (importOriginal) => {
  const real = await importOriginal<typeof import("@omnistock/core-domain")>();
  return {
    ...real,
    decideAdminReset: (input: Parameters<typeof real.decideAdminReset>[0]) =>
      drift.on
        ? { allowed: false, refusals: ["authority_rule_drift"] as const }
        : real.decideAdminReset(input),
  };
});

const ORG = "org_1";
const CALLER = "user_caller";
const TARGET = "user_target";
const NEW_PW = "correct-horse-battery-staple-9f3aK!";

function harness(targetStatus: "active" | null = "active") {
  const membershipRow = (userId: string) =>
    userId === CALLER
      ? { userId, roleId: "role_admin", status: "active" }
      : targetStatus === null
        ? null
        : { userId, roleId: "role_staff", status: targetStatus };
  const tx = {
    $executeRawUnsafe: vi.fn(async () => 0),
    $queryRawUnsafe: vi.fn(async (sql: string, ...params: unknown[]) => {
      if (/FROM "User"/.test(sql)) return [{ id: TARGET, email: "t@example.co" }];
      if (/FROM "Membership"/.test(sql)) {
        return [...(params[1] as string[])].sort().map(membershipRow).filter(Boolean);
      }
      if (/FROM "Role"/.test(sql)) {
        return [...(params[1] as string[])].sort().map((id) => ({
          id,
          capabilities:
            id === "role_admin"
              ? [CAPABILITY_MANAGE_MEMBERS, "manage_products"]
              : ["manage_products"],
        }));
      }
      throw new Error(`unexpected SQL ${sql}`);
    }),
    membership: { count: vi.fn(async () => 0) },
    user: { update: vi.fn(async () => ({})) },
  };
  const client = {
    membership: {
      findUnique: vi.fn(async () => ({
        status: "active",
        role: { capabilities: [CAPABILITY_MANAGE_MEMBERS, "manage_products"] },
      })),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const events = new SecurityEventsService();
  const sink = collectSecurityEvents(events);
  const refresh = { revokeAllForUser: vi.fn(async () => undefined) };
  const throttle = { clearAccount: vi.fn(async () => undefined) };
  const service = new AuthService(
    { client } as unknown as PrismaService,
    { hash: vi.fn(async () => "$argon2id$fake") } as unknown as HashingService,
    refresh as unknown as RefreshTokenService,
    {} as AccessTokenService,
    events,
    throttle as unknown as ThrottleService,
  );
  return { service, tx, sink, refresh, throttle };
}

async function outcome(h: ReturnType<typeof harness>): Promise<unknown> {
  try {
    await h.service.adminResetPassword(CALLER, ORG, TARGET, NEW_PW);
    return null;
  } catch (err) {
    return err;
  }
}

describe("T-003-B20 · authority_rule_drift → the uniform 404, never a 500", () => {
  afterEach(() => {
    drift.on = false;
    vi.restoreAllMocks();
  });

  it("drift → 404 with the SAME body as 'not a member', no write, no event, one error log", async () => {
    const errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    const notMember = await outcome(harness(null));
    expect(notMember).toBeInstanceOf(HttpException);
    expect((notMember as HttpException).getStatus()).toBe(404);

    drift.on = true;
    const h = harness();
    const err = await outcome(h);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(404);
    expect(JSON.stringify((err as HttpException).getResponse())).toBe(
      JSON.stringify((notMember as HttpException).getResponse()),
    );
    expect(h.tx.user.update).not.toHaveBeenCalled();
    expect(h.refresh.revokeAllForUser).not.toHaveBeenCalled();
    expect(h.throttle.clearAccount).not.toHaveBeenCalled();
    expect(h.sink.types()).toEqual([]);
    // Loud: exactly one error-level line, naming the refusal and the ids only.
    const driftLogs = errorLog.mock.calls.filter((c) =>
      String(c[0]).includes("authority_rule_drift"),
    );
    expect(driftLogs).toHaveLength(1);
    expect(String(driftLogs[0][0])).not.toContain(NEW_PW);
  });

  it("control · with the real rule the same harness succeeds (the 404 above is the drift, not the harness)", async () => {
    const h = harness();
    expect(await outcome(h)).toBeNull();
    expect(h.tx.user.update).toHaveBeenCalledTimes(1);
  });
});
