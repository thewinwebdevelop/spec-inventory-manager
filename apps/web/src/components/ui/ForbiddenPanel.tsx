"use client";

/**
 * S12ข — `403 FORBIDDEN` reached by typing a URL (ux-wireframe §12.2).
 *
 * Fills the CONTENT area only: the nav and the shop switcher stay, because the
 * person is still a member of this shop and still has other things they may
 * do. That is the whole difference from §12.1, where the answer is to leave
 * the org entirely — and it is why the two 403s are separate `ApiFailure`
 * kinds rather than one kind carrying a code.
 */
import Link from "next/link";
import { Button } from "./Button";

export const FORBIDDEN_PANEL_COPY = {
  title: "หน้านี้เปิดให้เฉพาะผู้ที่ดูแลทีมงาน",
  body: "ถ้าคุณต้องใช้หน้านี้ ให้เจ้าของร้านเปิดสิทธิ์ให้คุณ",
  back: "กลับหน้าแรกของร้าน",
} as const;

export function ForbiddenPanel({ orgId }: { orgId: string }) {
  return (
    <section role="alert" className="p-6 text-center">
      <p aria-hidden="true">🔒</p>
      <h2 className="text-heading-sm">{FORBIDDEN_PANEL_COPY.title}</h2>
      <p className="text-body-sm">{FORBIDDEN_PANEL_COPY.body}</p>
      <Link href={`/o/${orgId}`}>
        <Button variant="secondary">{FORBIDDEN_PANEL_COPY.back}</Button>
      </Link>
    </section>
  );
}
