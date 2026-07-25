import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword, SessionExpiredError } from "./auth-client";
import { clearAccessToken, setAccessToken } from "./token-store";

/**
 * Cross-platform bug fix (mirrors apps/mobile/lib/auth/auth_client.dart
 * T-001-17's `isAuthExpiry` predicate): `POST /auth/change-password` is
 * double-duty on 401 (api-spec §2.7) —
 *
 *   (a) dead/expired access token (bare Bearer-guard rejection, no app-level
 *       `code`, or a code other than `INVALID_CREDENTIALS`) -> genuine
 *       auth-expiry: silent-refresh, retry once, SessionExpiredError only on
 *       a second failure.
 *   (b) wrong `currentPassword` (`401 INVALID_CREDENTIALS`, api-spec §2.7) ->
 *       a domain rejection that must be surfaced to the caller as-is — it
 *       must NEVER trigger silent-refresh, must NEVER wipe the access token,
 *       and must NEVER throw SessionExpiredError. A password typo is not a
 *       dead session.
 */
describe("changePassword — 401 double-duty (wrong-current-password vs token-expiry)", () => {
  const originalFetch = global.fetch;

  function jsonResponse(body: unknown, status: number) {
    return new Response(JSON.stringify(body), { status });
  }

  beforeEach(() => {
    setAccessToken("access-token", 900);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    clearAccessToken();
  });

  it("wrong-current-password 401 (INVALID_CREDENTIALS): surfaces the domain ApiError, does NOT call /auth/refresh, does NOT wipe the access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: "INVALID_CREDENTIALS", message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" } }, 401),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      changePassword({ currentPassword: "wrong", newPassword: "newpassword1" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      code: "INVALID_CREDENTIALS",
    });

    // Exactly one call — the change-password attempt itself. No silent
    // refresh (which would hit POST /auth/refresh) and no retry.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/auth/change-password");

    // The access token must NOT have been wiped — this is not a dead
    // session, just a rejected form submission.
    const { getAccessToken } = await import("./token-store");
    expect(getAccessToken()).toBe("access-token");
  });

  it("genuine token-expiry 401 (no INVALID_CREDENTIALS code): still silent-refreshes + retries once, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      // First attempt: bare 401 from the Bearer guard (no app-level code at
      // all) — this is a real access-token expiry, not a domain rejection.
      .mockResolvedValueOnce(jsonResponse({}, 401))
      // /auth/refresh succeeds
      .mockResolvedValueOnce(
        jsonResponse(
          { accessToken: "new-access-token", refreshToken: null, expiresIn: 900, tokenType: "Bearer" },
          200,
        ),
      )
      // Retried change-password call succeeds
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await changePassword({ currentPassword: "old", newPassword: "newpassword1" });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("/auth/change-password");
    expect(fetchMock.mock.calls[1][0]).toBe("/auth/refresh");
    expect(fetchMock.mock.calls[2][0]).toBe("/auth/change-password");
  });

  it("genuine token-expiry 401 that persists after refresh+retry: throws SessionExpiredError (never loops)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 401)) // first attempt: expiry
      .mockResolvedValueOnce(
        jsonResponse(
          { accessToken: "new-access-token", refreshToken: null, expiresIn: 900, tokenType: "Bearer" },
          200,
        ),
      ) // refresh succeeds
      .mockResolvedValueOnce(jsonResponse({}, 401)); // retried call still 401s (no code) — genuinely dead
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      changePassword({ currentPassword: "old", newPassword: "newpassword1" }),
    ).rejects.toBeInstanceOf(SessionExpiredError);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("wrong-current-password 401 on the retried call after a real refresh is still surfaced as the domain error, not SessionExpiredError", async () => {
    // Edge case: first 401 is a genuine expiry (no code) -> refresh succeeds
    // -> the retried call now genuinely evaluates the (still wrong)
    // currentPassword and correctly returns 401 INVALID_CREDENTIALS. This
    // must surface as the domain ApiError, not a session-expired kick.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(
        jsonResponse(
          { accessToken: "new-access-token", refreshToken: null, expiresIn: 900, tokenType: "Bearer" },
          200,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "INVALID_CREDENTIALS", message: "..." } }, 401),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      changePassword({ currentPassword: "wrong", newPassword: "newpassword1" }),
    ).rejects.toMatchObject({ name: "ApiError", status: 401, code: "INVALID_CREDENTIALS" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
