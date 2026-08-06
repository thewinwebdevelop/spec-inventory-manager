// T-002-W1 ★ — the org shell end to end: a real query client, the real
// generated API client, a stubbed network, and the real guard.
//
// `org-access.test.ts` proves the DECISION. This proves the guard actually
// acts on it — that `leave-org` really navigates to the picker and really
// invalidates the shop list, rather than being a branch nobody reaches.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

import { OrgGuard, LOGIN_PATH, SELECT_ORG_PATH } from "./OrgGuard";
import { SessionProvider } from "../../lib/session/session-context";
import { MY_ORGANIZATIONS_KEY } from "../../lib/org/org-keys";
import { setAccessToken, clearAccessToken } from "../../lib/token-store";

const ORG = "org_2n4xk9";

const PROFILE = {
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
    roleName: "เจ้าของร้าน",
    roleKey: "owner",
    capabilities: ["full_access", "manage_members"],
    status: "active",
  },
  counts: { activeMembers: 2, pendingInvitations: 0 },
};

function stubFetch(status: number, body: unknown) {
  const impl = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", impl);
  return impl;
}

function renderGuard(queryClient: QueryClient, children: ReactNode = <div>เนื้อหาของร้าน</div>) {
  return render(
    <QueryClientProvider client={queryClient}>
      {/* bootstrap resolves true = a live session, so the guard gets past the
          session gate and reaches the profile query — the part under test. */}
      <SessionProvider bootstrap={async () => true}>
        <OrgGuard orgId={ORG}>{children}</OrgGuard>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  replace.mockClear();
  setAccessToken("tok", 900);
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearAccessToken();
});

describe("OrgGuard", () => {
  it("renders the children once the profile resolves", async () => {
    stubFetch(200, PROFILE);
    renderGuard(freshClient());

    expect(await screen.findByText("เนื้อหาของร้าน")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows a skeleton — never the shell — while the profile is in flight", () => {
    stubFetch(200, PROFILE);
    renderGuard(freshClient());

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("เนื้อหาของร้าน")).not.toBeInTheDocument();
  });

  it("★ 403 ORG_ACCESS_DENIED goes to the shop picker and refetches the shop list", async () => {
    stubFetch(403, { error: { code: "ORG_ACCESS_DENIED", message: "ไม่ใช่สมาชิก" } });
    const queryClient = freshClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    renderGuard(queryClient);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(`${SELECT_ORG_PATH}?removed=${ORG}`);
    });
    // ux-wireframe §12.1: the shop must disappear from the switcher, which
    // only happens if the list is actually re-fetched.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: MY_ORGANIZATIONS_KEY });
    // D-027: a session is not tied to a shop. Never log out here.
    expect(replace).not.toHaveBeenCalledWith(LOGIN_PATH);
    expect(screen.queryByText("เนื้อหาของร้าน")).not.toBeInTheDocument();
  });

  it("★ 403 FORBIDDEN keeps the user in the shop and shows the error", async () => {
    stubFetch(403, { error: { code: "FORBIDDEN", message: "ไม่มีสิทธิ์" } });
    renderGuard(freshClient());

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // The opposite of the case above: no navigation at all.
    expect(replace).not.toHaveBeenCalled();
  });

  it("a server error offers a retry rather than moving the user anywhere", async () => {
    stubFetch(500, { error: { code: "INTERNAL", message: "พัง" } });
    renderGuard(freshClient());

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ลองใหม่" })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("a confirmed logged-out session goes to /login, not to the picker", async () => {
    stubFetch(200, PROFILE);
    render(
      <QueryClientProvider client={freshClient()}>
        <SessionProvider bootstrap={async () => false}>
          <OrgGuard orgId={ORG}>
            <div>เนื้อหาของร้าน</div>
          </OrgGuard>
        </SessionProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith(LOGIN_PATH));
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining(SELECT_ORG_PATH));
  });
});
