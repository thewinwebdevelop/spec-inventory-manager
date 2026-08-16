// ★ T-002-W4 — the reveal request declares JSON, and asks for nothing else.
//
// FOUND IN THE BROWSER, not here, and that is the point of the case. The
// request carries no body, so `openapi-fetch` sent no `Content-Type`; the
// route is behind `JsonOnlyGuard`, which answers `415` to anything that is not
// `application/json`. So "แสดงเลขเต็ม" failed for every user of every shop,
// and both sides' unit tests were green the whole time — the API's tests send
// the header through supertest, and the card's tests mock this hook away.
//
// The other half of the case is about what must NOT change: this is the only
// response in the system carrying a full tax id (a national ID when the
// taxpayer is a person), so the request stays bodyless and the result stays
// out of any cache.
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const post = vi.fn().mockResolvedValue({ data: { taxId: "0105560123454", revealedAt: "now" } });

vi.mock("../../../lib/api/use-org-api-client", () => ({
  useOrgApiClient: () => ({ POST: post }),
}));

vi.mock("../../../lib/org/org-context", () => ({
  useActiveOrg: () => ({ orgId: "org_1" }),
}));

import { useRevealTaxId } from "./use-reveal-tax-id";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useRevealTaxId", () => {
  it("★ sends Content-Type: application/json — without it the server answers 415", async () => {
    const { result } = renderHook(() => useRevealTaxId(), { wrapper });

    act(() => result.current.mutate());
    await waitFor(() => expect(post).toHaveBeenCalled());

    const [path, options] = post.mock.calls[0];
    expect(path).toBe("/orgs/{orgId}/tax-profile/reveal");
    expect(options.params).toEqual({ path: { orgId: "org_1" } });
    expect(
      options.headers,
      "JsonOnlyGuard rejects a request that does not declare JSON, body or no body",
    ).toMatchObject({ "Content-Type": "application/json" });
  });

  it("sends NO body — the shop and the caller are already in the request", async () => {
    post.mockClear();
    const { result } = renderHook(() => useRevealTaxId(), { wrapper });

    act(() => result.current.mutate());
    await waitFor(() => expect(post).toHaveBeenCalled());

    // A body here would be a place for a future caller to pass "which tax id",
    // and §3.16's whole shape is that there is exactly one and the server
    // already knows which.
    expect(post.mock.calls[0][1].body).toBeUndefined();
  });
});
