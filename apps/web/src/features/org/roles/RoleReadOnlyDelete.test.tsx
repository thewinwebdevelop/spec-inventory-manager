// T-003-W08 (R4 — read-only) + T-003-W09 (R5 — delete) · CW3-03 / CW3-06.
//
// Same harness as RoleFormScreen.test.tsx: the reads and writes are mocked at
// the hook seam, and the org context's local capabilities are chosen to
// DISAGREE with the server's verdict wherever one is pinned (repo lesson
// "client-invented server facts") — the screen must follow `viewer.*`.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/o/org_1/settings/roles/x",
}));

import type { CapabilityCatalog, RoleDetail, RoleDetailListPage } from "./api/use-role-details";

type Q<T> = {
  data?: T;
  isError: boolean;
  error?: unknown;
  refetch: ReturnType<typeof vi.fn>;
};
let listQ: Q<RoleDetailListPage>;
let catalogQ: Q<CapabilityCatalog>;
let roleQ: Q<RoleDetail>;
vi.mock("./api/use-role-details", () => ({
  useRoleDetails: () => listQ,
  useCapabilityCatalog: () => catalogQ,
  useRoleDetail: () => roleQ,
}));

const updateMutate = vi.fn();
const deleteMutate = vi.fn();
vi.mock("./api/use-role-mutations", () => ({
  useCreateRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRole: () => ({ mutateAsync: updateMutate, isPending: false }),
  useDeleteRole: () => ({ mutateAsync: deleteMutate, isPending: false }),
}));

import { RoleFormScreen } from "./RoleFormScreen";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import { ApiRequestError } from "../../../lib/api/error";
import { orgKey } from "../../../lib/org/org-keys";

const ok = { allowed: true, reason: null };
const no = (reason: string) => ({ allowed: false, reason });

