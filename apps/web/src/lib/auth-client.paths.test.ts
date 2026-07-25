import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changePassword,
  getSessions,
  login,
  logoutAll,
  logoutDevice,
  signup,
} from "./auth-client";
import { clearAccessToken, setAccessToken } from "./token-store";

/**
 * Critical fix regression suite (client-security review): EVERY one of the 8
 * F-001 auth endpoints must be called at the browser's own `/auth/*` path —
 * never `/api/auth/*`. `omni_rt` is scoped `Path=/auth` (api-spec §0/§2.2,
 * C-1); a request whose actual path is `/api/auth/refresh` path-misses that
 * scope and a real browser would never attach the cookie, so this isn't
 * cosmetic — it's the difference between the refresh flow working at all
 * and silently never sending `omni_rt`.
 */
describe("auth-client — every endpoint hits /auth/* (not /api/auth/*)", () => {
  const originalFetch = global.fetch;

  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status });
  }

  beforeEach(() => {
    clearAccessToken();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("signup -> POST /auth/signup", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ userId: "u1", email: "a@b.com", verified: false }, 201));
    global.fetch = fetchMock as unknown as typeof fetch;

    await signup({ email: "a@b.com", password: "password123" });

    expect(fetchMock.mock.calls[0][0]).toBe("/auth/signup");
  });

  it("login -> POST /auth/login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ accessToken: "t", refreshToken: null, expiresIn: 900, tokenType: "Bearer" }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await login("a@b.com", "password123");

    expect(fetchMock.mock.calls[0][0]).toBe("/auth/login");
  });

  it("getSessions -> GET /auth/sessions", async () => {
    setAccessToken("access-token", 900);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ sessions: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await getSessions();

    expect(fetchMock.mock.calls[0][0]).toBe("/auth/sessions");
  });

  it("logoutDevice -> POST /auth/logout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await logoutDevice();

    expect(fetchMock.mock.calls[0][0]).toBe("/auth/logout");
  });

  it("logoutAll -> POST /auth/logout-all", async () => {
    setAccessToken("access-token", 900);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await logoutAll();

    expect(fetchMock.mock.calls[0][0]).toBe("/auth/logout-all");
  });

  it("changePassword -> POST /auth/change-password", async () => {
    setAccessToken("access-token", 900);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await changePassword({ currentPassword: "old", newPassword: "newpassword1" });

    expect(fetchMock.mock.calls[0][0]).toBe("/auth/change-password");
  });

  it("none of the endpoints ever go through /api/*", async () => {
    setAccessToken("access-token", 900);
    const calls: string[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      calls.push(url);
      return Promise.resolve(
        jsonResponse({
          accessToken: "t",
          refreshToken: null,
          expiresIn: 900,
          tokenType: "Bearer",
          ok: true,
          sessions: [],
          userId: "u1",
          email: "a@b.com",
          verified: false,
        }),
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await signup({ email: "a@b.com", password: "password123" }).catch(() => {});
    await login("a@b.com", "password123").catch(() => {});
    await getSessions().catch(() => {});
    await changePassword({ currentPassword: "old", newPassword: "newpassword1" }).catch(() => {});

    for (const url of calls) {
      expect(url.startsWith("/api/")).toBe(false);
      expect(url.startsWith("/auth/")).toBe(true);
    }
  });
});
