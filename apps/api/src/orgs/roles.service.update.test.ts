// F-003 · T-003-B24 ★ — `RolesService.update` ORCHESTRATION (PATCH /orgs/{orgId}/roles/{roleId}).
//
// The rules live (and are proven) in core-domain: `validateRoleName`,
// `validateRoleCapabilities`, `decideRoleWrite`, `assertOwnerRemains`,
// `clampedInvitationExpiry`. What only this layer can prove, and what this file pins:
//
//   U-API3-01 (update) ★ every write the fake tx could perform is a SPY on one
//       shared call log — `assertOwnerRemains` comes BEFORE the first write, a
//       refusal writes NOTHING, and with the decider seam allowing everything a
//       PATCH of the Owner role answers `LAST_OWNER` with zero writes.
//   U-API3-02 (update) the actor's capabilities come from `tx`, never the ALS —
//       for the `manage_roles` floor AND for `manage_members` on a held role.
//   U-API3-03 the other-holder count goes through `tx`, after the lock, with
//       organizationId + roleId + status:'active' + userId:{not: actor}.
//   U-API3-04 the invitation clamp runs only when the role BECOMES elevated.
//   U-API3-05 no-op = 200 with the current role, no write, no event, no version
//       check — and it is decided only AFTER every permission rule.
//   U-API3-06 `lastEditedAt/ByUserId` written on a real change only.
//   U-API3-07 `nameCustomized` set when the normalised name changes, never cleared.
//   api-spec §2 FIXED order on update · lock order (review B20 L-4): nothing
//       touches `Membership` after the `Role` row is written.
import { describe, it, expect, vi } from "vitest";
import { PrismaClient } from "@omnistock/db";
import { decideRoleWrite, type RoleWriteInput, type RoleWriteResult } from "@omnistock/core-domain";
import { DomainException } from "../common/domain-exception";
import {
  SecurityEventsService,
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../auth/security-events.service";
import { OrgContextStore } from "../tenancy";
import { OrgOwnershipGuard } from "./org-ownership.guard";
import { RolesService, parseUpdateRoleBody } from "./roles.service";
import type { RoleReadService } from "./role-read.service";

const ORG = "org_ctx";
const ACTOR = "usr_actor";
const OWNER = "usr_owner";
const HOLDER = "usr_holder";

const OWNER_CAPS = ["full_access"];
const ADMIN_CAPS = [
  "manage_members",
  "manage_orders",
  "manage_org_settings",
  "manage_products",
  "manage_roles",
];
/** `manage_roles` without `manage_members` (the "role designer", MR). */
const DESIGNER_CAPS = ["manage_orders", "manage_products", "manage_roles"];

interface FakeRole {
  id: string;
  name: string;
  key: string | null;
  isSystem: boolean;
  capabilities: string[];
  nameCustomized: boolean;
  version: number;
  deletedAt: Date | null;
}
interface FakeMembership {
  userId: string;
  roleId: string;
  status: string;
}
interface FakeInvitation {
  id: string;
  roleId: string;
  status: string;
  tokenIssuedAt: Date;
  expiresAt: Date;
}

const role = (over: Partial<FakeRole> & { id: string }): FakeRole => ({
  name: over.id,
  key: null,
  isSystem: false,
  capabilities: ["manage_orders"],
  nameCustomized: false,
  version: 1,
  deletedAt: null,
  ...over,
});

const BASE_ROLES = (): FakeRole[] => [
  role({ id: "rol_owner", name: "Owner", key: "owner", isSystem: true, capabilities: OWNER_CAPS }),
  role({ id: "rol_admin", name: "Admin", key: "admin", capabilities: ADMIN_CAPS }),
  role({ id: "rol_staff", name: "Staff", key: "staff", capabilities: ["manage_orders"] }),
  role({ id: "rol_target", name: "Packer", capabilities: ["manage_orders"], version: 3 }),
];

const READ_METHODS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "groupBy",
  "count",
  "aggregate",
  "findRaw",
  "aggregateRaw",
]);
const realClient = new PrismaClient({
  datasources: { db: { url: "postgresql://unit:unit@127.0.0.1:1/none" } },
});
function realWriteMethods(model: "role" | "membership" | "invitation"): string[] {
  const delegate = (realClient as unknown as Record<string, Record<string, unknown>>)[model]!;
  return Object.keys(delegate)
    .filter((k) => typeof delegate[k] === "function" && !READ_METHODS.has(k))
    .sort();
}

type Decider = (input: RoleWriteInput) => RoleWriteResult;

