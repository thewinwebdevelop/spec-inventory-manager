/**
 * T-001-16 ★ — web token/cookie refresh flow.
 *
 * Contract: docs/features/F-001/api-spec.md §0 (LOCKED). Skill: client-security.
 *
 *  - Access token: in-memory only (token-store.ts), sent as
 *    `Authorization: Bearer <token>`.
 *  - Refresh token: httpOnly `omni_rt` cookie (web always sends
 *    `tokenTransport: "cookie"` at login) — this module never reads/stores a
 *    refresh-token string; it relies on the browser sending the cookie
 *    automatically (`credentials: "include"`, same-origin via the proxy).
 *  - `X-CSRF-Token` header (double-submit) is attached on every
 *    cookie-borne mutation that carries the refresh token: refresh, logout,
 *    change-password. `logout-all` is Bearer-only (access token, no refresh
 *    token / cookie involved, api-spec §2.5) so it does NOT get the CSRF
 *    header — there is no cookie authority to forge there.
 *  - On a 401 from an authenticated call, we attempt exactly ONE silent
 *    refresh, then retry the original call ONCE. A second failure surfaces
 *    to the caller as a session-expired condition — never loop, never retry
 *    more than once (client-security skill). Concurrent 401s across multiple
 *    in-flight requests share a single `/auth/refresh` call (single-flight
 *    dedupe, client-security review Important #2) so a loser never wrongly
 *    hits the benign-retry 401 and gets kicked out of a live session.
 *
 * We deliberately do NOT reshape the generated contract types — every
 * request/response body typed here comes from `@omnistock/contracts`
 * (`components["schemas"][...]`).
 */
import type { components } from "@omnistock/contracts";
import { AUTH_BASE } from "./api-base";
import { csrfHeader } from "./csrf";
import { clearAccessToken, getAccessToken, setAccessToken } from "./token-store";

export type SignupRequest = components["schemas"]["SignupRequest"];
export type SignupResponse = components["schemas"]["SignupResponse"];
export type LoginRequest = components["schemas"]["LoginRequest"];
export type TokenResponse = components["schemas"]["TokenResponse"];
export type SessionsResponse = components["schemas"]["SessionsResponse"];
export type ChangePasswordRequest = components["schemas"]["ChangePasswordRequest"];
export type ErrorResponse = components["schemas"]["ErrorResponse"];
export type OkResponse = components["schemas"]["OkResponse"];

/** Thrown for any non-2xx response; carries the parsed error envelope (when
 * present) and the HTTP status + Retry-After (for 429 throttle UX). */