function role(over: Partial<RoleDetail> & { id: string; name: string }): RoleDetail {
  return {
    key: null,
    nameCustomized: true,
    isSystem: false,
    grantsOwnership: false,
    capabilities: ["manage_stock"],
    version: 3,
    usage: { activeMembers: 0, pendingInvitations: 0 },
    lastEdited: null,
    viewer: { canEdit: ok, canDelete: ok, canClone: ok },
    createdAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

const OWNER = role({
  id: "r_own",
  name: "Owner",
  key: "owner",
  nameCustomized: false,
  isSystem: true,
  grantsOwnership: true,
  capabilities: ["full_access"],
  usage: { activeMembers: 1, pendingInvitations: 0 },
  viewer: { canEdit: no("role_locked"), canDelete: no("role_locked"), canClone: no("owner_role") },
});
const ADMIN = role({
  id: "r_adm",
  name: "Admin",
  key: "admin",
  nameCustomized: false,
  capabilities: ["manage_members", "manage_products"],
  usage: { activeMembers: 2, pendingInvitations: 1 },
  lastEdited: { at: "2026-06-23T07:30:00.000Z", by: { kind: "me" } },
});
const STAFF = role({
  id: "r_stf",
  name: "Staff",
  key: "staff",
  nameCustomized: false,
  capabilities: ["manage_stock"],
});
const BILL = role({
  id: "r_bill",
  name: "บัญชีภายนอก",
  capabilities: ["manage_billing"],
  viewer: {
    canEdit: no("exceeds_your_permissions"),
    canDelete: no("exceeds_your_permissions"),
    canClone: no("exceeds_your_permissions"),
  },
});

const entry = (
  key: string,
  labelTh: string,
  group: string | null,
  over: Partial<CapabilityCatalog["items"][number]> = {},
) => ({
  key,
  labelTh,
  descriptionTh: `คำอธิบาย ${labelTh}`,
  group,
  status: "live",
  implies: [] as string[],
  selectable: true,
  ...over,
});
const CATALOG: CapabilityCatalog = {
  groups: [
    { key: "team", labelTh: "ทีมงาน" },
    { key: "shop", labelTh: "ร้าน" },
    { key: "catalog_stock", labelTh: "สินค้าและสต๊อก" },
  ],
  items: [
    entry("full_access", "ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)", null, {
      selectable: false,
      descriptionTh: "ทำได้ทุกอย่างในร้านนี้ รวมถึงสิทธิ์ที่จะเพิ่มในอนาคต",
    }),
    entry("manage_members", "จัดการสมาชิกและคำเชิญ", "team"),
    entry("manage_roles", "จัดการบทบาทและสิทธิ์", "team"),
    entry("manage_billing", "จัดการแพ็กเกจและการชำระเงิน", "shop", { status: "upcoming" }),
    entry("manage_products", "จัดการสินค้า", "catalog_stock", {
      status: "upcoming",
      implies: ["view_products"],
    }),
    entry("view_products", "ดูสินค้า", "catalog_stock", { status: "upcoming" }),
    entry("manage_stock", "จัดการสต๊อก", "catalog_stock"),
  ],
};

let queryClient: QueryClient;
function renderRole(r: RoleDetail, capabilities: string[] = ["full_access"], myRoleId = "r_own") {
  roleQ = loaded(r);
  const org: ActiveOrg = {
    orgId: "org_1",
    name: "ร้าน",
    capabilities: new Set(capabilities),
    roleKey: null,
    roleName: "x",
    profile: { myMembership: { roleId: myRoleId } } as unknown as ActiveOrg["profile"],
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <ActiveOrgProvider value={org}>
        <ToastProvider>
          <RoleFormScreen mode="edit" roleId={r.id} />
        </ToastProvider>
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
}

function loaded<T>(data: T): Q<T> {
  return { data, isError: false, refetch: vi.fn(async () => ({ data })) };
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  push.mockClear();
  updateMutate.mockReset();
  deleteMutate.mockReset();
  listQ = loaded({
    items: [OWNER, ADMIN, STAFF, BILL],
    nextCursor: null,
    viewer: { canCreate: ok, limit: 30 },
  });
  catalogQ = loaded(CATALOG);
});

/** The banner that carries `title` (every reason banner is `role="status"`). */
const bannerWith = (title: string) => {
  const hit = screen.getAllByRole("status").find((el) => el.textContent?.includes(title));
  if (!hit) throw new Error(`no status banner with "${title}"`);
  return hit;
};
const readItem = (label: string) =>
  screen.getAllByRole("listitem").find((li) => li.textContent?.includes(label))!;
const deleteButton = () => screen.getByRole("button", { name: "ลบบทบาทนี้" });
const err = (status: number, code: string, details?: Record<string, unknown>, retry?: number) =>
  new ApiRequestError(status, { error: { code, message: "server words", details } }, retry);

// ── R4 ─────────────────────────────────────────────────────────────────────

describe("R4 · Owner (role_locked)", () => {
  it("heading + Badge 'ล็อก' + usage/last-edited lines + the locked banner", () => {
    renderRole(OWNER);
    const h1 = screen.getByRole("heading", { level: 1, name: /เจ้าของร้าน/ });
    expect(within(h1).getByText("ล็อก")).toBeInTheDocument();
    expect(screen.getByText("สมาชิก 1 คน (รวมคุณ)")).toBeInTheDocument();
    expect(screen.getByText("ค่าเริ่มต้นของระบบ")).toBeInTheDocument();
    const b = bannerWith("บทบาทเจ้าของร้านถูกล็อกไว้");
    expect(b).toHaveTextContent(
      "แก้ชื่อ แก้สิทธิ์ หรือลบไม่ได้ เพื่อให้ร้านมีคนที่ทำได้ทุกอย่างอยู่เสมอ",
    );
    expect(b.querySelector("[data-icon='lock']")).not.toBeNull();
  });

  it("ONE full_access card from the catalog (label + description) — not a checklist", () => {
    renderRole(OWNER);
    expect(screen.getByText("ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)")).toBeInTheDocument();
    expect(
      screen.getByText("ทำได้ทุกอย่างในร้านนี้ รวมถึงสิทธิ์ที่จะเพิ่มในอนาคต"),
    ).toBeInTheDocument();
    expect(screen.queryByText("จัดการสต๊อก")).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("no clone, no delete, no 'การจัดการอื่น', no name row, no save", () => {
    renderRole(OWNER);
    expect(screen.queryByText("ทำสำเนาเป็นบทบาทใหม่")).toBeNull();
    expect(screen.queryByRole("button", { name: "ลบบทบาทนี้" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "การจัดการอื่น" })).toBeNull();
    expect(screen.queryByText("ชื่อบทบาท")).toBeNull();
    expect(screen.queryByRole("button", { name: "บันทึก" })).toBeNull();
  });

  it("the Owner card follows grantsOwnership, not the key: a renamed Owner (nameCustomized) still gets it", () => {
    renderRole({ ...OWNER, name: "หัวหน้าร้าน", nameCustomized: true });
    expect(screen.getByRole("heading", { level: 1, name: /หัวหน้าร้าน/ })).toBeInTheDocument();
    expect(screen.getByText("ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)")).toBeInTheDocument();
  });
});

describe("R4 · CapabilityReadList (ux R4 · §A — a list, not disabled checkboxes)", () => {
  it("grouped rows: ✓ for granted, '–' + the TEXT 'ไม่ได้ให้' otherwise; 'เร็ว ๆ นี้' kept", () => {
    renderRole(BILL, ["manage_members"]);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 3, name: "ทีมงาน" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "ร้าน" })).toBeInTheDocument();
    const granted = readItem("จัดการแพ็กเกจและการชำระเงิน");
    expect(granted).toHaveTextContent("เร็ว ๆ นี้");
    expect(granted).toHaveTextContent("ให้");
    expect(granted).not.toHaveTextContent("ไม่ได้ให้");
    expect(granted.querySelector("[data-icon='check']")).not.toBeNull();
    const notGranted = readItem("จัดการสมาชิกและคำเชิญ");
    expect(notGranted).toHaveTextContent("ไม่ได้ให้");
    expect(notGranted.querySelector("[data-icon='check']")).toBeNull();
  });

  it("an implied capability reads ✓ + 'มาพร้อมสิทธิ์จัดการ'", () => {
    renderRole({ ...BILL, capabilities: ["manage_products"] });
    const implied = readItem("ดูสินค้า");
    expect(implied).toHaveTextContent("มาพร้อมสิทธิ์จัดการ");
    expect(implied).not.toHaveTextContent("ไม่ได้ให้");
  });

  it("keys the catalog does not know → one line, never the raw key", () => {
    renderRole({ ...BILL, capabilities: ["manage_billing", "retired_key", "another_one"] });
    expect(screen.getByText("และสิทธิ์อื่นอีก 2 รายการที่แสดงในหน้านี้ไม่ได้")).toBeInTheDocument();
    expect(screen.queryByText(/retired_key/)).toBeNull();
  });

  it("the name is TEXT under 'ชื่อบทบาท' — no field", () => {
    renderRole(BILL);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("ชื่อบทบาท")).toBeInTheDocument();
  });

  it("catalog failed → danger banner + retry instead of the list (the role is still shown)", async () => {
    catalogQ = { isError: true, error: new Error("x"), refetch: vi.fn(async () => ({})) };
    renderRole(BILL);
    expect(screen.getByRole("heading", { level: 1, name: "บัญชีภายนอก" })).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("โหลดรายการสิทธิ์ไม่สำเร็จ");
    await userEvent.setup().click(within(alert).getByRole("button", { name: "ลองใหม่" }));
    expect(catalogQ.refetch).toHaveBeenCalled();
  });
});

