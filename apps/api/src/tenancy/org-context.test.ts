// F-002 · T-002-04 — OrgContextStore is an ADAPTER over ONE storage.
//
// The trap this file exists to catch: if apps/api kept its own
// AsyncLocalStorage, these tests could all be green while
// `lockCurrentOrganization` (packages/db · T-002-03) — the anchor that makes
// "Owner ≥ 1" and "revoke ‖ accept" hold — saw NO context and either threw or
// serialized on nothing. So every assertion below is written against
// `getOrgContext()` from `@omnistock/db`, not against the class remembering
// what it was told.
import { describe, it, expect } from "vitest";
import { getOrgContext, runWithOrgContext } from "@omnistock/db";
import { OrgContextStore } from "./org-context";

const store = new OrgContextStore();
const ctx = {
  organizationId: "org_1",
  userId: "usr_1",
  membershipId: "mem_1",
  roleId: "role_1",
  capabilities: ["manage_members"],
};

describe("OrgContextStore ↔ packages/db org context (ONE AsyncLocalStorage)", () => {
  it("returns undefined when nothing has established a context", () => {
    expect(store.get()).toBeUndefined();
    expect(getOrgContext()).toBeUndefined();
  });

  it("what the store binds IS what packages/db reads — same object, not a copy of the value", () => {
    store.run(ctx, () => {
      expect(store.get()).toBe(getOrgContext());
      expect(getOrgContext()?.organizationId).toBe("org_1");
    });
  });

  it("carries every context field the authorization layers need", () => {
    store.run(ctx, () => {
      expect(store.get()).toMatchObject({
        organizationId: "org_1",
        userId: "usr_1",
        membershipId: "mem_1",
        roleId: "role_1",
        capabilities: ["manage_members"],
      });
    });
  });

  it("a context established through packages/db is visible through the store (the other direction)", () => {
    runWithOrgContext({ organizationId: "org_from_worker" }, () => {
      expect(store.get()?.organizationId).toBe("org_from_worker");
    });
  });

  it("the context ends with its scope and survives awaits inside it", async () => {
    await store.run(ctx, async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 1));
      expect(getOrgContext()?.organizationId).toBe("org_1");
    });
    expect(store.get()).toBeUndefined();
    expect(getOrgContext()).toBeUndefined();
  });

  it("nested run() shadows and restores (the invitation-accept / worker pattern of §2.4)", () => {
    store.run(ctx, () => {
      store.run({ organizationId: "org_from_invitation" }, () => {
        expect(getOrgContext()?.organizationId).toBe("org_from_invitation");
      });
      expect(getOrgContext()?.organizationId).toBe("org_1");
    });
  });

  it("two concurrent scopes never see each other's context", async () => {
    const a = store.run({ organizationId: "org_a" }, async () => {
      await new Promise((r) => setTimeout(r, 10));
      return getOrgContext()?.organizationId;
    });
    const b = store.run({ organizationId: "org_b" }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return getOrgContext()?.organizationId;
    });
    expect(await Promise.all([a, b])).toEqual(["org_a", "org_b"]);
  });
});
