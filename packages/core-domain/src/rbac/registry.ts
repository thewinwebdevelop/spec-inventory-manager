// F-003 · T-003-B03 — the capability registry (data-model §1 · architecture §1
// · D-032 (2) · D-037). ONE source of every capability key, its Thai copy,
// group, tier, status and `implies` edges. Pure data, deep-frozen.
//
// ⛔ A key is NEVER renamed or removed once shipped: `Role.capabilities` rows in
// the database refer to it by string.
// ⛔ An `implies` edge is NEVER removed once shipped (SR-11): roles are stored in
// canonical form (implied keys dropped), so removing `manage_X → view_X` would
// silently take `view_X` away from every holder. Removing one needs a data
// migration that writes `view_X` back first — U-RB-02 turns red otherwise.
// ✍️ D-037: the Thai copy (`labelTh`, `descriptionTh`, group labels) is owned
// by ux — taken verbatim from ux-wireframe §0.4.

/** Capability required to reset a member's password / manage members (F-001 api-spec §2.8). */
export const CAPABILITY_MANAGE_MEMBERS = "manage_members" as const;
/** Guards the org profile + tax profile (F-002 api-spec §3.4/§3.5/§3.16). */
export const CAPABILITY_MANAGE_ORG_SETTINGS = "manage_org_settings" as const;
/** Wildcard held only by the locked Owner role (D-032 (1)). */
export const CAPABILITY_FULL_ACCESS = "full_access" as const;
/** Design roles: create / clone / edit / delete (D-032 (3)). */
export const CAPABILITY_MANAGE_ROLES = "manage_roles" as const;

export type CapabilityGroup = "team" | "shop" | "catalog_stock" | "channels" | "orders" | "finance";

export interface CapabilityDef {
  readonly key: string;
  /** US-8: a single literal — a cross-org capability means changing this type. */
  readonly scope: "org";
  readonly labelTh: string;
  /** One sentence: what the holder can actually do. */
  readonly descriptionTh: string;
  /** `null` = not in the checklist (`full_access`). */
  readonly group: CapabilityGroup | null;
  /** `full` = hidden and not grantable until F-007 (AC-7.4). */
  readonly tier: "all" | "full";
  /** `upcoming` = "เร็ว ๆ นี้", may be ticked ahead of time (AC-7.5). */
  readonly status: "live" | "upcoming";
  /** `manage_X → [view_X]`, one level only (AC-7.3). */
  readonly implies: readonly string[];
  /** `false` = may never appear in a request (`full_access`). */
  readonly selectable: boolean;
}

/** The part of a registry the set functions need — also the shape of the
 *  `GET /capabilities` catalog items, so clients can pass that straight in. */
export type RegistryLike = readonly Pick<CapabilityDef, "key" | "implies">[];

export interface CapabilityGroupDef {
  readonly key: CapabilityGroup;
  readonly labelTh: string;
}

function deepFreeze<T extends object>(items: readonly T[]): readonly T[] {
  for (const item of items) {
    for (const value of Object.values(item)) if (Array.isArray(value)) Object.freeze(value);
    Object.freeze(item);
  }
  return Object.freeze(items);
}

/** Checklist groups, in display order (ux §0.4). */
export const CAPABILITY_GROUPS = deepFreeze([
  { key: "team", labelTh: "ทีมงาน" },
  { key: "shop", labelTh: "ร้าน" },
  { key: "catalog_stock", labelTh: "สินค้าและสต๊อก" },
  { key: "channels", labelTh: "ช่องทางขาย" },
  { key: "orders", labelTh: "ออเดอร์" },
  { key: "finance", labelTh: "การเงิน" },
] as const satisfies readonly CapabilityGroupDef[]);

