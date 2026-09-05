// F-002 · T-002-16 — the profile mapper + patch validation.
// api-spec §3.2 (M-10) · §3.3 (D-028/I-8 + ux Q13) · §3.4 (M-4).
import { describe, it, expect } from "vitest";
import {
  ORG_LOGO_UNSUPPORTED_MESSAGE,
  isTaxProfileComplete,
  toMyOrganizationItem,
  toOrgProfileView,
  toTaxProfileView,
  validateOrgProfilePatch,
  type OrgProfileRow,
  type OrgProfileViewer,
} from "./org-profile";
import {
  ORG_NAME_MAX_LENGTH,
  ORG_NAME_REQUIRED_MESSAGE,
  ORG_NAME_TOO_LONG_MESSAGE,
  ORG_TIMEZONE_INVALID_MESSAGE,
} from "./org-provisioning";
import {
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_MEMBERS,
  CAPABILITY_MANAGE_ORG_SETTINGS,
} from "../auth/capabilities";

const TAX_ID = "0105551234567";

const declaredOrg: OrgProfileRow = {
  id: "org_1",
  name: "ร้าน ก",
  logo: null,
  timezone: "Asia/Bangkok",
  currency: "THB",
  taxEntityType: "company",
  taxId: TAX_ID,
  vatRegistered: true,
  taxBranchCode: "00000",
};

const blankOrg: OrgProfileRow = {
  ...declaredOrg,
  taxEntityType: null,
  taxId: null,
  vatRegistered: null,
  taxBranchCode: null,
};

function viewer(capabilities: readonly string[], over: Partial<OrgProfileViewer> = {}): OrgProfileViewer {
  return {
    userId: "usr_1",
    roleId: "rol_1",
    roleName: "Owner",
    roleKey: "owner",
    capabilities,
    status: "active",
    ...over,
  };
}

// ── §3.4 PATCH validation ──────────────────────────────────────────────────

describe("validateOrgProfilePatch — api-spec §3.4", () => {
  it("an EMPTY patch is a valid no-op", () => {
    expect(validateOrgProfilePatch({})).toEqual({ ok: true, value: {} });
  });

  it("accepts a trimmed name", () => {
    expect(validateOrgProfilePatch({ name: "  ร้านใหม่ " })).toEqual({
      ok: true,
      value: { name: "ร้านใหม่" },
    });
  });

  it("rejects an empty / over-long name with the same copy as create", () => {
    const empty = validateOrgProfilePatch({ name: "   " });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.fieldErrors).toEqual({ name: ORG_NAME_REQUIRED_MESSAGE });

    const long = validateOrgProfilePatch({ name: "ก".repeat(ORG_NAME_MAX_LENGTH + 1) });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.fieldErrors).toEqual({ name: ORG_NAME_TOO_LONG_MESSAGE });
  });

  it("★ M-4: `logo: null` is accepted — it is the ONLY accepted value", () => {
    expect(validateOrgProfilePatch({ logo: null })).toEqual({ ok: true, value: { logo: null } });
  });

  it.each([
    "https://evil.example/pixel.gif",
    "http://localhost/internal",
    "s3://our-bucket/key",
    "logo-key-that-looks-like-ours",
    "",
    42,
    {},
  ])("★ M-4: rejects logo=%s (tracking pixel / SSRF surface)", (logo) => {
    const result = validateOrgProfilePatch({ logo });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors).toEqual({ logo: ORG_LOGO_UNSUPPORTED_MESSAGE });
  });

  it("accepts a known timezone and rejects an unknown one", () => {
    expect(validateOrgProfilePatch({ timezone: "Asia/Tokyo" })).toEqual({
      ok: true,
      value: { timezone: "Asia/Tokyo" },
    });
    const bad = validateOrgProfilePatch({ timezone: "Mars/Olympus" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.fieldErrors).toEqual({ timezone: ORG_TIMEZONE_INVALID_MESSAGE });
  });

  it("refuses to null out name/timezone (no such state)", () => {
    expect(validateOrgProfilePatch({ name: null }).ok).toBe(false);
    expect(validateOrgProfilePatch({ timezone: null }).ok).toBe(false);
  });

  it("reports every bad field at once", () => {
    const result = validateOrgProfilePatch({ name: "", logo: "x", timezone: "Nowhere" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors).sort()).toEqual(["logo", "name", "timezone"]);
  });

  it("★ a rejected patch yields NO writable value at all (partial writes are impossible)", () => {
    // If this ever returned `{ ok:false, value:{ name } }` a caller could write
    // the half that validated. There is no `value` on the failure branch.
    const result = validateOrgProfilePatch({ name: "ok name", logo: "https://evil/x.png" });
    expect(result.ok).toBe(false);
    expect(result as { value?: unknown }).not.toHaveProperty("value");
  });
});

