// F-002 · T-002-08 — "is this an Owner role?" (pure fn, golden rule #6).
// architecture §3.2 (C-1 / D-028) · data-model §5.2.
//
// F-002 also kept the Owner-only rule here (`canAssignRole`). F-003 moved that
// rule into `rbac/member-authority.ts` (`decideMemberAuthority`, two axes —
// D-034), and T-003-B17 deleted the compat wrapper once its last call site
// (PATCH/DELETE member, after B18 moved the invitation routes) was gone: a
// wrapper that hands the rule Owner MARKERS instead of the real capability
// sets keeps F-002's answer, which is the lower → reset → raise hole
// (AC-5.4b). The static gate `no-can-assign-role.test.ts` keeps it gone.

import { CAPABILITY_FULL_ACCESS } from "../auth/capabilities";

/**
 * "This role is an Owner" == its capability list holds `full_access`
 * (data-model §5.2). Never compare `role.name` or `role.key`: F-003 lets users
 * rename roles and create custom ones, so a name/key comparison would silently
 * stop protecting a custom role that holds `full_access`.
 */
export function isOwnerRole(capabilities: readonly string[]): boolean {
  return capabilities.includes(CAPABILITY_FULL_ACCESS);
}
