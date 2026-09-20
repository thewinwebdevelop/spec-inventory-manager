/**
 * `CopyField` — ui.md §2.1. A read-only value plus a copy button.
 *
 * `surface.muted` ground, `border.default`, `radius.button`, `type.body.sm`,
 * and `break-all` because the thing it usually holds is a long URL that must
 * not push the dialog sideways.
 */
import type { ReactNode } from "react";
import { cn } from "./utils";

export function CopyField({
  value,
  action,
  className,
  ...rest
}: {
  value: string;
  /** The copy button — a `Button variant="secondary"`, per the spec. */
  action?: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-start gap-3", className)} {...rest}>
      <code className="min-w-0 flex-1 select-all break-all rounded-button border border-border-default bg-surface-muted px-3.5 py-3 font-mono text-body-sm text-text">
        {value}
      </code>
      {action}
    </div>
  );
}
