/**
 * ★ M-06 — the way out offered when the last Owner is refused.
 *
 * Found by hand during the §12.2 manual pass: the `409 LAST_OWNER` refusal
 * offered a link labelled "ไปหน้าสมาชิก" pointing at
 * `/o/{id}/settings/members` — which is the page the reader was standing on,
 * because the members screen is one of the dialog's two entry points. Pressing
 * it did nothing, at the exact moment the person had just been told "no".
 *
 * ux answered in ux-wireframe §10.3: from elsewhere, name the OUTCOME; from
 * the members screen, name the CONTROL already on their screen. Both strings
 * belong to ux — this file pins which one is chosen where, and that the branch
 * comes from the CALLER rather than from a route-string comparison.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { ApiRequestError } from "../../../lib/api/error";

/** A real `409 LAST_OWNER` — the same constructor the client throws, so the
 *  dialog runs `toLeaveOrgOutcome` for real rather than against a shape I made
 *  up. A hand-rolled error object here would fall through to `retryable` and
 *  every assertion below would be testing the wrong branch. */
const lastOwnerError = new ApiRequestError(409, {
  error: { code: "LAST_OWNER", message: "ร้านต้องมีเจ้าของอย่างน้อย 1 คน" },
});

const mutate = vi.fn((_vars: unknown, opts?: { onError?: (e: unknown) => void }) =>
  opts?.onError?.(lastOwnerError),
);

vi.mock("../api/use-member-mutations", () => ({
  useLeaveOrganization: () => ({ mutate, isPending: false }),
}));

import { LeaveOrgDialog } from "./LeaveOrgDialog";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import { membersTh } from "../i18n";

/** The person who hits this refusal is ALWAYS an Owner (B-1's lesson: the
 *  wildcard, not set membership, is what makes them one). */
const owner: ActiveOrg = {
  orgId: "org_1",
  name: "ร้านหอมกรุ่นเบเกอรี่",
  capabilities: new Set(["full_access"]),
  roleKey: "owner",
  roleName: "Owner",
  profile: { myMembership: { roleId: "rol_owner" } } as unknown as ActiveOrg["profile"],
};

function renderDialog(origin?: "members" | "elsewhere") {
  return render(
    <ToastProvider>
      <ActiveOrgProvider value={owner}>
        <LeaveOrgDialog origin={origin} onClose={() => {}} />
      </ActiveOrgProvider>
    </ToastProvider>,
  );
}

beforeEach(() => mutate.mockClear());

describe("★ M-06 — the last-Owner refusal names a way out that works", () => {
  it("★ opened FROM the members screen: a sentence, and no link to where you are", async () => {
    renderDialog("members");
    await userEvent.click(screen.getByRole("button", { name: "ออกจากร้านนี้" }));

    await waitFor(() =>
      expect(screen.getByText(membersTh.leaveLastOwnerHere)).toBeInTheDocument(),
    );
    // The regression: a link to `/o/org_1/settings/members` rendered here, and
    // pressing it did nothing.
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("★ opened from elsewhere: a link, labelled by its OUTCOME not its destination", async () => {
    renderDialog("elsewhere");
    await userEvent.click(screen.getByRole("button", { name: "ออกจากร้านนี้" }));

    const link = await screen.findByRole("link", { name: membersTh.leaveLastOwnerCta });
    expect(link).toHaveAttribute("href", "/o/org_1/settings/members");
    expect(screen.queryByText(membersTh.leaveLastOwnerHere)).toBeNull();
  });

  it("defaults to the link — a caller that forgets gets the branch that still helps", async () => {
    // Non-vacuity in the safe direction: the wrong default here is a link that
    // navigates somewhere useful, not a sentence pointing at controls that may
    // not be on screen.
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "ออกจากร้านนี้" }));

    expect(await screen.findByRole("link", { name: membersTh.leaveLastOwnerCta })).toBeVisible();
  });
});
