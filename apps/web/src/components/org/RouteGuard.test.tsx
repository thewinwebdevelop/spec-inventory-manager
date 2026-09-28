// T-003-W01 ★ — `RouteGuard`: gate a route segment by a capability the SERVER
// sent (`myMembership.capabilities`), and show the existing `ForbiddenPanel`
// when it is missing. UX only — the server still answers 403 on every call.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/o/org_1/settings/roles",
}));

import { RouteGuard } from "./RouteGuard";
import { OrgGuard } from "./OrgGuard";
import { ActiveOrgProvider, type ActiveOrg } from "../../lib/org/org-context";
import { SessionProvider } from "../../lib/session/session-context";
import { orgKey } from "../../lib/org/org-keys";
import { CAPABILITY_MANAGE_MEMBERS, CAPABILITY_MANAGE_ROLES } from "../../lib/org/capability";
import { FORBIDDEN_PANEL_COPY } from "../ui/ForbiddenPanel";
import { setAccessToken, clearAccessToken } from "../../lib/token-store";

const ORG = "org_1";
const GUARDED = "เนื้อหาที่ต้องมีสิทธิ์";

function activeOrg(capabilities: string[]): ActiveOrg {
  return {
    orgId: ORG,
    name: "ร้านหอมกรุ่นเบเกอรี่",
    capabilities: new Set(capabilities),
    roleKey: "staff",
    roleName: "Staff",
    profile: {} as ActiveOrg["profile"],
  };
}

function renderGuarded(
  capabilities: string[],
  guard: (children: ReactNode) => ReactNode,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ActiveOrgProvider value={activeOrg(capabilities)}>
        {guard(<div>{GUARDED}</div>)}
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
}

describe("★ RouteGuard", () => {
  it("renders the route when the server-sent capabilities include the requirement", () => {
    renderGuarded([CAPABILITY_MANAGE_ROLES], (c) => (
      <RouteGuard requiredCapability={CAPABILITY_MANAGE_ROLES}>{c}</RouteGuard>
    ));
    expect(screen.getByText(GUARDED)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("★ an Owner holding ONLY full_access passes — the wildcard goes through `can`", () => {
    renderGuarded(["full_access"], (c) => (
      <RouteGuard requiredCapability={CAPABILITY_MANAGE_ROLES}>{c}</RouteGuard>
    ));
    expect(screen.getByText(GUARDED)).toBeInTheDocument();
  });

  it("★ without the capability: ForbiddenPanel, and the children are never mounted", () => {
    const Child = vi.fn(() => <div>{GUARDED}</div>);
    renderGuarded([CAPABILITY_MANAGE_MEMBERS], () => (
      <RouteGuard requiredCapability={CAPABILITY_MANAGE_ROLES}>
        <Child />
      </RouteGuard>
    ));
    expect(screen.getByRole("alert")).toHaveTextContent(FORBIDDEN_PANEL_COPY.title);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/o/${ORG}`);
    // Not merely hidden: a child that mounted would fire its queries and hit a 403.
    expect(Child).not.toHaveBeenCalled();
    expect(screen.queryByText(GUARDED)).not.toBeInTheDocument();
  });

  it("passes route-specific copy and back target through to the same ForbiddenPanel", () => {
    const copy = { title: "หัวข้อเฉพาะ", body: "คำอธิบายเฉพาะ", back: "กลับไปที่อื่น" };
    renderGuarded([], (c) => (
      <RouteGuard
        requiredCapability={CAPABILITY_MANAGE_ROLES}
        forbiddenCopy={copy}
        forbiddenBackHref={`/o/${ORG}/settings/org`}
      >
        {c}
      </RouteGuard>
    ));
    const panel = screen.getByRole("alert");
    expect(panel).toHaveTextContent(copy.title);
    expect(panel).toHaveTextContent(copy.body);
    expect(panel).not.toHaveTextContent(FORBIDDEN_PANEL_COPY.title);
    expect(screen.getByRole("link", { name: copy.back })).toHaveAttribute(
      "href",
      `/o/${ORG}/settings/org`,
    );
  });

  it("★ a denial asks the server again — invalidates THIS org's profile (myMembership)", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    renderGuarded(
      [],
      (c) => <RouteGuard requiredCapability={CAPABILITY_MANAGE_ROLES}>{c}</RouteGuard>,
      queryClient,
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: orgKey(ORG, "profile") });
  });

  it("an allowed render does not refetch anything", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    renderGuarded(
      [CAPABILITY_MANAGE_ROLES],
      (c) => <RouteGuard requiredCapability={CAPABILITY_MANAGE_ROLES}>{c}</RouteGuard>,
      queryClient,
    );
    expect(spy).not.toHaveBeenCalled();
  });
});

/**
 * End to end through the real `OrgGuard` + generated client. The only source
 * of a capability is the `GET /orgs/{orgId}` body — the guard never decides
 * one on its own, so a stale denial can only be healed by the server.
 */
describe("★ RouteGuard under the real OrgGuard", () => {
  const profile = (capabilities: string[]) => ({
    id: ORG,
    name: "ร้านหอมกรุ่นเบเกอรี่",
    logo: null,
    timezone: "Asia/Bangkok",
    currency: "THB",
    taxProfile: null,
    taxProfileComplete: false,
    entitlement: null,
    myMembership: {
      roleId: "rol_1",
      roleName: "พนักงาน",
      roleKey: null,
      capabilities,
      status: "active",
    },
    counts: { activeMembers: 2, pendingInvitations: 0 },
  });

  function json(body: unknown) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  function renderUnderOrgGuard() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider bootstrap={async () => true}>
          <OrgGuard orgId={ORG}>
            <RouteGuard requiredCapability={CAPABILITY_MANAGE_ROLES}>
              <div>{GUARDED}</div>
            </RouteGuard>
          </OrgGuard>
        </SessionProvider>
      </QueryClientProvider>,
    );
  }

  beforeEach(() => setAccessToken("tok", 900));
  afterEach(() => {
    clearAccessToken();
    vi.unstubAllGlobals();
  });

  it("a stale denial heals once the server says the capability is now held", async () => {
    const bodies = [profile(["view_products"]), profile([CAPABILITY_MANAGE_ROLES])];
    const fetchImpl = vi.fn(async () => json(bodies.shift()));
    vi.stubGlobal("fetch", fetchImpl);
    renderUnderOrgGuard();
    expect(await screen.findByText(GUARDED)).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("a denial the server confirms stays denied, and does not loop", async () => {
    const fetchImpl = vi.fn(async () => json(profile(["view_products"])));
    vi.stubGlobal("fetch", fetchImpl);
    renderUnderOrgGuard();
    expect(await screen.findByRole("alert")).toHaveTextContent(FORBIDDEN_PANEL_COPY.title);
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    // Give a refetch loop the chance to show itself.
    await new Promise((r) => setTimeout(r, 100));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(GUARDED)).not.toBeInTheDocument();
  });
});
