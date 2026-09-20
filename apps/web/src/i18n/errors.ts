/**
 * Thai copy for the CENTRAL failure taxonomy (`lib/api/error.ts`).
 *
 * Ownership: `ux`. Every string here is copied verbatim from
 * docs/features/F-002/ux-wireframe.md §1.4 / §1.5 / §12 (marked ✓ux). The five
 * fallbacks that used to be marked `‡new` were reviewed by `ux` on 2026-09-05
 * (manual pass §12.2 / M-05) and are now specified in ux-wireframe §1.5 —
 * they are the last-resort copy for a failure the screen did NOT name itself.
 *
 * The rule those five follow: a fallback must still say WHOSE problem it is
 * and WHAT to do next. "เกิดข้อผิดพลาด" alone tells an SME neither, which is
 * how B-17 cost a whole debugging session on mobile — the app said "something
 * went wrong" when what it meant was "I cannot reach the server".
 *
 * Screen-specific copy does NOT belong here. `failureMessage()` is the last
 * resort so that a screen which forgets a case still shows Thai prose instead
 * of a raw code (design-system.md §3, and the same rule `error-messages.ts`
 * already follows for F-001).
 */
export const errorsTh = {
  /** ✓ux §1.4 — the transport failed: we never reached the server. Names the
   *  one thing the reader can actually check. */
  network: "เชื่อมต่อไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง",
  /** ✓ux §1.5 — generic 5xx: the request ARRIVED and our side failed. Says so
   *  ("ระบบ...") and says it is temporary, so the reader does not go hunting
   *  through their own data or their own connection for a fault that is ours.
   *  ⛔ Not the same sentence as `clientBug` on purpose — same words for
   *  "our server broke" and "our client sent nonsense" made both unreportable. */
  server: "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
  /** ✓ux §1.4 — 422 ORG_MISMATCH / ORG_CONTEXT_REQUIRED are CLIENT bugs: same
   * neutral toast, and explicitly NOT a reason to kick the user out of a shop. */
  clientBug: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
  /** ✓ux §1.5 — validation with no field-level detail to show. "ที่กรอก"
   *  points at the form rather than at the shop's data. */
  validation: "ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่อีกครั้ง",
  /** ✓ux §1.5 — the thing is gone, which is usually because somebody else in
   *  the shop changed it. Says that, and gives the one move that works. */
  notFound: "ไม่พบข้อมูลนี้แล้ว — อาจถูกลบหรือเปลี่ยนไป กรุณาโหลดหน้านี้ใหม่",
  /** ✓ux §1.5 — a 409 whose code the screen did not handle. */
  conflict: "ทำรายการไม่สำเร็จ เพราะข้อมูลเพิ่งเปลี่ยนไป กรุณาโหลดหน้านี้ใหม่แล้วลองอีกครั้ง",

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

  /** ✓ux §1.4 — the retry affordance that accompanies a retryable failure.
   *  (Was marked `‡new`; it is in fact the wireframe's own standard wording
   *  for the retry button on every error state — §1.4 "error = สาเหตุ + ปุ่ม
   *  ลองใหม่".) */
  retry: "ลองใหม่",
} as const;
