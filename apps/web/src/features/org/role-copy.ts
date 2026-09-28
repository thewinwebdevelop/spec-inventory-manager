/**
 * T-003-W03 — copy กลางของจอบทบาท (F-003).
 *
 * Ownership: `ux`. Every string is copied verbatim from
 * docs/features/F-003/ux-wireframe.md §0.2, §0.3, §E — do not hand-edit;
 * request changes from `ux`.
 *
 * Two things this file deliberately does NOT own:
 *  - §0.4 capability-registry labels (`labelTh`/`descriptionTh`, "เร็ว ๆ นี้",
 *    "มาพร้อมสิทธิ์จัดการ") — D-037 puts those in
 *    `packages/core-domain/src/rbac/registry.ts` (T-003-B03). Reading them
 *    from anywhere else here would be hard-coding a permission label that
 *    only `GET /capabilities` gets to define.
 *  - §0.3 (ค) `resetBlockedReason` — reserved for F-002b; no screen in F-003
 *    calls it (user ตัดสิน 2026-09-27), so it is intentionally absent.
 *
 * Every lookup below has a non-vacuous "value the server has never sent"
 * branch (ux §0.3: "ค่าที่ไม่รู้จัก") — a new reason/code must degrade to a
 * safe, generic sentence instead of a blank banner or a raw key on screen.
 */

// ---------------------------------------------------------------------------
// §0.2 — กติกาการแสดงผลกลาง
// ---------------------------------------------------------------------------

const ROLE_KEY_LABEL: Record<string, string> = {
  owner: "เจ้าของร้าน",
  admin: "ผู้ดูแล",
  staff: "พนักงาน",
};

/**
 * ชื่อบทบาท — ใช้ได้ทุกจุด (`RoleDetail`, `RoleRow`, `MemberRow.roleName`,
 * `lastEdited.by.roleName`): `nameCustomized ? name : (แปล key ?? name)`.
 *
 * `nameCustomized` ที่ไม่มีค่า (server เก่า) ⇒ ผลลัพธ์เดียวกับ `false` — นี่คือ
 * "กติกาเดิม" ที่ ux อ้างถึง (F-002's `roleLabel`), ไม่ใช่กติกาที่สาม.
 */
export function displayRoleName(params: {
  readonly name: string;
  readonly roleKey?: string | null;
  readonly nameCustomized?: boolean | null;
}): string {
  const { name, roleKey, nameCustomized } = params;
  if (nameCustomized) return name;
  if (roleKey && roleKey in ROLE_KEY_LABEL) return ROLE_KEY_LABEL[roleKey];
  return name;
}

/** "สมาชิก {n} คน (รวมคุณ)" · "ยังไม่มีสมาชิกใช้" · " · คำเชิญที่ยังไม่ปิด {m} ใบ" */
export function usageLine(params: {
  readonly activeMembers: number;
  readonly pendingInvitations: number;
  /** `myMembership.roleId === role.id` */
  readonly isViewerRole: boolean;
}): string {
  const { activeMembers, pendingInvitations, isViewerRole } = params;
  const membersPart =
    activeMembers === 0
      ? "ยังไม่มีสมาชิกใช้"
      : `สมาชิก ${activeMembers} คน${isViewerRole ? " (รวมคุณ)" : ""}`;
  const invitesPart =
    pendingInvitations > 0 ? ` · คำเชิญที่ยังไม่ปิด ${pendingInvitations} ใบ` : "";
  return membersPart + invitesPart;
}

/** "23 มิ.ย. 2569, 14:30" (เวลาไทย) — รูปเดียวกับ F-002 (`expiry.ts`). */
const DATE_TIME = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * `kind` is an OPEN set — a value this build has never heard of must still
 * fall through the `default` branch below (ux §0.2 fallback), so it is typed
 * as a plain `string` rather than a closed union.
 */
export interface LastEdited {
  readonly kind: string;
  readonly at: string;
  readonly by?: { readonly roleName?: string | null } | null;
}

