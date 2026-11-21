"use client";

/**
 * T-003-W06 — the two writes behind R3 (api-spec §1/§2, shipped by B23/B24).
 *
 *  - `POST  /orgs/{orgId}/roles`            — create (and clone: same request, pre-filled)
 *  - `PATCH /orgs/{orgId}/roles/{roleId}`   — rename and/or replace capabilities, with `version`
 *
 * ⛔ Never retried (query-client.ts: mutations `retry: false`) and never
 * resubmitted by this module. On `409 ROLE_CHANGED` the screen re-reads the
 * role and lets the PERSON decide (SR-14) — there is no code path here that
 * reads `details.currentVersion`.
 *
 * On success both invalidate the role list (R1) and the caller's profile:
 * editing your OWN role changes your capabilities, and the PATCH response's
 * `viewer.*` was computed with the PRE-edit set (B24 security review) — only
 * a fresh `GET /orgs/{orgId}` tells the truth about what you may do now.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { components } from "@omnistock/contracts";
import { useOrgApiClient } from "../../../../lib/api/use-org-api-client";
import { useActiveOrg } from "../../../../lib/org/org-context";
import { unwrap } from "../../../../lib/api/clients";
import { orgKey } from "../../../../lib/org/org-keys";
import type { RoleDetail } from "./use-role-details";

export type CreateRoleRequest = components["schemas"]["CreateRoleRequest"];
export type UpdateRoleRequest = components["schemas"]["UpdateRoleRequest"];

function useAfterRoleWrite() {
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  return (saved: RoleDetail) => {
    queryClient.setQueryData(orgKey(orgId, "role-detail", saved.id), saved);
    void queryClient.invalidateQueries({ queryKey: orgKey(orgId, "role-details") });
    void queryClient.invalidateQueries({ queryKey: orgKey(orgId, "profile") });
    // The invite / change-role pickers read `GET /roles` (names + verdicts).
    void queryClient.invalidateQueries({ queryKey: orgKey(orgId, "roles") });
  };
}

export function useCreateRole(): UseMutationResult<RoleDetail, unknown, CreateRoleRequest> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  const after = useAfterRoleWrite();
  return useMutation({
    mutationFn: (body) =>
      unwrap(
        client.POST("/orgs/{orgId}/roles", { params: { path: { orgId } }, body }),
      ) as Promise<RoleDetail>,
    onSuccess: after,
  });
}

export function useUpdateRole(
  roleId: string,
): UseMutationResult<RoleDetail, unknown, UpdateRoleRequest> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  const after = useAfterRoleWrite();
  return useMutation({
    mutationFn: (body) =>
      unwrap(
        client.PATCH("/orgs/{orgId}/roles/{roleId}", {
          params: { path: { orgId, roleId } },
          body,
        }),
      ) as Promise<RoleDetail>,
    onSuccess: after,
  });
}
