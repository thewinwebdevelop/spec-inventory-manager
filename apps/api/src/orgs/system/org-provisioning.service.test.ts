// F-002 · T-002-15 ★ — `POST /organizations`, without a database.
// architecture §6.1 (atomicity + statement ORDER) · §6.2 (plan) · §6.3 (cap).
//
// WHAT A DOUBLE CAN PROVE THAT POSTGRES CANNOT
// The int suite proves the five rows exist together. It cannot easily prove the
// things that only show up under failure: that the cap is checked BEFORE the
// transaction opens, that a missing plan writes nothing at all, that the
// `org.created` event is emitted only after commit. Those are ORDERING facts, so
// the double records the order and the assertions read it.
import { describe, it, expect, vi } from "vitest";
import { DomainException } from "../../common/domain-exception";
import { OrgProvisioningService } from "./org-provisioning.service";
import type { PlanProvisioningService } from "./plan-provisioning.service";
import type { SecurityEventsService } from "../../auth";

const USER_ID = "usr_creator";
const PLAN = { planDefinitionId: "pd_1", planKey: "comp_full", tierLabel: "Full (comp)" };

/** Every call the service makes, in the order it made it. */
type CallLog = string[];

interface FakeOptions {
  readonly activeOrgCount?: number;
  readonly countThrows?: Error;
  readonly failAt?: string;
  /** Let every statement succeed, then fail the COMMIT itself. */
  readonly failCommit?: boolean;
}

function createFakePrisma(log: CallLog, options: FakeOptions = {}) {
  let roleSeq = 0;
  const record = (name: string) => {
    log.push(name);
    if (options.failAt === name) throw new Error(`boom at ${name}`);
  };

  const tx = {
    organization: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        record("tx.organization.create");
        return {
          id: "org_new",
          name: args.data.name as string,
          logo: null,
          timezone: args.data.timezone as string,
          currency: args.data.currency as string,
          createdAt: new Date("2026-08-04T00:00:00.000Z"),
        };
      }),
    },
    role: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        record("tx.role.create");
        roleSeq += 1;
        return { id: `rol_${roleSeq}`, name: args.data.name as string, key: args.data.key as string };
      }),
    },
    membership: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        record("tx.membership.create");
        return {
          id: "mem_1",
          userId: args.data.userId as string,
          roleId: args.data.roleId as string,
          status: args.data.status as string,
        };
      }),
    },
    orgEntitlement: {
      create: vi.fn(async (_args: { data: Record<string, unknown> }) => {
        record("tx.orgEntitlement.create");
        return { id: "ent_1" };
      }),
    },
    warehouse: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        record("tx.warehouse.create");
        return { id: "wh_1", name: args.data.name as string };
      }),
    },
  };

  const prisma = {
    membership: {
      count: vi.fn(async (_args?: unknown) => {
        log.push("membership.count");
        if (options.countThrows) throw options.countThrows;
        return options.activeOrgCount ?? 0;
      }),
    },
    $transaction: vi.fn(
      async (
        fn: (client: typeof tx) => Promise<unknown>,
        opts?: { timeout?: number; maxWait?: number },
      ) => {
        log.push(`$transaction(timeout=${opts?.timeout},maxWait=${opts?.maxWait})`);
        let result: unknown;
        try {
          result = await fn(tx);
        } catch (err) {
          // A real interactive transaction rolls back and rethrows; the double
          // must do the same or "nothing was written" would be untestable.
          log.push("ROLLBACK");
          throw err;
        }
        // ⚠️ COMMIT IS ITS OWN STEP, and it can fail. Modelling it explicitly is
        // what makes "post-commit" testable at all: an event emitted on the last
        // line INSIDE the callback happens before this point, looks identical in
        // a naive ordering assertion, and is still lost/false on a commit error.
        if (options.failCommit) {
          log.push("ROLLBACK");
          throw new Error("commit failed");
        }
        log.push("COMMIT");
        return result;
      },
    ),
  };

  return { prisma, tx };
}

