/**
 * ★ B-16 — the way out of the app.
 *
 * ux-wireframe §S2 draws "ออกจากระบบ" as the last row of the sidebar. The
 * string lived in `orgTh.shell.nav.logout` and NOTHING in the tree read it, so
 * the only control that ended a session was "ออกจากระบบทุกอุปกรณ์" on the
 * security page — which ends every session on every device the person owns.
 *
 * It survived a green suite because a missing control renders nothing and
 * asserts nothing: there is no failing render, no console error, no type
 * error. The manual pass found it the way a person would — by trying to sign
 * out and having nowhere to click.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/o/org_1/settings/org",
  useRouter: () => ({ replace, push: vi.fn() }),
}));

const logoutDevice = vi.fn(async () => {});
const logoutAll = vi.fn(async () => {});
vi.mock("../../../lib/auth-client", () => ({
  logoutDevice: (...args: unknown[]) => logoutDevice(...(args as [])),
  logoutAll: (...args: unknown[]) => logoutAll(...(args as [])),
}));

vi.mock("./OrgSwitcher", () => ({ OrgSwitcher: () => <div>switcher</div> }));

import { AppShell } from "./AppShell";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { orgTh } from "../i18n";
import { SessionProvider } from "../../../lib/session/session-context";
import {
  dropPendingInvite,
  hasPendingInvite,
  holdInviteToken,
} from "../../../lib/session/pending-invite";

const org: ActiveOrg = {
  orgId: "org_1",
  name: "ร้านหอมกรุ่นเบเกอรี่",
  capabilities: new Set(["full_access"]),
  roleKey: "owner",
  roleName: "Owner",
  profile: { myMembership: { roleId: "rol_owner" } } as unknown as ActiveOrg["profile"],
};

function renderShell() {
  return render(
    <SessionProvider bootstrap={async () => true}>
      <ToastProvider>
        <ActiveOrgProvider value={org}>
          <AppShell>
            <p>page</p>
          </AppShell>
        </ActiveOrgProvider>
      </ToastProvider>
    </SessionProvider>,
  );
}

beforeEach(() => {
  dropPendingInvite();
  replace.mockClear();
  logoutDevice.mockClear();
  logoutAll.mockClear();
});

describe("★ B-16 — signing out", () => {
  it("★ the shell offers a sign-out control at all", () => {
    renderShell();
    // Two copies below `lg` (drawer + sidebar are both in the tree); one is
    // enough to prove the control exists.
    expect(screen.getAllByRole("button", { name: orgTh.shell.nav.logout }).length).toBeGreaterThan(
      0,
    );
  });

  it("★ it ends THIS session — not every session on every device", async () => {
    // The distinction is the whole point. Before this existed, a person who
    // wanted to hand the laptop to a colleague had exactly one control, and it
    // signed them out of their phone too.
    renderShell();
    await userEvent.click(screen.getAllByRole("button", { name: orgTh.shell.nav.logout })[0]);

    await waitFor(() => expect(logoutDevice).toHaveBeenCalledTimes(1));
    expect(logoutAll).not.toHaveBeenCalled();
    // …and with no `familyId`: this device, chosen by omission.
    expect(logoutDevice).toHaveBeenCalledWith();
  });

  it("★ a FAILED sign-out stays put and says so — it does not fake success", async () => {
    // `logoutDevice` clears the access token only after a `204`, so a failed
    // call leaves the session fully alive. Routing to /login here would show
    // somebody a sign-out that did not happen — and `/login` does not turn an
    // authenticated visitor away, so nothing downstream would correct it.
    logoutDevice.mockRejectedValueOnce(new Error("network"));
    renderShell();
    await userEvent.click(screen.getAllByRole("button", { name: orgTh.shell.nav.logout })[0]);

    await waitFor(() =>
      expect(screen.getByText(orgTh.shell.nav.logoutFailed)).toBeInTheDocument(),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("a SUCCESSFUL sign-out leaves the shop shell", async () => {
    renderShell();
    await userEvent.click(screen.getAllByRole("button", { name: orgTh.shell.nav.logout })[0]);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("★ B-19: the sidebar sign-out forgets an invitation held for a login nobody finished", async () => {
    // Security review, Medium: `endSession` — the one place that dropped the
    // held token — had no caller in the app, and `router.replace` is a soft
    // navigation, so the heap (and the token) survived this very click. The
    // earlier test "a held token does not survive sign-out" called
    // `endSession` directly and was true only of a function nobody used.
    // This one goes through the control a person actually presses.
    //
    // Held AFTER mount, not before: this screen's route (`/o/org_1/...`) is
    // not on the invite journey, so the route-mount guard below would already
    // have cleared anything held before render — which would make this case
    // pass for the wrong reason. Holding it once the shell is already up
    // isolates the thing this test is actually about: `endSession` itself.
    renderShell();
    holdInviteToken("tok-left-behind");
    await userEvent.click(screen.getAllByRole("button", { name: orgTh.shell.nav.logout })[0]);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(hasPendingInvite(), "the next person to sign in here would be sent to it").toBe(false);
  });

  it("control: a FAILED sign-out keeps it — the session it belongs to is still alive", async () => {
    // See the note above: held after mount so the route-mount guard (this
    // screen is not on the invite journey) is not what makes this pass.
    logoutDevice.mockRejectedValueOnce(new Error("network"));
    renderShell();
    holdInviteToken("tok");
    await userEvent.click(screen.getAllByRole("button", { name: orgTh.shell.nav.logout })[0]);

    await waitFor(() =>
      expect(screen.getByText(orgTh.shell.nav.logoutFailed)).toBeInTheDocument(),
    );
    expect(hasPendingInvite()).toBe(true);
  });
});
