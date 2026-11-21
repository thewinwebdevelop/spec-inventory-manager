// F-003 · T-003-B23 ★ — `RolesService.create` ORCHESTRATION (POST /orgs/{orgId}/roles).
//
// The rules live (and are proven) in core-domain: `validateRoleName`,
// `validateRoleCapabilities`, `decideRoleWrite`, `assertOwnerRemains`. What only
// this layer can prove, and what this file pins:
//
//   U-API3-01 (create) ★ every write the fake tx could perform is a SPY on one
//       shared call log — `assertOwnerRemains` comes BEFORE the first write,
//       a refusal writes NOTHING, and with the decider seam (`ROLE_WRITE_DECIDER`)
//       allowing everything an org with no Owner still answers `LAST_OWNER`
//       with zero writes. Non-vacuity: the spy list is enumerated from the REAL
//       Prisma delegates, so a write method the fake forgot to spy is red.
//   U-API3-02 (create) the actor's capabilities come from `tx`, never the ALS.
//   api-spec §2 FIXED order on create: floor `manage_roles` (FORBIDDEN) →
//       body shape (VALIDATION_FAILED) → name (VALIDATION_FAILED / reserved
//       ROLE_NAME_TAKEN) → ROLE_EMPTY → FULL_ACCESS_RESERVED → UNKNOWN_CAPABILITY
//       → ROLE_EXCEEDS_ACTOR → ROLE_LIMIT_REACHED → Owner invariant → write
//       (unique violation → ROLE_NAME_TAKEN).
//   events: `escalation_denied` (full_access_reserved / exceeds_actor) and
//       `org.role.created` are emitted AFTER the transaction, never inside it.
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
const OTHER_OWNER = "usr_owner";

const OWNER_CAPS = ["full_access"];
const ADMIN_CAPS = ["manage_members", "manage_org_settings", "manage_roles", "manage_orders"];

interface FakeRole {
  id: string;
  name: string;
  key: string | null;
  isSystem: boolean;
  capabilities: string[];
  nameCustomized: boolean;
  deletedAt: Date | null;
}
interface FakeMembership {
  userId: string;
  roleId: string;
  status: string;
}

const SYSTEM_ROLES: FakeRole[] = [
  {
    id: "rol_owner",
    name: "Owner",
    key: "owner",
    isSystem: true,
    capabilities: OWNER_CAPS,
    nameCustomized: false,
    deletedAt: null,
  },
  {
    id: "rol_admin",
    name: "Admin",
    key: "admin",
    isSystem: false,
    capabilities: ADMIN_CAPS,
    nameCustomized: false,
    deletedAt: null,
  },
  {
    id: "rol_staff",
    name: "Staff",
    key: "staff",
    isSystem: false,
    capabilities: ["manage_orders"],
    nameCustomized: false,
    deletedAt: null,
  },
];

