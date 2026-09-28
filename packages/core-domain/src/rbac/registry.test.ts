// F-003 · T-003-B03 — U-RB-01 (registry invariants) + U-RB-02 (shipped
// `implies` edges are append-only). test-plan §3 · data-model §1 · ux §0.4.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAPABILITY_REGISTRY,
  CAPABILITY_GROUPS,
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_MEMBERS,
  CAPABILITY_MANAGE_ROLES,
  CAPABILITY_MANAGE_ORG_SETTINGS,
  registryInvariantViolations,
  impliesEdges,
  removedShippedImpliesEdges,
  type CapabilityDef,
} from "./registry";
import * as legacy from "../auth/capabilities";
import { SYSTEM_ROLE_BLUEPRINT } from "../orgs/org-provisioning";

const SHIPPED_EDGES_FILE = join(__dirname, "fixtures", "shipped-implies-edges.json");
const shippedEdges = (): [string, string][] =>
  JSON.parse(readFileSync(SHIPPED_EDGES_FILE, "utf8")) as [string, string][];

/** A valid minimal registry to break one rule at a time. */
function def(key: string, over: Partial<CapabilityDef> = {}): CapabilityDef {
  return {
    key,
    scope: "org",
    labelTh: "ป้าย",
    descriptionTh: "คำอธิบาย",
    group: "team",
    tier: "all",
    status: "live",
    implies: [],
    selectable: true,
    ...over,
  };
}
const FULL = def("full_access", { group: null, selectable: false });
const validFixture = (): CapabilityDef[] => [
  FULL,
  def("manage_widgets", { implies: ["view_widgets"] }),
  def("view_widgets"),
];

