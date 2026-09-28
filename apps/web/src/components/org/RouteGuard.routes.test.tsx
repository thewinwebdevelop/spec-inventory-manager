// T-003-W01 ★ — the guard is actually ON a route, not just tested in isolation.
//
// `/o/[orgId]/settings/members` said "No RouteGuard yet" (debt W-16) while the
// shell's comment claimed that typing the URL "lands on a ForbiddenPanel". This
// renders the real page and checks it in BOTH directions: a member without
// `manage_members` gets the panel and the screen never mounts; an Owner
// (`full_access` only) and an Admin (`manage_members`) get the screen. The
// allow cases are what pin WHICH capability the page gates on — a page gated
// on the wrong one (e.g. `manage_roles`) turns them red.
//
// `MembersScreen` is replaced by a mount-recording stub: the question here is
// the page's gate, and the real screen has its own suites.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/o/org_1/settings/members",
}));

const screenMounted = vi.fn();
vi.mock("../../features/org/components/MembersScreen", () => ({
  MembersScreen: () => {
    screenMounted();
    return <div>MEMBERS_SCREEN</div>;
  },
}));

import MembersPage from "../../app/o/[orgId]/settings/members/page";
import { ActiveOrgProvider, type ActiveOrg } from "../../lib/org/org-context";
import { CAPABILITY_MANAGE_MEMBERS } from "../../lib/org/capability";
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
  afterEach(() => {
    vi.unstubAllGlobals();
    screenMounted.mockClear();
  });

  it("a member without manage_members gets the ForbiddenPanel; the screen never mounts", () => {
    const fetchImpl = renderPage(["view_products"]);
    expect(screen.getByRole("alert")).toHaveTextContent(FORBIDDEN_PANEL_COPY.title);
    expect(screenMounted).not.toHaveBeenCalled();
    expect(screen.queryByText("MEMBERS_SCREEN")).not.toBeInTheDocument();
    // `invalidateQueries` on a profile query nobody observes here does not fetch.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("★ an Owner holding ONLY full_access sees the members screen", () => {
    renderPage(["full_access"]);
    expect(screen.getByText("MEMBERS_SCREEN")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("★ an Admin holding manage_members (and not manage_roles) sees the members screen", () => {
    renderPage([CAPABILITY_MANAGE_MEMBERS, "view_products"]);
    expect(screen.getByText("MEMBERS_SCREEN")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
