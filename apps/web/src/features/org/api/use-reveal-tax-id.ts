"use client";

/**
 * T-002-W4 ★ — `POST /orgs/{orgId}/tax-profile/reveal` (api-spec §3.16).
 *
 * This is the only response in the entire system that carries a full tax id,
 * and with `entityType: "personal"` that number IS the owner's national ID.
 * The contract says it in as many words: hold it in screen memory only, never
 * persist it, never log it, and re-request it if the user hides and re-shows.
 *
 * ── Why this is a mutation and not a query ────────────────────────────────
 * `useQuery` would be wrong in three separate ways, each of which defeats
 * something the server does on purpose:
 *
 *  1. TanStack caches query results. A cached TIN outlives the screen, and
 *     survives in the devtools cache inspector — that is "persisted" by any
 *     reasonable reading of the rule, even without touching storage.
 *  2. `refetchOnWindowFocus` (our default) would re-reveal the number every
 *     time the user tabs back, silently burning the 20/hour budget and
 *     emitting an `org.tax_profile.revealed` audit event nobody asked for.
 *  3. A query is declarative — it runs because the component rendered. The
 *     wireframe is explicit that revealing is "การกระทำที่ตั้งใจ": it happens
 *     because a person pressed a button.
 *
 * So: a mutation, whose result the caller holds in `useState` and drops on
 * hide. Nothing here writes to a cache.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import type { components } from "@omnistock/contracts";
import { useOrgApiClient } from "../../../lib/api/use-org-api-client";
import { useActiveOrg } from "../../../lib/org/org-context";
import { unwrap } from "../../../lib/api/clients";

export type TaxIdReveal = components["schemas"]["TaxIdReveal"];

/**
 * ★ The header this request cannot go without.
 *
 * `POST …/tax-profile/reveal` takes NO body — the caller and the shop are both
 * in the request already — so `openapi-fetch` sent no `Content-Type`, and the
 * route sits behind `JsonOnlyGuard`, which requires `application/json` on
 * anything it guards. The result was `415 UNSUPPORTED_MEDIA_TYPE`, mapped by
 * the card to "ขอดูเลขเต็มไม่สำเร็จ": pressing "แสดงเลขเต็ม" failed for
 * everybody, always, and the one screen in F-002 that shows a full tax id was
 * unreachable. Found by E-14 in the browser lane; every unit test on both
 * sides passed, because each mocked the other one's half.
 *
 * It is the only bodyless route behind that guard today. Filed for
 * backend-api/security-reviewer: whether a bodyless POST should have to
 * declare a content type at all is their call, and the next such route will
 * meet the same wall.
 */
const JSON_CONTENT_TYPE = { "Content-Type": "application/json" } as const;

export function useRevealTaxId(): UseMutationResult<TaxIdReveal, unknown, void> {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();

  return useMutation({
    mutationFn: () =>
      unwrap(
        client.POST("/orgs/{orgId}/tax-profile/reveal", {
          params: { path: { orgId } },
          headers: JSON_CONTENT_TYPE,
        }),
      ),
    // No `onSuccess` cache write, deliberately — see the note above. If you
    // are here to add one, the number you are about to cache is somebody's
    // national ID.
    gcTime: 0,
  });
}
