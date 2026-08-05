// F-002 · T-002-17 — the tax profile as the WIRE writes and reveals it
// (api-spec §3.5 / §3.16 · data-model §3.3).
//
// TWO DECISIONS LIVE HERE, and both are the kind that must not be re-derived per
// call site:
//
//  1. ALL-OR-NOTHING (data-model §3.3). A tax identity is either declared
//     completely (`entityType` + `taxId` + `vatRegistered`) or not at all. There
//     is no half-declared state in this system, which is why the contract uses
//     `PUT` and not `PATCH`: a partial write would produce a row that
//     `taxProfileComplete` calls incomplete while `taxId` is already populated —
//     i.e. the shop's owner's national ID sitting in a column that no screen
//     admits exists.
//
//  2. WHICH ERROR CODE A BAD BODY GETS. api-spec §4 registers `TAX_ID_INVALID`
//     (422) for "13 digits / checksum failed" and `VALIDATION_FAILED` (422) for
//     everything else, and the client switches on the CODE. Deciding that in a
//     controller means deciding it again in the next controller.
//
// ⚠️ THE VALUE ITSELF NEVER LEAVES THIS FILE except through
// `toTaxProfileReveal`, which exists for exactly one endpoint
// (`POST /orgs/{orgId}/tax-profile/reveal`, §3.16 — logged + rate limited).
// Nothing here logs, echoes or masks-then-returns a TIN: with
// `entityType="personal"` a Thai TIN IS the owner's national ID number.
import {
  isValidBranchCode,
  isValidThaiTaxId,
  normalizeThaiTaxId,
} from "./thai-tax-id";

// ── the accepted vocabulary (api-spec §3.5) ────────────────────────────────

/** `entityType` — the two values data-model §3.3 stores, and no others. */
export const TAX_ENTITY_TYPES: readonly string[] = Object.freeze(["personal", "company"]);

/** api-spec §1 shows this exact string under `fieldErrors.taxId`. */
export const TAX_ID_INVALID_MESSAGE = "เลขผู้เสียภาษีไม่ถูกต้อง";
export const TAX_ENTITY_TYPE_INVALID_MESSAGE = "ประเภทผู้เสียภาษีต้องเป็น personal หรือ company";
export const VAT_REGISTERED_INVALID_MESSAGE = "ต้องระบุสถานะจดทะเบียน VAT (true/false)";
export const BRANCH_CODE_INVALID_MESSAGE = "รหัสสาขาต้องเป็นตัวเลข 5 หลัก";
/** Shown on every field a HALF-filled declaration left out (all-or-nothing). */
export const TAX_PROFILE_INCOMPLETE_MESSAGE =
  "ต้องกรอกข้อมูลภาษีให้ครบชุด (ประเภท เลขผู้เสียภาษี และสถานะ VAT) หรือเว้นว่างทั้งหมด";

// ── the write (api-spec §3.5) ──────────────────────────────────────────────

/**
 * The four `Organization` columns `PUT /orgs/{orgId}/tax-profile` owns
 * (data-model §3.3 — flattened, no separate table).
 *
 * EVERY key is always present, `null` included: this is a `PUT`, so "not sent"
 * means "cleared", never "leave whatever was there". A partial object here would
 * reintroduce the half-declared state the endpoint exists to prevent.
 */
export interface TaxProfileWrite {
  readonly taxEntityType: string | null;
  readonly taxId: string | null;
  readonly vatRegistered: boolean | null;
  readonly taxBranchCode: string | null;
}

/** The whole profile, cleared. `PUT {}` writes exactly this. */
export const TAX_PROFILE_CLEARED: TaxProfileWrite = Object.freeze({
  taxEntityType: null,
  taxId: null,
  vatRegistered: null,
  taxBranchCode: null,
});

/** Which api-spec §4 code a rejected body maps to. */
export type TaxProfileErrorCode = "TAX_ID_INVALID" | "VALIDATION_FAILED";

export type TaxProfileValidation =
  | { readonly ok: true; readonly value: TaxProfileWrite }
  | {
      readonly ok: false;
      readonly code: TaxProfileErrorCode;
      readonly fieldErrors: Record<string, string>;
    };

/** `undefined` (absent) and `null` (explicitly cleared) are the same input. */
function provided(value: unknown): boolean {
  return value !== undefined && value !== null;
}

/**
 * Validate the §3.5 body and produce the exact columns to write.
 *
 * THE THREE OUTCOMES
 *  - **nothing provided** → `TAX_PROFILE_CLEARED`. `PUT {}` is a legitimate
 *    "we have not declared a tax identity" and must not be an error: the shop
 *    that mistyped a TIN yesterday has to be able to take it back.
 *  - **the complete trio provided and valid** → those columns (+ the optional
 *    branch code). `taxId` is stored NORMALIZED (separators stripped), so the
 *    same number typed `1-1017-00207-36-6` and `1101700207366` is one value in
 *    the database and one value on the wire.
 *  - **anything in between** → `ok: false` with a message on EVERY field at
 *    fault at once (the form shows all its errors in one round trip), and the
 *    code the client switches on.
 *
 * `code` is `TAX_ID_INVALID` when the number itself was rejected — the specific
 * code api-spec §4 registers for it — and `VALIDATION_FAILED` otherwise,
 * INCLUDING when `taxId` was simply left out of a partial declaration. "You did
 * not finish filling the form" and "that is not a real tax id" are different
 * things to the person reading the screen.
 */