function createService(
  log: CallLog,
  options: FakeOptions & { readonly planError?: Error; readonly limit?: number } = {},
): {
  service: OrgProvisioningService;
  events: { emit: ReturnType<typeof vi.fn> };
  prisma: ReturnType<typeof createFakePrisma>["prisma"];
  tx: ReturnType<typeof createFakePrisma>["tx"];
} {
  const { prisma, tx } = createFakePrisma(log, options);
  const plans = {
    resolveForNewOrg: vi.fn(async (_input?: unknown) => {
      log.push("plans.resolveForNewOrg");
      if (options.planError) throw options.planError;
      return PLAN;
    }),
  };
  const events = {
    emit: vi.fn((type: string) => {
      log.push(`emit:${type}`);
    }),
  };
  const service = new OrgProvisioningService(
    prisma as never,
    plans as unknown as PlanProvisioningService,
    events as unknown as SecurityEventsService,
    options.limit ?? 50,
  );
  return { service, events, prisma, tx };
}

const input = { userId: USER_ID, organization: { name: "ร้านตัวอย่าง", timezone: "Asia/Bangkok" } };

describe("★ architecture §6.1 — one transaction, in this exact order", () => {
  it("checks the cap and the plan BEFORE opening the transaction", async () => {
    const log: CallLog = [];
    const { service } = createService(log);
    await service.create(input);

    const txIndex = log.findIndex((entry) => entry.startsWith("$transaction"));
    expect(log.indexOf("membership.count")).toBeLessThan(txIndex);
    expect(log.indexOf("plans.resolveForNewOrg")).toBeLessThan(txIndex);
    // Not a style point: a transaction held open across an env lookup and a
    // catalog read pins a pooled connection for no isolation benefit (§5.2).
  });

  it("writes Organization → Role×3 → Membership → OrgEntitlement → Warehouse", async () => {
    const log: CallLog = [];
    const { service } = createService(log);
    await service.create(input);

    expect(log.filter((entry) => entry.startsWith("tx."))).toEqual([
      "tx.organization.create",
      "tx.role.create",
      "tx.role.create",
      "tx.role.create",
      "tx.membership.create",
      "tx.orgEntitlement.create",
      "tx.warehouse.create",
    ]);
  });

  it("opens the transaction with a timeout and a maxWait (never unbounded)", async () => {
    const log: CallLog = [];
    const { service, prisma } = createService(log);
    await service.create(input);
    const opts = prisma.$transaction.mock.calls[0][1] as { timeout: number; maxWait: number };
    expect(opts.timeout).toBeGreaterThan(0);
    expect(opts.maxWait).toBeGreaterThan(0);
  });

  it("★ uses sequential creates — NEVER a nested write", async () => {
    // `withOrgScope` cannot inject `organizationId` into a nested `create`
    // (architecture §2.2), so a nested write would either fail at the DB or, in
    // a client without the extension, write an unscoped row.
    const log: CallLog = [];
    const { service, tx } = createService(log);
    await service.create(input);
    const orgArgs = tx.organization.create.mock.calls[0][0] as { data: Record<string, unknown> };
    for (const key of ["roles", "memberships", "entitlement", "warehouses"]) {
      expect(orgArgs.data).not.toHaveProperty(key);
    }
    // …and every child row names the parent explicitly.
    for (const create of [tx.role.create, tx.membership.create, tx.orgEntitlement.create, tx.warehouse.create]) {
      const args = create.mock.calls[0][0] as { data: { organizationId?: string } };
      expect(args.data.organizationId).toBe("org_new");
    }
  });

  it("★ the creator's membership points at the role holding full_access", async () => {
    const log: CallLog = [];
    const { service, tx } = createService(log);
    await service.create(input);

    const roleCalls = tx.role.create.mock.calls.map(
      (c) => (c[0] as { data: { name: string; capabilities: string[] } }).data,
    );
    const owner = roleCalls.find((r) => r.capabilities.includes("full_access"));
    expect(owner?.name).toBe("Owner");
    const ownerIndex = roleCalls.indexOf(owner!);
    const membership = (tx.membership.create.mock.calls[0][0] as { data: { roleId: string; status: string } }).data;
    expect(membership.roleId).toBe(`rol_${ownerIndex + 1}`);
    expect(membership.status).toBe("active");
  });

  it("writes the three system roles with their contract `key`s", async () => {
    const log: CallLog = [];
    const { service, tx } = createService(log);
    await service.create(input);
    const roles = tx.role.create.mock.calls.map(
      (c) => (c[0] as { data: { name: string; key: string; isSystem: boolean } }).data,
    );
    expect(roles.map((r) => r.name)).toEqual(["Owner", "Admin", "Staff"]);
    expect(roles.map((r) => r.key)).toEqual(["owner", "admin", "staff"]);
    expect(roles.filter((r) => r.isSystem).map((r) => r.name)).toEqual(["Owner"]);
  });

  it("★ currency is THB from the server — never from the caller (D-013)", async () => {
    const log: CallLog = [];
    const { service, tx } = createService(log);
    await service.create({
      userId: USER_ID,
      // A caller that managed to smuggle extra keys past the DTO + validator.
      organization: { name: "ร้าน", timezone: "Asia/Bangkok", currency: "USD" } as never,
    });
    const data = (tx.organization.create.mock.calls[0][0] as { data: { currency: string } }).data;
    expect(data.currency).toBe("THB");
  });

  it("records who created the shop", async () => {
    const log: CallLog = [];
    const { service, tx } = createService(log);
    await service.create(input);
    const data = (tx.organization.create.mock.calls[0][0] as { data: { createdByUserId: string } }).data;
    expect(data.createdByUserId).toBe(USER_ID);
  });

  it("creates the default warehouse with `isDefault: true`", async () => {
    const log: CallLog = [];
    const { service, tx } = createService(log);
    await service.create(input);
    const data = (tx.warehouse.create.mock.calls[0][0] as { data: { name: string; isDefault: boolean } }).data;
    expect(data).toMatchObject({ name: "คลังหลัก", isDefault: true });
  });

  it("returns the §3.1 body the client seeds its cache from", async () => {
    const log: CallLog = [];
    const { service } = createService(log);
    const result = await service.create(input);
    expect(result).toEqual({
      organization: {
        id: "org_new",
        name: "ร้านตัวอย่าง",
        logo: null,
        timezone: "Asia/Bangkok",
        currency: "THB",
        taxProfileComplete: false,
        createdAt: "2026-08-04T00:00:00.000Z",
      },
      membership: {
        userId: USER_ID,
        roleId: "rol_1",
        roleName: "Owner",
        roleKey: "owner",
        status: "active",
      },
      entitlement: { planKey: "comp_full", tierLabel: "Full (comp)" },
      defaultWarehouse: { id: "wh_1", name: "คลังหลัก" },
    });
  });
});

