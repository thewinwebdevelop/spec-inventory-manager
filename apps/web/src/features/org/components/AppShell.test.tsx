// T-002-W3 — the shell's menu is built from capabilities (ux-wireframe §4,
// answering Q13: HIDE, do not disable).
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  // The sidebar reads the current path to mark the active row (the mockup's
  // `.navi.on`). Landed on `/o/{orgId}`, which is the route entering a shop
  // actually lands on.
  usePathname: () => "/o/org_1",
}));

import { AppShell, CAPABILITY_MANAGE_MEMBERS } from "./AppShell";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { SessionProvider } from "../../../lib/session/session-context";
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
    vi.fn(
      async () => new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 }),
    ),
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider bootstrap={async () => true}>
        <ActiveOrgProvider value={activeOrg(capabilities)}>
          <AppShell>
            <div>เนื้อหา</div>
          </AppShell>
        </ActiveOrgProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  it("★ an OWNER sees สมาชิก — `full_access` is a wildcard, not a missing capability", () => {
    // The regression E-08b caught in a browser. An Owner's role carries exactly
    // one capability (`full_access`, SYSTEM_ROLE_BLUEPRINT) and the server
    // treats it as covering everything — so the Owner could open the members
    // screen by URL and invite people, while their own sidebar hid the entry.
    //
    // Every existing case here passes an explicit capability list, which is why
    // none of them could see it: they described a user who does not exist.
    renderShell(["full_access"]);
    expect(screen.getByText(orgTh.shell.nav.members)).toBeInTheDocument();
  });

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

  it("★ T-003-W05 · EW3-11 (unit half) — บทบาทและสิทธิ์ is a link to the roles screen for manage_roles", () => {
    renderShell(["manage_roles"]);
    const link = screen.getByRole("link", { name: orgTh.shell.nav.roles });
    expect(link).toHaveAttribute("href", "/o/org_1/settings/roles");
  });

  it("★ an OWNER (full_access wildcard) sees บทบาทและสิทธิ์ below สมาชิก", () => {
    renderShell(["full_access"]);
    const names = screen.getAllByRole("link").map((a) => a.textContent);
    const members = names.indexOf(orgTh.shell.nav.members);
    expect(members).toBeGreaterThanOrEqual(0);
    expect(names.indexOf(orgTh.shell.nav.roles)).toBe(members + 1);
  });

  it("★ hides บทบาทและสิทธิ์ without manage_roles — even with manage_members (no cross-grant)", () => {
    renderShell([CAPABILITY_MANAGE_MEMBERS, "view_products"]);
    expect(screen.queryByText(orgTh.shell.nav.roles)).not.toBeInTheDocument();
  });

  it("★ the shop name is visible on every page (org context is never ambiguous)", () => {
    // The ux heuristic the wireframe states outright: which shop you are in
    // must never be a guess.
    renderShell([]);
    expect(screen.getAllByText("ร้านหอมกรุ่นเบเกอรี่").length).toBeGreaterThan(0);
  });

  it("★ choosing the menu item of the page you are ON still closes the drawer (§8.2)", async () => {
    // design-system §8.2: the drawer "ปิดเองเมื่อเลือกเมนู". It closed on a
    // pathname CHANGE only — so tapping the current page's entry (landed on
    // `/o/org_1`, tap ข้อมูลร้าน) left the scrim over the page you asked for,
    // and every click on it hit the scrim instead. Found by the D-038 ② tablet
    // run (e03: "<div … bg-overlay> intercepts pointer events").
    renderShell([]);
    await userEvent.click(screen.getByRole("button", { name: orgTh.shell.nav.showMenu }));
    const drawer = screen
      .getAllByRole("navigation", { name: orgTh.shell.nav.menuLabel })
      .find((n) => n.querySelector(`[aria-label="${orgTh.shell.nav.hideMenu}"]`))!;
    await userEvent.click(within(drawer).getByRole("link", { name: orgTh.shell.nav.orgProfile }));
    expect(screen.queryByRole("button", { name: orgTh.shell.nav.hideMenu })).toBeNull();
  });

  it("D5 · every sidebar row carries an icon, so the labels line up (D-038 ③)", () => {
    // Only บทบาทและสิทธิ์ had one: its label sat 28px right of every other
    // row's, which read as an indent — as if roles were a child of members.
    renderShell(["full_access"]);
    const sidebar = screen.getAllByRole("navigation", { name: orgTh.shell.nav.menuLabel })[0];
    const rows = [
      ...within(sidebar).getAllByRole("link"),
      within(sidebar).getByRole("button", { name: orgTh.shell.nav.logout }),
    ].filter((el) => el.closest("ul"));
    expect(rows.map((r) => r.textContent)).toEqual([
      orgTh.shell.nav.orgProfile,
      orgTh.shell.nav.members,
      orgTh.shell.nav.roles,
      orgTh.shell.nav.security,
      orgTh.shell.nav.logout,
    ]);
    for (const row of rows) {
      const svg = row.querySelector("svg");
      expect(svg, `${row.textContent} has no icon`).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
    // …and no two rows share one: an icon that means two things means neither.
    const shapes = rows.map((r) => r.querySelector("svg")!.innerHTML);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("D6 · the top bar below lg names the SHOP, not just the product", () => {
    // At tablet width the sidebar (and the switcher in it) is in the drawer,
    // so the 56px bar was the only chrome on screen and said "OmniStock" —
    // which shop you were in was a guess until you opened the menu.
    renderShell([]);
    const bar = screen.getByTestId("shell-top-bar");
    expect(bar).toHaveTextContent("ร้านหอมกรุ่นเบเกอรี่");
    // Long Thai shop names must not push the bar wider than the screen.
    expect(within(bar).getByText("ร้านหอมกรุ่นเบเกอรี่").className).toContain("truncate");
  });

  it("sign-out opts in to the unsaved-changes guard (data-leave-guard, D-038 ③ W06 pass)", () => {
    // Without it, signing out from the role form dropped unsaved edits silently.
    renderShell([]);
    for (const b of screen.getAllByRole("button", { name: orgTh.shell.nav.logout })) {
      expect(b).toHaveAttribute("data-leave-guard", "/login");
    }
  });

  it("renders the page content it wraps", () => {
    renderShell([]);
    expect(screen.getByText("เนื้อหา")).toBeInTheDocument();
  });
});
