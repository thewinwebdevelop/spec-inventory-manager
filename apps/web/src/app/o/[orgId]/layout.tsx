/**
 * T-002-W1 — `/o/[orgId]` (web.md §2.2).
 *
 * `app/` is routing only (apps/web/CLAUDE.md rule 2): this awaits the route
 * param and hands it to `OrgGuard`, which owns every decision.
 *
 * `AppShell` is INSIDE the guard, deliberately. Chrome rendered outside it
 * would display a shop name — and a menu built from capabilities — before
 * anything had verified the caller belongs to that shop at all.
 */
import type { ReactNode } from "react";
import { OrgGuard } from "../../../components/org/OrgGuard";
import { AppShell } from "../../../features/org/components/AppShell";

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return (
    <OrgGuard orgId={orgId}>
      <AppShell>{children}</AppShell>
    </OrgGuard>
  );
}
