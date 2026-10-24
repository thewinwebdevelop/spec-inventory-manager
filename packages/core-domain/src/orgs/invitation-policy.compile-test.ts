// F-003 · T-003-B07 — COMPILE-ONLY test (U-RB-16 / U-RB-17, type half). Not a
// vitest suite: `pnpm --filter @omnistock/core-domain typecheck` compiles it
// (the package tsconfig excludes only `*.test.ts`), and an unused
// `@ts-expect-error` is itself a compile error.
//
//  • `canAcceptInvitation` knows nothing about the inviter (U-RB-17): its input
//    has no field an inviter fact could ride in on. The D-035 re-check is a
//    separate step (`decideInviterRecheck`) that runs only after `ok`.
//  • the role is ONE field (`role | null`): "the role exists" and "these are its
//    current capabilities" cannot disagree, and the TTL leg cannot be skipped.
//  • `isElevatedRole` takes capabilities only — never a role row with a `key`.
import { canAcceptInvitation, isElevatedRole } from "./invitation-policy";

const invitation = {
  status: "pending",
  expiresAt: new Date(0),
  tokenIssuedAt: new Date(0),
} as const;

export function compileOnly(): void {
  canAcceptInvitation({
    invitation,
    membership: null,
    role: { capabilities: [] },
    now: new Date(0),
  });

  canAcceptInvitation({
    invitation,
    membership: null,
    role: { capabilities: [] },
    now: new Date(0),
    // @ts-expect-error — no inviter on the accept decision (U-RB-17)
    issuedByUserId: "u1",
  });

  canAcceptInvitation({
    invitation,
    membership: null,
    role: { capabilities: [] },
    now: new Date(0),
    // @ts-expect-error — nor the inviter's capabilities
    inviterCapabilities: ["manage_members"],
  });

  // @ts-expect-error — the current role is required (the TTL leg needs its capabilities)
  canAcceptInvitation({ invitation, membership: null, now: new Date(0) });

  canAcceptInvitation({
    invitation,
    membership: null,
    // @ts-expect-error — the F-002 boolean is gone: existence comes from `role !== null`
    roleExistsInOrg: true,
    role: null,
    now: new Date(0),
  });

  // @ts-expect-error — a role row (with `key`) is not accepted; capabilities only (U-RB-16)
  isElevatedRole({ key: "admin", capabilities: [] });
}
