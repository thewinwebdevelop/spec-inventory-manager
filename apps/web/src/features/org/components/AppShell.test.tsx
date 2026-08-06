// T-002-W3 — the shell's menu is built from capabilities (ux-wireframe §4,
// answering Q13: HIDE, do not disable).
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { AppShell, CAPABILITY_MANAGE_MEMBERS } from "./AppShell";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { orgTh } from "../i18n";

function activeOrg(capabilities: string[]): ActiveOrg {
  return {
    orgId: "org_1",
    name: "ร้านหอมกรุ่นเบเกอรี่",
    capabilities: new Set(capabilities),
    roleKey: "staff",
    roleName: "Staff",
    // `profile` is only read by screens, not by the shell.
    profile: {} as ActiveOrg["profile"],
  };
}

function renderShell(capabilities: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 })),
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <ActiveOrgProvider value={activeOrg(capabilities)}>
        <AppShell>
          <div>เนื้อหา</div>
        </AppShell>
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  it("★ hides สมาชิก without manage_members — hidden, not disabled", () => {
    // §4 (Q13): a disabled entry raises a question the user cannot answer.
    renderShell(["view_products"]);
    expect(screen.queryByText(orgTh.shell.nav.members)).not.toBeInTheDocument();
    // The entries that do not depend on a capability are still there.
    expect(screen.getByText(orgTh.shell.nav.orgProfile)).toBeInTheDocument();
    expect(screen.getByText(orgTh.shell.nav.security)).toBeInTheDocument();
  });

  it("shows สมาชิก with manage_members", () => {
    renderShell([CAPABILITY_MANAGE_MEMBERS]);
    expect(screen.getByText(orgTh.shell.nav.members)).toBeInTheDocument();
  });

  it("★ the shop name is visible on every page (org context is never ambiguous)", () => {
    // The ux heuristic the wireframe states outright: which shop you are in
    // must never be a guess.
    renderShell([]);
    expect(screen.getAllByText("ร้านหอมกรุ่นเบเกอรี่").length).toBeGreaterThan(0);
  });

  it("renders the page content it wraps", () => {
    renderShell([]);
    expect(screen.getByText("เนื้อหา")).toBeInTheDocument();
  });
});
