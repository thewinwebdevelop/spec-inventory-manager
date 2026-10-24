// F-003 · T-003-B07 — COMPILE-ONLY test (U-OI-12, type half). Not a vitest
// suite: `pnpm --filter @omnistock/core-domain typecheck` compiles it (the
// package tsconfig excludes only `*.test.ts`), and an unused
// `@ts-expect-error` is itself a compile error. Pins the input contract of
// architecture §2: shapes 3/4 find memberships by `roleId`, so a membership
// WITHOUT `roleId` must not type-check, and the new shapes must name their
// role (a role change that names no role decides nothing).
import { activeOwnersAfter, type OwnerChange, type OwnerMembership } from "./owner-invariant";

export function compileOnly(): void {
  const ok: OwnerMembership = {
    userId: "u1",
    roleId: "r1",
    status: "active",
    capabilities: ["full_access"],
  };

  // @ts-expect-error — `roleId` is required on every owner membership
  const missingRoleId: OwnerMembership = { userId: "u1", status: "active", capabilities: [] };

  // @ts-expect-error — shape 3 without `roleId`
  const shape3NoRole: OwnerChange = { kind: "role_capabilities_change", newCapabilities: [] };

  // @ts-expect-error — shape 4 without `roleId`
  const shape4NoRole: OwnerChange = { kind: "role_delete" };

  // @ts-expect-error — shape 3 without `newCapabilities`
  const shape3NoCaps: OwnerChange = { kind: "role_capabilities_change", roleId: "r1" };

  activeOwnersAfter({ owners: [ok], change: { kind: "role_delete", roleId: "r1" } });
  void [missingRoleId, shape3NoRole, shape4NoRole, shape3NoCaps];
}