describe("R4 · RoleReasonBanner — one banner per reason (§0.3 ก)", () => {
  it("exceeds_your_permissions: its copy, no clone (hidden), no delete", () => {
    renderRole(BILL);
    const b = bannerWith("ดูได้อย่างเดียว — บทบาทนี้มีสิทธิ์ที่คุณไม่มี");
    expect(b).toHaveTextContent("คุณแก้ ลบ หรือทำสำเนาบทบาทที่มีสิทธิ์เกินของตัวเองไม่ได้");
    expect(screen.queryByText("ทำสำเนาเป็นบทบาทใหม่")).toBeNull();
    expect(screen.queryByRole("button", { name: "ลบบทบาทนี้" })).toBeNull();
  });

  it("equal_permissions_in_use + canClone: the clone link sits INSIDE the banner", () => {
    renderRole({
      ...ADMIN,
      viewer: {
        canEdit: no("equal_permissions_in_use"),
        canDelete: no("equal_permissions_in_use"),
        canClone: ok,
      },
    });
    const b = bannerWith("ดูได้อย่างเดียว — มีคนที่สิทธิ์เท่าคุณใช้บทบาทนี้อยู่");
    expect(within(b).getByRole("link", { name: "ทำสำเนาเป็นบทบาทใหม่" })).toHaveAttribute(
      "href",
      "/o/org_1/settings/roles/new?from=r_adm",
    );
    expect(b.querySelector("[data-icon='lock']")).not.toBeNull();
    // Same reason on delete → hidden (the banner already says it).
    expect(screen.queryByRole("button", { name: "ลบบทบาทนี้" })).toBeNull();
  });

  it("in_use_requires_manage_members + canClone role_limit_reached → disabled clone + the limit sentence, in the banner", () => {
    renderRole({
      ...ADMIN,
      viewer: {
        canEdit: no("in_use_requires_manage_members"),
        canDelete: no("in_use_requires_manage_members"),
        canClone: no("role_limit_reached"),
      },
    });
    const b = bannerWith("ดูได้อย่างเดียว — มีสมาชิกคนอื่นใช้บทบาทนี้อยู่");
    expect(within(b).getByRole("button", { name: "ทำสำเนาเป็นบทบาทใหม่" })).toBeDisabled();
    expect(b).toHaveTextContent(
      "ร้านนี้มีบทบาทครบจำนวนสูงสุดแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้",
    );
  });

  it("writes_disabled: ONE banner, ABOVE the heading, icon.info; clone + delete disabled in 'การจัดการอื่น'", () => {
    renderRole({
      ...STAFF,
      viewer: {
        canEdit: no("writes_disabled"),
        canDelete: no("writes_disabled"),
        canClone: no("writes_disabled"),
      },
    });
    const title = "ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้";
    expect(screen.getAllByText(title)).toHaveLength(1);
    const b = bannerWith(title);
    expect(b.querySelector("[data-icon='info']")).not.toBeNull();
    const h1 = screen.getByRole("heading", { level: 1, name: "พนักงาน" });
    expect(b.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const section = screen.getByRole("heading", { name: "การจัดการอื่น" }).closest("section")!;
    expect(within(section).getByRole("button", { name: "ทำสำเนาเป็นบทบาทใหม่" })).toBeDisabled();
    expect(within(section).getByRole("button", { name: "ลบบทบาทนี้" })).toBeDisabled();
    // Still readable (ux: "ดูรายละเอียดได้ตามปกติ").
    expect(readItem("จัดการสต๊อก")).not.toHaveTextContent("ไม่ได้ให้");
  });

  it("a reason this build has never heard of → 'ดูได้อย่างเดียว' + the generic body; clone/delete follow their own verdicts", () => {
    renderRole({
      ...STAFF,
      viewer: { canEdit: no("brand_new_reason"), canDelete: ok, canClone: ok },
    });
    const b = bannerWith("ดูได้อย่างเดียว");
    expect(b).toHaveTextContent(
      "ตอนนี้คุณทำรายการนี้กับบทบาทนี้ไม่ได้ ถ้าคิดว่าไม่ถูกต้อง ติดต่อเจ้าของร้าน",
    );
    expect(screen.queryByText(/brand_new_reason/)).toBeNull();
    expect(within(b).getByRole("link", { name: "ทำสำเนาเป็นบทบาทใหม่" })).toBeInTheDocument();
    expect(deleteButton()).toBeEnabled();
  });

  it("verdict wins over local capabilities: an Owner locally + canEdit=false → R4, not the form", () => {
    renderRole(BILL, ["full_access"]);
    expect(screen.queryByRole("textbox", { name: "ชื่อบทบาท" })).toBeNull();
    expect(bannerWith("ดูได้อย่างเดียว — บทบาทนี้มีสิทธิ์ที่คุณไม่มี")).toBeInTheDocument();
  });
});

// ── R5 ─────────────────────────────────────────────────────────────────────

const dialog = () => screen.getByRole("alertdialog");

describe("R5 (ก) · confirm delete", () => {
  it("'ลบบทบาทนี้' is a secondary button in 'การจัดการอื่น' on R3 when canDelete allows", () => {
    renderRole(STAFF);
    const section = screen.getByRole("heading", { name: "การจัดการอื่น" }).closest("section")!;
    expect(within(section).getByRole("button", { name: "ลบบทบาทนี้" })).toBeEnabled();
    // R3 is still the form.
    expect(screen.getByRole("textbox", { name: "ชื่อบทบาท" })).toBeInTheDocument();
  });

  it("opens the dialog: title with the DISPLAY name, AC-3.9b body, focus on 'ไม่ลบ' — nothing sent", async () => {
    renderRole(STAFF);
    await userEvent.setup().click(deleteButton());
    const d = dialog();
    expect(within(d).getByRole("heading", { name: 'ลบบทบาท "พนักงาน"?' })).toBeInTheDocument();
    expect(d).toHaveTextContent(
      "ลบแล้วเอาคืนไม่ได้ ถ้าต้องใช้อีกต้องสร้างใหม่ ประวัติเดิม (สมาชิกที่ถูกถอด คำเชิญเก่า) ยังแสดงชื่อบทบาทนี้ได้ตามเดิม",
    );
    expect(within(d).getByRole("button", { name: "ไม่ลบ" })).toHaveFocus();
    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it("'ไม่ลบ' and Escape close without a request", async () => {
    renderRole(STAFF);
    const user = userEvent.setup();
    await user.click(deleteButton());
    await user.click(within(dialog()).getByRole("button", { name: "ไม่ลบ" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.click(deleteButton());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it("'ลบบทบาท' → ONE DELETE even on a double press; 'กำลังลบ...' while in flight; then toast + R1", async () => {
    let resolve!: (v: unknown) => void;
    deleteMutate.mockReturnValue(new Promise((r) => (resolve = r)));
    renderRole(STAFF);
    const user = userEvent.setup();
    await user.click(deleteButton());
    const confirm = within(dialog()).getByRole("button", { name: "ลบบทบาท" });
    await user.dblClick(confirm);
    expect(deleteMutate).toHaveBeenCalledTimes(1);
    expect(within(dialog()).getByRole("button", { name: "กำลังลบ..." })).toBeDisabled();
    // In flight: cannot be dismissed.
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await act(async () => resolve({ id: "r_stf", deletedAt: "2026-11-22T00:00:00.000Z" }));
    expect(await screen.findByText('ลบบทบาท "พนักงาน" แล้ว')).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/o/org_1/settings/roles");
  });
});

describe("R5 (ข) · still in use", () => {
  const inUse = (usage: RoleDetail["usage"]) =>
    role({
      id: "r_pack",
      name: "แพ็คของ",
      usage,
      viewer: { canEdit: ok, canDelete: no("in_use"), canClone: ok },
    });

  it("canDelete=in_use → disabled button + the panel UNDER it with counts and links to R6", () => {
    renderRole(inUse({ activeMembers: 2, pendingInvitations: 1 }));
    expect(deleteButton()).toBeDisabled();
    const panel = screen.getByRole("group", { name: "ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่" });
    expect(within(panel).getByText("ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่")).toBeInTheDocument();
    expect(within(panel).getByText("สมาชิก 2 คน · คำเชิญที่ยังไม่ปิด 1 ใบ")).toBeInTheDocument();
    // Under the button, in document order.
    expect(
      deleteButton().compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText("ย้ายสมาชิกไปบทบาทอื่นและยกเลิกคำเชิญเหล่านี้ก่อน แล้วค่อยลบ"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ดูสมาชิกที่ใช้บทบาทนี้ (2)" })).toHaveAttribute(
      "href",
      "/o/org_1/settings/members?roleId=r_pack",
    );
    expect(screen.getByRole("link", { name: "ดูคำเชิญที่ใช้บทบาทนี้ (1)" })).toHaveAttribute(
      "href",
      "/o/org_1/settings/members?roleId=r_pack#role-invitations",
    );
  });

  it("a part that is 0 has no link and no count", () => {
    renderRole(inUse({ activeMembers: 0, pendingInvitations: 1 }));
    expect(screen.getByText("คำเชิญที่ยังไม่ปิด 1 ใบ")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ดูสมาชิกที่ใช้บทบาทนี้/ })).toBeNull();
    expect(screen.getByRole("link", { name: "ดูคำเชิญที่ใช้บทบาทนี้ (1)" })).toBeInTheDocument();
  });

  it("viewer without manage_members → no links (they would hit ForbiddenPanel), the 'คนที่จัดการสมาชิกได้…' line instead", () => {
    renderRole(inUse({ activeMembers: 2, pendingInvitations: 1 }), [
      "manage_roles",
      "manage_stock",
    ]);
    expect(screen.queryByRole("link", { name: /ดูสมาชิก|ดูคำเชิญ/ })).toBeNull();
    expect(
      screen.getByText(
        "คนที่จัดการสมาชิกได้ (เช่น เจ้าของร้าน) ต้องเป็นคนย้ายสมาชิกหรือยกเลิกคำเชิญ",
      ),
    ).toBeInTheDocument();
  });

  it("the only holder is me → 'คนที่ใช้บทบาทนี้คือคุณเอง…' instead of the move-them line", () => {
    renderRole(inUse({ activeMembers: 1, pendingInvitations: 0 }), ["manage_roles"], "r_pack");
    const panel = screen.getByRole("group", { name: "ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่" });
    expect(within(panel).getByText("สมาชิก 1 คน (รวมคุณ)")).toBeInTheDocument();
    expect(
      screen.getByText("คนที่ใช้บทบาทนี้คือคุณเอง — ให้เจ้าของร้านย้ายคุณไปบทบาทอื่นก่อน"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ย้ายสมาชิกไปบทบาทอื่นและยกเลิกคำเชิญ/)).toBeNull();
  });

  it("canDelete=history_limit_reached → disabled + 'ลบเพิ่มไม่ได้'", () => {
    renderRole({
      ...STAFF,
      viewer: { canEdit: ok, canDelete: no("history_limit_reached"), canClone: ok },
    });
    expect(deleteButton()).toBeDisabled();
    expect(screen.getByText("ลบเพิ่มไม่ได้")).toBeInTheDocument();
    expect(
      screen.getByText(
        "ร้านนี้ลบบทบาทไปครบจำนวนที่ระบบเก็บประวัติได้แล้ว กรุณาติดต่อทีมงาน OmniStock",
      ),
    ).toBeInTheDocument();
  });
});

describe("R5 · refusals at confirm (§E)", () => {
  async function confirmDelete(r: RoleDetail = STAFF, caps?: string[]) {
    renderRole(r, caps);
    const user = userEvent.setup();
    await user.click(deleteButton());
    await user.click(within(dialog()).getByRole("button", { name: "ลบบทบาท" }));
    return user;
  }

  it("409 ROLE_IN_USE → the dialog turns into (ข) with the numbers from details; the role is re-read", async () => {
    deleteMutate.mockRejectedValueOnce(
      err(409, "ROLE_IN_USE", { activeMembers: 3, pendingInvitations: 0 }),
    );
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const user = await confirmDelete();
    const d = await screen.findByRole("alertdialog", {
      name: "ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่",
    });
    expect(d).toHaveTextContent("สมาชิก 3 คน");
    expect(within(d).getByRole("link", { name: "ดูสมาชิกที่ใช้บทบาทนี้ (3)" })).toHaveAttribute(
      "href",
      "/o/org_1/settings/members?roleId=r_stf",
    );
    expect(within(d).queryByRole("link", { name: /ดูคำเชิญ/ })).toBeNull();
    expect(within(d).queryByRole("button", { name: "ลบบทบาท" })).toBeNull();
    expect(roleQ.refetch).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: orgKey("org_1", "role-details") });
    await user.click(within(d).getByRole("button", { name: "ปิด" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(deleteMutate).toHaveBeenCalledTimes(1);
  });

  it("409 ROLE_HISTORY_LIMIT_REACHED → the sentence IN the dialog with details.limit; confirm disabled", async () => {
    deleteMutate.mockRejectedValueOnce(err(409, "ROLE_HISTORY_LIMIT_REACHED", { limit: 500 }));
    await confirmDelete();
    const d = dialog();
    expect(await within(d).findByRole("alert")).toHaveTextContent(
      "ลบเพิ่มไม่ได้ — ร้านนี้ลบบทบาทไปครบ 500 ครั้งที่ระบบเก็บประวัติได้แล้ว กรุณาติดต่อทีมงาน OmniStock",
    );
    expect(within(d).getByRole("button", { name: "ลบบทบาท" })).toBeDisabled();
    expect(within(d).getByRole("button", { name: "ไม่ลบ" })).toBeEnabled();
  });

  it("404 → toast 'บทบาทนี้ถูกลบไปแล้ว' + R1", async () => {
    deleteMutate.mockRejectedValueOnce(err(404, "NOT_FOUND"));
    await confirmDelete();
    expect(await screen.findByText("บทบาทนี้ถูกลบไปแล้ว")).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/o/org_1/settings/roles");
  });

  it("403 TARGET_NOT_BELOW_ACTOR → dialog closes, the reason as an alert on the page, the role is re-read (stay)", async () => {
    deleteMutate.mockRejectedValueOnce(err(403, "TARGET_NOT_BELOW_ACTOR"));
    await confirmDelete();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "บทบาทนี้มีสิทธิ์เท่ากับของคุณ และมีสมาชิกคนอื่นใช้อยู่",
    );
    expect(roleQ.refetch).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("403 FORBIDDEN → the roles forbidden panel", async () => {
    deleteMutate.mockRejectedValueOnce(err(403, "FORBIDDEN"));
    await confirmDelete();
    expect(await screen.findByText("หน้านี้สำหรับคนที่จัดการบทบาทได้")).toBeInTheDocument();
  });

  it("429 → 'แก้บทบาทถี่เกินไป…' and the delete button waits", async () => {
    deleteMutate.mockRejectedValueOnce(err(429, "RATE_LIMITED", undefined, 75));
    await confirmDelete();
    expect(await screen.findByText(/แก้บทบาทถี่เกินไป กรุณารอ 01:15/)).toBeInTheDocument();
    expect(deleteButton()).toBeDisabled();
  });

  it("an unknown code → 'ลบบทบาทไม่สำเร็จ…' (the delete wording), never the server's message", async () => {
    deleteMutate.mockRejectedValueOnce(err(500, "WHO_KNOWS"));
    await confirmDelete();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ลบบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    );
    expect(screen.queryByText("server words")).toBeNull();
  });
});
