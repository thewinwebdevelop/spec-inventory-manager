/**
 * Web track restart point (web.md §3.1, refactor-plan §5) — the single
 * TanStack Query client for the app.
 *
 * The defaults here are not taste. Two of them are safety properties:
 *
 * 1. **Mutations never auto-retry.** api-spec §1 item 20: `Idempotency-Key`
 *    does not exist yet (it arrives with the F-011 interceptor), and the
 *    server does not retry on our behalf either. An automatic retry of
 *    `POST …/invitations` or `DELETE …/members/{userId}` would be the client
 *    inventing a duplicate write that nothing downstream can collapse. The UI
 *    answer is the documented one: disable the button while in flight and let
 *    the PERSON press again.
 *
 * 2. **Queries retry only what a retry can fix.** A 403/404/409/422 is a
 *    decision the server already made; repeating the request produces the
 *    same answer three times, delays the error the user needs to see, and —
 *    for `ORG_ACCESS_DENIED` — keeps hammering an org the user was just
 *    removed from. Only `network` and `server` are retried.
 */
import { QueryClient } from "@tanstack/react-query";
import { toApiFailure } from "./error";

export const MAX_QUERY_RETRIES = 2;

/**
 * `retry` predicate for queries. Exported so it can be tested directly and
 * reused by a feature that overrides other options but must keep this rule.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  const kind = toApiFailure(error).kind;
  return kind === "network" || kind === "server";
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        // Org data changes because a person changed it, often in another tab
        // or on their phone — refetching when the window regains focus is the
        // cheap version of "real-time-ish" that web.md §3.7 settles on
        // instead of a WebSocket.
        refetchOnWindowFocus: true,
        // Long enough that tabbing back and forth does not restorm the API,
        // short enough that a member list is not visibly stale.
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
