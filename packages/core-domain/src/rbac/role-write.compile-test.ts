// F-003 · T-003-B06 — COMPILE-ONLY test (U-RB-13, type half). Not a vitest
// suite: `pnpm --filter @omnistock/core-domain typecheck` compiles it (the
// package tsconfig excludes only `*.test.ts`), and an unused
// `@ts-expect-error` is itself a compile error — so the day
// `otherActiveHolders` gets a default / becomes optional, or a create may claim
// holders, typecheck goes red. The count is how D-034 Addendum + Addendum 2
// reach the role route; a call site that forgets it must not compile
// (architecture §1 row `decideRoleWrite` · §1.3).
//
// Fix round 1 (security review M-1 · L-1): `next` is REQUIRED on update and
// must be `ValidatedCapabilities` — deciding on a forgotten or unvalidated
// `next` does not compile. Fix round 2 (review L-3): rename-only is the
// sentinel `next: "unchanged"` (update only); there is no mintable brand.
import { decideRoleWrite } from "./role-write";
import { validateRoleCapabilities } from "./role-validation";

const actorCapabilities = ["manage_roles", "manage_members"] as const;
const role = { isSystem: false, capabilities: ["manage_roles"] } as const;
const raw: readonly string[] = ["manage_roles"];

export function compileOnly(): void {
  const v = validateRoleCapabilities(["manage_roles"]);
  if (!v.ok) return;
  const validated = v.capabilities;

  // controls — the well-formed calls compile
  decideRoleWrite({
    op: "update",
    actorCapabilities,
    role,
    next: validated,
    otherActiveHolders: 1,
  });
  decideRoleWrite({
    op: "update",
    actorCapabilities,
    role,
    next: "unchanged",
    otherActiveHolders: 0,
  });
  decideRoleWrite({ op: "delete", actorCapabilities, role, otherActiveHolders: 2 });
  decideRoleWrite({ op: "create", actorCapabilities, next: validated, otherActiveHolders: 0 });

  // @ts-expect-error — update without otherActiveHolders (no default 0)
  decideRoleWrite({ op: "update", actorCapabilities, role, next: validated });
  // @ts-expect-error — delete without otherActiveHolders (no default 0)
  decideRoleWrite({ op: "delete", actorCapabilities, role });
  // @ts-expect-error — update without the role it edits
  decideRoleWrite({ op: "update", actorCapabilities, next: validated, otherActiveHolders: 0 });
  // @ts-expect-error — a new role has no holder
  decideRoleWrite({ op: "create", actorCapabilities, next: validated, otherActiveHolders: 1 });
  // @ts-expect-error — unknown op
  decideRoleWrite({ op: "rename", actorCapabilities, role, otherActiveHolders: 0 });

  // M-1 — update without `next` (rename-only must pass `next: "unchanged"`)
  // @ts-expect-error — `next` is required on update
  decideRoleWrite({ op: "update", actorCapabilities, role, otherActiveHolders: 0 });
  // L-1 — an unvalidated list is not a `next`
  // @ts-expect-error — update with a raw string[]
  decideRoleWrite({ op: "update", actorCapabilities, role, next: raw, otherActiveHolders: 0 });
  // @ts-expect-error — create with a raw string[]
  decideRoleWrite({ op: "create", actorCapabilities, next: raw, otherActiveHolders: 0 });
  // @ts-expect-error — "unchanged" is not a create input (a new role has no current caps)
  decideRoleWrite({ op: "create", actorCapabilities, next: "unchanged", otherActiveHolders: 0 });
  // @ts-expect-error — only the literal "unchanged" is a sentinel
  decideRoleWrite({ op: "update", actorCapabilities, role, next: "same", otherActiveHolders: 0 });
}
