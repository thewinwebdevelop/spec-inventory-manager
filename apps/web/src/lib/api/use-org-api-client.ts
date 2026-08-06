"use client";

/**
 * T-002-W1 ★ — how every feature gets an API client (web.md §3.2).
 *
 * The only argument `createOrgApiClient` takes is the orgId, and the only
 * source of that orgId is `useActiveOrg()`, which reads the URL. A feature
 * therefore cannot construct a client for a shop other than the one being
 * viewed without going out of its way to import the factory directly — which
 * the boundary check flags.
 */
import { useMemo } from "react";
import { useActiveOrg } from "../org/org-context";
import { createOrgApiClient, type OrgApiClient } from "./clients";

export function useOrgApiClient(): OrgApiClient {
  const { orgId } = useActiveOrg();
  // Rebuilt only when the org changes — which, since the org is in the URL,
  // means "on navigation to a different shop".
  return useMemo(() => createOrgApiClient(orgId), [orgId]);
}
