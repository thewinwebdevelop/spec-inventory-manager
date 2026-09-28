// T-003-W01 ★ — the guard is actually ON a route, not just tested in isolation.
//
// `/o/[orgId]/settings/members` said "No RouteGuard yet" (debt W-16) while the
// shell's comment claimed that typing the URL "lands on a ForbiddenPanel". This
// renders the real page with a member who lacks `manage_members` and checks
// both halves: the panel shows, and the screen behind it never fires a request.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/o/org_1/settings/members",
}));

import MembersPage from "../../app/o/[orgId]/settings/members/page";
import { ActiveOrgProvider, type ActiveOrg } from "../../lib/org/org-context";
import { FORBIDDEN_PANEL_COPY } from "../ui/ForbiddenPanel";

function renderPage(capabilities: string[]) {
  const fetchImpl = vi.fn(async () => new Response("{}", { status: 403 }));
  vi.stubGlobal("fetch", fetchImpl);
  const org: ActiveOrg = {
    orgId: "org_1",
    name: "ร้านหอมกรุ่นเบเกอรี่",
    capabilities: new Set(capabilities),
    roleKey: null,
    roleName: "พนักงาน",
    profile: {} as ActiveOrg["profile"],
  };
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ActiveOrgProvider value={org}>
        <MembersPage />
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
  return fetchImpl;
}

describe("★ /o/[orgId]/settings/members is behind RouteGuard(manage_members)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a member without manage_members gets the ForbiddenPanel and no members request", () => {
    const fetchImpl = renderPage(["view_products"]);
    expect(screen.getByRole("alert")).toHaveTextContent(FORBIDDEN_PANEL_COPY.title);
    // The only request allowed is none at all: `invalidateQueries` on a profile
    // query nobody observes here does not fetch, and MembersScreen never mounted.
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
