// F-002 · T-002-19 — the invitation projection (api-spec §3.10).
import { describe, it, expect } from "vitest";
import {
  acceptedUserCreatedAfterInvite,
  invitationExpiryFrom,
  toInvitationRow,
  userCreatedAfterTokenIssued,
} from "./invitation-view";

const CREATED = new Date("2026-07-28T09:00:00.000Z");
const ISSUED = new Date("2026-07-30T09:00:00.000Z");
const EXPIRES = new Date("2026-08-04T09:00:00.000Z");

const source = {
  id: "inv_1",
  email: "new@example.com",
  roleId: "rol_1",
  status: "pending" as const,
  expiresAt: EXPIRES,
  tokenIssuedAt: ISSUED,
  invitedByUserId: "usr_inviter",
  createdAt: CREATED,
  acceptedAt: null,
  acceptedByUserId: null,
  acceptedUserCreatedAt: null,
};

const role = {
  name: "Staff",
  key: "staff",
  nameCustomized: false,
  capabilities: ["manage_products"],
};
/** A viewer outside every verdict audience (no manage_members). */
const NO_VERDICT: readonly string[] = [];

describe("toInvitationRow", () => {
  it("projects the documented fields, as ISO strings", () => {
    expect(toInvitationRow(source, role, NO_VERDICT)).toEqual({
      id: "inv_1",
      email: "new@example.com",
      roleId: "rol_1",
      roleName: "Staff",
      roleKey: "staff",
      status: "pending",
      expiresAt: EXPIRES.toISOString(),
      tokenIssuedAt: ISSUED.toISOString(),
      invitedByUserId: "usr_inviter",
      createdAt: CREATED.toISOString(),
      acceptedAt: null,
      acceptedByUserId: null,
      acceptedUserCreatedAfterInvite: null,
      roleNameCustomized: false,
    });
  });

  it("★ a WIDER row is projected down — a tokenHash can never ride along", () => {
    // The table this comes from has a `tokenHash` column, and TypeScript accepts
    // a wider object structurally while stripping nothing at runtime. If this
    // mapper spread its input, widening a `select` anywhere would put the hash
    // on the wire with no test going red (the M-10 lesson).
    const wide = {
      ...source,
      tokenHash: "6f1e2c9a".repeat(8),
      cancelledAt: new Date(),
      updatedAt: new Date(),
    } as unknown as typeof source;

    const row = toInvitationRow(wide, role, NO_VERDICT);
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain("6f1e2c9a");
    expect(Object.keys(row).sort()).toEqual(
      [
        "acceptedAt",
        "acceptedByUserId",
        "acceptedUserCreatedAfterInvite",
        "createdAt",
        "email",
        "expiresAt",
        "id",
        "invitedByUserId",
        "roleId",
        "roleKey",
        "roleName",
        "roleNameCustomized",
        "status",
        "tokenIssuedAt",
      ].sort(),
    );
  });

  it("`expiresAt` is present on accepted and cancelled rows too (ux Q14)", () => {
    // The UI renders "expires in about N hours" from this field unconditionally.
    // A null here would force it to guess, on exactly the rows where the answer
    // is already known.
    for (const status of ["accepted", "cancelled", "expired"] as const) {
      const row = toInvitationRow({ ...source, status }, role, NO_VERDICT);
      expect(row.expiresAt, status).toBe(EXPIRES.toISOString());
    }
  });
});

describe("acceptedUserCreatedAfterInvite (NEW-9)", () => {
  it("is null while nobody has accepted — 'unknown' is not 'no'", () => {
    expect(
      acceptedUserCreatedAfterInvite({ createdAt: CREATED, acceptedUserCreatedAt: null }),
    ).toBeNull();
  });

  it("is true when the account was created after the invitation FIRST existed", () => {
    expect(
      acceptedUserCreatedAfterInvite({
        createdAt: CREATED,
        acceptedUserCreatedAt: new Date(CREATED.getTime() + 1000),
      }),
    ).toBe(true);
  });

  it("is false for an account that already existed", () => {
    expect(
      acceptedUserCreatedAfterInvite({
        createdAt: CREATED,
        acceptedUserCreatedAt: new Date(CREATED.getTime() - 1000),
      }),
    ).toBe(false);
  });

  it("★ compares against createdAt, NOT tokenIssuedAt — reissue must not erase the signal", () => {
    // The bug NEW-9 fixed: with `tokenIssuedAt` as the baseline, pressing
    // "reissue link" (which sets it to now) flipped this to false and wiped the
    // only forensic signal Phase 0 has about a leaked link being claimed by a
    // freshly-made account.
    const accountMadeAfterInviteButBeforeReissue = new Date("2026-07-29T09:00:00.000Z");
    expect(ISSUED.getTime()).toBeGreaterThan(accountMadeAfterInviteButBeforeReissue.getTime());

    const row = toInvitationRow(
      { ...source, acceptedUserCreatedAt: accountMadeAfterInviteButBeforeReissue },
      role,
      NO_VERDICT,
    );
    // true because the account postdates `createdAt`. Against `tokenIssuedAt`
    // it would read false — the erasure this test exists to prevent.
    expect(row.acceptedUserCreatedAfterInvite).toBe(true);
  });
});