const DEFS = [
  {
    key: CAPABILITY_FULL_ACCESS,
    scope: "org",
    labelTh: "ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)",
    descriptionTh: "ทำได้ทุกอย่างในร้านนี้ รวมถึงสิทธิ์ที่จะเพิ่มในอนาคต และตั้งหรือถอดเจ้าของร้าน",
    group: null,
    tier: "all",
    status: "live",
    implies: [],
    selectable: false,
  },
  {
    key: CAPABILITY_MANAGE_MEMBERS,
    scope: "org",
    labelTh: "จัดการสมาชิกและคำเชิญ",
    descriptionTh: "เชิญคนเข้าร้าน เปลี่ยนบทบาท และถอดสมาชิกออก ได้เฉพาะบทบาทที่ไม่เกินสิทธิ์ของตัวเอง",
    group: "team",
    tier: "all",
    status: "live",
    implies: [],
    selectable: true,
  },
  {
    key: CAPABILITY_MANAGE_ROLES,
    scope: "org",
    labelTh: "จัดการบทบาทและสิทธิ์",
    descriptionTh: "สร้าง แก้ และลบบทบาท รวมถึงเลือกว่าแต่ละบทบาททำอะไรได้บ้าง",
    group: "team",
    tier: "all",
    status: "live",
    implies: [],
    selectable: true,
  },
  {
    key: CAPABILITY_MANAGE_ORG_SETTINGS,
    scope: "org",
    labelTh: "ตั้งค่าร้านและข้อมูลภาษี",
    descriptionTh: "แก้ชื่อร้าน และดูหรือแก้ข้อมูลผู้เสียภาษีของร้าน",
    group: "shop",
    tier: "all",
    status: "live",
    implies: [],
    selectable: true,
  },
  {
    key: "manage_billing",
    scope: "org",
    labelTh: "จัดการแพ็กเกจและการชำระเงิน",
    descriptionTh: "เปลี่ยนแพ็กเกจ ดูใบเสร็จ และจัดการวิธีชำระเงินของร้าน",
    group: "shop",
    tier: "all",
    status: "upcoming",
    implies: [],
    selectable: true,
  },
  {
    key: "manage_products",
    scope: "org",
    labelTh: "จัดการสินค้า",
    descriptionTh: "เพิ่ม แก้ และลบสินค้ากับราคาขาย แต่ไม่เห็นต้นทุนถ้าไม่มีสิทธิ์ดูต้นทุนและกำไร",
    group: "catalog_stock",
    tier: "all",
    status: "upcoming",
    implies: [],
    selectable: true,
  },
  {
    key: "manage_stock",
    scope: "org",
    labelTh: "จัดการสต๊อก",
    descriptionTh: "รับของเข้า ปรับยอด และย้ายสต๊อกระหว่างคลังสินค้า",
    group: "catalog_stock",
    tier: "all",
    status: "upcoming",
    implies: [],
    selectable: true,
  },
  {
    key: "manage_channels",
    scope: "org",
    labelTh: "เชื่อมต่อช่องทางขาย",
    descriptionTh: "เชื่อมร้านบน Shopee Lazada และ TikTok แล้วตั้งค่าการส่งสต๊อกไปแต่ละร้าน",
    group: "channels",
    tier: "all",
    status: "upcoming",
    implies: [],
    selectable: true,
  },
  {
    key: "manage_orders",
    scope: "org",
    labelTh: "จัดการออเดอร์และการแพ็ค",
    descriptionTh: "ดูออเดอร์ แพ็คของ และอัปเดตสถานะการจัดส่ง",
    group: "orders",
    tier: "all",
    status: "upcoming",
    implies: [],
    selectable: true,
  },
  {
    key: "view_financials",
    scope: "org",
    labelTh: "ดูต้นทุนและกำไร",
    descriptionTh: "เห็นต้นทุน กำไร และตัวเลขการเงินของร้านในทุกหน้าจอ",
    group: "finance",
    tier: "all",
    status: "upcoming",
    implies: [],
    selectable: true,
  },
  {
    key: "access_accounting",
    scope: "org",
    labelTh: "เข้าถึงระบบบัญชี",
    descriptionTh: "ออกเอกสารบัญชีและดูรายงานภาษีของร้าน",
    group: "finance",
    tier: "full",
    status: "upcoming",
    implies: [],
    selectable: true,
  },
] as const satisfies readonly CapabilityDef[];

