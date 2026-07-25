import { describe, it, expect } from "vitest";
import { createHmac, createHash } from "node:crypto";
import { generateRefreshTokenValue, hashRefreshToken } from "./refresh-token.crypto";

// ★ U3.8 (L-3) — tokenHash is keyed HMAC-SHA-256, NOT bare SHA-256.

const SECRET = "test-refresh-secret-at-least-32-chars-long!!";

describe("hashRefreshToken (U3.8 / L-3)", () => {
  it("equals HMAC-SHA-256(secret, value), recomputed independently", () => {
    const value = "opaque-token-value";
    const expected = createHmac("sha256", SECRET).update(value).digest("hex");
    expect(hashRefreshToken(value, SECRET)).toBe(expected);
  });

  it("does NOT equal bare SHA-256(value)", () => {
    const value = "opaque-token-value";
    const bare = createHash("sha256").update(value).digest("hex");
    expect(hashRefreshToken(value, SECRET)).not.toBe(bare);
  });

  it("is key-sensitive — a different secret yields a different hash", () => {
    const value = "opaque-token-value";
    const a = hashRefreshToken(value, SECRET);
    const b = hashRefreshToken(value, "a-completely-different-secret-value-32chars");
    expect(a).not.toBe(b);
  });

  it("is deterministic for the same (value, secret)", () => {
    expect(hashRefreshToken("v", SECRET)).toBe(hashRefreshToken("v", SECRET));
  });
});

describe("generateRefreshTokenValue", () => {
  it("produces a high-entropy (≥256-bit) URL-safe value", () => {
    const v = generateRefreshTokenValue();
    // 32 bytes base64url → 43 chars, no padding, url-safe alphabet.
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(v.length).toBeGreaterThanOrEqual(43);
  });

  it("is unique across calls (no collisions in a small sample)", () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateRefreshTokenValue()));
    expect(set.size).toBe(1000);
  });
});
