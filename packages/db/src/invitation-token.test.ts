// F-002 · U-DB-09 (test-plan §5) — the invitation token + its hash-at-rest.
//
// Every assertion here corresponds to a way the hash could be quietly wrong
// while everything still "works": a bare digest still stores a value and still
// looks up, a low-entropy token still round-trips, and a hash that leaks its
// input still passes any equality test. None of those show up as a failure
// anywhere else in the suite.
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TOKEN_BYTES,
} from "./invitation-token";

const SECRET_A = "invitation-secret-a-32-chars-minimum-ok!!";
const SECRET_B = "invitation-secret-b-32-chars-different!!!";

describe("generateInvitationToken", () => {
  it("is 256-bit base64url — URL-safe and body-safe (I-6)", () => {
    const token = generateInvitationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    // base64url of 32 bytes is 43 chars unpadded.
    expect(token).toHaveLength(Math.ceil((INVITATION_TOKEN_BYTES * 8) / 6));
    expect(INVITATION_TOKEN_BYTES * 8).toBe(256);
  });

  it("does not repeat across 10k draws", () => {
    // Not a randomness proof — a collision here would mean the generator is
    // seeded per call or truncated, which is the realistic failure.
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) seen.add(generateInvitationToken());
    expect(seen.size).toBe(10_000);
  });
});

describe("hashInvitationToken", () => {
  it("is deterministic for the same token + secret", () => {
    const token = generateInvitationToken();
    expect(hashInvitationToken(token, SECRET_A)).toBe(hashInvitationToken(token, SECRET_A));
  });

  it("is KEYED — a different secret gives a different hash", () => {
    // The property a bare SHA-256 would silently lose: with an unkeyed digest
    // these two would be equal and a database dump would be enough to verify a
    // guessed token offline.
    const token = generateInvitationToken();
    expect(hashInvitationToken(token, SECRET_A)).not.toBe(hashInvitationToken(token, SECRET_B));
  });

  it("is NOT a bare SHA-256 of the token", () => {
    // Pins the regression directly rather than inferring it: someone
    // "simplifying" createHmac to createHash makes this red immediately.
    const token = generateInvitationToken();
    const bare = createHash("sha256").update(token).digest("hex");
    expect(hashInvitationToken(token, SECRET_A)).not.toBe(bare);
  });

  it("never contains the raw token, or any long substring of it", () => {
    const token = generateInvitationToken();
    const hash = hashInvitationToken(token, SECRET_A);
    expect(hash).not.toContain(token);
    // A truncating or encoding-only "hash" would leave recognisable runs of the
    // input behind; a real digest shares no 8-char window with it.
    for (let i = 0; i + 8 <= token.length; i++) {
      expect(hash).not.toContain(token.slice(i, i + 8));
    }
  });

  it("different tokens under the same secret give different hashes", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(hashInvitationToken(a, SECRET_A)).not.toBe(hashInvitationToken(b, SECRET_A));
  });

  it("is lowercase hex of 32 bytes (the column's shape)", () => {
    expect(hashInvitationToken(generateInvitationToken(), SECRET_A)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reads the secret from env when none is passed (the production path)", () => {
    // @qa's seed kit calls this with ONE argument, so the env path is the one
    // that actually runs in the integration lane — worth exercising here rather
    // than discovering it there.
    const previous = process.env.INVITATION_TOKEN_SECRET;
    process.env.INVITATION_TOKEN_SECRET = SECRET_A;
    try {
      const token = generateInvitationToken();
      expect(hashInvitationToken(token)).toBe(hashInvitationToken(token, SECRET_A));
    } finally {
      if (previous === undefined) delete process.env.INVITATION_TOKEN_SECRET;
      else process.env.INVITATION_TOKEN_SECRET = previous;
    }
  });
});
