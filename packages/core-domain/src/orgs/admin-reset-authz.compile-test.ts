// F-003 · T-003-B05 — COMPILE-ONLY test (U-RB-14, type half). Not a vitest
// suite: `pnpm --filter @omnistock/core-domain typecheck` compiles it (the
// package tsconfig excludes only `*.test.ts`), and an unused
// `@ts-expect-error` is itself a compile error — so the day the viewer or row
// type grows a C-2 field (the target's memberships in OTHER organizations),
// typecheck goes red. A read verdict must never be shaped by cross-org facts
// (api-spec §3.1 (3) · architecture §1 table).
import { decideAdminResetVisible } from "./admin-reset-authz";

const viewer = { userId: "v", capabilities: ["manage_members", "manage_roles"] } as const;
const row = { userId: "r", capabilities: ["manage_products"] } as const;

export function compileOnly(): void {
  decideAdminResetVisible(viewer, row);

  decideAdminResetVisible(viewer, {
    ...row,
    // @ts-expect-error — the row has no C-2 input
    targetActiveMembershipsInOtherOrgs: 1,
  });

  decideAdminResetVisible(
    // @ts-expect-error — nor does the viewer
    { ...viewer, targetActiveMembershipsInOtherOrgs: 1 },
    row,
  );
}
