// T-003-W06 · CW3-03 / CW3-04 / CW3-05 / CW3-06 (R3 half) — the role form in
// its three modes (create / clone / edit).
//
// The org context's capability set is chosen to DISAGREE with the server's
// verdict wherever a verdict is pinned (repo lesson "client-invented server
// facts"): e.g. the viewer lacks `manage_roles` locally while `canEdit` says
// yes — the form must still be editable, and only the per-row "คุณไม่มีสิทธิ์นี้"
// hint (a UX guard, the server still decides) may read local capabilities.
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
  refetch: () => Promise<{ data?: T; isError?: boolean; error?: unknown }>;
};
let listQ: Q<RoleDetailListPage>;
let catalogQ: Q<CapabilityCatalog>;
let roleQ: Q<RoleDetail>;
const roleRefetch = vi.fn();
vi.mock("./api/use-role-details", () => ({
  useRoleDetails: () => listQ,
  useCapabilityCatalog: () => catalogQ,
  useRoleDetail: () => roleQ,
}));

const createMutate = vi.fn();
const updateMutate = vi.fn();
vi.mock("./api/use-role-mutations", () => ({
  useCreateRole: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateRole: () => ({ mutateAsync: updateMutate, isPending: false }),
  useDeleteRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { RoleFormScreen } from "./RoleFormScreen";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import { ApiRequestError } from "../../../lib/api/error";
import { orgKey } from "../../../lib/org/org-keys";
import { ROLE_FORBIDDEN_PANEL_COPY } from "../role-copy";

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
    { key: "catalog_stock", labelTh: "สินค้าและสต๊อก" },
  ],
  items: [
    entry("full_access", "ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)", null, { selectable: false }),
    entry("manage_members", "จัดการสมาชิกและคำเชิญ", "team"),
    entry("manage_roles", "จัดการบทบาทและสิทธิ์", "team"),
    entry("manage_products", "จัดการสินค้า", "catalog_stock", {
      status: "upcoming",
      implies: ["view_products"],
    }),
    entry("view_products", "ดูสินค้า", "catalog_stock", { status: "upcoming" }),
    entry("manage_stock", "จัดการสต๊อก", "catalog_stock"),
  ],
};

function listPage(over: Partial<RoleDetailListPage> = {}): RoleDetailListPage {
  return {
    items: [OWNER, ADMIN, STAFF, BILL],
    nextCursor: null,
    viewer: { canCreate: ok, limit: 30 },
    ...over,
  };
}

let queryClient: QueryClient;
function renderForm(
  props: Parameters<typeof RoleFormScreen>[0],
  capabilities: string[] = ["full_access"],
  myRoleId = "r_own",
) {
  const tree = (caps: string[]) => {
    const org: ActiveOrg = {
      orgId: "org_1",
      name: "ร้าน",
      capabilities: new Set(caps),
      roleKey: null,
      roleName: "x",
      profile: { myMembership: { roleId: myRoleId } } as unknown as ActiveOrg["profile"],
    };
    return (
      <QueryClientProvider client={queryClient}>
        <ActiveOrgProvider value={org}>
          <ToastProvider>
            <RoleFormScreen {...props} />
          </ToastProvider>
        </ActiveOrgProvider>
      </QueryClientProvider>
    );
  };
  const result = render(tree(capabilities));
  /** The caller's capabilities changed (e.g. the profile was re-read) — same mounted screen. */
  const setViewerCaps = (caps: string[]) => result.rerender(tree(caps));
  return { ...result, setViewerCaps };
}

const loaded = <T,>(data: T): Q<T> => ({
  data,
  isError: false,
  refetch: vi.fn(async () => ({ data })),
});

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  push.mockClear();
  createMutate.mockReset();
  updateMutate.mockReset();
  roleRefetch.mockReset();
  listQ = loaded(listPage());
  catalogQ = loaded(CATALOG);
  roleQ = loaded(ADMIN);
});

const nameBox = () => screen.getByRole("textbox", { name: "ชื่อบทบาท" });
const row = (label: string) => screen.getByRole("checkbox", { name: new RegExp(`^${label}`) });
const confirmDialog = () => screen.getByRole("alertdialog", { name: /^บันทึกการเปลี่ยนสิทธิ์ของ/ });
/** R3a (W07): a capability change asks first — press the dialog's own save button. */
async function confirmSave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(confirmDialog()).getByRole("button", { name: /^บันทึก/ }));
}

