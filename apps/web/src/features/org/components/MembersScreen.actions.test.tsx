// W-17 — the member row's actions, which were `<span>`s until now.
//
// The debt this closes is a specific kind: W5 wrote all five mutation hooks and
// W6 rendered the action names as TEXT, so S9 (เปลี่ยนสิทธิ์) and S10 (ถอดออก
// จากร้าน) existed on screen as words nobody could press. Every AC behind
// US-5/US-6 was signed off against code that could not be reached, and no test
// noticed because the words were all there.
//
// So these cases are about REACHABILITY first and copy second, and the Owner
// here holds `full_access` alone — the capability list a real system Owner
// actually has, which is the case the older harnesses never supplied.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const changeRoleMutate = vi.fn();
const removeMutate = vi.fn();
const leaveMutate = vi.fn();

vi.mock("../api/use-member-mutations", () => ({
  useReissueInvitationLink: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelInvitation: () => ({ mutate: vi.fn(), isPending: false }),
  useChangeMemberRole: () => ({ mutate: changeRoleMutate, isPending: false }),
  useRemoveMember: () => ({ mutate: removeMutate, isPending: false }),
  useLeaveOrganization: () => ({ mutate: leaveMutate, isPending: false }),
  useCreateInvitation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const ROLES = [
  { id: "rol_owner", name: "Owner", key: "owner" },
  { id: "rol_admin", name: "Admin", key: "admin" },
  { id: "rol_staff", name: "Staff", key: "staff" },
];

const ME = {
  userId: "usr_me",
  email: "owner@shop.com",
  roleId: "rol_owner",
  roleName: "Owner",
  roleKey: "owner",
  status: "active" as const,
  activatedAt: null,
  revokedAt: null,
  createdAt: new Date().toISOString(),
  isMe: true,
  isOwner: true,
};

const MALEE = {
  ...ME,
  userId: "usr_malee",
  email: "malee@shop.com",
  roleId: "rol_staff",
  roleName: "Staff",
  roleKey: "staff",
  isMe: false,
  isOwner: false,
};

const rolesRefetch = vi.fn();

vi.mock("../api/use-members", () => ({
  useMembers: () => ({
    data: { items: [ME, MALEE], nextCursor: null },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useInvitations: () => ({
    data: { items: [], nextCursor: null },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useRoles: () => ({ data: { items: ROLES }, isLoading: false, isError: false, refetch: rolesRefetch }),
}));

import { MembersScreen } from "./MembersScreen";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import { membersTh } from "../i18n";
import { CHANGE_ROLE_COPY } from "./ChangeRoleDialog";
import { REMOVE_MEMBER_COPY } from "./RemoveMemberDialog";
import { LEAVE_ORG_DIALOG_COPY } from "./LeaveOrgDialog";

/** ★ What a real system Owner holds: the wildcard, and nothing else. */
const owner: ActiveOrg = {
  orgId: "org_1",
  name: "ร้านหอมกรุ่นเบเกอรี่",
  capabilities: new Set(["full_access"]),
  roleKey: "owner",
  roleName: "Owner",
  profile: {
    myMembership: { roleId: "rol_owner" },
  } as unknown as ActiveOrg["profile"],
};

function renderScreen(org: ActiveOrg = owner) {
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

function rowOf(email: string): HTMLElement {
  return screen.getAllByRole("listitem").find((li) => li.textContent?.includes(email))!;
}

beforeEach(() => {
  changeRoleMutate.mockClear();
  removeMutate.mockClear();
  leaveMutate.mockClear();
  rolesRefetch.mockClear();
});

describe("W-17 · the row's actions are controls, not words", () => {
  it("★ every offered action is a real button — the regression this closes", () => {
    renderScreen();
    const malee = rowOf("malee@shop.com");

    // If these ever go back to being `<span>`s, this is the case that says so.
    expect(within(malee).getByRole("button", { name: membersTh.changeRole })).toBeInTheDocument();
    expect(
      within(malee).getByRole("button", { name: membersTh.removeFromOrg }),
    ).toBeInTheDocument();

    // …and my own row offers leaving instead of removing (D-029, §7).
    const me = rowOf("owner@shop.com");
    expect(within(me).getByRole("button", { name: membersTh.leaveOrg })).toBeInTheDocument();
    expect(within(me).queryByRole("button", { name: membersTh.removeFromOrg })).toBeNull();
  });

  it("opens S9 for the person named on the row", async () => {
    renderScreen();
    await userEvent.click(
      within(rowOf("malee@shop.com")).getByRole("button", { name: membersTh.changeRole }),
    );

    expect(
      screen.getByRole("dialog", { name: CHANGE_ROLE_COPY.title("malee@shop.com") }),
    ).toBeInTheDocument();
  });

  it("opens S10 for the person named on the row, and asks before removing", async () => {
    renderScreen();
    await userEvent.click(
      within(rowOf("malee@shop.com")).getByRole("button", { name: membersTh.removeFromOrg }),
    );

    // Nothing happened yet: the press opens the question.
    expect(removeMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog", {
      name: REMOVE_MEMBER_COPY.title("malee@shop.com"),
    });
    // ux review item 8: four consequences, not "แน่ใจหรือไม่".
    for (const line of REMOVE_MEMBER_COPY.consequences) {
      expect(within(dialog).getByText(line)).toBeInTheDocument();
    }
  });

  it("my own row opens the LEAVE dialog, never the remove one (§10.3, D-029)", async () => {
    renderScreen();
    await userEvent.click(
      within(rowOf("owner@shop.com")).getByRole("button", { name: membersTh.leaveOrg }),
    );

    expect(screen.getByText(LEAVE_ORG_DIALOG_COPY.body)).toBeInTheDocument();
    expect(leaveMutate).not.toHaveBeenCalled();
  });
});

describe("S9 · เปลี่ยนสิทธิ์ (§10.1)", () => {
  async function openChangeRole() {
    renderScreen();
    await userEvent.click(
      within(rowOf("malee@shop.com")).getByRole("button", { name: membersTh.changeRole }),
    );
    return screen.getByRole("dialog", { name: CHANGE_ROLE_COPY.title("malee@shop.com") });
  }

  it("marks the current role in WORDS and refuses to save a non-change", async () => {
    const dialog = await openChangeRole();

    // §14 again: the current value is stated, not implied by a filled radio.
    expect(within(dialog).getByText(CHANGE_ROLE_COPY.currentTag)).toBeInTheDocument();
    // A write that changes nothing is still an audit row saying somebody did
    // something they did not do.
    expect(within(dialog).getByRole("button", { name: CHANGE_ROLE_COPY.submit })).toBeDisabled();
  });

  it("★ sends the picked role for the picked person, once", async () => {
    const dialog = await openChangeRole();
    await userEvent.click(within(dialog).getByRole("radio", { name: /ผู้ดูแล/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: CHANGE_ROLE_COPY.submit }));

    expect(changeRoleMutate).toHaveBeenCalledTimes(1);
    expect(changeRoleMutate.mock.calls[0][0]).toEqual({
      userId: "usr_malee",
      roleId: "rol_admin",
    });
  });

  it("★ an Owner may offer the Owner role; the option is shown, not hidden", async () => {
    const dialog = await openChangeRole();
    // D-028/C-1 — and §8's rule that it is SHOWN rather than filtered, so an
    // Admin can see the role exists and read why it is closed to them.
    expect(within(dialog).getByRole("radio", { name: /เจ้าของร้าน/ })).toBeEnabled();
  });

  it("⚠️ an Admin gets the Owner option ENABLED — the client cannot tell which role it is", async () => {
    // NOT the behaviour §10.1 asks for, and the gap is in the contract rather
    // than here. The rule is that ownership is a CAPABILITY, never a role key
    // (F-003 lets people mint roles), and `GET /orgs/{orgId}/roles` publishes
    // no capabilities (§3.6). So `ownerRoleIds` can only ever contain a role
    // the viewer holds themselves — for an Admin it is empty, and no amount
    // of client code can identify the Owner role to grey it out.
    //
    // The same hole is already in S7's invite dialog, whose `assignableRoles`
    // filter therefore filters nothing for an Admin.
    //
    // Pinned as it IS rather than as it should be, so the day §3.6 grows a
    // `grantsOwnership` flag (filed for backend-api) this case fails and says
    // what to change. The safety property does not depend on it: the server
    // refuses with `403 FORBIDDEN`, and the dialog has that copy verbatim.
    const admin: ActiveOrg = { ...owner, capabilities: new Set(["manage_members"]) };
    renderScreen(admin);
    await userEvent.click(
      within(rowOf("malee@shop.com")).getByRole("button", { name: membersTh.changeRole }),
    );
    const dialog = screen.getByRole("dialog", { name: CHANGE_ROLE_COPY.title("malee@shop.com") });

    expect(within(dialog).getByRole("radio", { name: /เจ้าของร้าน/ })).toBeEnabled();
    expect(within(dialog).queryByText(CHANGE_ROLE_COPY.ownerOnlyHelper)).toBeNull();
  });

  it("★ warns BEFORE the press when the change would demote an Owner", async () => {
    renderScreen();
    // Malee is an Owner in this render, being moved to Staff.
    const ownerRow = rowOf("owner@shop.com");
    await userEvent.click(within(ownerRow).getByRole("button", { name: membersTh.changeRole }));
    const dialog = screen.getByRole("dialog", { name: CHANGE_ROLE_COPY.title("owner@shop.com") });

    // Nothing yet — the current role is still Owner.
    expect(within(dialog).queryByText(CHANGE_ROLE_COPY.lastOwnerWarning)).toBeNull();

    await userEvent.click(within(dialog).getByRole("radio", { name: /พนักงาน/ }));
    // `409 LAST_OWNER` after the fact is the same sentence, delivered too late.
    expect(within(dialog).getByText(CHANGE_ROLE_COPY.lastOwnerWarning)).toBeInTheDocument();
  });
});