// ── §3.3 field-level authorization ─────────────────────────────────────────

describe("toTaxProfileView — the three tiers of api-spec §3.3", () => {
  it("manage_org_settings → entityType + masked TIN + vat + branch", () => {
    expect(toTaxProfileView(declaredOrg, viewer([CAPABILITY_MANAGE_ORG_SETTINGS]))).toEqual({
      entityType: "company",
      taxIdMasked: "•••••••••4567",
      vatRegistered: true,
      branchCode: "00000",
    });
  });

  it("full_access implies it (Owner sees the same)", () => {
    expect(toTaxProfileView(declaredOrg, viewer([CAPABILITY_FULL_ACCESS]))).toHaveProperty("taxIdMasked");
  });

  it("★ ux Q13: a Staff member gets `vatRegistered` and NOTHING else", () => {
    const view = toTaxProfileView(declaredOrg, viewer(["manage_products"]));
    expect(view).toEqual({ vatRegistered: true });
    expect(view).not.toHaveProperty("taxIdMasked");
    expect(view).not.toHaveProperty("entityType");
    expect(view).not.toHaveProperty("branchCode");
  });

  it("★ manage_members alone does NOT unlock the tax profile", () => {
    // D-028 put the TIN behind `manage_org_settings` specifically. Someone who
    // may manage people must not thereby see the owner's national ID.
    expect(toTaxProfileView(declaredOrg, viewer([CAPABILITY_MANAGE_MEMBERS]))).toEqual({
      vatRegistered: true,
    });
  });

  it("★ the FULL tax id never appears, at any tier", () => {
    for (const caps of [[CAPABILITY_FULL_ACCESS], [CAPABILITY_MANAGE_ORG_SETTINGS], ["manage_products"], []]) {
      expect(JSON.stringify(toTaxProfileView(declaredOrg, viewer(caps)))).not.toContain(TAX_ID);
    }
  });

  it("returns null when nothing was declared — for every tier", () => {
    expect(toTaxProfileView(blankOrg, viewer([CAPABILITY_FULL_ACCESS]))).toBeNull();
    expect(toTaxProfileView(blankOrg, viewer([]))).toBeNull();
  });

  it("a personal TIN is masked identically (it IS a national ID)", () => {
    const personal = { ...declaredOrg, taxEntityType: "personal", taxId: "1234567890123" };
    const view = toTaxProfileView(personal, viewer([CAPABILITY_MANAGE_ORG_SETTINGS]));
    expect(view?.taxIdMasked).toBe("•••••••••0123");
  });
});

describe("isTaxProfileComplete", () => {
  it("true only when entityType + taxId + vatRegistered are all present", () => {
    expect(isTaxProfileComplete(declaredOrg)).toBe(true);
    expect(isTaxProfileComplete({ ...declaredOrg, taxId: null })).toBe(false);
    expect(isTaxProfileComplete({ ...declaredOrg, vatRegistered: null })).toBe(false);
    expect(isTaxProfileComplete({ ...declaredOrg, taxEntityType: "  " })).toBe(false);
    expect(isTaxProfileComplete(blankOrg)).toBe(false);
  });

  it("`vatRegistered: false` still counts as declared", () => {
    expect(isTaxProfileComplete({ ...declaredOrg, vatRegistered: false })).toBe(true);
  });
});

