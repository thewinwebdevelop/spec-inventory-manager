// F-002 · T-002-08b — Thai TIN masking (pure fn, golden rule #6).
// data-model §3.3/§6 · api-spec §3.3 (D-028/I-8 + ux Q13 + D-030 — PDPA).
//
// With `entityType='personal'` a 13-digit TIN IS the owner's national ID number,
// which is why the full value leaves the system through ONE endpoint only
// (`POST /orgs/{orgId}/tax-profile/reveal`, logged + rate limited) and every
// other read goes through this function.
//
// The mask lives here, not in a controller: masking done per-controller is
// masking that will be forgotten in the next endpoint that returns an org.

/** Character standing in for a hidden digit. */
export const TAX_ID_MASK_CHAR = "•";

/** How many trailing characters stay visible (D-028: last 4). */
export const TAX_ID_VISIBLE_SUFFIX_LENGTH = 4;

/**
 * `"0105551234567"` → `"•••••••••4567"`.
 *
 * - `null`/`undefined`/blank → `null`. Never `undefined`, never `""`: the field
 *   is simply absent, and "is the tax profile declared?" is answered by
 *   `taxProfileComplete` (api-spec §3.3), never by inspecting this string.
 * - A value shorter than the visible suffix (a malformed row that predates the
 *   validator) is masked ENTIRELY and never throws — a mapper that throws on
 *   dirty data turns a cosmetic problem into a broken org page, and a fallback
 *   that returns the input turns it into a PDPA incident.
 * - Length is preserved so the UI renders a stable field; only the last
 *   `TAX_ID_VISIBLE_SUFFIX_LENGTH` characters survive, whatever the input looks
 *   like (separators included — this fn never assumes normalized input).
 *
 * Counted by code point, so a malformed multi-byte value cannot be sliced
 * through a surrogate pair.
 */
export function maskTaxId(taxId: string | null | undefined): string | null {
  if (taxId === null || taxId === undefined) return null;
  const characters = [...taxId.trim()];
  if (characters.length === 0) return null;

  // A value that is not longer than the suffix has NOTHING that may be shown:
  // hiding "the all but last 4" of a 3-character value would reveal all of it.
  const hiddenLength =
    characters.length > TAX_ID_VISIBLE_SUFFIX_LENGTH
      ? characters.length - TAX_ID_VISIBLE_SUFFIX_LENGTH
      : characters.length;
  return TAX_ID_MASK_CHAR.repeat(hiddenLength) + characters.slice(hiddenLength).join("");
}