describe("★ architecture §6.3 / I-10 — the per-user cap, fail-closed", () => {
  it("allows the 50th shop and refuses the 51st with 409 ORG_LIMIT_REACHED", async () => {
    const okLog: CallLog = [];
    await createService(okLog, { activeOrgCount: 49 }).service.create(input);
    expect(okLog).toContain("tx.organization.create");

    const log: CallLog = [];
    const { service } = createService(log, { activeOrgCount: 50 });
    await expect(service.create(input)).rejects.toBeInstanceOf(DomainException);
    // …and NOTHING was written, nor was a plan even looked up.
    expect(log.some((entry) => entry.startsWith("tx."))).toBe(false);
    expect(log).not.toContain("plans.resolveForNewOrg");
  });

  it("the 409 carries `details.limit` so the UI shows the real number", async () => {
    const { service } = createService([], { activeOrgCount: 50 });
    const error = await service.create(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DomainException);
    const ex = error as DomainException;
    expect(ex.getStatus()).toBe(409);
    expect(ex.code).toBe("ORG_LIMIT_REACHED");
    expect(ex.details).toEqual({ limit: 50 });
  });

  it("honours the injected limit (env-tunable — dogfood raises it without a deploy)", async () => {
    const { service } = createService([], { activeOrgCount: 2, limit: 2 });
    const error = (await service.create(input).catch((e: unknown) => e)) as DomainException;
    expect(error.details).toEqual({ limit: 2 });
  });

  it("★ counts ONLY active memberships (leaving gives the quota back)", async () => {
    const log: CallLog = [];
    const { service, prisma } = createService(log, { activeOrgCount: 0 });
    await service.create(input);
    expect(prisma.membership.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, status: "active" },
    });
  });

  it("★ FAILS CLOSED when the count itself fails — no shop, not 'assume room'", async () => {
    // The difference from the rate limiter, which fails OPEN by design (§8).
    const log: CallLog = [];
    const { service } = createService(log, { countThrows: new Error("db down") });
    await expect(service.create(input)).rejects.toThrow(/db down/);
    expect(log.some((entry) => entry.startsWith("tx."))).toBe(false);
  });
});

