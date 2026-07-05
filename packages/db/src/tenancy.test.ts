// F-000 · T-000-08 — unit tests for the `withOrgScope` org-scope SEAM STUB.
// Golden rule 3 / architecture.md §5: F-000 ships a pass-through only. These
// tests assert the stub forwards every query untouched — no
// `organizationId` filter is injected yet, and no DB connection is required
// (Prisma's `$extends` composition is testable without `$connect`).

import { describe, expect, it } from "vitest";
import { PrismaClient } from "./generated/client";
import { withOrgScope } from "./tenancy";

describe("withOrgScope (F-000 pass-through stub)", () => {
  it("returns an extended client that forwards query args untouched", async () => {
    const base = new PrismaClient();
    const scoped = withOrgScope(base, { organizationId: "org_123" });

    const receivedArgs: unknown[] = [];
    const probe = scoped.$extends({
      name: "test-probe",
      query: {
        $allModels: {
          $allOperations({ args, query: _query }) {
            receivedArgs.push(args);
            // Short-circuit before hitting a real DB — we only care that
            // withOrgScope did not mutate `args` on the way through.
            return Promise.resolve(undefined);
          },
        },
      },
    });

    const inputArgs = { where: { id: "abc" } };
    await probe.stockLevel.findFirst(inputArgs as never);

    expect(receivedArgs).toHaveLength(1);
    // Pass-through stub: no organizationId injected into where clause.
    expect(receivedArgs[0]).toMatchObject({ where: { id: "abc" } });
    expect(
      (receivedArgs[0] as { where?: Record<string, unknown> }).where?.organizationId,
    ).toBeUndefined();
  });

  it("does not throw when constructing the scoped client (pure factory, no I/O)", () => {
    const base = new PrismaClient();
    expect(() => withOrgScope(base, { organizationId: "org_1" })).not.toThrow();
  });
});
