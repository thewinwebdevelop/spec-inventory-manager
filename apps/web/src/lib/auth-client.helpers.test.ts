import { describe, expect, it } from "vitest";
import { ApiError, isSessionExpired, SessionExpiredError } from "./auth-client";

describe("isSessionExpired (client-security review Important #4 helper)", () => {
  it("returns true for a SessionExpiredError", () => {
    expect(isSessionExpired(new SessionExpiredError())).toBe(true);
  });

  it("returns false for an ApiError (a different failure shape)", () => {
    expect(isSessionExpired(new ApiError(500, null))).toBe(false);
  });

  it("returns false for a plain Error", () => {
    expect(isSessionExpired(new Error("boom"))).toBe(false);
  });

  it("returns false for non-error values (null/undefined/string)", () => {
    expect(isSessionExpired(null)).toBe(false);
    expect(isSessionExpired(undefined)).toBe(false);
    expect(isSessionExpired("some string")).toBe(false);
  });
});