describe("R3 · create from blank", () => {
  it("title, placeholder, create helper, nothing ticked, counter 0 of the shown rows", () => {
    renderForm({ mode: "create" });
    expect(screen.getByRole("heading", { level: 1, name: "สร้างบทบาทใหม่" })).toBeInTheDocument();
    expect(nameBox()).toHaveAttribute("placeholder", "เช่น พนักงานแพ็คของ");
    expect(nameBox()).toHaveValue("");
    expect(
      screen.getByText("ตั้งตามหน้าที่ในร้าน เช่น พนักงานแพ็คของ แอดมินตอบแชท"),
    ).toBeInTheDocument();
    expect(screen.getByText("เลือกแล้ว 0 จาก 5")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /ทำได้ทุกอย่าง/ })).toBeNull();
    expect(screen.getByRole("button", { name: "สร้างบทบาท" })).toBeEnabled();
  });

  it("'เร็ว ๆ นี้' badge + the one-time explanation under the heading", () => {
    renderForm({ mode: "create" });
    expect(
      screen.getByText(
        'สิทธิ์ที่มีป้าย "เร็ว ๆ นี้" คือฟีเจอร์ที่ยังไม่เปิด ติ๊กไว้ก่อนได้ จะมีผลทันทีเมื่อฟีเจอร์เปิด',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("เร็ว ๆ นี้").length).toBe(2);
  });

  it("POSTs the trimmed name + ticked keys once, toasts, and goes back to R1", async () => {
    createMutate.mockResolvedValue(
      role({ id: "r_new", name: "แพ็คของ", capabilities: ["manage_stock"] }),
    );
    renderForm({ mode: "create" });
    const user = userEvent.setup();
    await user.type(nameBox(), "  แพ็คของ ");
    // code points after trim — Thai marks count (แ พ ็ ค ข อ ง = 7)
    expect(screen.getByText(`${[..."แพ็คของ"].length}/50`)).toBeInTheDocument();
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "สร้างบทบาท" }));
    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate).toHaveBeenCalledWith({ name: "แพ็คของ", capabilities: ["manage_stock"] });
    expect(await screen.findByText('สร้างบทบาท "แพ็คของ" แล้ว')).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/o/org_1/settings/roles");
  });

  it("ticking manage_X sends manage_X only (the implied view_X is locked, not sent)", async () => {
    createMutate.mockResolvedValue(role({ id: "r_new", name: "a" }));
    renderForm({ mode: "create" });
    const user = userEvent.setup();
    await user.type(nameBox(), "a");
    await user.click(row("จัดการสินค้า"));
    expect(row("ดูสินค้า")).toBeChecked();
    expect(row("ดูสินค้า")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("มาพร้อมสิทธิ์จัดการ")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "สร้างบทบาท" }));
    expect(createMutate).toHaveBeenCalledWith({ name: "a", capabilities: ["manage_products"] });
  });

  it("client checks before sending: empty name, > 50, no capability — and nothing is sent", async () => {
    renderForm({ mode: "create" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "สร้างบทบาท" }));
    expect(screen.getByText("กรอกชื่อบทบาท")).toBeInTheDocument();
    expect(screen.getByText("เลือกสิทธิ์อย่างน้อย 1 อย่าง")).toBeInTheDocument();
    await user.type(nameBox(), "ก".repeat(51));
    await user.click(screen.getByRole("button", { name: "สร้างบทบาท" }));
    expect(screen.getByText("ชื่อบทบาทยาวได้ไม่เกิน 50 ตัวอักษร")).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("writes_disabled: one banner on top, the create button disabled", () => {
    listQ = loaded(listPage({ viewer: { canCreate: no("writes_disabled"), limit: 30 } }));
    renderForm({ mode: "create" });
    expect(screen.getByText("ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "สร้างบทบาท" })).toBeDisabled();
  });

  it("role_limit_reached: create disabled with the limit sentence", () => {
    listQ = loaded(listPage({ viewer: { canCreate: no("role_limit_reached"), limit: 30 } }));
    renderForm({ mode: "create" });
    expect(screen.getByRole("button", { name: "สร้างบทบาท" })).toBeDisabled();
    expect(screen.getByText(/ร้านนี้มีบทบาทครบ 30 บทบาทแล้ว/)).toBeInTheDocument();
  });

  it("'คุณไม่มีสิทธิ์นี้' — a capability the viewer lacks is disabled with the reason; a click does nothing", async () => {
    renderForm({ mode: "create" }, ["manage_roles", "manage_stock"]);
    const members = row("จัดการสมาชิกและคำเชิญ");
    expect(members).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("คุณไม่มีสิทธิ์นี้ จึงให้บทบาทอื่นไม่ได้").length).toBeGreaterThan(
      0,
    );
    await userEvent.setup().click(members);
    expect(members).not.toBeChecked();
    expect(row("จัดการสต๊อก")).not.toHaveAttribute("aria-disabled");
  });
});

