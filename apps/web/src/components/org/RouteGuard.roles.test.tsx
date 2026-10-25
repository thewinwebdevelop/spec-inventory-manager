// T-003-W05 ★ (EW3-11 unit half) — /o/[orgId]/settings/roles is behind
// RouteGuard(manage_roles), with the roles ForbiddenPanel copy. Both directions:
// manage_members alone must NOT open it; full_access (Owner) and manage_roles must.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/o/org_1/settings/roles",
}));

const mounted = vi.fn();
vi.mock("../../features/org/roles/RolesScreen", () => ({
  RolesScreen: () => {
    mounted();
    return <div>ROLES_SCREEN</div>;
  },
}));

import RolesPage from "../../app/o/[orgId]/settings/roles/page";
import { ActiveOrgProvider, type ActiveOrg } from "../../lib/org/org-context";
import { ROLE_FORBIDDEN_PANEL_COPY } from "../../features/org/role-copy";

function renderPage(capabilities: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 403 })),
  );
  mounted.mockClear();
  const org: ActiveOrg = {
    orgId: "org_1",
    name: "ร้าน",
    capabilities: new Set(capabilities),
    roleKey: null,
    roleName: "x",
    profile: {} as ActiveOrg["profile"],
  };
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ActiveOrgProvider value={org}>
        <RolesPage />
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
}

describe("★ roles route guard", () => {
  it("manage_members alone ⇒ forbidden panel with roles copy, screen never mounted", () => {
    renderPage(["manage_members"]);
    expect(
      screen.getByRole("heading", { name: ROLE_FORBIDDEN_PANEL_COPY.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(ROLE_FORBIDDEN_PANEL_COPY.body)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "กลับไปหน้าข้อมูลร้าน" })).toBeInTheDocument();
    expect(mounted).not.toHaveBeenCalled();
  });
  it.each([["manage_roles"], ["full_access"]])("%s ⇒ screen renders", (cap) => {
    renderPage([cap]);
    expect(screen.getByText("ROLES_SCREEN")).toBeInTheDocument();
  });
});