describe("★ architecture §6.2 — plan provisioning fails closed", () => {
  it("nothing is written when the plan cannot be resolved (503 propagates)", async () => {
    const log: CallLog = [];
    const planError = new DomainException(
      { code: "ORG_PROVISIONING_UNAVAILABLE", status: 503, message: "x" },
    );
    const { service, events } = createService(log, { planError });
    await expect(service.create(input)).rejects.toBe(planError);
    expect(log.some((entry) => entry.startsWith("$transaction"))).toBe(false);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("binds the entitlement to the plan the seam resolved", async () => {
    const log: CallLog = [];
    const { service, tx } = createService(log);
    await service.create(input);
    const data = (tx.orgEntitlement.create.mock.calls[0][0] as { data: { planDefinitionId: string } }).data;
    expect(data.planDefinitionId).toBe("pd_1");
  });
});

describe("★ the `org.created` event is POST-COMMIT only (H-3)", () => {
  it("★ is emitted after the COMMIT — not merely after the last write", async () => {
    const log: CallLog = [];
    const { service, events } = createService(log);
    await service.create(input);

    // The strict version of the assertion: an emit on the last line inside the
    // transaction callback would satisfy "after the last write" and still be a
    // lie if the commit fails (see the `failCommit` case below).
    expect(log.indexOf("emit:org.created")).toBeGreaterThan(log.indexOf("COMMIT"));
    expect(events.emit).toHaveBeenCalledWith("org.created", {
      actorUserId: USER_ID,
      organizationId: "org_new",
      planKey: "comp_full",
    });
  });

  it("★ a COMMIT failure emits nothing (the write never became real)", async () => {
    const log: CallLog = [];
    const { service, events } = createService(log, { failCommit: true });
    await expect(service.create(input)).rejects.toThrow(/commit failed/);
    expect(log).toContain("ROLLBACK");
    expect(events.emit).not.toHaveBeenCalled();
  });

  it.each([
    "tx.organization.create",
    "tx.role.create",
    "tx.membership.create",
    "tx.orgEntitlement.create",
    "tx.warehouse.create",
  ])("★ a failure at %s rolls back and emits NOTHING", async (failAt) => {
    const log: CallLog = [];
    const { service, events } = createService(log, { failAt });
    await expect(service.create(input)).rejects.toThrow(/boom/);
    expect(log).toContain("ROLLBACK");
    expect(events.emit).not.toHaveBeenCalled();
    // An audit trail that claims a shop was created, when the transaction that
    // would have created it rolled back, is worse than no audit trail.
  });
});
