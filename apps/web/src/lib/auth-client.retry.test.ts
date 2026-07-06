import { describe, expect, it, vi } from "vitest";
import { requestWithRefresh, SessionExpiredError } from "./auth-client";

function mockResponse(status: number): Response {
  return new Response(null, { status });
}

describe("requestWithRefresh (T-001-16 ★ — silent refresh on 401 + retry-once)", () => {
  it("returns the first response directly when it is not a 401", async () => {
    const send = vi.fn().mockResolvedValue(mockResponse(200));
    const refresh = vi.fn();

    const res = await requestWithRefresh(send, refresh);

    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("on 401: calls refresh exactly once, then retries send exactly once", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(401))
      .mockResolvedValueOnce(mockResponse(200));
    const refresh = vi.fn().mockResolvedValue(true);

    const res = await requestWithRefresh(send, refresh);

    expect(res.status).toBe(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("throws SessionExpiredError when refresh itself fails (never retries send again)", async () => {
    const send = vi.fn().mockResolvedValueOnce(mockResponse(401));
    const refresh = vi.fn().mockResolvedValue(false);

    await expect(requestWithRefresh(send, refresh)).rejects.toBeInstanceOf(SessionExpiredError);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1); // never retried — refresh failed
  });

  it("throws SessionExpiredError when the retried call still 401s (never loops a 3rd time)", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(401))
      .mockResolvedValueOnce(mockResponse(401));
    const refresh = vi.fn().mockResolvedValue(true);

    await expect(requestWithRefresh(send, refresh)).rejects.toBeInstanceOf(SessionExpiredError);

    expect(refresh).toHaveBeenCalledTimes(1); // exactly once, not looped
    expect(send).toHaveBeenCalledTimes(2); // original + one retry, no more
  });

  it("never calls refresh more than once even across multiple 401s (no infinite loop)", async () => {
    const send = vi.fn().mockResolvedValue(mockResponse(401));
    const refresh = vi.fn().mockResolvedValue(true);

    await expect(requestWithRefresh(send, refresh)).rejects.toBeInstanceOf(SessionExpiredError);

    expect(refresh.mock.calls.length).toBe(1);
    expect(send.mock.calls.length).toBe(2);
  });

  it("concurrent requestWithRefresh calls that both 401 share a single refresh (client-security review Important #2)", async () => {
    // Two independent authenticated calls (e.g. getSessions() + changePassword())
    // both fire around the same moment and both 401 on their first attempt.
    // A shared `refresh` fn (like the real silentRefresh's in-flight dedupe)
    // must only be invoked once in total, not once per caller.
    let refreshCallCount = 0;
    const sharedRefresh = vi.fn(async () => {
      refreshCallCount += 1;
      await Promise.resolve();
      return true;
    });

    const sendA = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(401))
      .mockResolvedValueOnce(mockResponse(200));
    const sendB = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(401))
      .mockResolvedValueOnce(mockResponse(200));

    // Both callers race concurrently against the SAME refresh reference —
    // this models what auth-client.ts actually wires (both call the module
    // singleton `silentRefresh`, which internally dedupes).
    const dedupedRefresh = (() => {
      let inflight: Promise<boolean> | null = null;
      return () => {
        if (inflight) return inflight;
        inflight = sharedRefresh().finally(() => {
          inflight = null;
        });
        return inflight;
      };
    })();

    const [resA, resB] = await Promise.all([
      requestWithRefresh(sendA, dedupedRefresh),
      requestWithRefresh(sendB, dedupedRefresh),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(refreshCallCount).toBe(1); // exactly ONE refresh across both callers
  });
});
