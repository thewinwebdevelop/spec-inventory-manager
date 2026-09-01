"use client";

/**
 * S3 — the chrome every `/o/[orgId]` page renders inside (ux-wireframe §4).
 *
 * It sits INSIDE `OrgGuard`, so by the time it renders the shop is known to
 * exist and to be one the caller belongs to. Chrome that rendered first would
 * be showing a shop name nobody verified the user may see.
 *
 * ⛔ Hiding "สมาชิก" for someone without `manage_members` is UX, not
 * enforcement (§1.4, architecture §3.1): the server refuses the call whatever
 * the menu looks like, and every hidden entry still has an error path — which
 * is why `/o/[orgId]/settings/members` typed directly into the address bar
 * lands on a `ForbiddenPanel` rather than on nothing.
 */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useActiveOrg, useCan } from "../../../lib/org/org-context";
import { NavItem } from "../../../components/ui/NavItem";
import { IconButton } from "../../../components/ui/IconButton";
import { Icon } from "../../../components/ui/Icon";
import { orgTh } from "../i18n";
import { OrgSwitcher } from "./OrgSwitcher";

/** api-spec §3.3 — the capability the members screen requires. */
import { CAPABILITY_MANAGE_MEMBERS } from "../../../lib/org/capability";

export { CAPABILITY_MANAGE_MEMBERS };

/**
 * Account security stays at the ROOT, not under `/o/[orgId]`.
 *
 * web.md §2.2 pencils it in under the org (`o/[orgId]/settings/security`,
 * "ย้ายเข้ามาใต้ org ตอน F-002"), but moving it would make it unreachable in a
 * state F-002 itself creates and supports: S1's empty state is a logged-in
 * user who belongs to NO shop. Under the org shell, that person could not
 * change their password or see their sessions — locked out of their own
 * account settings by a nav decision. The page is user-scoped anyway (it
 * calls `/auth/*`, which carries no org).
 *
 * Recorded against W3 in tasks.md rather than resolved here: whether the IA
 * changes is `ux`'s call, not this component's.
 */
export const SECURITY_PATH = "/settings/security";

export function AppShell({ children }: { children: ReactNode }) {
  const { orgId } = useActiveOrg();
  const pathname = usePathname();
  // §4 answers Q13 explicitly: HIDE it, do not disable it — a disabled entry
  // just raises a question the user cannot resolve.
  const canManageMembers = useCan(CAPABILITY_MANAGE_MEMBERS);
  /**
   * ★ design-system §8.2: at `md` the sidebar "ยุบเป็น top bar + drawer
   * (hamburger)". None of that existed — below `md` the nav simply stacked on
   * top of the page as a full-width block with no way to put it away, and
   * there was no control to collapse it at any width.
   *
   * Open by default so ≥lg keeps §8.2's "sidebar ถาวรซ้าย"; the toggle is what
   * the drawer needs and what a person on a narrow window reaches for.
   */
  const [navOpen, setNavOpen] = useState(true);
  // Navigating inside the drawer should close it — otherwise the drawer covers
  // the page you just asked for.
  useEffect(() => setNavOpen((open) => (window.innerWidth < 1024 ? false : open)), [pathname]);

  const orgProfilePath = `/o/${orgId}/settings/org`;
  const membersPath = `/o/${orgId}/settings/members`;
  // `/o/{orgId}` renders the SAME screen as `/o/{orgId}/settings/org` (S4 is
  // the shop home in Phase 0, until F-030's dashboard). Comparing the path to
  // the settings route alone left the sidebar with nothing highlighted on the
  // route people actually land on after entering a shop.
  const onOrgProfile = pathname === orgProfilePath || pathname === `/o/${orgId}`;

  return (
    <div className="flex min-h-screen flex-col bg-bg lg:flex-row">
      {/* The `md` top bar (§8.2). Hidden once the sidebar is permanent. */}
      <div className="flex items-center gap-2 border-b border-border-default bg-surface px-4 py-2 lg:hidden">
        <IconButton
          aria-label={navOpen ? orgTh.shell.nav.hideMenu : orgTh.shell.nav.showMenu}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          <Icon role={navOpen ? "close" : "menu"} size="lg" />
        </IconButton>
        <span className="text-heading-sm">OmniStock</span>
      </div>

      {/* `size.sidebar.w` (240px) — a token that existed in design-system.md
          and in no stylesheet until 2026-09-01, so this was `md:w-64` (256px)
          picked from Tailwind's scale instead. */}
      <nav
        aria-label="เมนูของร้าน"
        hidden={!navOpen}
        className="flex flex-col gap-2 border-border-default bg-surface p-card-padding lg:w-[var(--size-sidebar-w)] lg:border-r"
      >
        <p className="m-0 mb-2 hidden text-heading-sm lg:block">OmniStock</p>
        <OrgSwitcher />
        {/* The mockup's `.navi` rows: 44px tall, and the CURRENT one carries a
            `surface.muted` background. Colour alone was not enough to see
            where you are — which is the sidebar's entire job. */}
        <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
          <li>
            <NavItem href={orgProfilePath} active={onOrgProfile}>
              {orgTh.shell.nav.orgProfile}
            </NavItem>
          </li>
          {canManageMembers && (
            <li>
              <NavItem href={membersPath} active={pathname === membersPath}>
                {orgTh.shell.nav.members}
              </NavItem>
            </li>
          )}
          <li>
            <NavItem href={SECURITY_PATH} active={pathname === SECURITY_PATH}>
              {orgTh.shell.nav.security}
            </NavItem>
          </li>
        </ul>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
