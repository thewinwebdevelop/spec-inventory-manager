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

/** The one place the row's shape is described. Shared so a row that ACTS
 *  (sign out) cannot drift from a row that NAVIGATES. */
function navRowClass(active: boolean, className?: string) {
  return cn(
    "flex w-full items-center gap-2.5 rounded-button px-2.5 text-body-md no-underline",
    "min-h-[var(--size-tap-target-min)]",
    active ? "bg-surface-muted font-semibold text-primary" : "text-text hover:bg-surface-muted",
    className,
  );
}

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
    <Link href={href} aria-current={active ? "page" : undefined} className={navRowClass(active)}>
      {icon}
      {children}
    </Link>
  );
}

/**
 * ★ B-16 — a sidebar row that runs an action instead of navigating.
 *
 * It exists because "ออกจากระบบ" is drawn as the last row of the sidebar in
 * ux-wireframe §S2 and had no implementation: the label sat in `orgTh.shell.
 * nav.logout` with no consumer anywhere in the tree, so the only way out of
 * the app was "ออกจากระบบทุกอุปกรณ์" — a different, much heavier action that
 * ends every session on every device the person owns.
 */
export function NavAction({
  icon,
  children,
  onClick,
  disabled = false,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={navRowClass(false, cn("text-left disabled:opacity-60", className))}
    >
      {icon}
      {children}
    </button>
  );
}
