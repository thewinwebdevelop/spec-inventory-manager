import { describe, it, expect } from "vitest";
import {
  invitationTtlHours,
  isElevatedRole,
  canAcceptInvitation,
  INVITATION_TTL_HOURS_ELEVATED,
  INVITATION_TTL_HOURS_STANDARD,
  type AcceptableInvitation,
  type AcceptorMembership,
} from "./invitation-policy";

// F-002 · T-002-08b — U-CD-03 + U-CD-04 (test-plan §3) · data-model §6 ·
// architecture §7.4/§7.5 (D-027/D-028 · I-1/I-9/M-6).
//
// Two rules under test:
//   TTL   — an invitation that grants power expires fast (24h vs 7 days), keyed
//           on CAPABILITY, never on the role name/key (F-003 renames roles).
//   ACCEPT— the full decision table, INCLUDING the order the answers are given
//           in: a wrong order is a real security bug (an expired link that also
//           belongs to a revoked member must not report `superseded` and invite
//           the user to "ask for a new link" logic in the wrong branch).

const OWNER_CAPS = ["full_access"] as const;
const ADMIN_CAPS = [
  "manage_members",
  "manage_org_settings",
  "manage_products",
  "manage_stock",
  "manage_channels",
  "manage_orders",
  "view_financials",
] as const;
const STAFF_CAPS = ["manage_products", "manage_stock", "manage_orders"] as const;

describe("invitationTtlHours (U-CD-03 · D-028/I-7)", () => {
  it("gives an Owner-capable role 24 hours", () => {
    expect(invitationTtlHours(OWNER_CAPS)).toBe(24);
  });

  it("gives a role holding manage_members (without full_access) 24 hours", () => {
    expect(invitationTtlHours(ADMIN_CAPS)).toBe(24);
    expect(invitationTtlHours(["manage_members"])).toBe(24);
  });

  it("gives an ordinary role 7 days", () => {
    expect(invitationTtlHours(STAFF_CAPS)).toBe(168);
    expect(invitationTtlHours(["manage_products"])).toBe(168);
  });

  it("gives an empty capability list 7 days (no power granted → no rush)", () => {
    expect(invitationTtlHours([])).toBe(168);
  });

  it("treats an unknown capability as ordinary — never throws (U-CD-03)", () => {
    // The registry (docs/01 §2) is open-ended: future features add names here.
    // An unknown name must not crash invitation creation.
    expect(invitationTtlHours(["manage_warehouses", "some_future_capability"])).toBe(168);
  });

  it("only ever returns the two declared constants", () => {
    for (const caps of [OWNER_CAPS, ADMIN_CAPS, STAFF_CAPS, [], ["x"]]) {
      expect([INVITATION_TTL_HOURS_ELEVATED, INVITATION_TTL_HOURS_STANDARD]).toContain(
        invitationTtlHours(caps),
      );
    }
    expect(INVITATION_TTL_HOURS_ELEVATED).toBe(24);
    expect(INVITATION_TTL_HOURS_STANDARD).toBe(168);
  });

  it("does not depend on capability order and does not mutate the input", () => {
    const caps = Object.freeze(["manage_products", "manage_members"]);
    expect(invitationTtlHours(caps)).toBe(24);
    expect(caps).toEqual(["manage_products", "manage_members"]);
  });

  it("isElevatedRole is the same 'high role' predicate the TTL uses", () => {
    // data-model §5.2: "high role" == full_access OR manage_members. Exposed so
    // no call site re-derives it (that is how the C-1 hole was created).
    expect(isElevatedRole(OWNER_CAPS)).toBe(true);
    expect(isElevatedRole(["manage_members"])).toBe(true);
    expect(isElevatedRole(STAFF_CAPS)).toBe(false);
    expect(isElevatedRole([])).toBe(false);
  });
});

// --- canAcceptInvitation ------------------------------------------------

const TOKEN_ISSUED_AT = new Date("2026-08-01T00:00:00.000Z");
const EXPIRES_AT = new Date("2026-08-08T00:00:00.000Z"); // +168h
const NOW = new Date("2026-08-02T00:00:00.000Z"); // inside the window
const at = (ms: number) => new Date(EXPIRES_AT.getTime() + ms);
const issuedAt = (ms: number) => new Date(TOKEN_ISSUED_AT.getTime() + ms);

const pendingInvitation: AcceptableInvitation = {
  status: "pending",
  expiresAt: EXPIRES_AT,
  tokenIssuedAt: TOKEN_ISSUED_AT,
};

const revokedMembership = (revokedAt: Date | null): AcceptorMembership => ({
  status: "revoked",
  revokedAt,
});

const decide = (
  overrides: Partial<Parameters<typeof canAcceptInvitation>[0]> = {},
): ReturnType<typeof canAcceptInvitation> =>
  canAcceptInvitation({
    invitation: pendingInvitation,
    membership: null,
    roleExistsInOrg: true,
    now: NOW,
    ...overrides,
  });

describe("canAcceptInvitation — happy path", () => {
  it("accepts a pending, in-date invitation for a user with no membership", () => {
    expect(decide()).toBe("ok");
  });

  it("accepts one millisecond before expiry", () => {
    expect(decide({ now: at(-1) })).toBe("ok");
  });
});

