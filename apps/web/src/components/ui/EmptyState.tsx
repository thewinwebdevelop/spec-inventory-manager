/**
 * `EmptyState` — design-system §9.1: icon `size.icon.xl` + heading + body +
 * 0–2 actions. Listed there since F-002 and never built; S1's empty state was a
 * bare heading and paragraph (D-038 ③, D3).
 *
 * The icon is one of the two places §1.6.3 lets an icon name its own colour
 * (`color.text.muted`), and it is decorative: the heading already says it.
 */
import type { ReactNode } from "react";
import { Icon, type IconRole } from "./Icon";
import { cn } from "./utils";

export function EmptyState({
  icon,
  title,
  body,
  actions,
  headingLevel = 2,
  className,
}: {
  icon: IconRole;
  title: string;
  body?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={cn("flex flex-col items-center gap-2 py-8 text-center", className)}>
      <Icon role={icon} size="xl" className="mb-1 text-text-muted" />
      <Heading className="m-0 text-heading-sm">{title}</Heading>
      {body && <p className="m-0 max-w-[40ch] text-body-sm text-text-muted">{body}</p>}
      {actions && (
        <div data-empty-actions className="mt-2 flex flex-wrap justify-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