/**
 * "ค่าเริ่มต้นของระบบ" · "แก้ไขล่าสุดโดยคุณ · {วันเวลา}" ·
 * "แก้ไขล่าสุดโดยคนในบทบาท "{ชื่อบทบาท}" · {วันเวลา}" ·
 * "แก้ไขล่าสุดโดยอดีตสมาชิก · {วันเวลา}" ·
 * fallback (kind ไม่รู้จัก หรือ member ไม่มี roleName): "แก้ไขล่าสุด · {วันเวลา}"
 */
export function lastEditedLine(lastEdited: LastEdited | null): string {
  if (lastEdited === null) return "ค่าเริ่มต้นของระบบ";
  const at = DATE_TIME.format(new Date(lastEdited.at));
  switch (lastEdited.kind) {
    case "me":
      return `แก้ไขล่าสุดโดยคุณ · ${at}`;
    case "member": {
      const roleName = lastEdited.by?.roleName;
      return roleName ? `แก้ไขล่าสุดโดยคนในบทบาท "${roleName}" · ${at}` : `แก้ไขล่าสุด · ${at}`;
    }
    case "former_member":
      return `แก้ไขล่าสุดโดยอดีตสมาชิก · ${at}`;
    default:
      return `แก้ไขล่าสุด · ${at}`;
  }
}

/** ux R1 · Badge (neutral) ของแถวบทบาท — `isSystem` ชนะ, ไม่มี badge อื่นซ้อน */
export function roleBadgeLabel(params: {
  readonly isSystem: boolean;
  readonly canEditAllowed: boolean;
  readonly canEditReason?: string | null;
}): "ล็อก" | "ดูได้อย่างเดียว" | null {
  if (params.isSystem) return "ล็อก";
  if (
    !params.canEditAllowed &&
    params.canEditReason !== "role_locked" &&
    params.canEditReason !== "writes_disabled"
  ) {
    return "ดูได้อย่างเดียว";
  }
  return null;
}

// ---------------------------------------------------------------------------
// §0.3 (ก) — RoleDetail.viewer.* + RoleDetailListPage.viewer.canCreate
// ---------------------------------------------------------------------------

export interface ReasonCopy {
  readonly title: string;
  readonly body: string;
}

/** ทุก field ที่ไม่มี reason เฉพาะของตัวเอง (ค่าที่ไม่รู้จัก) ตกมาที่นี่ */
const UNKNOWN_REASON_COPY: ReasonCopy = {
  title: "ดูได้อย่างเดียว",
  body: "ตอนนี้คุณทำรายการนี้กับบทบาทนี้ไม่ได้ ถ้าคิดว่าไม่ถูกต้อง ติดต่อเจ้าของร้าน",
};

/**
 * แถบหลักของ R4 (`canEdit.reason`) และเหตุผล disabled ของปุ่ม "สร้างบทบาท" ที่ R1
 * (`viewer.canCreate.reason`, เฉพาะ `writes_disabled` — `role_limit_reached`
 * ใช้ {@link createOrCloneBlockedReasonCopy} แทนเพราะต้องใส่ `limit`).
 */