describe("R3 · clone (?from=)", () => {
  it("prefills 'สำเนาของ {ชื่อ}' + the source's capabilities + the source line", () => {
    renderForm({ mode: "create", fromRoleId: "r_stf" });
    expect(screen.getByText('เริ่มจากสำเนาของ "พนักงาน"')).toBeInTheDocument();
    expect(nameBox()).toHaveValue("สำเนาของ พนักงาน");
    expect(row("จัดการสต๊อก")).toBeChecked();
    expect(screen.getByText("เลือกแล้ว 1 จาก 5")).toBeInTheDocument();
  });

  it.each([
    ["a role that is not in the list", "r_gone"],
    ["a role the server says may not be cloned", "r_bill"],
  ])("%s → blank form + the 'เริ่มจากว่างแทน' banner", (_label, from) => {
    renderForm({ mode: "create", fromRoleId: from });
    expect(screen.getByText("ใช้บทบาทนี้เป็นต้นแบบไม่ได้แล้ว เริ่มจากว่างแทน")).toBeInTheDocument();
    expect(nameBox()).toHaveValue("");
  });
});

describe("R3 · edit", () => {
  it("heading = display name, usage + last-edited line, edit helper, save disabled until something changes", () => {
    renderForm({ mode: "edit", roleId: "r_adm" });
    expect(screen.getByRole("heading", { level: 1, name: "ผู้ดูแล" })).toBeInTheDocument();
    expect(screen.getByText("สมาชิก 2 คน · คำเชิญที่ยังไม่ปิด 1 ใบ")).toBeInTheDocument();
    expect(screen.getByText(/^แก้ไขล่าสุดโดยคุณ · /)).toBeInTheDocument();
    expect(
      screen.getByText("เปลี่ยนชื่อได้ ชื่อใหม่จะแสดงแทนชื่อเดิมทุกหน้าจอ"),
    ).toBeInTheDocument();
    expect(nameBox()).toHaveValue("ผู้ดูแล");
    expect(screen.getByRole("button", { name: "บันทึก" })).toBeDisabled();
  });

  it("⚠️ a capability-only change does NOT send the translated name back", async () => {
    updateMutate.mockResolvedValue({ ...ADMIN, version: 4 });
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    await confirmSave(user);
    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate).toHaveBeenCalledWith({
      version: 3,
      capabilities: ["manage_members", "manage_products", "manage_stock"],
    });
  });

  it("a rename sends the name only, then toasts with the new name", async () => {
    updateMutate.mockResolvedValue({ ...ADMIN, name: "ผู้ช่วย", nameCustomized: true, version: 4 });
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.clear(nameBox());
    await user.type(nameBox(), "ผู้ช่วย");
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(updateMutate).toHaveBeenCalledWith({ version: 3, name: "ผู้ช่วย" });
    expect(await screen.findByText('บันทึกบทบาท "ผู้ช่วย" แล้ว')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("after a save, the caller's own capabilities are re-read (the PATCH viewer.* is pre-edit)", async () => {
    updateMutate.mockResolvedValue({ ...ADMIN, version: 4 });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    renderForm({ mode: "edit", roleId: "r_adm" }, ["full_access"], "r_adm");
    const user = userEvent.setup();
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    await confirmSave(user);
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: orgKey("org_1", "profile") }));
  });

  it("verdict wins over local capabilities: canEdit=true + viewer lacks manage_roles locally → still editable", () => {
    renderForm({ mode: "edit", roleId: "r_adm" }, ["manage_members", "manage_products"]);
    expect(nameBox()).toBeEnabled();
    expect(screen.getByRole("button", { name: "บันทึก" })).toBeInTheDocument();
  });

  it("verdict wins the other way: canEdit=false + an Owner locally → no form, no save button", () => {
    roleQ = loaded(BILL);
    renderForm({ mode: "edit", roleId: "r_bill" }, ["full_access"]);
    expect(screen.queryByRole("textbox", { name: "ชื่อบทบาท" })).toBeNull();
    expect(screen.queryByRole("button", { name: "บันทึก" })).toBeNull();
    expect(screen.getByText("ดูได้อย่างเดียว — บทบาทนี้มีสิทธิ์ที่คุณไม่มี")).toBeInTheDocument();
  });

  it("keys the catalog does not know: one line, and they are sent back on save (never dropped)", async () => {
    roleQ = loaded({ ...ADMIN, capabilities: ["manage_members", "retired_key"] });
    updateMutate.mockResolvedValue({ ...ADMIN, version: 4 });
    renderForm({ mode: "edit", roleId: "r_adm" });
    expect(screen.getByText("และสิทธิ์อื่นอีก 1 รายการที่แสดงในหน้านี้ไม่ได้")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    await confirmSave(user);
    expect(updateMutate).toHaveBeenCalledWith({
      version: 3,
      capabilities: ["manage_members", "manage_stock", "retired_key"],
    });
  });

  it("'ทำสำเนาเป็นบทบาทใหม่' follows canClone and links to create mode", () => {
    renderForm({ mode: "edit", roleId: "r_adm" });
    expect(screen.getByRole("link", { name: "ทำสำเนาเป็นบทบาทใหม่" })).toHaveAttribute(
      "href",
      "/o/org_1/settings/roles/new?from=r_adm",
    );
  });

  it("canClone role_limit_reached → disabled with the reason", () => {
    roleQ = loaded({
      ...ADMIN,
      viewer: { ...ADMIN.viewer, canClone: no("role_limit_reached") },
    });
    renderForm({ mode: "edit", roleId: "r_adm" });
    expect(screen.getByRole("button", { name: "ทำสำเนาเป็นบทบาทใหม่" })).toBeDisabled();
    expect(screen.getByText(/ร้านนี้มีบทบาทครบจำนวนสูงสุดแล้ว/)).toBeInTheDocument();
  });

  it("with unsaved edits, the clone button warns that the saved version is copied", async () => {
    renderForm({ mode: "edit", roleId: "r_adm" });
    await userEvent.setup().click(row("จัดการสต๊อก"));
    expect(
      screen.getByText("สำเนาจะใช้ฉบับที่บันทึกไว้ ไม่รวมที่ยังไม่ได้บันทึก"),
    ).toBeInTheDocument();
  });
});

