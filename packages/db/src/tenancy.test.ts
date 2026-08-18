// F-002 · T-002-02 — unit tests for the REAL `withOrgScope` (replaces the
// F-000 pass-through stub). Authoritative spec: docs/features/F-002/
// architecture.md §2.2 (per-operation contract) + test-plan U-DB-01..U-DB-07.
//
// These tests are DB-free on purpose: they assert what the extension SENDS to
// the query engine, by chaining a probe extension that captures the final args
// and short-circuits before any I/O. The complementary "does Postgres actually
// behave that way" proof (M-9: extendedWhereUnique + upsert row-by-row) lives in
// tenancy.db.test.ts against a real database — a claim about Prisma's runtime
// cannot be proven by a mock of Prisma.
//
// Extension ordering note (verified empirically, and the reason this technique
// works): `withOrgScope(base, ctx).$extends(probe)` runs withOrgScope's hook
// FIRST, so the probe observes post-injection args.

import { describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "../generated/client";
import {
  applyOrgScope,
  MissingOrgContextError,
  ORG_SCOPE_OPERATION_STRATEGY,
  OrgScopeViolationError,
  UnregisteredOrgScopeModelError,
  UnsupportedOrgScopeOperationError,
  withOrgScope,
  type OrgScopeContext,
} from "./tenancy";
import { ORG_AGNOSTIC_MODELS } from "./org-models";

const ORG = "org_ctx";
const OTHER = "org_other";
const ctx: OrgScopeContext = { organizationId: ORG };

type Call = { model: string | undefined; operation: string; args: unknown };

// NOTE: no default parameter here on purpose — a default would swallow the
// `undefined` context case (the one U-DB-04 cares most about) and quietly test
// the happy path instead.
/** Scoped client + probe that captures the args the engine would have received. */
function harness(context: OrgScopeContext | null | undefined) {
  const calls: Call[] = [];
  const scoped = withOrgScope(new PrismaClient(), context);
  const probe = scoped.$extends(
    Prisma.defineExtension({
      name: "test-probe",
      query: {
        $allModels: {
          $allOperations({ model, operation, args }) {
            calls.push({ model, operation, args });
            return Promise.resolve(null); // short-circuit: no DB needed
          },
        },
      },
    }),
  );
  return { probe, calls, last: () => calls[calls.length - 1]?.args as Record<string, any> };
}

// Pure-function shorthand (the extension is a thin wrapper around this).
const scope = (operation: string, args: unknown, model = "Membership", organizationId = ORG) =>
  applyOrgScope({ model, operation, args, organizationId }) as Record<string, any>;

// ── §2.2 row 1: filter reads + bulk writes → AND organizationId ──────────────

describe("U-DB-01 · filter operations AND organizationId into `where`", () => {
  const FILTER_OPS = [
    "findMany",
    "findFirst",
    "findFirstOrThrow",
    "count",
    "aggregate",
    "groupBy",
    "updateMany",
    "deleteMany",
  ] as const;

  it.each(FILTER_OPS)("%s injects where.organizationId from ctx", (op) => {
    expect(scope(op, { where: { status: "active" } }).where).toEqual({
      status: "active",
      organizationId: ORG,
    });
  });

  it.each(FILTER_OPS)("%s creates `where` when the caller passed none", (op) => {
    expect(scope(op, undefined).where).toEqual({ organizationId: ORG });
    expect(scope(op, {}).where).toEqual({ organizationId: ORG });
  });

  it("keeps caller filters intact (OR/AND coexist with the injected AND)", () => {
    const out = scope("findMany", {
      where: { OR: [{ status: "active" }, { status: "invited" }] },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    expect(out.where.OR).toHaveLength(2);
    expect(out.where.organizationId).toBe(ORG);
    expect(out.take).toBe(10);
  });

  it("runs end to end through the real extension chain", async () => {
    const h = harness(ctx);
    await h.probe.membership.findMany({ where: { status: "active" } } as never);
    expect(h.last().where).toEqual({ status: "active", organizationId: ORG });
  });

  it("never mutates the caller's args object (no spooky action at a distance)", () => {
    const args = { where: { status: "active" } };
    const out = scope("findMany", args);
    expect(args).toEqual({ where: { status: "active" } });
    expect(out).not.toBe(args);
  });
});

// ── §2.2 row: findUnique/update/delete → extendedWhereUnique ─────────────────

describe("U-DB-02 (args side) · unique operations put organizationId in `where`", () => {
  const UNIQUE_OPS = ["findUnique", "findUniqueOrThrow", "update", "delete"] as const;

  it.each(UNIQUE_OPS)("%s adds organizationId next to the unique key", (op) => {
    const args = op === "update" ? { where: { id: "m1" }, data: { status: "revoked" } } : { where: { id: "m1" } };
    expect(scope(op, args).where).toEqual({ id: "m1", organizationId: ORG });
  });

  it("works with a compound unique key too", () => {
    const out = scope("findUnique", {
      where: { organizationId_userId: { organizationId: ORG, userId: "u1" } },
    });
    expect(out.where.organizationId).toBe(ORG);
    expect(out.where.organizationId_userId).toEqual({ organizationId: ORG, userId: "u1" });
  });

  it("rejects a `where` the caller did not provide (unique ops need a key)", () => {
    expect(() => scope("findUnique", {})).toThrow(OrgScopeViolationError);
    expect(() => scope("update", { data: { status: "x" } })).toThrow(OrgScopeViolationError);
  });
});

// ── §2.2 row: create / createMany / createManyAndReturn ──────────────────────

describe("U-DB-01 · create-family injects organizationId into data", () => {
  it("create injects data.organizationId", () => {
    expect(scope("create", { data: { userId: "u1", roleId: "r1" } }).data).toEqual({
      userId: "u1",
      roleId: "r1",
      organizationId: ORG,
    });
  });

  it("create accepts an explicit relation connect to the SAME org, untouched", () => {
    const out = scope("create", { data: { userId: "u1", organization: { connect: { id: ORG } } } });
    expect(out.data.organization).toEqual({ connect: { id: ORG } });
    expect(out.data.organizationId).toBeUndefined(); // both would be a Prisma error
  });

  it("create rejects a relation connect to ANOTHER org", () => {
    expect(() => scope("create", { data: { organization: { connect: { id: OTHER } } } })).toThrow(
      OrgScopeViolationError,
    );
  });

  it("create rejects a connect form it cannot prove (fail closed, never guess)", () => {
    expect(() => scope("create", { data: { organization: { connectOrCreate: {} } } })).toThrow(
      OrgScopeViolationError,
    );
  });

  it.each(["createMany", "createManyAndReturn"] as const)("%s injects into EVERY row", (op) => {
    const out = scope(op, { data: [{ userId: "u1" }, { userId: "u2", organizationId: ORG }], skipDuplicates: true });
    expect(out.data).toEqual([
      { userId: "u1", organizationId: ORG },
      { userId: "u2", organizationId: ORG },
    ]);
    expect(out.skipDuplicates).toBe(true);
  });

  it("createMany also accepts the single-object data form", () => {
    expect(scope("createMany", { data: { userId: "u1" } }).data).toEqual({ userId: "u1", organizationId: ORG });
  });

  it("createMany rejects the whole batch if ANY row targets another org", () => {
    expect(() =>
      scope("createMany", { data: [{ userId: "u1" }, { userId: "u2", organizationId: OTHER }] }),
    ).toThrow(OrgScopeViolationError);
  });

  it("create-family requires `data` (fail closed)", () => {
    expect(() => scope("create", {})).toThrow(OrgScopeViolationError);
    expect(() => scope("createMany", undefined)).toThrow(OrgScopeViolationError);
  });
});

// ── §2.2 row: upsert (M-9 — args side; DB side proven in tenancy.db.test.ts) ─

describe("U-DB-02 · upsert injects into BOTH `where` and `create`", () => {
  it("injects where + create and guards `update`", () => {
    const out = scope("upsert", {
      where: { organizationId_userId: { organizationId: ORG, userId: "u1" } },
      create: { userId: "u1", roleId: "r1" },
      update: { status: "active" },
    });
    expect(out.where.organizationId).toBe(ORG);
    expect(out.create).toEqual({ userId: "u1", roleId: "r1", organizationId: ORG });
    expect(out.update).toEqual({ status: "active" });
  });

  it("rejects an upsert whose create targets another org", () => {
    expect(() =>
      scope("upsert", { where: { id: "m1" }, create: { organizationId: OTHER }, update: {} }),
    ).toThrow(OrgScopeViolationError);
  });

  it("rejects an upsert whose update tries to move the row to another org", () => {
    expect(() =>
      scope("upsert", { where: { id: "m1" }, create: {}, update: { organizationId: OTHER } }),
    ).toThrow(OrgScopeViolationError);
  });
});

// ── §2.2 row: caller-supplied organizationId ────────────────────────────────

describe("U-DB-03 · caller-supplied organizationId is verified, never overridden", () => {
  it("passes when the caller's organizationId matches the context", () => {
    expect(scope("findMany", { where: { organizationId: ORG } }).where.organizationId).toBe(ORG);
    expect(scope("create", { data: { organizationId: ORG } }).data.organizationId).toBe(ORG);
  });

  it("accepts the `{ equals }` filter form and the `{ set }` write form when they match", () => {
    expect(scope("findMany", { where: { organizationId: { equals: ORG } } }).where.organizationId).toBe(ORG);
    expect(scope("update", { where: { id: "m1" }, data: { organizationId: { set: ORG } } }).data.organizationId).toBe(
      ORG,
    );
  });

  it.each([
    ["findMany", { where: { organizationId: OTHER } }],
    ["findFirst", { where: { organizationId: { equals: OTHER } } }],
    ["count", { where: { organizationId: OTHER } }],
    ["findUnique", { where: { id: "m1", organizationId: OTHER } }],
    ["update", { where: { id: "m1", organizationId: OTHER }, data: {} }],
    ["delete", { where: { id: "m1", organizationId: OTHER } }],
    ["updateMany", { where: { organizationId: OTHER }, data: {} }],
    ["deleteMany", { where: { organizationId: OTHER } }],
    ["create", { data: { organizationId: OTHER } }],
  ] as const)("%s with a foreign organizationId throws OrgScopeViolationError", (op, args) => {
    expect(() => scope(op, args)).toThrow(OrgScopeViolationError);
  });

  it("refuses to move an existing row to another org via `data`", () => {
    expect(() => scope("update", { where: { id: "m1" }, data: { organizationId: OTHER } })).toThrow(
      OrgScopeViolationError,
    );
    expect(() => scope("updateMany", { where: {}, data: { organizationId: { set: OTHER } } })).toThrow(
      OrgScopeViolationError,
    );
  });

  it("rejects filter shapes it cannot prove belong to the context (fail closed)", () => {
    expect(() => scope("findMany", { where: { organizationId: { in: [ORG, OTHER] } } })).toThrow(
      OrgScopeViolationError,
    );
    expect(() => scope("findMany", { where: { organizationId: { not: OTHER } } })).toThrow(OrgScopeViolationError);
    expect(() => scope("findMany", { where: { organizationId: null } })).toThrow(OrgScopeViolationError);
  });

  it("surfaces the violation through the real client as a rejected promise", async () => {
    const h = harness(ctx);
    await expect(h.probe.membership.findMany({ where: { organizationId: OTHER } } as never)).rejects.toThrow(
      OrgScopeViolationError,
    );
    expect(h.calls).toHaveLength(0); // never reached the engine
  });
});

// ── §2.1 / U-DB-04: no context = throw, on every operation ──────────────────

describe("U-DB-04 · no org context → MissingOrgContextError on every operation", () => {
  it.each([null, undefined, { organizationId: "" }, { organizationId: "   " }] as const)(
    "rejects ctx=%s at call time (not at factory time)",
    async (bad) => {
      const h = harness(bad as never);
      await expect(h.probe.membership.findMany({} as never)).rejects.toThrow(MissingOrgContextError);
      expect(h.calls).toHaveLength(0);
    },
  );

  it("throws even for org-agnostic models (fail closed — no context, no queries)", async () => {
    const h = harness(null);
    await expect(h.probe.user.findMany({} as never)).rejects.toThrow(MissingOrgContextError);
  });

  it("still constructs without throwing (the factory stays pure/IO-free)", () => {
    expect(() => withOrgScope(new PrismaClient(), null)).not.toThrow();
  });
});

// ── §2.2 C-3: org-agnostic models are deliberately untouched ────────────────

describe("U-DB-05 · org-agnostic models get NO injection (C-3 — by design, not by accident)", () => {
  it.each(ORG_AGNOSTIC_MODELS)("%s is forwarded untouched", (model) => {
    const args = { where: { id: "x" }, data: { email: "a@b.co" } };
    expect(scope("findMany", args, model)).toEqual(args);
    expect(scope("create", { data: { email: "a@b.co" } }, model)).toEqual({ data: { email: "a@b.co" } });
  });

  it("documents the consequence C-3 exists for: a nested read through User is NOT scoped", () => {
    // This is the LEAK the extension structurally cannot close (architecture
    // §2.2 C-3). It is closed by USER_SELECT (U-DB-11) + grep gate + I-35, not
    // here. Pinning it means "we know", not "it is fine".
    const args = { where: { id: "u1" }, include: { memberships: true } };
    expect(scope("findUnique", args, "User")).toEqual(args);
  });

  it("does not scope nested relation reads on org-scoped models either (same gap)", () => {
    const out = scope("findMany", { where: {}, select: { user: { select: { memberships: true } } } });
    expect(out.where).toEqual({ organizationId: ORG }); // top level IS scoped …
    expect(out.select).toEqual({ user: { select: { memberships: true } } }); // … the nested read is not
  });
});

// ── Tenant root: Organization is scoped by its own id ───────────────────────

describe("Organization (tenant root) is scoped by `id`, and cannot be created through ORG_PRISMA", () => {
  it.each(["findMany", "findFirst", "count", "aggregate", "groupBy", "updateMany", "deleteMany"] as const)(
    "%s filters id = ctx.organizationId",
    (op) => {
      expect(scope(op, {}, "Organization").where).toEqual({ id: ORG });
    },
  );

  it.each(["findUnique", "findUniqueOrThrow", "update", "delete"] as const)("%s pins where.id to the ctx org", (op) => {
    expect(scope(op, { where: { id: ORG } }, "Organization").where).toEqual({ id: ORG });
  });

  it("throws when a caller asks for a DIFFERENT organization by id", () => {
    expect(() => scope("findUnique", { where: { id: OTHER } }, "Organization")).toThrow(OrgScopeViolationError);
    expect(() => scope("findMany", { where: { id: { in: [ORG, OTHER] } } }, "Organization")).toThrow(
      OrgScopeViolationError,
    );
  });

  it("refuses create/createMany/upsert of a tenant root (that path is SYSTEM_PRISMA, §2.4)", () => {
    for (const op of ["create", "createMany", "createManyAndReturn", "upsert"]) {
      expect(() => scope(op, { data: { name: "x" } }, "Organization")).toThrow(UnsupportedOrgScopeOperationError);
    }
  });
});

// ── U-DB-07: operation coverage is complete, and stays complete ─────────────

describe("U-DB-07 · every operation Prisma supports has a DECLARED strategy", () => {
  const NON_OPERATION_KEYS = new Set(["fields", "name", "$name", "$parent"]);

  /** Every model-level operation the generated client actually exposes. */
  function clientOperations(): string[] {
    const client = new PrismaClient() as unknown as Record<string, unknown>;
    const ops = new Set<string>();
    for (const model of Prisma.dmmf.datamodel.models) {
      const key = model.name.charAt(0).toLowerCase() + model.name.slice(1);
      const delegate = client[key] as Record<string, unknown> | undefined;
      if (!delegate) continue;
      for (const k of Object.keys(delegate)) {
        if (!NON_OPERATION_KEYS.has(k) && typeof delegate[k] === "function") ops.add(k);
      }
    }
    return [...ops].sort();
  }

  it("declares a strategy for EVERY operation exposed by the generated client", () => {
    const undeclared = clientOperations().filter((op) => !(op in ORG_SCOPE_OPERATION_STRATEGY));
    // If this goes red after a Prisma upgrade: a NEW operation exists that
    // nobody has decided the org-scoping behaviour for. Decide it in
    // architecture §2.2, then add it to the map. Do not delete this test.
    expect(undeclared).toEqual([]);
  });

  it("sanity-checks the enumeration itself (a silent empty list would prove nothing)", () => {
    const ops = clientOperations();
    expect(ops).toContain("findMany");
    expect(ops).toContain("upsert");
    expect(ops.length).toBeGreaterThan(10);
  });

  it("declares nothing that does not exist, except the explicitly declared-ahead ones", () => {
    const existing = new Set(clientOperations());
    const DECLARED_AHEAD = ["updateManyAndReturn"]; // §2.2: not in Prisma 5.22
    const ghosts = Object.keys(ORG_SCOPE_OPERATION_STRATEGY).filter(
      (op) => !existing.has(op) && !DECLARED_AHEAD.includes(op),
    );
    expect(ghosts).toEqual([]);
  });

  it("keeps `updateManyAndReturn` rejected until it exists — and goes red when it does", () => {
    const exists = new Set(clientOperations()).has("updateManyAndReturn");
    if (exists) {
      // Prisma has been upgraded: implement real scoping for it (§2.2 says
      // AND where.organizationId + returned rows must belong to ctx).
      expect(ORG_SCOPE_OPERATION_STRATEGY.updateManyAndReturn).not.toBe("reject");
    } else {
      expect(ORG_SCOPE_OPERATION_STRATEGY.updateManyAndReturn).toBe("reject");
    }
  });

  it("throws UnsupportedOrgScopeOperationError for an operation outside the table", () => {
    expect(() => applyOrgScope({ model: "Membership", operation: "findSomethingNew", args: {}, organizationId: ORG })).toThrow(
      UnsupportedOrgScopeOperationError,
    );
    // Mongo-only raw operations are declared as rejected, not silently passed.
    expect(() => scope("findRaw", {})).toThrow(UnsupportedOrgScopeOperationError);
    expect(() => scope("aggregateRaw", {})).toThrow(UnsupportedOrgScopeOperationError);
  });

  it("is frozen, so nothing can widen the contract at runtime", () => {
    expect(Object.isFrozen(ORG_SCOPE_OPERATION_STRATEGY)).toBe(true);
  });
});

// ── Register coupling: an unknown model must not slip through ───────────────

describe("fail closed on models nobody classified", () => {
  it("throws UnregisteredOrgScopeModelError for a model in neither register", () => {
    expect(() => scope("findMany", {}, "FutureTenantTable")).toThrow(UnregisteredOrgScopeModelError);
  });
});
