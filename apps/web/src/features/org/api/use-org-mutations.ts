"use client";

/**
 * S4/S5's writes: `PATCH /orgs/{orgId}` (name) and
 * `PUT /orgs/{orgId}/tax-profile` (api-spec §3.4/§3.5).
 *
 * Both return the full `OrgProfile` — "one mapper, one shape" — so the
 * response is written straight into the profile cache rather than triggering
 * a refetch. That matters beyond saving a round trip: `OrgGuard` reads
 * `myMembership.capabilities` from that same cache entry, so a partial write
 * would corrupt the thing deciding what the shell may show.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { components } from "@omnistock/contracts";
import { useOrgApiClient } from "../../../lib/api/use-org-api-client";
import { useActiveOrg } from "../../../lib/org/org-context";
import { unwrap } from "../../../lib/api/clients";
import { orgKey, MY_ORGANIZATIONS_KEY } from "../../../lib/org/org-keys";

type OrgProfile = components["schemas"]["OrgProfile"];
export type TaxProfileRequest = components["schemas"]["TaxProfileRequest"];

export function useRenameOrganization(): UseMutationResult<OrgProfile, unknown, string> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      unwrap(client.PATCH("/orgs/{orgId}", { params: { path: { orgId } }, body: { name } })),
    onSuccess: (updated) => {
      queryClient.setQueryData(orgKey(orgId, "profile"), updated);
      // The shop list carries the name too — the switcher would otherwise
      // keep showing the old one until something else invalidated it.
      void queryClient.invalidateQueries({ queryKey: MY_ORGANIZATIONS_KEY });
    },
  });
}

/**
 * THE WHOLE SET OR NOTHING (data-model §3.3): an empty body clears the
 * declaration, a partial one is a 422 naming every missing field. The form
 * therefore always sends every field it collected, never a diff.
 */
export function useSaveTaxProfile(): UseMutationResult<OrgProfile, unknown, TaxProfileRequest> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: TaxProfileRequest) =>
      unwrap(client.PUT("/orgs/{orgId}/tax-profile", { params: { path: { orgId } }, body })),
    onSuccess: (updated) => {
      // Note what is NOT here: the taxId the user just typed. The response
      // carries only `taxIdMasked` (api-spec §3.3 — there is no `taxId` in
      // `TaxProfileView` and there never will be), so writing the response is
      // also what keeps the full number out of the cache.
      queryClient.setQueryData(orgKey(orgId, "profile"), updated);
    },
  });
}