describe("canAcceptInvitation — the clock (U-CD-04 · api-spec §3.15)", () => {
  it("rejects after expiry", () => {
    expect(decide({ now: at(1) })).toBe("expired");
  });

  it("rejects EXACTLY at expiresAt (boundary is <=, the safe side)", () => {
    expect(decide({ now: at(0) })).toBe("expired");
  });
});

describe("canAcceptInvitation — invitation state", () => {
  it("reports a cancelled invitation as cancelled", () => {
    expect(decide({ invitation: { ...pendingInvitation, status: "cancelled" } })).toBe("cancelled");
  });

  it("reports an already-accepted invitation as already_accepted", () => {
    expect(decide({ invitation: { ...pendingInvitation, status: "accepted" } })).toBe(
      "already_accepted",
    );
  });

  it("treats a row that somehow stores the reserved `expired` value as expired", () => {
    expect(decide({ invitation: { ...pendingInvitation, status: "expired" } })).toBe("expired");
  });
});

describe("canAcceptInvitation — role must still exist (M-6)", () => {
  it("rejects when the invitation's role was deleted or belongs to another org", () => {
    expect(decide({ roleExistsInOrg: false })).toBe("role_unavailable");
  });
});

describe("canAcceptInvitation — existing membership (I-1 / I-9)", () => {
  it("rejects an already active member without touching their role (I-9)", () => {
    expect(decide({ membership: { status: "active", revokedAt: null } })).toBe("already_member");
  });

  it("rejects a link issued BEFORE the revocation → superseded (I-1)", () => {
    // Admin pre-issues an invitation for their own address, gets revoked, then
    // walks back in. The revocation has to win.
    expect(decide({ membership: revokedMembership(issuedAt(1)) })).toBe("superseded");
  });

  it("rejects when revokedAt equals tokenIssuedAt exactly (safe side — data-model §6)", () => {
    expect(decide({ membership: revokedMembership(TOKEN_ISSUED_AT) })).toBe("superseded");
  });

  it("accepts a link issued AFTER the revocation — a deliberate re-invite (I-1)", () => {
    expect(decide({ membership: revokedMembership(issuedAt(-1)) })).toBe("ok");
  });

  it("rejects a revoked membership with no revokedAt (malformed row → fail closed)", () => {
    expect(decide({ membership: revokedMembership(null) })).toBe("superseded");
  });

  it("rejects the `invited` dead state (data-model contract summary #19)", () => {
    expect(decide({ membership: { status: "invited", revokedAt: null } })).toBe("superseded");
  });
});

describe("canAcceptInvitation — decision ORDER is part of the contract (U-CD-04)", () => {
  it("expiry wins over an existing active membership", () => {
    expect(decide({ now: at(1), membership: { status: "active", revokedAt: null } })).toBe(
      "expired",
    );
  });

  it("expiry wins over superseded and over a deleted role (3-layer case)", () => {
    expect(
      decide({
        now: at(1),
        membership: revokedMembership(issuedAt(1)),
        roleExistsInOrg: false,
      }),
    ).toBe("expired");
  });

  it("cancelled wins over already_member and role_unavailable", () => {
    expect(
      decide({
        invitation: { ...pendingInvitation, status: "cancelled" },
        membership: { status: "active", revokedAt: null },
        roleExistsInOrg: false,
      }),
    ).toBe("cancelled");
  });

  it("role_unavailable wins over already_member and superseded", () => {
    // api-spec §3.15: … → role unusable → already member → superseded.
    expect(
      decide({ roleExistsInOrg: false, membership: { status: "active", revokedAt: null } }),
    ).toBe("role_unavailable");
    expect(decide({ roleExistsInOrg: false, membership: revokedMembership(issuedAt(1)) })).toBe(
      "role_unavailable",
    );
  });

  it("already_member wins over superseded (an active row has no revokedAt to compare)", () => {
    expect(decide({ membership: { status: "active", revokedAt: issuedAt(1) } })).toBe(
      "already_member",
    );
  });
});

describe("canAcceptInvitation — purity", () => {
  it("is a function of its inputs only", () => {
    expect(decide()).toBe(decide());
    expect(decide({ now: at(1) })).not.toBe(decide());
  });

  it("does not mutate the invitation, the membership or `now`", () => {
    const invitation: AcceptableInvitation = {
      status: "pending",
      expiresAt: new Date(EXPIRES_AT),
      tokenIssuedAt: new Date(TOKEN_ISSUED_AT),
    };
    const membership = revokedMembership(new Date(TOKEN_ISSUED_AT));
    const now = new Date(NOW);
    canAcceptInvitation({ invitation, membership, roleExistsInOrg: true, now });
    expect(invitation.expiresAt.getTime()).toBe(EXPIRES_AT.getTime());
    expect(invitation.tokenIssuedAt.getTime()).toBe(TOKEN_ISSUED_AT.getTime());
    expect(membership.revokedAt?.getTime()).toBe(TOKEN_ISSUED_AT.getTime());
    expect(now.getTime()).toBe(NOW.getTime());
  });
});
