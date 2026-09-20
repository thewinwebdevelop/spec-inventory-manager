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
  // ★ B-9 — `grantsOwnership` comes from the server, derived from capabilities.
  // Deliberately NOT aligned with `key` in the impostor case below.
  { id: "rol_owner", name: "Owner", key: "owner", grantsOwnership: true },
  { id: "rol_admin", name: "Admin", key: "admin", grantsOwnership: false },
  { id: "rol_staff", name: "Staff", key: "staff", grantsOwnership: false },
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

/** Swappable so one case can hand in I-45's key-vs-capability impostor. */
let rolesData: { items: { id: string; name: string; key: string; grantsOwnership: boolean }[] } = {
  items: [],
};

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
  useRoles: () => ({ data: rolesData, isLoading: false, isError: false, refetch: rolesRefetch }),
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
  rolesData = { items: ROLES };
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

  it("★ an Admin sees the Owner option DISABLED, with the reason next to it (B-9)", async () => {
    // This case used to assert the opposite, and its comment promised it would
    // fail the day §3.6 grew a `grantsOwnership` flag. That day is today.
    //
    // Before: `ownerRoleIds` could only ever hold a role the VIEWER held, so
    // for an Admin it was empty and no client code could identify the Owner
    // option to grey out — §10.1 was unimplementable and S7's filter filtered
    // nothing. Now the server says which role grants ownership, still without
    // publishing `capabilities`.
    //
    // The safety property never depended on this: the server refuses an
    // over-privileged grant regardless (C-1/D-028), and the dialog carries the
    // 403 copy. What changes is that the Admin is told WHY instead of being
    // handed a button that fails.
    const admin: ActiveOrg = { ...owner, capabilities: new Set(["manage_members"]) };
    renderScreen(admin);
    await userEvent.click(
      within(rowOf("malee@shop.com")).getByRole("button", { name: membersTh.changeRole }),
    );
    const dialog = screen.getByRole("dialog", { name: CHANGE_ROLE_COPY.title("malee@shop.com") });

    expect(within(dialog).getByRole("radio", { name: /เจ้าของร้าน/ })).toBeDisabled();
    expect(within(dialog).getByText(CHANGE_ROLE_COPY.ownerOnlyHelper)).toBeInTheDocument();
  });

  it("★ a role whose KEY says owner but whose flag says no is offerable", async () => {
    // The client trusts the flag, not the slug — so a Staff role with
    // `key: "owner"` (I-45's database trick) must NOT be treated as ownership.
    // If this ever fails, somebody has reintroduced the key shortcut on the
    // client after the server spent a test proving it wrong.
    const impostorRoles = [
      { id: "rol_owner", name: "Owner", key: "owner", grantsOwnership: true },
      { id: "rol_trap", name: "Staff", key: "owner", grantsOwnership: false },
    ];
    rolesData = { items: impostorRoles };
    const admin: ActiveOrg = { ...owner, capabilities: new Set(["manage_members"]) };
    renderScreen(admin);
    await userEvent.click(
      within(rowOf("malee@shop.com")).getByRole("button", { name: membersTh.changeRole }),
    );
    const dialog = screen.getByRole("dialog", { name: CHANGE_ROLE_COPY.title("malee@shop.com") });

    const options = within(dialog).getAllByRole("radio");
    // Two roles, one disabled (the real Owner) and one not (the impostor).
    expect(options.filter((o) => (o as HTMLInputElement).disabled)).toHaveLength(1);
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
