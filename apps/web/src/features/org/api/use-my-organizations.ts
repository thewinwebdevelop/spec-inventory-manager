"use client";

/**
 * `GET /me/organizations` — the shop list behind S1 and the org switcher
 * (api-spec §3.2). One query, two consumers: the picker and the switcher show
 * the same data, so a shop that vanished cannot linger in one of them.
 *
 * USER-scoped: it uses `createUserApiClient`, which sends no
 * `X-Organization-Id`. This call spans every shop; an org header on it is an
 * input the server should never receive for this route (security review I-3).
 */
import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { components } from "@omnistock/contracts";
import { createUserApiClient, unwrap } from "../../../lib/api/clients";
import { MY_ORGANIZATIONS_KEY } from "../../../lib/org/org-keys";

export type MyOrganizationsPage = components["schemas"]["MyOrganizationsPage"];
export type MyOrganizationItem = components["schemas"]["MyOrganizationItem"];

export function useMyOrganizations(): UseQueryResult<MyOrganizationsPage, unknown> {
  const client = useMemo(() => createUserApiClient(), []);
  return useQuery({
    queryKey: MY_ORGANIZATIONS_KEY,
    queryFn: () => unwrap(client.GET("/me/organizations")),
  });
}

/**
 * Rows the user can actually enter.
 *
 * The endpoint's default is active-only, but the shape is
 * status-dependent (`MyOrganizationMembership`, M-10): a revoked row carries
 * `status` + `revokedAt` and NOTHING else — no role. Filtering here means a
 * switcher row can always assume the full shape, instead of every consumer
 * having to remember that `roleName` is sometimes absent.
 */
export function activeOrganizations(page: MyOrganizationsPage | undefined): MyOrganizationItem[] {
  return (page?.items ?? []).filter((item) => item.membership.status === "active");
}
