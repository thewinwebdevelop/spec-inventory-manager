// F-002 · T-002-08 — Thai tax identification number + branch code (pure fn).
// data-model §3.3 / §6 (US-7 tax profile).
//
// Deliberately strict: a wrong TIN becomes a wrong tax document later, which is
// far more expensive to fix than a rejected form field. data-model §6 note: if
// dogfood ever finds a real number the Revenue Department accepts but this check
// rejects, do NOT quietly loosen it — log the example and raise a decision.
//
// ⚠️ NEVER log or echo the value passed in here (architecture §9): when
// `taxEntityType = 'personal'` a TIN IS the owner's national ID number.

/** A Thai TIN is exactly 13 digits. */
export const THAI_TAX_ID_LENGTH = 13;
/** A branch code is exactly 5 digits; `00000` means head office (สำนักงานใหญ่). */
export const BRANCH_CODE_LENGTH = 5;
export const HEAD_OFFICE_BRANCH_CODE = "00000";

/**
 * Strip the separators people actually type (spaces and dashes, ASCII or
 * unicode). Anything else is left untouched so `isValidThaiTaxId` can reject
 * it rather than silently "cleaning" a malformed value into a valid-looking one.
 * `null`/`undefined` normalize to `""` so callers get one string type back.
 */
export function normalizeThaiTaxId(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  return raw.replace(/[\s\-‐-―]/g, "");
}

/**
 * mod-11 check digit (Revenue Department algorithm):
 *   check = (11 - (Σ dᵢ × (13−i) for i=0..11)) mod 10
 *
 * Known and accepted limitation: digit index 2 carries weight 11, so a
 * single-digit typo there is invisible to the checksum. That is a property of
 * the official algorithm — tightening it would reject legally valid numbers.
 */
function checkDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (THAI_TAX_ID_LENGTH - i);
  }
  return (11 - (sum % 11)) % 10;
}

/**
 * Is this a well-formed Thai TIN? Separators are normalized away first, so both
 * `1101700207366` and `1-1017-00207-36-6` are accepted. A missing value is NOT
 * valid — "may be omitted" is the DTO's decision (tax profile is all-or-nothing,
 * data-model §3.3), not this function's.
 */
export function isValidThaiTaxId(value: string | null | undefined): boolean {
  const digits = normalizeThaiTaxId(value);
  if (digits.length !== THAI_TAX_ID_LENGTH) return false;
  if (!/^\d{13}$/.test(digits)) return false;
  // A repeated single digit is never a real TIN. `0000000000000` also fails the
  // checksum below, but stating the rule structurally keeps it true regardless
  // of arithmetic coincidence.
  if (/^(\d)\1{12}$/.test(digits)) return false;
  return Number(digits[12]) === checkDigit(digits);
}

/**
 * Is this a well-formed branch code? The field is optional, so an absent value
 * (`null`/`undefined`) passes — but an EMPTY STRING does not: something was
 * provided and it is not 5 digits. Surrounding whitespace is trimmed.
 */
export function isValidBranchCode(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  return /^\d{5}$/.test(value.trim());
}
