// T-003-W05 · CW3-02 / CW3-03 (R1 half) — the roles list and the template dialog.
//
// The question this file asks over and over is the repo lesson "client-invented
// server facts": every write affordance must follow the SERVER's verdict in
// BOTH directions. So the capability set handed to the org context is
// deliberately the OPPOSITE of the verdict in the cases that pin it (an Owner
// with `full_access` + a `false` verdict; a bare `view_products` member + a
// `true` verdict) — a screen that peeked at `useCan` would flip one of them.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../../../lib/auth-client";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/o/org_1/settings/roles",
}));

import type { CapabilityCatalog, RoleDetail, RoleDetailListPage } from "./api/use-role-details";

type Q<T> = { data?: T; isError: boolean; error?: unknown; refetch: () => void };
let detailsQ: Q<RoleDetailListPage>;
let catalogQ: Q<CapabilityCatalog>;
const detailsRefetch = vi.fn();
const catalogRefetch = vi.fn();
vi.mock("./api/use-role-details", () => ({
  useRoleDetails: () => detailsQ,
  useCapabilityCatalog: () => catalogQ,
}));

import { RolesScreen } from "./RolesScreen";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
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
    version: 1,
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
  capabilities: ["manage_members", "manage_stock", "manage_orders", "manage_products"],
  usage: { activeMembers: 2, pendingInvitations: 0 },
  lastEdited: { at: "2026-06-23T07:30:00.000Z", by: { kind: "me" } },
});
const STAFF = role({
  id: "r_stf",
  name: "Staff",
  key: "staff",
  nameCustomized: false,
  capabilities: ["manage_products", "manage_stock", "manage_orders"],
  usage: { activeMembers: 3, pendingInvitations: 1 },
});
const BILL = role({
  id: "r_bill",
  name: "บัญชีภายนอก",
  capabilities: ["manage_members"],
  usage: { activeMembers: 0, pendingInvitations: 0 },
  lastEdited: { at: "2026-09-02T02:10:00.000Z", by: { kind: "former_member" } },
  viewer: {
    canEdit: no("exceeds_your_permissions"),
    canDelete: no("exceeds_your_permissions"),
    canClone: no("exceeds_your_permissions"),
  },
});

const entry = (key: string, labelTh: string, selectable = true) => ({
  key,
  labelTh,
  descriptionTh: "-",
  group: selectable ? "catalog_stock" : null,
  status: "live",
  implies: [],
  selectable,
});
const CATALOG: CapabilityCatalog = {
  groups: [{ key: "catalog_stock", labelTh: "สินค้าและสต๊อก" }],
  items: [
    entry("manage_products", "จัดการสินค้า"),
    entry("manage_stock", "จัดการสต๊อก"),
    entry("manage_orders", "จัดการออเดอร์และการแพ็ค"),
    entry("manage_members", "จัดการสมาชิกและคำเชิญ"),
    entry("full_access", "ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)", false),
  ],
};

function page(over: Partial<RoleDetailListPage> = {}): RoleDetailListPage {
  return {
    items: [OWNER, ADMIN, STAFF, BILL],
    nextCursor: null,
    viewer: { canCreate: ok, limit: 30 },
    ...over,
  };
}

function setLoaded(p: RoleDetailListPage = page()) {
  detailsQ = { data: p, isError: false, refetch: detailsRefetch };
  catalogQ = { data: CATALOG, isError: false, refetch: catalogRefetch };
}

function renderScreen(capabilities: string[] = ["manage_roles"], myRoleId = "r_own") {
  const org: ActiveOrg = {
    orgId: "org_1",
    name: "ร้านหอมกรุ่นเบเกอรี่",
    capabilities: new Set(capabilities),
    roleKey: null,
    roleName: "x",
    profile: { myMembership: { roleId: myRoleId } } as unknown as ActiveOrg["profile"],
  };
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ActiveOrgProvider value={org}>
        <RolesScreen />
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  push.mockReset();
  detailsRefetch.mockReset();
  catalogRefetch.mockReset();
  setLoaded();
});

