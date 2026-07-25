import { describe, it, expect } from "vitest";
import {
  backoffSeconds,
  isBackedOff,
  BACKOFF_THRESHOLD,
  BACKOFF_CEILING_SECONDS,
} from "./backoff";

// Pure — U2.3 backoff curve: n<5 → 0, then 1→2→4→8… clamped at 15-min ceiling.

describe("backoffSeconds (U2.3)", () => {
  it("no backoff below the threshold of 5", () => {
    for (let n = 0; n < BACKOFF_THRESHOLD; n++) {
      expect(backoffSeconds(n)).toBe(0);
    }
  });

  it.each([
    [5, 1],
    [6, 2],
    [7, 4],
    [8, 8],
    [9, 16],
  ])("failure count %i → %i s (exponential from the 5th)", (n, expected) => {
    expect(backoffSeconds(n)).toBe(expected);
  });

  it("clamps at the 15-minute ceiling and never exceeds it", () => {
    expect(backoffSeconds(100)).toBe(BACKOFF_CEILING_SECONDS);
    expect(BACKOFF_CEILING_SECONDS).toBe(900);
  });

  it("is monotonic non-decreasing across the whole range", () => {
    let prev = -1;
    for (let n = 0; n <= 60; n++) {
      const v = backoffSeconds(n);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(BACKOFF_CEILING_SECONDS);
      prev = v;
    }
  });

  it("rejects invalid input (negative / non-integer)", () => {
    expect(() => backoffSeconds(-1)).toThrow(RangeError);
    expect(() => backoffSeconds(1.5)).toThrow(RangeError);
  });
});

describe("isBackedOff", () => {
  it("true only at/after the threshold", () => {
    expect(isBackedOff(4)).toBe(false);
    expect(isBackedOff(5)).toBe(true);
    expect(isBackedOff(6)).toBe(true);
  });
});
