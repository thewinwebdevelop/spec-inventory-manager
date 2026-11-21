/**
 * T-003-W05 — static copy of R1 (รายการบทบาท) and R2 (เลือกบทบาทต้นแบบ).
 *
 * Ownership: `ux`. Every string is copied verbatim from
 * docs/features/F-003/ux-wireframe.md R1 / R2 — do not hand-edit; request
 * changes from `ux`.
 *
 * What is NOT here: reason→copy, name display, usage / last-edited lines
 * (`../role-copy.ts`, ux §0.2–§0.3) and capability labels (they come from
 * `GET /capabilities`, D-037 — never typed on the client).
 */
export const rolesTh = {
  title: "บทบาทและสิทธิ์",
  intro: "บทบาทคือชุดสิทธิ์ที่มอบให้สมาชิก เช่น พนักงานแพ็คของทำอะไรได้บ้าง",
  introMembers: "มอบบทบาทให้แต่ละคนได้ที่หน้าสมาชิก",
  goMembers: "ไปหน้าสมาชิก",
  counter: (n: number, limit: number) => `ใช้ไป ${n} จาก ${limit} บทบาท`,
  create: "สร้างบทบาท",
  loadingLabel: "กำลังโหลด",
  error: {
    title: "โหลดรายการบทบาทไม่สำเร็จ",
    body: "ตรวจการเชื่อมต่อแล้วลองใหม่",
    retry: "ลองใหม่",
  },
  template: {
    title: "สร้างบทบาทใหม่",
    lead: "เริ่มจากบทบาทที่ใกล้เคียงที่สุด แล้วค่อยปรับสิทธิ์",
    legend: "เลือกบทบาทต้นแบบ",
    blankLabel: "เริ่มจากว่าง",
    blankDescription: "ไม่ติ๊กสิทธิ์ใดไว้ก่อน เลือกเองทีละข้อ",
    cloneExceeds: "บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงใช้เป็นต้นแบบไม่ได้",
    cloneUnknown: "ใช้บทบาทนี้เป็นต้นแบบไม่ได้",
    ownerNote: "บทบาทเจ้าของร้านใช้เป็นต้นแบบไม่ได้ เพราะสิทธิ์ทำได้ทุกอย่างมีได้เฉพาะเจ้าของร้าน",
    next: "ถัดไป",
    cancel: "ยกเลิก",
    /** "{n} สิทธิ์: {ป้าย 3 ตัวแรก}{…}" — labels come from the catalog. */
    description: (n: number, labels: readonly string[], truncated: boolean) =>
      labels.length === 0
        ? `${n} สิทธิ์`
        : `${n} สิทธิ์: ${labels.join(", ")}${truncated ? "…" : ""}`,
  },
} as const;

/**
 * T-003-W06 — static copy of R3 (ฟอร์มบทบาท: สร้าง / ทำสำเนา / แก้) and the
 * leave prompt. Verbatim from docs/features/F-003/ux-wireframe.md R3 + §0.4
 * ("ข้อความฝั่ง client" — D-037: capability labels/descriptions themselves come
 * from `GET /capabilities`, never from here). Owner: `ux`.
 */
