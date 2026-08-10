"use client";

/**
 * T-002-W6 — `POST /invitations/preview` and `POST /invitations/accept`
 * (api-spec §3.14/§3.15).
 *
 * Both are POSTs precisely so the token travels in the BODY. The contract says
 * why, in as many words: "in a query string it would land in access logs, in
 * every proxy in front of us, and in the `Referer` of anything the invite page
 * loads" (I-6).
 *
 * Both use `createUserApiClient`. Sending `X-Organization-Id` here would be
 * nonsense as well as unsafe — the whole point of preview is that the caller
 * is not in the shop yet and may not even have an account.
 *
 * ── Why preview is a mutation ─────────────────────────────────────────────
 * It reads, so `useQuery` looks right, and would be wrong for the same reason
 * as the TIN reveal: the token would land in the query cache (and the devtools
 * cache inspector), and `refetchOnWindowFocus` would re-send it on every tab
 * switch, spending the preview rate limit for nothing. A mutation keeps the
 * result in the caller's own state and the token in a ref.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useMemo } from "react";
import type { components } from "@omnistock/contracts";
import { createUserApiClient, unwrap } from "../../../lib/api/clients";

export type InvitationPreview = components["schemas"]["InvitationPreview"];
export type InvitationAcceptResult = components["schemas"]["InvitationAcceptResult"];

export function useInvitationPreview(): UseMutationResult<InvitationPreview, unknown, string> {
  const client = useMemo(() => createUserApiClient(), []);
  return useMutation({
    mutationFn: (token: string) =>
      unwrap(client.POST("/invitations/preview", { body: { token } })) as Promise<InvitationPreview>,
    // Nothing cached: the request body held a live credential.
    gcTime: 0,
  });
}

export function useAcceptInvitation(): UseMutationResult<InvitationAcceptResult, unknown, string> {
  const client = useMemo(() => createUserApiClient(), []);
  return useMutation({
    mutationFn: (token: string) =>
      unwrap(client.POST("/invitations/accept", { body: { token } })) as Promise<InvitationAcceptResult>,
    gcTime: 0,
  });
}
