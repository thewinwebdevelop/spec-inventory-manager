// F-003 · T-003-B25 ★ — `RolesService.delete` ORCHESTRATION (DELETE /orgs/{orgId}/roles/{roleId}).
//
// The rules live (and are proven) in core-domain: `decideRoleWrite` (op "delete"),
// `assertOwnerRemains` (shape 4 `role_delete`). What only this layer can prove,
// and what this file pins:
//
//   U-API3-01 (delete) ★ every write the fake tx could perform is a SPY on one
//       shared call log — `assertOwnerRemains(role_delete)` comes BEFORE the first
//       write, a refusal writes NOTHING, and the write is a SOFT delete
//       (`role.updateMany` setting `deletedAt`) — never `role.delete*`.
//   U-API3-02 (delete) the actor's capabilities come from `tx`, never the ALS.
//   api-spec §2 / architecture §1.3 FIXED order on delete:
//       404 → floor → ROLE_LOCKED → ROLE_EXCEEDS_ACTOR →
//       ROLE_HELD_REQUIRES_MANAGE_MEMBERS → TARGET_NOT_BELOW_ACTOR →
//       ROLE_IN_USE → ROLE_HISTORY_LIMIT_REACHED → Owner invariant → write.
//   data-model §2.2 — the in-use counts (active members INCLUDING the actor,
//       pending invitations INCLUDING expired ones) and the deleted-row cap
//       (counted over deleted rows, not live ones).
//   architecture §7/§8 — `org.role.deleted` after commit · refusal events ·
//       warn `role_write_refused` · warn `role_deleted_rows_high` at 80 %.
//   lock order (review B20 L-4): nothing touches `Membership` after the Role write.
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
import { RolesService } from "./roles.service";
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
  version: number;
  deletedAt: Date | null;
  deletedByUserId?: string | null;
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
  expiresAt: Date;
}

