// ★ B-7 — the two S6 lists are never "fresh enough" to skip a refetch.
//
// The app-wide default is `staleTime: 30_000`, which is right for data that
// changes when the person looking at it changes something. These two lists are
// the opposite case and the default cannot tell: the whole feature is waiting
// for somebody ELSE to accept an invitation, on another machine. No mutation in
// this tab invalidates anything, and `refetchOnWindowFocus` never fires because
// the tab never lost focus.
//
// The cost of the default here was concrete: an Owner who invited somebody,
// sent the link over LINE and came back to the screen saw the invitation still
// pending and the new member missing, for up to thirty seconds. The browser
// lane hit it in three separate files before it was believed.
//
// This test reads the options the hooks hand to TanStack Query, rather than
// asserting on a rendered screen — the rule being pinned is a caching policy,
// and that is where it lives.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/** Captures the options each hook hands to TanStack Query. */
const useQuery = vi.fn((_options: Record<string, unknown>) => ({
  data: undefined,
  isPending: true,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: Record<string, unknown>) => useQuery(options),
}));

vi.mock("../../../lib/api/use-org-api-client", () => ({
  useOrgApiClient: () => ({ GET: vi.fn() }),
}));

vi.mock("../../../lib/org/org-context", () => ({
  useActiveOrg: () => ({ orgId: "org_1" }),
}));

import { useMembers, useInvitations, useRoles } from "./use-members";

function optionsOf(call: number): { staleTime?: number; queryKey?: unknown } {
  const options = useQuery.mock.calls.at(call)?.[0];
  expect(options, `no useQuery call at index ${call}`).toBeDefined();
  return options as { staleTime?: number; queryKey?: unknown };
}

beforeEach(() => useQuery.mockClear());

describe("B-7 · the member and invitation lists refetch on revisit", () => {
  it("★ useMembers sets staleTime 0 — it reports what other people did", () => {
    renderHook(() => useMembers("active"));

    expect(useQuery).toHaveBeenCalledTimes(1);
    expect(optionsOf(0).staleTime).toBe(0);
  });

  it("★ useInvitations sets staleTime 0 — an accepted invitation leaves this list", () => {
    renderHook(() => useInvitations("pending"));

    expect(optionsOf(0).staleTime).toBe(0);
  });

  it("the roles list keeps the app default — it is fixed until F-003", () => {
    // The distinction is the point: a shop has exactly the three system roles
    // in F-002, so re-asking on every visit would be a request that cannot
    // return anything new. Overriding everything "to be safe" would make the
    // override meaningless.
    renderHook(() => useRoles());

    expect(optionsOf(0).staleTime).toBeUndefined();
  });
});
