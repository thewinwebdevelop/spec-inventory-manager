"use client";

/**
 * T-002-W5 — the members and invitations lists behind S6 (api-spec §3.7/§3.10).
 *
 * Both are `manage_members`-gated on the server for the same PDPA reason
 * (D-028/I-8): every row carries somebody else's email address. The screen
 * hides itself without the capability, but that is UX — these calls are
 * refused regardless.
 *
 * ★ B-7 — BOTH OVERRIDE `staleTime`, and this is the one screen where that is
 * right. The app-wide default is 30s (`query-client.ts`), which is a good
 * trade for data that changes when THIS person changes it. These two lists are
 * the exception the default cannot see: the entire feature is waiting for
 * somebody ELSE to accept an invitation, on another machine. Nothing in this
 * tab knows it happened — no mutation here to invalidate, and
 * `refetchOnWindowFocus` does not fire because the tab never lost focus.
 *
 * What that cost, before this: an Owner who invited somebody, sent the link
 * over LINE and came back to the screen saw "คำเชิญที่รอตอบรับ (1)" over
 * "สมาชิกในร้าน (1)" for up to half a minute after the person had joined. The
 * browser lane hit it three times in three different files (E-04, S9, E-07)
 * before it was believed.
 *
 * The price is one extra request when this screen is opened. It buys the two
 * lists whose whole purpose is reporting what other people did.
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
    // See the header: this list reports what somebody else did, so it is never
    // fresh just because we fetched it recently.
    staleTime: 0,
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
    // See the header: this list reports what somebody else did, so it is never
    // fresh just because we fetched it recently.
    staleTime: 0,
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