// F-003 · T-003-B22 ★ — `Invitation.viewerCanManage` (api-spec §3.1 · §4.2b).
describe("toInvitationRow — F-003 viewer verdict", () => {
  const ADMIN = ["manage_members", "manage_products"];
  const OWNER_ROLE = {
    name: "Owner",
    key: "owner",
    nameCustomized: false,
    capabilities: ["full_access"],
  };

  it("manage_members viewer + stored pending (live or expired): verdict present", () => {
    for (const status of ["pending", "expired"] as const) {
      expect(toInvitationRow({ ...source, status }, role, ADMIN), status).toMatchObject({
        viewerCanManage: true,
        manageBlockedReason: null,
      });
    }
  });

  it("Owner invitation viewed by an Admin → owner_only; wider role → exceeds_your_permissions", () => {
    expect(toInvitationRow(source, OWNER_ROLE, ADMIN)).toMatchObject({
      viewerCanManage: false,
      manageBlockedReason: "owner_only",
    });
    const wider = { ...role, capabilities: ["manage_products", "manage_billing"] };
    expect(toInvitationRow(source, wider, ADMIN)).toMatchObject({
      viewerCanManage: false,
      manageBlockedReason: "exceeds_your_permissions",
    });
  });

  it("accepted / cancelled rows, or a viewer without manage_members: keys ABSENT", () => {
    for (const status of ["accepted", "cancelled"] as const) {
      expect(Object.keys(toInvitationRow({ ...source, status }, role, ADMIN))).not.toContain(
        "viewerCanManage",
      );
    }
    const keys = Object.keys(toInvitationRow(source, role, ["manage_roles"]));
    expect(keys).not.toContain("viewerCanManage");
    expect(keys).not.toContain("manageBlockedReason");
  });

  it("never projects the role's capabilities", () => {
    expect(JSON.stringify(toInvitationRow(source, OWNER_ROLE, ADMIN))).not.toContain("full_access");
  });

  it("roleNameCustomized: custom role (key null) is always customized", () => {
    expect(toInvitationRow(source, { ...role, key: null }, NO_VERDICT).roleNameCustomized).toBe(
      true,
    );
    expect(
      toInvitationRow(source, { ...role, nameCustomized: true }, NO_VERDICT).roleNameCustomized,
    ).toBe(true);
  });
});

describe("userCreatedAfterTokenIssued (T-002-20 — the AUDIT-side comparison)", () => {
  it("★ is a DIFFERENT question from the wire flag, and gives a different answer", () => {
    // Same invitation, same account: created after `createdAt` (so the wire flag
    // is true) but before the link was rotated (so the event flag is false).
    // Collapsing the two would either break NEW-9 or make the log line lie about
    // which link was outstanding when the account appeared.
    const accountCreatedAt = new Date("2026-07-29T09:00:00.000Z");
    expect(
      acceptedUserCreatedAfterInvite({
        createdAt: CREATED,
        acceptedUserCreatedAt: accountCreatedAt,
      }),
    ).toBe(true);
    expect(userCreatedAfterTokenIssued(accountCreatedAt, ISSUED)).toBe(false);
  });

  it("is true for an account made after the current link was handed out", () => {
    expect(userCreatedAfterTokenIssued(new Date(ISSUED.getTime() + 1), ISSUED)).toBe(true);
  });

  it("the exact instant is NOT after (strict boundary)", () => {
    expect(userCreatedAfterTokenIssued(new Date(ISSUED.getTime()), ISSUED)).toBe(false);
  });
});

describe("invitationExpiryFrom", () => {
  it("adds the TTL to the caller's clock (no fake timers anywhere)", () => {
    expect(invitationExpiryFrom(CREATED, 24).toISOString()).toBe("2026-07-29T09:00:00.000Z");
    expect(invitationExpiryFrom(CREATED, 168).toISOString()).toBe("2026-08-04T09:00:00.000Z");
  });
});
