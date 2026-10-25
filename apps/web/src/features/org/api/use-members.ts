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

type Page<T> = { items: T[]; nextCursor: string | null };

/** The API's page maximum (`LimitParam`, clamped to 100). */
const PAGE_LIMIT = 100;
/**
 * R6 reads at most this many pages per list. Past it the result keeps a
 * non-null `nextCursor`, and the screen must treat the list as INCOMPLETE
 * (no "nobody left" / empty-section claims). A role ceiling of 30 and a
 * normal shop make reaching it unrealistic, but a loop with no bound is a
 * request storm waiting for a server bug.
 */
export const MAX_FILTER_PAGES = 20;

/**
 * ★ T-003-W10 fix r1 (security review M-1) — follow `nextCursor` to the end.
 *
 * R6 makes claims about the WHOLE list ("ไม่มีใครใช้บทบาทนี้แล้ว — กลับไปลบ
 * บทบาทได้เลย"), so the first page alone can't back them. The returned
 * `nextCursor` is `null` only when the list was read to the end.
 */
export async function collectPages<T>(
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  maxPages: number = MAX_FILTER_PAGES,
): Promise<Page<T>> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    if (page.nextCursor === null) return { items, nextCursor: null };
    cursor = page.nextCursor;
  }
  return { items, nextCursor: cursor ?? null };
}

/** `active` by default; `all` adds revoked rows (§7's "แสดงสมาชิกที่ถูกถอดออกแล้ว"). */
/**
 * `roleId` — T-003-W10 · R6: only holders of that role (api-spec §4.2b, ANDed
 * with `status`). Part of the key: a filtered page is different data.
 */
export function useMembers(
  status: "active" | "all",
  roleId?: string,
): UseQueryResult<{ items: MemberRow[]; nextCursor: string | null }, unknown> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  return useQuery({
    // `status` is part of the key: the two answers are different data, and
    // sharing a key would show the active list while `all` was in flight.
    queryKey: orgKey(orgId, "members", status, roleId ?? null),
    // See the header: this list reports what somebody else did, so it is never
    // fresh just because we fetched it recently.
    staleTime: 0,
    queryFn: () => {
      if (!roleId) {
        return unwrap(
          client.GET("/orgs/{orgId}/members", { params: { path: { orgId }, query: { status } } }),
        ) as Promise<Page<MemberRow>>;
      }
      // R6 — the whole filtered list (see `collectPages`).
      return collectPages(
        (cursor) =>
          unwrap(
            client.GET("/orgs/{orgId}/members", {
              params: {
                path: { orgId },
                query: { status, roleId, limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
              },
            }),
          ) as Promise<Page<MemberRow>>,
      );
    },
  });
}

/**
 * `open` (R6 only, needs `roleId`) = `pending` + `expired` — the invitations
 * still holding the role (AC-3.9, the number `ROLE_IN_USE` quotes). The server
 * filters each status itself, so accepted/cancelled history is never paged
 * through on the client.
 */
export function useInvitations(
  status: "pending" | "all" | "open",
  roleId?: string,
): UseQueryResult<{ items: InvitationRow[]; nextCursor: string | null }, unknown> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  return useQuery({
    queryKey: orgKey(orgId, "invitations", status, roleId ?? null),
    // See the header: this list reports what somebody else did, so it is never
    // fresh just because we fetched it recently.
    staleTime: 0,
    queryFn: async () => {
      if (!roleId) {
        return unwrap(
          client.GET("/orgs/{orgId}/invitations", {
            params: { path: { orgId }, query: { status: status === "open" ? "pending" : status } },
          }),
        ) as Promise<Page<InvitationRow>>;
      }
      const all = (s: "pending" | "expired" | "all") =>
        collectPages(
          (cursor) =>
            unwrap(
              client.GET("/orgs/{orgId}/invitations", {
                params: {
                  path: { orgId },
                  query: { status: s, roleId, limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
                },
              }),
            ) as Promise<Page<InvitationRow>>,
        );
      if (status !== "open") return all(status);
      const [pending, expired] = await Promise.all([all("pending"), all("expired")]);
      return {
        items: [...pending.items, ...expired.items],
        // Incomplete if EITHER half is.
        nextCursor: pending.nextCursor ?? expired.nextCursor,
      };
    },
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