describe("R3 · 409 ROLE_CHANGED (SR-14 — re-read, never resubmit)", () => {
  it("the PATCH is sent ONCE, the role is re-read, the form shows the latest version + a banner", async () => {
    const latest = { ...ADMIN, name: "ผู้ช่วยเจ้าของร้าน", nameCustomized: true, version: 5 };
    roleQ = { ...loaded(ADMIN), refetch: vi.fn(async () => ({ data: latest })) };
    updateMutate.mockRejectedValue(
      new ApiRequestError(409, {
        error: { code: "ROLE_CHANGED", message: "x", details: { currentVersion: 5 } },
      }),
    );
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    await confirmSave(user);

    expect(await screen.findByText("มีคนแก้บทบาทนี้ไปก่อนคุณ")).toBeInTheDocument();
    expect(roleQ.refetch).toHaveBeenCalledTimes(1);
    expect(nameBox()).toHaveValue("ผู้ช่วยเจ้าของร้าน");
    expect(row("จัดการสต๊อก")).not.toBeChecked();
    // Let any stray effect/timer run: still exactly one PATCH.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(updateMutate).toHaveBeenCalledTimes(1);

    // The next save uses the NEW version — and only because the user pressed it.
    updateMutate.mockResolvedValue({ ...latest, version: 6 });
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    await confirmSave(user);
    expect(updateMutate).toHaveBeenCalledTimes(2);
    expect(updateMutate.mock.calls[1][0]).toMatchObject({ version: 5 });
  });
});

