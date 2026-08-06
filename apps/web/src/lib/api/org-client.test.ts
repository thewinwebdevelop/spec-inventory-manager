// T-002-W1 ★ — the org-scoped transport, driven through the REAL generated
// client rather than by calling `createOrgFetch` directly where that is
// possible. What we care about is what goes on the wire when a feature makes
// an ordinary typed call, so that is what these tests assert on.
import { describe, it, expect, vi } from "vitest";
import { createOrgApiClient, createOrgFetch, isValidOrgId, ORG_HEADER, unwrap } from "./org-client";
import { ApiRequestError, toApiFailure } from "./error";
import { SessionExpiredError } from "../auth-client";
import { API_BASE, AUTH_BASE } from "../api-base";

const ORG = "org_2n4xk9";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Records every Request that reached the network. */
function recordingFetch(...responses: Response[]) {
  const seen: Request[] = [];
  let i = 0;
  const fetchImpl = vi.fn(async (input: Request | string | URL) => {
    const req = input as Request;
    seen.push(req);
    const res = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return res.clone();
  }) as unknown as typeof globalThis.fetch;
  return { fetchImpl, seen };
}

describe("createOrgFetch — the header a feature cannot forget", () => {
  it("★ attaches X-Organization-Id on every request", async () => {
    const { fetchImpl, seen } = recordingFetch(jsonResponse(200, { items: [] }));
    const orgFetch = createOrgFetch(ORG, { getToken: () => "tok", fetchImpl });

    await orgFetch(new Request("http://localhost/api/orgs/x/members"));

    expect(seen).toHaveLength(1);
    expect(seen[0].headers.get(ORG_HEADER)).toBe(ORG);
  });

  it("attaches the in-memory access token as Bearer", async () => {
    const { fetchImpl, seen } = recordingFetch(jsonResponse(200, {}));
    await createOrgFetch(ORG, { getToken: () => "tok-123", fetchImpl })(
      new Request("http://localhost/api/x"),
    );
    expect(seen[0].headers.get("Authorization")).toBe("Bearer tok-123");
  });

  it("sends no Authorization header at all when there is no token", async () => {
    // Not `Bearer null`/`Bearer undefined` — a malformed credential is worse
    // than none: it can be logged, and it turns "not logged in" into
    // "presented a bad token".
    const { fetchImpl, seen } = recordingFetch(jsonResponse(200, {}));
    await createOrgFetch(ORG, { getToken: () => null, fetchImpl })(
      new Request("http://localhost/api/x"),
    );
    expect(seen[0].headers.has("Authorization")).toBe(false);
  });

  it("★ a caller cannot override the org header with a different org", async () => {
    // The whole safety argument of web.md §3.2 is that the org comes from the
    // URL, structurally. If a hand-set header could win, "every query is
    // org-scoped" would be back to being a discipline.
    const { fetchImpl, seen } = recordingFetch(jsonResponse(200, {}));
    await createOrgFetch(ORG, { getToken: () => "tok", fetchImpl })(
      new Request("http://localhost/api/x", { headers: { [ORG_HEADER]: "org_someone_else" } }),
    );
    expect(seen[0].headers.get(ORG_HEADER)).toBe(ORG);
  });

  it("refuses an org id that has no business being in a header", () => {
    expect(() => createOrgFetch("org_1\r\nX-Evil: 1")).toThrow(/invalid organization id/);
    expect(() => createOrgFetch("")).toThrow(/invalid organization id/);
    expect(isValidOrgId("org_2n4xk9")).toBe(true);
    expect(isValidOrgId("org 1")).toBe(false);
    expect(isValidOrgId("a".repeat(65))).toBe(false);
  });
});

