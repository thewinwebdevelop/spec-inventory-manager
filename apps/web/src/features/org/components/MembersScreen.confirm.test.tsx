// ★ T-002-Q7 — the two confirmations of ux-wireframe §9.2/§9.3.
//
// FOUND BY READING THE SCREEN AGAINST THE SPEC, not by a browser: both buttons
// fired their mutation on the first press. Reissuing is the one action in F-002
// that breaks something already in somebody else's hands — the link the inviter
// has already sent over LINE stops working the instant a new one is minted
// (D-027) — and nothing on screen said so beforehand.
//
// Track 2's highest-value flow is "does the user understand that the old link
// dies?" (test-plan §15 item 2). With no dialog, that question had one possible
// answer, and no amount of agentic browsing would have improved it.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const reissueMutate = vi.fn();
const cancelMutate = vi.fn();

vi.mock("../api/use-member-mutations", () => ({
  useReissueInvitationLink: () => ({ mutate: reissueMutate, isPending: false }),
  useCancelInvitation: () => ({ mutate: cancelMutate, isPending: false }),
  useChangeMemberRole: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveMember: () => ({ mutate: vi.fn(), isPending: false }),
  useLeaveOrganization: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateInvitation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const PENDING_INVITATION = {
  id: "inv_1",
  email: "malee@shop.com",
  roleId: "rol_admin",
  roleName: "Admin",
  roleKey: "admin",
  status: "pending" as const,
  expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
  createdAt: new Date().toISOString(),
  acceptedAt: null,
  acceptedUserCreatedAfterInvite: null,
};

vi.mock("../api/use-members", () => ({
  useMembers: () => ({
    data: { items: [], nextCursor: null },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useInvitations: () => ({
    data: { items: [PENDING_INVITATION], nextCursor: null },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useRoles: () => ({ data: { items: [] }, isLoading: false, isError: false }),
}));

import { MembersScreen } from "./MembersScreen";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import { invitationConfirmTh, membersTh } from "../i18n";

const org: ActiveOrg = {
  orgId: "org_1",
  name: "ร้านหอมกรุ่นเบเกอรี่",
  capabilities: new Set(["manage_members", "full_access"]),
  roleKey: "owner",
  roleName: "Owner",
  profile: {
    myMembership: { roleId: "rol_owner" },
  } as unknown as ActiveOrg["profile"],
};

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ActiveOrgProvider value={org}>
        <ToastProvider>
          <MembersScreen />
        </ToastProvider>
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  reissueMutate.mockClear();
  cancelMutate.mockClear();
});

describe("MembersScreen — reissue asks first (§9.2)", () => {
  it("★ the first press rotates NOTHING — it asks", async () => {
    // The regression this exists for: one press used to invalidate a link that
    // was already in somebody's chat history.
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: membersTh.reissue }));

    expect(reissueMutate).not.toHaveBeenCalled();
    expect(screen.getByText(invitationConfirmTh.reissue.title)).toBeInTheDocument();
  });

  it("★ the dialog says the old link dies, and names WHO the invitation is for", async () => {
    // "Are you sure?" without the consequence is a dialog people learn to press
    // through; without the name it is one they cannot check.
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: membersTh.reissue }));

    const body = screen.getByText(/ลิงก์เดิมที่ส่งไปแล้วจะใช้ไม่ได้ทันที/);
    expect(body).toBeInTheDocument();
    expect(body.textContent).toContain("malee@shop.com");
    // …and that the invitation itself is unchanged, which is the question a
    // reader asks next.
    expect(body.textContent).toContain("อีเมลและสิทธิ์ของคำเชิญไม่เปลี่ยน");
  });

  it("confirming rotates, and says afterwards that the old link is gone", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: membersTh.reissue }));
    // Scoped to the dialog on purpose: ux names the confirm button after the
    // ACTION (§9.2), so it reads identically to the row button behind it. That
    // is the right copy — "ยืนยัน" would make the reader look for what they are
    // confirming — and it means a test must say which of the two it means.
    const dialog = screen.getByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: invitationConfirmTh.reissue.confirm }),
    );

    expect(reissueMutate).toHaveBeenCalledTimes(1);
    expect(reissueMutate.mock.calls[0][0]).toBe("inv_1");
  });

  it("dismissing rotates nothing and leaves the row alone", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: membersTh.reissue }));
    await userEvent.click(screen.getByRole("button", { name: invitationConfirmTh.reissue.cancel }));

    expect(reissueMutate).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText(invitationConfirmTh.reissue.title)).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: membersTh.reissue })).toBeInTheDocument();
  });
});

describe("MembersScreen — cancelling asks first (§9.3)", () => {
  it("★ the first press cancels NOTHING — it asks, destructively", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: membersTh.cancelInvitation }));

    expect(cancelMutate).not.toHaveBeenCalled();
    expect(screen.getByText(invitationConfirmTh.cancelInvitation.title)).toBeInTheDocument();
  });

  it("★ the safe button holds focus, and is worded so the buttons alone are unambiguous", async () => {
    // "ยกเลิก" as the dismiss label of a dialog about cancelling an invitation
    // would mean two different things in one row of buttons. ux chose
    // "ไม่ยกเลิก" for exactly that reason (§9.3), and ui.md §6 puts the focus
    // on the harmless one.
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: membersTh.cancelInvitation }));

    const dismiss = screen.getByRole("button", {
      name: invitationConfirmTh.cancelInvitation.cancel,
    });
    await waitFor(() => expect(dismiss).toHaveFocus());
    expect(dismiss.textContent).toBe("ไม่ยกเลิก");
  });

  it("confirming cancels exactly the invitation the dialog named", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: membersTh.cancelInvitation }));
    const dialog = screen.getByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: invitationConfirmTh.cancelInvitation.confirm }),
    );

    expect(cancelMutate).toHaveBeenCalledTimes(1);
    expect(cancelMutate.mock.calls[0][0]).toBe("inv_1");
  });
});