export function bannerReasonCopy(reason: string | null | undefined): ReasonCopy {
  switch (reason) {
    case "writes_disabled":
      return {
        title: "ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้",
        body: "ระบบกำลังทยอยเปิดให้ทุกร้าน ระหว่างนี้ดูรายละเอียดได้ตามปกติ และยังมอบบทบาทที่มีอยู่ให้สมาชิกได้เหมือนเดิม",
      };
    case "role_locked":
      return {
        title: "บทบาทเจ้าของร้านถูกล็อกไว้",
        body: "แก้ชื่อ แก้สิทธิ์ หรือลบไม่ได้ เพื่อให้ร้านมีคนที่ทำได้ทุกอย่างอยู่เสมอ — ถ้าต้องการบทบาทที่ทำได้เกือบทุกอย่าง ให้สร้างบทบาทใหม่แล้วติ๊กสิทธิ์ที่ต้องการ",
      };
    case "exceeds_your_permissions":
      return {
        title: "ดูได้อย่างเดียว — บทบาทนี้มีสิทธิ์ที่คุณไม่มี",
        body: "คุณแก้ ลบ หรือทำสำเนาบทบาทที่มีสิทธิ์เกินของตัวเองไม่ได้ ถ้าต้องการเปลี่ยน ให้เจ้าของร้านแก้ให้",
      };
    case "in_use_requires_manage_members":
      return {
        title: "ดูได้อย่างเดียว — มีสมาชิกคนอื่นใช้บทบาทนี้อยู่",
        body: 'การแก้หรือลบบทบาทที่คนอื่นใช้อยู่ ต้องมีสิทธิ์ "จัดการสมาชิกและคำเชิญ" ด้วย ให้เจ้าของร้านแก้ หรือทำสำเนาไปปรับเป็นบทบาทใหม่',
      };
    case "equal_permissions_in_use":
      return {
        title: "ดูได้อย่างเดียว — มีคนที่สิทธิ์เท่าคุณใช้บทบาทนี้อยู่",
        body: "บทบาทนี้มีสิทธิ์เท่ากับของคุณ และมีสมาชิกคนอื่นใช้อยู่ จึงต้องให้เจ้าของร้านเป็นคนแก้หรือลบ — หรือทำสำเนาไปปรับเป็นบทบาทใหม่",
      };
    default:
      return UNKNOWN_REASON_COPY;
  }
}

/**
 * เหตุผลลบแยกใต้ปุ่ม "ลบบทบาทนี้" (R3/R4) — แสดงเฉพาะเมื่อต่างจาก
 * `canEdit.reason` (ux §0.3 "ลำดับบนจอ R4"; เปรียบเทียบเป็นหน้าที่ของผู้เรียก).
 * `usage` ต้องมาจาก {@link usageLine} ของบทบาทเดียวกัน (ตัดส่วนที่เป็น 0 แล้ว).
 */
export function deleteBlockedReasonCopy(
  reason: string | null | undefined,
  usage: string,
): ReasonCopy {
  switch (reason) {
    case "in_use":
      return {
        title: "ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่",
        body: `${usage} · ย้ายสมาชิกไปบทบาทอื่นและยกเลิกคำเชิญเหล่านี้ก่อน แล้วค่อยลบ`,
      };
    case "history_limit_reached":
      return {
        title: "ลบเพิ่มไม่ได้",
        body: "ร้านนี้ลบบทบาทไปครบจำนวนที่ระบบเก็บประวัติได้แล้ว กรุณาติดต่อทีมงาน OmniStock",
      };
    default:
      return UNKNOWN_REASON_COPY;
  }
}

/**
 * เหตุผล disabled ใต้ปุ่ม "สร้างบทบาท" (`viewer.canCreate`) / "ทำสำเนาเป็นบทบาทใหม่"
 * (`canClone`) เมื่อ `reason=role_limit_reached`. `owner_role` (canClone เท่านั้น)
 * = **ไม่แสดงปุ่ม** เลย (AC-3.2) จึงคืน `null` ให้ผู้เรียกซ่อนปุ่ม ไม่ใช่ข้อความ.
 */
export function createOrCloneBlockedReasonCopy(
  reason: string | null | undefined,
  limit?: number | null,
): ReasonCopy | null {
  if (reason === "owner_role") return null;
  if (reason === "role_limit_reached") {
    return {
      // ux table §0.3 (ก) row "role_limit_reached": หัวข้อ = "—" (ไม่มี)
      title: "",
      body:
        typeof limit === "number"
          ? `ร้านนี้มีบทบาทครบ ${limit} บทบาทแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้`
          : "ร้านนี้มีบทบาทครบจำนวนสูงสุดแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้",
    };
  }
  return UNKNOWN_REASON_COPY;
}

