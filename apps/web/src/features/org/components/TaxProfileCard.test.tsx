// T-002-W4 ★ — the reveal button, rendered. `tax-reveal.test.ts` proves the
// state machine; this proves the card actually uses it, and that the two
// tiers render what §5 says they may.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { TaxProfileCard } from "./TaxProfileCard";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { CAPABILITY_MANAGE_ORG_SETTINGS, type OrgProfile } from "../tax-card";
import { orgProfileTh } from "../i18n";
import { setAccessToken, clearAccessToken } from "../../../lib/token-store";

const TIN = "0105551234567";

const declared: OrgProfile = {
  id: "org_1",
  name: "ร้านหอมกรุ่นเบเกอรี่",
  logo: null,
  timezone: "Asia/Bangkok",
  currency: "THB",
  taxProfile: { entityType: "company", taxIdMasked: "•••••••••4567", vatRegistered: true },
  taxProfileComplete: true,
  entitlement: null,
  myMembership: {
    roleId: "rol_1",
    roleName: "Owner",
    roleKey: "owner",
    capabilities: [CAPABILITY_MANAGE_ORG_SETTINGS],
    status: "active",
  },
  counts: { activeMembers: 3, pendingInvitations: 0 },
};

function activeOrg(capabilities: string[]): ActiveOrg {
  return {
    orgId: "org_1",
    name: declared.name,
    capabilities: new Set(capabilities),
    roleKey: "owner",
    roleName: "Owner",
    profile: declared,
  };
}

function stubReveal(status: number, body: unknown, headers: Record<string, string> = {}) {
  const impl = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    }),
  );
  vi.stubGlobal("fetch", impl);
  return impl;
}

function renderCard(capabilities: string[], onStale = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ActiveOrgProvider value={activeOrg(capabilities)}>
        <TaxProfileCard
          profile={declared}
          capabilities={new Set(capabilities)}
          onEdit={vi.fn()}
          onProfileStale={onStale}
        />
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
  return { onStale };
}

beforeEach(() => setAccessToken("tok", 900));
afterEach(() => {
  vi.unstubAllGlobals();
  clearAccessToken();
});

describe("TaxProfileCard — tiers", () => {
  it("★ a caller without manage_org_settings sees no digits and no reveal button", () => {
    // §5: "ไม่แสดงตัวเลขใด ๆ แม้แต่ 4 ตัวท้าย" — even though the fixture
    // profile carries a masked number, as a stricter-than-reality case.
    renderCard([]);
    expect(screen.queryByText(orgProfileTh.tax.reveal)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("4567");
    expect(screen.getByText(orgProfileTh.tax.declaredReadOnlyHint)).toBeInTheDocument();
  });

  it("shows the masked number and the reveal button with the capability", () => {
    renderCard([CAPABILITY_MANAGE_ORG_SETTINGS]);
    expect(screen.getByText("•••••••••4567")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: orgProfileTh.tax.reveal })).toBeInTheDocument();
  });

  it("★ warns that the press is recorded BEFORE it is pressed", () => {
    // §5: "บอกก่อนกด ไม่ใช่แอบเก็บ" — the notice is not a post-hoc receipt.
    renderCard([CAPABILITY_MANAGE_ORG_SETTINGS]);
    expect(screen.getByText(orgProfileTh.tax.revealNotice)).toBeInTheDocument();
  });
});

describe("TaxProfileCard — reveal", () => {
  it("shows the full number after a successful reveal", async () => {
    stubReveal(200, { taxId: TIN, entityType: "company", revealedAt: "2026-08-06T10:00:00Z" });
    renderCard([CAPABILITY_MANAGE_ORG_SETTINGS]);

    await userEvent.click(screen.getByRole("button", { name: orgProfileTh.tax.reveal }));

    expect(await screen.findByText(TIN)).toBeInTheDocument();
  });

  it("★ hiding removes the number from the DOM entirely", async () => {
    stubReveal(200, { taxId: TIN, entityType: "company", revealedAt: "2026-08-06T10:00:00Z" });
    renderCard([CAPABILITY_MANAGE_ORG_SETTINGS]);

    await userEvent.click(screen.getByRole("button", { name: orgProfileTh.tax.reveal }));
    await screen.findByText(TIN);
    await userEvent.click(screen.getByRole("button", { name: orgProfileTh.tax.hide }));

    await waitFor(() => expect(document.body.textContent).not.toContain(TIN));
    // Back to the masked value, not to nothing.
    expect(screen.getByText("•••••••••4567")).toBeInTheDocument();
  });

  it("★ re-showing costs a SECOND request — nothing is cached", async () => {
    // The audit event and the 20/hour budget only mean something if every
    // viewing is a call. A cached value would make the second look free.
    const fetchImpl = stubReveal(200, {
      taxId: TIN,
      entityType: "company",
      revealedAt: "2026-08-06T10:00:00Z",
    });
    renderCard([CAPABILITY_MANAGE_ORG_SETTINGS]);

    await userEvent.click(screen.getByRole("button", { name: orgProfileTh.tax.reveal }));
    await screen.findByText(TIN);
    await userEvent.click(screen.getByRole("button", { name: orgProfileTh.tax.hide }));
    await waitFor(() => expect(document.body.textContent).not.toContain(TIN));
    await userEvent.click(screen.getByRole("button", { name: orgProfileTh.tax.reveal }));
    await screen.findByText(TIN);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("★ a 429 throttles the card without disabling the rest of the shop", async () => {
    // §5 requires a way forward: the user is told they can still edit
    // everything else, rather than the page going dead.
    stubReveal(429, { error: { code: "RATE_LIMITED", message: "x" } }, { "Retry-After": "120" });
    renderCard([CAPABILITY_MANAGE_ORG_SETTINGS]);

    await userEvent.click(screen.getByRole("button", { name: orgProfileTh.tax.reveal }));

    expect(await screen.findByTestId("throttle-banner")).toBeInTheDocument();
    expect(screen.getByText(orgProfileTh.tax.revealError.throttledHint)).toBeInTheDocument();
    // The masked value is still there; only the reveal is unavailable.
    expect(screen.getByText("•••••••••4567")).toBeInTheDocument();
  });

  it("a 404 closes the value and asks for a fresh profile", async () => {
    stubReveal(404, { error: { code: "NOT_FOUND", message: "x" } });
    const { onStale } = renderCard([CAPABILITY_MANAGE_ORG_SETTINGS]);

    await userEvent.click(screen.getByRole("button", { name: orgProfileTh.tax.reveal }));

    await waitFor(() => expect(onStale).toHaveBeenCalled());
    expect(document.body.textContent).not.toContain(TIN);
  });

  it("a network failure surfaces an error and never a number", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    renderCard([CAPABILITY_MANAGE_ORG_SETTINGS]);

    await userEvent.click(screen.getByRole("button", { name: orgProfileTh.tax.reveal }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      orgProfileTh.tax.revealError.generic,
    );
    expect(document.body.textContent).not.toContain(TIN);
  });
});