function createService(
  options: {
    readonly actorCapabilities?: readonly string[];
    /** The role the actor holds; defaults to a role of its own (`rol_actor`). */
    readonly actorRoleId?: string;
    readonly alsCapabilities?: readonly string[];
    readonly roles?: FakeRole[];
    /** Memberships besides the actor's. Default: an active Owner. */
    readonly others?: FakeMembership[];
    readonly invitations?: FakeInvitation[];
    readonly decide?: Decider;
    readonly updateThrows?: unknown;
    readonly actorGone?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const roles = (options.roles ?? BASE_ROLES()).map((r) => ({ ...r }));
  const actorRoleId = options.actorRoleId ?? "rol_actor";
  if (!roles.some((r) => r.id === actorRoleId)) {
    roles.push(
      role({
        id: actorRoleId,
        name: "Actor role",
        capabilities: [...(options.actorCapabilities ?? OWNER_CAPS)],
      }),
    );
  }
  const memberships: FakeMembership[] = [
    ...(options.actorGone ? [] : [{ userId: ACTOR, roleId: actorRoleId, status: "active" }]),
    ...(options.others ?? [{ userId: OWNER, roleId: "rol_owner", status: "active" }]),
  ];
  const invitations = (options.invitations ?? []).map((i) => ({ ...i }));
  const roleOf = (id: string) => roles.find((r) => r.id === id)!;

  const writeSpies = (model: "role" | "membership" | "invitation") =>
    Object.fromEntries(
      realWriteMethods(model).map((m) => [
        m,
        vi.fn(
          async (args: {
            where?: Record<string, unknown>;
            data?: Record<string, unknown>;
          }): Promise<unknown> => {
            calls.push(`write:${model}.${m}`);
            if (model === "role" && m === "updateMany") {
              if (options.updateThrows) throw options.updateThrows;
              const row = roles.find(
                (r) => r.id === args.where!.id && r.version === args.where!.version && !r.deletedAt,
              );
              if (!row) return { count: 0 };
              const { version, ...rest } = args.data as Record<string, unknown>;
              Object.assign(row, rest);
              if ((version as { increment?: number })?.increment) row.version += 1;
              return { count: 1 };
            }
            if (model === "invitation" && m === "updateMany") {
              const inv = invitations.find((i) => i.id === args.where!.id);
              if (!inv) return { count: 0 };
              inv.expiresAt = (args.data as { expiresAt: Date }).expiresAt;
              return { count: 1 };
            }
            return { count: 0 };
          },
        ),
      ]),
    );

  const tx = {
    $executeRawUnsafe: vi.fn(async (q: string) => {
      calls.push(
        q.startsWith("SET LOCAL lock_timeout") ? "tx:lock_timeout" : "write:$executeRawUnsafe",
      );
    }),
    $queryRawUnsafe: vi.fn(async (q: string, id: string) => {
      calls.push(/"Organization"/.test(q) ? "tx:FOR UPDATE" : "raw:$queryRawUnsafe");
      return [{ id }];
    }),
    $executeRaw: vi.fn(async () => calls.push("write:$executeRaw")),
    $queryRaw: vi.fn(async () => calls.push("write:$queryRaw")),
    role: {
      ...writeSpies("role"),
      findFirst: vi.fn(async (args: { where: { id: string; deletedAt?: null } }) => {
        calls.push("tx:role.findFirst");
        const r = roles.find((x) => x.id === args.where.id);
        if (!r || ("deletedAt" in args.where && r.deletedAt)) return null;
        return { ...r, capabilities: [...r.capabilities] };
      }),
      findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        calls.push("tx:role.findMany");
        const where = args.where ?? {};
        return roles.filter(
          (r) =>
            !("deletedAt" in where && where.deletedAt === null && r.deletedAt) &&
            !("key" in where && r.key === null),
        );
      }),
    },
    membership: {
      ...writeSpies("membership"),
      findFirst: vi.fn(async (args: { where: { userId: string; status?: string } }) => {
        calls.push("tx:membership.findFirst");
        const m = memberships.find(
          (x) =>
            x.userId === args.where.userId &&
            (!args.where.status || x.status === args.where.status),
        );
        return m ? { userId: m.userId, roleId: m.roleId, role: roleOf(m.roleId) } : null;
      }),
      count: vi.fn(
        async (args: {
          where: { roleId?: string; status?: string; userId?: { not?: string } };
        }) => {
          calls.push("tx:membership.count");
          const w = args.where;
          return memberships.filter(
            (m) =>
              (w.roleId === undefined || m.roleId === w.roleId) &&
              (w.status === undefined || m.status === w.status) &&
              (w.userId?.not === undefined || m.userId !== w.userId.not),
          ).length;
        },
      ),
      findMany: vi.fn(async () => {
        calls.push("tx:membership.findMany");
        return memberships.map((m) => ({
          ...m,
          role: { capabilities: [...roleOf(m.roleId).capabilities] },
        }));
      }),
    },
    invitation: {
      ...writeSpies("invitation"),
      findMany: vi.fn(async (args: { where: { roleId: string; status: string } }) => {
        calls.push("tx:invitation.findMany");
        return invitations
          .filter((i) => i.roleId === args.where.roleId && i.status === args.where.status)
          .map((i) => ({ ...i }));
      }),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => {
      calls.push("$transaction");
      const result = await fn(tx);
      calls.push("commit");
      return result;
    }),
  };

  const events = new SecurityEventsService();
  const sink: SecurityEventCollector = collectSecurityEvents(events);
  const emit = events.emit.bind(events);
  vi.spyOn(events, "emit").mockImplementation((type, payload) => {
    calls.push(`event:${type}`);
    emit(type, payload);
  });
  const emitDenied = events.emitEscalationDenied.bind(events);
  vi.spyOn(events, "emitEscalationDenied").mockImplementation(async (payload) => {
    calls.push(`event:escalation_denied:${payload.reason}`);
    await emitDenied(payload);
  });

  const store = new OrgContextStore();
  const ownership = new OrgOwnershipGuard(store);
  const realAssert = OrgOwnershipGuard.prototype.assertOwnerRemainsInTx;
  vi.spyOn(ownership, "assertOwnerRemainsInTx").mockImplementation(async function (
    this: OrgOwnershipGuard,
    t,
    change,
  ) {
    calls.push(`assertOwnerRemains:${change.kind}`);
    return realAssert.call(ownership, t, change);
  });

  const decide = vi.fn(options.decide ?? decideRoleWrite);
  const reads = {
    getDetail: vi.fn(async (roleId: string, via?: { client: unknown }) => {
      calls.push(via?.client === tx ? "tx:detail" : "client:detail");
      const r = roleOf(roleId);
      return { id: roleId, version: r.version, sentinel: "RoleDetail" };
    }),
  } as unknown as RoleReadService;

  const service = new RolesService(
    prisma as never,
    store,
    events,
    ownership,
    decide as never,
    { maxRolesPerOrg: 30, maxDeletedRolesPerOrg: 500 },
    reads,
  );
  const warn = vi.spyOn(
    (service as unknown as { logger: { warn: (m: string) => void } }).logger,
    "warn",
  );
  warn.mockImplementation(() => undefined);

  const ctx = {
    organizationId: ORG,
    userId: ACTOR,
    roleId: actorRoleId,
    capabilities: options.alsCapabilities ?? options.actorCapabilities ?? OWNER_CAPS,
  };
  return {
    calls,
    tx,
    sink,
    decide,
    reads,
    roles,
    invitations,
    warn,
    roleOf,
    writes: () => calls.filter((c) => c.startsWith("write:")),
    update: (roleId: string, body: unknown) => store.run(ctx, () => service.update(roleId, body)),
  };
}

