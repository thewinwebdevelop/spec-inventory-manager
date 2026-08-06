"use client";

/**
 * T-002-W1 — the query that bootstraps an org (api-spec §3.3).
 *
 * It lives in `lib/org/` rather than `features/org/api/` for a dependency
 * reason: `ActiveOrgProvider` needs it, and `lib/` may not import `features/`
 * (web.md §2.3). It is genuinely infrastructure anyway — every screen under
 * `/o/[orgId]` depends on it resolving before it can render at all.
 *
 * It builds its own client instead of calling `useOrgApiClient()`, because
 * this is the query that establishes the context that hook reads. Using the
 * hook here would be a cycle.
 */
import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createOrgApiClient, unwrap } from "../api/org-client";
import { orgKey } from "./org-keys";
import type { OrgProfile } from "./org-context";

export function useOrgProfile(orgId: string): UseQueryResult<OrgProfile, unknown> {
  const client = useMemo(() => createOrgApiClient(orgId), [orgId]);
  return useQuery({
    queryKey: orgKey(orgId, "profile"),
    queryFn: () => unwrap(client.GET("/orgs/{orgId}", { params: { path: { orgId } } })),
    // The default retry predicate already refuses to retry the 403 this call
    // can legitimately return (query-client.ts) — do not add one here.
  });
}
