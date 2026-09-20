/**
 * ★ B-15 — the members screen, on the rows whose link is already dead.
 *
 * The unit tests next door pin the labels; this one pins the SCREEN, because
 * the defect was never in the formatter. `formatExpiry` warns in its own doc
 * comment against "telling somebody a dead link is live", and `MembersScreen`
 * called it unconditionally — so the module was right and the page was wrong,
 * which is the shape no amount of testing the module can catch.
 *
 * Found by hand, during the §12.2 manual pass: cancel an invitation, and the
 * row it leaves behind still advertises seven more days.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../api/use-member-mutations", () => ({
  useReissueInvitationLink: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelInvitation: () => ({ mutate: vi.fn(), isPending: false }),
  useChangeMemberRole: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveMember: () => ({ mutate: vi.fn(), isPending: false }),
  useLeaveOrganization: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateInvitation: () => ({ mutate: vi.fn(), isPending: false }),
}));

/** Days away on every row — which is exactly why reading it alone was wrong. */
const FAR_FUTURE = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString();

const base = {
  roleId: "rol_staff",
  roleName: "Staff",
  roleKey: "staff",
  expiresAt: FAR_FUTURE,
  createdAt: new Date().toISOString(),
  acceptedUserCreatedAfterInvite: null,
};

const INVITATIONS = [
  { ...base, id: "inv_live", email: "live@shop.com", status: "pending", acceptedAt: null },
  { ...base, id: "inv_cancelled", email: "cancelled@shop.com", status: "cancelled", acceptedAt: null },
  {
    ...base,
    id: "inv_accepted",
    email: "accepted@shop.com",
    status: "accepted",
    acceptedAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
];

vi.mock("../api/use-members", () => ({
  useMembers: () => ({
    data: { items: [], nextCursor: null },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useInvitations: () => ({
    data: { items: INVITATIONS, nextCursor: null },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useRoles: () => ({ data: { items: [] }, isLoading: false, isError: false }),
}));

import { MembersScreen } from "./MembersScreen";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";

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

/** The row containing this email, as a subtree to read. */
function rowFor(email: string): HTMLElement {
  const cell = screen.getByText(email);
  const row = cell.closest("li");
  if (!row) throw new Error(`no row for ${email}`);
  return row;
}

describe("★ B-15 — a dead invitation must not advertise a live link", () => {
  it("★ the cancelled row says ยกเลิกแล้ว and gives NO expiry", () => {
    renderScreen();
    const row = rowFor("cancelled@shop.com");

    expect(row.textContent).toContain("ยกเลิกแล้ว");
    // The regression, verbatim: this row used to read
    // "ลิงก์ใช้ได้ถึง 11 ก.ย. 2569 20:36 (อีกประมาณ 7 วัน)".
    expect(row.textContent).not.toContain("ลิงก์ใช้ได้ถึง");
    expect(row.textContent).not.toContain("อีกประมาณ");
  });

  it("★ the accepted row says WHEN it was accepted — M-04's actual question", () => {
    renderScreen();
    const row = rowFor("accepted@shop.com");

    expect(row.textContent).toContain("รับแล้วเมื่อ");
    expect(row.textContent).not.toContain("ลิงก์ใช้ได้ถึง");
  });

  it("the still-live row keeps its expiry — the fix must not blank every row", () => {
    // Non-vacuity: a version that simply dropped the line everywhere would
    // pass both tests above and lose the one thing the inviter needs.
    renderScreen();
    const row = rowFor("live@shop.com");

    expect(row.textContent).toContain("รอตอบรับ");
    expect(row.textContent).toContain("ลิงก์ใช้ได้ถึง");
  });
});
