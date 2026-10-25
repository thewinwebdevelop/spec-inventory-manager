// T-003-W10 fix round 1 (security review M-1) — R6 must not judge "nobody uses
// this role" from the first page of a paginated list.
//
// The real `use-members` hooks run here against a fake API client that pages
// at TWO rows no matter what `limit` asks for (a server is allowed to clamp).
// So a row that only exists on a later page has to be fetched before the screen
// may say anything about it, and if the list can't be finished, the screen
// must not claim it is empty.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("roleId=rol_staff"),
}));

vi.mock("../api/use-member-mutations", () => ({
  useReissueInvitationLink: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelInvitation: () => ({ mutate: vi.fn(), isPending: false }),
  useChangeMemberRole: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveMember: () => ({ mutate: vi.fn(), isPending: false }),
  useLeaveOrganization: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateInvitation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const PAGE = 2;
type Row = Record<string, unknown> & { status: string };
let invitationRows: Row[] = [];
let memberRows: Row[] = [];
/** When set, every list answers an empty page that still has a cursor. */
let neverEnds = false;
const calls: { path: string; query: Record<string, unknown> }[] = [];

function page(rows: Row[], query: Record<string, unknown>) {
  if (neverEnds) return { items: [], nextCursor: "more" };
  const status = query.status as string | undefined;
  const filtered = !status || status === "all" ? rows : rows.filter((r) => r.status === status);
  const start = query.cursor ? Number(query.cursor) : 0;
  const end = start + PAGE;
  return {
    items: filtered.slice(start, end),
    nextCursor: end < filtered.length ? String(end) : null,
  };
}

const fakeClient = {
  GET: vi.fn(async (path: string, init: { params: { query?: Record<string, unknown> } }) => {
    const query = init.params.query ?? {};
    calls.push({ path, query });
    let data: unknown;
    if (path.endsWith("/roles")) {
      data = {
        items: [{ id: "rol_staff", name: "Staff", key: "staff", isSystem: false }],
        nextCursor: null,
      };
    } else if (path.endsWith("/invitations")) {
      data = page(invitationRows, query);
    } else {
      data = page(memberRows, query);
    }
    return { data, error: undefined, response: new Response(null, { status: 200 }) };
  }),
};
vi.mock("../../../lib/api/use-org-api-client", () => ({
  useOrgApiClient: () => fakeClient,
}));

import { MembersScreen } from "./MembersScreen";
import { MAX_FILTER_PAGES } from "../api/use-members";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";

const ORG: ActiveOrg = {
  orgId: "org_1",
  name: "ร้าน",
  capabilities: new Set(["manage_members", "manage_roles"]),
  roleKey: "admin",
  roleName: "Admin",
  profile: { myMembership: { roleId: "rol_admin" } } as unknown as ActiveOrg["profile"],
};

const invite = (n: number, status: string): Row => ({
  id: `inv_${n}`,
  email: `i${n}@shop.com`,
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
const member = (n: number): Row => ({
  userId: `usr_${n}`,
  email: `m${n}@shop.com`,
  roleId: "rol_staff",
  roleName: "Staff",
  roleKey: "staff",
  status: "active",
  activatedAt: null,
  revokedAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  isMe: false,
  isOwner: false,
});

const NOBODY = "ไม่มีใครใช้บทบาทนี้แล้ว — กลับไปลบบทบาทได้เลย";

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ActiveOrgProvider value={ORG}>
        <ToastProvider>
          <MembersScreen />
        </ToastProvider>
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  neverEnds = false;
  calls.length = 0;
  fakeClient.GET.mockClear();
  memberRows = [];
  invitationRows = [];
});

describe("R6 · pagination (security review W10 M-1)", () => {
  it("★ closed invitations fill page 1 and the open one is on page 2: no 'nobody left' banner", async () => {
    invitationRows = [
      invite(1, "accepted"),
      invite(2, "cancelled"),
      invite(3, "accepted"),
      invite(4, "cancelled"),
      invite(5, "expired"),
    ];
    renderScreen();
    expect(await screen.findByText("i5@shop.com")).toBeInTheDocument();
    expect(screen.getByText("คำเชิญที่ใช้บทบาทนี้ (1)")).toBeInTheDocument();
    expect(screen.queryByText(NOBODY)).toBeNull();
    expect(screen.queryByText("ไม่มีคำเชิญที่ใช้บทบาทนี้แล้ว")).toBeNull();
  });

  it("★ follows nextCursor: every open invitation and every member is shown and counted", async () => {
    invitationRows = [invite(1, "pending"), invite(2, "pending"), invite(3, "pending")];
    memberRows = [member(1), member(2), member(3)];
    renderScreen();
    expect(await screen.findByText("คำเชิญที่ใช้บทบาทนี้ (3)")).toBeInTheDocument();
    expect(await screen.findByText("สมาชิกที่ใช้บทบาทนี้ (3)")).toBeInTheDocument();
    for (const e of ["i3@shop.com", "m3@shop.com"]) expect(screen.getByText(e)).toBeInTheDocument();
    // Every list request stayed inside the role.
    const lists = calls.filter((c) => !c.path.endsWith("/roles"));
    expect(lists.length).toBeGreaterThan(2);
    for (const c of lists) expect(c.query.roleId).toBe("rol_staff");
  });

  it("★ a list that cannot be finished never claims to be empty", async () => {
    neverEnds = true;
    renderScreen();
    // Every list read to the page cap (members + pending + expired), then roles.
    const lists = () => calls.filter((c) => !c.path.endsWith("/roles")).length;
    await waitFor(() => expect(lists()).toBe(3 * MAX_FILTER_PAGES));
    await waitFor(() => expect(screen.getByText("สมาชิกที่ใช้บทบาทนี้ (0)")).toBeInTheDocument());
    expect(screen.queryByText(NOBODY)).toBeNull();
    expect(screen.queryByText("ไม่มีสมาชิกที่ใช้บทบาทนี้แล้ว")).toBeNull();
    expect(screen.queryByText("ไม่มีคำเชิญที่ใช้บทบาทนี้แล้ว")).toBeNull();
  });

  it("control: everything really empty and complete → the banner does show", async () => {
    invitationRows = [invite(1, "accepted"), invite(2, "cancelled"), invite(3, "accepted")];
    renderScreen();
    expect(await screen.findByText(NOBODY)).toBeInTheDocument();
  });
});
