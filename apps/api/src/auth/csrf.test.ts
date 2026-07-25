import { describe, it, expect } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import type { Request } from "express";
import {
  enforceCsrfIfCookiePath,
  isCookiePath,
  mintCsrfToken,
  resolvePresentedRefreshToken,
} from "./csrf";
import { COOKIE_REFRESH, COOKIE_CSRF, CSRF_HEADER } from "./auth.constants";

function req(cookies: Record<string, string>, headers: Record<string, string> = {}): Request {
  return { cookies, headers } as unknown as Request;
}

describe("CSRF double-submit (api-spec §0, N-3)", () => {
  it("no-op on the body/mobile path (no omni_rt cookie)", () => {
    expect(() => enforceCsrfIfCookiePath(req({}))).not.toThrow();
  });

  it("passes when header === omni_csrf cookie on the cookie path", () => {
    const r = req(
      { [COOKIE_REFRESH]: "rt", [COOKIE_CSRF]: "csrf-value" },
      { [CSRF_HEADER]: "csrf-value" },
    );
    expect(() => enforceCsrfIfCookiePath(r)).not.toThrow();
  });

  it("403 when header is missing on the cookie path", () => {
    const r = req({ [COOKIE_REFRESH]: "rt", [COOKIE_CSRF]: "csrf-value" }, {});
    expect(() => enforceCsrfIfCookiePath(r)).toThrow(ForbiddenException);
  });

  it("403 when header mismatches the cookie", () => {
    const r = req(
      { [COOKIE_REFRESH]: "rt", [COOKIE_CSRF]: "csrf-value" },
      { [CSRF_HEADER]: "different" },
    );
    expect(() => enforceCsrfIfCookiePath(r)).toThrow(ForbiddenException);
  });

  it("CSRF enforced even if a body token is also present (keyed on cookie transport, N-3)", () => {
    // omni_rt cookie present + a mismatched header → still 403, regardless of body.
    const r = req({ [COOKIE_REFRESH]: "rt", [COOKIE_CSRF]: "c" }, { [CSRF_HEADER]: "wrong" });
    expect(() => enforceCsrfIfCookiePath(r)).toThrow(ForbiddenException);
  });
});

describe("transport resolution (api-spec §0)", () => {
  it("cookie first, then body", () => {
    expect(resolvePresentedRefreshToken(req({ [COOKIE_REFRESH]: "cookie-rt" }), "body-rt")).toBe("cookie-rt");
    expect(resolvePresentedRefreshToken(req({}), "body-rt")).toBe("body-rt");
    expect(resolvePresentedRefreshToken(req({}), undefined)).toBeUndefined();
  });

  it("isCookiePath reflects omni_rt presence", () => {
    expect(isCookiePath(req({ [COOKIE_REFRESH]: "x" }))).toBe(true);
    expect(isCookiePath(req({}))).toBe(false);
  });
});

describe("mintCsrfToken", () => {
  it("produces a fresh ≥128-bit url-safe value each call", () => {
    const a = mintCsrfToken();
    const b = mintCsrfToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    // 24 bytes base64url → 32 chars (>128 bits).
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});
