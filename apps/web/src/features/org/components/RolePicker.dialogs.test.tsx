// T-003-W11 ★ — R8: the role picker in InviteDialog and ChangeRoleDialog is
// driven by `GET /roles` — custom roles included, unassignable roles SHOWN and
// DISABLED with the server's reason (never hidden), unknown reason -> generic.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const createMutate = vi.fn();
const changeMutate = vi.fn();
vi.mock("../api/use-member-mutations", () => ({
  useCreateInvitation: () => ({ mutate: createMutate, isPending: false }),
  useChangeMemberRole: () => ({ mutate: changeMutate, isPending: false }),
}));

let roleItems: unknown[] = [];
vi.mock("../api/use-members", () => ({
  useRoles: () => ({
    data: { items: roleItems, nextCursor: null },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import { InviteDialog } from "./InviteDialog";
import { ChangeRoleDialog } from "./ChangeRoleDialog";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";

const ORG = {
  orgId: "org_1",
  name: "ร้าน",
  capabilities: new Set(["manage_members"]),
  roleKey: null,
  roleName: "Team lead",
  profile: { myMembership: { roleId: "rol_lead" } },
} as unknown as ActiveOrg;

const ROLES = [
  {
    id: "rol_owner",
    name: "Owner",
    key: "owner",
    nameCustomized: false,
    viewerCanAssign: false,
    assignBlockedReason: "owner_only",
  },
  {
    id: "rol_admin",
    name: "Admin",
    key: "admin",
    nameCustomized: false,
    viewerCanAssign: true,
    assignBlockedReason: null,
  },
  // A role the shop made itself: key null, its own name.
  {
    id: "rol_pack",
    name: "พนักงานแพ็คของ",
    key: null,
    nameCustomized: true,
    viewerCanAssign: true,
    assignBlockedReason: null,
  },
  {
    id: "rol_ext",
    name: "บัญชีภายนอก",
    key: null,
    nameCustomized: true,
    viewerCanAssign: false,
    assignBlockedReason: "exceeds_your_permissions",
  },
  {
    id: "rol_future",
    name: "บทบาทอนาคต",
    key: null,
    nameCustomized: true,
    viewerCanAssign: false,
    assignBlockedReason: "reason_from_the_future",
  },
  // A system role the shop renamed: the shop's own name wins.
  {
    id: "rol_staff",
    name: "แคชเชียร์",
    key: "staff",
    nameCustomized: true,
    viewerCanAssign: true,
    assignBlockedReason: null,
  },
];

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ActiveOrgProvider value={ORG}>
        <ToastProvider>{ui}</ToastProvider>
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
}

const renderers = {
  InviteDialog: () =>
    wrap(<InviteDialog ownerRoleIds={new Set()} onIssued={vi.fn()} onClose={vi.fn()} />),
  ChangeRoleDialog: () =>
    wrap(
      <ChangeRoleDialog
        member={{ userId: "usr_b", email: "b@shop.com", roleId: "rol_admin", isOwner: false }}
        ownerRoleIds={new Set()}
        onClose={vi.fn()}
      />,
    ),
};

beforeEach(() => {
  roleItems = ROLES;
  createMutate.mockClear();
  changeMutate.mockClear();
});

describe.each(Object.entries(renderers))("%s · R8 role picker", (_name, mount) => {
  it("★ lists every role from GET /roles in server order, custom roles included", () => {
    mount();
    const names = screen.getAllByRole("radio").map((r) => r.closest("label")?.textContent ?? "");
    expect(names).toHaveLength(ROLES.length);
    expect(names[0]).toContain("เจ้าของร้าน");
    expect(names[1]).toContain("ผู้ดูแล");
    expect(names[2]).toContain("พนักงานแพ็คของ");
    // renamed system role shows the shop's name, not the key translation
    expect(names[5]).toContain("แคชเชียร์");
    expect(names[5]).not.toContain("พนักงาน ");
  });

  it("★ viewerCanAssign=false -> disabled WITH the reason, still in the DOM (not hidden)", () => {
    mount();
    const owner = screen.getByRole("radio", { name: /เจ้าของร้าน/ });
    expect(owner).toBeDisabled();
    expect(
      screen.getByText("เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้"),
    ).toBeInTheDocument();
    const ext = screen.getByRole("radio", { name: /บัญชีภายนอก/ });
    expect(ext).toBeDisabled();
    expect(
      screen.getByText("บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงมอบให้คนอื่นไม่ได้"),
    ).toBeInTheDocument();
  });

  it("★ unknown assignBlockedReason -> generic copy, still disabled", () => {
    mount();
    expect(screen.getByRole("radio", { name: /บทบาทอนาคต/ })).toBeDisabled();
    expect(screen.getByText("คุณมอบบทบาทนี้ไม่ได้")).toBeInTheDocument();
  });

  it("viewerCanAssign=true (custom and system) -> enabled, no reason line", () => {
    mount();
    expect(screen.getByRole("radio", { name: /พนักงานแพ็คของ/ })).toBeEnabled();
    expect(screen.getByRole("radio", { name: /ผู้ดูแล/ })).toBeEnabled();
  });

  it("★ never computes assignability itself: ownerRoleIds is ignored when the server gave a verdict", () => {
    roleItems = [
      {
        id: "rol_x",
        name: "X",
        key: null,
        nameCustomized: true,
        viewerCanAssign: true,
        assignBlockedReason: null,
      },
    ];
    wrap(
      _name === "InviteDialog" ? (
        <InviteDialog ownerRoleIds={new Set(["rol_x"])} onIssued={vi.fn()} onClose={vi.fn()} />
      ) : (
        <ChangeRoleDialog
          member={{ userId: "u", email: "u@shop.com", roleId: "rol_other", isOwner: false }}
          ownerRoleIds={new Set(["rol_x"])}
          onClose={vi.fn()}
        />
      ),
    );
    expect(screen.getByRole("radio", { name: /X/ })).toBeEnabled();
  });
});

describe("InviteDialog · R8 submit", () => {
  it("a custom role can be picked and is what is sent", async () => {
    renderers.InviteDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/อีเมล/), "new@shop.com");
    await user.click(screen.getByRole("radio", { name: /พนักงานแพ็คของ/ }));
    await user.click(screen.getByRole("button", { name: "สร้างลิงก์คำเชิญ" }));
    expect(createMutate).toHaveBeenCalledWith(
      { email: "new@shop.com", roleId: "rol_pack" },
      expect.anything(),
    );
  });

  it("a disabled role cannot be chosen", async () => {
    renderers.InviteDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /บัญชีภายนอก/ }));
    expect(screen.getByRole("radio", { name: /บัญชีภายนอก/ })).not.toBeChecked();
  });

  it("★ re-invite whose original role is blocked: nothing pre-selected + the helper names the role", () => {
    wrap(
      <InviteDialog
        ownerRoleIds={new Set()}
        defaultEmail="a@shop.com"
        blockedOriginalRoleName="บัญชีภายนอก"
        onIssued={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText('บทบาทเดิมของคำเชิญนี้ ("บัญชีภายนอก") คุณมอบให้ไม่ได้ เลือกบทบาทอื่น'),
    ).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
  });
});

describe("ChangeRoleDialog · R8 current role", () => {
  it("★ the current role stays selected + tagged even when the server says it cannot be assigned; save is disabled", () => {
    wrap(
      <ChangeRoleDialog
        member={{ userId: "usr_b", email: "b@shop.com", roleId: "rol_ext", isOwner: false }}
        ownerRoleIds={new Set()}
        onClose={vi.fn()}
      />,
    );
    const current = screen.getByRole("radio", { name: /บัญชีภายนอก/ });
    expect(current).toBeChecked();
    expect(current.closest("label")).toHaveTextContent("(บทบาทปัจจุบัน)");
    expect(
      screen.getByText("บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงมอบให้คนอื่นไม่ได้"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "บันทึกบทบาท" })).toBeDisabled();
  });

  it("choosing an enabled custom role sends that roleId", async () => {
    renderers.ChangeRoleDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /พนักงานแพ็คของ/ }));
    await user.click(screen.getByRole("button", { name: "บันทึกบทบาท" }));
    expect(changeMutate).toHaveBeenCalledWith(
      { userId: "usr_b", roleId: "rol_pack" },
      expect.anything(),
    );
  });
});
