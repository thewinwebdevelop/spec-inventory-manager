"use client";

/**
 * T-003-W05 — the two reads behind R1/R2 (api-spec §3, shipped by B21).
 *
 *  - `GET /orgs/{orgId}/role-details` — every live role in full, with the
 *    caller's per-role verdicts (`viewer.*`) and the create verdict + ceiling.
 *  - `GET /orgs/{orgId}/capabilities` — the catalog (labels, D-037). Cached
 *    PER SHOP: a tier-gated entry is hidden entirely, so the answer differs
 *    between shops (AC-7.4) — `orgKey` puts the orgId in the key.
 *
 * Both require `manage_roles`; the screen is behind `RouteGuard`, but that is
 * UX — a 403 here is rendered as the forbidden panel by the screen.
 *
 * `staleTime: 0` on the list: the verdicts (`viewer.*`) and usage counts are
 * decided against the CURRENT state of the shop, and other people change it.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { components } from "@omnistock/contracts";
import { useOrgApiClient } from "../../../../lib/api/use-org-api-client";
import { useActiveOrg } from "../../../../lib/org/org-context";
import { unwrap } from "../../../../lib/api/clients";
import { orgKey } from "../../../../lib/org/org-keys";

export type RoleDetail = components["schemas"]["RoleDetail"];
export type RoleDetailListPage = components["schemas"]["RoleDetailListPage"];
export type CapabilityCatalog = components["schemas"]["CapabilityCatalog"];

export function useRoleDetails(): UseQueryResult<RoleDetailListPage, unknown> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  return useQuery({
    queryKey: orgKey(orgId, "role-details"),
    staleTime: 0,
    queryFn: () =>
      unwrap(
        client.GET("/orgs/{orgId}/role-details", { params: { path: { orgId } } }),
      ) as Promise<RoleDetailListPage>,
  });
}

export function useCapabilityCatalog(): UseQueryResult<CapabilityCatalog, unknown> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  return useQuery({
    queryKey: orgKey(orgId, "capability-catalog"),
    queryFn: () =>
      unwrap(
        client.GET("/orgs/{orgId}/capabilities", { params: { path: { orgId } } }),
      ) as Promise<CapabilityCatalog>,
  });
}
