// ★ B-19 — signing out forgets an invitation held for the next sign-in.
//
// `pending-invite.test.ts` proves the store drops when told to. This proves the
// session actually TELLS it: without the call in `endSession`, a person who
// left an invitation for the login page and then signed out would route the
// next person to sign in at this browser straight to it.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

/**
 * B-19 follow-up (security review, Low) — `SessionProvider` now also drops
 * the hold when a non-journey route mounts. `pathname` is swappable per test
 * (not a fixed mock) so re-rendering with a new value can stand in for a
 * client-side navigation without pulling in the real Next.js router.
 */
let pathname = "/o/org_1";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

import { SessionProvider, useSession } from "./session-context";
import { dropPendingInvite, hasPendingInvite, holdInviteToken } from "./pending-invite";

let session: ReturnType<typeof useSession> | null = null;
function Capture() {
  session = useSession();
  return null;
}

beforeEach(() => {
  dropPendingInvite();
  session = null;
  pathname = "/o/org_1";
});

describe("★ B-19 — endSession drops the held invitation", () => {
  it("a held token does not survive sign-out", async () => {
    render(
      <SessionProvider bootstrap={async () => true}>
        <Capture />
      </SessionProvider>,
    );
    await waitFor(() => expect(session?.state.status).not.toBe("unknown"));

    holdInviteToken("tok");
    expect(hasPendingInvite()).toBe(true);

    act(() => session!.endSession());

    expect(hasPendingInvite()).toBe(false);
  });

  it("control: beginning a session leaves it alone — that is the trip it is held for", async () => {
    render(
      <SessionProvider bootstrap={async () => false}>
        <Capture />
      </SessionProvider>,
    );
    await waitFor(() => expect(session?.state.status).not.toBe("unknown"));

    holdInviteToken("tok");
    act(() => session!.beginSession());

    expect(hasPendingInvite()).toBe(true);
  });
});

describe("B-19 follow-up — the hold does not outlive wandering off the invite journey", () => {
  function renderAt(path: string) {
    pathname = path;
    return render(
      <SessionProvider bootstrap={async () => true}>
        <Capture />
      </SessionProvider>,
    );
  }

  it("★ mounting a route that is NOT /invite, /login or /signup drops it — the reported gap", () => {
    // The reported example, verbatim: leaving /login for some other route
    // (not back to /invite) used to leave the hold sitting there for up to
    // 30 minutes. `/login/help` is not the login screen itself.
    holdInviteToken("tok");
    expect(hasPendingInvite()).toBe(true);

    renderAt("/login/help");

    expect(hasPendingInvite()).toBe(false);
  });

  it("mounting /invite, /login or /signup leaves a held token alone", () => {
    for (const path of ["/invite", "/login", "/signup"]) {
      dropPendingInvite();
      holdInviteToken("tok");

      renderAt(path);

      expect(hasPendingInvite(), `expected ${path} to keep the hold`).toBe(true);
    }
  });

  it("control: with nothing held, mounting elsewhere is a no-op, not a crash", () => {
    expect(hasPendingInvite()).toBe(false);
    renderAt("/some/other/route");
    expect(hasPendingInvite()).toBe(false);
  });
});
