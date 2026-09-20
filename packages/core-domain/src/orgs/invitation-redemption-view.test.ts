// F-002 · T-002-20 ★ — the two projections a stranger can reach (api-spec
// §3.14/§3.15).
//
// The assertions that matter here are the NEGATIVE ones: an exact key set, and
// "the full address / the organizationId is nowhere in the serialized body".
// A test that only checked the fields it expected would stay green the day a
// mapper started spreading its input.
import { describe, it, expect } from "vitest";
import { MaskEmailError } from "./invitation-email";
import {
  toInvitationPreview,
  toInvitationAcceptResult,
  type InvitationPreviewSource,
} from "./invitation-redemption-view";

const EXPIRES = new Date("2026-08-12T09:00:00.000Z");

function previewSource(over: Partial<InvitationPreviewSource> = {}): InvitationPreviewSource {
  return {
    organizationName: "ร้าน A",
    roleName: "Staff",
    roleKey: "staff",
    email: "napa@example.com",
    expiresAt: EXPIRES,
    status: "pending",
    ...over,
  };
}

describe("toInvitationPreview (api-spec §3.14)", () => {
  it("returns EXACTLY the six documented keys — no more", () => {
    expect(Object.keys(toInvitationPreview(previewSource())).sort()).toEqual([
      "emailMasked",
      "expiresAt",
      "organizationName",
      "roleKey",
      "roleName",
      "status",
    ]);
  });

  it("★ masks the address — the full one appears nowhere in the output", () => {
    const preview = toInvitationPreview(previewSource());
    expect(preview.emailMasked).toBe("n***@example.com");
    // Whoever holds the token may not be the invitee: the preview exists so the
    // real one can recognise their own address, not so a finder learns it.
    expect(JSON.stringify(preview)).not.toContain("napa@example.com");
  });

  it("★ the mask is FIXED WIDTH — the length of the local part does not leak", () => {
    const short = toInvitationPreview(previewSource({ email: "a@example.com" }));
    const long = toInvitationPreview(previewSource({ email: "alexandra.somchai@example.com" }));
    expect(short.emailMasked).toBe("a***@example.com");
    expect(long.emailMasked).toBe("a***@example.com");
  });

  it("★ an address it cannot mask THROWS rather than rendering a placeholder", () => {
    // A public page must not display a value we failed to parse — the failure
    // mode of a fallback string is "we printed the raw input".
    expect(() => toInvitationPreview(previewSource({ email: "not-an-email" }))).toThrow(
      MaskEmailError,
    );
  });

  it("carries `roleKey: null` as a KEY, not as an absent field (ux Q4)", () => {
    const preview = toInvitationPreview(previewSource({ roleKey: null, roleName: "หัวหน้าคลัง" }));
    expect(preview).toHaveProperty("roleKey", null);
    expect(preview.roleName).toBe("หัวหน้าคลัง");
  });

  it("emits the expiry as an ISO-8601 UTC string (api-spec §1)", () => {
    expect(toInvitationPreview(previewSource()).expiresAt).toBe("2026-08-12T09:00:00.000Z");
  });

  it("normalizes the address the same way login does before masking it", () => {
    // The stored value is normalized; a caller passing the raw form must not get
    // a different mask, or the invitee sees an address that is not theirs.
    expect(toInvitationPreview(previewSource({ email: "  Napa@Example.COM " })).emailMasked).toBe(
      "n***@example.com",
    );
  });
});

describe("toInvitationAcceptResult (api-spec §3.15)", () => {
  const source = {
    organization: { id: "org_1", name: "ร้าน A" },
    membership: { roleId: "rol_1", roleName: "Staff", roleKey: "staff" },
  } as const;

  it("returns exactly the documented shape", () => {
    expect(toInvitationAcceptResult(source)).toEqual({
      organization: { id: "org_1", name: "ร้าน A" },
      membership: { roleId: "rol_1", roleName: "Staff", roleKey: "staff", status: "active" },
    });
  });

  it("★ projects field by field — an extra column on the input does not travel", () => {
    const hostile = {
      organization: { id: "org_1", name: "ร้าน A", taxId: "0105551234567" },
      membership: { roleId: "rol_1", roleName: "Staff", roleKey: "staff", tokenHash: "deadbeef" },
    } as never;
    const serialized = JSON.stringify(toInvitationAcceptResult(hostile));
    expect(serialized).not.toContain("0105551234567");
    expect(serialized).not.toContain("deadbeef");
  });

  it("★ `status` is the literal 'active' — this shape exists only on success", () => {
    expect(toInvitationAcceptResult(source).membership.status).toBe("active");
  });
});
