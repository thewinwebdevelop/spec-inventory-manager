import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { silentRefresh } from "./auth-client";
import { clearAccessToken, getAccessToken } from "./token-store";

function setCsrfCookie(value: string) {
  document.cookie = `omni_csrf=${value}`;
}

function clearCookies() {
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  });
}

describe("silentRefresh (T-001-16 ★)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearAccessToken();
    clearCookies();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("calls POST /auth/refresh (browser path, NOT /api/auth/refresh) with credentials: 'include'", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "new-token", refreshToken: null, expiresIn: 900, tokenType: "Bearer" }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await silentRefresh();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    // Critical fix (client-security review, Option A): must be the browser's
    // own /auth/* path, not /api/auth/* — omni_rt is scoped Path=/auth, so a
    // request whose actual path is /api/auth/refresh path-misses that scope
    // and the browser would never attach the cookie in production.
    expect(url).toBe("/auth/refresh");
    expect(url).not.toMatch(/^\/api\//);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
  });

  it("attaches X-CSRF-Token header when the omni_csrf cookie is present", async () => {
    setCsrfCookie("csrf-value-123");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "t", refreshToken: null, expiresIn: 900, tokenType: "Bearer" }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await silentRefresh();

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("X-CSRF-Token")).toBe("csrf-value-123");
  });

  it("does NOT attach X-CSRF-Token when there is no csrf cookie (body transport)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "t", refreshToken: null, expiresIn: 900, tokenType: "Bearer" }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await silentRefresh();

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.has("X-CSRF-Token")).toBe(false);
  });

  it("on success: stores the new access token in memory and returns true", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: "rotated-access-token", refreshToken: null, expiresIn: 900, tokenType: "Bearer" }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const ok = await silentRefresh();

    expect(ok).toBe(true);
    expect(getAccessToken()).toBe("rotated-access-token");
  });

  it("on failure (401 INVALID_REFRESH): clears the access token and returns false", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "INVALID_REFRESH", message: "..." } }), {
        status: 401,
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const ok = await silentRefresh();

    expect(ok).toBe(false);
    expect(getAccessToken()).toBeNull();
  });

  it("never puts the refresh token anywhere client-readable — response body refreshToken is ignored/not stored", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: "a", refreshToken: null, expiresIn: 900, tokenType: "Bearer" }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await silentRefresh();

    // The module has no API surface to read back a refresh token — asserted
    // structurally in token-store.test.ts. Here we just confirm the access
    // token store holds ONLY the access token value.
    expect(getAccessToken()).toBe("a");
  });

  it("single-flight (client-security review Important #2): concurrent calls share ONE /auth/refresh fetch", async () => {
    let resolveResponse!: (r: Response) => void;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pendingResponse);
    global.fetch = fetchMock as unknown as typeof fetch;

    // Simulate several requests 401-ing around the same moment and each
    // independently calling silentRefresh() — this must NOT fire 3 separate
    // POST /auth/refresh calls (a second/third real call would consume the
    // just-rotated token and hit a benign-retry 401, wrongly manufacturing
    // a dead-session signal for an actually-live session).
    const call1 = silentRefresh();
    const call2 = silentRefresh();
    const call3 = silentRefresh();

    expect(fetchMock).toHaveBeenCalledTimes(1); // still exactly one in-flight fetch

    resolveResponse(
      new Response(
        JSON.stringify({ accessToken: "shared-token", refreshToken: null, expiresIn: 900, tokenType: "Bearer" }),
        { status: 200 },
      ),
    );

    const [ok1, ok2, ok3] = await Promise.all([call1, call2, call3]);

    expect(fetchMock).toHaveBeenCalledTimes(1); // still exactly one, after all callers resolved
    expect(ok1).toBe(true);
    expect(ok2).toBe(true);
    expect(ok3).toBe(true);
    expect(getAccessToken()).toBe("shared-token");
  });

  it("single-flight clears after settling — a LATER (non-concurrent) call fires a fresh fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ accessToken: "first", refreshToken: null, expiresIn: 900, tokenType: "Bearer" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ accessToken: "second", refreshToken: null, expiresIn: 900, tokenType: "Bearer" }),
          { status: 200 },
        ),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    await silentRefresh();
    expect(getAccessToken()).toBe("first");

    await silentRefresh();
    expect(getAccessToken()).toBe("second");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
