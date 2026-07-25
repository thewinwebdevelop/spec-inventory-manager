import { afterEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { csrfHeader, readCsrfCookie } from "./csrf";

function setCookie(cookieStr: string) {
  document.cookie = cookieStr;
}

function clearAllCookies() {
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
}

describe("csrf (T-001-16 ★ — X-CSRF-Token double-submit)", () => {
  afterEach(() => {
    clearAllCookies();
  });

  it("readCsrfCookie returns null when omni_csrf cookie is absent (body/mobile transport)", () => {
    expect(readCsrfCookie()).toBeNull();
  });

  it("readCsrfCookie reads the omni_csrf cookie value", () => {
    setCookie("omni_csrf=abc123token");
    expect(readCsrfCookie()).toBe("abc123token");
  });

  it("readCsrfCookie decodes a URL-encoded cookie value", () => {
    setCookie(`omni_csrf=${encodeURIComponent("a+b/c=")}`);
    expect(readCsrfCookie()).toBe("a+b/c=");
  });

  it("csrfHeader returns {} when there is no csrf cookie (no header sent)", () => {
    expect(csrfHeader()).toEqual({});
  });

  it("csrfHeader returns X-CSRF-Token when the cookie is present", () => {
    setCookie("omni_csrf=xyz789");
    expect(csrfHeader()).toEqual({ "X-CSRF-Token": "xyz789" });
  });

  it("csrfHeader ignores unrelated cookies", () => {
    setCookie("some_other_cookie=irrelevant");
    expect(csrfHeader()).toEqual({});
  });
});

/**
 * Regression coverage for the ★ client-security Critical finding: the
 * describe block above runs under vitest's shared jsdom document (default
 * URL `http://localhost:3000/`), and every `setCookie()` call there omits an
 * explicit `Path=`, which makes the cookie inherit the CURRENT document path
 * (`/`) — matching everything. That gave a false green regardless of what
 * `Path=` the real server actually sent, and would never have caught the
 * real bug (auth calls going through `/api/auth/*`, so `omni_rt`'s real
 * `Path=/auth` scope never actually covered the request path).
 *
 * These cases spin up a fresh `JSDOM` per test with an explicit page URL so
 * `Path=` scoping is enforced the same way a real browser does — proving
 * the CONVERGED CONTRACT choice (`omni_csrf` → `Path=/`, readable from any
 * app page) actually works, and demonstrating why leaving `omni_csrf`
 * scoped `Path=/auth` (like `omni_rt`) would have broken reading it from an
 * app page like `/settings/security` (change-password lives outside
 * `/auth/*`).
 */
describe("csrf cookie Path scoping (regression — models real browser Path= behavior)", () => {
  it("a Path=/ cookie (the converged omni_csrf contract) is readable from an app page like /settings/security", () => {
    const dom = new JSDOM("<html></html>", { url: "http://localhost:3001/settings/security" });
    dom.window.document.cookie = "omni_csrf=readable-everywhere; Path=/";
    expect(dom.window.document.cookie).toContain("omni_csrf=readable-everywhere");
  });

  it("demonstrates the bug this fix avoids: a Path=/auth cookie is NOT visible from /settings/security", () => {
    const dom = new JSDOM("<html></html>", { url: "http://localhost:3001/settings/security" });
    dom.window.document.cookie = "omni_csrf=should-not-be-visible-here; Path=/auth";
    // If omni_csrf had stayed Path=/auth (like omni_rt), the change-password
    // page (outside /auth/*) could never read it to build X-CSRF-Token —
    // this is exactly why the converged contract moved omni_csrf to Path=/.
    expect(dom.window.document.cookie).not.toContain("should-not-be-visible-here");
  });

  it("a Path=/auth cookie IS visible when the current page is under /auth/*", () => {
    const dom = new JSDOM("<html></html>", { url: "http://localhost:3001/auth/refresh" });
    dom.window.document.cookie = "omni_rt_shape_check=visible; Path=/auth";
    expect(dom.window.document.cookie).toContain("visible");
  });
});
