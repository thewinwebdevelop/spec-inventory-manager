"use client";

/**
 * `POST /organizations` (api-spec §3.1) — S2's only call.
 *
 * The 201 body is deliberately complete enough to enter the new shop without
 * a second round-trip (ux Q5), so on success we seed the org-profile cache
 * from it and invalidate the shop LIST (so the switcher is right next time)
 * — rather than refetching both.
 *
 * No retry, ever: `useMutation`'s default is already `retry: false`
 * (query-client.ts) and this is the call it matters most for. There is no
 * `Idempotency-Key` yet (api-spec §1 item 20), so a retried create is a
 * second shop.
 */
import { useMemo } from "react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { components } from "@omnistock/contracts";
import { createUserApiClient, unwrap } from "../../../lib/api/clients";
import { MY_ORGANIZATIONS_KEY, orgKey } from "../../../lib/org/org-keys";

export type CreatedOrganization = components["schemas"]["CreatedOrganization"];

export function useCreateOrganization(): UseMutationResult<CreatedOrganization, unknown, string> {
  const client = useMemo(() => createUserApiClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      unwrap(
        client.POST("/organizations", {
          // No `timezone`: the server applies Asia/Bangkok when it is absent
          // (api-spec §3.1) and S2 deliberately does not ask. It used to be
          // sent because the generated type made it REQUIRED — a `default:`
          // on an optional request property, which openapi-typescript turns
          // into a mandatory field. The contract now states the default in
          // prose, so the server owns it and both clients stopped pinning it.
          body: { name },
        }),
      ),
    onSuccess: (created) => {
      // The switcher must include the new shop the next time it is opened.
      void queryClient.invalidateQueries({ queryKey: MY_ORGANIZATIONS_KEY });
      // NOTE: the org-profile cache is NOT seeded from this body. The 201's
      // `NewOrganization` is a different shape from `OrgProfile` (no
      // `myMembership`, no `counts`, no `taxProfile`) — writing it into that
      // cache key would put an object of the wrong shape where `OrgGuard`
      // reads `profile.myMembership.capabilities`. The one extra GET on
      // entering a brand-new shop is worth not faking a type.
      void queryClient.invalidateQueries({ queryKey: orgKey(created.organization.id) });
    },
  });
}
