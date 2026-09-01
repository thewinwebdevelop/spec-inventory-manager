/**
 * `.navi` from the mockup — the sidebar row.
 *
 * Two things the app was missing and the mockup is explicit about: the row is
 * a 44px tap target (`size.tap-target.min`, no exceptions — the web app runs
 * on touch tablets too), and the ACTIVE row has a `surface.muted` background,
 * not just a colour change. Without the background the current page is
 * indistinguishable at a glance, which is what the sidebar is for.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "./utils";

export function NavItem({
  href,
  active = false,
  icon,
  children,
}: {
  href: string;
  active?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-button px-2.5 text-body-md no-underline",
        "min-h-[var(--size-tap-target-min)]",
        active
          ? "bg-surface-muted font-semibold text-primary"
          : "text-text hover:bg-surface-muted",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
