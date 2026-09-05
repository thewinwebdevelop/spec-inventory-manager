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
      /**
       * ✓ux (2026-09-05) — CONFIRMED as written. These are the accessible
       * names of two icon-only buttons (`icon.menu` / `icon.close`), and
       * design-system §1.6.1 requires a Thai `aria-label` on exactly those.
       * Kept verb-first and two words because a screen reader reads the name
       * on its own, out of context: "เปิดเมนู" says what pressing does, where
       * a noun ("เมนู") only says what the thing is.
       * Now recorded in ux-wireframe §4 so the next drawer does not re-ask.
       */
      showMenu: "เปิดเมนู",
      hideMenu: "ปิดเมนู",
      /**
       * ✓ux (2026-09-05) — the `aria-label` of the nav landmark itself, in
       * both the drawer and the permanent sidebar. It was a bare Thai string
       * inside `AppShell.tsx`; copy belongs here (design-system §3: "เจ้าของ
       * copy = ux ... frontend แค่ประกอบ").
       * @frontend swap the two hardcoded `aria-label="เมนูของร้าน"` for this.
       */
      menuLabel: "เมนูของร้าน",
      orgProfile: "ข้อมูลร้าน",
      members: "สมาชิก",
      security: "ความปลอดภัย",
      logout: "ออกจากระบบ",
      /**
       * ✓ux (2026-09-05, B-16) — CONFIRMED as written. It is the right shape
       * for this failure: name the action that did not happen, then the one
       * move that helps. Deriving it from `auth.sessions.error.logoutAllFailed`
       * was also the right instinct — the two sentences now differ only in
       * scope, which is exactly how much the two actions differ.
       * ⛔ Do NOT fall back to `errorsTh.server` here: this is a deliberate
       * press, and the person needs to know their session is still open.
       * Recorded in ux-wireframe §4.
       */
      logoutFailed: "ออกจากระบบไม่สำเร็จ ลองใหม่อีกครั้ง",
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

/**
 * S4/S5 copy (ux-wireframe §5–§6). Same rule: verbatim from `ux`.
 *
 * The privacy lines are not decoration — §5 requires the user to be told
 * BEFORE pressing that a reveal is recorded ("บอกก่อนกด ไม่ใช่แอบเก็บ"), and
 * §6 requires the personal-ID warning to be visible while typing one.
 */
