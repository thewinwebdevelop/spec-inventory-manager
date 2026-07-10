import { describe, it, expect } from "vitest";
import { decideReuse, REUSE_LEEWAY_MS, type ReuseDecisionInput } from "./reuse-decision";

// ★ golden-rule-#4 merge blocker — the reuse-decision state matrix (U3.1–U3.7).
// Pure, no DB. `now` injected. Times are epoch ms.

const NOW = 1_000_000_000_000;
const FUTURE = NOW + 60 * 60 * 1000; // 1h out
const PAST = NOW - 1;

/** A "current" token: not revoked, not expired, cap not reached, no successor. */
function current(overrides: Partial<ReuseDecisionInput> = {}): ReuseDecisionInput {
  return {
    now: NOW,
    presentedRevokedAt: null,
    presentedExpiresAt: FUTURE,
    presentedFamilyExpiresAt: FUTURE,
    successor: null,
    ...overrides,
  };
}

describe("decideReuse (U3.1 current → ALLOW_ROTATE)", () => {
  it("current token rotates", () => {
    expect(decideReuse(current())).toBe("ALLOW_ROTATE");
  });
});

describe("decideReuse (U3.2 consumed outside leeway → REVOKE_FAMILY)", () => {
  it("immediate predecessor whose successor is >60s old → reuse", () => {
    const input = current({
      successor: { createdAt: NOW - (REUSE_LEEWAY_MS + 1), isCurrent: true },
    });
    expect(decideReuse(input)).toBe("REVOKE_FAMILY");
  });
});

describe("decideReuse (U3.3 revoked → REVOKE_FAMILY)", () => {
  it("explicitly revoked token → reuse/replay, no leeway", () => {
    expect(decideReuse(current({ presentedRevokedAt: PAST }))).toBe("REVOKE_FAMILY");
  });

  it("a revoked token that is ALSO an in-leeway predecessor still burns (no leeway for revoked)", () => {
    const input = current({
      presentedRevokedAt: PAST,
      successor: { createdAt: NOW, isCurrent: true },
    });
    expect(decideReuse(input)).toBe("REVOKE_FAMILY");
  });
});

describe("decideReuse (U3.4 per-token expired → REJECT_EXPIRED, no burn)", () => {
  it("expiresAt in the past → benign expiry", () => {
    expect(decideReuse(current({ presentedExpiresAt: PAST }))).toBe("REJECT_EXPIRED");
  });

  it("boundary: expiresAt exactly now → expired", () => {
    expect(decideReuse(current({ presentedExpiresAt: NOW }))).toBe("REJECT_EXPIRED");
  });
});

describe("decideReuse (U3.5 immediate predecessor within leeway → REJECT_BENIGN_RETRY)", () => {
  it("successor age 0s → benign retry (family NOT burned)", () => {
    const input = current({ successor: { createdAt: NOW, isCurrent: true } });
    expect(decideReuse(input)).toBe("REJECT_BENIGN_RETRY");
  });

  it("boundary: successor age 59s → benign", () => {
    const input = current({
      successor: { createdAt: NOW - 59_000, isCurrent: true },
    });
    expect(decideReuse(input)).toBe("REJECT_BENIGN_RETRY");
  });

  it("boundary: successor age exactly 60s (== leeway) → still benign", () => {
    const input = current({
      successor: { createdAt: NOW - REUSE_LEEWAY_MS, isCurrent: true },
    });
    expect(decideReuse(input)).toBe("REJECT_BENIGN_RETRY");
  });

  it("boundary: successor age 61s → reuse (just past the window)", () => {
    const input = current({
      successor: { createdAt: NOW - 61_000, isCurrent: true },
    });
    expect(decideReuse(input)).toBe("REVOKE_FAMILY");
  });

  it("deeper ancestor inside 60s (successor not current) → REVOKE_FAMILY (leeway is immediate-only)", () => {
    const input = current({
      successor: { createdAt: NOW, isCurrent: false },
    });
    expect(decideReuse(input)).toBe("REVOKE_FAMILY");
  });
});

describe("decideReuse (U3.6 family-cap reached → REJECT_EXPIRED, no burn, no audit)", () => {
  it("familyExpiresAt passed → ordinary expiry, NOT reuse", () => {
    expect(decideReuse(current({ presentedFamilyExpiresAt: PAST }))).toBe("REJECT_EXPIRED");
  });

  it("boundary: familyExpiresAt exactly now → expired", () => {
    expect(decideReuse(current({ presentedFamilyExpiresAt: NOW }))).toBe("REJECT_EXPIRED");
  });

  it("family-cap expiry takes precedence over a consumed state (aged-out ≠ reuse)", () => {
    // Presented is consumed AND the family aged out → must be REJECT_EXPIRED,
    // never misclassified as reuse (D-007 precedence).
    const input = current({
      presentedFamilyExpiresAt: PAST,
      successor: { createdAt: NOW - 120_000, isCurrent: true },
    });
    expect(decideReuse(input)).toBe("REJECT_EXPIRED");
  });
});

describe("decideReuse (U3.7 exhaustive state matrix)", () => {
  // { current, consumed, revoked, expired, family-cap } × successor age × immediate/deeper.
  const cases: Array<[string, ReuseDecisionInput, string]> = [
    ["current, no successor", current(), "ALLOW_ROTATE"],
    [
      "consumed immediate <=60s",
      current({ successor: { createdAt: NOW - 30_000, isCurrent: true } }),
      "REJECT_BENIGN_RETRY",
    ],
    [
      "consumed immediate >60s",
      current({ successor: { createdAt: NOW - 90_000, isCurrent: true } }),
      "REVOKE_FAMILY",
    ],
    [
      "consumed deeper <=60s",
      current({ successor: { createdAt: NOW - 30_000, isCurrent: false } }),
      "REVOKE_FAMILY",
    ],
    ["revoked", current({ presentedRevokedAt: PAST }), "REVOKE_FAMILY"],
    ["per-token expired", current({ presentedExpiresAt: PAST }), "REJECT_EXPIRED"],
    ["family-cap expired", current({ presentedFamilyExpiresAt: PAST }), "REJECT_EXPIRED"],
  ];

  it.each(cases)("%s → %s", (_label, input, expected) => {
    expect(decideReuse(input)).toBe(expected);
  });
});
