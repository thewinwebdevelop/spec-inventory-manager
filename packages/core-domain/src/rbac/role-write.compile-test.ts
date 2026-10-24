// F-003 · T-003-B06 — COMPILE-ONLY test (U-RB-13, type half). Not a vitest
// suite: `pnpm --filter @omnistock/core-domain typecheck` compiles it (the
// package tsconfig excludes only `*.test.ts`), and an unused
// `@ts-expect-error` is itself a compile error — so the day
// `otherActiveHolders` gets a default / becomes optional, or a create may claim
// holders, typecheck goes red. The count is how D-034 Addendum + Addendum 2
// reach the role route; a call site that forgets it must not compile
// (architecture §1 row `decideRoleWrite` · §1.3).
import { decideRoleWrite } from "./role-write";

const actorCapabilities = ["manage_roles", "manage_members"] as const;
const role = { isSystem: false, capabilities: ["manage_roles"] } as const;

export function compileOnly(): void {
  // controls — the well-formed calls compile
  decideRoleWrite({ op: "update", actorCapabilities, role, otherActiveHolders: 1 });
  decideRoleWrite({ op: "update", actorCapabilities, role, next: [], otherActiveHolders: 0 });
  decideRoleWrite({ op: "delete", actorCapabilities, role, otherActiveHolders: 2 });
  decideRoleWrite({ op: "create", actorCapabilities, next: [], otherActiveHolders: 0 });

  // @ts-expect-error — update without otherActiveHolders (no default 0)
  decideRoleWrite({ op: "update", actorCapabilities, role });
  // @ts-expect-error — delete without otherActiveHolders (no default 0)
  decideRoleWrite({ op: "delete", actorCapabilities, role });
  // @ts-expect-error — update without the role it edits
  decideRoleWrite({ op: "update", actorCapabilities, otherActiveHolders: 0 });
  // @ts-expect-error — a new role has no holder
  decideRoleWrite({ op: "create", actorCapabilities, next: [], otherActiveHolders: 1 });
  // @ts-expect-error — unknown op
  decideRoleWrite({ op: "rename", actorCapabilities, role, otherActiveHolders: 0 });
}
