"use client";

/**
 * T-002-W5 — the members and invitations lists behind S6 (api-spec §3.7/§3.10).
 *
 * Both are `manage_members`-gated on the server for the same PDPA reason
 * (D-028/I-8): every row carries somebody else's email address. The screen
 * hides itself without the capability, but that is UX — these calls are
 * refused regardless.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { components } from "@omnistock/contracts";
import { useOrgApiClient } from "../../../lib/api/use-org-api-client";
import { useActiveOrg } from "../../../lib/org/org-context";
import { unwrap } from "../../../lib/api/clients";
import { orgKey } from "../../../lib/org/org-keys";

export type MemberRow = components["schemas"]["MemberRow"];
export type InvitationRow = components["schemas"]["Invitation"];

/** `active` by default; `all` adds revoked rows (§7's "แสดงสมาชิกที่ถูกถอดออกแล้ว"). */
export function useMembers(status: "active" | "all"): UseQueryResult<
  { items: MemberRow[]; nextCursor: string | null },
  unknown
> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  return useQuery({
    // `status` is part of the key: the two answers are different data, and
    // sharing a key would show the active list while `all` was in flight.
    queryKey: orgKey(orgId, "members", status),
    queryFn: () =>
      unwrap(
        client.GET("/orgs/{orgId}/members", {
          params: { path: { orgId }, query: { status } },
        }),
      ) as Promise<{ items: MemberRow[]; nextCursor: string | null }>,
  });
}

export function useInvitations(status: "pending" | "all"): UseQueryResult<
  { items: InvitationRow[]; nextCursor: string | null },
  unknown
> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  return useQuery({
    queryKey: orgKey(orgId, "invitations", status),
    queryFn: () =>
      unwrap(
        client.GET("/orgs/{orgId}/invitations", {
          params: { path: { orgId }, query: { status } },
        }),
      ) as Promise<{ items: InvitationRow[]; nextCursor: string | null }>,
  });
}

/** The shop's roles, for the invite and change-role pickers (§3.6). */
export function useRoles(): UseQueryResult<
  { items: components["schemas"]["RoleRow"][]; nextCursor: string | null },
  unknown
> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  return useQuery({
    queryKey: orgKey(orgId, "roles"),
    queryFn: () =>
      unwrap(client.GET("/orgs/{orgId}/roles", { params: { path: { orgId } } })) as Promise<{
        items: components["schemas"]["RoleRow"][];
        nextCursor: string | null;
      }>,
  });
}
