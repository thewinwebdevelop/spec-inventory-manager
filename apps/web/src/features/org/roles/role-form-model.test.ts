/**
 * T-003-W06 · CW3-04 — R3's pure form model (ux-wireframe R3, §0.4).
 *
 * Catalog fixture: the shape `GET /capabilities` returns (CapabilityCatalog in
 * @omnistock/contracts), WITH an imply pair `manage_products → view_products`
 * the production registry does not have yet — the imply-lock rules must be
 * proven before the first pair ships, not after (test-plan CW3-04).
 */
import { describe, it, expect } from "vitest";
import {
  buildChecklist,
  buildCreateBody,
  buildUpdateBody,
  cloneName,
  cloneSelection,
  initialSelection,
  nameLength,
  payloadCapabilities,
  toggleCapability,
  validateRoleNameInput,
} from "./role-form-model";
import type { CapabilityCatalog } from "./api/use-role-details";

const item = (
  key: string,
  group: string | null,
  over: Partial<CapabilityCatalog["items"][number]> = {},
) => ({
  key,
  labelTh: `ป้าย ${key}`,
  descriptionTh: `คำอธิบาย ${key}`,
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
    item("full_access", null, { selectable: false }),
    item("manage_members", "team"),
    item("manage_roles", "team"),
    item("manage_products", "catalog_stock", { status: "upcoming", implies: ["view_products"] }),
    item("view_products", "catalog_stock", { status: "upcoming" }),
    item("manage_stock", "catalog_stock", { status: "weird_future_status" }),
    item("new_thing", "brand_new_group"),
    item("loose_thing", null),
  ],
};

const canAll = () => true;

describe("buildChecklist", () => {
  it("groups follow groups[], rows follow items[], selectable=false is never a row", () => {
    const view = buildChecklist(CATALOG, new Set(), canAll);
    expect(view.groups.map((g) => g.label)).toEqual(["ทีมงาน", "สินค้าและสต๊อก", "อื่น ๆ"]);
    expect(view.groups[1].rows.map((r) => r.key)).toEqual([
      "manage_products",
      "view_products",
      "manage_stock",
    ]);
    const keys = view.groups.flatMap((g) => g.rows.map((r) => r.key));
    expect(keys).not.toContain("full_access");
    expect(view.total).toBe(7);
  });

  it("an unknown group and a null group (selectable) land in the last group 'อื่น ๆ'", () => {
    const view = buildChecklist(CATALOG, new Set(), canAll);
    expect(view.groups.at(-1)!.rows.map((r) => r.key)).toEqual(["new_thing", "loose_thing"]);
  });

  it("'เร็ว ๆ นี้' only for status=upcoming; an unknown status gets no badge", () => {
    const view = buildChecklist(CATALOG, new Set(), canAll);
    const rows = Object.fromEntries(view.groups.flatMap((g) => g.rows).map((r) => [r.key, r]));
    expect(rows.manage_products.upcoming).toBe(true);
    expect(rows.manage_stock.upcoming).toBe(false);
    expect(view.hasUpcoming).toBe(true);
  });

  it("imply-lock: a ticked manage_X shows view_X ticked AND locked", () => {
    const view = buildChecklist(CATALOG, new Set(["manage_products", "view_products"]), canAll);
    const vp = view.groups[1].rows.find((r) => r.key === "view_products")!;
    expect(vp).toMatchObject({ checked: true, locked: true, disabled: false });
    const mp = view.groups[1].rows.find((r) => r.key === "manage_products")!;
    expect(mp).toMatchObject({ checked: true, locked: false });
  });

  it("'คุณไม่มีสิทธิ์นี้' = disabled only when the viewer lacks it AND the row is unticked", () => {
    const lacksRoles = (k: string) => k !== "manage_roles";
    const off = buildChecklist(CATALOG, new Set(), lacksRoles);
    expect(off.groups[0].rows.find((r) => r.key === "manage_roles")!.disabled).toBe(true);
    // Already ticked (the role has it) → the viewer may still take it away.
    const on = buildChecklist(CATALOG, new Set(["manage_roles"]), lacksRoles);
    expect(on.groups[0].rows.find((r) => r.key === "manage_roles")!.disabled).toBe(false);
  });

  it("the counter counts shown rows that are ticked, locked ones included", () => {
    const view = buildChecklist(CATALOG, new Set(["manage_products", "view_products"]), canAll);
    expect(view.selectedCount).toBe(2);
    expect(view.groups[1].selectedCount).toBe(2);
    expect(view.groups[0].selectedCount).toBe(0);
  });

  it("an empty group is not shown", () => {
    const only: CapabilityCatalog = {
      groups: CATALOG.groups,
      items: [item("manage_members", "team")],
    };
    expect(buildChecklist(only, new Set(), canAll).groups.map((g) => g.label)).toEqual(["ทีมงาน"]);
  });
});

