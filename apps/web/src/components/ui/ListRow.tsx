/**
 * `.lrow` + `.avatar` from the mockup — the members and invitations rows.
 *
 * `min-h` is `size.list-row.min-h` (56px), one of the tokens that existed in
 * the document and in no stylesheet until 2026-09-01; the row was carrying the
 * number by hand.
 */
import type { ReactNode } from "react";
import { cn } from "./utils";

export function Avatar({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 flex-none items-center justify-center rounded-badge bg-surface-muted text-label-sm font-semibold text-text-muted"
    >
      {children}
    </span>
  );
}

export function ListRow({
  avatar,
  main,
  sub,
  right,
  dimmed = false,
  className,
}: {
  avatar?: ReactNode;
  main: ReactNode;
  sub?: ReactNode;
  /** Badges and actions, right-aligned. */
  right?: ReactNode;
  /** `.dim` — a revoked/cancelled row: present, legible, plainly inactive. */
  dimmed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-border-default px-4 py-3 first:border-t-0",
        "min-h-[var(--size-list-row-min-h)]",
        dimmed ? "opacity-[.62]" : "hover:bg-surface-muted",
        className,
      )}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-body-md">{main}</div>
        {sub && <div className="text-body-sm text-text-muted">{sub}</div>}
      </div>
      {right && (
        <div className="flex flex-wrap items-center justify-end gap-2.5">{right}</div>
      )}
    </div>
  );
}
