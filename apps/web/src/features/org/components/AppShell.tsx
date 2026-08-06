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
import Link from "next/link";
import { useActiveOrg, useCan } from "../../../lib/org/org-context";
import { orgTh } from "../i18n";
import { OrgSwitcher } from "./OrgSwitcher";

/** api-spec §3.3 — the capability the members screen requires. */
export const CAPABILITY_MANAGE_MEMBERS = "manage_members";

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
  // §4 answers Q13 explicitly: HIDE it, do not disable it — a disabled entry
  // just raises a question the user cannot resolve.
  const canManageMembers = useCan(CAPABILITY_MANAGE_MEMBERS);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav aria-label="เมนูของร้าน" className="border-border-default p-4 md:w-64 md:border-r">
        <p className="mb-4 font-semibold">OmniStock</p>
        <OrgSwitcher />
        <ul className="list-none p-0">
          <li>
            <Link href={`/o/${orgId}/settings/org`}>{orgTh.shell.nav.orgProfile}</Link>
          </li>
          {canManageMembers && (
            <li>
              <Link href={`/o/${orgId}/settings/members`}>{orgTh.shell.nav.members}</Link>
            </li>
          )}
          <li>
            <Link href={SECURITY_PATH}>{orgTh.shell.nav.security}</Link>
          </li>
        </ul>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