async function refusal(promise: Promise<unknown>): Promise<DomainException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DomainException) return error;
    throw error;
  }
  throw new Error("expected a refusal, but the call resolved");
}
const envelope = (err: DomainException) =>
  (
    err.getResponse() as {
      error: { details?: Record<string, unknown>; fieldErrors?: Record<string, string> };
    }
  ).error;

const roleUpdateCall = (ctx: ReturnType<typeof createService>) =>
  ((ctx.tx.role as Record<string, unknown>).updateMany as ReturnType<typeof vi.fn>).mock
    .calls[0]![0].data as Record<string, unknown>;

const RENAME = { version: 3, name: "Picker" };
const RECAPS = { version: 3, capabilities: ["manage_orders", "manage_products"] };

// ── U-API3-01 (update) ─────────────────────────────────────────────────────

describe("★ U-API3-01 (update) · spy every write — Owner invariant before the first write", () => {
  it("non-vacuity: the fake spies EVERY write method the real role/membership/invitation delegates have", () => {
    const ctx = createService();
    for (const model of ["role", "membership", "invitation"] as const) {
      const real = realWriteMethods(model);
      expect(real.length, `${model}: enumerated no write methods`).toBeGreaterThan(3);
      const fake = ctx.tx[model] as Record<string, unknown>;
      for (const m of real) expect(vi.isMockFunction(fake[m]), `${model}.${m}`).toBe(true);
    }
  });

  it("happy path: lock first → … → assertOwnerRemains → exactly ONE write (role.updateMany) → commit → event", async () => {
    const ctx = createService();
    await ctx.update("rol_target", RECAPS);
    expect(ctx.calls.slice(0, 3)).toEqual(["$transaction", "tx:lock_timeout", "tx:FOR UPDATE"]);
    expect(ctx.writes()).toEqual(["write:role.updateMany"]);
    const assertAt = ctx.calls.indexOf("assertOwnerRemains:role_capabilities_change");
    expect(assertAt).toBeGreaterThan(-1);
    expect(assertAt).toBeLessThan(ctx.calls.indexOf("write:role.updateMany"));
    expect(ctx.calls.indexOf("event:org.role.updated")).toBeGreaterThan(
      ctx.calls.indexOf("commit"),
    );
  });

  it("★ decider seam allows everything + PATCH of the OWNER role → 409 LAST_OWNER, zero writes", async () => {
    const ctx = createService({
      actorCapabilities: ADMIN_CAPS,
      decide: () => ({ ok: true }),
    });
    const err = await refusal(
      ctx.update("rol_owner", { version: 1, capabilities: ["manage_orders"] }),
    );
    expect(err.code).toBe("LAST_OWNER");
    expect(ctx.decide).toHaveBeenCalled();
    expect(ctx.writes()).toEqual([]);
    expect(ctx.calls).not.toContain("event:org.role.updated");
  });

  it("control: decider allows + a role no Owner holds → the write happens exactly once", async () => {
    const ctx = createService({ actorCapabilities: ADMIN_CAPS, decide: () => ({ ok: true }) });
    await ctx.update("rol_target", RECAPS);
    expect(ctx.writes()).toEqual(["write:role.updateMany"]);
  });

  it("every refusal writes nothing (one per rule on the update path)", async () => {
    const held = [
      { userId: OWNER, roleId: "rol_owner", status: "active" },
      { userId: HOLDER, roleId: "rol_target", status: "active" },
    ];
    const equalTarget = BASE_ROLES().map((r) =>
      r.id === "rol_target" ? { ...r, capabilities: [...ADMIN_CAPS] } : r,
    );
    const cases: Array<[string, Parameters<typeof createService>[0], string, unknown]> = [
      ["NOT_FOUND", {}, "rol_nope", RENAME],
      ["FORBIDDEN", { actorCapabilities: ["manage_orders"] }, "rol_target", RENAME],
      ["ROLE_LOCKED", {}, "rol_owner", { version: 1, name: "Boss" }],
      ["VALIDATION_FAILED", {}, "rol_target", { version: 3 }],
      ["ROLE_NAME_TAKEN", {}, "rol_target", { version: 3, name: "เจ้าของร้าน" }],
      ["ROLE_EMPTY", {}, "rol_target", { version: 3, capabilities: [] }],
      ["FULL_ACCESS_RESERVED", {}, "rol_target", { version: 3, capabilities: ["full_access"] }],
      ["UNKNOWN_CAPABILITY", {}, "rol_target", { version: 3, capabilities: ["bogus"] }],
      [
        "ROLE_EXCEEDS_ACTOR",
        { actorCapabilities: ADMIN_CAPS },
        "rol_target",
        { version: 3, capabilities: ["manage_billing"] },
      ],
      [
        "ROLE_HELD_REQUIRES_MANAGE_MEMBERS",
        { actorCapabilities: DESIGNER_CAPS, others: held },
        "rol_target",
        RENAME,
      ],
      [
        "TARGET_NOT_BELOW_ACTOR",
        { actorCapabilities: ADMIN_CAPS, others: held, roles: equalTarget },
        "rol_target",
        RENAME,
      ],
      ["ROLE_CHANGED", {}, "rol_target", { ...RENAME, version: 2 }],
    ];
    for (const [code, opts, id, body] of cases) {
      const ctx = createService(opts);
      const err = await refusal(ctx.update(id, body));
      expect(err.code, code).toBe(code);
      expect(
        ctx.writes().filter((w) => w !== "write:role.updateMany"),
        code,
      ).toEqual([]);
      // ROLE_CHANGED is the write itself answering 0 rows — nothing changed either way.
      if (code !== "ROLE_CHANGED") expect(ctx.writes(), code).toEqual([]);
      else expect(ctx.roleOf("rol_target")).toMatchObject({ name: "Packer", version: 3 });
      expect(ctx.calls, code).not.toContain("event:org.role.updated");
    }
  });
});

