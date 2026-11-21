// F-003 · T-003-B23/B24 ★ — the ONLY builders of the `data` a role create /
// update writes (G3-02 (ข) · architecture §13.2 (ข)).
//
// It takes `ValidatedCapabilities` — the brand only `validateRoleCapabilities`
// can mint — so a `string[]` straight off a request body does not compile here
// (pinned by `test/static-gates/g3-02-validated-capabilities.test.ts`). Kept in
// its own file with core-domain as its only import so that gate can compile a
// probe against it without dragging in Nest.
//
// What they never take: `key`, `isSystem`, `organizationId` (update), a
// `version` value. A created role is always `key: null` (AC-1.4) and never the
// system role (SR-07); the DB starts `version` at 1 and an update only ever
// increments it.
import type { ValidatedCapabilities } from "@omnistock/core-domain";

export interface RoleCreateDataInput {
  readonly organizationId: string;
  /** Already `validateRoleName`-normalised. */
  readonly name: string;
  readonly capabilities: ValidatedCapabilities;
  readonly actorUserId: string;
  readonly now: Date;
}

export function roleCreateData(input: RoleCreateDataInput) {
  return {
    organizationId: input.organizationId,
    name: input.name,
    key: null,
    isSystem: false,
    capabilities: [...input.capabilities],
    // AC-9.6 — the creator is the first editor ("คุณ" on their own screen).
    lastEditedAt: input.now,
    lastEditedByUserId: input.actorUserId,
  };
}

export interface RoleUpdateDataInput {
  /** Already `validateRoleName`-normalised; `null` = the name does not change. */
  readonly name: string | null;
  /** `null` = the capabilities do not change (rename-only). */
  readonly capabilities: ValidatedCapabilities | null;
  readonly actorUserId: string;
  readonly now: Date;
}

/**
 * T-003-B24 — the `data` of a REAL change (the service never calls this for a
 * no-op, U-API3-05). A rename sets `nameCustomized: true` in the same write and
 * nothing here can set it back to false (U-API3-07 · AC-1.5); every real change
 * records its editor (AC-9.6) and bumps `version` (AC-3.12 — the caller puts
 * the expected version in `where`).
 */
export function roleUpdateData(input: RoleUpdateDataInput) {
  return {
    ...(input.name !== null ? { name: input.name, nameCustomized: true as const } : {}),
    ...(input.capabilities !== null ? { capabilities: [...input.capabilities] } : {}),
    lastEditedAt: input.now,
    lastEditedByUserId: input.actorUserId,
    version: { increment: 1 },
  };
}
