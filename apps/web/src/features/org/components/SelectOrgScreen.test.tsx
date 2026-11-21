// S1 — เลือกร้าน (ux-wireframe §2). No unit test existed for this screen at all;
// D-038 ③ (manual pass) found it short of the wireframe on three counts — no
// header bar (D1), no card (D2), and an empty state with no icon (D3).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/select-org",
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const logoutDevice = vi.fn(async () => {});
vi.mock("../../../lib/auth-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/auth-client")>()),
  logoutDevice: (...a: unknown[]) => logoutDevice(...(a as [])),
}));

import { SelectOrgScreen, CREATE_ORG_PATH } from "./SelectOrgScreen";
import { SessionProvider } from "../../../lib/session/session-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import { setAccessToken, clearAccessToken } from "../../../lib/token-store";
import { orgTh } from "../i18n";

function stubShops(items: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ items, nextCursor: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
}

const SHOP = {
  organization: { id: "org_1", name: "ร้านหอมกรุ่นเบเกอรี่" },
  membership: { roleKey: "owner", roleName: "Owner", status: "active" },
};

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SessionProvider bootstrap={async () => true}>
        <ToastProvider>
          <SelectOrgScreen />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  replace.mockClear();
  logoutDevice.mockClear();
  setAccessToken("tok", 900);
});
afterEach(() => {
  vi.unstubAllGlobals();
  clearAccessToken();
});

describe("SelectOrgScreen (S1)", () => {
  it("D1 · has the header bar — the brand, and a way to sign out", async () => {
    stubShops([SHOP]);
    renderScreen();
    const header = screen.getByRole("banner");
    expect(header).toHaveTextContent("OmniStock");
    // ★ S1 is where somebody with NO shop lives. Without this button they had
    // no way out of the app: the sidebar's sign-out is inside a shop.
    await userEvent.click(screen.getByRole("button", { name: orgTh.shell.nav.logout }));
    await waitFor(() => expect(logoutDevice).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("D2 · the list sits in a card on web (≥md), full-bleed on a phone", async () => {
    stubShops([SHOP]);
    renderScreen();
    await screen.findByText(SHOP.organization.name);
    const card = screen.getByTestId("select-org-card");
    expect(card.className).toMatch(/md:border\b/);
    expect(card.className).toMatch(/md:rounded-card\b/);
    expect(card.className).toContain("md:shadow-card");
    expect(card).toContainElement(screen.getByRole("heading", { name: orgTh.selectOrg.title }));
  });

  it("D3 · the empty state is an EmptyState — icon, heading, body, CTA", async () => {
    stubShops([]);
    const { container } = renderScreen();
    await screen.findByRole("heading", { name: orgTh.selectOrg.empty.title });
    expect(screen.getByText(orgTh.selectOrg.empty.body)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: orgTh.selectOrg.empty.cta });
    expect(cta).toHaveAttribute("href", CREATE_ORG_PATH);
    expect(container.querySelector("main svg[class*='--size-icon-xl']")).not.toBeNull();
  });

  it("lists each shop with my role in it, as a link into the shop", async () => {
    stubShops([SHOP]);
    renderScreen();
    const row = await screen.findByRole("link", { name: /ร้านหอมกรุ่นเบเกอรี่/ });
    expect(row).toHaveAttribute("href", "/o/org_1");
    expect(row).toHaveTextContent("เจ้าของร้าน");
  });
});
