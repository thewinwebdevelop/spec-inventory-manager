// T-003-W10 ★ — R6: `/settings/members?roleId=<id>` (ux-wireframe R6).
//
// The filter is the way out of R5's ROLE_IN_USE, so the numbers on this screen
// must be the numbers R5 quoted: active members + invitations that are still
// open (pending AND expired — AC-3.9), never accepted/cancelled history.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const replace = vi.fn();
const push = vi.fn();
let search = new URLSearchParams("roleId=rol_staff");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => search,
}));

vi.mock("../api/use-member-mutations", () => ({
  useReissueInvitationLink: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelInvitation: () => ({ mutate: vi.fn(), isPending: false }),
  useChangeMemberRole: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveMember: () => ({ mutate: vi.fn(), isPending: false }),
  useLeaveOrganization: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateInvitation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const MEMBER = {
  userId: "usr_s",
  email: "somchai@shop.com",
  roleId: "rol_staff",
  roleName: "Staff",
  roleKey: "staff",
  status: "active" as const,
  activatedAt: null,
  revokedAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  isMe: false,
  isOwner: false,
};
const invite = (email: string, status: string) => ({
  id: `inv_${email}`,
  email,
  roleId: "rol_staff",
  roleName: "Staff",
  roleKey: "staff",
  status,
  expiresAt: status === "expired" ? "2020-01-01T00:00:00Z" : "2099-01-01T00:00:00Z",
  tokenIssuedAt: "2026-10-01T00:00:00Z",
  invitedByUserId: "usr_me",
  createdAt: "2026-10-01T00:00:00Z",
  acceptedAt: null,
  acceptedByUserId: null,
  acceptedUserCreatedAfterInvite: null,
});

let memberItems: unknown[] = [];
let invitationItems: unknown[] = [];
const useMembersSpy = vi.fn();
const useInvitationsSpy = vi.fn();
const ROLES = [
  { id: "rol_staff", name: "แพ็คของ", key: "staff", nameCustomized: true, isSystem: false },
];

vi.mock("../api/use-members", () => ({
  useMembers: (...args: unknown[]) => {
    useMembersSpy(...args);
    return {
      data: { items: memberItems, nextCursor: null },
      isPending: false,
      isSuccess: true,
      isError: false,
      refetch: vi.fn(),
    };
  },
  useInvitations: (...args: unknown[]) => {
    useInvitationsSpy(...args);
    return {
      data: { items: invitationItems, nextCursor: null },
      isPending: false,
      isSuccess: true,
      isError: false,
      refetch: vi.fn(),
    };
  },
  useRoles: () => ({ data: { items: ROLES }, isPending: false, isError: false, refetch: vi.fn() }),
}));

import { MembersScreen } from "./MembersScreen";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import { membersTh } from "../i18n";

function viewer(capabilities: string[]): ActiveOrg {
  return {
    orgId: "org_1",
    name: "ร้าน",
    capabilities: new Set(capabilities),
    roleKey: "admin",
    roleName: "Admin",
    profile: { myMembership: { roleId: "rol_admin" } } as unknown as ActiveOrg["profile"],
  };
}

function renderScreen(caps: string[] = ["manage_members", "manage_roles"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ActiveOrgProvider value={viewer(caps)}>
        <ToastProvider>
          <MembersScreen />
        </ToastProvider>
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  search = new URLSearchParams("roleId=rol_staff");
  memberItems = [MEMBER];
  invitationItems = [
    invite("malee@shop.com", "expired"),
    invite("nok@shop.com", "pending"),
    invite("old@shop.com", "accepted"),
    invite("gone@shop.com", "cancelled"),
  ];
  replace.mockClear();
  push.mockClear();
  useMembersSpy.mockClear();
  useInvitationsSpy.mockClear();
});

describe("R6 · members/invitations filtered by ?roleId=", () => {
  it("★ asks the server for this role only: active members + every invitation status", () => {
    renderScreen();
    expect(useMembersSpy).toHaveBeenCalledWith("active", "rol_staff");
    expect(useInvitationsSpy).toHaveBeenCalledWith("all", "rol_staff");
  });

  it("★ shows pending + expired invitations only (AC-3.9), with the R6 headings", () => {
    renderScreen();
    expect(screen.getByText("คำเชิญที่ใช้บทบาทนี้ (2)")).toBeInTheDocument();
    expect(screen.getByText("สมาชิกที่ใช้บทบาทนี้ (1)")).toBeInTheDocument();
    expect(screen.getByText("malee@shop.com")).toBeInTheDocument();
    expect(screen.getByText("nok@shop.com")).toBeInTheDocument();
    expect(screen.queryByText("old@shop.com")).toBeNull();
    expect(screen.queryByText("gone@shop.com")).toBeNull();
    // The F-002 history toggles answer a different question; R6 does not show them.
    expect(screen.queryByRole("button", { name: membersTh.showRevokedMembers })).toBeNull();
  });

  it("banner names the role by the display rule (nameCustomized wins over key)", () => {
    renderScreen();
    expect(screen.getByText('กำลังแสดงเฉพาะคนที่ใช้บทบาท "แพ็คของ"')).toBeInTheDocument();
  });

  it("an unknown roleId → generic banner, never a raw id", () => {
    search = new URLSearchParams("roleId=rol_nope");
    renderScreen();
    expect(screen.getByText("กำลังแสดงเฉพาะคนที่ใช้บทบาทที่เลือก")).toBeInTheDocument();
    expect(screen.queryByText(/rol_nope/)).toBeNull();
  });

  it("'แสดงทั้งหมด' drops the filter", async () => {
    renderScreen();
    await userEvent.setup().click(screen.getByRole("button", { name: "แสดงทั้งหมด" }));
    expect(replace).toHaveBeenCalledWith("/o/org_1/settings/members");
  });

  it("'กลับไปที่บทบาท' only for manage_roles, and goes to that role", async () => {
    renderScreen();
    await userEvent.setup().click(screen.getByRole("button", { name: 'กลับไปที่บทบาท "แพ็คของ"' }));
    expect(push).toHaveBeenCalledWith("/o/org_1/settings/roles/rol_staff");
  });

  it("without manage_roles there is no way back to the role screen", () => {
    renderScreen(["manage_members"]);
    expect(screen.queryByRole("button", { name: /กลับไปที่บทบาท/ })).toBeNull();
  });

  it("per-section empty copy", () => {
    invitationItems = [invite("old@shop.com", "accepted")];
    renderScreen();
    expect(screen.getByText("ไม่มีคำเชิญที่ใช้บทบาทนี้แล้ว")).toBeInTheDocument();
    expect(screen.queryByText("ไม่มีสมาชิกที่ใช้บทบาทนี้แล้ว")).toBeNull();
  });

  it("★ both empty → success banner pointing back to delete the role", () => {
    memberItems = [];
    invitationItems = [];
    renderScreen();
    expect(screen.getByText("ไม่มีใครใช้บทบาทนี้แล้ว — กลับไปลบบทบาทได้เลย")).toBeInTheDocument();
    expect(screen.getByText("ไม่มีสมาชิกที่ใช้บทบาทนี้แล้ว")).toBeInTheDocument();
  });

  it("no roleId → the unfiltered F-002 screen and queries", () => {
    search = new URLSearchParams();
    renderScreen();
    expect(useMembersSpy).toHaveBeenCalledWith("active", undefined);
    expect(useInvitationsSpy).toHaveBeenCalledWith("pending", undefined);
    expect(screen.queryByText(/กำลังแสดงเฉพาะคนที่ใช้บทบาท/)).toBeNull();
  });
});
