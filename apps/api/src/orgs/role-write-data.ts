// F-003 · T-003-B23 ★ — the ONE builder of the `data` a role create writes
// (G3-02 (ข) · architecture §13.2 (ข)).
//
// It takes `ValidatedCapabilities` — the brand only `validateRoleCapabilities`
// can mint — so a `string[]` straight off a request body does not compile here
// (pinned by `test/static-gates/g3-02-validated-capabilities.test.ts`). Kept in
// its own file with core-domain as its only import so that gate can compile a
// probe against it without dragging in Nest.
//
// What it never takes: `key`, `isSystem`, `version`. A created role is always
// `key: null` (AC-1.4) and never the system role (SR-07); the DB starts
// `version` at 1.
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
