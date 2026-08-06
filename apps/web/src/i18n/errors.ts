/**
 * Thai copy for the CENTRAL failure taxonomy (`lib/api/error.ts`).
 *
 * Ownership: `ux`. Every string here is either copied verbatim from
 * docs/features/F-002/ux-wireframe.md §1.4 / §12 (marked ✓ux) or is a generic
 * fallback that no wireframe specifies (marked ‡new — `ux` should confirm; it
 * is only reachable when a screen does NOT supply its own message).
 *
 * Screen-specific copy does NOT belong here. `failureMessage()` is the last
 * resort so that a screen which forgets a case still shows Thai prose instead
 * of a raw code (design-system.md §3, and the same rule `error-messages.ts`
 * already follows for F-001).
 */
export const errorsTh = {
  /** ✓ux §1.4 — network/5xx generic. */
  network: "เชื่อมต่อไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง",
  /** ‡new — generic 5xx. */
  server: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
  /** ✓ux §1.4 — 422 ORG_MISMATCH / ORG_CONTEXT_REQUIRED are CLIENT bugs: same
   * neutral toast, and explicitly NOT a reason to kick the user out of a shop. */
  clientBug: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
  /** ‡new — validation with no field-level detail to show. */
  validation: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่อีกครั้ง",
  /** ‡new. */
  notFound: "ไม่พบข้อมูลที่ต้องการ",
  /** ‡new — a 409 whose code the screen did not handle. */
  conflict: "ทำรายการไม่สำเร็จ เพราะข้อมูลเปลี่ยนไปแล้ว กรุณาโหลดใหม่อีกครั้ง",

  /** ✓ux §12.2 — 403 FORBIDDEN: stay on the page, show a toast. */
  forbidden: "คุณไม่มีสิทธิ์ทำรายการนี้ ติดต่อเจ้าของร้านให้เปิดสิทธิ์ให้",

  /** ✓ux §12.1 — 403 ORG_ACCESS_DENIED. `{shop}` is the shop NAME the user was
   * looking at; when it is unknown the nameless variant is used instead. */
  orgAccessDenied: {
    withName: (shop: string) =>
      `คุณไม่ได้เป็นสมาชิกของร้าน "${shop}" แล้ว — เลือกร้านอื่นด้านล่าง หรือติดต่อเจ้าของร้านถ้าคิดว่าไม่ถูกต้อง`,
    withoutName: "คุณไม่ได้เป็นสมาชิกของร้านนี้แล้ว — เลือกร้านอื่นด้านล่าง หรือติดต่อเจ้าของร้านถ้าคิดว่าไม่ถูกต้อง",
  },

  /** ✓ux §1.4 — 409 + `details.reason === "busy"`. ONE message everywhere.
   * Note what the wireframe forbids: never show the words `busy` / `CONFLICT` /
   * `reason` / `traceId`, and never word it as an outage — this is temporary. */
  busy: "ระบบกำลังทำรายการอื่นของร้านนี้อยู่ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง",

  /** ✓ux §1.4 — the retry affordance that accompanies a retryable failure. */
  retry: "ลองใหม่",
} as const;