/** The write methods of a REAL Prisma delegate — everything that is not a read. */
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
    readonly actorRoleCapabilities?: readonly string[];
    /** What the ALS claims — deliberately different from the tx in U-API3-02. */
    readonly alsCapabilities?: readonly string[];
    readonly roles?: FakeRole[];
    readonly memberships?: FakeMembership[];
    readonly maxRolesPerOrg?: number;
    readonly decide?: Decider;
    readonly createThrows?: unknown;
  } = {},
) {
  const calls: string[] = [];
  const roles = (options.roles ?? SYSTEM_ROLES).map((r) => ({ ...r }));
  roles.push({
    id: "rol_actor",
    name: "Actor role",
    key: null,
    isSystem: false,
    capabilities: [...(options.actorRoleCapabilities ?? OWNER_CAPS)],
    nameCustomized: true,
    deletedAt: null,
  });
  // The actor role is a FULL_ACCESS role only when the test says so; it is
  // never `isSystem` (one system role per org).
  const memberships: FakeMembership[] = options.memberships ?? [
    { userId: ACTOR, roleId: "rol_actor", status: "active" },
    { userId: OTHER_OWNER, roleId: "rol_owner", status: "active" },
  ];
  const roleOf = (id: string) => roles.find((r) => r.id === id)!;

  // Every write method of the real delegate becomes a logged spy — the
  // non-vacuity half of U-API3-01: the fake cannot "forget" one.
  const writeSpies = (model: "role" | "membership" | "invitation") =>
    Object.fromEntries(
      realWriteMethods(model).map((m) => [
        m,
        vi.fn(async (args: { data?: Record<string, unknown> }) => {
          calls.push(`write:${model}.${m}`);
          if (model === "role" && m === "create") {
            if (options.createThrows) throw options.createThrows;
            const row = {
              id: "rol_new",
              key: null,
              isSystem: false,
              nameCustomized: false,
              deletedAt: null,
              ...(args.data as object),
            } as FakeRole;
            roles.push(row);
            return { id: row.id, name: row.name, capabilities: row.capabilities };
          }
          return { count: 0 };
        }),
      ]),
    );

  const tx = {
    $executeRawUnsafe: vi.fn(async (q: string) => {
      calls.push(
        q.startsWith("SET LOCAL lock_timeout") ? "tx:lock_timeout" : "write:$executeRawUnsafe",
      );
    }),
    $queryRawUnsafe: vi.fn(async (_q: string, id: string) => {
      calls.push("tx:FOR UPDATE");
      return [{ id }];
    }),
    $executeRaw: vi.fn(async () => calls.push("write:$executeRaw")),
    $queryRaw: vi.fn(async () => calls.push("write:$queryRaw")),
    role: {
      ...writeSpies("role"),
      findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        calls.push("tx:role.findMany");
        const where = args.where ?? {};
        return roles.filter(
          (r) =>
            !("deletedAt" in where && where.deletedAt === null && r.deletedAt) &&
            !("key" in where && r.key === null),
        );
      }),
      count: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        calls.push("tx:role.count");
        const where = args.where ?? {};
        return roles.filter(
          (r) => !("deletedAt" in where && where.deletedAt === null && r.deletedAt),
        ).length;
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
        return m
          ? { userId: m.userId, roleId: m.roleId, status: m.status, role: roleOf(m.roleId) }
          : null;
      }),
      findMany: vi.fn(async () => {
        calls.push("tx:membership.findMany");
        return memberships
          .filter((m) => roleOf(m.roleId).capabilities.includes("full_access"))
          .map((m) => ({ ...m, role: { capabilities: roleOf(m.roleId).capabilities } }));
      }),
    },
    invitation: { ...writeSpies("invitation") },
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
  const assertSpy = vi.spyOn(ownership, "assertOwnerRemainsInTx");
  const realAssert = OrgOwnershipGuard.prototype.assertOwnerRemainsInTx;
  assertSpy.mockImplementation(async function (this: OrgOwnershipGuard, t, change) {
    calls.push(`assertOwnerRemains:${change.kind}`);
    return realAssert.call(ownership, t, change);
  });

  const decide = vi.fn(options.decide ?? decideRoleWrite);
  const detail = { id: "rol_new", sentinel: "RoleDetail" };
  const reads = {
    getDetail: vi.fn(async (roleId: string, via?: { client: unknown }) => {
      calls.push(via?.client === tx ? "tx:detail" : "client:detail");
      return { ...detail, id: roleId };
    }),
  } as unknown as RoleReadService;

  const service = new RolesService(
    prisma as never,
    store,
    events,
    ownership,
    decide as never,
    { maxRolesPerOrg: options.maxRolesPerOrg ?? 30, maxDeletedRolesPerOrg: 500 },
    reads,
  );

  return {
    calls,
    tx,
    sink,
    decide,
    reads,
    roles,
    writes: () => calls.filter((c) => c.startsWith("write:")),
    run: <T>(fn: () => Promise<T>) =>
      store.run(
        {
          organizationId: ORG,
          userId: ACTOR,
          roleId: "rol_actor",
          capabilities: options.alsCapabilities ?? options.actorRoleCapabilities ?? OWNER_CAPS,
        },
        fn,
      ),
    create: (body: unknown) =>
      store.run(
        {
          organizationId: ORG,
          userId: ACTOR,
          roleId: "rol_actor",
          capabilities: options.alsCapabilities ?? options.actorRoleCapabilities ?? OWNER_CAPS,
        },
        () => service.create(body),
      ),
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

const GOOD = { name: "Packer", capabilities: ["manage_orders"] };

describe("★ U-API3-01 (create) · spy every write — Owner invariant before the first write", () => {
  it("non-vacuity: the fake spies EVERY write method the real role/membership/invitation delegates have", () => {
    const ctx = createService();
    for (const model of ["role", "membership", "invitation"] as const) {
      const real = realWriteMethods(model);
      expect(
        real.length,
        `${model}: enumerated no write methods — the guard is vacuous`,
      ).toBeGreaterThan(3);
      expect(real).toEqual(
        expect.arrayContaining([
          "create",
          "update",
          "updateMany",
          "upsert",
          "delete",
          "deleteMany",
        ]),
      );
      const fake = ctx.tx[model] as Record<string, unknown>;
      for (const m of real) {
        expect(vi.isMockFunction(fake[m]), `${model}.${m} is not spied`).toBe(true);
      }
    }
  });

  it("happy path: lock → … → assertOwnerRemains → exactly ONE write (role.create) → commit → event", async () => {
    const ctx = createService();
    await ctx.create(GOOD);
    expect(ctx.writes()).toEqual(["write:role.create"]);
    const assertAt = ctx.calls.indexOf("assertOwnerRemains:role_create");
    expect(assertAt).toBeGreaterThan(-1);
    expect(assertAt).toBeLessThan(ctx.calls.indexOf("write:role.create"));
    expect(ctx.calls.indexOf("tx:lock_timeout")).toBe(1); // first statement after BEGIN
    expect(ctx.calls.indexOf("event:org.role.created")).toBeGreaterThan(
      ctx.calls.indexOf("commit"),
    );
  });

  it("★ decider seam allows everything + org with NO active Owner → 409 LAST_OWNER, zero writes", async () => {
    const ctx = createService({
      actorRoleCapabilities: ADMIN_CAPS,
      memberships: [{ userId: ACTOR, roleId: "rol_actor", status: "active" }], // no Owner left
      decide: () => ({ ok: true }),
    });
    const err = await refusal(ctx.create(GOOD));
    expect(err.code).toBe("LAST_OWNER");
    expect(ctx.decide).toHaveBeenCalledTimes(1);
    expect(ctx.writes()).toEqual([]);
    expect(ctx.calls).not.toContain("event:org.role.created");
  });

  it("control: decider allows + an org that HAS an Owner → the write happens exactly once", async () => {
    const ctx = createService({ actorRoleCapabilities: ADMIN_CAPS, decide: () => ({ ok: true }) });
    await ctx.create(GOOD);
    expect(ctx.writes()).toEqual(["write:role.create"]);
  });

  it("every refusal writes nothing (one per rule on the create path)", async () => {
    const cases: Array<[string, Parameters<typeof createService>[0], unknown]> = [
      ["FORBIDDEN", { actorRoleCapabilities: ["manage_orders"] }, GOOD],
      ["VALIDATION_FAILED", {}, { name: 42, capabilities: [] }],
      ["ROLE_NAME_TAKEN", {}, { name: "เจ้าของร้าน", capabilities: ["manage_orders"] }],
      ["ROLE_EMPTY", {}, { name: "X", capabilities: [] }],
      ["FULL_ACCESS_RESERVED", {}, { name: "X", capabilities: ["full_access"] }],
      ["UNKNOWN_CAPABILITY", {}, { name: "X", capabilities: ["bogus"] }],
      [
        "ROLE_EXCEEDS_ACTOR",
        { actorRoleCapabilities: ADMIN_CAPS },
        { name: "X", capabilities: ["manage_billing"] },
      ],
      ["ROLE_LIMIT_REACHED", { maxRolesPerOrg: 4 }, GOOD],
    ];
    for (const [code, opts, body] of cases) {
      const ctx = createService(opts);
      const err = await refusal(ctx.create(body));
      expect(err.code, code).toBe(code);
      expect(ctx.writes(), code).toEqual([]);
    }
  });
});

describe("U-API3-02 (create) · the actor's capabilities are read in the tx, not from the ALS", () => {
  it("ALS says manage_roles, tx says no → 403 FORBIDDEN, no write, decider never reached", async () => {
    const ctx = createService({
      actorRoleCapabilities: ["manage_orders"],
      alsCapabilities: ADMIN_CAPS,
    });
    const err = await refusal(ctx.create(GOOD));
    expect(err.code).toBe("FORBIDDEN");
    expect(ctx.writes()).toEqual([]);
    expect(ctx.calls).toContain("tx:membership.findFirst");
  });

  it("ALS says Owner, tx says Admin → the decider is fed the tx caps (ROLE_EXCEEDS_ACTOR)", async () => {
    const ctx = createService({ actorRoleCapabilities: ADMIN_CAPS, alsCapabilities: OWNER_CAPS });
    const err = await refusal(ctx.create({ name: "X", capabilities: ["manage_billing"] }));
    expect(err.code).toBe("ROLE_EXCEEDS_ACTOR");
    expect(ctx.decide.mock.calls[0]![0].actorCapabilities).toEqual(ADMIN_CAPS);
  });

  it("an actor whose membership vanished mid-flight → ORG_ACCESS_DENIED", async () => {
    const ctx = createService({
      memberships: [{ userId: OTHER_OWNER, roleId: "rol_owner", status: "active" }],
    });
    expect((await refusal(ctx.create(GOOD))).code).toBe("ORG_ACCESS_DENIED");
  });
});

describe("api-spec §2 · the FIXED order of checks on create", () => {
  it("floor before body shape: no manage_roles in tx + garbage body → FORBIDDEN (not VALIDATION_FAILED)", async () => {
    const ctx = createService({ actorRoleCapabilities: ["manage_orders"] });
    expect((await refusal(ctx.create("not an object"))).code).toBe("FORBIDDEN");
  });

  it("floor before FULL_ACCESS_RESERVED: no event for a caller who lost manage_roles", async () => {
    const ctx = createService({ actorRoleCapabilities: ["manage_orders"] });
    expect((await refusal(ctx.create({ name: "X", capabilities: ["full_access"] }))).code).toBe(
      "FORBIDDEN",
    );
    expect(ctx.sink.events).toEqual([]);
  });

  it("body shape: name must be a string, capabilities an array ≤ 64 of strings ≤ 64 (fieldErrors)", async () => {
    for (const body of [
      null,
      [],
      {},
      { name: "X" },
      { capabilities: ["manage_orders"] },
      { name: "X", capabilities: "manage_orders" },
      { name: "X", capabilities: [1] },
      { name: "X", capabilities: Array.from({ length: 65 }, () => "manage_orders") },
      { name: "X", capabilities: ["v".repeat(65)] },
    ]) {
      const ctx = createService();
      const err = await refusal(ctx.create(body));
      expect(err.code, JSON.stringify(body)).toBe("VALIDATION_FAILED");
      const fieldErrors = (err.getResponse() as { error: { fieldErrors?: object } }).error
        .fieldErrors;
      expect(Object.keys(fieldErrors ?? {}).length, JSON.stringify(body)).toBeGreaterThan(0);
    }
  });

  it("name before caps: Cc/Cf name + empty caps → VALIDATION_FAILED fieldErrors.name", async () => {
    const ctx = createService();
    const err = await refusal(ctx.create({ name: "a​b", capabilities: [] }));
    expect(err.code).toBe("VALIDATION_FAILED");
    expect(
      (err.getResponse() as { error: { fieldErrors: object } }).error.fieldErrors,
    ).toHaveProperty("name");
  });

  it("reserved name before ROLE_EMPTY: 'ผู้ดูแล' (Admin not renamed) + [] → ROLE_NAME_TAKEN", async () => {
    const ctx = createService();
    expect((await refusal(ctx.create({ name: "ผู้ดูแล", capabilities: [] }))).code).toBe(
      "ROLE_NAME_TAKEN",
    );
  });

  it("…but once Admin's name is customized, 'ผู้ดูแล' is free (reserved set read in the tx)", async () => {
    const roles = SYSTEM_ROLES.map((r) => (r.key === "admin" ? { ...r, nameCustomized: true } : r));
    const ctx = createService({ roles });
    await ctx.create({ name: "ผู้ดูแล", capabilities: ["manage_orders"] });
    expect(ctx.writes()).toEqual(["write:role.create"]);
  });

  it("FULL_ACCESS_RESERVED before UNKNOWN_CAPABILITY, even for the Owner, + escalation_denied post-commit", async () => {
    const ctx = createService();
    const err = await refusal(ctx.create({ name: "X", capabilities: ["full_access", "bogus"] }));
    expect(err.code).toBe("FULL_ACCESS_RESERVED");
    expect(
      (err.getResponse() as { error: { fieldErrors: object } }).error.fieldErrors,
    ).toHaveProperty("capabilities");
    const denied = ctx.sink.ofType("org.role.escalation_denied");
    expect(denied).toHaveLength(1);
    expect(denied[0]!.payload).toMatchObject({
      actorUserId: ACTOR,
      organizationId: ORG,
      roleId: null,
      targetUserId: null,
      operation: "create_role",
      reason: "full_access_reserved",
    });
    expect(ctx.calls.indexOf("event:escalation_denied:full_access_reserved")).toBeGreaterThan(
      ctx.calls.indexOf("commit"),
    );
  });

  it("UNKNOWN_CAPABILITY carries details.capabilities + fieldErrors.capabilities, no event", async () => {
    const ctx = createService();
    const err = await refusal(
      ctx.create({ name: "X", capabilities: ["manage_orders", "zz", "access_accounting"] }),
    );
    expect(err.code).toBe("UNKNOWN_CAPABILITY");
    const body = (
      err.getResponse() as { error: { details: { capabilities: string[] }; fieldErrors: object } }
    ).error;
    expect(body.details.capabilities).toEqual(["access_accounting", "zz"]);
    expect(body.fieldErrors).toHaveProperty("capabilities");
    expect(ctx.sink.events).toEqual([]);
  });

  it("ROLE_EXCEEDS_ACTOR: no details on the wire, the excess keys in the event only", async () => {
    const ctx = createService({ actorRoleCapabilities: ADMIN_CAPS });
    const err = await refusal(
      ctx.create({ name: "X", capabilities: ["manage_billing", "manage_orders"] }),
    );
    expect(err.code).toBe("ROLE_EXCEEDS_ACTOR");
    expect((err.getResponse() as { error: { details?: unknown } }).error.details).toBeUndefined();
    const [event] = ctx.sink.ofType("org.role.escalation_denied");
    expect(event!.payload).toMatchObject({
      operation: "create_role",
      reason: "exceeds_actor",
      excessCapabilities: ["manage_billing"],
    });
  });

  it("ROLE_EXCEEDS_ACTOR before ROLE_LIMIT_REACHED (the more complete reason first)", async () => {
    const ctx = createService({ actorRoleCapabilities: ADMIN_CAPS, maxRolesPerOrg: 1 });
    expect((await refusal(ctx.create({ name: "X", capabilities: ["manage_billing"] }))).code).toBe(
      "ROLE_EXCEEDS_ACTOR",
    );
  });

  it("ROLE_LIMIT_REACHED counts LIVE roles only (system ones included) and carries details.limit", async () => {
    // 3 system + actor role = 4 live; one deleted row does not count.
    const roles = [
      ...SYSTEM_ROLES,
      { ...SYSTEM_ROLES[2]!, id: "rol_gone", key: null, name: "Gone", deletedAt: new Date() },
    ];
    const ok = createService({ roles, maxRolesPerOrg: 5 });
    await ok.create(GOOD);
    expect(ok.writes()).toEqual(["write:role.create"]);

    const full = createService({ roles, maxRolesPerOrg: 4 });
    const err = await refusal(full.create(GOOD));
    expect(err.code).toBe("ROLE_LIMIT_REACHED");
    expect((err.getResponse() as { error: { details: object } }).error.details).toEqual({
      limit: 4,
    });
  });

  it("a unique violation at write time (P2002) → 409 ROLE_NAME_TAKEN, no created event", async () => {
    const p2002 = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      clientVersion: "5.22.0",
      meta: { target: "Role_org_name_ci_live_key" },
    });
    const ctx = createService({ createThrows: p2002 });
    expect(
      (await refusal(ctx.create({ name: "admin", capabilities: ["manage_orders"] }))).code,
    ).toBe("ROLE_NAME_TAKEN");
    expect(ctx.sink.ofType("org.role.created")).toEqual([]);
  });

  it("any OTHER write error is not disguised as a name clash", async () => {
    const ctx = createService({ createThrows: new Error("boom") });
    await expect(ctx.create(GOOD)).rejects.toThrow("boom");
  });
});