// ---------------------------------------------------------------------------
// §0.3 (ข) — แถวสมาชิก / คำเชิญ / ตัวเลือกบทบาท (route ที่ ship)
// ---------------------------------------------------------------------------

/** `RoleRow.assignBlockedReason` — ตัวเลือกบทบาทใน dialog เชิญ / เปลี่ยนบทบาท (R8) */
export function assignBlockedReasonCopy(reason: string | null | undefined): string {
  switch (reason) {
    case "owner_only":
      return "เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้";
    case "exceeds_your_permissions":
      return "บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงมอบให้คนอื่นไม่ได้";
    default:
      return "คุณมอบบทบาทนี้ไม่ได้";
  }
}

/** `MemberRow.manageBlockedReason` — แถวสมาชิกที่แตะไม่ได้ (R7/R8) */
export function memberManageBlockedReasonCopy(reason: string | null | undefined): string {
  switch (reason) {
    case "owner_only":
      return "เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนบทบาทหรือถอดเจ้าของร้านคนอื่นได้";
    case "equal_permissions":
      return "คนนี้มีสิทธิ์เท่ากับคุณ — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก";
    case "exceeds_your_permissions":
      return "คนนี้มีสิทธิ์บางอย่างที่คุณไม่มี — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก";
    default:
      return "คุณจัดการสมาชิกคนนี้ไม่ได้ — ให้เจ้าของร้านช่วย";
  }
}

/** `Invitation.manageBlockedReason` — แถวคำเชิญที่ยกเลิก/ออกลิงก์ใหม่ไม่ได้ (R7/R9) */
export function invitationManageBlockedReasonCopy(reason: string | null | undefined): string {
  switch (reason) {
    case "owner_only":
      return "เฉพาะเจ้าของร้านเท่านั้นที่ยกเลิกหรือออกลิงก์ใหม่ให้คำเชิญเจ้าของร้านได้";
    case "exceeds_your_permissions":
      return "คำเชิญนี้ให้บทบาทที่มีสิทธิ์ที่คุณไม่มี — ให้เจ้าของร้านยกเลิกหรือออกลิงก์ใหม่";
    default:
      return "คุณจัดการคำเชิญนี้ไม่ได้ — ให้เจ้าของร้านช่วย";
  }
}

// ---------------------------------------------------------------------------
// §E — Error code → copy (ใหม่ + ที่พฤติกรรมเปลี่ยน)
// ---------------------------------------------------------------------------

