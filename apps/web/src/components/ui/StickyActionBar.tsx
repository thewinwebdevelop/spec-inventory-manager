/**
 * `StickyActionBar` — ui.md §2.3 (F-003). A save bar pinned to the bottom of
 * a long form so the primary action is always in thumb/click reach — needed
 * by every long form (product F-010, stock adjustment F-011), not just F-003.
 *
 * web-only here (this package is `apps/web`): buttons right-aligned,
 * `gap-3`, `position: sticky; bottom: 0` inside its scroll column — never
 * `fixed` against the viewport, and never its own `z-index` (ui.md: "ไม่ใช้
 * z-index เพิ่ม (ลำดับ DOM)"). The mobile single-full-width-button variant is
 * Flutter's own widget (different codebase, same token values).
 *
 * `12px` bottom padding below is `space.3` (design-system.md §1.3) written
 * out so it can be summed with `env(safe-area-inset-bottom)` — Tailwind's
 * `py-3` utility can't be combined with a calc() addition in one utility.
 */
import type { ReactNode } from "react";
import { cn } from "./utils";

export function StickyActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 flex items-center justify-end gap-3",
        "border-t border-border-default bg-surface px-4 pt-3",
        "pb-[calc(12px+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
