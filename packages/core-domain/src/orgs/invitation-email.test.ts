import { describe, it, expect } from "vitest";
import { maskEmail, MaskEmailError, EMAIL_MASK } from "./invitation-email";

// F-002 · T-002-08 — U-CD-08 (test-plan §3) · data-model §6.
// `maskEmail` feeds the PUBLIC invitation preview (POST /invitations/preview),
// so the masked form must not let an unauthenticated holder of a token
// reconstruct the invitee's address — not even its length.

describe("maskEmail", () => {
  it.each([
    ["u@example.com", "u***@example.com"],
    ["ab@example.com", "a***@example.com"],
    ["user@example.com", "u***@example.com"],
    ["verylongusername@example.com", "v***@example.com"],
    ["owner@sub.domain.co.th", "o***@sub.domain.co.th"],
  ])("masks %s → %s", (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });

  it("normalizes (trim + lowercase) with the SAME fn as F-001, no fork", () => {
    expect(maskEmail("  User@Example.COM ")).toBe("u***@example.com");
  });

  it("leaks nothing about the local part beyond its first character", () => {
    const local = "somebodyimportant";
    const masked = maskEmail(`${local}@example.com`);
    // Only the masked local part is inspected — the domain is public by design
    // and may legitimately share letters with the local part ("mp" of
    // "important" also lives in "example.com").
    const maskedLocal = masked.slice(0, masked.indexOf("@"));
    expect(maskedLocal).toBe(`${local[0]}***`);
    for (let i = 0; i + 2 <= local.length; i++) {
      expect(maskedLocal.includes(local.slice(i, i + 2))).toBe(false);
    }
  });

  it("leaks nothing about the local part's LENGTH (fixed-width mask)", () => {
    expect(maskEmail("a@example.com").length).toBe(maskEmail("aaaaaaaaaaaa@example.com").length);
    expect(EMAIL_MASK).toBe("***");
  });

  it("handles a non-ASCII local part by code point, not by byte", () => {
    expect(maskEmail("ผู้ใช้@example.com")).toBe("ผ***@example.com");
  });

  it("masks the whole local part when the address has more than one @", () => {
    const masked = maskEmail("a@b@example.com");
    expect(masked).toBe("a***@example.com");
    expect(masked.includes("@b@")).toBe(false);
  });
});

describe("maskEmail — throws on input it cannot mask safely", () => {
  it.each([
    ["no @", "not-an-email"],
    ["empty local part", "@example.com"],
    ["empty domain", "user@"],
    ["empty string", ""],
    ["whitespace only", "   "],
  ])("throws MaskEmailError for %s", (_label, value) => {
    expect(() => maskEmail(value)).toThrow(MaskEmailError);
  });

  it("carries the EMAIL_INVALID code and never echoes the input back", () => {
    try {
      maskEmail("not-an-email");
      expect.unreachable("expected MaskEmailError");
    } catch (err) {
      expect(err).toBeInstanceOf(MaskEmailError);
      expect((err as MaskEmailError).code).toBe("EMAIL_INVALID");
      expect((err as MaskEmailError).message).not.toContain("not-an-email");
    }
  });
});
