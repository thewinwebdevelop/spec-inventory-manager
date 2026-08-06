/**
 * Thai copy for the F-002 org screens (S1/S2/S3).
 *
 * Ownership: `ux`. Every string is copied verbatim from
 * docs/features/F-002/ux-wireframe.md §2–§4 — do not hand-edit; request
 * changes from `ux`.
 *
 * Two conventions from ui.md §2.7 that are easy to break here: an icon never
 * lives inside a string (the "+" on "สร้างร้านใหม่" comes from the component),
 * and a count is interpolated rather than baked in.
 */
export const orgTh = {
  /** S1 — เลือกร้าน */
  selectOrg: {
    title: "เลือกร้านที่จะเข้าใช้งาน",
    subtitle: (n: number) => `คุณเป็นสมาชิกอยู่ ${n} ร้าน`,
    createShop: "สร้างร้านใหม่",
    loadMore: "โหลดเพิ่ม",
    empty: {
      title: "คุณยังไม่ได้อยู่ในร้านไหน",
      body: "สร้างร้านของคุณเอง หรือถ้ามีคนชวนคุณเข้าร้าน ให้ขอลิงก์คำเชิญจากเจ้าของร้าน",
      cta: "สร้างร้านใหม่",
    },
    error: "โหลดรายการร้านไม่สำเร็จ",
  },

  /** S2 — สร้างร้านใหม่ */
  createOrg: {
    title: "สร้างร้านใหม่",
    back: "ย้อนกลับ",
    name: {
      label: "ชื่อร้าน",
      placeholder: "เช่น ร้านหอมกรุ่นเบเกอรี่",
      helper: "ตั้งชื่อที่คุณเรียกร้านตัวเอง เปลี่ยนทีหลังได้",
    },
    explainer:
      "เมื่อสร้างเสร็จ คุณจะเป็นเจ้าของร้านนี้ และระบบจะเตรียม \"คลังหลัก\" ให้ 1 คลัง · ใช้สกุลเงินบาท (฿) และเวลาประเทศไทย",
    submit: "สร้างร้าน",
    submitLoading: "กำลังสร้างร้าน...",
    successToast: (name: string) => `สร้างร้าน "${name}" เรียบร้อย`,
    error: {
      /** 422 VALIDATION_FAILED + fieldErrors.name */
      name: "กรอกชื่อร้าน (ไม่เกิน 120 ตัวอักษร)",
      /** 409 ORG_LIMIT_REACHED — `limit` comes from `details.limit`, never hard-coded. */
      limitReached: (limit: number) =>
        `คุณสร้างร้านครบ ${limit} ร้านแล้ว หากต้องการเพิ่ม กรุณาติดต่อทีมงาน OmniStock`,
      /** 503 ORG_PROVISIONING_UNAVAILABLE — explicitly "not your fault". */
      provisioning:
        "ตอนนี้ระบบยังเปิดร้านใหม่ให้ไม่ได้ (ไม่ใช่ความผิดของคุณ) ลองใหม่อีกครั้ง หรือติดต่อทีมงาน OmniStock",
      generic: "สร้างร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    },
  },

  /** S3 — โครงหน้าจอของร้าน + ตัวสลับร้าน */
  shell: {
    switcher: {
      label: "สลับร้าน",
      /** Read out as text, never colour alone (ux-wireframe §4). */
      current: "ร้านที่ใช้อยู่",
      error: "โหลดรายการร้านไม่สำเร็จ",
      retry: "ลองใหม่",
      createShop: "สร้างร้านใหม่",
    },
    nav: {
      orgProfile: "ข้อมูลร้าน",
      members: "สมาชิก",
      security: "ความปลอดภัย",
      logout: "ออกจากระบบ",
    },
    error: "เปิดข้อมูลร้านไม่สำเร็จ",
  },

  /**
   * Role labels. `roleKey` is an OPEN set — api-spec says an unknown value
   * MUST fall back to `roleName` from the server rather than rendering a key
   * or an empty string, which is what `roleLabel` does.
   *
   * ⛔ Never a permission input. This is display only; `capabilities` decides.
   */
  role: {
    owner: "เจ้าของร้าน",
    admin: "ผู้ดูแล",
    staff: "พนักงาน",
  },
} as const;

export function roleLabel(roleKey: string | null | undefined, roleName: string | undefined): string {
  switch (roleKey) {
    case "owner":
      return orgTh.role.owner;
    case "admin":
      return orgTh.role.admin;
    case "staff":
      return orgTh.role.staff;
    default:
      // An F-003 custom role, or a key this build has never heard of.
      return roleName ?? "";
  }
}