describe("U-RB-01 · CAPABILITY_REGISTRY invariants", () => {
  it("the shipped registry has no violations", () => {
    expect(registryInvariantViolations(CAPABILITY_REGISTRY)).toEqual([]);
  });

  it("the valid fixture (with one implies edge) has no violations — control for the red cases", () => {
    expect(registryInvariantViolations(validFixture())).toEqual([]);
  });

  // Each fixture breaks exactly ONE rule; the check must name it.
  const RED: [string, CapabilityDef[], RegExp][] = [
    ["duplicate key", [...validFixture(), def("view_widgets")], /duplicate key "view_widgets"/],
    ["implies points at a missing key", [FULL, def("manage_widgets", { implies: ["view_widgets"] })], /unknown key "view_widgets"/],
    ["implies not of shape manage_X → view_X", [FULL, def("manage_widgets", { implies: ["view_gadgets"] }), def("view_gadgets")], /must be manage_X → view_X/],
    ["implies chain (more than one level)", [FULL, def("manage_a", { implies: ["view_a"] }), def("view_a", { implies: ["view_b"] }), def("view_b")], /one level/],
    ["implies cycle", [FULL, def("manage_a", { implies: ["view_a"] }), def("view_a", { implies: ["manage_a"] })], /one level/],
    ["second selectable=false entry", [...validFixture(), def("manage_x", { selectable: false })], /selectable=false/],
    ["full_access selectable", [def("full_access", { group: null }), def("manage_x")], /selectable=false/],
    ["full_access missing", [def("manage_x")], /full_access/],
    ["scope other than org", [...validFixture(), def("manage_x", { scope: "platform" as "org" })], /scope/],
    ["platform_ prefix", [...validFixture(), def("platform_manage_x")], /platform_/],
    ["cross_ prefix", [...validFixture(), def("cross_manage_x")], /cross_/],
    ["key not snake_case", [...validFixture(), def("manageX")], /snake_case/],
    ["unknown group", [...validFixture(), def("manage_x", { group: "nope" as "team" })], /group/],
    ["empty labelTh", [...validFixture(), def("manage_x", { labelTh: " " })], /labelTh/],
    ["descriptionTh with two sentences", [...validFixture(), def("manage_x", { descriptionTh: "ทำ ก ได้. ทำ ข ได้." })], /descriptionTh/],
  ];
  it.each(RED)("red fixture: %s", (_name, registry, message) => {
    const violations = registryInvariantViolations(registry);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.join("\n")).toMatch(message);
  });

  it("every entry is scope org and no key starts with platform_/cross_ (AC-8.1)", () => {
    expect(CAPABILITY_REGISTRY.length).toBeGreaterThan(0);
    for (const c of CAPABILITY_REGISTRY) {
      expect(c.scope).toBe("org");
      expect(c.key).not.toMatch(/^(platform_|cross_)/);
    }
  });

  it("key/group/tier/status/implies/selectable match data-model §1 row for row", () => {
    expect(
      CAPABILITY_REGISTRY.map((c) => [c.key, c.group, c.tier, c.status, c.implies, c.selectable]),
    ).toEqual([
      ["full_access", null, "all", "live", [], false],
      ["manage_members", "team", "all", "live", [], true],
      ["manage_roles", "team", "all", "live", [], true],
      ["manage_org_settings", "shop", "all", "live", [], true],
      ["manage_billing", "shop", "all", "upcoming", [], true],
      ["manage_products", "catalog_stock", "all", "upcoming", [], true],
      ["manage_stock", "catalog_stock", "all", "upcoming", [], true],
      ["manage_channels", "channels", "all", "upcoming", [], true],
      ["manage_orders", "orders", "all", "upcoming", [], true],
      ["view_financials", "finance", "all", "upcoming", [], true],
      ["access_accounting", "finance", "full", "upcoming", [], true],
    ]);
  });

  // D-037: ux owns this copy; it is pinned here verbatim from ux-wireframe §0.4
  // so a silent edit shows up as a diff ux must review.
  it("Thai copy is ux-wireframe §0.4 verbatim (D-037)", () => {
    expect(CAPABILITY_GROUPS.map((g) => [g.key, g.labelTh])).toEqual([
      ["team", "ทีมงาน"],
      ["shop", "ร้าน"],
      ["catalog_stock", "สินค้าและสต๊อก"],
      ["channels", "ช่องทางขาย"],
      ["orders", "ออเดอร์"],
      ["finance", "การเงิน"],
    ]);
    expect(CAPABILITY_REGISTRY.map((c) => [c.key, c.labelTh, c.descriptionTh])).toEqual([
      ["full_access", "ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)", "ทำได้ทุกอย่างในร้านนี้ รวมถึงสิทธิ์ที่จะเพิ่มในอนาคต และตั้งหรือถอดเจ้าของร้าน"],
      ["manage_members", "จัดการสมาชิกและคำเชิญ", "เชิญคนเข้าร้าน เปลี่ยนบทบาท และถอดสมาชิกออก ได้เฉพาะบทบาทที่ไม่เกินสิทธิ์ของตัวเอง"],
      ["manage_roles", "จัดการบทบาทและสิทธิ์", "สร้าง แก้ และลบบทบาท รวมถึงเลือกว่าแต่ละบทบาททำอะไรได้บ้าง"],
      ["manage_org_settings", "ตั้งค่าร้านและข้อมูลภาษี", "แก้ชื่อร้าน และดูหรือแก้ข้อมูลผู้เสียภาษีของร้าน"],
      ["manage_billing", "จัดการแพ็กเกจและการชำระเงิน", "เปลี่ยนแพ็กเกจ ดูใบเสร็จ และจัดการวิธีชำระเงินของร้าน"],
      ["manage_products", "จัดการสินค้า", "เพิ่ม แก้ และลบสินค้ากับราคาขาย แต่ไม่เห็นต้นทุนถ้าไม่มีสิทธิ์ดูต้นทุนและกำไร"],
      ["manage_stock", "จัดการสต๊อก", "รับของเข้า ปรับยอด และย้ายสต๊อกระหว่างคลังสินค้า"],
      ["manage_channels", "เชื่อมต่อช่องทางขาย", "เชื่อมร้านบน Shopee Lazada และ TikTok แล้วตั้งค่าการส่งสต๊อกไปแต่ละร้าน"],
      ["manage_orders", "จัดการออเดอร์และการแพ็ค", "ดูออเดอร์ แพ็คของ และอัปเดตสถานะการจัดส่ง"],
      ["view_financials", "ดูต้นทุนและกำไร", "เห็นต้นทุน กำไร และตัวเลขการเงินของร้านในทุกหน้าจอ"],
      ["access_accounting", "เข้าถึงระบบบัญชี", "ออกเอกสารบัญชีและดูรายงานภาษีของร้าน"],
    ]);
  });

  it("the registry is frozen (no runtime mutation can grant a key)", () => {
    expect(Object.isFrozen(CAPABILITY_REGISTRY)).toBe(true);
    for (const c of CAPABILITY_REGISTRY) {
      expect(Object.isFrozen(c)).toBe(true);
      expect(Object.isFrozen(c.implies)).toBe(true);
    }
    expect(Object.isFrozen(CAPABILITY_GROUPS)).toBe(true);
  });

  it("constants keep their shipped string values and the legacy exports are the same bindings", () => {
    expect(CAPABILITY_FULL_ACCESS).toBe("full_access");
    expect(CAPABILITY_MANAGE_MEMBERS).toBe("manage_members");
    expect(CAPABILITY_MANAGE_ORG_SETTINGS).toBe("manage_org_settings");
    expect(CAPABILITY_MANAGE_ROLES).toBe("manage_roles");
    expect(legacy.CAPABILITY_FULL_ACCESS).toBe(CAPABILITY_FULL_ACCESS);
    expect(legacy.CAPABILITY_MANAGE_MEMBERS).toBe(CAPABILITY_MANAGE_MEMBERS);
    expect(legacy.CAPABILITY_MANAGE_ORG_SETTINGS).toBe(CAPABILITY_MANAGE_ORG_SETTINGS);
    const keys = CAPABILITY_REGISTRY.map((c) => c.key as string);
    for (const k of [CAPABILITY_FULL_ACCESS, CAPABILITY_MANAGE_MEMBERS, CAPABILITY_MANAGE_ORG_SETTINGS, CAPABILITY_MANAGE_ROLES]) {
      expect(keys).toContain(k);
    }
  });

  it("SYSTEM_ROLE_BLUEPRINT ⊆ registry, and the preset is pinned", () => {
    const keys = new Set<string>(CAPABILITY_REGISTRY.map((c) => c.key));
    for (const role of SYSTEM_ROLE_BLUEPRINT) {
      for (const cap of role.capabilities) expect(keys.has(cap), `${role.key}:${cap}`).toBe(true);
    }
    expect(SYSTEM_ROLE_BLUEPRINT.map((r) => [r.key, [...r.capabilities]])).toEqual([
      ["owner", ["full_access"]],
      // T-003-B11 adds manage_roles here together with the backfill migration
      // (data-model §4.2) — this pin flips to 8 entries in that commit.
      ["admin", ["manage_members", "manage_org_settings", "manage_products", "manage_stock", "manage_channels", "manage_orders", "view_financials"]],
      ["staff", ["manage_products", "manage_stock", "manage_orders"]],
    ]);
  });
});