describe("createOrgFetch — silent refresh, exactly once", () => {
  it("retries once after a 401 and carries the NEW token", async () => {
    let token = "stale";
    const { fetchImpl, seen } = recordingFetch(jsonResponse(401, {}), jsonResponse(200, { ok: true }));
    const orgFetch = createOrgFetch(ORG, {
      getToken: () => token,
      fetchImpl,
      refresh: async () => {
        token = "fresh";
        return true;
      },
    });

    const res = await orgFetch(new Request("http://localhost/api/x"));

    expect(res.status).toBe(200);
    expect(seen).toHaveLength(2);
    // The retry must not replay the dead token — that is the whole reason the
    // headers are rebuilt inside `send` rather than once outside it.
    expect(seen[0].headers.get("Authorization")).toBe("Bearer stale");
    expect(seen[1].headers.get("Authorization")).toBe("Bearer fresh");
  });

  it("★ gives up as session-expired instead of looping", async () => {
    // Refresh keeps succeeding but the call keeps 401-ing (kicked mid-flight).
    // The retry budget must still be exactly one.
    const { fetchImpl, seen } = recordingFetch(jsonResponse(401, {}));
    const refresh = vi.fn(async () => true);
    const orgFetch = createOrgFetch(ORG, { getToken: () => "tok", fetchImpl, refresh });

    await expect(orgFetch(new Request("http://localhost/api/x"))).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    // 2 org calls and 1 refresh. If either ever grows, we are looping against
    // a dead session — the failure mode the F-001 review named explicitly.
    expect(seen).toHaveLength(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(toApiFailure(new SessionExpiredError())).toEqual({ kind: "auth-expired" });
  });

  it("a failed refresh gives up without a second org call", async () => {
    const { fetchImpl, seen } = recordingFetch(jsonResponse(401, {}));
    const orgFetch = createOrgFetch(ORG, {
      getToken: () => "tok",
      fetchImpl,
      refresh: async () => false,
    });

    await expect(orgFetch(new Request("http://localhost/api/x"))).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    expect(seen).toHaveLength(1);
  });

  it("★ never retries a non-401 — a POST must not be replayed", async () => {
    // No Idempotency-Key exists yet (api-spec §1 item 20). A second POST here
    // would be a duplicate invitation/member write that nothing collapses.
    const { fetchImpl, seen } = recordingFetch(jsonResponse(409, { error: { code: "CONFLICT", message: "x" } }));
    const refresh = vi.fn(async () => true);
    const orgFetch = createOrgFetch(ORG, { getToken: () => "tok", fetchImpl, refresh });

    const res = await orgFetch(
      new Request("http://localhost/api/x", { method: "POST", body: "{}" }),
    );

    expect(res.status).toBe(409);
    expect(seen).toHaveLength(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("a retried POST still has its body (the clone is real)", async () => {
    const { fetchImpl, seen } = recordingFetch(jsonResponse(401, {}), jsonResponse(200, { ok: true }));
    const orgFetch = createOrgFetch(ORG, {
      getToken: () => "tok",
      fetchImpl,
      refresh: async () => true,
    });

    await orgFetch(
      new Request("http://localhost/api/x", { method: "POST", body: JSON.stringify({ name: "ร้าน" }) }),
    );

    expect(seen).toHaveLength(2);
    await expect(seen[1].clone().text()).resolves.toBe(JSON.stringify({ name: "ร้าน" }));
  });
});

describe("unwrap — the envelope survives to the failure taxonomy", () => {
  it("returns data on success", async () => {
    await expect(
      unwrap(Promise.resolve({ data: { items: [1] }, response: new Response(null, { status: 200 }) })),
    ).resolves.toEqual({ items: [1] });
  });

  it("★ keeps details.reason so a busy 409 is not flattened into a plain conflict", async () => {
    const promise = Promise.resolve({
      error: { error: { code: "CONFLICT", message: "x", details: { reason: "busy" } } },
      response: new Response(null, { status: 409 }),
    });

    const err = await unwrap(promise).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiRequestError);
    expect(toApiFailure(err)).toEqual({ kind: "busy" });
  });

  it("keeps fieldErrors on a 422", async () => {
    const err = await unwrap(
      Promise.resolve({
        error: { error: { code: "TAX_ID_INVALID", message: "x", fieldErrors: { taxId: "ไม่ถูกต้อง" } } },
        response: new Response(null, { status: 422 }),
      }),
    ).catch((e: unknown) => e);

    expect(toApiFailure(err)).toEqual({
      kind: "validation",
      code: "TAX_ID_INVALID",
      fieldErrors: { taxId: "ไม่ถูกต้อง" },
    });
  });

  it("keeps Retry-After on a 429", async () => {
    const err = await unwrap(
      Promise.resolve({
        error: { error: { code: "RATE_LIMITED", message: "x" } },
        response: new Response(null, { status: 429, headers: { "Retry-After": "30" } }),
      }),
    ).catch((e: unknown) => e);

    expect(toApiFailure(err)).toEqual({ kind: "throttled", retryAfterSeconds: 30 });
  });
});

describe("createOrgApiClient — through the generated client", () => {
  it("★ a real typed call carries the org header", async () => {
    // `baseUrl` is a test seam: jsdom's `Request` rejects the relative `/api`
    // that a browser resolves fine. The base is still API_BASE-shaped, and
    // the default is pinned by the next test.
    const { fetchImpl, seen } = recordingFetch(jsonResponse(200, { status: "ok" }));
    const client = createOrgApiClient(ORG, {
      getToken: () => "tok",
      fetchImpl,
      baseUrl: "http://api.test/api",
    });

    await client.GET("/health");

    expect(seen).toHaveLength(1);
    expect(seen[0].headers.get(ORG_HEADER)).toBe(ORG);
    expect(new URL(seen[0].url).pathname).toBe("/api/health");
  });

  it("★ org traffic is based at /api, never /auth", () => {
    // `omni_rt` is scoped `Path=/auth` (F-001 client-security review, C-1).
    // Basing org calls under `/auth` would make the browser attach the
    // refresh cookie to every org request — the exact thing that scope
    // exists to prevent.
    expect(API_BASE).toBe("/api");
    expect(API_BASE.startsWith(AUTH_BASE)).toBe(false);
  });
});