// ── U-API3-02 (update) ─────────────────────────────────────────────────────

describe("U-API3-02 (update) · the actor's capabilities are read in the tx, not from the ALS", () => {
  it("ALS says manage_roles, tx says no → 403 FORBIDDEN, no write, decider never reached", async () => {
    const ctx = createService({
      actorCapabilities: ["manage_orders"],
      alsCapabilities: ADMIN_CAPS,
    });
    expect((await refusal(ctx.update("rol_target", RENAME))).code).toBe("FORBIDDEN");
    expect(ctx.writes()).toEqual([]);
    expect(ctx.decide).not.toHaveBeenCalled();
  });

  it("held role: ALS says manage_members, tx says no → ROLE_HELD_REQUIRES_MANAGE_MEMBERS", async () => {
    const ctx = createService({
      actorCapabilities: DESIGNER_CAPS,
      alsCapabilities: [...DESIGNER_CAPS, "manage_members"],
      others: [
        { userId: OWNER, roleId: "rol_owner", status: "active" },
        { userId: HOLDER, roleId: "rol_target", status: "active" },
      ],
    });
    expect((await refusal(ctx.update("rol_target", RENAME))).code).toBe(
      "ROLE_HELD_REQUIRES_MANAGE_MEMBERS",
    );
    const fed = ctx.decide.mock.calls.at(-1)![0];
    expect(fed.actorCapabilities).toEqual(DESIGNER_CAPS);
  });

  it("an actor whose membership vanished mid-flight → ORG_ACCESS_DENIED", async () => {
    const ctx = createService({ actorGone: true });
    expect((await refusal(ctx.update("rol_target", RENAME))).code).toBe("ORG_ACCESS_DENIED");
  });
});

// ── U-API3-03 ──────────────────────────────────────────────────────────────

describe("U-API3-03 · other active holders are counted through tx, after the lock, fully filtered", () => {
  it("count where = { organizationId, roleId, status: 'active', userId: { not: actor } }", async () => {
    const ctx = createService();
    await ctx.update("rol_target", RENAME);
    const count = ctx.tx.membership.count;
    expect(count).toHaveBeenCalledTimes(1);
    expect(count.mock.calls[0]![0].where).toEqual({
      organizationId: ORG,
      roleId: "rol_target",
      status: "active",
      userId: { not: ACTOR },
    });
    expect(ctx.calls.indexOf("tx:membership.count")).toBeGreaterThan(
      ctx.calls.indexOf("tx:FOR UPDATE"),
    );
  });

  it("the count reaches the decider: the actor is not counted, revoked holders are not, active ones are", async () => {
    // The actor holds the role it edits (caps = Admin's): only HOLDER may count.
    const ctx = createService({
      actorRoleId: "rol_target",
      actorCapabilities: ADMIN_CAPS,
      roles: BASE_ROLES().map((r) =>
        r.id === "rol_target" ? { ...r, capabilities: [...ADMIN_CAPS] } : r,
      ),
      others: [
        { userId: OWNER, roleId: "rol_owner", status: "active" },
        { userId: "usr_rev", roleId: "rol_target", status: "revoked" },
        { userId: HOLDER, roleId: "rol_target", status: "active" },
      ],
    });
    await refusal(ctx.update("rol_target", RENAME));
    const fed = ctx.decide.mock.calls.at(-1)![0] as { otherActiveHolders: number };
    expect(fed.otherActiveHolders).toBe(1);
  });
});