describe("U-RB-02 · shipped implies edges are append-only (SR-11)", () => {
  it("no edge recorded in the snapshot has been removed from the registry", () => {
    expect(removedShippedImpliesEdges(CAPABILITY_REGISTRY, shippedEdges())).toEqual([]);
  });

  it("every live edge is recorded in the snapshot (otherwise a later removal would go unnoticed)", () => {
    const shipped = new Set(shippedEdges().map(([a, b]) => `${a}→${b}`));
    const unrecorded = impliesEdges(CAPABILITY_REGISTRY).filter(([a, b]) => !shipped.has(`${a}→${b}`));
    expect(unrecorded, "append the edge to rbac/fixtures/shipped-implies-edges.json").toEqual([]);
  });

  // F-003 ships no edge, so the two tests above pass on an empty snapshot. The
  // mechanism is proven here with a fixture that HAS an edge (non-vacuity).
  it("removing a shipped edge is red, and the message demands a data migration", () => {
    const shipped: [string, string][] = [["manage_widgets", "view_widgets"]];
    expect(removedShippedImpliesEdges(validFixture(), shipped)).toEqual([]);
    const withoutEdge = [FULL, def("manage_widgets"), def("view_widgets")];
    const removed = removedShippedImpliesEdges(withoutEdge, shipped);
    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatch(/manage_widgets → view_widgets/);
    expect(removed[0]).toMatch(/data migration/);
  });

  it("adding an edge is allowed", () => {
    expect(removedShippedImpliesEdges(validFixture(), [])).toEqual([]);
    expect(impliesEdges(validFixture())).toEqual([["manage_widgets", "view_widgets"]]);
  });
});
