/**
 * `RoleReasonBanner` (ui.md §3) — R4's ONE reason banner: `Banner` info +
 * `icon.lock` (`writes_disabled` → `icon.info`), copy from ux §0.3 (ก) via
 * `bannerReasonCopy` — a reason this build has never heard of falls through to
 * "ดูได้อย่างเดียว" + the generic body, never a raw key.
 *
 * At most one action (ui.md §1: "มีได้ 1 ปุ่ม") — the clone button, which the
 * caller decides from `canClone`. `role="status"` (ux §A: reasons are status,
 * errors are alerts).
 */
import type { ReactNode } from "react";
import { Banner } from "../../../components/ui/Banner";
import { Icon } from "../../../components/ui/Icon";
import { bannerReasonCopy } from "../role-copy";

export function RoleReasonBanner({
  reason,
  action,
}: {
  reason: string | null | undefined;
  /** The single in-banner button (clone), if any — with its own reason line when disabled. */
  action?: ReactNode;
}) {
  const copy = bannerReasonCopy(reason);
  return (
    <Banner
      tone="info"
      icon={<Icon role={reason === "writes_disabled" ? "info" : "lock"} />}
      role="status"
      actions={action}
    >
      <strong className="block">{copy.title}</strong>
      {copy.body}
    </Banner>
  );
}
