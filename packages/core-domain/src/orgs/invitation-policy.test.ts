import { describe, it, expect } from "vitest";
import {
  invitationTtlHours,
  isElevatedRole,
  canAcceptInvitation,
  decideInviterRecheck,
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

/** The invitation's role as read live at accept — Staff, so the stored 168h window is the binding one. */
const STAFF_ROLE = { capabilities: STAFF_CAPS };

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
    role: STAFF_ROLE,
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
    expect(decide({ role: null })).toBe("role_unavailable");
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
        role: null,
      }),
    ).toBe("expired");
  });

  it("cancelled wins over already_member and role_unavailable", () => {
    expect(
      decide({
        invitation: { ...pendingInvitation, status: "cancelled" },
        membership: { status: "active", revokedAt: null },
        role: null,
      }),
    ).toBe("cancelled");
  });

  it("role_unavailable wins over already_member and superseded", () => {
    // api-spec §3.15: … → role unusable → already member → superseded.
    expect(decide({ role: null, membership: { status: "active", revokedAt: null } })).toBe(
      "role_unavailable",
    );
    expect(decide({ role: null, membership: revokedMembership(issuedAt(1)) })).toBe(
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
    canAcceptInvitation({ invitation, membership, role: STAFF_ROLE, now });
    expect(invitation.expiresAt.getTime()).toBe(EXPIRES_AT.getTime());
    expect(invitation.tokenIssuedAt.getTime()).toBe(TOKEN_ISSUED_AT.getTime());
    expect(membership.revokedAt?.getTime()).toBe(TOKEN_ISSUED_AT.getTime());
    expect(now.getTime()).toBe(NOW.getTime());
  });
});

// ---------------------------------------------------------------------------
// F-003 · T-003-B07 ★ — architecture §6 / §6.1 · AC-10.3 / AC-10.4 / AC-5.3 ·
// D-035 + Addendum (test-plan §2.3 U-RB-16 / U-RB-17).
// ---------------------------------------------------------------------------

const HOUR = 3_600_000;
const afterIssue = (hours: number, ms = 0) =>
  new Date(TOKEN_ISSUED_AT.getTime() + hours * HOUR + ms);

describe("U-RB-16 · isElevatedRole counts manage_roles (AC-10.3)", () => {
  it("full_access / manage_members / manage_roles are elevated", () => {
    expect(isElevatedRole(["full_access"])).toBe(true);
    expect(isElevatedRole(["manage_members"])).toBe(true);
    expect(isElevatedRole(["manage_roles"])).toBe(true);
    expect(isElevatedRole(["manage_products", "manage_roles"])).toBe(true);
  });

  it("Staff is not elevated", () => {
    expect(isElevatedRole(STAFF_CAPS)).toBe(false);
    expect(isElevatedRole(["manage_org_settings", "view_financials"])).toBe(false);
  });

  it("goes through hasCapability: full_access covers manage_roles without listing it", () => {
    // A role that holds only the wildcard is elevated because hasCapability
    // expands it — not because the fn special-cases the string.
    expect(isElevatedRole(["full_access"])).toBe(true);
    expect(invitationTtlHours(["manage_roles"])).toBe(INVITATION_TTL_HOURS_ELEVATED);
  });

  it("never reads the role key: key='admin' with Staff capabilities is NOT elevated", () => {
    const adminKeyedStaffRole = { key: "admin", name: "ผู้ดูแล", capabilities: STAFF_CAPS };
    expect(isElevatedRole(adminKeyedStaffRole.capabilities)).toBe(false);
    expect(invitationTtlHours(adminKeyedStaffRole.capabilities)).toBe(
      INVITATION_TTL_HOURS_STANDARD,
    );
  });
});

