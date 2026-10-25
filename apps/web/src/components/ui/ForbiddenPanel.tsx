"use client";

/**
 * S12ข — `403 FORBIDDEN` reached by typing a URL (ux-wireframe §12.2).
 *
 * Fills the CONTENT area only: the nav and the shop switcher stay, because the
 * person is still a member of this shop and still has other things they may
 * do. That is the whole difference from §12.1, where the answer is to leave
 * the org entirely — and it is why the two 403s are separate `ApiFailure`
 * kinds rather than one kind carrying a code.
 *
 * T-003-W01: one panel, per-route words. F-003 ux §0 gives the roles screens
 * their own title/body/back target; the look and structure stay this
 * component's. The defaults are F-002's members copy, unchanged.
 */
import Link from "next/link";
import { Button } from "./Button";
import { Icon } from "./Icon";

export interface ForbiddenPanelCopy {
  readonly title: string;
  readonly body: string;
  readonly back: string;
}

export const FORBIDDEN_PANEL_COPY: ForbiddenPanelCopy = {
  title: "หน้านี้เปิดให้เฉพาะผู้ที่ดูแลทีมงาน",
  body: "ถ้าคุณต้องใช้หน้านี้ ให้เจ้าของร้านเปิดสิทธิ์ให้คุณ",
  back: "กลับหน้าแรกของร้าน",
};

export function ForbiddenPanel({
  orgId,
  copy = FORBIDDEN_PANEL_COPY,
  backHref,
}: {
  orgId: string;
  copy?: ForbiddenPanelCopy;
  /** Defaults to the shop's home, `/o/{orgId}`. */
  backHref?: string;
}) {
  return (
    <section role="alert" className="p-6 text-center">
      <Icon role="lock" size="xl" className="mx-auto text-text-muted" />
      <h2 className="text-heading-sm">{copy.title}</h2>
      <p className="text-body-sm">{copy.body}</p>
      <Link href={backHref ?? `/o/${orgId}`}>
        <Button variant="secondary">{copy.back}</Button>
      </Link>
    </section>
  );
}