export const orgProfileTh = {
  title: "ข้อมูลร้าน",
  onboarding: {
    title: "เริ่มต้นใช้งาน",
    inviteTeam: { text: "ชวนทีมงานเข้าร้าน", cta: "เชิญสมาชิก" },
    declareTax: { text: "ประกาศข้อมูลผู้เสียภาษี เพื่อออกใบกำกับภาษีได้", cta: "กรอกข้อมูล" },
    backupOwner: {
      text: "ตั้งเจ้าของร้านสำรองไว้อีก 1 คน เผื่อวันหนึ่งคุณเข้าระบบไม่ได้",
      cta: "เชิญเจ้าของร้าน",
    },
  },
  fields: {
    name: "ชื่อร้าน",
    localeLabel: "เวลา/สกุลเงิน",
    localeValue: "เวลาไทย · บาท (฿)",
    team: "ทีมงาน",
    teamValue: (members: number, pending: number) =>
      pending > 0 ? `สมาชิก ${members} คน · คำเชิญค้าง ${pending} ใบ` : `สมาชิก ${members} คน`,
    edit: "แก้ไข",
  },
  rename: {
    title: "แก้ไขชื่อร้าน",
    save: "บันทึก",
    cancel: "ยกเลิก",
    successToast: "บันทึกชื่อร้านแล้ว",
    invalid: "กรอกชื่อร้าน (ไม่เกิน 120 ตัวอักษร)",
  },
  tax: {
    title: "ข้อมูลผู้เสียภาษี",
    entityTypeLabel: "ประเภท",
    entity: { personal: "บุคคลธรรมดา", company: "นิติบุคคล" },
    taxIdLabel: "เลขผู้เสียภาษี",
    vatLabel: "VAT",
    vatYes: "จดทะเบียน VAT",
    vatNo: "ไม่ได้จดทะเบียน VAT",
    branchLabel: "รหัสสาขา",
    branchHeadOffice: "00000 (สำนักงานใหญ่)",
    reveal: "แสดงเลขเต็ม",
    hide: "ซ่อนเลข",
    revealLoading: "กำลังขอเลข...",
    /** §5 — shown BEFORE the press, because the press is audited. */
    revealNotice: "การกดดูเลขเต็มถูกบันทึกไว้เพื่อความปลอดภัยของร้าน",
    undeclaredCanEdit: "ยังไม่ได้ประกาศข้อมูลผู้เสียภาษี — ตอนนี้ร้านนี้ยังออกใบกำกับภาษีไม่ได้",
    undeclaredCta: "กรอกข้อมูลผู้เสียภาษี",
    undeclaredReadOnly: "ร้านนี้ยังไม่ได้ประกาศข้อมูลผู้เสียภาษี",
    declaredReadOnly: (vat: boolean | null) =>
      vat === null
        ? "ร้านนี้ประกาศข้อมูลผู้เสียภาษีแล้ว"
        : `ร้านนี้ประกาศข้อมูลผู้เสียภาษีแล้ว · ${vat ? "จดทะเบียน VAT" : "ไม่ได้จดทะเบียน VAT"}`,
    declaredReadOnlyHint: "รายละเอียดเปิดให้เฉพาะผู้ที่ดูแลข้อมูลร้าน",
    revealError: {
      throttledHint: "ระหว่างนี้ยังแก้ไขข้อมูลอื่นของร้านได้ตามปกติ",
      notFoundToast: "ร้านนี้ยังไม่ได้ประกาศข้อมูลผู้เสียภาษี",
      generic: "ขอดูเลขเต็มไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    },
  },
  leaveOrg: "ออกจากร้านนี้",
  error: "เปิดข้อมูลร้านไม่สำเร็จ",
} as const;

/** S5 — the tax form (ux-wireframe §6). */
export const taxFormTh = {
  title: "ข้อมูลผู้เสียภาษี",
  entityLabel: "ประเภทผู้เสียภาษี",
  personal: "บุคคลธรรมดา",
  company: "นิติบุคคล",
  /** §6 — visible while a national ID is being typed. */
  personalHelper:
    "สำหรับบุคคลธรรมดา เลข 13 หลักนี้คือเลขบัตรประชาชนของเจ้าของกิจการ — ระบบเปิดให้เห็นเฉพาะผู้ที่ดูแลข้อมูลร้าน",
  taxIdLabel: "เลขประจำตัวผู้เสียภาษี (13 หลัก)",
  vatLabel: "จดทะเบียน VAT",
  vatYes: "จดทะเบียน VAT",
  vatNo: "ไม่ได้จดทะเบียน",
  branchLabel: "รหัสสาขา (ถ้ามี)",
  branchHelper: "เว้นว่าง = สำนักงานใหญ่ (00000)",
  privacyNote: "ข้อมูลนี้เปิดให้เห็นเฉพาะผู้ที่ดูแลข้อมูลร้าน",
  save: "บันทึก",
  saveLoading: "กำลังบันทึก...",
  cancel: "ยกเลิก",
  successToast: "บันทึกข้อมูลผู้เสียภาษีแล้ว — ร้านนี้ออกใบกำกับภาษีได้แล้ว",
  /** §6 — the form must stay usable when the old number cannot be fetched. */
  revealUnavailable:
    "ตอนนี้ระบบยังไม่ให้ดูเลขเดิม — ถ้าต้องการบันทึกข้อมูลชุดนี้ ให้พิมพ์เลขผู้เสียภาษี 13 หลักใหม่อีกครั้ง",
  overwriteConfirm: {
    title: "เปลี่ยนข้อมูลผู้เสียภาษีของร้านนี้?",
    body: "ร้าน 1 ร้านมีข้อมูลผู้เสียภาษีได้ชุดเดียว ข้อมูลใหม่จะแทนที่ของเดิม",
    confirm: "บันทึกทับ",
    cancel: "ยกเลิก",
  },
  error: {
    taxId: "เลขผู้เสียภาษีไม่ถูกต้อง — ต้องเป็นตัวเลข 13 หลัก และตรวจสอบเลขหลักสุดท้ายอีกครั้ง",
    branchCode: "รหัสสาขาต้องเป็นตัวเลข 5 หลัก",
    forbidden: "คุณไม่มีสิทธิ์แก้ไขข้อมูลร้าน ติดต่อเจ้าของร้านให้เปิดสิทธิ์ให้",
    generic: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  },
} as const;

/** S6/S7/S8 copy (ux-wireframe §7–§9). Same rule: verbatim from `ux`. */
export const membersTh = {
  title: "สมาชิก",
  invite: "เชิญสมาชิก",
  pendingSection: (n: number) => `คำเชิญที่รอตอบรับ (${n})`,
  membersSection: (n: number) => `สมาชิกในร้าน (${n})`,
  /**
   * ★ ux CHANGED (2026-09-05, manual pass M-04) — was
   * "ดูคำเชิญที่หมดอายุ/ยกเลิกแล้ว", which named two of the four things behind
   * it. The button opens `?status=all`, and `all` includes invitations that
   * were ACCEPTED — the only rows that can carry
   * `acceptedAfterInviteFlag`. So the one security warning in F-002 sat behind
   * a button whose label gave the inviter no reason to press it: nobody who
   * just added a colleague goes looking under "expired/cancelled".
   * The label now promises what is actually in there, and matches the heading
   * it leads to (`allInvitationsSection` = "คำเชิญทั้งหมด"): recognition, not
   * recall. ux-wireframe §7.
   */
  showHistoricInvitations: "ดูคำเชิญทั้งหมด รวมที่รับแล้ว",
  showRevokedMembers: "แสดงสมาชิกที่ถูกถอดออกแล้ว",
  /**
   * ✓ux (2026-09-05) — the way BACK from each widened filter. Both filters
   * used to be one-way: the button unmounted itself on click, so a person who
   * pressed either one was stuck with it for the rest of the session.
   *
   * `showActiveMembersOnly` now carries ux-wireframe §7's own reverse label
   * ("ซ่อนสมาชิกที่ถูกถอดออกแล้ว"), which was in the copy table the whole
   * time — a mirror pair (แสดง ⇄ ซ่อน) tells the reader exactly which rows
   * are about to disappear, where "ดูเฉพาะสมาชิกที่ใช้งานอยู่" made them
   * work it out. The invitation pair is not a mirror on purpose: its forward
   * label WIDENS to everything, so the way back names the narrowing.
   *
   * @frontend the key name still says `showActiveMembersOnly`; rename it to
   * `hideRevokedMembers` next time `MembersScreen.tsx` is open (left alone
   * here only to avoid touching a component mid-flight).
   */
  showPendingInvitationsOnly: "ดูเฉพาะคำเชิญที่รอตอบรับ",
  showActiveMembersOnly: "ซ่อนสมาชิกที่ถูกถอดออกแล้ว",
  /** Headings follow the FILTER — the old one said "รอตอบรับ (n)" over a list
   *  that included cancelled and expired rows once the filter was widened. */
  allInvitationsSection: (n: number) => `คำเชิญทั้งหมด (${n})`,
  allMembersSection: (n: number) => `สมาชิกทั้งหมด (${n})`,
  /**
   * ✓ux (2026-09-05) — the answer to a deliberate press that reveals nothing.
   * Without it the screen rendered NOTHING at all: the section is hidden when
   * the list is empty, and the button had removed itself.
   *
   * ★ CHANGED: `emptyHistoricInvitations` is shown when the filter is `all`
   * and the list is still empty — which means this shop has never had ANY
   * invitation, not merely none expired. The old sentence described a
   * narrower filter than the one that had just run, so it read as though
   * something else might be hiding elsewhere.
   */
  emptyHistoricInvitations: "ร้านนี้ยังไม่เคยมีคำเชิญ",
  emptyRevokedMembers: "ไม่มีสมาชิกที่ถูกถอดออก",
  you: "(คุณ)",
  statusActive: "ใช้งานอยู่",
  statusRevoked: "ถูกถอดแล้ว",
  reissue: "ออกลิงก์ใหม่",
  cancelInvitation: "ยกเลิกคำเชิญ",
  /**
   * ✓ux (2026-09-05) — CONFIRMED, still wanted, still unbuilt (manual pass
   * M-04). ux-wireframe §7 now carries the full spec: the button belongs on
   * invitation rows whose `status` is `expired` or `cancelled` ONLY — never
   * on `accepted`, where "invite them again" would be a lie about somebody
   * who is already in the shop — and it opens S7 pre-filled with that row's
   * email + role. No new server field is needed; the two ways it can be stale
   * (they joined meanwhile / a new invitation is already pending) already have
   * copy in `inviteFormTh.error.alreadyMember` / `.pending`.
   */
  inviteAgain: "เชิญใหม่อีกครั้ง",
  changeRole: "เปลี่ยนสิทธิ์",
  removeFromOrg: "ถอดออกจากร้าน",
  leaveOrg: "ออกจากร้านนี้",
  /**
   * ★ ux CHANGED (2026-09-05, manual pass M-06 nit) — the `409 LAST_OWNER`
   * refusal inside "ออกจากร้านนี้".
   *
   * `LEAVE_ORG_DIALOG_COPY.goToMembers` = "ไปหน้าสมาชิก" is correct only when
   * the dialog was opened from S4 ("ข้อมูลร้าน"). Opened from the members
   * screen — where the same dialog also lives (§10.3 entry ข) — it links to
   * the page the reader is standing on, so pressing it does nothing. A CTA
   * that visibly does nothing is worse than no CTA: it reads as "the app is
   * broken" at the exact moment the person was already told "no".
   *
   * The fix names the OUTCOME instead of the destination, and the branch that
   * cannot navigate says which control to reach for instead.
   *
   * @frontend replace `goToMembers` with these two (ux-wireframe §10.3):
   *   - not on the members screen → `Link` labelled `leaveLastOwnerCta`
   *   - already on it            → plain sentence `leaveLastOwnerHere`, no link
   */
  leaveLastOwnerCta: "ไปตั้งเจ้าของร้านคนใหม่",
  leaveLastOwnerHere:
    "เลือกคนที่คุณไว้ใจในรายชื่อด้านล่าง แล้วกด \"เปลี่ยนสิทธิ์\" เป็นเจ้าของร้าน",
  linkValidUntil: (when: string) => `ลิงก์ใช้ได้ถึง ${when}`,
  /** §7 — C-1 explained rather than a disabled item. */
  ownerOnlyNotice: "เฉพาะเจ้าของร้านเท่านั้นที่แก้สิทธิ์ของเจ้าของร้านคนอื่นได้",
  /**
   * §7 (D-028/I-7) — a soft flag, never an accusation.
   *
   * ⚠️ ux 2026-09-05: the WORDING passed the manual pass (M-04); its PLACEMENT
   * did not. It can only appear on an accepted invitation row, i.e. only after
   * the reader widens the filter, and no server field lets the members list
   * carry the same flag on the person's own row. Renaming the filter button
   * (above) is the part that can ship today; putting the flag where the
   * inviter already looks needs data F-002's contract does not have — escalated
   * to @backend-api / @product, recorded in ux-wireframe §7.
   */
  acceptedAfterInviteFlag:
    "บัญชีที่กดรับถูกสร้างขึ้นหลังจากออกลิงก์ ตรวจสอบว่าเป็นคนที่คุณตั้งใจเชิญ",
  empty: {
    members: "ยังไม่มีสมาชิกคนอื่นในร้านนี้",
  },
  error: "โหลดรายชื่อสมาชิกไม่สำเร็จ",
} as const;

/** S7 — the invite dialog. */
export const inviteFormTh = {
  title: "เชิญสมาชิก",
  emailLabel: "อีเมลของคนที่จะเชิญ",
  emailPlaceholder: "เช่น malee@shop.com",
  roleLabel: "สิทธิ์ในร้านนี้",
  /**
   * ★ B-9 — verbatim from mobile's `inviteOwnerDisabledHelper` (§8), not a new
   * sentence. The two platforms are answering the same question and had no
   * business answering it in different words; web could not ask it at all
   * before the server published `grantsOwnership`.
   */
  ownerOnlyHelper: "เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้",
  submit: "สร้างลิงก์คำเชิญ",
  submitLoading: "กำลังสร้างลิงก์...",
  cancel: "ยกเลิก",
  error: {
    email: "รูปแบบอีเมลไม่ถูกต้อง",
    role: "เลือกสิทธิ์ที่จะให้",
    alreadyMember: "คนนี้เป็นสมาชิกของร้านอยู่แล้ว",
    /** D-027 — the error that must offer a next step, not a dead end. */
    pending: "มีคำเชิญของอีเมลนี้ค้างอยู่แล้ว — ออกลิงก์ใหม่หรือยกเลิกคำเชิญเดิมก่อน",
    limitReached: "คำเชิญที่รอตอบรับเต็มแล้ว ยกเลิกใบที่ไม่ใช้ก่อนแล้วลองใหม่",
    generic: "สร้างคำเชิญไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  },
} as const;

/** S8 — the one-time link panel (§9.1, D-027). */
export const copyLinkTh = {
  title: "ลิงก์คำเชิญพร้อมแล้ว",
  description: (email: string) =>
    `ส่งลิงก์นี้ให้ ${email} ทางแชต (เช่น LINE) — ระบบไม่ได้ส่งอีเมลให้อัตโนมัติ`,
  copy: "คัดลอกลิงก์",
  copied: "คัดลอกแล้ว",
  copiedToast: "คัดลอกลิงก์แล้ว",
  /** §9.1 — the ONE guard rail, in warning tone, above the close button. */
  onceOnly:
    "ลิงก์นี้แสดงครั้งเดียว — ปิดหน้านี้แล้วเปิดดูซ้ำไม่ได้ ถ้าทำลิงก์หาย กด \"ออกลิงก์ใหม่\" ที่รายการคำเชิญ",
  close: "เสร็จแล้ว",
  copyFailed: "คัดลอกอัตโนมัติไม่สำเร็จ — กดค้างที่ลิงก์เพื่อคัดลอกเอง",
} as const;

/**
 * §9.2/§9.3 — the two confirmations, verbatim from ux.
 *
 * ★ T-002-Q7. Both were MISSING: the buttons fired their mutation on the first
 * press. Reissuing is the one action in F-002 that breaks something already in
 * somebody else's hands — the link the inviter has sent over LINE stops working
 * the instant the new one is minted (D-027) — and the reader had no way to know
 * that before pressing. The Contract summary's item 4 says "ยืนยันก่อนเสมอ";
 * Track 2's most valuable flow is precisely "does the user understand that the
 * old link dies", and with no dialog the answer could only ever be no.
 */
export const invitationConfirmTh = {
  reissue: {
    title: "ออกลิงก์ใหม่?",
    body: (email: string, roleName: string) =>
      `ลิงก์เดิมที่ส่งไปแล้วจะใช้ไม่ได้ทันที ถ้าคุณส่งลิงก์เดิมให้ใครไว้ ต้องส่งลิงก์ใหม่ให้เขาแทน

` +
      `อีเมลและสิทธิ์ของคำเชิญไม่เปลี่ยน (${email} · ${roleName})`,
    cancel: "ยกเลิก",
    confirm: "ออกลิงก์ใหม่",
    /** §9.2 — said again after the fact, because it has already happened. */
    doneToast: "ออกลิงก์ใหม่แล้ว ลิงก์เดิมใช้ไม่ได้แล้ว",
  },
  cancelInvitation: {
    title: "ยกเลิกคำเชิญนี้?",
    body: (email: string, roleName: string) =>
      `ลิงก์ที่ส่งไปแล้วจะใช้ไม่ได้ทันที\n${email} · ${roleName}`,
    /** §9.3 — the safe choice is the one that does nothing, and it is worded
     *  so that reading only the buttons cannot pick the wrong one. */
    cancel: "ไม่ยกเลิก",
    confirm: "ยกเลิกคำเชิญ",
    doneToast: "ยกเลิกคำเชิญแล้ว",
  },
} as const;