describe("R1 — data", () => {
  it("lists every role with the §0.2 name, usage line, last-edited line, and the counter", () => {
    renderScreen(["manage_roles"], "r_own");
    expect(screen.getByRole("heading", { level: 1, name: "บทบาทและสิทธิ์" })).toBeInTheDocument();
    expect(screen.getByText("ใช้ไป 4 จาก 30 บทบาท")).toBeInTheDocument();

    const owner = screen.getByRole("link", { name: /เจ้าของร้าน/ });
    expect(owner).toHaveTextContent("สมาชิก 1 คน (รวมคุณ) · ค่าเริ่มต้นของระบบ");
    expect(owner).toHaveAttribute("href", "/o/org_1/settings/roles/r_own");

    const admin = screen.getByRole("link", { name: /ผู้ดูแล/ });
    expect(admin).toHaveTextContent(/^ผู้ดูแล.*สมาชิก 2 คน · แก้ไขล่าสุดโดยคุณ · 23 มิ\.ย\. 2569/);
    expect(admin).not.toHaveTextContent("รวมคุณ"); // not the viewer's role

    expect(screen.getByRole("link", { name: /พนักงาน/ })).toHaveTextContent(
      "สมาชิก 3 คน · คำเชิญที่ยังไม่ปิด 1 ใบ · ค่าเริ่มต้นของระบบ",
    );
    expect(screen.getByRole("link", { name: /บัญชีภายนอก/ })).toHaveTextContent(
      "ยังไม่มีสมาชิกใช้ · แก้ไขล่าสุดโดยอดีตสมาชิก",
    );
  });

  it("last edited by a member: editor's CURRENT role name via the §0.2 rule (key translated unless customised)", () => {
    const edited = (by: object) =>
      role({
        id: "r_e",
        name: "E",
        lastEdited: { at: "2026-06-23T07:30:00.000Z", by: { kind: "member", ...by } },
      });
    setLoaded(
      page({ items: [edited({ roleName: "Admin", roleKey: "admin", roleNameCustomized: false })] }),
    );
    const { unmount } = renderScreen();
    expect(screen.getByRole("link")).toHaveTextContent('แก้ไขล่าสุดโดยคนในบทบาท "ผู้ดูแล"');
    unmount();
    setLoaded(
      page({ items: [edited({ roleName: "แพ็คของ", roleKey: null, roleNameCustomized: true })] }),
    );
    renderScreen();
    expect(screen.getByRole("link")).toHaveTextContent('แก้ไขล่าสุดโดยคนในบทบาท "แพ็คของ"');
  });

  it("rows keep the server's order", () => {
    renderScreen();
    const names = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"))
      .filter((h) => h?.includes("/roles/"));
    expect(names).toEqual([
      "/o/org_1/settings/roles/r_own",
      "/o/org_1/settings/roles/r_adm",
      "/o/org_1/settings/roles/r_stf",
      "/o/org_1/settings/roles/r_bill",
    ]);
  });

  it("badges: ล็อก for the system role, ดูได้อย่างเดียว for exceeds_your_permissions, none otherwise", () => {
    renderScreen();
    expect(
      within(screen.getByRole("link", { name: /เจ้าของร้าน/ })).getByText("ล็อก"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: /บัญชีภายนอก/ })).getByText("ดูได้อย่างเดียว"),
    ).toBeInTheDocument();
    const staff = screen.getByRole("link", { name: /พนักงาน/ });
    expect(within(staff).queryByText("ล็อก")).toBeNull();
    expect(within(staff).queryByText("ดูได้อย่างเดียว")).toBeNull();
  });

  it("a customised name is shown as-is, never translated by key", () => {
    setLoaded(
      page({
        items: [
          OWNER,
          role({ id: "r_c", name: "พนักงานแพ็คของ", key: "staff", nameCustomized: true }),
        ],
      }),
    );
    renderScreen();
    expect(screen.getByRole("link", { name: /พนักงานแพ็คของ/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^พนักงาน$/ })).toBeNull();
  });
});

