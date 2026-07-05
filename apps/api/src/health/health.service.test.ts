/**
 * Unit tests for the pure withTimeout helper (D-014 — first api unit test,
 * proves the test wiring runs real tests without a DB/Nest bootstrap).
 * The AC15 behavior (health probe bounded by this helper) was verified live;
 * this pins the helper's contract so a refactor can't silently unbound it.
 */
import { describe, expect, it } from "vitest";
import { withTimeout } from "./health.service";

describe("withTimeout", () => {
  it("resolves with the value when the promise settles before the deadline", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100)).resolves.toBe("ok");
  });

  it("rejects with a timeout error when the promise is slower than the deadline", async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve("late"), 100));
    await expect(withTimeout(slow, 10)).rejects.toThrow(/timed out after 10ms/);
  });

  it("propagates the original rejection (does not mask real errors as timeouts)", async () => {
    const failing = Promise.reject(new Error("redis down"));
    await expect(withTimeout(failing, 100)).rejects.toThrow("redis down");
  });
});
