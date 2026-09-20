import { describe, it, expect } from "vitest";
import {
  isValidThaiTaxId,
  isValidBranchCode,
  normalizeThaiTaxId,
  HEAD_OFFICE_BRANCH_CODE,
  THAI_TAX_ID_LENGTH,
} from "./thai-tax-id";

// F-002 · T-002-08 — U-CD-06 / U-CD-07 (test-plan §3) · data-model §6.
// checksum: check = (11 - (Σ dᵢ × (13−i) for i=0..11)) mod 10   (mod-11 weights 13…2)

/** 13-digit personal-form TIN (national id shape) with a correct check digit. */
const VALID_PERSONAL = "1101700207366";
/** 13-digit juristic-form TIN (leading 0) with a correct check digit. */
const VALID_JURISTIC = "0105536112014";
const VALID_OTHER = "3929947003163";

describe("isValidThaiTaxId — accepts correct numbers", () => {
  it.each([VALID_PERSONAL, VALID_JURISTIC, VALID_OTHER])("accepts %s", (tin) => {
    expect(isValidThaiTaxId(tin)).toBe(true);
  });

  it("accepts a correct number written with dashes or spaces (normalized first)", () => {
    expect(isValidThaiTaxId("1-1017-00207-36-6")).toBe(true);
    expect(isValidThaiTaxId("1 1017 00207 36 6")).toBe(true);
    expect(isValidThaiTaxId("  0105536112014  ")).toBe(true);
  });
});

describe("isValidThaiTaxId — rejects wrong numbers", () => {
  it("rejects a wrong check digit (both directions)", () => {
    expect(isValidThaiTaxId("1101700207365")).toBe(false);
    expect(isValidThaiTaxId("1101700207367")).toBe(false);
  });

  it("rejects a ±1 typo in any weighted position (weight not divisible by 11)", () => {
    for (const tin of [VALID_PERSONAL, VALID_JURISTIC]) {
      for (let i = 0; i < THAI_TAX_ID_LENGTH; i++) {
        // index 2 carries weight 11 → invisible to a mod-11 checksum (see below)
        if (i === 2) continue;
        for (const delta of [1, 9]) {
          const digits = tin.split("");
          digits[i] = String((Number(digits[i]) + delta) % 10);
          expect(isValidThaiTaxId(digits.join(""))).toBe(false);
        }
      }
    }
  });

  it("documents the mod-11 blind spot at index 2 (weight 11) — do NOT 'fix' this", () => {
    // The Revenue Department's algorithm weights digit 3 by 11, so a single-digit
    // typo there cannot be detected. Tightening our check beyond the official
    // algorithm would reject numbers that are legally valid.
    const digits = VALID_PERSONAL.split("");
    digits[2] = String((Number(digits[2]) + 1) % 10);
    expect(isValidThaiTaxId(digits.join(""))).toBe(true);
  });

  it.each([
    ["12 digits", "110170020736"],
    ["14 digits", "11017002073660"],
    ["contains a letter", "110170020736X"],
    ["contains Thai text", "เลขประจำตัว"],
    ["all zeros", "0000000000000"],
    ["empty", ""],
    ["only separators", "---"],
  ])("rejects %s", (_label, value) => {
    expect(isValidThaiTaxId(value)).toBe(false);
  });

  it("rejects null / undefined (a missing TIN is not a valid TIN)", () => {
    expect(isValidThaiTaxId(null)).toBe(false);
    expect(isValidThaiTaxId(undefined)).toBe(false);
  });
});

describe("normalizeThaiTaxId", () => {
  it("strips spaces and dashes, and returns the digits only", () => {
    expect(normalizeThaiTaxId("1-1017-00207-36-6")).toBe(VALID_PERSONAL);
    expect(normalizeThaiTaxId("  1101700207366 ")).toBe(VALID_PERSONAL);
  });

  it("returns an empty string for null / undefined", () => {
    expect(normalizeThaiTaxId(null)).toBe("");
    expect(normalizeThaiTaxId(undefined)).toBe("");
  });

  it("leaves non-separator junk in place so validation can reject it", () => {
    expect(normalizeThaiTaxId("110170020736X")).toBe("110170020736X");
  });
});

describe("isValidBranchCode (optional field — U-CD-07)", () => {
  it("accepts the head-office code and any other 5-digit code", () => {
    expect(HEAD_OFFICE_BRANCH_CODE).toBe("00000");
    expect(isValidBranchCode(HEAD_OFFICE_BRANCH_CODE)).toBe(true);
    expect(isValidBranchCode("00001")).toBe(true);
    expect(isValidBranchCode("99999")).toBe(true);
    expect(isValidBranchCode(" 00012 ")).toBe(true);
  });

  it("accepts an absent value (the field is optional)", () => {
    expect(isValidBranchCode(undefined)).toBe(true);
    expect(isValidBranchCode(null)).toBe(true);
  });

  it.each([
    ["4 digits", "0000"],
    ["6 digits", "000000"],
    ["letters", "abcde"],
    ["mixed", "1234a"],
    ["empty string is a provided-but-invalid value", ""],
    ["dashed", "00-01"],
  ])("rejects %s", (_label, value) => {
    expect(isValidBranchCode(value)).toBe(false);
  });
});
