"use client";

/**
 * T-003-W01 ★ — gate a route segment on a capability (web.md §3.3).
 *
 * Used from a route's `layout.tsx`/`page.tsx`:
 *
 *   <RouteGuard requiredCapability={CAPABILITY_MANAGE_ROLES} …>{children}</RouteGuard>
 *
 * ⛔ UX, never enforcement. The answer comes from `myMembership.capabilities`
 * — the set the SERVER sent in `GET /orgs/{orgId}` — through `useCan`, i.e.
 * core-domain's rule (`full_access` is a wildcard). This component never
 * decides a capability itself, never widens or narrows the set, and the
 * server refuses every call behind it regardless of what renders here.
 *
 * Two behaviours are load-bearing:
 *  - Denied → the children are NOT mounted. A mounted screen would fire its
 *    queries and turn a friendly panel into a 403 error state.
 *  - Denied → ask the server again, once (ux-wireframe F-003 §0: "client
 *    refresh `myMembership` ทันที"). The client's copy may be stale in either
 *    direction; only the server may change the answer. If the refetch grants
 *    it the route renders; if it confirms the denial, `allowed` is unchanged
 *    and the effect does not run again — no loop.
 *
 * Why here and not `components/ui/`: web.md §3.3 sketches it under `ui/`, but
 * it reads the active org, and `components/ui/**` must stay org-agnostic
 * (apps/web/CLAUDE.md rule 3). It sits beside `OrgGuard`, the other gate.
 *
 * Tier/entitlement gating (`FeatureGate`, B2) is a different question and is
 * deliberately not folded in here — see web.md §3.3 / design-brief B3.
 */
import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrg, useCan } from "../../lib/org/org-context";
import { orgKey } from "../../lib/org/org-keys";
import type { GateCapability } from "../../lib/org/capability";
import { ForbiddenPanel, type ForbiddenPanelCopy } from "../ui/ForbiddenPanel";

export function RouteGuard({
  requiredCapability,
  forbiddenCopy,
  forbiddenBackHref,
  children,
}: {
  requiredCapability: GateCapability;
  /** Route-specific panel words (ux owns them); defaults to the members copy. */
  forbiddenCopy?: ForbiddenPanelCopy;
  /** Where the panel's button goes; defaults to `/o/{orgId}`. */
  forbiddenBackHref?: string;
  children: ReactNode;
}) {
  const { orgId } = useActiveOrg();
  const allowed = useCan(requiredCapability);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (allowed) return;
    // Same key `useOrgProfile` reads — the one source of `myMembership`.
    void queryClient.invalidateQueries({ queryKey: orgKey(orgId, "profile") });
  }, [allowed, orgId, queryClient]);

  if (!allowed) {
    return <ForbiddenPanel orgId={orgId} copy={forbiddenCopy} backHref={forbiddenBackHref} />;
  }
  return <>{children}</>;
}