describe("toOrgProfileView", () => {
  const counts = { activeMembers: 4, pendingInvitations: 1 };

  it("assembles the §3.3 body for a privileged viewer", () => {
    const view = toOrgProfileView({
      organization: declaredOrg,
      viewer: viewer([CAPABILITY_FULL_ACCESS]),
      entitlement: { planKey: "comp_full", tierLabel: "Full (comp)" },
      counts,
    });
    expect(view).toEqual({
      id: "org_1",
      name: "ร้าน ก",
      logo: null,
      timezone: "Asia/Bangkok",
      currency: "THB",
      taxProfile: {
        entityType: "company",
        taxIdMasked: "•••••••••4567",
        vatRegistered: true,
        branchCode: "00000",
      },
      taxProfileComplete: true,
      entitlement: { planKey: "comp_full", tierLabel: "Full (comp)" },
      myMembership: {
        roleId: "rol_1",
        roleName: "Owner",
        roleKey: "owner",
        capabilities: [CAPABILITY_FULL_ACCESS],
        status: "active",
      },
      counts,
    });
  });

  it("★ `taxProfileComplete` is true even for the viewer who sees no numbers", () => {
    // The contract to FE: never infer "not declared" from a missing
    // `taxIdMasked` — this is the case that would break that inference.
    const view = toOrgProfileView({
      organization: declaredOrg,
      viewer: viewer(["manage_products"], { roleName: "Staff", roleKey: "staff" }),
      entitlement: null,
      counts,
    });
    expect(view.taxProfileComplete).toBe(true);
    expect(view.taxProfile).toEqual({ vatRegistered: true });
  });

  it("★ never emits a member LIST — counts only (PDPA)", () => {
    const view = toOrgProfileView({
      organization: declaredOrg,
      viewer: viewer([CAPABILITY_FULL_ACCESS]),
      entitlement: null,
      counts,
    });
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("members\":[");
    expect(view.counts).toEqual(counts);
  });
});

// ── §3.2 the org switcher ──────────────────────────────────────────────────

describe("toMyOrganizationItem — api-spec §3.2 / M-10", () => {
  const org = { id: "org_1", name: "ร้าน ก", logo: null };
  const entitlement = { planKey: "comp_full", tierLabel: "Full (comp)" };

  it("an active membership gets the full shape", () => {
    expect(
      toMyOrganizationItem({
        organization: org,
        membership: {
          status: "active",
          roleId: "rol_1",
          roleName: "Owner",
          roleKey: "owner",
          revokedAt: null,
        },
        entitlement,
      }),
    ).toEqual({
      organization: org,
      membership: { roleId: "rol_1", roleName: "Owner", roleKey: "owner", status: "active" },
      entitlement,
    });
  });

  it.each(["revoked", "invited"])("★ M-10: a `%s` membership gets the SHORT shape only", (status) => {
    const revokedAt = new Date("2026-07-28T09:00:00.000Z");
    const item = toMyOrganizationItem({
      organization: org,
      membership: { status, roleId: "rol_1", roleName: "Owner", roleKey: "owner", revokedAt },
      entitlement,
    });
    expect(item).toEqual({
      organization: org,
      membership: { status, revokedAt: "2026-07-28T09:00:00.000Z" },
    });
    // The role they held and the plan that shop is on are internals of an org
    // they are no longer part of.
    expect(JSON.stringify(item)).not.toContain("rol_1");
    expect(JSON.stringify(item)).not.toContain("comp_full");
  });

  it("★ M-10: a WIDER organization row is projected down — extras never survive", () => {
    // The existing cases all pass an org object that is already narrow, so they
    // prove the mapper keeps what it is given, not that it DROPS what it is not
    // supposed to pass on. TypeScript accepts a wider object structurally and
    // strips nothing at runtime, so before this the guarantee held only while
    // every caller's Prisma `select` stayed narrow — widen one somewhere else
    // (add `taxId` for another screen) and a removed member's `?status=all` row
    // would quietly start carrying the shop's tax id.
    const wide = {
      ...org,
      taxId: "1234567890123",
      taxEntityType: "company",
      planKey: "comp_full",
      createdByUserId: "usr_owner",
    } as unknown as typeof org;

    for (const status of ["revoked", "active"]) {
      const item = toMyOrganizationItem({
        organization: wide,
        membership: { status, roleId: "rol_1", roleName: "Owner", roleKey: "owner", revokedAt: null },
        entitlement,
      });
      expect(item.organization, status).toEqual({ id: "org_1", name: "ร้าน ก", logo: null });
      const serialized = JSON.stringify(item);
      // The PDPA-sensitive one by name: this is the field a whole endpoint
      // (`POST …/tax-profile/reveal`) plus its own rate limit exists to fence.
      expect(serialized, status).not.toContain("1234567890123");
      expect(serialized, status).not.toContain("usr_owner");
    }
  });

  it("a revoked row with no timestamp emits `revokedAt: null`, never undefined", () => {
    const item = toMyOrganizationItem({
      organization: org,
      membership: { status: "revoked", roleId: "r", roleName: "n", roleKey: null, revokedAt: null },
      entitlement,
    });
    expect(item).toEqual({ organization: org, membership: { status: "revoked", revokedAt: null } });
  });
});