export function validateTaxProfilePut(input: {
  readonly entityType?: unknown;
  readonly taxId?: unknown;
  readonly vatRegistered?: unknown;
  readonly branchCode?: unknown;
}): TaxProfileValidation {
  const anyProvided =
    provided(input.entityType) ||
    provided(input.taxId) ||
    provided(input.vatRegistered) ||
    provided(input.branchCode);
  // ⛔ Note what is NOT here: a "provided the branch code only ⇒ keep the rest"
  // branch. `branchCode` alone is a partial declaration and falls through to the
  // field errors below, because a branch code without a TIN describes nothing.
  if (!anyProvided) return { ok: true, value: TAX_PROFILE_CLEARED };

  const fieldErrors: Record<string, string> = {};
  /** Distinguishes "that TIN is wrong" from "you left the TIN out". */
  let taxIdRejected = false;

  let taxEntityType: string | null = null;
  if (!provided(input.entityType)) {
    fieldErrors.entityType = TAX_PROFILE_INCOMPLETE_MESSAGE;
  } else if (typeof input.entityType === "string" && TAX_ENTITY_TYPES.includes(input.entityType.trim())) {
    taxEntityType = input.entityType.trim();
  } else {
    fieldErrors.entityType = TAX_ENTITY_TYPE_INVALID_MESSAGE;
  }

  let taxId: string | null = null;
  if (!provided(input.taxId)) {
    fieldErrors.taxId = TAX_PROFILE_INCOMPLETE_MESSAGE;
  } else if (typeof input.taxId === "string" && isValidThaiTaxId(input.taxId)) {
    taxId = normalizeThaiTaxId(input.taxId);
  } else {
    // ⚠️ The message says the value is wrong; it NEVER quotes the value back.
    fieldErrors.taxId = TAX_ID_INVALID_MESSAGE;
    taxIdRejected = true;
  }

  let vatRegistered: boolean | null = null;
  if (!provided(input.vatRegistered)) {
    fieldErrors.vatRegistered = TAX_PROFILE_INCOMPLETE_MESSAGE;
  } else if (typeof input.vatRegistered === "boolean") {
    vatRegistered = input.vatRegistered;
  } else {
    // `"true"` is not `true`: coercing it would let a typo decide whether a shop
    // is VAT-registered, which is a number on a tax document later.
    fieldErrors.vatRegistered = VAT_REGISTERED_INVALID_MESSAGE;
  }

  let taxBranchCode: string | null = null;
  if (provided(input.branchCode)) {
    if (typeof input.branchCode === "string" && isValidBranchCode(input.branchCode)) {
      taxBranchCode = input.branchCode.trim();
    } else {
      fieldErrors.branchCode = BRANCH_CODE_INVALID_MESSAGE;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      code: taxIdRejected ? "TAX_ID_INVALID" : "VALIDATION_FAILED",
      fieldErrors,
    };
  }
  return { ok: true, value: { taxEntityType, taxId, vatRegistered, taxBranchCode } };
}

// ── the reveal (api-spec §3.16) ────────────────────────────────────────────

/**
 * The ONE response shape in the whole system that carries a full TIN
 * (`TAX_ID_RESPONSE_ALLOWLIST` = exactly one endpoint, CI-enforced).
 */
export interface RevealedTaxProfile {
  /** The full 13-digit number, as stored. */
  readonly taxId: string;
  /** Absent on a legacy row that has a TIN but no entity type. */
  readonly entityType?: string;
  /** When it was handed over — ISO-8601 UTC, from the caller's `now`. */
  readonly revealedAt: string;
}

/**
 * Build the §3.16 body, or `null` when there is nothing to reveal — which the
 * endpoint turns into `404 NOT_FOUND`.
 *
 * "Nothing to reveal" is decided by the PRESENCE OF THE NUMBER, not by
 * `isTaxProfileComplete`: a row that somehow holds a TIN without a
 * `vatRegistered` flag (a legacy row, or one written before this endpoint
 * existed) still holds the owner's national ID, and answering `404` for it would
 * mean the one auditable way to see that number does not work on precisely the
 * rows nobody has looked at in a while.
 *
 * `now` is a parameter (golden rule #6 — no clock in a pure fn), which is also
 * what lets a test pin `revealedAt` to the millisecond.
 */
export function toTaxProfileReveal(
  row: { readonly taxEntityType: string | null; readonly taxId: string | null },
  now: Date,
): RevealedTaxProfile | null {
  const taxId = row.taxId?.trim() ?? "";
  if (taxId === "") return null;
  const revealed: RevealedTaxProfile = { taxId, revealedAt: now.toISOString() };
  if (row.taxEntityType === null || row.taxEntityType.trim() === "") return revealed;
  return { ...revealed, entityType: row.taxEntityType };
}
