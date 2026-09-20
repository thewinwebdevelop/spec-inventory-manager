/** `.badge` from the mockup — pill, `type.label.sm`, one tone per status. */
import type { ReactNode } from "react";
import { cn } from "./utils";

const TONE = {
  success: "bg-success-bg text-success-text",
  warning: "bg-warning-bg text-warning-text",
  danger: "bg-danger-bg text-danger-text",
  /** `color.badge.neutral.*` — "ยกเลิกแล้ว" and friends: a state, not a verdict. */
  neutral: "bg-badge-neutral-bg text-badge-neutral-text",
  /** `color.badge.current.*` — "อุปกรณ์นี้" / "คุณ". */
  current: "bg-badge-current-bg text-badge-current-text",
} as const;

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof TONE;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-badge px-2.5 py-0.5 text-label-sm",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
