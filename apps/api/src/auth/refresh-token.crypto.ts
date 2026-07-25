// F-001 · T-001-05 — refresh-token value + hash crypto (L-3). arch §2.3/§9.
// - The token VALUE is a high-entropy opaque random string (≥256 bits from a
//   CSPRNG), NOT a JWT.
// - Stored as tokenHash = HMAC-SHA-256(JWT_REFRESH_SECRET, tokenValue) — a KEYED
//   hash (not bare SHA-256): a DB dump alone cannot even verify a guessed token
//   without the env secret. Lookup = compute the HMAC of the presented value.
//
// Isolated as a tiny module so the keyed-HMAC guarantee (U3.8/I3.9) is unit-
// testable and a regression to bare SHA-256 is caught here.
import { createHmac, randomBytes } from "node:crypto";

/** Generate a fresh opaque refresh-token value (≥256-bit, base64url). */
export function generateRefreshTokenValue(): string {
  // 32 bytes = 256 bits of entropy; base64url so it's URL/cookie safe.
  return randomBytes(32).toString("base64url");
}

/**
 * Compute the stored/lookup hash for a refresh-token value: KEYED
 * HMAC-SHA-256(secret, value). MUST be keyed by JWT_REFRESH_SECRET — a bare
 * SHA-256 would be secret-insensitive and verifiable from a DB dump alone.
 */
export function hashRefreshToken(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}
