/**
 * AC12 red-smoke — DELIBERATELY FAILING test, pushed to prove the CI gate
 * actually turns red and blocks merge. This commit will be reverted
 * immediately after the red run is observed. Do NOT fix this test.
 */
import { describe, expect, it } from "vitest";

describe("AC12 red-smoke", () => {
  it("deliberately fails to prove CI blocks red", () => {
    expect(1).toBe(2);
  });
});