// ── U-API3-04 ──────────────────────────────────────────────────────────────

describe("U-API3-04 · clamp of pending invitations when the role becomes elevated", () => {
  const HOUR = 3_600_000;
  const issued = new Date(Date.now() - 2 * HOUR);
  const inv = (id: string, over: Partial<FakeInvitation> = {}): FakeInvitation => ({
    id,
    roleId: "rol_target",
    status: "pending",
    tokenIssuedAt: issued,
    expiresAt: new Date(issued.getTime() + 168 * HOUR),
    ...over,
  });

  it("not elevated → elevated: pending links cut to tokenIssuedAt + 24h (LEAST), others untouched, event counts them", async () => {
    const ctx = createService({
      invitations: [
        inv("inv_long"),
        inv("inv_short", { expiresAt: new Date(issued.getTime() + 3 * HOUR) }),
        inv("inv_other_role", { roleId: "rol_staff" }),
      ],
    });
    await ctx.update("rol_target", { version: 3, capabilities: ["manage_members"] });
    const updates = (
      (ctx.tx.invitation as Record<string, unknown>).updateMany as ReturnType<typeof vi.fn>
    ).mock.calls.map((c) => c[0]);
    expect(updates).toEqual([
      {
        where: { id: "inv_long", status: "pending", expiresAt: { gt: expect.any(Date) } },
        data: { expiresAt: new Date(issued.getTime() + 24 * HOUR) },
      },
    ]);
    expect(ctx.invitations.find((i) => i.id === "inv_short")!.expiresAt).toEqual(
      new Date(issued.getTime() + 3 * HOUR),
    );
    expect(ctx.tx.invitation.findMany.mock.calls[0]![0].where).toEqual({
      roleId: "rol_target",
      status: "pending",
    });
    const [event] = ctx.sink.ofType("org.role.updated");
    expect(event!.payload).toMatchObject({ invitationsShortened: 1 });
    // lock order §3: Organization → Role → Invitation
    expect(ctx.calls.indexOf("write:invitation.updateMany")).toBeGreaterThan(
      ctx.calls.indexOf("write:role.updateMany"),
    );
  });

  it("caps that stay non-elevated, a rename, or a demotion: no invitation is read or written", async () => {
    for (const [roles, body] of [
      [BASE_ROLES(), { version: 3, capabilities: ["manage_orders", "manage_products"] }],
      [BASE_ROLES(), RENAME],
      [
        BASE_ROLES().map((r) =>
          r.id === "rol_target" ? { ...r, capabilities: ["manage_members"] } : r,
        ),
        { version: 3, capabilities: ["manage_orders"] },
      ],
    ] as const) {
      const ctx = createService({ roles: [...roles], invitations: [inv("inv_long")] });
      await ctx.update("rol_target", body);
      expect(ctx.tx.invitation.findMany, JSON.stringify(body)).not.toHaveBeenCalled();
      expect(
        (ctx.tx.invitation as Record<string, unknown>).updateMany,
        JSON.stringify(body),
      ).not.toHaveBeenCalled();
      expect(ctx.sink.ofType("org.role.updated")[0]!.payload).toMatchObject({
        invitationsShortened: 0,
      });
    }
  });
});

// ── U-API3-05 ──────────────────────────────────────────────────────────────

describe("U-API3-05 · no-op PATCH", () => {
  it("same caps (reordered + duplicated) and same name → 200 current RoleDetail, no write, no event", async () => {
    const ctx = createService();
    const out = await ctx.update("rol_target", {
      version: 3,
      name: "  Packer ",
      capabilities: ["manage_orders", "manage_orders"],
    });
    expect(out).toMatchObject({ id: "rol_target", version: 3 });
    expect(ctx.writes()).toEqual([]);
    expect(ctx.sink.events).toEqual([]);
    expect(ctx.calls).not.toContain("assertOwnerRemains:role_capabilities_change");
    expect(ctx.calls).toContain("tx:detail");
  });

  it("★ a STALE version on a no-op is not compared: still 200, not ROLE_CHANGED (MUT-18)", async () => {
    const ctx = createService();
    const out = await ctx.update("rol_target", { version: 1, name: "Packer" });
    expect(out).toMatchObject({ id: "rol_target", version: 3 });
    expect(ctx.writes()).toEqual([]);
  });

  it("control: a stale version on a REAL change → 409 ROLE_CHANGED + details.currentVersion, no event", async () => {
    const ctx = createService();
    const err = await refusal(ctx.update("rol_target", { version: 1, name: "Picker" }));
    expect(err.code).toBe("ROLE_CHANGED");
    expect(envelope(err).details).toEqual({ currentVersion: 3 });
    expect(ctx.sink.events).toEqual([]);
    expect(ctx.warn).toHaveBeenCalledWith(expect.stringContaining("role_write_refused"));
  });

  it("★ the no-op is decided AFTER the permission rules: a no-op on a held role at the actor's level → 403", async () => {
    const ctx = createService({
      actorCapabilities: ADMIN_CAPS,
      roles: BASE_ROLES().map((r) =>
        r.id === "rol_target" ? { ...r, capabilities: [...ADMIN_CAPS] } : r,
      ),
      others: [
        { userId: OWNER, roleId: "rol_owner", status: "active" },
        { userId: HOLDER, roleId: "rol_target", status: "active" },
      ],
    });
    const err = await refusal(ctx.update("rol_target", { version: 3, name: "Packer" }));
    expect(err.code).toBe("TARGET_NOT_BELOW_ACTOR");
    expect(ctx.sink.ofType("org.role.escalation_denied")).toHaveLength(1);
  });

  it("…and a no-op by a designer (no manage_members) on a held role → ROLE_HELD_REQUIRES_MANAGE_MEMBERS (N-1)", async () => {
    const ctx = createService({
      actorCapabilities: DESIGNER_CAPS,
      others: [
        { userId: OWNER, roleId: "rol_owner", status: "active" },
        { userId: HOLDER, roleId: "rol_target", status: "active" },
      ],
    });
    expect(
      (await refusal(ctx.update("rol_target", { version: 3, capabilities: ["manage_orders"] })))
        .code,
    ).toBe("ROLE_HELD_REQUIRES_MANAGE_MEMBERS");
  });
});

