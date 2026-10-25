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
