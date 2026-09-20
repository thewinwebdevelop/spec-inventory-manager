"use client";

/**
 * T-002-W5 — the writes behind S6/S7 (api-spec §3.8/§3.9/§3.11/§3.12/§3.13).
 *
 * Every one of them invalidates the member and invitation lists rather than
 * patching the cache by hand: these responses can change a row the client did
 * not ask about (revoking a member also cancels their pending invitations,
 * I-1), so a hand-patched cache would drift from the server in exactly the
 * places that matter.
 *
 * None of them retries. `useMutation` defaults to `retry: false`
 * (query-client.ts) and this is the family where it counts — there is no
 * `Idempotency-Key` yet, so a retried invite is a second invitation and a
 * retried reissue is a second token rotation.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { components } from "@omnistock/contracts";
import { useOrgApiClient } from "../../../lib/api/use-org-api-client";
import { useActiveOrg } from "../../../lib/org/org-context";
import { unwrap } from "../../../lib/api/clients";
import { orgKey, MY_ORGANIZATIONS_KEY } from "../../../lib/org/org-keys";

export type IssuedInvitation = components["schemas"]["IssuedInvitation"];
export type ReissuedLink = components["schemas"]["ReissuedLink"];

/** Everything S6 shows is derived from these two lists plus the profile. */
function useInvalidateMembers() {
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orgKey(orgId, "members") });
    void queryClient.invalidateQueries({ queryKey: orgKey(orgId, "invitations") });
    // `counts` on the profile drives S4's team row and the onboarding card.
    void queryClient.invalidateQueries({ queryKey: orgKey(orgId, "profile") });
  };
}

export function useCreateInvitation(): UseMutationResult<
  IssuedInvitation,
  unknown,
  { email: string; roleId: string }
> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (body) =>
      unwrap(
        client.POST("/orgs/{orgId}/invitations", { params: { path: { orgId } }, body }),
      ) as Promise<IssuedInvitation>,
    onSuccess: invalidate,
  });
}

export function useReissueInvitationLink(): UseMutationResult<ReissuedLink, unknown, string> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (invitationId) =>
      unwrap(
        client.POST("/orgs/{orgId}/invitations/{invitationId}/link", {
          params: { path: { orgId, invitationId } },
        }),
      ) as Promise<ReissuedLink>,
    onSuccess: invalidate,
  });
}

export function useCancelInvitation(): UseMutationResult<unknown, unknown, string> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (invitationId) =>
      unwrap(
        client.DELETE("/orgs/{orgId}/invitations/{invitationId}", {
          params: { path: { orgId, invitationId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useChangeMemberRole(): UseMutationResult<
  unknown,
  unknown,
  { userId: string; roleId: string }
> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: ({ userId, roleId }) =>
      unwrap(
        client.PATCH("/orgs/{orgId}/members/{userId}", {
          params: { path: { orgId, userId } },
          body: { roleId },
        }),
      ),
    onSuccess: () => {
      invalidate();
      // Changing your OWN role changes what the shell may offer, and the shell
      // reads capabilities from the profile — already invalidated above.
    },
  });
}

export function useRemoveMember(): UseMutationResult<unknown, unknown, string> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (userId) =>
      unwrap(
        client.DELETE("/orgs/{orgId}/members/{userId}", {
          params: { path: { orgId, userId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

/** §3.17/D-029 — leaving is a different endpoint from being removed. */
export function useLeaveOrganization(): UseMutationResult<unknown, unknown, void> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(client.DELETE("/orgs/{orgId}/membership", { params: { path: { orgId } } })),
    onSuccess: () => {
      // You are no longer in this shop, so its cache is not yours to keep —
      // and the shop list must lose it before the picker renders.
      queryClient.removeQueries({ queryKey: orgKey(orgId) });
      void queryClient.invalidateQueries({ queryKey: MY_ORGANIZATIONS_KEY });
    },
  });
}