// ── U-API3-06 / U-API3-07 ──────────────────────────────────────────────────

describe("U-API3-06/07 · lastEdited + nameCustomized + version", () => {
  it("a caps change writes lastEdited = actor/now, bumps version, and does NOT touch name/nameCustomized", async () => {
    const ctx = createService();
    await ctx.update("rol_target", RECAPS);
    const data = roleUpdateCall(ctx);
    expect(data).toMatchObject({
      capabilities: ["manage_orders", "manage_products"],
      lastEditedByUserId: ACTOR,
      version: { increment: 1 },
    });
    expect(data.lastEditedAt).toBeInstanceOf(Date);
    expect(data).not.toHaveProperty("name");
    expect(data).not.toHaveProperty("nameCustomized");
    const where = ((ctx.tx.role as Record<string, unknown>).updateMany as ReturnType<typeof vi.fn>)
      .mock.calls[0]![0].where;
    expect(where).toMatchObject({ id: "rol_target", version: 3 });
  });

  it("a rename writes the NORMALISED name with nameCustomized=true and leaves capabilities alone", async () => {
    const ctx = createService();
    await ctx.update("rol_target", { version: 3, name: "  Picking   team " });
    const data = roleUpdateCall(ctx);
    expect(data).toMatchObject({ name: "Picking team", nameCustomized: true });
    expect(data).not.toHaveProperty("capabilities");
  });

  it("renaming a system role back to its own label is allowed (selfKey) — and still nameCustomized=true, never false", async () => {
    const roles = BASE_ROLES().map((r) =>
      r.id === "rol_admin" ? { ...r, name: "หัวหน้า", nameCustomized: true } : r,
    );
    const ctx = createService({ roles });
    await ctx.update("rol_admin", { version: 1, name: "ผู้ดูแล" });
    expect(roleUpdateCall(ctx)).toMatchObject({ name: "ผู้ดูแล", nameCustomized: true });
  });

  it("another system role's live label is reserved (ROLE_NAME_TAKEN)", async () => {
    const ctx = createService();
    expect((await refusal(ctx.update("rol_staff", { version: 1, name: "ผู้ดูแล" }))).code).toBe(
      "ROLE_NAME_TAKEN",
    );
  });

  it("org.role.updated: ids + before/after {name, capabilities} + counts (AC-9.5), once, after commit", async () => {
    const ctx = createService({
      others: [
        { userId: OWNER, roleId: "rol_owner", status: "active" },
        { userId: HOLDER, roleId: "rol_target", status: "active" },
        { userId: "usr_rev", roleId: "rol_target", status: "revoked" },
      ],
    });
    await ctx.update("rol_target", { version: 3, name: "Picker", capabilities: ["manage_stock"] });
    const events = ctx.sink.ofType("org.role.updated");
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toEqual({
      actorUserId: ACTOR,
      organizationId: ORG,
      roleId: "rol_target",
      before: { name: "Packer", capabilities: ["manage_orders"] },
      after: { name: "Picker", capabilities: ["manage_stock"] },
      affectedActiveMembers: 1,
      invitationsShortened: 0,
    });
  });
});

// ── api-spec §2 fixed order ─────────────────────────────────────────────────