export const roleFormTh = {
  back: "บทบาทและสิทธิ์",
  createTitle: "สร้างบทบาทใหม่",
  cloneFrom: (name: string) => `เริ่มจากสำเนาของ "${name}"`,
  cloneUnavailable: "ใช้บทบาทนี้เป็นต้นแบบไม่ได้แล้ว เริ่มจากว่างแทน",
  name: {
    label: "ชื่อบทบาท",
    placeholder: "เช่น พนักงานแพ็คของ",
    helperCreate: "ตั้งตามหน้าที่ในร้าน เช่น พนักงานแพ็คของ แอดมินตอบแชท",
    helperEdit: "เปลี่ยนชื่อได้ ชื่อใหม่จะแสดงแทนชื่อเดิมทุกหน้าจอ",
    counter: (n: number, max: number) => `${n}/${max}`,
    empty: "กรอกชื่อบทบาท",
    tooLong: "ชื่อบทบาทยาวได้ไม่เกิน 50 ตัวอักษร",
  },
  checklist: {
    title: "สิทธิ์ของบทบาทนี้",
    selected: (n: number, total: number) => `เลือกแล้ว ${n} จาก ${total}`,
    upcomingNote:
      'สิทธิ์ที่มีป้าย "เร็ว ๆ นี้" คือฟีเจอร์ที่ยังไม่เปิด ติ๊กไว้ก่อนได้ จะมีผลทันทีเมื่อฟีเจอร์เปิด',
    upcomingBadge: "เร็ว ๆ นี้",
    impliedReason: "มาพร้อมสิทธิ์จัดการ",
    viewerLacks: "คุณไม่มีสิทธิ์นี้ จึงให้บทบาทอื่นไม่ได้",
    unknownExtra: (n: number) => `และสิทธิ์อื่นอีก ${n} รายการที่แสดงในหน้านี้ไม่ได้`,
    empty: "เลือกสิทธิ์อย่างน้อย 1 อย่าง",
    loadError: "โหลดรายการสิทธิ์ไม่สำเร็จ",
  },
  otherActions: "การจัดการอื่น",
  clone: "ทำสำเนาเป็นบทบาทใหม่",
  cloneUsesSaved: "สำเนาจะใช้ฉบับที่บันทึกไว้ ไม่รวมที่ยังไม่ได้บันทึก",
  submitCreate: "สร้างบทบาท",
  submitEdit: "บันทึก",
  submittingCreate: "กำลังสร้าง...",
  submittingEdit: "กำลังบันทึก...",
  cancel: "ยกเลิก",
  createdToast: (name: string) => `สร้างบทบาท "${name}" แล้ว`,
  savedToast: (name: string) => `บันทึกบทบาท "${name}" แล้ว`,
  loadingLabel: "กำลังโหลด",
  loadError: {
    title: "เปิดบทบาทนี้ไม่สำเร็จ",
    body: "ตรวจการเชื่อมต่อแล้วลองใหม่",
    retry: "ลองใหม่",
  },
  backToList: "กลับไปหน้ารายการบทบาท",
  /** R3b (ux-wireframe R3b) — heading, lead, the person's own diff, re-apply. */
  roleChanged: {
    title: "มีคนแก้บทบาทนี้ไปก่อนคุณ",
    body: "หน้านี้แสดงฉบับล่าสุดแล้ว สิ่งที่คุณแก้ไว้ยังไม่ถูกบันทึก:",
    nameLine: (from: string, to: string) => `ชื่อ: "${from}" → "${to}"`,
    addedLine: (items: string) => `เพิ่ม: ${items}`,
    removedLine: (items: string) => `เอาออก: ${items}`,
    reapply: "ใส่การแก้ของฉันกลับเข้าไป",
    dismiss: "ปิด",
    reapplySkipped: "บางรายการใส่กลับไม่ได้ เพราะตอนนี้คุณไม่มีสิทธิ์นั้น",
  },
  /** R3a (ux-wireframe R3a) — confirm before saving a capability change. */
  confirm: {
    title: (name: string) => `บันทึกการเปลี่ยนสิทธิ์ของ "${name}"?`,
    added: "เพิ่ม",
    removed: "เอาออก",
    impactMembers: (n: number) => `มีผลกับสมาชิก ${n} คนทันที ไม่ต้องออกจากระบบ`,
    impactNone: "ยังไม่มีสมาชิกใช้บทบาทนี้",
    impactInvitations: (m: number) => `คำเชิญที่ยังไม่ปิด ${m} ใบ จะได้สิทธิ์ชุดใหม่เมื่อกดรับ`,
    selfLossTitle: "คุณจะเสียสิทธิ์เหล่านี้ทันที",
    selfLossManageRoles: "บันทึกแล้วคุณจะกลับมาแก้เองไม่ได้ ต้องให้เจ้าของร้านแก้คืน",
    selfLossOther: "ถ้าต้องการคืน ให้เจ้าของร้านแก้ให้",
    save: "บันทึก",
    saveAndLose: "บันทึก และยอมเสียสิทธิ์",
    saving: "กำลังบันทึก...",
    keepEditing: "แก้ต่อ",
  },
  /** ux R3 "หลังบันทึกแล้วเสียสิทธิ์จัดการบทบาทของตัวเอง". */
  lostManageRolesToast: "บันทึกแล้ว — ตอนนี้คุณไม่มีสิทธิ์จัดการบทบาทแล้ว",
  leave: {
    title: "ทิ้งการแก้ไขนี้?",
    body: "สิ่งที่แก้ไว้ยังไม่ได้บันทึก ออกจากหน้านี้แล้วจะหายไป",
    discard: "ทิ้งการแก้ไข",
    keep: "แก้ต่อ",
  },
  /** R4 (read-only) — interim, until W08's CapabilityReadList. */
  readOnly: {
    granted: "ให้",
    notGranted: "ไม่ได้ให้",
  },
} as const;
