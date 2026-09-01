/**
 * `.banner` from the mockup — the four tones, with the two rules the mockup
 * comments call out as user decisions (2026-07-28):
 *
 *  · a button inside a banner wears the BANNER's tone, not the neutral one,
 *    or it reads as pasted in from another screen;
 *  · a text link inside a banner separates itself by COLOUR, never an
 *    underline — and it must be `color.primary`, because keeping
 *    `currentColor` while dropping the underline makes the link vanish into
 *    the sentence around it.
 */
import type { ReactNode } from "react";
import { cn } from "./utils";

const TONE = {
  /** `color.info.*` — neutral, "here is something you should know". */
  info: "bg-info-bg border-info-border text-info-text",
  warning: "bg-warning-bg border-warning-border text-warning-text",
  success: "bg-success-bg border-success-border text-success-text",
  danger: "bg-danger-bg border-danger-border text-danger-text",
} as const;

export function Banner({
  tone = "info",
  icon,
  children,
  actions,
  className,
  ...rest
}: {
  tone?: keyof typeof TONE;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "flex items-start gap-3 rounded-card border p-4 text-body-sm",
        TONE[tone],
        className,
      )}
    >
      {icon && <span className="mt-px flex-none">{icon}</span>}
      <div className="min-w-0 flex-1">
        {children}
        {actions && (
          <div className="mt-3 flex flex-wrap items-center gap-3">{actions}</div>
        )}
      </div>
    </div>
  );
}
