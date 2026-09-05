// F-002 · T-002-17 — the tax profile's pure rules (api-spec §3.5/§3.16 ·
// data-model §3.3).
//
// The matrix that matters here is not "does the checksum work" (that is
// `thai-tax-id.test.ts`) but the two rules THIS file owns: a tax identity is
// complete or absent, and the full number leaves through exactly one function.
import { describe, it, expect } from "vitest";
import {
  validateTaxProfilePut,
  toTaxProfileReveal,
  TAX_PROFILE_CLEARED,
  TAX_ID_INVALID_MESSAGE,
  TAX_ENTITY_TYPE_INVALID_MESSAGE,
  VAT_REGISTERED_INVALID_MESSAGE,
  BRANCH_CODE_INVALID_MESSAGE,
  TAX_PROFILE_INCOMPLETE_MESSAGE,
  TAX_ENTITY_TYPES,
} from "./tax-profile";

/** A real, checksum-valid Thai TIN (the one data-model §6 uses as an example). */
const VALID_TIN = "1101700207366";
/** 13 digits, checksum WRONG — the "looks right, is not" case. */
const BAD_CHECKSUM_TIN = "1101700207367";

const COMPLETE = {
  entityType: "company",
  taxId: VALID_TIN,
  vatRegistered: true,
  branchCode: "00000",
} as const;

function expectRejected(result: ReturnType<typeof validateTaxProfilePut>) {
  if (result.ok) throw new Error(`expected a rejection, got ${JSON.stringify(result.value)}`);
  return result;
}

function expectAccepted(result: ReturnType<typeof validateTaxProfilePut>) {
  if (!result.ok) throw new Error(`expected acceptance, got ${JSON.stringify(result.fieldErrors)}`);
  return result;
}

// ── the complete set ────────────────────────────────────────────────────────

describe("validateTaxProfilePut — a complete declaration", () => {
  it("maps the wire names onto the four columns", () => {
    expect(expectAccepted(validateTaxProfilePut(COMPLETE)).value).toEqual({
      taxEntityType: "company",
      taxId: VALID_TIN,
      vatRegistered: true,
      taxBranchCode: "00000",
    });
  });

  it("★ stores the TIN NORMALIZED — one number, one stored value", () => {
    // Typed with separators today, without them tomorrow: if both are stored
    // verbatim, `maskTaxId` produces two different masks for one shop and the
    // back-office TIN lookup (schema `@@index([taxId])`) silently misses.
    const spaced = expectAccepted(validateTaxProfilePut({ ...COMPLETE, taxId: "1-1017-00207-36-6" }));
    expect(spaced.value.taxId).toBe(VALID_TIN);
  });

  it("accepts both entity types and nothing else", () => {
    for (const entityType of TAX_ENTITY_TYPES) {
      expect(expectAccepted(validateTaxProfilePut({ ...COMPLETE, entityType })).value.taxEntityType).toBe(
        entityType,
      );
    }
    const rejected = expectRejected(validateTaxProfilePut({ ...COMPLETE, entityType: "partnership" }));
    expect(rejected.fieldErrors).toEqual({ entityType: TAX_ENTITY_TYPE_INVALID_MESSAGE });
    expect(rejected.code).toBe("VALIDATION_FAILED");
  });

  it("branchCode is optional — absent means head office is not asserted, not `00000`", () => {
    const { value } = expectAccepted(
      validateTaxProfilePut({ entityType: "personal", taxId: VALID_TIN, vatRegistered: false }),
    );
    expect(value).toEqual({
      taxEntityType: "personal",
      taxId: VALID_TIN,
      vatRegistered: false,
      taxBranchCode: null,
    });
  });

  it("`vatRegistered: false` is a DECLARATION, not an omission", () => {
    // The falsy-check bug this pins: `if (!input.vatRegistered)` would treat a
    // shop that declared "not VAT registered" as one that declared nothing.
    const { value } = expectAccepted(validateTaxProfilePut({ ...COMPLETE, vatRegistered: false }));
    expect(value.vatRegistered).toBe(false);
    expect(value.taxId).toBe(VALID_TIN);
  });
});

// ── all-or-nothing ──────────────────────────────────────────────────────────

