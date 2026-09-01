/**
 * `.card` from the signed-off mockup (docs/design-system/mockup/f002-org.html).
 *
 * The screens were built to the wireframe, which says WHAT is on a screen, and
 * skipped the mockup, which says what it looks like — so every F-002 surface
 * grew its own `p-6 rounded-card border` incantation and they drifted. One
 * component now owns the card, and `chead` owns the "title on the left, action
 * on the right" row the mockup uses on every section.
 */
import type { ReactNode } from "react";
import { cn } from "./utils";

export function SectionCard({
  title,
  action,
  children,
  className,
  ...rest
}: {
  title?: ReactNode;
  /** Right-aligned control in the header — a real Button, not a text link. */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  return (
    <section
      {...rest}
      className={cn(
        "rounded-card border border-border-default bg-surface p-card-padding shadow-card",
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-2 flex items-start justify-between gap-3">
          {title && <h2 className="m-0 text-heading-sm">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
