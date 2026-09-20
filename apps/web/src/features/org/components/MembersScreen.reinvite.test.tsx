// ★ ux-wireframe §7's "เชิญใหม่อีกครั้ง" — the button on an invitation row
// whose link is already dead (`expired`/`cancelled`), which reopens S7
// pre-filled with that row's email and role.
//
// The one rule this file exists to pin: `accepted` and `pending` rows must
// NEVER offer it — an accepted invitee is already in the shop, so "invite
// again" would be a lie, and a pending row already has its own two buttons
// (§7's full table).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// ★ B-9 — `grantsOwnership` from the server, not derived from `key`.
const ROLES = [
  { id: "rol_owner", name: "Owner", key: "owner", grantsOwnership: true },
  { id: "rol_admin", name: "Admin", key: "admin", grantsOwnership: false },
  { id: "rol_staff", name: "Staff", key: "staff", grantsOwnership: false },
];

const base = {
  roleId: "rol_staff",
  roleName: "Staff",
  roleKey: "staff",
  expiresAt: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
  tokenIssuedAt: new Date().toISOString(),
  invitedByUserId: "usr_owner",
  createdAt: new Date().toISOString(),
  acceptedByUserId: null,
  acceptedUserCreatedAfterInvite: null,
};

const PENDING = { ...base, id: "inv_pending", email: "pending@shop.com", status: "pending" as const, acceptedAt: null };
const EXPIRED = { ...base, id: "inv_expired", email: "expired@shop.com", status: "expired" as const, acceptedAt: null };
const CANCELLED = { ...base, id: "inv_cancelled", email: "cancelled@shop.com", status: "cancelled" as const, acceptedAt: null };
const ACCEPTED = {
  ...base,
  id: "inv_accepted",
  email: "accepted@shop.com",
  status: "accepted" as const,
  acceptedAt: new Date().toISOString(),
};
/** An expired invitation that offered the OWNER role. */
const EXPIRED_OWNER_ROW = {
  ...base,
  id: "inv_expired_owner",
  email: "was-owner@shop.com",
  status: "expired" as const,
  acceptedAt: null,
  roleId: "rol_owner",
  roleName: "Owner",
  roleKey: "owner",
};

let invitations: InvitationRow[] = [PENDING, EXPIRED, CANCELLED, ACCEPTED];

vi.mock("../api/use-members", () => ({
  useMembers: () => ({
    data: { items: [], nextCursor: null },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useInvitations: () => ({
    data: { items: invitations, nextCursor: null },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useRoles: () => ({ data: { items: ROLES }, isLoading: false, isError: false }),
}));

import { MembersScreen } from "./MembersScreen";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import { membersTh, inviteFormTh } from "../i18n";
import type { InvitationRow } from "../api/use-members";

const owner: ActiveOrg = {
  orgId: "org_1",
  name: "ร้านหอมกรุ่นเบเกอรี่",
  capabilities: new Set(["full_access"]),
  roleKey: "owner",
  roleName: "Owner",
  profile: { myMembership: { roleId: "rol_owner" } } as unknown as ActiveOrg["profile"],
};

const admin: ActiveOrg = { ...owner, capabilities: new Set(["manage_members"]) };

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

function rowFor(email: string): HTMLElement {
  const cell = screen.getByText(email);
  const row = cell.closest("li");
  if (!row) throw new Error(`no row for ${email}`);
  return row;
}

beforeEach(() => {
  invitations = [PENDING, EXPIRED, CANCELLED, ACCEPTED];
});

describe('§7 — "เชิญใหม่อีกครั้ง" shows only on a dead invitation', () => {
  it("shown on an EXPIRED row", () => {
    renderScreen();
    expect(
      within(rowFor("expired@shop.com")).getByRole("button", { name: membersTh.inviteAgain }),
    ).toBeInTheDocument();
  });

  it("shown on a CANCELLED row", () => {
    renderScreen();
    expect(
      within(rowFor("cancelled@shop.com")).getByRole("button", { name: membersTh.inviteAgain }),
    ).toBeInTheDocument();
  });

  it("⛔ NOT shown on an ACCEPTED row — that person is already in the shop", () => {
    renderScreen();
    expect(
      within(rowFor("accepted@shop.com")).queryByRole("button", { name: membersTh.inviteAgain }),
    ).toBeNull();
  });

  it("NOT shown on a PENDING row — it already has its own two buttons", () => {
    renderScreen();
    const row = rowFor("pending@shop.com");
    expect(within(row).queryByRole("button", { name: membersTh.inviteAgain })).toBeNull();
    expect(within(row).getByRole("button", { name: membersTh.reissue })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: membersTh.cancelInvitation })).toBeInTheDocument();
  });
});

describe("§7 — the button pre-fills S7 from the dead row", () => {
  it("★ opens S7 with the row's email and role, both still editable", async () => {
    renderScreen();
    await userEvent.click(
      within(rowFor("expired@shop.com")).getByRole("button", { name: membersTh.inviteAgain }),
    );

    const dialog = screen.getByRole("dialog", { name: inviteFormTh.title });
    const emailField = within(dialog).getByRole("textbox", { name: inviteFormTh.emailLabel });
    expect(emailField).toHaveValue("expired@shop.com");
    expect(emailField).toBeEnabled();

    const staffRadio = within(dialog).getByRole("radio", { name: /พนักงาน/ }) as HTMLInputElement;
    expect(staffRadio.checked).toBe(true);
    expect(staffRadio.disabled).toBe(false);
  });

  it("★ an Owner-role row, reopened by an Owner, still pre-fills Owner", async () => {
    invitations = [EXPIRED_OWNER_ROW];
    renderScreen(owner);
    await userEvent.click(
      within(rowFor("was-owner@shop.com")).getByRole("button", { name: membersTh.inviteAgain }),
    );

    const dialog = screen.getByRole("dialog", { name: inviteFormTh.title });
    const ownerRadio = within(dialog).getByRole("radio", { name: /เจ้าของร้าน/ }) as HTMLInputElement;
    expect(ownerRadio.checked).toBe(true);
  });

  it("⛔ an Owner-role row, reopened by a non-Owner, leaves NO role selected — never pre-fill a choice that cannot be submitted", async () => {
    invitations = [EXPIRED_OWNER_ROW];
    renderScreen(admin);
    await userEvent.click(
      within(rowFor("was-owner@shop.com")).getByRole("button", { name: membersTh.inviteAgain }),
    );

    const dialog = screen.getByRole("dialog", { name: inviteFormTh.title });
    // The email still carries over — only the role is withheld.
    expect(within(dialog).getByRole("textbox", { name: inviteFormTh.emailLabel })).toHaveValue(
      "was-owner@shop.com",
    );
    const radios = within(dialog).getAllByRole("radio") as HTMLInputElement[];
    expect(radios.some((r) => r.checked)).toBe(false);
    // The Owner option is shown, disabled, with the same helper §8 already uses.
    const ownerRadio = within(dialog).getByRole("radio", { name: /เจ้าของร้าน/ }) as HTMLInputElement;
    expect(ownerRadio.disabled).toBe(true);
    expect(within(dialog).getByText(inviteFormTh.ownerOnlyHelper)).toBeInTheDocument();
  });
});