export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;

  constructor(status: number, body: ErrorResponse | null, retryAfterSeconds?: number) {
    super(body?.error.message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error.code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Thrown when silent refresh + retry-once both fail — the caller (screen /
 * router) should route to /login with the session-expired toast
 * (ux-wireframe §7). */
export class SessionExpiredError extends Error {
  constructor() {
    super("session expired");
    this.name = "SessionExpiredError";
  }
}

/**
 * Shared predicate so every screen handles a dead session identically
 * (ux-wireframe §7: "เด้งออกไปหน้า /login ทันที + toast สุภาพ ... ใช้ข้อความ
 * เดียวกันทุกสาเหตุ") — client-security review Important #4. Screens should
 * `catch` a failed auth-client call, check `isSessionExpired(err)` FIRST
 * (before any other error-shape handling), and if true: clear local state,
 * redirect to `/login`, and show `auth.sessionExpired.toast` — never retry
 * against a session that's already confirmed dead.
 */
export function isSessionExpired(err: unknown): err is SessionExpiredError {
  return err instanceof SessionExpiredError;
}

function parseRetryAfter(res: Response): number | undefined {
  const header = res.headers.get("Retry-After");
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : undefined;
}

async function parseErrorBody(res: Response): Promise<ErrorResponse | null> {
  try {
    return (await res.json()) as ErrorResponse;
  } catch {
    return null;
  }
}

interface RequestOptions {
  auth?: boolean; // attach Authorization: Bearer <access token>
  csrf?: boolean; // attach X-CSRF-Token (cookie-borne mutations)
}

/**
 * All 8 F-001 auth endpoints — every `path` this module calls with is one of
 * these, so `rawRequest` can unconditionally prefix with `AUTH_BASE`
 * (`/auth`) rather than `API_BASE` (`/api`). Kept as an explicit allowlist
 * (not just "everything starts with /auth") so a future non-auth call added
 * to this file by mistake fails loudly in review rather than silently
 * path-missing `omni_rt`'s `Path=/auth` scope again.
 */
const AUTH_PATHS = new Set([
  "/signup",
  "/login",
  "/refresh",
  "/logout",
  "/logout-all",
  "/sessions",
  "/change-password",
]);

async function rawRequest(
  path: string,
  init: RequestInit,
  opts: RequestOptions,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (opts.auth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (opts.csrf) {
    for (const [k, v] of Object.entries(csrfHeader())) headers.set(k, v);
  }
  if (!AUTH_PATHS.has(path)) {
    throw new Error(`auth-client: unrecognized path "${path}" — not in AUTH_PATHS allowlist`);
  }
  return fetch(`${AUTH_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include", // send/receive omni_rt + omni_csrf cookies
  });
}

let inflightRefresh: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const res = await rawRequest(
    "/refresh",
    { method: "POST", body: JSON.stringify({}) },
    { csrf: true },
  );
  if (!res.ok) {
    clearAccessToken();
    return false;
  }
  const body = (await res.json()) as TokenResponse;
  setAccessToken(body.accessToken, body.expiresIn);
  return true;
}

/**
 * Calls POST /auth/refresh. On success, stores the new access token and
 * returns true. On failure, clears the access token and returns false — it
 * never throws, so callers can treat it as a plain boolean gate.
 *
 * Single-flight (client-security review Important #2): concurrent callers
 * (e.g. several authenticated requests all 401-ing around the same moment)
 * share ONE in-flight `/auth/refresh` call instead of each firing their own
 * — a second/third real refresh call would hit the just-rotated token as a
 * benign-retry `401` (arch §3.5 leeway window) purely due to a client-side
 * race, which would wrongly throw `SessionExpiredError` for a session that
 * is actually still alive. The in-flight promise is cleared once settled so
 * the NEXT genuine 401 (a later moment in time) starts a fresh refresh.
 */
export async function silentRefresh(): Promise<boolean> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = doRefresh().finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

/**
 * Authenticated request with silent-refresh-then-retry-once (T-001-16,
 * ux-wireframe §7). Pure orchestration over an injectable `send` so the
 * retry/refresh decision tree is unit-testable without a real network (see
 * auth-client.retry.test.ts).
 */
export async function requestWithRefresh(
  send: () => Promise<Response>,
  refresh: () => Promise<boolean> = silentRefresh,
): Promise<Response> {
  const first = await send();
  if (first.status !== 401) return first;

  const refreshed = await refresh();
  if (!refreshed) {
    throw new SessionExpiredError();
  }

  const second = await send();
  if (second.status === 401) {
    // Refreshed successfully but the retried call still 401'd (e.g. kicked
    // mid-flight, arch §7 "ถูก kick กลางการใช้งาน") — do not loop again.
    clearAccessToken();
    throw new SessionExpiredError();
  }
  return second;
}

// ---- Public endpoints (no access token needed) ----

export async function signup(req: SignupRequest): Promise<SignupResponse> {
  const res = await rawRequest("/signup", { method: "POST", body: JSON.stringify(req) }, {});
  if (res.status === 201) return (await res.json()) as SignupResponse;
  throw new ApiError(res.status, await parseErrorBody(res), parseRetryAfter(res));
}

export async function login(email: string, password: string, deviceId?: string): Promise<TokenResponse> {
  const req: LoginRequest = {
    email,
    password,
    tokenTransport: "cookie", // web ALWAYS declares cookie transport (H-1)
    ...(deviceId ? { deviceId } : {}),
  };
  const res = await rawRequest("/login", { method: "POST", body: JSON.stringify(req) }, {});
  if (res.status === 200) {
    const body = (await res.json()) as TokenResponse;
    setAccessToken(body.accessToken, body.expiresIn);
    return body;
  }
  throw new ApiError(res.status, await parseErrorBody(res), parseRetryAfter(res));
}

// ---- Authenticated endpoints (Bearer + silent-refresh-then-retry-once) ----

export async function getSessions(): Promise<SessionsResponse> {
  const res = await requestWithRefresh(() =>
    rawRequest("/sessions", { method: "GET" }, { auth: true }),
  );
  if (res.status === 200) return (await res.json()) as SessionsResponse;
  throw new ApiError(res.status, await parseErrorBody(res));
}

export async function logoutDevice(familyId?: string): Promise<void> {
  const res = await rawRequest(
    "/logout",
    { method: "POST", body: JSON.stringify(familyId ? { familyId } : {}) },
    { csrf: true },
  );
  if (res.status !== 204) {
    throw new ApiError(res.status, await parseErrorBody(res));
  }
  clearAccessToken();
}

export async function logoutAll(): Promise<void> {
  const res = await requestWithRefresh(() =>
    rawRequest("/logout-all", { method: "POST" }, { auth: true }),
  );
  if (res.status !== 204) {
    throw new ApiError(res.status, await parseErrorBody(res));
  }
  clearAccessToken();
}

export async function changePassword(req: ChangePasswordRequest): Promise<OkResponse> {
  const res = await requestWithRefresh(() =>
    rawRequest(
      "/change-password",
      { method: "POST", body: JSON.stringify(req) },
      { auth: true, csrf: true },
    ),
  );
  if (res.status === 200) return (await res.json()) as OkResponse;
  throw new ApiError(res.status, await parseErrorBody(res), parseRetryAfter(res));
}
