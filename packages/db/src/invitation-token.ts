// F-002 · D-018 — invitation token value + keyed hash-at-rest.
// architecture §7 · data-model §2 (`Invitation.tokenHash` unique) · test-plan U-DB-09.
//
// ── Why hash at rest at all ────────────────────────────────────────────────
// D-012 lets an inviter copy a link and send it themselves, so the raw token is
// the ONLY credential standing between a stranger and membership of a shop. A
// database dump — a backup on a laptop, a support export, a leaked replica —
// must not hand out working invitations. Storing `tokenHash` means a dump gives
// an attacker a value they cannot present.
//
// ── Why KEYED (HMAC), not bare SHA-256 ─────────────────────────────────────
// A bare digest is secret-insensitive: anyone holding the dump can hash a
// guessed token and compare. Tokens here are 256-bit random, so guessing is not
// the realistic threat — but keying costs nothing and removes the entire class,
// and it is the same shape F-001 already uses for refresh tokens
// (`apps/api/src/auth/refresh-token.crypto.ts`). Two different hashing stories
// in one codebase is how one of them ends up wrong.
//
// ── Key separation (§7.3) ──────────────────────────────────────────────────
// `INVITATION_TOKEN_SECRET` is validated at boot to be ≥32 chars AND different
// from BOTH JWT secrets. If invitations shared the auth key, one leak would
// compromise both surfaces at once.
//
// ⚠️ ROTATING THE SECRET INVALIDATES EVERY PENDING INVITATION. `tokenHash` is
// derived from it, so every stored hash stops matching. That is a deliberate
// property — it is also the emergency "kill every outstanding link" switch —
// but it must be a decision, never a surprise during a routine secret rotation.
//
// This is the ONE code path that turns a token into a stored value (data-model
// §Security row: "code path เดียว"). Nothing else may hash an invitation token,
// including tests — @qa's seed kit deliberately calls this function rather than
// reimplementing it, because a kit that hashes its own tokens proves only that
// the kit agrees with itself.
import { createHmac, randomBytes } from "node:crypto";
import { resolveInvitationTokenSecret } from "@omnistock/config";

/** Entropy of a generated token, in bytes. 32 B = 256 bits. */
export const INVITATION_TOKEN_BYTES = 32;

/**
 * A fresh opaque invitation token: 256-bit CSPRNG, base64url.
 *
 * base64url because this value travels in a URL (`/invite?token=…`) and, per
 * I-6, in a request BODY — no percent-encoding surprises in either place, and
 * no `+`/`/` to be mangled by a mail client rewriting the link.
 *
 * NOT a JWT: there is nothing to encode. A JWT would be longer, would leak its
 * own claims to anyone who receives the link, and would tempt someone into
 * trusting it without a database lookup — while the whole lifecycle (expiry,
 * cancellation, rotation, supersession) lives in the `Invitation` row.
 */
export function generateInvitationToken(): string {
  return randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
}

/**
 * `HMAC-SHA-256(INVITATION_TOKEN_SECRET, token)` as lowercase hex — the value
 * stored in `Invitation.tokenHash` and the value looked up on redemption.
 *
 * Lookup is `findUnique({ tokenHash })`: one indexed hit, no scan, and no
 * timing signal from searching. Comparison happens in the database on a unique
 * index rather than in JS over a candidate set.
 *
 * `secret` is injectable for tests (U-DB-09 proves a different secret yields a
 * different hash). In production it is the validated env value, read per call
 * rather than captured at module load — a process that boots before the env is
 * populated must not freeze an empty key into every future hash.
 *
 * It goes through the NARROW resolver, not `loadEnv`: this is a library, and
 * `loadEnv` validates the whole application env and calls `process.exit(1)`.
 * A missing secret here must be an exception the caller can see and a test can
 * assert, not a dead process.
 */
export function hashInvitationToken(token: string, secret?: string): string {
  const key = secret ?? resolveInvitationTokenSecret();
  return createHmac("sha256", key).update(token).digest("hex");
}
