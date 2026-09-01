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
       * ⚠️ COPY GAP — `ux` owns Thai copy and neither ux-wireframe §4 nor ui.md
       * §2.2 gives wording for the §8.2 drawer toggle, because the drawer had
       * never been built. These two are the plainest labels that say what the
       * control does; they are accessible NAMES on an icon-only button, so
       * shipping it unlabelled was not an option. Raise with ux to confirm or
       * replace.
       */
      showMenu: "เปิดเมนู",
      hideMenu: "ปิดเมนู",
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
  showHistoricInvitations: "ดูคำเชิญที่หมดอายุ/ยกเลิกแล้ว",
  showRevokedMembers: "แสดงสมาชิกที่ถูกถอดออกแล้ว",
  /**
   * ⚠️ COPY GAP (2026-09-01) — both filters were ONE-WAY. The button unmounted
   * itself on click and there was no way back to the default view, so a person
   * who pressed either one was stuck with it for the rest of the session.
   * ux-wireframe §7 gives the "show more" wording and no "show less", because
   * the toggle was never built as a toggle. Raise with ux to confirm.
   */
  showPendingInvitationsOnly: "ดูเฉพาะคำเชิญที่รอตอบรับ",
  showActiveMembersOnly: "ดูเฉพาะสมาชิกที่ใช้งานอยู่",
  /** Headings follow the FILTER — the old one said "รอตอบรับ (n)" over a list
   *  that included cancelled and expired rows once the filter was widened. */
  allInvitationsSection: (n: number) => `คำเชิญทั้งหมด (${n})`,
  allMembersSection: (n: number) => `สมาชิกทั้งหมด (${n})`,
  /** ⚠️ COPY GAP — with the widened filter and still nothing to show, the
   *  screen previously rendered NOTHING at all: the section is hidden when the
   *  list is empty, and the button had removed itself. */
  emptyHistoricInvitations: "ไม่มีคำเชิญที่หมดอายุหรือถูกยกเลิก",
  emptyRevokedMembers: "ไม่มีสมาชิกที่ถูกถอดออก",
  you: "(คุณ)",
  statusActive: "ใช้งานอยู่",
  statusRevoked: "ถูกถอดแล้ว",
  reissue: "ออกลิงก์ใหม่",
  cancelInvitation: "ยกเลิกคำเชิญ",
  inviteAgain: "เชิญใหม่อีกครั้ง",
  changeRole: "เปลี่ยนสิทธิ์",
  removeFromOrg: "ถอดออกจากร้าน",
  leaveOrg: "ออกจากร้านนี้",
  linkValidUntil: (when: string) => `ลิงก์ใช้ได้ถึง ${when}`,
  /** §7 — C-1 explained rather than a disabled item. */
  ownerOnlyNotice: "เฉพาะเจ้าของร้านเท่านั้นที่แก้สิทธิ์ของเจ้าของร้านคนอื่นได้",
  /** §7 (D-028/I-7) — a soft flag, never an accusation. */
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