describe("api-spec §2 · the FIXED order of checks on update", () => {
  it("404 before the floor: an unknown / deleted role is NOT_FOUND even for a caller who lost manage_roles", async () => {
    const roles = [...BASE_ROLES(), role({ id: "rol_gone", deletedAt: new Date() })];
    for (const id of ["rol_nope", "rol_gone"]) {
      const ctx = createService({ roles: [...roles], actorCapabilities: ["manage_orders"] });
      expect((await refusal(ctx.update(id, RENAME))).code, id).toBe("NOT_FOUND");
    }
  });

  it("floor before ROLE_LOCKED: no manage_roles in tx + the Owner role → FORBIDDEN, no event", async () => {
    const ctx = createService({ actorCapabilities: ["manage_orders"] });
    expect((await refusal(ctx.update("rol_owner", { version: 1, name: "x" }))).code).toBe(
      "FORBIDDEN",
    );
    expect(ctx.sink.events).toEqual([]);
  });

  it("ROLE_LOCKED before the body shape: the Owner role + garbage body → ROLE_LOCKED", async () => {
    const ctx = createService();
    expect((await refusal(ctx.update("rol_owner", "garbage"))).code).toBe("ROLE_LOCKED");
  });

  it("ROLE_LOCKED: an Owner actor leaves no event; an Admin leaves escalation_denied(role_locked) after commit (SR-13)", async () => {
    const own = createService();
    await refusal(own.update("rol_owner", { version: 1, name: "Boss" }));
    expect(own.sink.events).toEqual([]);

    const adm = createService({ actorCapabilities: ADMIN_CAPS });
    await refusal(adm.update("rol_owner", { version: 1, name: "Boss" }));
    const denied = adm.sink.ofType("org.role.escalation_denied");
    expect(denied).toHaveLength(1);
    expect(denied[0]!.payload).toMatchObject({
      actorUserId: ACTOR,
      organizationId: ORG,
      roleId: "rol_owner",
      targetUserId: null,
      operation: "update_role",
      reason: "role_locked",
      excessCapabilities: [],
    });
    expect(adm.calls.indexOf("event:escalation_denied:role_locked")).toBeGreaterThan(
      adm.calls.indexOf("commit"),
    );
  });

  it("body shape: version required (integer 1..2^31-1), name a string, capabilities an array ≤ 64 of strings ≤ 64, one of them present", async () => {
    for (const body of [
      null,
      [],
      {},
      { name: "X" },
      { version: 0, name: "X" },
      { version: "3", name: "X" },
      { version: 1.5, name: "X" },
      { version: 2 ** 31, name: "X" },
      { version: 3 },
      { version: 3, name: null },
      { version: 3, name: 42 },
      { version: 3, name: "ก".repeat(201) },
      { version: 3, capabilities: "manage_orders" },
      { version: 3, capabilities: [1] },
      { version: 3, capabilities: Array.from({ length: 65 }, () => "manage_orders") },
      { version: 3, capabilities: ["v".repeat(65)] },
    ]) {
      const ctx = createService();
      const err = await refusal(ctx.update("rol_target", body));
      expect(err.code, JSON.stringify(body)).toBe("VALIDATION_FAILED");
      expect(
        Object.keys(envelope(err).fieldErrors ?? {}).length,
        JSON.stringify(body),
      ).toBeGreaterThan(0);
    }
  });

  it("parseUpdateRoleBody never reads key / isSystem (AC-1.4)", () => {
    const parsed = parseUpdateRoleBody({ version: 2, name: "x", key: "owner", isSystem: true });
    expect(parsed).toEqual({ ok: true, version: 2, name: "x" });
  });

  it("name before caps: Cc/Cf name + empty caps → VALIDATION_FAILED fieldErrors.name", async () => {
    const ctx = createService();
    const err = await refusal(
      ctx.update("rol_target", { version: 3, name: "a​b", capabilities: [] }),
    );
    expect(err.code).toBe("VALIDATION_FAILED");
    expect(envelope(err).fieldErrors).toHaveProperty("name");
  });

  it("FULL_ACCESS_RESERVED (+event update_role, even for the Owner) before UNKNOWN_CAPABILITY", async () => {
    const ctx = createService();
    const err = await refusal(
      ctx.update("rol_target", { version: 3, capabilities: ["full_access", "bogus"] }),
    );
    expect(err.code).toBe("FULL_ACCESS_RESERVED");
    expect(ctx.sink.ofType("org.role.escalation_denied")[0]!.payload).toMatchObject({
      operation: "update_role",
      reason: "full_access_reserved",
      roleId: "rol_target",
    });
  });

  it("UNKNOWN_CAPABILITY before ROLE_EXCEEDS_ACTOR, with details.capabilities, no event", async () => {
    const ctx = createService({ actorCapabilities: ADMIN_CAPS });
    const err = await refusal(
      ctx.update("rol_target", { version: 3, capabilities: ["manage_billing", "zz"] }),
    );
    expect(err.code).toBe("UNKNOWN_CAPABILITY");
    expect(envelope(err).details).toEqual({ capabilities: ["zz"] });
    expect(ctx.sink.events).toEqual([]);
  });

  it("ROLE_EXCEEDS_ACTOR: no details, excess keys in the event only", async () => {
    const ctx = createService({ actorCapabilities: ADMIN_CAPS });
    const err = await refusal(
      ctx.update("rol_target", { version: 3, capabilities: ["manage_billing"] }),
    );
    expect(err.code).toBe("ROLE_EXCEEDS_ACTOR");
    expect(envelope(err).details).toBeUndefined();
    expect(ctx.sink.ofType("org.role.escalation_denied")[0]!.payload).toMatchObject({
      operation: "update_role",
      reason: "exceeds_actor",
      roleId: "rol_target",
      excessCapabilities: ["manage_billing"],
    });
  });

  it("ROLE_HELD_REQUIRES_MANAGE_MEMBERS: no security event, a warn log role_write_refused", async () => {
    const ctx = createService({
      actorCapabilities: DESIGNER_CAPS,
      others: [
        { userId: OWNER, roleId: "rol_owner", status: "active" },
        { userId: HOLDER, roleId: "rol_target", status: "active" },
      ],
    });
    const err = await refusal(ctx.update("rol_target", RENAME));
    expect(err.code).toBe("ROLE_HELD_REQUIRES_MANAGE_MEMBERS");
    expect(envelope(err).details).toBeUndefined();
    expect(ctx.sink.events).toEqual([]);
    const line = ctx.warn.mock.calls
      .map((c) => String(c[0]))
      .find((l) => /role_write_refused/.test(l));
    expect(line).toBeDefined();
    expect(JSON.parse(line!.replace(/^role_write_refused /, ""))).toEqual({
      operation: "updateRole",
      reason: "requires_manage_members",
      organizationId: ORG,
      roleId: "rol_target",
    });
  });

  it("TARGET_NOT_BELOW_ACTOR (held, equal): event with targetUserId null and no excess", async () => {
    const ctx = createService({
      actorCapabilities: ADMIN_CAPS,
      roles: BASE_ROLES().map((r) =>
        r.id === "rol_target" ? { ...r, capabilities: [...ADMIN_CAPS] } : r,
      ),
      others: [
        { userId: OWNER, roleId: "rol_owner", status: "active" },
        { userId: HOLDER, roleId: "rol_target", status: "active" },
      ],
    });
    const err = await refusal(
      ctx.update("rol_target", { version: 3, capabilities: ["manage_orders"] }),
    );
    expect(err.code).toBe("TARGET_NOT_BELOW_ACTOR");
    expect(envelope(err).details).toBeUndefined();
    expect(ctx.sink.ofType("org.role.escalation_denied")[0]!.payload).toMatchObject({
      operation: "update_role",
      reason: "target_not_below_actor",
      roleId: "rol_target",
      targetUserId: null,
      excessCapabilities: [],
    });
  });

  it("the decider sees op=update, before = stored caps, next = VALIDATED caps (or 'unchanged' on a rename)", async () => {
    const ctx = createService({ actorCapabilities: ADMIN_CAPS });
    await ctx.update("rol_target", RECAPS);
    const fed = ctx.decide.mock.calls.at(-1)![0] as RoleWriteInput & {
      role: { capabilities: string[] };
      next: readonly string[];
    };
    expect(fed.op).toBe("update");
    expect(fed.role.capabilities).toEqual(["manage_orders"]);
    expect(Object.isFrozen(fed.next)).toBe(true);

    const rename = createService({ actorCapabilities: ADMIN_CAPS });
    await rename.update("rol_target", RENAME);
    expect((rename.decide.mock.calls.at(-1)![0] as { next: unknown }).next).toBe("unchanged");
  });

  it("a unique violation at write time (P2002) → 409 ROLE_NAME_TAKEN; any other error is not disguised", async () => {
    const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    expect(
      (await refusal(createService({ updateThrows: p2002 }).update("rol_target", RENAME))).code,
    ).toBe("ROLE_NAME_TAKEN");
    await expect(
      createService({ updateThrows: new Error("boom") }).update("rol_target", RENAME),
    ).rejects.toThrow("boom");
  });
});

