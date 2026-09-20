/**
 * `.drow` from the mockup: label left, value right, a rule between rows.
 *
 * The app stacked label above value with no divider, which is why a screen of
 * four facts read as eight lines of unrelated text.
 *
 * ⚠️ `150px` / `180px` are the mockup's column geometry, not design tokens —
 * design-system.md §1.2 has no entry for them. Per §6 that is a gap to raise
 * with `ux`, not a token to invent here, so they stay literal and visible in
 * one file rather than being spread across five screens.
 */
import type { ReactNode } from "react";
import { cn } from "./utils";

export function DataRow({
  label,
  children,
  action,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  /** Trailing control, right-aligned on the same baseline row. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-4 border-t border-border-default py-2.5 first:border-t-0",
        className,
      )}
    >
      <div className="flex-[0_0_150px] text-label-sm text-text-muted">{label}</div>
      <div className="min-w-[180px] flex-1 text-body-md">{children}</div>
      {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
    </div>
  );
}
