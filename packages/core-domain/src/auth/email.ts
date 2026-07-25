// F-001 · T-001-01 — email normalization (pure fn, golden rule #6).
// arch §1.3 / data-model §1: the login/lookup path treats the credential as a
// service-layer `identifier { type, value }` abstraction with `type = "email"`
// the sole MVP type. Normalization is the same on write (signup) and on lookup
// (login) so the DB `@unique(email)` constraint sees a single canonical form.
//
// No DB, no framework — this is a string transform only.

/**
 * The abstract credential identifier (D-009 doc-note, service-layer only).
 * `email` is the sole MVP type; a future `phone` slots in here without a schema
 * change. Kept as a discriminated shape so the seam is honest.
 */
export type IdentifierType = "email";

export interface Identifier {
  type: IdentifierType;
  value: string;
}

/**
 * Canonicalize an email for storage + lookup: trim surrounding whitespace and
 * lowercase the WHOLE address (Gate 1 §4 / test U1.1). Lowercasing the whole
 * address (not just the domain) is the MVP rule — deliberate and consistent on
 * both write and read so two case/space variants collide on `@unique(email)`.
 *
 * This does NOT validate the address (see `isValidEmailShape`); it only
 * normalizes. Callers validate separately so a bad address gets a distinct
 * `EMAIL_INVALID` error rather than being silently mangled.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Minimal structural email check (not RFC-complete — deliberately). Rejects the
 * obvious garbage (`no-at`, empty local/domain, spaces, missing dot in domain)
 * that would otherwise reach the `@unique(email)` write. Full deliverability is
 * not F-001's job (F-081 email verification handles the `verified` flag).
 *
 * Applied to the ALREADY-normalized value so the shape check and the stored
 * value agree.
 */
export function isValidEmailShape(normalized: string): boolean {
  if (normalized.length === 0 || normalized.length > 254) return false;
  // Single @, non-empty local part, domain with at least one dot and no
  // whitespace anywhere.
  if (/\s/.test(normalized)) return false;
  const at = normalized.indexOf("@");
  if (at <= 0) return false; // no @ or empty local part
  if (normalized.indexOf("@", at + 1) !== -1) return false; // more than one @
  const domain = normalized.slice(at + 1);
  if (domain.length === 0) return false;
  if (!domain.includes(".")) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  return true;
}

/**
 * Build the service-layer identifier from a raw email credential — normalizes
 * the value and tags it `type: "email"`. The single place the login/signup path
 * turns a raw request email into the abstract identifier (arch §1.3).
 */
export function emailIdentifier(rawEmail: string): Identifier {
  return { type: "email", value: normalizeEmail(rawEmail) };
}