describe("selection ↔ stored set", () => {
  it("initialSelection expands implies one level and splits off keys the catalog does not know", () => {
    const { selection, passthrough } = initialSelection(
      ["manage_products", "retired_key"],
      CATALOG,
    );
    expect([...selection].sort()).toEqual(["manage_products", "view_products"]);
    expect(passthrough).toEqual(["retired_key"]);
  });

  it("ticking manage_X adds view_X; unticking manage_X keeps view_X ticked but UNLOCKED", () => {
    let s = toggleCapability(new Set(), "manage_products", true, CATALOG);
    expect([...s].sort()).toEqual(["manage_products", "view_products"]);
    s = toggleCapability(s, "manage_products", false, CATALOG);
    expect([...s]).toEqual(["view_products"]);
    const vp = buildChecklist(CATALOG, s, canAll).groups[1].rows.find(
      (r) => r.key === "view_products",
    )!;
    expect(vp).toMatchObject({ checked: true, locked: false });
  });

  it("payload = what the user ticked minus locked rows, plus unknown keys sent back (never dropped)", () => {
    const sel = new Set(["manage_products", "view_products", "manage_members"]);
    expect(payloadCapabilities(sel, ["retired_key"], CATALOG)).toEqual([
      "manage_members",
      "manage_products",
      "retired_key",
    ]);
  });

  it("clone: source caps minus non-selectable and unknown keys (ux R3 โหมดสำเนา)", () => {
    const s = cloneSelection(["full_access", "manage_stock", "retired_key"], CATALOG);
    expect([...s]).toEqual(["manage_stock"]);
  });
});

describe("name", () => {
  it("counts code points after trimming", () => {
    expect(nameLength("  ผู้ดูแล  ")).toBe([..."ผู้ดูแล"].length);
    expect(nameLength("😀")).toBe(1);
  });

  it("client checks: empty and > 50; the rest is the server's", () => {
    expect(validateRoleNameInput("   ")).toBe("empty");
    expect(validateRoleNameInput("ก".repeat(50))).toBeNull();
    expect(validateRoleNameInput("ก".repeat(51))).toBe("too_long");
  });

  it("cloneName: 'สำเนาของ {ชื่อ}', ≤ 50 code points", () => {
    expect(cloneName("พนักงาน", [])).toBe("สำเนาของ พนักงาน");
    const long = cloneName("ข".repeat(60), []);
    expect([...long].length).toBe(50);
    expect(long.startsWith("สำเนาของ ")).toBe(true);
  });

  it("cloneName: a clash with an existing name (case-insensitive) gets ' (2)', ' (3)' … still ≤ 50", () => {
    expect(cloneName("Staff", ["สำเนาของ staff"])).toBe("สำเนาของ Staff (2)");
    expect(cloneName("Staff", ["สำเนาของ Staff", "สำเนาของ Staff (2)"])).toBe("สำเนาของ Staff (3)");
    const long = cloneName("ข".repeat(60), [cloneName("ข".repeat(60), [])]);
    expect([...long].length).toBe(50);
    expect(long.endsWith(" (2)")).toBe(true);
  });
});

describe("request bodies", () => {
  const base = {
    version: 4,
    initialName: "ผู้ดูแล",
    initialCapabilities: ["manage_members"],
  };

  it("⚠️ edit: `name` is sent ONLY when the trimmed value differs (ux R3 ⚠️ — the translation trap)", () => {
    expect(
      buildUpdateBody({
        ...base,
        name: " ผู้ดูแล ",
        capabilities: ["manage_members", "manage_roles"],
      }),
    ).toEqual({ version: 4, capabilities: ["manage_members", "manage_roles"] });
  });

  it("edit: name only → no `capabilities` key", () => {
    expect(buildUpdateBody({ ...base, name: "ผู้ช่วย", capabilities: ["manage_members"] })).toEqual(
      {
        version: 4,
        name: "ผู้ช่วย",
      },
    );
  });

  it("edit: capability order does not count as a change", () => {
    const b = { ...base, initialCapabilities: ["a", "b"] };
    expect(buildUpdateBody({ ...b, name: "ผู้ดูแล", capabilities: ["b", "a"] })).toBeNull();
  });

  it("edit: nothing changed → null (no request at all)", () => {
    expect(
      buildUpdateBody({ ...base, name: "ผู้ดูแล", capabilities: ["manage_members"] }),
    ).toBeNull();
  });

  it("create: trimmed name + capabilities", () => {
    expect(buildCreateBody("  แพ็คของ ", ["manage_orders"])).toEqual({
      name: "แพ็คของ",
      capabilities: ["manage_orders"],
    });
  });
});
