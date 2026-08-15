// ★ T-002-Q5 — a sign-in that happens AFTER the bootstrap must still count.
//
// THE BUG THIS PINS. `SessionProvider` runs one silent refresh on mount and
// then never changed its mind. Before F-002 nothing read the session, so a
// login arriving after that bootstrap left the state at "signed out" and
// nobody noticed. F-002 added `OrgGuard`, which reads it — so a person who had
// just signed in successfully was sent from `/o/{orgId}` straight back to
// `/login`, while `/select-org` and `/orgs/new` (which consult no session)
// worked perfectly.
//
// WHY NO EXISTING TEST COULD SEE IT: every component test mounts this provider
// with `bootstrap={async () => true}` — already signed in, on purpose, because
// each of them is testing something else. The failing state only exists in a
// page load that starts signed OUT and signs in partway through, which is
// precisely one journey and no component's business. E-01 walks it, and found
// this on the first run that got past provisioning.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../auth-client", () => ({
  // The bootstrap the provider runs on mount: no cookie yet, so "not signed in".
  silentRefresh: vi.fn(async () => false),
}));

import { SessionProvider, useSession } from "./session-context";

function Probe() {
  const { state, beginSession, endSession } = useSession();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <button onClick={beginSession}>sign in</button>
      <button onClick={endSession}>sign out</button>
    </div>
  );
}

function renderProbe(bootstrap: () => Promise<boolean>) {
  return render(
    <SessionProvider bootstrap={bootstrap}>
      <Probe />
    </SessionProvider>,
  );
}

describe("SessionProvider — a sign-in during the page load", () => {
  it("★ beginSession moves a settled signed-OUT session to signed-in", async () => {
    // The exact sequence of a real login: the app loads with no cookie, the
    // bootstrap settles negative, and only then does the person sign in.
    renderProbe(async () => false);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("none"));

    await userEvent.click(screen.getByRole("button", { name: "sign in" }));

    expect(
      screen.getByTestId("status"),
      "a successful login left the app believing nobody was signed in — every " +
        "route that guards on the session bounces to /login",
    ).toHaveTextContent("authed");
  });

  it("the bootstrap still decides the INITIAL answer", async () => {
    // beginSession must not turn the provider into something that ignores the
    // cold-start refresh: a page load with a live cookie is signed in without
    // anybody calling anything.
    renderProbe(async () => true);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authed"));
  });

  it("endSession still wins afterwards — the 401 path is unchanged", async () => {
    renderProbe(async () => false);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("none"));

    await userEvent.click(screen.getByRole("button", { name: "sign in" }));
    expect(screen.getByTestId("status")).toHaveTextContent("authed");

    await userEvent.click(screen.getByRole("button", { name: "sign out" }));
    expect(screen.getByTestId("status")).toHaveTextContent("none");
  });

  it("state is `unknown` until the bootstrap settles — nothing may guard on it before then", async () => {
    // The ordering `decideOrgShell` depends on: bouncing on `unknown` would
    // send every reload of a live session to /login.
    let settle!: (value: boolean) => void;
    renderProbe(() => new Promise<boolean>((resolve) => (settle = resolve)));

    expect(screen.getByTestId("status")).toHaveTextContent("unknown");
    settle(true);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authed"));
  });
});
