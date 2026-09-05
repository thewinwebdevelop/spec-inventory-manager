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
import { usePathname, useRouter } from "next/navigation";
import { useActiveOrg, useCan } from "../../../lib/org/org-context";
import { NavAction, NavItem } from "../../../components/ui/NavItem";
import { logoutDevice } from "../../../lib/auth-client";
import { IconButton } from "../../../components/ui/IconButton";
import { Icon } from "../../../components/ui/Icon";
import { orgTh } from "../i18n";
import { OrgSwitcher } from "./OrgSwitcher";
import { useToast } from "../../../components/providers/ToastProvider";

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
  const router = useRouter();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);
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
  // ★ A DRAWER, which means it floats OVER the page.
  //
  // §8.2 says the nav "ยุบเป็น top bar + drawer (hamburger)" at md, and the
  // mockup draws exactly that: `.drawer` is `position:absolute; width:280px;
  // box-shadow: shadow-dialog` above a `.scrim` covering the rest. My first
  // version was a disclosure — an in-flow block that PUSHED the page down —
  // which is not a drawer, and the user caught it.
  //
  // Closed by default below lg; the permanent sidebar above lg does not use
  // this state at all.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Navigating from inside the drawer closes it: otherwise it covers the page
  // you just asked for.
  useEffect(() => setDrawerOpen(false), [pathname]);
  // Escape closes it, and the page behind must not scroll while it is open —
  // both are what makes it read as a layer rather than a section.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  const orgProfilePath = `/o/${orgId}/settings/org`;
  const membersPath = `/o/${orgId}/settings/members`;
  // `/o/{orgId}` renders the SAME screen as `/o/{orgId}/settings/org` (S4 is
  // the shop home in Phase 0, until F-030's dashboard). Comparing the path to
  // the settings route alone left the sidebar with nothing highlighted on the
  // route people actually land on after entering a shop.
  const onOrgProfile = pathname === orgProfilePath || pathname === `/o/${orgId}`;

  /**
   * `logoutDevice()` with no `familyId` ends THIS session only — the refresh
   * cookie and the in-memory access token — which is what a sidebar "sign
   * out" means. `logoutAll()` is the deliberate, confirmed action that stays
   * on the security page.
   *
   * ⛔ On failure it STAYS and says so, rather than routing to `/login`
   * optimistically. `logoutDevice` clears the access token only after the
   * server has answered `204`, so a failed call leaves both the token and the
   * refresh cookie alive — sending the person to a login page while their
   * session is still valid would show them a sign-out that did not happen.
   * Same shape as `SessionList`'s logout-all error, which is the pattern ux
   * already specified for this failure.
   */
  async function signOut() {
    setSigningOut(true);
    try {
      await logoutDevice();
      router.replace("/login");
    } catch {
      toast.error(orgTh.shell.nav.logoutFailed);
    } finally {
      setSigningOut(false);
    }
  }

  const nav = (
    <>
      <OrgSwitcher />
      {/* The mockup's `.navi` rows: 44px tall, and the CURRENT one carries a
          `surface.muted` background. Colour alone was not enough to see where
          you are — which is the sidebar's entire job. */}
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
        {/* ★ B-16 — ux-wireframe §S2 draws this as the last row of the
            sidebar, and it had never been built: `orgTh.shell.nav.logout`
            existed with NO consumer anywhere in the tree. The only way out of
            the app was "ออกจากระบบทุกอุปกรณ์" on the security page, which ends
            every session on every device — an answer to a different question.
            Found by the §12.2 manual pass, when signing out to switch accounts
            turned out to be impossible without it. */}
        <li className="mt-1 border-t border-border-default pt-1">
          <NavAction disabled={signingOut} onClick={signOut}>
            {orgTh.shell.nav.logout}
          </NavAction>
        </li>
      </ul>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg lg:flex-row">
      {/* `.tbar` — 56px, and only below lg where the sidebar is not permanent. */}
      <div className="flex h-14 items-center gap-1 border-b border-border-default bg-surface px-2 lg:hidden">
        <IconButton
          aria-label={orgTh.shell.nav.showMenu}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <Icon role="menu" size="lg" />
        </IconButton>
        <span className="text-heading-sm">OmniStock</span>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* `.scrim` — the page is still visible behind it, which is what
              tells you the drawer is a layer you can dismiss. */}
          <div
            role="presentation"
            className="absolute inset-0 bg-overlay"
            onClick={() => setDrawerOpen(false)}
          />
          {/* `.drawer` — 280px, `shadow-dialog`, pinned to the left edge.
              ⚠️ 280px is the mockup's drawer width and is NOT `size.sidebar.w`
              (240px); design-system.md §1.2 has no token for it, so per §6 it
              stays a literal here and goes on the list for ux. */}
          <nav
            aria-label={orgTh.shell.nav.menuLabel}
            className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85%] flex-col gap-2 overflow-y-auto border-r border-border-default bg-surface p-card-padding shadow-dialog"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-heading-sm">OmniStock</span>
              <IconButton
                aria-label={orgTh.shell.nav.hideMenu}
                autoFocus
                onClick={() => setDrawerOpen(false)}
              >
                <Icon role="close" size="lg" />
              </IconButton>
            </div>
            {nav}
          </nav>
        </div>
      )}

      {/* The permanent sidebar, ≥lg only. `size.sidebar.w` (240px) — a token
          that existed in design-system.md and in no stylesheet until
          2026-09-01, so this was `md:w-64` (256px) off Tailwind's scale. */}
      <nav
        aria-label={orgTh.shell.nav.menuLabel}
        className="hidden flex-col gap-2 border-border-default bg-surface p-card-padding lg:flex lg:w-[var(--size-sidebar-w)] lg:border-r"
      >
        <p className="m-0 mb-2 text-heading-sm">OmniStock</p>
        {nav}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
