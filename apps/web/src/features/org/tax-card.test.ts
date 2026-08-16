// T-002-W4 ★ — the tier rules for the tax card (ux-wireframe §5, Q13,
// D-028/PDPA) and the D-030 onboarding inference.
import { describe, it, expect } from "vitest";
import {
  onboardingItems,
  taxCardView,
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_ORG_SETTINGS,
  type OrgProfile,
} from "./tax-card";

function profile(over: Partial<OrgProfile> = {}): OrgProfile {
  return {
    id: "org_1",
    name: "ร้านหอมกรุ่นเบเกอรี่",
    logo: null,
    timezone: "Asia/Bangkok",
    currency: "THB",
    taxProfile: null,
    taxProfileComplete: false,
    entitlement: null,
    myMembership: {
      roleId: "rol_1",
      roleName: "Staff",
      roleKey: "staff",
      capabilities: [],
      status: "active",
    },
    counts: { activeMembers: 1, pendingInvitations: 0 },
    ...over,
  };
}

const settings = new Set([CAPABILITY_MANAGE_ORG_SETTINGS]);
const none = new Set<string>();

describe("taxCardView — tiers", () => {
  it("★ without manage_org_settings, NO digits — not even the last four", () => {
    // §5 says it in bold: "ไม่แสดงตัวเลขใด ๆ แม้แต่ 4 ตัวท้าย".
    const view = taxCardView(
      profile({
        taxProfileComplete: true,
        // The server would not send this to such a caller. The point is that
        // if a future shape change did, nothing here would render it.
        taxProfile: { entityType: "company", taxIdMasked: "•••••••••4567", vatRegistered: true },
      }),
      none,
    );

    expect(view).toEqual({ kind: "summary", vatRegistered: true });
    expect(JSON.stringify(view)).not.toContain("4567");
  });

  it("with manage_org_settings, the masked number and the rest are shown", () => {
    expect(
      taxCardView(
        profile({
          taxProfileComplete: true,
          taxProfile: {
            entityType: "personal",
            taxIdMasked: "•••••••••4567",
            vatRegistered: false,
            branchCode: "00000",
          },
        }),
        settings,
      ),
    ).toEqual({
      kind: "details",
      entityType: "personal",
      taxIdMasked: "•••••••••4567",
      vatRegistered: false,
      branchCode: "00000",
    });
  });

  it("★ 'declared' comes from taxProfileComplete, never from a field's presence", () => {
    // The trap §5 names: a caller without the capability receives a
    // `taxProfile` holding only `vatRegistered`. Inferring from the absence
    // of `taxIdMasked` would tell every Staff member the shop has no tax
    // identity, which is both wrong and alarming.
    const declared = profile({
      taxProfileComplete: true,
      taxProfile: { vatRegistered: true },
    });
    expect(taxCardView(declared, none).kind).toBe("summary");

    // And the mirror: a present object with `complete: false` is still not
    // declared.
    const notDeclared = profile({
      taxProfileComplete: false,
      taxProfile: { vatRegistered: false },
    });
    expect(taxCardView(notDeclared, settings).kind).toBe("undeclared");
  });

  it("undeclared distinguishes who can act on it", () => {
    expect(taxCardView(profile(), settings)).toEqual({ kind: "undeclared", canEdit: true });
    expect(taxCardView(profile(), none)).toEqual({ kind: "undeclared", canEdit: false });
  });

  it("a null taxProfile on a complete shop does not crash the details view", () => {
    expect(taxCardView(profile({ taxProfileComplete: true, taxProfile: null }), settings)).toEqual({
      kind: "details",
      entityType: null,
      taxIdMasked: null,
      vatRegistered: null,
      branchCode: null,
    });
  });
});

describe("onboardingItems", () => {
  it("is hidden entirely from someone who cannot act on it", () => {
    expect(onboardingItems(profile(), none)).toBeNull();
  });

  it("★ D-030: the backup-owner nudge needs full_access AND being alone", () => {
    // §5's inference: I am an Owner and the only active member ⇒ this shop
    // has exactly one Owner. `GET /orgs/{orgId}` carries no Owner count, and
    // the wireframe forbids inventing one here.
    const alone = profile({ counts: { activeMembers: 1, pendingInvitations: 0 } });
    const withOwner = new Set([CAPABILITY_MANAGE_ORG_SETTINGS, CAPABILITY_FULL_ACCESS]);

    expect(onboardingItems(alone, withOwner)?.inviteBackupOwner).toBe(true);
    // An admin alone in a shop is not an Owner — nudging them would be wrong.
    expect(onboardingItems(alone, settings)?.inviteBackupOwner).toBe(false);
    // An Owner with company is no longer alone; §7 warns on S6 instead.
    const together = profile({ counts: { activeMembers: 2, pendingInvitations: 0 } });
    expect(onboardingItems(together, withOwner)?.inviteBackupOwner).toBe(false);
  });

  it("each item disappears once done, and the card with the last of them", () => {
    const done = profile({
      taxProfileComplete: true,
      counts: { activeMembers: 3, pendingInvitations: 0 },
    });
    expect(onboardingItems(done, settings)).toBeNull();

    const halfway = profile({
      taxProfileComplete: true,
      counts: { activeMembers: 1, pendingInvitations: 0 },
    });
    expect(onboardingItems(halfway, settings)).toEqual({
      inviteTeam: true,
      declareTax: false,
      inviteBackupOwner: false,
    });
  });
});

describe("★ the Owner who actually exists — `full_access` and nothing else", () => {
  // WHY THIS BLOCK EXISTS. Every case above hands in a capability list it
  // invented, and one of them hands in `{manage_org_settings, full_access}` —
  // a user no shop has ever contained. `SYSTEM_ROLE_BLUEPRINT` gives the Owner
  // role exactly one capability, `full_access`, and the server reads it as a
  // wildcard. Against that list this module answered "no" to everything, so
  // the real Owner got the read-only card: no edit, no reveal, and — the part
  // that stings — no backup-owner nudge, in a function that returned early
  // before reaching the branch written for precisely their situation.
  const ownersRole = new Set([CAPABILITY_FULL_ACCESS]);

  it("may declare the shop's tax identity", () => {
    const view = taxCardView(profile(), ownersRole);
    expect(view.kind).toBe("undeclared");
    expect(view.kind === "undeclared" && view.canEdit).toBe(true);
  });

  it("sees the details tier, which is what carries the reveal button", () => {
    const declared = profile({
      taxProfileComplete: true,
      taxProfile: {
        entityType: "company",
        taxIdMasked: "•••••••••3454",
        vatRegistered: true,
        branchCode: "00000",
      },
    } as Partial<OrgProfile>);
    expect(taxCardView(declared, ownersRole).kind).toBe("details");
  });

  it("★ gets the D-030 nudge — the branch it was written for", () => {
    const alone = profile({ counts: { activeMembers: 1, pendingInvitations: 0 } });
    expect(onboardingItems(alone, ownersRole)?.inviteBackupOwner).toBe(true);
  });
});
