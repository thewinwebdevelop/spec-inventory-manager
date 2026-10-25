/**
 * T-003-W05 · CW3 — R2 option building (ux-wireframe R2). Pure: the verdicts
 * on the wire decide disabled / hidden; this module only orders and words them.
 */
import { describe, it, expect } from "vitest";
import {
  BLANK_TEMPLATE,
  buildTemplateOptions,
  defaultTemplate,
  createHref,
} from "./template-options";
import type { RoleDetail, CapabilityCatalog } from "./api/use-role-details";

const ok = { allowed: true, reason: null };
const no = (reason: string) => ({ allowed: false, reason });

function role(over: Partial<RoleDetail> & { id: string; name: string }): RoleDetail {
  return {
    key: null,
    nameCustomized: true,
    isSystem: false,
    grantsOwnership: false,
    capabilities: [],
    version: 1,
    usage: { activeMembers: 0, pendingInvitations: 0 },
    lastEdited: null,
    viewer: { canEdit: ok, canDelete: ok, canClone: ok },
    createdAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

const item = (
  key: string,
  labelTh: string,
  selectable = true,
  group: string | null = "catalog_stock",
) => ({
  key,
  labelTh,
  descriptionTh: "-",
  group,
  status: "live",
  implies: [],
  selectable,
});

const catalog: CapabilityCatalog = {
  groups: [{ key: "catalog_stock", labelTh: "สินค้าและสต๊อก" }],
  items: [
    item("manage_products", "จัดการสินค้า"),
    item("manage_stock", "จัดการสต๊อก"),
    item("manage_orders", "จัดการออเดอร์และการแพ็ค"),
    item("manage_members", "จัดการสมาชิกและคำเชิญ"),
    item("full_access", "ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)", false, null),
  ],
};

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
  capabilities: ["manage_members", "manage_orders", "manage_products", "manage_stock"],
});
const STAFF = role({
  id: "r_stf",
  name: "Staff",
  key: "staff",
  nameCustomized: false,
  capabilities: ["manage_products", "manage_stock", "manage_orders"],
});
const BILL = role({
  id: "r_bill",
  name: "บัญชีภายนอก",
  capabilities: ["manage_members"],
  viewer: {
    canEdit: no("exceeds_your_permissions"),
    canDelete: no("exceeds_your_permissions"),
    canClone: no("exceeds_your_permissions"),
  },
});

describe("buildTemplateOptions", () => {
  it("drops the owner_role clone verdict entirely (AC-3.2) and ends with 'เริ่มจากว่าง'", () => {
    const options = buildTemplateOptions([OWNER, ADMIN, STAFF], catalog);
    expect(options.map((o) => o.value)).toEqual(["r_adm", "r_stf", BLANK_TEMPLATE]);
    expect(options.some((o) => o.label === "เจ้าของร้าน")).toBe(false);
    expect(options[options.length - 1].label).toBe("เริ่มจากว่าง");
    expect(options[options.length - 1].description).toBe("ไม่ติ๊กสิทธิ์ใดไว้ก่อน เลือกเองทีละข้อ");
  });

  it("words the description '{n} สิทธิ์: first three labels' in catalog order, with … past three", () => {
    const [admin, staff] = buildTemplateOptions([ADMIN, STAFF], catalog);
    // catalog order, NOT the role's own (alphabetical) order
    expect(admin.description).toBe("4 สิทธิ์: จัดการสินค้า, จัดการสต๊อก, จัดการออเดอร์และการแพ็ค…");
    expect(staff.description).toBe("3 สิทธิ์: จัดการสินค้า, จัดการสต๊อก, จัดการออเดอร์และการแพ็ค");
  });

  it("names roles by the §0.2 display rule (system key translated, customised name as-is)", () => {
    const [admin, , bill] = buildTemplateOptions([ADMIN, STAFF, BILL], catalog);
    expect(admin.label).toBe("ผู้ดูแล");
    expect(bill.label).toBe("บัญชีภายนอก");
  });

  it("counts keys the catalog does not know but never prints them", () => {
    const odd = role({ id: "r_odd", name: "แปลก", capabilities: ["manage_stock", "future_thing"] });
    const [opt] = buildTemplateOptions([odd], catalog);
    expect(opt.description).toBe("2 สิทธิ์: จัดการสต๊อก");
    expect(opt.description).not.toContain("future_thing");
  });

  it("disabled from the SERVER verdict, with the ux sentence per reason — unknown reason gets the generic one", () => {
    const weird = role({
      id: "r_w",
      name: "x",
      viewer: { canEdit: ok, canDelete: ok, canClone: no("something_new") },
    });
    const [bill, w] = buildTemplateOptions([BILL, weird], catalog);
    expect(bill.disabled).toBe(true);
    expect(bill.disabledReason).toBe("บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงใช้เป็นต้นแบบไม่ได้");
    expect(w.disabled).toBe(true);
    expect(w.disabledReason).toBe("ใช้บทบาทนี้เป็นต้นแบบไม่ได้");
  });

  it("verdict wins over local capabilities: an allowed clone is enabled whatever the caps look like", () => {
    const allowed = role({ id: "r_x", name: "x", capabilities: ["manage_members"] });
    const [opt] = buildTemplateOptions([allowed], catalog);
    expect(opt.disabled ?? false).toBe(false);
    expect(opt.disabledReason).toBeUndefined();
  });
});

describe("defaultTemplate", () => {
  it("picks the allowed clone with the FEWEST capabilities", () => {
    expect(defaultTemplate([OWNER, ADMIN, STAFF])).toBe("r_stf");
  });
  it("ties go to the first in server order", () => {
    const a = role({ id: "a", name: "a", capabilities: ["manage_stock"] });
    const b = role({ id: "b", name: "b", capabilities: ["manage_orders"] });
    expect(defaultTemplate([a, b])).toBe("a");
  });
  it("skips disabled roles even if they are smaller", () => {
    expect(defaultTemplate([BILL, ADMIN])).toBe("r_adm");
  });
  it("falls back to blank when nothing can be cloned", () => {
    expect(defaultTemplate([OWNER, BILL])).toBe(BLANK_TEMPLATE);
    expect(defaultTemplate([])).toBe(BLANK_TEMPLATE);
  });
});

describe("createHref", () => {
  it("adds ?from=<roleId> for a role and nothing for blank", () => {
    expect(createHref("org_1", "r_stf")).toBe("/o/org_1/settings/roles/new?from=r_stf");
    expect(createHref("org_1", BLANK_TEMPLATE)).toBe("/o/org_1/settings/roles/new");
  });
  it("encodes the id", () => {
    expect(createHref("o", "a b&c")).toBe("/o/o/settings/roles/new?from=a%20b%26c");
  });
});