/** data-model §1, in order. */
export const CAPABILITY_REGISTRY: readonly (CapabilityDef & (typeof DEFS)[number])[] = deepFreeze(DEFS);

/** Union of every registered key. */
export type CapabilityKey = (typeof DEFS)[number]["key"];

// ── invariants (U-RB-01) — a function so fixtures can prove each rule red ──

const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const GROUP_KEYS: ReadonlySet<string> = new Set(CAPABILITY_GROUPS.map((g) => g.key));

/** Every broken registry rule, as a message. `[]` = valid. */
export function registryInvariantViolations(registry: readonly CapabilityDef[]): string[] {
  const out: string[] = [];
  const byKey = new Map<string, CapabilityDef>();
  for (const c of registry) {
    if (byKey.has(c.key)) out.push(`duplicate key "${c.key}"`);
    byKey.set(c.key, c);
  }
  for (const c of registry) {
    const at = `"${c.key}"`;
    if (!SNAKE_CASE.test(c.key)) out.push(`${at}: key must be snake_case`);
    if (c.scope !== "org") out.push(`${at}: scope must be "org" (US-8)`);
    if (/^(platform_|cross_)/.test(c.key)) out.push(`${at}: platform_/cross_ keys are cross-org (US-8)`);
    if (c.group !== null && !GROUP_KEYS.has(c.group)) out.push(`${at}: unknown group "${c.group}"`);
    if (c.tier !== "all" && c.tier !== "full") out.push(`${at}: unknown tier "${c.tier}"`);
    if (c.status !== "live" && c.status !== "upcoming") out.push(`${at}: unknown status "${c.status}"`);
    if (c.labelTh.trim() === "") out.push(`${at}: labelTh is empty`);
    if (c.descriptionTh.trim() === "" || /[.!?\n]\s*\S/.test(c.descriptionTh)) {
      out.push(`${at}: descriptionTh must be exactly one sentence`);
    }
    const selectableFalseOk = c.key === CAPABILITY_FULL_ACCESS ? !c.selectable : c.selectable;
    if (!selectableFalseOk) out.push(`${at}: selectable=false belongs to full_access alone`);
    for (const target of c.implies) {
      const implied = byKey.get(target);
      if (!implied) {
        out.push(`${at}: implies unknown key "${target}"`);
        continue;
      }
      const m = /^manage_(.+)$/.exec(c.key);
      if (!m || target !== `view_${m[1]}`) out.push(`${at} → "${target}": implies must be manage_X → view_X`);
      // One level only: an implied key implies nothing. This also rules out cycles.
      if (implied.implies.length > 0) out.push(`${at} → "${target}": implies is one level only`);
    }
  }
  const full = byKey.get(CAPABILITY_FULL_ACCESS);
  if (!full) out.push(`${CAPABILITY_FULL_ACCESS} is missing`);
  else if (full.group !== null || full.implies.length > 0) {
    out.push(`${CAPABILITY_FULL_ACCESS}: group must be null and implies empty (it is a wildcard)`);
  }
  return out;
}

// ── shipped implies edges (U-RB-02 · SR-11) ────────────────────────────────

/** Every `[from, to]` implies edge of a registry, in registry order. */
export function impliesEdges(registry: RegistryLike): [string, string][] {
  return registry.flatMap((c) => c.implies.map((to): [string, string] => [c.key, to]));
}

/** Shipped edges (the snapshot in `fixtures/shipped-implies-edges.json`) that
 *  are no longer in `registry`, as messages. `[]` = nothing removed. */
export function removedShippedImpliesEdges(
  registry: RegistryLike,
  shipped: readonly (readonly [string, string])[],
): string[] {
  const live = new Set(impliesEdges(registry).map(([a, b]) => `${a}\u0000${b}`));
  return shipped
    .filter(([a, b]) => !live.has(`${a}\u0000${b}`))
    .map(
      ([a, b]) =>
        `implies edge ${a} → ${b} was shipped and has been removed: roles are stored canonical, ` +
        `so holders of ${a} would silently lose ${b}. Ship a data migration that adds ${b} back first.`,
    );
}