/** R3/R4/R5 — ฟอร์มบทบาท (ErrorBanner เว้นแต่ระบุ) */
export function roleFormErrorMessage(
  code: string,
  opts: { readonly limit?: number | null; readonly action?: "save" | "delete" } = {},
): string {
  switch (code) {
    case "VALIDATION_FAILED_NAME":
      return "ชื่อนี้มีอักขระที่ใช้ไม่ได้ (เช่น อักขระที่มองไม่เห็นซึ่งติดมาจากการคัดลอก) ลองพิมพ์ชื่อใหม่เอง";
    case "ROLE_NAME_TAKEN":
      return "ชื่อนี้ใช้ไม่ได้ เพราะซ้ำกับบทบาทที่มีอยู่แล้ว (รวมชื่อ เจ้าของร้าน ผู้ดูแล พนักงาน) ลองตั้งชื่ออื่น";
    case "ROLE_EMPTY":
      return "เลือกสิทธิ์อย่างน้อย 1 อย่าง";
    case "UNKNOWN_CAPABILITY":
      return "สิทธิ์บางรายการใช้ไม่ได้แล้ว ระบบโหลดรายการสิทธิ์ล่าสุดให้แล้ว ตรวจดูแล้วบันทึกอีกครั้ง";
    case "FULL_ACCESS_RESERVED":
      return 'สิทธิ์ "ทำได้ทุกอย่าง" มีได้เฉพาะบทบาทเจ้าของร้าน';
    case "ROLE_LIMIT_REACHED":
      return typeof opts.limit === "number"
        ? `ร้านนี้มีบทบาทครบ ${opts.limit} บทบาทแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้`
        : "ร้านนี้มีบทบาทครบจำนวนสูงสุดแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้";
    case "ROLE_HISTORY_LIMIT_REACHED":
      return typeof opts.limit === "number"
        ? `ลบเพิ่มไม่ได้ — ร้านนี้ลบบทบาทไปครบ ${opts.limit} ครั้งที่ระบบเก็บประวัติได้แล้ว กรุณาติดต่อทีมงาน OmniStock`
        : "ลบเพิ่มไม่ได้ — ร้านนี้ลบบทบาทไปครบจำนวนที่ระบบเก็บประวัติได้แล้ว กรุณาติดต่อทีมงาน OmniStock";
    case "ROLE_LOCKED":
      return bannerReasonCopy("role_locked").body;
    case "ROLE_EXCEEDS_ACTOR":
      return "คุณให้สิทธิ์ที่ตัวเองไม่มีไม่ได้ สิทธิ์ของคุณอาจเพิ่งถูกเปลี่ยน ระบบโหลดข้อมูลล่าสุดให้แล้ว";
    case "TARGET_NOT_BELOW_ACTOR":
      return bannerReasonCopy("equal_permissions_in_use").body;
    case "ROLE_HELD_REQUIRES_MANAGE_MEMBERS":
      return bannerReasonCopy("in_use_requires_manage_members").body;
    case "ROLE_WRITES_DISABLED":
      return bannerReasonCopy("writes_disabled").body;
    case "FORBIDDEN":
      return "หน้านี้สำหรับคนที่จัดการบทบาทได้";
    case "NOT_FOUND":
      return "ไม่พบบทบาทนี้ · บทบาทนี้อาจถูกลบไปแล้ว";
    case "CONFLICT":
      return "ร้านนี้กำลังมีการแก้ไขอื่นอยู่ ลองใหม่อีกครั้งในไม่กี่วินาที";
    default:
      return opts.action === "delete"
        ? "ลบบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
        : "บันทึกบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  }
}

/** R7/R8/R9 — เปลี่ยนบทบาท / เชิญ / ออกลิงก์ใหม่ / ยกเลิกคำเชิญ (ErrorBanner ใน dialog เดิม) */
export function memberActionErrorMessage(
  code: string,
  context: "changeRole" | "invite" | "reissue" | "cancel",
): string {
  if (code === "TARGET_NOT_BELOW_ACTOR") {
    return "คุณจัดการสมาชิกคนนี้ไม่ได้ — ให้เจ้าของร้านช่วย";
  }
  if (code === "ROLE_EXCEEDS_ACTOR") {
    if (context === "reissue") {
      return "คำเชิญนี้ให้บทบาทที่มีสิทธิ์ที่คุณไม่มี จึงออกลิงก์ใหม่ไม่ได้ — ให้เจ้าของร้านทำ";
    }
    if (context === "cancel") {
      return "คำเชิญนี้ให้บทบาทที่มีสิทธิ์ที่คุณไม่มี จึงยกเลิกไม่ได้ — ให้เจ้าของร้านทำ";
    }
    return "บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงมอบให้คนอื่นไม่ได้ เลือกบทบาทอื่น หรือให้เจ้าของร้านทำ";
  }
  if (code === "FORBIDDEN" && context === "cancel") {
    return "เฉพาะเจ้าของร้านเท่านั้นที่ยกเลิกคำเชิญเจ้าของร้านได้";
  }
  if (code === "ROLE_INVALID" && context === "invite") {
    return "บทบาทที่เลือกใช้ไม่ได้แล้ว กรุณาเลือกใหม่อีกครั้ง";
  }
  return "ทำรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}