describe("create — what is written and what is answered", () => {
  it("writes key=null, isSystem=false, the NORMALISED name, CANONICAL caps, lastEdited = actor/now", async () => {
    const ctx = createService();
    await ctx.create({
      name: "  Packing   team ",
      capabilities: ["manage_products", "manage_orders", "manage_products"],
      key: "owner",
      isSystem: true,
      version: 9,
    });
    const data = ((ctx.tx.role as Record<string, unknown>).create as ReturnType<typeof vi.fn>).mock
      .calls[0]![0].data as Record<string, unknown>;
    expect(data).toMatchObject({
      organizationId: ORG,
      name: "Packing team",
      key: null,
      isSystem: false,
      capabilities: ["manage_orders", "manage_products"], // deduped + sorted (api-spec §2)
      lastEditedByUserId: ACTOR,
    });
    expect(data.lastEditedAt).toBeInstanceOf(Date);
    expect(data).not.toHaveProperty("version");
  });

  it("the decider sees op=create, otherActiveHolders=0 and the VALIDATED caps", async () => {
    const ctx = createService({ actorRoleCapabilities: ADMIN_CAPS });
    await ctx.create({ name: "X", capabilities: ["manage_orders"] });
    const input = ctx.decide.mock.calls[0]![0] as RoleWriteInput & { next: readonly string[] };
    expect(input.op).toBe("create");
    expect(input.otherActiveHolders).toBe(0);
    expect(Object.isFrozen(input.next)).toBe(true);
  });

  it("answers the RoleDetail read through the SAME tx (viewer = actor as read in the tx)", async () => {
    const ctx = createService();
    const out = (await ctx.create(GOOD)) as unknown as { id: string; sentinel: string };
    expect(out).toEqual({ id: "rol_new", sentinel: "RoleDetail" });
    expect(ctx.calls).toContain("tx:detail");
    const via = (ctx.reads.getDetail as ReturnType<typeof vi.fn>).mock.calls[0]![1];
    expect(via.viewer).toEqual({ userId: ACTOR, roleId: "rol_actor", capabilities: OWNER_CAPS });
  });

  it("org.role.created: id + name + caps only (AC-9.5), exactly once, after commit", async () => {
    const ctx = createService();
    await ctx.create({ name: "Packer", capabilities: ["manage_orders"] });
    const created = ctx.sink.ofType("org.role.created");
    expect(created).toHaveLength(1);
    expect(created[0]!.payload).toEqual({
      actorUserId: ACTOR,
      organizationId: ORG,
      roleId: "rol_new",
      name: "Packer",
      capabilities: ["manage_orders"],
    });
  });

  it("takes the org lock with operation 'createRole' (ORG_TX_TIMEOUTS / metric label)", async () => {
    const ctx = createService();
    await ctx.create(GOOD);
    expect(ctx.calls.slice(0, 3)).toEqual(["$transaction", "tx:lock_timeout", "tx:FOR UPDATE"]);
  });
});

describe("security review B23 L-1 · a huge name is refused at the shape check, before normalisation under the lock", () => {
  it("rejects a name longer than ROLE_NAME_RAW_MAX_LENGTH with fieldErrors.name (too long)", async () => {
    const { parseCreateRoleBody, ROLE_NAME_RAW_MAX_LENGTH } = await import("./roles.service");
    const huge = parseCreateRoleBody({
      name: "ก".repeat(100_000),
      capabilities: ["view_products"],
    });
    expect(huge.ok).toBe(false);
    if (!huge.ok) expect(huge.fieldErrors.name).toBe("ชื่อบทบาทยาวเกิน 50 ตัวอักษร");
    // A name with lots of collapsible whitespace that normalises to ≤ 50 still
    // passes the shape check — the cap is generous, not the 50-code-point rule.
    const padded = parseCreateRoleBody({
      name: `  ${"ก".repeat(40)}${" ".repeat(ROLE_NAME_RAW_MAX_LENGTH - 50)}`,
      capabilities: ["view_products"],
    });
    expect(padded.ok).toBe(true);
    expect(ROLE_NAME_RAW_MAX_LENGTH).toBeGreaterThanOrEqual(200);
  });
});
