// F-002 · T-002-04 — ORG_PRISMA (architecture §2.1).
//
// The provider is a SINGLETON Proxy, deliberately not `Scope.REQUEST`: request
// scope infects the whole DI chain above it (every controller/service that
// injects it becomes request-scoped) and is a trap in workers, where there is no
// request at all. So the proxy reads the ALS context per property access and
// memoizes ONE scoped client per context object.
//
// The fake client below implements just enough of Prisma's extension protocol
// to run the real `withOrgScope` extension: that way this test proves the whole
// composition (proxy → context → withOrgScope → injected args) without a DB.
import { describe, it, expect, vi } from "vitest";
import { MissingOrgContextError } from "@omnistock/db";
import { OrgContextStore } from "./org-context";
import { createOrgPrismaProxy } from "./org-prisma.provider";

type Ext = {
  query: {
    $allModels: {
      $allOperations: (p: {
        model: string;
        operation: string;
        args: Record<string, unknown>;
        query: (a: Record<string, unknown>) => unknown;
      }) => unknown;
    };
  };
};

/** A minimal stand-in for a Prisma client that honours `$extends`. */
function makeFakeClient() {
  const extendsCalls = vi.fn();
  const client = {
    $extends(arg: unknown): unknown {
      // Prisma.defineExtension({...}) hands `$extends` a callback; the callback
      // re-enters `$extends` with the plain extension object.
      if (typeof arg === "function") return (arg as (c: unknown) => unknown)(client);
      extendsCalls();
      const ext = arg as Ext;
      const run = (model: string, operation: string, args: Record<string, unknown>) =>
        ext.query.$allModels.$allOperations({ model, operation, args, query: (a) => a });
      return {
        __extended: true,
        membership: {
          findMany: (args: Record<string, unknown>) => run("Membership", "findMany", args),
        },
        $transaction: function (this: unknown, fn: (tx: unknown) => unknown) {
          return fn(this);
        },
      };
    },
  };
  return { client, extendsCalls };
}

describe("ORG_PRISMA proxy", () => {
  it("injects the ALS context's organizationId into every query", () => {
    const store = new OrgContextStore();
    const { client } = makeFakeClient();
    const orgPrisma = createOrgPrismaProxy(client, store) as {
      membership: { findMany: (a: Record<string, unknown>) => { where?: Record<string, unknown> } };
    };

    const args = store.run({ organizationId: "org_1" }, () =>
      orgPrisma.membership.findMany({ where: { status: "active" } }),
    );
    expect(args.where).toMatchObject({ organizationId: "org_1", status: "active" });
  });

  it("with NO context, touching it throws MissingOrgContextError (fail loud, never unscoped)", () => {
    const store = new OrgContextStore();
    const { client } = makeFakeClient();
    const orgPrisma = createOrgPrismaProxy(client, store) as {
      membership: { findMany: (a: Record<string, unknown>) => unknown };
    };
    expect(() => orgPrisma.membership.findMany({})).toThrow(MissingOrgContextError);
  });

  it("I-3 · the error names the model+operation so the offending call site is obvious", () => {
    const store = new OrgContextStore();
    const { client } = makeFakeClient();
    const orgPrisma = createOrgPrismaProxy(client, store) as {
      membership: { findMany: (a: Record<string, unknown>) => unknown };
    };
    expect(() => orgPrisma.membership.findMany({})).toThrow(/Membership\.findMany/);
  });

  it("memoizes ONE scoped client per context — repeated access does not re-$extends", () => {
    const store = new OrgContextStore();
    const { client, extendsCalls } = makeFakeClient();
    const orgPrisma = createOrgPrismaProxy(client, store) as Record<string, unknown>;

    store.run({ organizationId: "org_1" }, () => {
      void orgPrisma.membership;
      void orgPrisma.membership;
      void orgPrisma.membership;
    });
    expect(extendsCalls).toHaveBeenCalledTimes(1);

    store.run({ organizationId: "org_2" }, () => {
      void orgPrisma.membership;
    });
    expect(extendsCalls).toHaveBeenCalledTimes(2);
  });

  it("client-level methods keep working and stay bound to the scoped client", () => {
    const store = new OrgContextStore();
    const { client } = makeFakeClient();
    const orgPrisma = createOrgPrismaProxy(client, store) as {
      $transaction: (fn: (tx: { __extended?: boolean }) => unknown) => unknown;
    };
    const inner = store.run({ organizationId: "org_1" }, () =>
      orgPrisma.$transaction((tx) => tx.__extended),
    );
    // `this` inside $transaction must be the SCOPED client, not the bare proxy —
    // otherwise a tx would silently run unscoped (architecture §2.2 last row).
    expect(inner).toBe(true);
  });
});