describe("R3 · server refusals (§E)", () => {
  async function submitEditWith(error: unknown) {
    updateMutate.mockRejectedValue(error);
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.clear(nameBox());
    await user.type(nameBox(), "ชื่อใหม่");
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    return user;
  }

  it("ROLE_NAME_TAKEN → under the name field, and the field is focused", async () => {
    await submitEditWith(
      new ApiRequestError(409, { error: { code: "ROLE_NAME_TAKEN", message: "x" } }),
    );
    const msg = await screen.findByText(/ซ้ำกับบทบาทที่มีอยู่แล้ว/);
    expect(nameBox()).toHaveAttribute("aria-describedby", expect.stringContaining(msg.id));
    expect(nameBox()).toHaveFocus();
  });

  it("VALIDATION_FAILED fieldErrors.name → the invisible-character sentence under the field", async () => {
    await submitEditWith(
      new ApiRequestError(422, {
        error: { code: "VALIDATION_FAILED", message: "x", fieldErrors: { name: "bad" } },
      }),
    );
    expect(await screen.findByText(/อักขระที่มองไม่เห็น/)).toBeInTheDocument();
  });

  it("429 → 'แก้บทบาทถี่เกินไป กรุณารอ mm:ss' and the save button waits", async () => {
    await submitEditWith(
      new ApiRequestError(429, { error: { code: "RATE_LIMITED", message: "x" } }, 75),
    );
    expect(
      await screen.findByText("แก้บทบาทถี่เกินไป กรุณารอ 01:15 แล้วลองใหม่"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "บันทึก" })).toBeDisabled();
  });

  it("an unknown code → the generic sentence in an alert, never the server's raw message", async () => {
    await submitEditWith(
      new ApiRequestError(500, { error: { code: "INTERNAL", message: "boom" } }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "บันทึกบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    );
    expect(screen.queryByText("boom")).toBeNull();
  });

  it("403 FORBIDDEN mid-way → the roles forbidden panel + re-read my membership", async () => {
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    await submitEditWith(new ApiRequestError(403, { error: { code: "FORBIDDEN", message: "x" } }));
    expect(
      await screen.findByRole("heading", { name: ROLE_FORBIDDEN_PANEL_COPY.title }),
    ).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith({ queryKey: orgKey("org_1", "profile") });
  });
});

describe("R3 · load states", () => {
  it("loading → skeleton, no form yet", () => {
    roleQ = { data: undefined, isError: false, refetch: vi.fn() };
    renderForm({ mode: "edit", roleId: "r_adm" });
    expect(screen.getByRole("status", { name: "กำลังโหลด" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("404 → 'ไม่พบบทบาทนี้' heading and a SEPARATE body line (UX01)", () => {
    roleQ = {
      data: undefined,
      isError: true,
      error: new ApiRequestError(404, { error: { code: "NOT_FOUND", message: "x" } }),
      refetch: vi.fn(),
    };
    renderForm({ mode: "edit", roleId: "r_gone" });
    expect(screen.getByRole("heading", { name: "ไม่พบบทบาทนี้" })).toBeInTheDocument();
    expect(screen.getByText("บทบาทนี้อาจถูกลบไปแล้ว")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "กลับไปหน้ารายการบทบาท" })).toHaveAttribute(
      "href",
      "/o/org_1/settings/roles",
    );
  });

  it("other load error → 'เปิดบทบาทนี้ไม่สำเร็จ' + retry", async () => {
    roleQ = { data: undefined, isError: true, error: new TypeError("net"), refetch: vi.fn() };
    renderForm({ mode: "edit", roleId: "r_adm" });
    expect(screen.getByRole("heading", { name: "เปิดบทบาทนี้ไม่สำเร็จ" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "ลองใหม่" }));
    expect(roleQ.refetch).toHaveBeenCalled();
  });

  it("catalog-only error → danger banner in place of the checklist + save disabled", () => {
    catalogQ = { data: undefined, isError: true, error: new TypeError("net"), refetch: vi.fn() };
    renderForm({ mode: "edit", roleId: "r_adm" });
    expect(screen.getByText("โหลดรายการสิทธิ์ไม่สำเร็จ")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("button", { name: "บันทึก" })).toBeDisabled();
  });
});

describe("R3 · leaving with unsaved edits", () => {
  it("not dirty → 'ยกเลิก' goes straight back to R1", async () => {
    renderForm({ mode: "edit", roleId: "r_adm" });
    await userEvent.setup().click(screen.getByRole("button", { name: "ยกเลิก" }));
    expect(push).toHaveBeenCalledWith("/o/org_1/settings/roles");
  });

  it("dirty → 'ทิ้งการแก้ไขนี้?' — focus starts on 'แก้ต่อ', which keeps the edits", async () => {
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.type(nameBox(), "x");
    await user.click(screen.getByRole("button", { name: "ยกเลิก" }));
    const dialog = screen.getByRole("alertdialog", { name: "ทิ้งการแก้ไขนี้?" });
    expect(
      within(dialog).getByText("สิ่งที่แก้ไว้ยังไม่ได้บันทึก ออกจากหน้านี้แล้วจะหายไป"),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "แก้ต่อ" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "แก้ต่อ" }));
    expect(push).not.toHaveBeenCalled();
    expect(nameBox()).toHaveValue("ผู้ดูแลx");
  });

  it("dirty → 'ทิ้งการแก้ไข' leaves", async () => {
    renderForm({ mode: "create" });
    const user = userEvent.setup();
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "ยกเลิก" }));
    await user.click(screen.getByRole("button", { name: "ทิ้งการแก้ไข" }));
    expect(push).toHaveBeenCalledWith("/o/org_1/settings/roles");
  });

  it("dirty → an in-app link (the ← back link) is intercepted by the same prompt", async () => {
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("link", { name: "บทบาทและสิทธิ์" }));
    expect(screen.getByRole("alertdialog", { name: "ทิ้งการแก้ไขนี้?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ทิ้งการแก้ไข" }));
    expect(push).toHaveBeenCalledWith("/o/org_1/settings/roles");
  });

  it("dirty → closing the tab asks the browser to confirm (beforeunload)", async () => {
    renderForm({ mode: "edit", roleId: "r_adm" });
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    await userEvent.setup().click(row("จัดการสต๊อก"));
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});

// ── T-003-W07 ────────────────────────────────────────────────────────────────

