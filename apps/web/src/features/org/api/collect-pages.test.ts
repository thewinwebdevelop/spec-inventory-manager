// T-003-W10 fix r1 (security review M-1) — `collectPages` reads a cursor list
// to the end, and says so only when it really did.
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../lib/api/use-org-api-client", () => ({ useOrgApiClient: () => ({}) }));
vi.mock("../../../lib/org/org-context", () => ({ useActiveOrg: () => ({ orgId: "org_1" }) }));

import { collectPages } from "./use-members";

describe("collectPages", () => {
  it("★ follows nextCursor across pages and returns every item, complete", async () => {
    const fetchPage = vi.fn(async (cursor: string | undefined) =>
      cursor === undefined ? { items: [1, 2], nextCursor: "c2" } : { items: [3], nextCursor: null },
    );
    expect(await collectPages(fetchPage)).toEqual({ items: [1, 2, 3], nextCursor: null });
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([undefined, "c2"]);
  });

  it("★ stops at the page cap and reports the list as INCOMPLETE (cursor kept)", async () => {
    const fetchPage = vi.fn(async (cursor: string | undefined) => ({
      items: [cursor ?? "start"],
      nextCursor: `after-${cursor ?? "start"}`,
    }));
    const result = await collectPages(fetchPage, 3);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).not.toBeNull();
  });

  it("a request error propagates (fail loud, never a partial 'empty')", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [1], nextCursor: "c2" })
      .mockRejectedValueOnce(new Error("503"));
    await expect(collectPages(fetchPage)).rejects.toThrow("503");
  });
});
