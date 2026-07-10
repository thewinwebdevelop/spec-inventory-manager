import { describe, it, expect } from "vitest";
import {
  tokenExpiresAt,
  familyExpiresAt,
  decideFamilyCap,
  REFRESH_TOKEN_TTL_MS,
  FAMILY_LIFETIME_CAP_MS,
  LIVE_FAMILY_CAP,
  type LiveFamily,
} from "./token-lifetime";

const NOW = 1_000_000_000_000;

describe("token lifetimes (arch §2.3, D-007)", () => {
  it("per-token expiry is now + 60 days", () => {
    expect(tokenExpiresAt(NOW)).toBe(NOW + REFRESH_TOKEN_TTL_MS);
    expect(REFRESH_TOKEN_TTL_MS).toBe(60 * 24 * 60 * 60 * 1000);
  });

  it("family cap is login + 90 days", () => {
    expect(familyExpiresAt(NOW)).toBe(NOW + FAMILY_LIFETIME_CAP_MS);
    expect(FAMILY_LIFETIME_CAP_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("family cap is longer than a single token TTL (so rotation is possible before cap)", () => {
    expect(FAMILY_LIFETIME_CAP_MS).toBeGreaterThan(REFRESH_TOKEN_TTL_MS);
  });
});

describe("decideFamilyCap (D-017 live-family cap = 20, LRU-revoke oldest)", () => {
  function families(n: number): LiveFamily[] {
    return Array.from({ length: n }, (_v, i) => ({
      familyId: `fam_${i}`,
      createdAt: NOW + i * 1000, // fam_0 is oldest
    }));
  }

  it("under the cap → no eviction", () => {
    expect(decideFamilyCap(families(19))).toEqual({ revokeFamilyId: null });
    expect(LIVE_FAMILY_CAP).toBe(20);
  });

  it("exactly at the cap (20) → evict the oldest before minting the 21st", () => {
    expect(decideFamilyCap(families(20))).toEqual({ revokeFamilyId: "fam_0" });
  });

  it("over the cap → still evicts the single oldest (LRU by createdAt)", () => {
    const fams = families(25);
    // shuffle to prove selection is by createdAt, not array order
    const shuffled = [...fams].reverse();
    expect(decideFamilyCap(shuffled)).toEqual({ revokeFamilyId: "fam_0" });
  });

  it("tie on the OLDEST createdAt → deterministic tie-break on familyId (smallest)", () => {
    // Two families share the single oldest createdAt (NOW - 1); the other 18 are
    // strictly newer. Tie-break picks the smaller familyId: "fam_a".
    const fams: LiveFamily[] = [
      { familyId: "fam_b", createdAt: NOW - 1 },
      { familyId: "fam_a", createdAt: NOW - 1 },
      ...families(18), // createdAt NOW + i*1000 — all strictly newer than NOW-1
    ];
    expect(decideFamilyCap(fams)).toEqual({ revokeFamilyId: "fam_a" });
  });

  it("empty → no eviction", () => {
    expect(decideFamilyCap([])).toEqual({ revokeFamilyId: null });
  });
});