describe("R3a · confirm before save (W07)", () => {
  it("a capability change opens the dialog — diff + impact from the server's usage — and sends NOTHING yet", async () => {
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.click(row("จัดการสต๊อก"));
    await user.click(row("จัดการสมาชิกและคำเชิญ"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    const d = confirmDialog();
    expect(
      within(d).getByRole("heading", { name: 'บันทึกการเปลี่ยนสิทธิ์ของ "ผู้ดูแล"?' }),
    ).toBeInTheDocument();
    const added = within(d).getByRole("heading", { name: "เพิ่ม" }).closest("section")!;
    expect(
      within(added)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["จัดการสต๊อก"]);
    const removed = within(d).getByRole("heading", { name: "เอาออก" }).closest("section")!;
    expect(
      within(removed)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["จัดการสมาชิกและคำเชิญ"]);
    expect(within(d).getByText("มีผลกับสมาชิก 2 คนทันที ไม่ต้องออกจากระบบ")).toBeInTheDocument();
    expect(
      within(d).getByText("คำเชิญที่ยังไม่ปิด 1 ใบ จะได้สิทธิ์ชุดใหม่เมื่อกดรับ"),
    ).toBeInTheDocument();
    // Not my role → no self-loss warning, a plain primary "บันทึก".
    expect(within(d).queryByText("คุณจะเสียสิทธิ์เหล่านี้ทันที")).toBeNull();
    expect(within(d).getByRole("button", { name: "บันทึก" })).toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("an empty section is not shown; 0 members → 'ยังไม่มีสมาชิกใช้บทบาทนี้', no invitation line", async () => {
    roleQ = loaded({ ...STAFF, id: "r_stf" });
    renderForm({ mode: "edit", roleId: "r_stf" });
    const user = userEvent.setup();
    await user.click(row("จัดการสมาชิกและคำเชิญ"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    const d = confirmDialog();
    expect(within(d).queryByRole("heading", { name: "เอาออก" })).toBeNull();
    expect(within(d).getByText("ยังไม่มีสมาชิกใช้บทบาทนี้")).toBeInTheDocument();
    expect(within(d).queryByText(/คำเชิญที่ยังไม่ปิด/)).toBeNull();
  });

  it("'แก้ต่อ' closes the dialog: no request, the edits are still in the form", async () => {
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    await user.click(within(confirmDialog()).getByRole("button", { name: "แก้ต่อ" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(row("จัดการสต๊อก")).toBeChecked();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("Escape also cancels without a request", async () => {
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("confirm → exactly ONE PATCH even on a double press; loading label while in flight; then toast", async () => {
    let resolve!: (v: RoleDetail) => void;
    updateMutate.mockImplementation(() => new Promise<RoleDetail>((r) => (resolve = r)));
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    const save = within(confirmDialog()).getByRole("button", { name: "บันทึก" });
    await user.dblClick(save);
    expect(within(confirmDialog()).getByRole("button", { name: "กำลังบันทึก..." })).toBeDisabled();
    expect(within(confirmDialog()).getByRole("button", { name: "แก้ต่อ" })).toBeDisabled();
    await user.keyboard("{Escape}"); // cannot dismiss while sending
    expect(confirmDialog()).toBeInTheDocument();
    await act(async () =>
      resolve({ ...ADMIN, version: 4, capabilities: [...ADMIN.capabilities, "manage_stock"] }),
    );
    expect(await screen.findByText('บันทึกบทบาท "ผู้ดูแล" แล้ว')).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(updateMutate).toHaveBeenCalledTimes(1);
    // Control for the own-role re-read below: not my role → no extra GET.
    expect(roleQ.refetch).not.toHaveBeenCalled();
  });

  it("a rename alone is sent straight away — no dialog", async () => {
    updateMutate.mockResolvedValue({ ...ADMIN, name: "ผู้ช่วย", nameCustomized: true, version: 4 });
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.clear(nameBox());
    await user.type(nameBox(), "ผู้ช่วย");
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(updateMutate).toHaveBeenCalledTimes(1);
  });

  it("create mode never asks (R3a is edit-only)", async () => {
    createMutate.mockResolvedValue(role({ id: "r_new", name: "a" }));
    renderForm({ mode: "create" });
    const user = userEvent.setup();
    await user.type(nameBox(), "a");
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "สร้างบทบาท" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(createMutate).toHaveBeenCalledTimes(1);
  });

  it("a refusal closes the dialog and shows on the form (§E)", async () => {
    updateMutate.mockRejectedValue(
      new ApiRequestError(500, { error: { code: "INTERNAL", message: "boom" } }),
    );
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    await confirmSave(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "บันทึกบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("R3a · editing my OWN role (AC-3.10)", () => {
  const MINE = role({
    id: "r_mine",
    name: "หัวหน้า",
    capabilities: ["manage_members", "manage_roles", "manage_stock"],
    usage: { activeMembers: 1, pendingInvitations: 0 },
  });
  beforeEach(() => {
    roleQ = loaded(MINE);
  });

  it("losing manage_roles → warning + 'บันทึก และยอมเสียสิทธิ์' (destructive, focus on แก้ต่อ) → redirect to ข้อมูลร้าน + toast + my membership re-read", async () => {
    updateMutate.mockResolvedValue({
      ...MINE,
      version: 4,
      capabilities: ["manage_members", "manage_stock"],
    });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    renderForm(
      { mode: "edit", roleId: "r_mine" },
      ["manage_members", "manage_roles", "manage_stock"],
      "r_mine",
    );
    const user = userEvent.setup();
    await user.click(row("จัดการบทบาทและสิทธิ์"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    const d = confirmDialog();
    const warn = within(d)
      .getByText("คุณจะเสียสิทธิ์เหล่านี้ทันที")
      .closest("[role=alert]") as HTMLElement;
    expect(
      within(warn)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["จัดการบทบาทและสิทธิ์"]);
    expect(
      within(warn).getByText("บันทึกแล้วคุณจะกลับมาแก้เองไม่ได้ ต้องให้เจ้าของร้านแก้คืน"),
    ).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: "แก้ต่อ" })).toHaveFocus();
    const go = within(d).getByRole("button", { name: "บันทึก และยอมเสียสิทธิ์" });
    expect(go.className).toMatch(/bg-btn-danger-bg/);

    await user.click(go);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/o/org_1/settings/org"));
    expect(
      await screen.findByText("บันทึกแล้ว — ตอนนี้คุณไม่มีสิทธิ์จัดการบทบาทแล้ว"),
    ).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith({ queryKey: orgKey("org_1", "profile") });
    expect(updateMutate).toHaveBeenCalledTimes(1);
  });

  it("losing something else → 'ถ้าต้องการคืน…', stays on the form, and re-reads the role (PATCH viewer.* is pre-edit)", async () => {
    updateMutate.mockResolvedValue({
      ...MINE,
      version: 4,
      capabilities: ["manage_roles", "manage_stock"],
    });
    renderForm(
      { mode: "edit", roleId: "r_mine" },
      ["manage_members", "manage_roles", "manage_stock"],
      "r_mine",
    );
    const user = userEvent.setup();
    await user.click(row("จัดการสมาชิกและคำเชิญ"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    const d = confirmDialog();
    expect(within(d).getByText("ถ้าต้องการคืน ให้เจ้าของร้านแก้ให้")).toBeInTheDocument();
    expect(within(d).queryByText(/กลับมาแก้เองไม่ได้/)).toBeNull();
    await user.click(within(d).getByRole("button", { name: "บันทึก และยอมเสียสิทธิ์" }));
    expect(await screen.findByText('บันทึกบทบาท "หัวหน้า" แล้ว')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(roleQ.refetch).toHaveBeenCalled());
  });

  it("my role, gains only → no warning, plain 'บันทึก'", async () => {
    renderForm({ mode: "edit", roleId: "r_mine" }, ["full_access"], "r_mine");
    const user = userEvent.setup();
    await user.click(row("จัดการสินค้า"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    const d = confirmDialog();
    expect(within(d).queryByText("คุณจะเสียสิทธิ์เหล่านี้ทันที")).toBeNull();
    expect(within(d).getByRole("button", { name: "บันทึก" })).toBeInTheDocument();
  });

  it("someone else's role losing manage_roles → no warning (it is not mine)", async () => {
    renderForm({ mode: "edit", roleId: "r_mine" }, ["full_access"], "r_own");
    const user = userEvent.setup();
    await user.click(row("จัดการบทบาทและสิทธิ์"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(within(confirmDialog()).queryByText("คุณจะเสียสิทธิ์เหล่านี้ทันที")).toBeNull();
  });
});

describe("R3b · 409 ROLE_CHANGED — my diff + 'ใส่การแก้ของฉันกลับเข้าไป' (W07, SR-14)", () => {
  const LATEST = {
    ...ADMIN,
    name: "หัวหน้าทีม",
    nameCustomized: true,
    capabilities: ["manage_members", "manage_products", "manage_roles"],
    version: 5,
  };
  const conflict = () =>
    new ApiRequestError(409, {
      error: { code: "ROLE_CHANGED", message: "x", details: { currentVersion: 5 } },
    });

  let setViewerCaps: (caps: string[]) => void;
  async function hitConflict(latest: RoleDetail = LATEST) {
    // Like TanStack Query: a refetch also replaces the query's `data`.
    roleQ = {
      ...loaded(ADMIN),
      refetch: vi.fn(async () => {
        roleQ.data = latest;
        return { data: latest };
      }),
    };
    updateMutate.mockRejectedValueOnce(conflict());
    ({ setViewerCaps } = renderForm({ mode: "edit", roleId: "r_adm" }, [
      "manage_members",
      "manage_products",
      "manage_roles",
      "manage_stock",
    ]));
    const user = userEvent.setup();
    await user.clear(nameBox());
    await user.type(nameBox(), "ผู้ช่วยเจ้าของร้าน");
    await user.click(row("จัดการสต๊อก")); // add
    await user.click(row("จัดการสมาชิกและคำเชิญ")); // remove
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    await confirmSave(user);
    await screen.findByText("มีคนแก้บทบาทนี้ไปก่อนคุณ");
    return user;
  }
  const banner = () =>
    screen.getByText("มีคนแก้บทบาทนี้ไปก่อนคุณ").closest("[role=status]") as HTMLElement;

  it("the banner lists MY edits against the version I started from; the form shows the latest", async () => {
    const scrolled: Element[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    try {
      await hitConflict();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
    const b = banner();
    // Saved from the bottom of a long form: the banner is brought into view.
    expect(scrolled.some((el) => el.contains(b))).toBe(true);
    expect(
      within(b).getByText("หน้านี้แสดงฉบับล่าสุดแล้ว สิ่งที่คุณแก้ไว้ยังไม่ถูกบันทึก:"),
    ).toBeInTheDocument();
    expect(
      within(b)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      'ชื่อ: "ผู้ดูแล" → "ผู้ช่วยเจ้าของร้าน"',
      "เพิ่ม: จัดการสต๊อก",
      "เอาออก: จัดการสมาชิกและคำเชิญ",
    ]);
    expect(nameBox()).toHaveValue("หัวหน้าทีม");
    expect(row("จัดการสต๊อก")).not.toBeChecked();
    expect(row("จัดการบทบาทและสิทธิ์")).toBeChecked();
    expect(updateMutate).toHaveBeenCalledTimes(1);
  });

  it("'ใส่การแก้ของฉันกลับเข้าไป' fills the LATEST version with my diff and sends NOTHING; saving again is my press, via R3a, on the new version", async () => {
    const user = await hitConflict();
    await user.click(within(banner()).getByRole("button", { name: "ใส่การแก้ของฉันกลับเข้าไป" }));
    expect(nameBox()).toHaveValue("ผู้ช่วยเจ้าของร้าน");
    expect(row("จัดการสต๊อก")).toBeChecked();
    expect(row("จัดการสมาชิกและคำเชิญ")).not.toBeChecked();
    expect(row("จัดการบทบาทและสิทธิ์")).toBeChecked(); // the other person's addition is kept
    expect(
      within(banner()).queryByRole("button", { name: "ใส่การแก้ของฉันกลับเข้าไป" }),
    ).toBeNull();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(updateMutate).toHaveBeenCalledTimes(1);

    updateMutate.mockResolvedValueOnce({ ...LATEST, version: 6 });
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(updateMutate).toHaveBeenCalledTimes(1); // R3a asks first
    await confirmSave(user);
    expect(updateMutate).toHaveBeenCalledTimes(2);
    expect(updateMutate.mock.calls[1][0]).toEqual({
      version: 5,
      name: "ผู้ช่วยเจ้าของร้าน",
      capabilities: ["manage_products", "manage_roles", "manage_stock"],
    });
  });

  it("an addition I can no longer grant is skipped with 'บางรายการใส่กลับไม่ได้…'", async () => {
    const user = await hitConflict();
    // Meanwhile my own capabilities were re-read without manage_stock.
    setViewerCaps(["manage_members", "manage_products", "manage_roles"]);
    await user.click(within(banner()).getByRole("button", { name: "ใส่การแก้ของฉันกลับเข้าไป" }));
    expect(row("จัดการสต๊อก")).not.toBeChecked();
    expect(row("จัดการสมาชิกและคำเชิญ")).not.toBeChecked(); // the removal still applies
    expect(nameBox()).toHaveValue("ผู้ช่วยเจ้าของร้าน");
    expect(
      within(banner()).getByText("บางรายการใส่กลับไม่ได้ เพราะตอนนี้คุณไม่มีสิทธิ์นั้น"),
    ).toBeInTheDocument();
  });

  it("control: nothing skipped → no 'ใส่กลับไม่ได้' line", async () => {
    const user = await hitConflict();
    await user.click(within(banner()).getByRole("button", { name: "ใส่การแก้ของฉันกลับเข้าไป" }));
    expect(screen.queryByText(/ใส่กลับไม่ได้/)).toBeNull();
  });

  it("'ปิด' keeps the latest version and hides the banner", async () => {
    const user = await hitConflict();
    await user.click(within(banner()).getByRole("button", { name: "ปิด" }));
    expect(screen.queryByText("มีคนแก้บทบาทนี้ไปก่อนคุณ")).toBeNull();
    expect(nameBox()).toHaveValue("หัวหน้าทีม");
    expect(screen.getByRole("button", { name: "บันทึก" })).toBeDisabled();
  });

  it("the latest version is read-only for me → R4 + the banner and my diff, but NO re-apply button", async () => {
    await hitConflict({
      ...LATEST,
      viewer: { ...LATEST.viewer, canEdit: no("exceeds_your_permissions") },
    });
    expect(screen.queryByRole("textbox", { name: "ชื่อบทบาท" })).toBeNull();
    const b = banner();
    expect(within(b).getAllByRole("listitem").length).toBe(3);
    expect(within(b).queryByRole("button", { name: "ใส่การแก้ของฉันกลับเข้าไป" })).toBeNull();
  });

  it("the re-read returns 404 → 'ไม่พบบทบาทนี้'", async () => {
    roleQ = {
      ...loaded(ADMIN),
      refetch: vi.fn(async () => ({
        error: new ApiRequestError(404, { error: { code: "NOT_FOUND", message: "x" } }),
        isError: true,
      })),
    };
    updateMutate.mockRejectedValueOnce(conflict());
    renderForm({ mode: "edit", roleId: "r_adm" });
    const user = userEvent.setup();
    await user.click(row("จัดการสต๊อก"));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    await confirmSave(user);
    expect(await screen.findByRole("heading", { name: "ไม่พบบทบาทนี้" })).toBeInTheDocument();
    expect(updateMutate).toHaveBeenCalledTimes(1);
  });
});
