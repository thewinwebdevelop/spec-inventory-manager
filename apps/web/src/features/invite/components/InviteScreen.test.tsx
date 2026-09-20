// S11 ★ — the token leaves the URL, and it leaves it for real.
//
// `invite-token.test.ts` proves the pure split. This proves the SCREEN does
// it: reads `location.href`, calls `history.replaceState`, and sends the token
// in a request BODY rather than leaving it anywhere a URL can be observed.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  // This screen IS S11 — `/invite` — which is why the route-mount guard in
  // `SessionProvider` (B-19 follow-up) must leave a hold on THIS path alone.
  usePathname: () => "/invite",
}));

import { InviteScreen } from "./InviteScreen";
import { SessionProvider } from "../../../lib/session/session-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import {
  dropPendingInvite,
  hasPendingInvite,
  holdInviteToken,
  takeInviteToken,
} from "../../../lib/session/pending-invite";

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
  return render(
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
  dropPendingInvite();
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

  it("★ B-19: leaving for sign-up and coming back finds the SAME invitation, not 'invalid link'", async () => {
    // Found walking M-01 on a phone: the token lived in a ref, `/signup`
    // destroyed it, and the reader came back to "ลิงก์อาจถูกคัดลอกมาไม่ครบ หรือ
    // ถูกยกเลิกไปแล้ว" — true of neither. §11.1 says the door takes the token.
    const seen = stubFetch(200, PREVIEW);
    const { unmount } = renderScreen();
    await screen.findByText(PREVIEW.organizationName);

    await userEvent.click(screen.getByRole("button", { name: "สมัครบัญชีใหม่" }));
    unmount();

    // …signup, login — and back on `/invite` with a clean address bar.
    window.history.replaceState({}, "", "/invite");
    seen.length = 0;
    renderScreen();

    expect(await screen.findByText(PREVIEW.organizationName)).toBeInTheDocument();
    expect(screen.queryByText("ลิงก์คำเชิญนี้ใช้ไม่ได้")).toBeNull();
    expect(seen[0].body).toContain(TOKEN);
    // Taken, not copied: a third `/invite` would not find it again.
    expect(takeInviteToken()).toBeNull();
  });

  it("★ B-19: holding it for the trip puts it in no web storage, cookie or DOM (E-12 still holds)", async () => {
    stubFetch(200, PREVIEW);
    renderScreen();
    await screen.findByText(PREVIEW.organizationName);
    await userEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบเพื่อรับคำเชิญ" }));
    // Non-vacuity (security review): without this, removing the hold would
    // leave nothing to leak and every assertion below would pass on nothing.
    expect(hasPendingInvite(), "the click did not hold the token at all").toBe(true);

    for (const store of [window.localStorage, window.sessionStorage] as const) {
      const dump = Object.keys(store)
        .map((key) => `${key}=${store.getItem(key) ?? ""}`)
        .join("\n");
      expect(dump).not.toContain(TOKEN);
    }
    expect(document.cookie).not.toContain(TOKEN);
    expect(document.body.innerHTML).not.toContain(TOKEN);
    expect(window.location.href).not.toContain(TOKEN);
  });

  it("a link opened fresh wins over one held from an earlier trip", async () => {
    holdInviteToken("stale-token-from-before");
    const seen = stubFetch(200, PREVIEW);
    renderScreen();

    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen[0].body).toContain(TOKEN);
    expect(seen[0].body).not.toContain("stale-token-from-before");
    expect(takeInviteToken(), "the stale hold was left behind").toBeNull();
  });

  it("★ §11.5: a link with no token shows NO_TOKEN, a local state, and calls no API", async () => {
    // ux's decision, verbatim (this used to synthesise a fake
    // `404 INVITATION_INVALID` and show that row's copy — the thing §11.5
    // exists to stop): no token means nothing was ever asked of the server,
    // so nothing here may claim the server refused it.
    window.history.replaceState({}, "", "/invite");
    const seen = stubFetch(200, PREVIEW);
    renderScreen();

    expect(await screen.findByText("ต้องเปิดจากลิงก์คำเชิญอีกครั้ง")).toBeInTheDocument();
    // Told what to do (go back to the chat/email and tap the link again) —
    // not the old, untrue "ลิงก์คำเชิญนี้ใช้ไม่ได้".
    expect(
      screen.getByText("ลิงก์เดิมที่เจ้าของร้านส่งให้ยังใช้ได้ กลับไปที่แชทหรืออีเมลที่ได้รับลิงก์ แล้วแตะลิงก์นั้นอีกครั้ง"),
    ).toBeInTheDocument();
    expect(screen.queryByText("ลิงก์คำเชิญนี้ใช้ไม่ได้")).toBeNull();
    // The existing `home` next-step, rendered as a SECONDARY button — no new
    // `InviteNextStep` kind, per §11.5.
    expect(screen.getByRole("button", { name: "กลับหน้าแรก" })).toBeInTheDocument();
    // No API call at all: this is a local state, not a request that failed.
    expect(seen).toHaveLength(0);
  });

  it("§11.5: the muted 'why' line is second, after what to do, never first", async () => {
    window.history.replaceState({}, "", "/invite");
    stubFetch(200, PREVIEW);
    renderScreen();

    await screen.findByText("ต้องเปิดจากลิงก์คำเชิญอีกครั้ง");
    expect(
      screen.getByText("หน้านี้ไม่ได้เก็บลิงก์คำเชิญไว้เพื่อความปลอดภัย จึงต้องเปิดจากลิงก์ทุกครั้ง"),
    ).toBeInTheDocument();
  });

  it("⛔ NO_TOKEN copy never appears for a REAL 404 INVITATION_INVALID from the server", async () => {
    // The separation is the whole point of §11.5: a real server refusal keeps
    // its own row in `BY_CODE`, untouched.
    stubFetch(404, { error: { code: "INVITATION_INVALID", message: "x" } });
    renderScreen();

    expect(await screen.findByText("ลิงก์คำเชิญนี้ใช้ไม่ได้")).toBeInTheDocument();
    expect(screen.getByText(/ลิงก์อาจถูกคัดลอกมาไม่ครบ/)).toBeInTheDocument();
    expect(screen.queryByText("ต้องเปิดจากลิงก์คำเชิญอีกครั้ง")).toBeNull();
    expect(
      screen.queryByText("หน้านี้ไม่ได้เก็บลิงก์คำเชิญไว้เพื่อความปลอดภัย จึงต้องเปิดจากลิงก์ทุกครั้ง"),
    ).toBeNull();
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