describe("★ all-or-nothing (data-model §3.3) — there is no half-declared identity", () => {
  it("an empty body clears the whole profile", () => {
    expect(expectAccepted(validateTaxProfilePut({})).value).toEqual(TAX_PROFILE_CLEARED);
  });

  it("explicit nulls are the same as absent — `PUT` means replace", () => {
    const { value } = expectAccepted(
      validateTaxProfilePut({ entityType: null, taxId: null, vatRegistered: null, branchCode: null }),
    );
    expect(value).toEqual(TAX_PROFILE_CLEARED);
  });

  it.each([
    ["entityType only", { entityType: "company" }, ["taxId", "vatRegistered"]],
    ["taxId only", { taxId: VALID_TIN }, ["entityType", "vatRegistered"]],
    ["vatRegistered only", { vatRegistered: true }, ["entityType", "taxId"]],
    ["branchCode only", { branchCode: "00000" }, ["entityType", "taxId", "vatRegistered"]],
    [
      "missing vatRegistered",
      { entityType: "company", taxId: VALID_TIN },
      ["vatRegistered"],
    ],
  ])("%s is refused, naming every missing field at once", (_label, input, missing) => {
    const rejected = expectRejected(validateTaxProfilePut(input));
    expect(Object.keys(rejected.fieldErrors).sort()).toEqual([...missing].sort());
    for (const field of missing) {
      expect(rejected.fieldErrors[field]).toBe(TAX_PROFILE_INCOMPLETE_MESSAGE);
    }
    // "You have not finished" is not "that number is wrong" — different code,
    // different copy on screen.
    expect(rejected.code).toBe("VALIDATION_FAILED");
  });

  it("★ a rejected body yields NO partial write — there is no `value` to write", () => {
    const rejected = expectRejected(validateTaxProfilePut({ entityType: "company", taxId: VALID_TIN }));
    expect(rejected).not.toHaveProperty("value");
  });
});

// ── the TIN itself ──────────────────────────────────────────────────────────

describe("the tax id (api-spec §4 · TAX_ID_INVALID)", () => {
  it.each([
    ["a failed checksum", BAD_CHECKSUM_TIN],
    ["12 digits", "110170020736"],
    ["letters", "11017002073AB"],
    ["a repeated digit", "1111111111111"],
    ["an empty string", ""],
    ["a number, not a string", 1101700207366],
  ])("%s → TAX_ID_INVALID with fieldErrors.taxId", (_label, taxId) => {
    const rejected = expectRejected(validateTaxProfilePut({ ...COMPLETE, taxId }));
    expect(rejected.code).toBe("TAX_ID_INVALID");
    expect(rejected.fieldErrors.taxId).toBe(TAX_ID_INVALID_MESSAGE);
  });

  it("★ the rejection NEVER quotes the value back (architecture §9 — no TIN in any output)", () => {
    const rejected = expectRejected(validateTaxProfilePut({ ...COMPLETE, taxId: BAD_CHECKSUM_TIN }));
    expect(JSON.stringify(rejected)).not.toContain(BAD_CHECKSUM_TIN);
  });

  it("a bad TIN alongside other bad fields still reports every field, code TAX_ID_INVALID", () => {
    const rejected = expectRejected(
      validateTaxProfilePut({ entityType: "llc", taxId: BAD_CHECKSUM_TIN, vatRegistered: "yes", branchCode: "1" }),
    );
    expect(Object.keys(rejected.fieldErrors).sort()).toEqual([
      "branchCode",
      "entityType",
      "taxId",
      "vatRegistered",
    ]);
    expect(rejected.fieldErrors.vatRegistered).toBe(VAT_REGISTERED_INVALID_MESSAGE);
    expect(rejected.fieldErrors.branchCode).toBe(BRANCH_CODE_INVALID_MESSAGE);
    // The most specific code wins: the client's TIN-field copy is the one that
    // helps here, and `fieldErrors` still names the other three.
    expect(rejected.code).toBe("TAX_ID_INVALID");
  });

  it.each([["4 digits", "0000"], ["6 digits", "000000"], ["not digits", "0000A"]])(
    "branchCode %s is refused",
    (_label, branchCode) => {
      const rejected = expectRejected(validateTaxProfilePut({ ...COMPLETE, branchCode }));
      expect(rejected.fieldErrors).toEqual({ branchCode: BRANCH_CODE_INVALID_MESSAGE });
    },
  );
});

// ── the reveal ──────────────────────────────────────────────────────────────

describe("toTaxProfileReveal — api-spec §3.16", () => {
  const NOW = new Date("2026-07-28T09:00:00.000Z");

  it("returns the FULL number plus when it was handed over", () => {
    expect(toTaxProfileReveal({ taxEntityType: "company", taxId: VALID_TIN }, NOW)).toEqual({
      taxId: VALID_TIN,
      entityType: "company",
      revealedAt: "2026-07-28T09:00:00.000Z",
    });
  });

  it("★ `null` when there is no number — the endpoint turns that into 404", () => {
    expect(toTaxProfileReveal({ taxEntityType: null, taxId: null }, NOW)).toBeNull();
    expect(toTaxProfileReveal({ taxEntityType: "company", taxId: "   " }, NOW)).toBeNull();
  });

  it("★ a legacy row with a TIN but no entity type still reveals the number", () => {
    // Refusing here would mean the one AUDITABLE way to see this number does not
    // work on exactly the rows nobody has touched in a long time.
    const revealed = toTaxProfileReveal({ taxEntityType: null, taxId: VALID_TIN }, NOW);
    expect(revealed).toEqual({ taxId: VALID_TIN, revealedAt: "2026-07-28T09:00:00.000Z" });
    expect(revealed).not.toHaveProperty("entityType");
  });

  it("takes `now` as an argument — no clock inside a pure fn", () => {
    const other = new Date("2027-01-01T00:00:00.000Z");
    expect(toTaxProfileReveal({ taxEntityType: "personal", taxId: VALID_TIN }, other)?.revealedAt).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
});