describe("R1 — ★ verdicts win over local capabilities, both directions (CW3-03)", () => {
  it("canCreate=true ⇒ enabled even for a member whose local caps would say no", () => {
    renderScreen(["view_products"]);
    expect(screen.getByRole("button", { name: "สร้างบทบาท" })).toBeEnabled();
  });

  it("canCreate=false ⇒ disabled even for an Owner holding full_access", () => {
    setLoaded(page({ viewer: { canCreate: no("role_limit_reached"), limit: 30 } }));
    renderScreen(["full_access"]);
    expect(screen.getByRole("button", { name: "สร้างบทบาท" })).toBeDisabled();
  });

  it("role_limit_reached ⇒ the reason sits under the button, limit from the server", () => {
    setLoaded(page({ viewer: { canCreate: no("role_limit_reached"), limit: 12 } }));
    renderScreen();
    expect(
      screen.getByText("ร้านนี้มีบทบาทครบ 12 บทบาทแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ยังสร้างหรือแก้บทบาทไม่ได้/)).toBeNull();
  });

  it("writes_disabled ⇒ info banner on top, create disabled, list still readable", () => {
    setLoaded(page({ viewer: { canCreate: no("writes_disabled"), limit: 30 } }));
    renderScreen();
    expect(screen.getByRole("status")).toHaveTextContent("ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้");
    expect(screen.getByRole("button", { name: "สร้างบทบาท" })).toBeDisabled();
    expect(screen.getAllByRole("link", { name: /พนักงาน|ผู้ดูแล/ }).length).toBe(2);
  });

  it("an unknown create reason still explains itself (generic copy), button disabled", () => {
    setLoaded(page({ viewer: { canCreate: no("brand_new_reason"), limit: 30 } }));
    renderScreen();
    expect(screen.getByRole("button", { name: "สร้างบทบาท" })).toBeDisabled();
    expect(screen.getByText(/ตอนนี้คุณทำรายการนี้กับบทบาทนี้ไม่ได้/)).toBeInTheDocument();
  });

  it("per-row badge follows canEdit, not local caps: Owner holding full_access still sees ดูได้อย่างเดียว on a refused row", () => {
    renderScreen(["full_access"]);
    expect(
      within(screen.getByRole("link", { name: /บัญชีภายนอก/ })).getByText("ดูได้อย่างเดียว"),
    ).toBeInTheDocument();
  });

  it("writes_disabled / role_locked on canEdit never produce the ดูได้อย่างเดียว badge (ux R1)", () => {
    setLoaded(
      page({
        items: [
          role({
            id: "a",
            name: "A",
            viewer: { canEdit: no("writes_disabled"), canDelete: ok, canClone: ok },
          }),
          role({
            id: "b",
            name: "B",
            viewer: { canEdit: no("role_locked"), canDelete: ok, canClone: ok },
          }),
        ],
      }),
    );
    renderScreen();
    expect(screen.queryByText("ดูได้อย่างเดียว")).toBeNull();
  });
});

describe("R1 — ไปหน้าสมาชิก", () => {
  it("shown only with manage_members (a link to a screen the person can open)", () => {
    renderScreen(["manage_roles", "manage_members"]);
    const link = screen.getByRole("link", { name: "ไปหน้าสมาชิก" });
    expect(link).toHaveAttribute("href", "/o/org_1/settings/members");
  });
  it("hidden without it", () => {
    renderScreen(["manage_roles"]);
    expect(screen.queryByRole("link", { name: "ไปหน้าสมาชิก" })).toBeNull();
  });
  it("an Owner (full_access wildcard) gets it", () => {
    renderScreen(["full_access"]);
    expect(screen.getByRole("link", { name: "ไปหน้าสมาชิก" })).toBeInTheDocument();
  });
});

describe("R1 — states", () => {
  it("loading: skeleton rows, create disabled, no list", () => {
    detailsQ = { isError: false, refetch: detailsRefetch };
    catalogQ = { isError: false, refetch: catalogRefetch };
    renderScreen();
    expect(screen.getByRole("status", { name: "กำลังโหลด" })).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton-row")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "สร้างบทบาท" })).toBeDisabled();
  });

  it("catalog still loading ⇒ list not drawn and create stays disabled (R2 has no loading of its own)", () => {
    catalogQ = { isError: false, refetch: catalogRefetch };
    renderScreen();
    expect(screen.getByRole("button", { name: "สร้างบทบาท" })).toBeDisabled();
  });

  it("error: ux copy + retry refetches both reads", async () => {
    detailsQ = {
      isError: true,
      error: new ApiError(500, { error: { code: "INTERNAL", message: "x" } }),
      refetch: detailsRefetch,
    };
    renderScreen();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("โหลดรายการบทบาทไม่สำเร็จ");
    expect(alert).toHaveTextContent("ตรวจการเชื่อมต่อแล้วลองใหม่");
    await userEvent.click(within(alert).getByRole("button", { name: "ลองใหม่" }));
    expect(detailsRefetch).toHaveBeenCalledTimes(1);
    expect(catalogRefetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "สร้างบทบาท" })).toBeDisabled();
  });

  it("a failing catalog is an error too (R2 could not word its options)", () => {
    catalogQ = {
      isError: true,
      error: new ApiError(500, { error: { code: "INTERNAL", message: "x" } }),
      refetch: catalogRefetch,
    };
    renderScreen();
    expect(screen.getByRole("alert")).toHaveTextContent("โหลดรายการบทบาทไม่สำเร็จ");
  });

  it("empty list is the error state, never an empty list (a shop always has an Owner role)", () => {
    setLoaded(page({ items: [] }));
    renderScreen();
    expect(screen.getByRole("alert")).toHaveTextContent("โหลดรายการบทบาทไม่สำเร็จ");
    expect(screen.queryByText(/ใช้ไป 0 จาก/)).toBeNull();
  });

  it("403 FORBIDDEN mid-way ⇒ the ForbiddenPanel with title, body and the back button", () => {
    detailsQ = {
      isError: true,
      error: new ApiError(403, { error: { code: "FORBIDDEN", message: "x" } }),
      refetch: detailsRefetch,
    };
    renderScreen();
    expect(
      screen.getByRole("heading", { name: ROLE_FORBIDDEN_PANEL_COPY.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(ROLE_FORBIDDEN_PANEL_COPY.body)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "กลับไปหน้าข้อมูลร้าน" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "สร้างบทบาท" })).toBeNull();
  });
});

