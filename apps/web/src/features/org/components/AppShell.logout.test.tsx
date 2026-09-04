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
    <ToastProvider>
      <ActiveOrgProvider value={org}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </ActiveOrgProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
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
});
