// S11 ★ — the token leaves the URL, and it leaves it for real.
//
// `invite-token.test.ts` proves the pure split. This proves the SCREEN does
// it: reads `location.href`, calls `history.replaceState`, and sends the token
// in a request BODY rather than leaving it anywhere a URL can be observed.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { InviteScreen } from "./InviteScreen";
import { SessionProvider } from "../../../lib/session/session-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";

const TOKEN = "9f2b7c1d4e5a6b7c8d9e0f1a2b3c4d5e";

const PREVIEW = {
  organizationName: "ร้านหอมกรุ่นเบเกอรี่",
  roleName: "Admin",
  roleKey: "admin",
  emailMasked: "m***@shop.com",
  expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
};

function stubFetch(status: number, body: unknown) {
  const seen: { url: string; body: string | null }[] = [];
  const impl = vi.fn(async (input: Request) => {
    seen.push({ url: input.url, body: await input.clone().text() });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", impl as unknown as typeof globalThis.fetch);
  return seen;
}

function renderScreen(signedIn = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider bootstrap={async () => signedIn}>
        <ToastProvider>
          <InviteScreen />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

let replaceState: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.history.replaceState({}, "", `/invite?token=${TOKEN}`);
  replaceState = vi.spyOn(window.history, "replaceState");
});

afterEach(() => {
  vi.unstubAllGlobals();
  replaceState.mockRestore();
  window.history.replaceState({}, "", "/");
});

describe("InviteScreen — the token leaves the URL", () => {
  it("★ strips the token from the address bar", async () => {
    stubFetch(200, PREVIEW);
    renderScreen();

    await waitFor(() => expect(replaceState).toHaveBeenCalled());
    expect(window.location.search).not.toContain(TOKEN);
    expect(window.location.pathname).toBe("/invite");
  });

  it("★ uses replaceState, NOT pushState — the token must not be one Back away", async () => {
    const pushState = vi.spyOn(window.history, "pushState");
    stubFetch(200, PREVIEW);
    renderScreen();

    await waitFor(() => expect(replaceState).toHaveBeenCalled());
    expect(pushState).not.toHaveBeenCalled();
    pushState.mockRestore();
  });

  it("★ sends the token in the request BODY, never in the URL (I-6)", async () => {
    // The endpoints are POSTs for exactly this reason: a query string reaches
    // access logs, every proxy in front of us, and the `Referer` of anything
    // this page loads.
    const seen = stubFetch(200, PREVIEW);
    renderScreen();

    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen[0].url).not.toContain(TOKEN);
    expect(seen[0].body).toContain(TOKEN);
  });

  it("★ E-12: the token reaches no web storage, at any point in the flow", async () => {
    // The clause of E-12 (I-6ข) the URL tests do not cover. Stripping the
    // address bar is worthless if the value was parked in `localStorage` on
    // the way past: an XSS on any page of this origin reads it, and unlike the
    // URL it survives the tab. The token is a bearer credential for MEMBERSHIP
    // of a shop — it belongs in a React ref for the length of one flow and
    // nowhere else.
    stubFetch(200, PREVIEW);
    renderScreen();

    await waitFor(() => expect(replaceState).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(PREVIEW.organizationName)).toBeInTheDocument());

    for (const store of [window.localStorage, window.sessionStorage] as const) {
      const dump = Object.keys(store)
        .map((key) => `${key}=${store.getItem(key) ?? ""}`)
        .join("\n");
      expect(dump, "the invitation token was written to web storage").not.toContain(TOKEN);
    }
    // Nor in a cookie — the other store a page can write without asking.
    expect(document.cookie).not.toContain(TOKEN);
  });

  it("shows the shop, the role and the MASKED address", async () => {
    stubFetch(200, PREVIEW);
    renderScreen();

    expect(await screen.findByText(PREVIEW.organizationName)).toBeInTheDocument();
    expect(screen.getByText(/m\*\*\*@shop\.com/)).toBeInTheDocument();
    // Never the real address: anyone holding the link can open this page.
    expect(document.body.textContent).not.toContain("malee@shop.com");
  });

  it("★ does not auto-accept for a signed-in reader", async () => {
    // §11.1: the person must see WHICH shop and AS WHAT before joining.
    // Auto-accepting would let a link add somebody to an organisation they
    // never agreed to be in, just by being opened.
    const seen = stubFetch(200, PREVIEW);
    renderScreen(true);

    expect(await screen.findByRole("button", { name: "เข้าร่วมร้านนี้" })).toBeInTheDocument();
    expect(seen.every((r) => !r.url.endsWith("/invitations/accept"))).toBe(true);
  });

  it("a link with no token reports an unusable link rather than calling the API", async () => {
    window.history.replaceState({}, "", "/invite");
    const seen = stubFetch(200, PREVIEW);
    renderScreen();

    expect(await screen.findByText("ลิงก์คำเชิญนี้ใช้ไม่ได้")).toBeInTheDocument();
    expect(seen).toHaveLength(0);
  });

  it("★ every documented refusal keeps a way out on screen", async () => {
    stubFetch(409, { error: { code: "INVITATION_SUPERSEDED", message: "x" } });
    renderScreen();

    expect(await screen.findByText("คำเชิญนี้ใช้ไม่ได้แล้ว")).toBeInTheDocument();
    // I-1's explanation, and a button rather than a dead end.
    expect(screen.getByText(/ถูกออกก่อนที่คุณจะถูกถอดออกจากร้าน/)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
