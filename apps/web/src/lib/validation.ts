/**
 * Client-side validation mirroring the server rules (ux-wireframe §2:
 * "email รูปแบบผิด" on blur/submit, password length hint). This NEVER
 * authorizes anything (client-security skill) — the server is still the
 * source of truth for PASSWORD_BREACHED / EMAIL_TAKEN / etc.; this only
 * gives the user fast, obvious feedback for the two structural checks the
 * server also enforces first (email shape, min length 8 — see
 * packages/core-domain/src/auth/password-policy.ts PASSWORD_MIN_LENGTH,
 * mirrored here as a constant since apps/web does not depend on
 * core-domain — frontend/backend-api boundary).
 */

export const PASSWORD_MIN_LENGTH = 8;

// Reasonably strict but simple email shape check — the server is the real
// gate (email normalize + validation, api-spec.md §2.1); this only catches
// obviously malformed input before a round trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailShape(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function isPasswordLongEnough(password: string): boolean {
  return [...password].length >= PASSWORD_MIN_LENGTH;
}