// ── response + lock order ───────────────────────────────────────────────────

describe("update — what is answered, and the lock order (review B20 L-4)", () => {
  it("answers the RoleDetail through the SAME tx; viewer = the actor as read in tx", async () => {
    const ctx = createService({ actorCapabilities: ADMIN_CAPS });
    const out = await ctx.update("rol_target", RECAPS);
    expect(out).toMatchObject({ id: "rol_target", version: 4 });
    const via = (ctx.reads.getDetail as ReturnType<typeof vi.fn>).mock.calls[0]![1];
    expect(via.client).toBe(ctx.tx);
    expect(via.viewer).toEqual({ userId: ACTOR, roleId: "rol_actor", capabilities: ADMIN_CAPS });
  });

  it("editing the actor's OWN role (self-lockout, AC-3.10): 200, and viewer = the caps as read in tx (api-spec §4.2b)", async () => {
    const ctx = createService({
      actorRoleId: "rol_target",
      roles: BASE_ROLES().map((r) =>
        r.id === "rol_target" ? { ...r, capabilities: ["manage_orders", "manage_roles"] } : r,
      ),
    });
    await ctx.update("rol_target", { version: 3, capabilities: ["manage_orders"] });
    expect(ctx.writes()).toEqual(["write:role.updateMany"]);
    const via = (ctx.reads.getDetail as ReturnType<typeof vi.fn>).mock.calls[0]![1];
    expect(via.viewer).toEqual({
      userId: ACTOR,
      roleId: "rol_target",
      capabilities: ["manage_orders", "manage_roles"],
    });
  });

  it("★ after the Role row is written NOTHING touches Membership (no write, no raw lock) — reset locks Membership → Role", async () => {
    const ctx = createService({
      invitations: [
        {
          id: "inv_1",
          roleId: "rol_target",
          status: "pending",
          tokenIssuedAt: new Date(),
          expiresAt: new Date(Date.now() + 100 * 3_600_000),
        },
      ],
    });
    await ctx.update("rol_target", { version: 3, capabilities: ["manage_members"] });
    const after = ctx.calls.slice(ctx.calls.indexOf("write:role.updateMany") + 1);
    expect(after.length).toBeGreaterThan(0); // non-vacuity: the clamp + detail happen after
    expect(after.filter((c) => /membership\.|raw:|\$executeRaw|\$queryRaw/.test(c))).toEqual([]);
  });

  it("the org lock is the first statement after BEGIN (its operation key 'updateRole' is pinned by G3-11)", async () => {
    const ctx = createService();
    await ctx.update("rol_target", RENAME);
    expect(ctx.calls.slice(0, 3)).toEqual(["$transaction", "tx:lock_timeout", "tx:FOR UPDATE"]);
  });
});
