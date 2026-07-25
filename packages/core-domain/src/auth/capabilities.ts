// F-001 · T-001-01 / T-001-07 — capability constants (single source of truth).
// api-spec §2.8 step 1: F-001 defines CAPABILITY_MANAGE_MEMBERS as THE string
// constant for the admin-reset capability. F-003 reuses this constant; it does
// NOT redefine it. Living in core-domain (pure, framework-free) keeps it shared
// between the F-001 inline check and the future F-003 guard without either
// hard-coding the literal.
//
// The capability registry (docs/01-data-model.md §Tenancy & Auth) is open-ended;
// F-001 only needs the one it enforces. Others are added as their features land.

/** Capability required to reset a member's password (admin-reset, api-spec §2.8). */
export const CAPABILITY_MANAGE_MEMBERS = "manage_members" as const;

/** Full-access capability (Owner). Present so a capability check can honor the
 *  system Owner role without listing every capability (F-000 Role.isSystem). */
export const CAPABILITY_FULL_ACCESS = "full_access" as const;

/**
 * Pure capability check: does a role's capability list grant `required`?
 * `full_access` is a wildcard that grants everything (the system Owner role).
 * Used by the admin-reset inline check (api-spec §2.8 step 2) and, later, F-003.
 */
export function hasCapability(
  capabilities: readonly string[],
  required: string,
): boolean {
  return capabilities.includes(CAPABILITY_FULL_ACCESS) || capabilities.includes(required);
}
