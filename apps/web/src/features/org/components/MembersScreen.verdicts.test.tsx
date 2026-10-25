// T-003-W10 ★ — CW3-03 on the rendered screen: R7 per-row verdicts.
//
// Each case asserts on what a person can PRESS (role=button) and on the exact
// ux §0.3 (ข) sentence, because "the verdict reached the pure function" is not
// the same promise as "the row stopped offering the action".
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const cancelMutate = vi.fn();
vi.mock("../api/use-member-mutations", () => ({
  useReissueInvitationLink: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelInvitation: () => ({ mutate: cancelMutate, isPending: false }),
  useChangeMemberRole: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveMember: () => ({ mutate: vi.fn(), isPending: false }),
  useLeaveOrganization: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateInvitation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const BASE_MEMBER = {
  roleId: "rol_admin",
  roleName: "Admin",
  roleKey: "admin",
  status: "active" as const,
  activatedAt: null,
  revokedAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  isMe: false,
  isOwner: false,
};

const BASE_INVITE = {
  roleId: "rol_staff",
  roleName: "Staff",
  roleKey: "staff",
  expiresAt: "2099-01-01T00:00:00Z",
  tokenIssuedAt: "2026-10-01T00:00:00Z",
  invitedByUserId: "usr_me",
  createdAt: "2026-10-01T00:00:00Z",
  acceptedAt: null,
  acceptedByUserId: null,
  acceptedUserCreatedAfterInvite: null,
};

let memberItems: Record<string, unknown>[] = [];
let invitationItems: Record<string, unknown>[] = [];
const membersRefetch = vi.fn();
const invitationsRefetch = vi.fn();

vi.mock("../api/use-members", () => ({
  useMembers: () => ({
    data: { items: memberItems, nextCursor: null },
    isPending: false,
    isError: false,
    refetch: membersRefetch,
  }),
  useInvitations: () => ({
    data: { items: invitationItems, nextCursor: null },
    isPending: false,
    isError: false,
    refetch: invitationsRefetch,
  }),
  useRoles: () => ({ data: { items: [] }, isPending: false, isError: false, refetch: vi.fn() }),
}));

import { MembersScreen } from "./MembersScreen";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import { membersTh } from "../i18n";
import { ApiRequestError } from "../../../lib/api/error";

function org(capabilities: string[]): ActiveOrg {
  return {
    orgId: "org_1",
    name: "ร้าน",
    capabilities: new Set(capabilities),
    roleKey: "admin",
    roleName: "Admin",
    profile: { myMembership: { roleId: "rol_admin" } } as unknown as ActiveOrg["profile"],
  };
}
const ADMIN = org(["manage_members", "manage_roles"]);
const OWNER = org(["full_access"]);

function renderScreen(viewer: ActiveOrg = ADMIN) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ActiveOrgProvider value={viewer}>
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
function buttonsIn(email: string): string[] {
  return within(rowOf(email))
    .queryAllByRole("button")
    .map((b) => b.textContent ?? "");
}

beforeEach(() => {
  memberItems = [];
  invitationItems = [];
  cancelMutate.mockReset();
  membersRefetch.mockClear();
  invitationsRefetch.mockClear();
});

describe("R7 · member rows follow MemberRow.viewerCanManage", () => {
  const member = (email: string, extra: Record<string, unknown>) => ({
    ...BASE_MEMBER,
    userId: `usr_${email}`,
    email,
    ...extra,
  });

  it("★ AC-5.4b / B17 L-5 — Admin→Admin (equal_permissions): no change/remove, reason shown", () => {
    memberItems = [
      member("adm_b@shop.com", {
        viewerCanManage: false,
        manageBlockedReason: "equal_permissions",
      }),
    ];
    renderScreen(ADMIN);
    expect(buttonsIn("adm_b@shop.com")).toEqual([]);
    expect(
      within(rowOf("adm_b@shop.com")).getByText(
        "คนนี้มีสิทธิ์เท่ากับคุณ — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ["owner_only", "เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนบทบาทหรือถอดเจ้าของร้านคนอื่นได้"],
    [
      "exceeds_your_permissions",
      "คนนี้มีสิทธิ์บางอย่างที่คุณไม่มี — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก",
    ],
    ["reason_from_the_future", "คุณจัดการสมาชิกคนนี้ไม่ได้ — ให้เจ้าของร้านช่วย"],
    [null, "คุณจัดการสมาชิกคนนี้ไม่ได้ — ให้เจ้าของร้านช่วย"],
  ])("blocked reason %s → no actions + its §0.3 (ข) copy", (reason, copy) => {
    memberItems = [member("x@shop.com", { viewerCanManage: false, manageBlockedReason: reason })];
    renderScreen(ADMIN);
    expect(buttonsIn("x@shop.com")).toEqual([]);
    expect(within(rowOf("x@shop.com")).getByText(copy)).toBeInTheDocument();
  });

  it("★ verdict=false wins over Owner caps that would have offered the actions", () => {
    memberItems = [
      member("x@shop.com", { viewerCanManage: false, manageBlockedReason: "owner_only" }),
    ];
    renderScreen(OWNER);
    expect(buttonsIn("x@shop.com")).toEqual([]);
  });

  it("★ verdict=true wins over local caps that would have hidden them (target isOwner)", () => {
    memberItems = [
      member("o2@shop.com", { isOwner: true, viewerCanManage: true, manageBlockedReason: null }),
    ];
    renderScreen(ADMIN);
    expect(buttonsIn("o2@shop.com")).toEqual([membersTh.changeRole, membersTh.removeFromOrg]);
    expect(within(rowOf("o2@shop.com")).queryByText(membersTh.ownerOnlyNotice)).toBeNull();
  });

  it("field absent → F-002: ordinary target offers both; Owner target shows the notice", () => {
    memberItems = [member("s@shop.com", {}), member("o@shop.com", { isOwner: true })];
    renderScreen(org(["manage_members"]));
    expect(buttonsIn("s@shop.com")).toEqual([membersTh.changeRole, membersTh.removeFromOrg]);
    expect(buttonsIn("o@shop.com")).toEqual([]);
    expect(within(rowOf("o@shop.com")).getByText(membersTh.ownerOnlyNotice)).toBeInTheDocument();
  });
});

describe("R7 · invitation rows follow Invitation.viewerCanManage", () => {
  const invite = (email: string, extra: Record<string, unknown>) => ({
    ...BASE_INVITE,
    id: `inv_${email}`,
    email,
    status: "pending",
    ...extra,
  });

  it("pending + true → reissue and cancel", () => {
    invitationItems = [invite("p@x.co", { viewerCanManage: true, manageBlockedReason: null })];
    renderScreen();
    expect(buttonsIn("p@x.co")).toEqual([membersTh.reissue, membersTh.cancelInvitation]);
  });

  it.each([
    ["owner_only", "เฉพาะเจ้าของร้านเท่านั้นที่ยกเลิกหรือออกลิงก์ใหม่ให้คำเชิญเจ้าของร้านได้"],
    [
      "exceeds_your_permissions",
      "คำเชิญนี้ให้บทบาทที่มีสิทธิ์ที่คุณไม่มี — ให้เจ้าของร้านยกเลิกหรือออกลิงก์ใหม่",
    ],
    ["reason_from_the_future", "คุณจัดการคำเชิญนี้ไม่ได้ — ให้เจ้าของร้านช่วย"],
  ])("★ pending + false (%s) → no buttons, reason line", (reason, copy) => {
    invitationItems = [invite("p@x.co", { viewerCanManage: false, manageBlockedReason: reason })];
    renderScreen(OWNER);
    expect(buttonsIn("p@x.co")).toEqual([]);
    expect(within(rowOf("p@x.co")).getByText(copy)).toBeInTheDocument();
  });

  it("★ expired + true → cancel and invite-again, never 'issue new link'", () => {
    invitationItems = [
      invite("e@x.co", {
        status: "expired",
        expiresAt: "2020-01-01T00:00:00Z",
        viewerCanManage: true,
        manageBlockedReason: null,
      }),
    ];
    renderScreen();
    expect(buttonsIn("e@x.co")).toEqual([membersTh.cancelInvitation, membersTh.inviteAgain]);
  });

  it("expired + false → invite-again only, with the reason", () => {
    invitationItems = [
      invite("e@x.co", {
        status: "expired",
        expiresAt: "2020-01-01T00:00:00Z",
        viewerCanManage: false,
        manageBlockedReason: "owner_only",
      }),
    ];
    renderScreen();
    expect(buttonsIn("e@x.co")).toEqual([membersTh.inviteAgain]);
    expect(
      within(rowOf("e@x.co")).getByText(
        "เฉพาะเจ้าของร้านเท่านั้นที่ยกเลิกหรือออกลิงก์ใหม่ให้คำเชิญเจ้าของร้านได้",
      ),
    ).toBeInTheDocument();
  });

  it("field absent → F-002 (pending offers both)", () => {
    invitationItems = [invite("p@x.co", {})];
    renderScreen();
    expect(buttonsIn("p@x.co")).toEqual([membersTh.reissue, membersTh.cancelInvitation]);
  });

  it("★ cancel refused with ROLE_EXCEEDS_ACTOR → §E cancel copy + invitations refetched", async () => {
    invitationItems = [invite("p@x.co", { viewerCanManage: true, manageBlockedReason: null })];
    cancelMutate.mockImplementation((_id: string, opts: { onError: (e: unknown) => void }) =>
      opts.onError(
        new ApiRequestError(403, { error: { code: "ROLE_EXCEEDS_ACTOR", message: "x" } }),
      ),
    );
    renderScreen();
    const user = userEvent.setup();
    await user.click(
      within(rowOf("p@x.co")).getByRole("button", { name: membersTh.cancelInvitation }),
    );
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "ยกเลิกคำเชิญ" }),
    );
    expect(
      await screen.findByText(
        "คำเชิญนี้ให้บทบาทที่มีสิทธิ์ที่คุณไม่มี จึงยกเลิกไม่ได้ — ให้เจ้าของร้านทำ",
      ),
    ).toBeInTheDocument();
    expect(invitationsRefetch).toHaveBeenCalled();
  });
});
