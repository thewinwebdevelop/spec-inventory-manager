/**
 * T-002-W1 — `/o/[orgId]` (web.md §2.2).
 *
 * `app/` is routing only (apps/web/CLAUDE.md rule 2): this awaits the route
 * param and hands it to `OrgGuard`, which owns every decision. The AppShell
 * (nav + org switcher, S3) lands with T-002-W3 and will wrap `children`
 * INSIDE the guard — chrome that renders before we know the org exists would
 * show a shop name we have not verified the user may see.
 */
import type { ReactNode } from "react";
import { OrgGuard } from "../../../components/org/OrgGuard";

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <OrgGuard orgId={orgId}>{children}</OrgGuard>;
}