const role = (over: Partial<FakeRole> & { id: string }): FakeRole => ({
  name: over.id,
  key: null,
  isSystem: false,
  capabilities: ["manage_orders"],
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

/** `n` soft-deleted rows (history) — they count against MAX_DELETED_ROLES_PER_ORG. */
const deletedRows = (n: number): FakeRole[] =>
  Array.from({ length: n }, (_, i) =>
    role({ id: `rol_gone_${i}`, name: `Gone ${i}`, deletedAt: new Date(2026, 0, 1) }),
  );

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
    readonly maxDeletedRolesPerOrg?: number;
    /** The soft-delete UPDATE matches no row (a writer that skipped the lock). */
    readonly writeMatchesNothing?: boolean;
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
    { userId: ACTOR, roleId: actorRoleId, status: "active" },
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
              if (options.writeMatchesNothing) return { count: 0 };
              const row = roles.find(
                (r) =>
                  r.id === args.where!.id &&
                  (!("deletedAt" in args.where!) ||
                    (args.where!.deletedAt === null && !r.deletedAt)),
              );
              if (!row) return { count: 0 };
              const { version, ...rest } = args.data as Record<string, unknown>;
              Object.assign(row, rest);
              if ((version as { increment?: number })?.increment) row.version += 1;
              return { count: 1 };
            }
            if (model === "role" && (m === "delete" || m === "deleteMany")) {
              const i = roles.findIndex((r) => r.id === args.where!.id);
              if (i >= 0) roles.splice(i, 1);
              return m === "delete" ? { id: args.where!.id } : { count: i >= 0 ? 1 : 0 };
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
      count: vi.fn(async (args: { where?: { deletedAt?: unknown } }) => {
        calls.push("tx:role.count");
        const w = args.where?.deletedAt;
        if (w === null) return roles.filter((r) => !r.deletedAt).length;
        if (w && typeof w === "object" && "not" in w && (w as { not: unknown }).not === null)
          return roles.filter((r) => r.deletedAt).length;
        return roles.length;
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
      count: vi.fn(async (args: { where: Record<string, unknown> }) => {
        calls.push("tx:invitation.count");
        const w = args.where;
        return invitations.filter(
          (i) =>
            (w.roleId === undefined || i.roleId === w.roleId) &&
            (w.status === undefined || i.status === w.status) &&
            // a filter on expiry would hide expired links (AC-3.9 counts them)
            !("expiresAt" in w && i.expiresAt.getTime() <= Date.now()),
        ).length;
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
  vi.spyOn(
    (ownership as unknown as { logger: { error: (m: string) => void } }).logger,
    "error",
  ).mockImplementation(() => undefined);

  const decide = vi.fn(options.decide ?? decideRoleWrite);
  const reads = {
    getDetail: vi.fn(async () => {
      calls.push("detail");
      return { sentinel: "RoleDetail" };
    }),
  } as unknown as RoleReadService;

  const service = new RolesService(
    prisma as never,
    store,
    events,
    ownership,
    decide as never,
    { maxRolesPerOrg: 30, maxDeletedRolesPerOrg: options.maxDeletedRolesPerOrg ?? 500 },
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
    roles,
    warn,
    roleOf,
    writes: () => calls.filter((c) => c.startsWith("write:")),
    delete: (roleId: string) => store.run(ctx, () => service.delete(roleId)),
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

const softDeleteCall = (ctx: ReturnType<typeof createService>) =>
  ((ctx.tx.role as Record<string, unknown>).updateMany as ReturnType<typeof vi.fn>).mock
    .calls[0]![0] as { where: Record<string, unknown>; data: Record<string, unknown> };

const HELD_BY_OTHER: FakeMembership[] = [
  { userId: OWNER, roleId: "rol_owner", status: "active" },
  { userId: HOLDER, roleId: "rol_target", status: "active" },
];
const withTarget = (caps: string[]) =>
  BASE_ROLES().map((r) => (r.id === "rol_target" ? { ...r, capabilities: caps } : r));
const pendingFor = (roleId: string, expiresAt = new Date(Date.now() + 3_600_000)) => ({
  id: `inv_${roleId}_${expiresAt.getTime()}`,
  roleId,
  status: "pending",
  expiresAt,
});

// ── U-API3-01 (delete) ─────────────────────────────────────────────────────

describe("★ U-API3-01 (delete) · spy every write — Owner invariant before the first write, soft delete only", () => {
  it("non-vacuity: the fake spies EVERY write method the real role/membership/invitation delegates have", () => {
    const ctx = createService();
    for (const model of ["role", "membership", "invitation"] as const) {
      const real = realWriteMethods(model);
      expect(real.length, `${model}: enumerated no write methods`).toBeGreaterThan(3);
      expect(real, model).toEqual(expect.arrayContaining(["delete", "deleteMany", "updateMany"]));
      const fake = ctx.tx[model] as Record<string, unknown>;
      for (const m of real) expect(vi.isMockFunction(fake[m]), `${model}.${m}`).toBe(true);
    }
  });

  it("happy path: lock first → … → assertOwnerRemains(role_delete) → exactly ONE write (role.updateMany) → commit → event", async () => {
    const ctx = createService();
    await ctx.delete("rol_target");
    expect(ctx.calls.slice(0, 3)).toEqual(["$transaction", "tx:lock_timeout", "tx:FOR UPDATE"]);
    expect(ctx.writes()).toEqual(["write:role.updateMany"]);
    const assertAt = ctx.calls.indexOf("assertOwnerRemains:role_delete");
    expect(assertAt).toBeGreaterThan(-1);
    expect(assertAt).toBeLessThan(ctx.calls.indexOf("write:role.updateMany"));
    expect(ctx.calls.indexOf("event:org.role.deleted")).toBeGreaterThan(
      ctx.calls.indexOf("commit"),
    );
  });

  it("★ the write is a SOFT delete: where = {id, deletedAt:null} · data = deletedAt/By + version+1 · the row is still there", async () => {
    const ctx = createService();
    const out = await ctx.delete("rol_target");
    const { where, data } = softDeleteCall(ctx);
    expect(where).toEqual({ id: "rol_target", deletedAt: null });
    expect(Object.keys(data).sort()).toEqual(["deletedAt", "deletedByUserId", "version"]);
    expect(data.deletedAt).toBeInstanceOf(Date);
    expect(data.deletedByUserId).toBe(ACTOR);
    expect(data.version).toEqual({ increment: 1 });
    // name / capabilities untouched (data-model §2.2 — history keeps the last name)
    expect(ctx.roleOf("rol_target")).toMatchObject({
      name: "Packer",
      capabilities: ["manage_orders"],
      version: 4,
      deletedByUserId: ACTOR,
    });
    expect(ctx.roleOf("rol_target").deletedAt).toBeInstanceOf(Date);
    // DeletedRole — the same instant that was written, as ISO (api-spec §3)
    expect(out).toEqual({
      id: "rol_target",
      deletedAt: (data.deletedAt as Date).toISOString(),
    });
  });

  it("★ decider seam allows everything + DELETE of the OWNER role in a shop whose Owner left → 409 LAST_OWNER, zero writes", async () => {
    const ctx = createService({
      actorCapabilities: ADMIN_CAPS,
      decide: () => ({ ok: true }),
      others: [{ userId: OWNER, roleId: "rol_owner", status: "revoked" }],
    });
    const err = await refusal(ctx.delete("rol_owner"));
    expect(err.code).toBe("LAST_OWNER");
    expect(ctx.decide).toHaveBeenCalled();
    expect(ctx.writes()).toEqual([]);
    expect(ctx.calls).not.toContain("event:org.role.deleted");
  });

  it("decider seam allows everything + the Owner role still HELD → 409 ROLE_IN_USE (in-use comes before the invariant), zero writes", async () => {
    const ctx = createService({ actorCapabilities: ADMIN_CAPS, decide: () => ({ ok: true }) });
    const err = await refusal(ctx.delete("rol_owner"));
    expect(err.code).toBe("ROLE_IN_USE");
    expect(envelope(err).details).toEqual({ activeMembers: 1, pendingInvitations: 0 });
    expect(ctx.writes()).toEqual([]);
  });

  it("control: decider allows + a role no Owner holds → the write happens exactly once", async () => {
    const ctx = createService({ actorCapabilities: ADMIN_CAPS, decide: () => ({ ok: true }) });
    await ctx.delete("rol_target");
    expect(ctx.writes()).toEqual(["write:role.updateMany"]);
  });

  it("every refusal writes nothing (one per rule on the delete path)", async () => {
    const cases: Array<[string, Parameters<typeof createService>[0], string]> = [
      ["NOT_FOUND", {}, "rol_nope"],
      ["NOT_FOUND", { roles: [...BASE_ROLES(), ...deletedRows(1)] }, "rol_gone_0"],
      ["FORBIDDEN", { actorCapabilities: ["manage_orders"] }, "rol_target"],
      ["ROLE_LOCKED", {}, "rol_owner"],
      [
        "ROLE_EXCEEDS_ACTOR",
        { actorCapabilities: ADMIN_CAPS, roles: withTarget(["manage_billing"]) },
        "rol_target",
      ],
      [
        "ROLE_HELD_REQUIRES_MANAGE_MEMBERS",
        { actorCapabilities: DESIGNER_CAPS, others: HELD_BY_OTHER },
        "rol_target",
      ],
      [
        "TARGET_NOT_BELOW_ACTOR",
        { actorCapabilities: ADMIN_CAPS, others: HELD_BY_OTHER, roles: withTarget(ADMIN_CAPS) },
        "rol_target",
      ],
      ["ROLE_IN_USE", { others: HELD_BY_OTHER }, "rol_target"],
      ["ROLE_IN_USE", { invitations: [pendingFor("rol_target")] }, "rol_target"],
      [
        "ROLE_HISTORY_LIMIT_REACHED",
        { maxDeletedRolesPerOrg: 2, roles: [...BASE_ROLES(), ...deletedRows(2)] },
        "rol_target",
      ],
      ["LAST_OWNER", { others: [], actorCapabilities: ADMIN_CAPS }, "rol_target"],
    ];
    for (const [code, opts, id] of cases) {
      const ctx = createService(opts);
      const err = await refusal(ctx.delete(id));
      expect(err.code, code).toBe(code);
      expect(ctx.writes(), code).toEqual([]);
      expect(ctx.calls, code).not.toContain("event:org.role.deleted");
    }
  });

  it("a soft-delete UPDATE that matches no row (a writer that skipped the lock) → 404 NOT_FOUND, no event", async () => {
    const ctx = createService({ writeMatchesNothing: true });
    const err = await refusal(ctx.delete("rol_target"));
    expect(err.code).toBe("NOT_FOUND");
    expect(ctx.calls).not.toContain("event:org.role.deleted");
  });
});

// ── U-API3-02 (delete) ─────────────────────────────────────────────────────

describe("U-API3-02 (delete) · the actor's capabilities are read in the tx, not from the ALS", () => {
  it("ALS says manage_roles, tx says no → 403 FORBIDDEN, no write, decider never reached", async () => {
    const ctx = createService({
      actorCapabilities: ["manage_orders"],
      alsCapabilities: ADMIN_CAPS,
    });
    expect((await refusal(ctx.delete("rol_target"))).code).toBe("FORBIDDEN");
    expect(ctx.writes()).toEqual([]);
    expect(ctx.decide).not.toHaveBeenCalled();
  });

  it("held role: ALS says manage_members, tx says no → ROLE_HELD_REQUIRES_MANAGE_MEMBERS", async () => {
    const ctx = createService({
      actorCapabilities: DESIGNER_CAPS,
      alsCapabilities: [...DESIGNER_CAPS, "manage_members"],
      others: HELD_BY_OTHER,
    });
    expect((await refusal(ctx.delete("rol_target"))).code).toBe(
      "ROLE_HELD_REQUIRES_MANAGE_MEMBERS",
    );
    expect(ctx.decide.mock.calls.at(-1)![0].actorCapabilities).toEqual(DESIGNER_CAPS);
  });
});

// ── api-spec §2 / architecture §1.3 order ──────────────────────────────────

describe("api-spec §2 · the FIXED order of checks on delete", () => {
  it("404 before the floor: an unknown role is NOT_FOUND even for a caller who lost manage_roles", async () => {
    const ctx = createService({ actorCapabilities: ["manage_orders"] });
    expect((await refusal(ctx.delete("rol_nope"))).code).toBe("NOT_FOUND");
  });

  it("the role is looked up LIVE (deletedAt: null in the where — LIVE_ROLE_WHERE)", async () => {
    const ctx = createService();
    await ctx.delete("rol_target");
    expect(ctx.tx.role.findFirst.mock.calls[0]![0].where).toEqual({
      id: "rol_target",
      deletedAt: null,
    });
  });

  it("floor before ROLE_LOCKED: no manage_roles in tx + the Owner role → FORBIDDEN, no event", async () => {
    const ctx = createService({ actorCapabilities: ["manage_orders"] });
    expect((await refusal(ctx.delete("rol_owner"))).code).toBe("FORBIDDEN");
    expect(ctx.sink.events).toEqual([]);
  });

  it("ROLE_LOCKED: an Owner actor leaves no event; an Admin leaves escalation_denied(role_locked, delete_role) after commit (SR-13)", async () => {
    const own = createService();
    expect((await refusal(own.delete("rol_owner"))).code).toBe("ROLE_LOCKED");
    expect(own.sink.events).toEqual([]);

    const adm = createService({ actorCapabilities: ADMIN_CAPS });
    expect((await refusal(adm.delete("rol_owner"))).code).toBe("ROLE_LOCKED");
    const denied = adm.sink.ofType("org.role.escalation_denied");
    expect(denied).toHaveLength(1);
    expect(denied[0]!.payload).toMatchObject({
      actorUserId: ACTOR,
      organizationId: ORG,
      roleId: "rol_owner",
      targetUserId: null,
      operation: "delete_role",
      reason: "role_locked",
      excessCapabilities: [],
    });
    expect(adm.calls.indexOf("event:escalation_denied:role_locked")).toBeGreaterThan(
      adm.calls.indexOf("commit"),
    );
  });

  it("ROLE_EXCEEDS_ACTOR before the held-role rules: the excess keys are in the event only, no details", async () => {
    const ctx = createService({
      actorCapabilities: DESIGNER_CAPS,
      roles: withTarget(["manage_billing", "manage_orders"]),
      others: HELD_BY_OTHER,
    });
    const err = await refusal(ctx.delete("rol_target"));
    expect(err.code).toBe("ROLE_EXCEEDS_ACTOR");
    expect(envelope(err).details).toBeUndefined();
    expect(ctx.sink.ofType("org.role.escalation_denied")[0]!.payload).toMatchObject({
      operation: "delete_role",
      reason: "exceeds_actor",
      roleId: "rol_target",
      excessCapabilities: ["manage_billing"],
    });
  });

  it("★ ROLE_HELD_REQUIRES_MANAGE_MEMBERS before ROLE_IN_USE (arch §1.3) — no security event, a warn log role_write_refused", async () => {
    const ctx = createService({ actorCapabilities: DESIGNER_CAPS, others: HELD_BY_OTHER });
    const err = await refusal(ctx.delete("rol_target"));
    expect(err.code).toBe("ROLE_HELD_REQUIRES_MANAGE_MEMBERS");
    expect(envelope(err).details).toBeUndefined();
    expect(ctx.sink.events).toEqual([]);
    const line = ctx.warn.mock.calls
      .map((c) => String(c[0]))
      .find((l) => /role_write_refused/.test(l));
    expect(line).toBeDefined();
    expect(JSON.parse(line!.replace(/^role_write_refused /, ""))).toEqual({
      operation: "deleteRole",
      reason: "requires_manage_members",
      organizationId: ORG,
      roleId: "rol_target",
    });
  });

  it("★ TARGET_NOT_BELOW_ACTOR before ROLE_IN_USE (held, equal): event delete_role, targetUserId null, no excess", async () => {
    const ctx = createService({
      actorCapabilities: ADMIN_CAPS,
      roles: withTarget(ADMIN_CAPS),
      others: HELD_BY_OTHER,
    });
    const err = await refusal(ctx.delete("rol_target"));
    expect(err.code).toBe("TARGET_NOT_BELOW_ACTOR");
    expect(envelope(err).details).toBeUndefined();
    expect(ctx.sink.ofType("org.role.escalation_denied")[0]!.payload).toMatchObject({
      operation: "delete_role",
      reason: "target_not_below_actor",
      roleId: "rol_target",
      targetUserId: null,
      excessCapabilities: [],
    });
  });

  it("the decider sees op=delete, the stored role and the other-holder count", async () => {
    const ctx = createService({ actorCapabilities: ADMIN_CAPS });
    await ctx.delete("rol_target");
    expect(ctx.decide).toHaveBeenCalledTimes(1);
    expect(ctx.decide.mock.calls[0]![0]).toEqual({
      op: "delete",
      actorCapabilities: ADMIN_CAPS,
      role: { isSystem: false, capabilities: ["manage_orders"] },
      otherActiveHolders: 0,
    });
  });

  it("other holders counted through tx after the lock: { organizationId, roleId, status:'active', userId:{not: actor} }", async () => {
    const ctx = createService();
    await ctx.delete("rol_target");
    const holderCount = ctx.tx.membership.count.mock.calls
      .map((c) => c[0].where)
      .find((w) => w.userId !== undefined);
    expect(holderCount).toEqual({
      organizationId: ORG,
      roleId: "rol_target",
      status: "active",
      userId: { not: ACTOR },
    });
    expect(ctx.calls.indexOf("tx:membership.count")).toBeGreaterThan(
      ctx.calls.indexOf("tx:FOR UPDATE"),
    );
  });

  it("ROLE_IN_USE (Owner actor — bypass): details = { activeMembers, pendingInvitations } and nothing else", async () => {
    const ctx = createService({
      others: [
        ...HELD_BY_OTHER,
        { userId: "usr_h2", roleId: "rol_target", status: "active" },
        { userId: "usr_rev", roleId: "rol_target", status: "revoked" },
      ],
      invitations: [
        pendingFor("rol_target"),
        { ...pendingFor("rol_target"), id: "inv_acc", status: "accepted" },
      ],
    });
    const err = await refusal(ctx.delete("rol_target"));
    expect(err.code).toBe("ROLE_IN_USE");
    expect(envelope(err).details).toEqual({ activeMembers: 2, pendingInvitations: 1 });
    expect(ctx.sink.events).toEqual([]);
  });

  it("★ AC-3.9 · an EXPIRED pending invitation still makes the role in use", async () => {
    const ctx = createService({
      invitations: [pendingFor("rol_target", new Date(Date.now() - 3_600_000))],
    });
    const err = await refusal(ctx.delete("rol_target"));
    expect(err.code).toBe("ROLE_IN_USE");
    expect(envelope(err).details).toEqual({ activeMembers: 0, pendingInvitations: 1 });
    // No `expiresAt` filter — expired links count (AC-3.9). `organizationId`
    // explicit since security review B25 L-3.
    expect(ctx.tx.invitation.count.mock.calls[0]![0].where).toEqual({
      organizationId: "org_ctx",
      roleId: "rol_target",
      status: "pending",
    });
  });

  it("the actor holding the role themselves makes it in use (activeMembers counts every active holder)", async () => {
    const ctx = createService({
      actorRoleId: "rol_target",
      actorCapabilities: ADMIN_CAPS,
      roles: withTarget(["manage_orders", "manage_roles"]),
    });
    const err = await refusal(ctx.delete("rol_target"));
    expect(err.code).toBe("ROLE_IN_USE");
    expect(envelope(err).details).toEqual({ activeMembers: 1, pendingInvitations: 0 });
  });

  it("★ ROLE_IN_USE before ROLE_HISTORY_LIMIT_REACHED: a held role in a shop at the cap → IN_USE", async () => {
    const ctx = createService({
      maxDeletedRolesPerOrg: 1,
      roles: [...BASE_ROLES(), ...deletedRows(1)],
      invitations: [pendingFor("rol_target")],
    });
    expect((await refusal(ctx.delete("rol_target"))).code).toBe("ROLE_IN_USE");
  });

  it("★ ROLE_HISTORY_LIMIT_REACHED at the cap (details.limit, role stays live); one below the cap deletes", async () => {
    const at = createService({
      maxDeletedRolesPerOrg: 3,
      roles: [...BASE_ROLES(), ...deletedRows(3)],
    });
    const err = await refusal(at.delete("rol_target"));
    expect(err.code).toBe("ROLE_HISTORY_LIMIT_REACHED");
    expect(envelope(err).details).toEqual({ limit: 3 });
    expect(at.roleOf("rol_target").deletedAt).toBeNull();
    expect(at.sink.events).toEqual([]);

    const below = createService({
      maxDeletedRolesPerOrg: 3,
      roles: [...BASE_ROLES(), ...deletedRows(2)],
    });
    await below.delete("rol_target");
    expect(below.writes()).toEqual(["write:role.updateMany"]);
  });

  it("the cap counts DELETED rows only (where deletedAt: { not: null }) — live roles do not use it up", async () => {
    const ctx = createService({ maxDeletedRolesPerOrg: 1 }); // 5 live roles, 0 deleted
    await ctx.delete("rol_target");
    const capCount = ctx.tx.role.count.mock.calls.map((c) => c[0].where);
    expect(capCount).toEqual([{ deletedAt: { not: null } }]);
  });

  it("ROLE_HISTORY_LIMIT_REACHED before the Owner invariant (a shop with no active Owner at the cap)", async () => {
    const ctx = createService({
      actorCapabilities: ADMIN_CAPS,
      others: [],
      maxDeletedRolesPerOrg: 1,
      roles: [...BASE_ROLES(), ...deletedRows(1)],
    });
    expect((await refusal(ctx.delete("rol_target"))).code).toBe("ROLE_HISTORY_LIMIT_REACHED");
    expect(ctx.calls.some((c) => c.startsWith("assertOwnerRemains"))).toBe(false);
  });
});

// ── events + observability ─────────────────────────────────────────────────

describe("delete — what is answered, events, observability, lock order", () => {
  it("org.role.deleted: exactly ids + the role's name + caps (AC-9.5), once, after commit", async () => {
    const ctx = createService({ actorCapabilities: ADMIN_CAPS });
    await ctx.delete("rol_target");
    const events = ctx.sink.events.filter((e) => e.type.startsWith("org.role."));
    expect(events.map((e) => e.type)).toEqual(["org.role.deleted"]);
    expect(events[0]!.payload).toEqual({
      actorUserId: ACTOR,
      organizationId: ORG,
      roleId: "rol_target",
      name: "Packer",
      capabilities: ["manage_orders"],
    });
  });

  it("no RoleDetail is read: DELETE answers DeletedRole only", async () => {
    const ctx = createService();
    await ctx.delete("rol_target");
    expect(ctx.calls).not.toContain("detail");
  });

  it("warn role_deleted_rows_high {organizationId, count} once the deleted rows reach 80 % of the cap — not below", async () => {
    const high = createService({
      maxDeletedRolesPerOrg: 10,
      roles: [...BASE_ROLES(), ...deletedRows(7)],
    });
    await high.delete("rol_target"); // 8 of 10 after the delete
    const line = high.warn.mock.calls
      .map((c) => String(c[0]))
      .find((l) => /role_deleted_rows_high/.test(l));
    expect(line).toBeDefined();
    expect(JSON.parse(line!.replace(/^role_deleted_rows_high /, ""))).toEqual({
      organizationId: ORG,
      count: 8,
    });

    const low = createService({
      maxDeletedRolesPerOrg: 10,
      roles: [...BASE_ROLES(), ...deletedRows(6)],
    });
    await low.delete("rol_target"); // 7 of 10
    expect(low.warn.mock.calls.map((c) => String(c[0])).join("\n")).not.toMatch(
      /role_deleted_rows_high/,
    );
  });

  it("★ after the Role row is written NOTHING touches Membership (no read, no write, no raw lock) — reset locks Membership → Role", async () => {
    const ctx = createService();
    await ctx.delete("rol_target");
    const at = ctx.calls.indexOf("write:role.updateMany");
    expect(at).toBeGreaterThan(-1);
    const after = ctx.calls.slice(at + 1);
    expect(after).toContain("commit"); // non-vacuity: the log continues past the write
    expect(after.filter((c) => /membership\.|raw:|\$executeRaw|\$queryRaw/.test(c))).toEqual([]);
  });

  it("the org lock is the first statement after BEGIN (its operation key 'deleteRole' is pinned by G3-11)", async () => {
    const ctx = createService();
    await ctx.delete("rol_target");
    expect(ctx.calls.slice(0, 3)).toEqual(["$transaction", "tx:lock_timeout", "tx:FOR UPDATE"]);
  });
});
