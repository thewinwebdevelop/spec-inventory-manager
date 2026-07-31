// F-002 · T-002-08 — email masking for the PUBLIC invitation preview (pure fn).
// data-model §6 · architecture §7.4 (`POST /invitations/preview`, I-6).
//
// The preview endpoint is reachable by anyone holding an invitation token, so
// the address it shows must confirm "this is for you" to the real invitee
// without handing an address to anybody else. The mask is FIXED WIDTH so it
// leaks neither the characters nor the LENGTH of the local part.

import { normalizeEmail } from "../auth/email";

/** Fixed-width replacement for the local part — never length-proportional. */
export const EMAIL_MASK = "***";

/** Thrown when the input cannot be masked safely (no `@`, empty local/domain). */
export class MaskEmailError extends Error {
  readonly code = "EMAIL_INVALID";

  constructor() {
    // Deliberately does NOT include the offending value: this type reaches log
    // lines, and the value is the PII we are trying to protect.
    super("Email cannot be masked: expected a local part and a domain");
    this.name = "MaskEmailError";
  }
}

/**
 * `user@example.com` → `u***@example.com`.
 *
 * Normalizes with the SAME `normalizeEmail` the F-001 login path uses (no fork,
 * regression-pinned by U-CD-10) so the masked form matches the stored address.
 * The first character is kept by CODE POINT, so a Thai or emoji local part is
 * not sliced through a surrogate pair.
 *
 * Throws `MaskEmailError` rather than returning a fallback string: a value we
 * cannot parse must not be rendered on a public page at all.
 */
export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0) throw new MaskEmailError(); // no `@`, or an empty local part
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (domain.length === 0) throw new MaskEmailError();
  const firstCodePoint = [...local][0];
  return `${firstCodePoint}${EMAIL_MASK}@${domain}`;
}
