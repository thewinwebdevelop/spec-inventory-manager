import { describe, it, expect } from "vitest";
import { maskTaxId, TAX_ID_MASK_CHAR, TAX_ID_VISIBLE_SUFFIX_LENGTH } from "./tax-id-mask";

// F-002 · T-002-08b — U-CD-09 (test-plan §3) · data-model §3.3/§6 · api-spec §3.3
// (D-028/I-8 + ux Q13 + D-030 — PDPA).
//
// Why this is a ★ test: with `entityType='personal'` the Thai TIN IS the owner's
// national ID number. The full number leaves the system through exactly one
// endpoint (`POST …/tax-profile/reveal`); everything else goes through this
// function. A mask that quietly returns its input is indistinguishable from a
// working mask in a happy-path test — hence the "output contains none of the
// hidden digits" property test below.

const PERSONAL_TIN = "1234567890121";
const COMPANY_TIN = "0105551234567";

describe("maskTaxId — normal 13-digit TIN", () => {
  it("shows the last 4 digits only", () => {
    expect(maskTaxId(COMPANY_TIN)).toBe("•••••••••4567");
    expect(maskTaxId(PERSONAL_TIN)).toBe("•••••••••0121");
  });

  it("keeps the length (13) so the UI can render a stable field", () => {
    expect([...String(maskTaxId(COMPANY_TIN))]).toHaveLength(13);
  });

  it("exposes exactly the declared suffix length", () => {
    expect(TAX_ID_VISIBLE_SUFFIX_LENGTH).toBe(4);
    expect(String(maskTaxId(COMPANY_TIN)).endsWith(COMPANY_TIN.slice(-4))).toBe(true);
    expect(TAX_ID_MASK_CHAR).toBe("•");
  });
});

describe("maskTaxId — absent value (never leaks, never `undefined`)", () => {
  it("returns null for null / undefined", () => {
    expect(maskTaxId(null)).toBeNull();
    expect(maskTaxId(undefined)).toBeNull();
  });

  it("returns null for an empty or whitespace-only value", () => {
    // A mapper must not emit `taxIdMasked: ""` — "not declared" is answered by
    // `taxProfileComplete` (api-spec §3.3), never by the shape of this string.
    expect(maskTaxId("")).toBeNull();
    expect(maskTaxId("   ")).toBeNull();
  });

  it("never returns undefined — the return type is string | null only", () => {
    for (const input of [null, undefined, "", "  ", "1", COMPANY_TIN]) {
      expect(maskTaxId(input)).not.toBeUndefined();
    }
  });
});

describe("maskTaxId — malformed rows (data older/dirtier than the validator)", () => {
  it("masks a value shorter than the visible suffix ENTIRELY, without throwing", () => {
    expect(maskTaxId("1")).toBe("•");
    expect(maskTaxId("12")).toBe("••");
    expect(maskTaxId("123")).toBe("•••");
    expect(maskTaxId("1234")).toBe("••••");
  });

  it("masks everything but the last 4 for any longer malformed value", () => {
    expect(maskTaxId("12345")).toBe("•2345");
    expect(maskTaxId("012345678901234567")).toBe("••••••••••••••4567");
  });

  it("masks a value carrying separators without revealing the leading digits", () => {
    // Rows are normalized on write, but a mask must never assume its input is.
    const masked = String(maskTaxId("0-1055-51234-56-7"));
    expect(masked.endsWith("56-7")).toBe(true);
    expect(masked).not.toContain("0-1055");
  });
});

describe("maskTaxId — property: the hidden part never survives (U-CD-09)", () => {
  it("output contains none of the first 9 digits of a 13-digit TIN", () => {
    for (const tin of [COMPANY_TIN, PERSONAL_TIN, "9999999999999", "0000000000000"]) {
      const masked = String(maskTaxId(tin));
      expect(masked).not.toContain(tin.slice(0, 9));
      // and no window of the hidden prefix leaks either
      for (let i = 0; i + 2 <= 9; i += 1) {
        expect(masked.slice(0, -TAX_ID_VISIBLE_SUFFIX_LENGTH)).not.toContain(tin.slice(i, i + 2));
      }
    }
  });

  it("never returns the input unchanged for any value with hidden digits", () => {
    for (const tin of [COMPANY_TIN, PERSONAL_TIN, "12345", "0".repeat(20)]) {
      expect(maskTaxId(tin)).not.toBe(tin);
    }
  });

  it("is deterministic and does not mutate anything observable", () => {
    expect(maskTaxId(COMPANY_TIN)).toBe(maskTaxId(COMPANY_TIN));
  });
});