describe("R2 — template dialog", () => {
  async function open() {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "สร้างบทบาท" }));
    return screen.getByRole("dialog", { name: "สร้างบทบาทใหม่" });
  }

  it("shows title, lead, owner note; no Owner option; blank last; reasons on disabled", async () => {
    const dialog = await open();
    expect(
      within(dialog).getByText("เริ่มจากบทบาทที่ใกล้เคียงที่สุด แล้วค่อยปรับสิทธิ์"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "บทบาทเจ้าของร้านใช้เป็นต้นแบบไม่ได้ เพราะสิทธิ์ทำได้ทุกอย่างมีได้เฉพาะเจ้าของร้าน",
      ),
    ).toBeInTheDocument();
    const radios = within(dialog).getAllByRole("radio");
    expect(radios.map((r) => r.closest("label")?.textContent?.slice(0, 12))).toEqual([
      expect.stringContaining("ผู้ดูแล"),
      expect.stringContaining("พนักงาน"),
      expect.stringContaining("บัญชีภายนอก"),
      expect.stringContaining("เริ่มจากว่าง"),
    ]);
    expect(within(dialog).queryByText("เจ้าของร้าน", { selector: "span" })).toBeNull();
    expect(
      within(dialog).getByText("บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงใช้เป็นต้นแบบไม่ได้"),
    ).toBeInTheDocument();
    expect(radios[2]).toBeDisabled();
    expect(
      within(dialog).getByText("3 สิทธิ์: จัดการสินค้า, จัดการสต๊อก, จัดการออเดอร์และการแพ็ค"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/^4 สิทธิ์: .*…$/)).toBeInTheDocument();
  });

  it("pre-selects the cloneable role with the fewest capabilities, and ถัดไป goes to R3 with ?from=", async () => {
    const dialog = await open();
    expect(within(dialog).getByRole("radio", { name: /พนักงาน/ })).toBeChecked();
    await userEvent.click(within(dialog).getByRole("button", { name: "ถัดไป" }));
    expect(push.mock.calls).toEqual([["/o/org_1/settings/roles/new?from=r_stf"]]);
  });

  it("เริ่มจากว่าง ⇒ no ?from", async () => {
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("radio", { name: /เริ่มจากว่าง/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "ถัดไป" }));
    expect(push.mock.calls).toEqual([["/o/org_1/settings/roles/new"]]);
  });

  it("a disabled template cannot be chosen", async () => {
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("radio", { name: /บัญชีภายนอก/ }));
    expect(within(dialog).getByRole("radio", { name: /บัญชีภายนอก/ })).not.toBeChecked();
    expect(within(dialog).getByRole("radio", { name: /พนักงาน/ })).toBeChecked();
  });

  it("nothing cloneable ⇒ blank is pre-selected", async () => {
    setLoaded(page({ items: [OWNER, BILL] }));
    const dialog = await open();
    expect(within(dialog).getByRole("radio", { name: /เริ่มจากว่าง/ })).toBeChecked();
  });

  it("ยกเลิก and Escape close it without navigating", async () => {
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "ยกเลิก" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "สร้างบทบาท" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});