describe("U-RB-17 · canAcceptInvitation expiry = min(expiresAt, tokenIssuedAt + ttl(current caps)) (AC-10.4)", () => {
  // Issued while the role was Staff ⇒ stored expiresAt = issued + 168h.
  const issuedAsStaff: AcceptableInvitation = {
    status: "pending",
    tokenIssuedAt: TOKEN_ISSUED_AT,
    expiresAt: afterIssue(168),
  };
  // Issued while the role was elevated ⇒ stored expiresAt = issued + 24h.
  const issuedAsElevated: AcceptableInvitation = { ...issuedAsStaff, expiresAt: afterIssue(24) };

  it("role became elevated after the link went out — accepted 30h later ⇒ expired", () => {
    expect(
      canAcceptInvitation({
        invitation: issuedAsStaff,
        membership: null,
        role: { capabilities: ["manage_products", "manage_roles"] },
        now: afterIssue(30),
      }),
    ).toBe("expired");
  });

  it("control: the SAME link with the role still Staff is accepted at 30h", () => {
    expect(
      canAcceptInvitation({
        invitation: issuedAsStaff,
        membership: null,
        role: { capabilities: STAFF_CAPS },
        now: afterIssue(30),
      }),
    ).toBe("ok");
  });

  it("elevated window boundary: ok 1ms before tokenIssuedAt + 24h, expired exactly at it", () => {
    const elevated = { capabilities: ["manage_members"] };
    const at = (ms: number) =>
      canAcceptInvitation({
        invitation: issuedAsStaff,
        membership: null,
        role: elevated,
        now: afterIssue(24, ms),
      });
    expect(at(-1)).toBe("ok");
    expect(at(0)).toBe("expired");
  });

  it("a role reduced after issue does NOT extend the link (stored 24h still binds)", () => {
    expect(
      canAcceptInvitation({
        invitation: issuedAsElevated,
        membership: null,
        role: { capabilities: STAFF_CAPS },
        now: afterIssue(30),
      }),
    ).toBe("expired");
  });

  it("the clock-derived expiry still comes first in the decision order", () => {
    // Shortened-window expiry beats already_member, exactly like stored expiry.
    expect(
      canAcceptInvitation({
        invitation: issuedAsStaff,
        membership: { status: "active", revokedAt: null },
        role: { capabilities: ["full_access"] },
        now: afterIssue(30),
      }),
    ).toBe("expired");
  });

  it("terminal states are not rewritten by the shortened window", () => {
    expect(
      canAcceptInvitation({
        invitation: { ...issuedAsStaff, status: "cancelled" },
        membership: null,
        role: { capabilities: ["manage_roles"] },
        now: afterIssue(30),
      }),
    ).toBe("cancelled");
  });

  it("knows nothing about the inviter (type half in invitation-policy.compile-test.ts)", () => {
    // Same inputs ⇒ same answer; the input type carries no inviter field, so
    // the inviter re-check cannot leak into this decision.
    const input = {
      invitation: issuedAsStaff,
      membership: null,
      role: STAFF_ROLE,
      now: afterIssue(1),
    } as const;
    expect(Object.keys(input).sort()).toEqual(["invitation", "membership", "now", "role"]);
    expect(canAcceptInvitation(input)).toBe("ok");
  });
});

describe("D-035 + Addendum · decideInviterRecheck maps each failing leg to its own inviter_* reason", () => {
  const OWNER = { capabilities: OWNER_CAPS };
  const ADMIN = { capabilities: ADMIN_CAPS };
  const STAFF = { capabilities: STAFF_CAPS };

  it("no active membership for the issuer (removed / left / deleted / both ids null) ⇒ inviter_not_active", () => {
    expect(decideInviterRecheck({ inviter: null, invitationRoleCapabilities: STAFF_CAPS })).toBe(
      "inviter_not_active",
    );
  });

  it("issuer no longer holds manage_members ⇒ inviter_not_authorized, even when caps ⊇ the role (P2)", () => {
    expect(
      decideInviterRecheck({
        inviter: { capabilities: [...STAFF_CAPS, "view_financials"] },
        invitationRoleCapabilities: STAFF_CAPS,
      }),
    ).toBe("inviter_not_authorized");
  });

  it("missing manage_members wins over exceeding (floor is checked first)", () => {
    expect(decideInviterRecheck({ inviter: STAFF, invitationRoleCapabilities: ADMIN_CAPS })).toBe(
      "inviter_not_authorized",
    );
  });

  it("issuer holds manage_members but the role exceeds them ⇒ inviter_exceeds", () => {
    expect(
      decideInviterRecheck({
        inviter: { capabilities: ["manage_members"] },
        invitationRoleCapabilities: ADMIN_CAPS,
      }),
    ).toBe("inviter_exceeds");
  });

  it("non-Owner issuer of an Owner invitation (owner_only) ⇒ inviter_exceeds", () => {
    expect(decideInviterRecheck({ inviter: ADMIN, invitationRoleCapabilities: OWNER_CAPS })).toBe(
      "inviter_exceeds",
    );
  });

  it("Owner issuer always passes (any role, including Owner)", () => {
    for (const role of [OWNER_CAPS, ADMIN_CAPS, STAFF_CAPS, ["some_future_capability"]]) {
      expect(decideInviterRecheck({ inviter: OWNER, invitationRoleCapabilities: role })).toBe("ok");
    }
  });

  it("grant ⊆ is not strict: an Admin's Admin invitation and Staff invitation pass", () => {
    expect(decideInviterRecheck({ inviter: ADMIN, invitationRoleCapabilities: ADMIN_CAPS })).toBe(
      "ok",
    );
    expect(decideInviterRecheck({ inviter: ADMIN, invitationRoleCapabilities: STAFF_CAPS })).toBe(
      "ok",
    );
  });

  it("an unknown key on the invitation's role fails closed for a non-Owner issuer", () => {
    expect(
      decideInviterRecheck({
        inviter: ADMIN,
        invitationRoleCapabilities: ["manage_products", "some_future_capability"],
      }),
    ).toBe("inviter_exceeds");
  });
});
