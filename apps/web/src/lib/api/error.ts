/**
 * T-002-W2 ★ — the central client failure taxonomy (web.md §3.4, R3).
 *
 * Every org-scoped call funnels its rejection through `toApiFailure()`, and
 * every screen decides from the resulting `kind`. `error-messages.ts` (F-001,
 * signup/login/change-password) is NOT replaced: it stays as the
 * feature-specific layer that sits on top of this generic fallback, exactly
 * as web.md §3.4 describes.
 *
 * ── Two shapes here deliberately differ from web.md's sketch ───────────────
 *
 * 1. `org-access-denied` is its OWN kind, not `{ kind: "forbidden", code }`.
 *    api-spec §4 and ux-wireframe §12 both say the two 403s must not share a
 *    handler: `ORG_ACCESS_DENIED` throws away the org context, navigates to
 *    the shop picker and refetches `/me/organizations`; `FORBIDDEN` stays put
 *    and toasts. With one `forbidden` kind carrying a code, a screen that
 *    forgets to look at the code silently gets the WRONG behaviour — and the
 *    wrong one is the destructive direction (kicking somebody out of a shop
 *    they are still a member of, or worse, leaving them on a page whose data
 *    they may no longer read). Two kinds make the omission a TypeScript error
 *    instead: "ลืมแล้วพัง ไม่ใช่ลืมแล้วรั่ว", the same principle the API's
 *    route tiers are built on.
 *
 * 2. `busy` is its own kind rather than a flag on `conflict`. ux-wireframe
 *    §1.4 requires `reason === "busy"` to be checked BEFORE any screen's own
 *    409 copy ("คำเชิญนี้ไม่ได้รออยู่แล้ว" must never be shown for lock
 *    contention). A separate kind makes the ordering structural. This changes
 *    nothing on the wire — a 409 is still a 409, so the api-spec §1 promise
 *    that "client ที่ไม่รู้จัก reason ก็ทำงานถูก" still holds for anyone
 *    reading the contract; it is only OUR union that names the case.
 */
import { ApiError, SessionExpiredError } from "../auth-client";
import type { ErrorResponse } from "../auth-client";
import { errorsTh } from "../../i18n/errors";

/** Error codes this module has to reason about by name (api-spec §4). */
export const ERROR_CODE = {
  ORG_ACCESS_DENIED: "ORG_ACCESS_DENIED",
  ORG_MISMATCH: "ORG_MISMATCH",
  ORG_CONTEXT_REQUIRED: "ORG_CONTEXT_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
} as const;

/** `details.reason` marking a 409 as temporary lock contention (api-spec §1). */
export const BUSY_REASON = "busy";

export type ApiFailure =
  | { kind: "network" }
  | { kind: "throttled"; retryAfterSeconds?: number }
  /** silent-refresh + retry-once both failed — route to /login. */
  | { kind: "auth-expired" }
  /** 403 ORG_ACCESS_DENIED — not an active member (removed / never was / org
   * does not exist). Leave the org, go to the picker, refetch the org list. */
  | { kind: "org-access-denied" }
  /** 403 FORBIDDEN — a member who may not do THIS. Stay on the page. */
  | { kind: "forbidden"; code?: string }
  /** 403 from the entitlement layer (F-007) — show the upgrade CTA. */
  | { kind: "entitlement"; feature?: string }
  /** 422. `ORG_MISMATCH`/`ORG_CONTEXT_REQUIRED` land here on purpose: they are
   * client bugs, and must never read as "you lost access to this shop". */
  | { kind: "validation"; code?: string; fieldErrors: Readonly<Record<string, string>> }
  /** 409 + `details.reason === "busy"` — temporary, retryable, one copy. */
  | { kind: "busy" }
  /** any other 409 — the screen switches on `code` for its own copy. */
  | { kind: "conflict"; code?: string; details?: Readonly<Record<string, unknown>> }
  | { kind: "not-found"; code?: string }
  | { kind: "server"; code?: string };

/**
 * `ApiError` carrying the parts of the D-025 envelope that F-001 had no use
 * for: `details` (→ `reason: "busy"`, `invitationId`, `limit`) and
 * `fieldErrors`.
 *
 * It EXTENDS `ApiError` rather than replacing it, for one reason: every
 * existing `err instanceof ApiError` check keeps working, and
 * `apps/web/src/lib/auth-client.ts` is ★ security-reviewed KEEP-verbatim
 * (apps/web/CLAUDE.md) — widening its class there would have needed a review
 * round to add two fields nothing in F-001 reads.
 */
export class ApiRequestError extends ApiError {
  readonly details?: Readonly<Record<string, unknown>>;
  readonly fieldErrors?: Readonly<Record<string, string>>;

  constructor(status: number, body: ErrorResponse | null, retryAfterSeconds?: number) {
    super(status, body, retryAfterSeconds);
    this.name = "ApiRequestError";
    // `details`/`fieldErrors` are already on the generated envelope
    // (ErrorResponse in @omnistock/contracts) — F-001 simply had no case that
    // read them, so `ApiError` never carried them forward.
    this.details = body?.error.details;
    this.fieldErrors = body?.error.fieldErrors;
  }
}

function detailsOf(err: ApiError): Readonly<Record<string, unknown>> | undefined {
  return err instanceof ApiRequestError ? err.details : undefined;
}

function fieldErrorsOf(err: ApiError): Readonly<Record<string, string>> {
  return (err instanceof ApiRequestError ? err.fieldErrors : undefined) ?? {};
}

function fromStatus(err: ApiError): ApiFailure {
  const code = err.code;

  if (err.status === 429) return { kind: "throttled", retryAfterSeconds: err.retryAfterSeconds };
  if (err.status === 401) return { kind: "auth-expired" };

  if (err.status === 403) {
    // Order matters: the specific code first, the catch-all after. A 403 with
    // no code at all is treated as FORBIDDEN — the non-destructive reading.
    if (code === ERROR_CODE.ORG_ACCESS_DENIED) return { kind: "org-access-denied" };
    return { kind: "forbidden", code };
  }

  if (err.status === 404) return { kind: "not-found", code };

  if (err.status === 409) {
    if (detailsOf(err)?.reason === BUSY_REASON) return { kind: "busy" };
    return { kind: "conflict", code, details: detailsOf(err) };
  }

  if (err.status === 422 || err.status === 400) {
    return { kind: "validation", code, fieldErrors: fieldErrorsOf(err) };
  }

  return { kind: "server", code };
}

/**
 * Normalises anything a request can reject with into an `ApiFailure`.
 *
 * A rejection that is not an `ApiError` at all (fetch's `TypeError` on a dead
 * connection, an aborted request, a JSON parse blowing up) is `network`: we
 * never reached a decision from the server, so the user should be told to try
 * again — not told they lack permission.
 */
export function toApiFailure(err: unknown): ApiFailure {
  if (err instanceof SessionExpiredError) return { kind: "auth-expired" };
  if (err instanceof ApiError) return fromStatus(err);
  return { kind: "network" };
}

/**
 * Last-resort Thai message. A screen with its own copy for a case should use
 * that copy — this exists so a screen that has NOT handled a case still shows
 * prose rather than a raw code (design-system.md §3).
 *
 * The `switch` is exhaustive by construction: the `never` binding below fails
 * to compile the day a new `kind` is added without copy for it.
 */
export function failureMessage(failure: ApiFailure): string {
  switch (failure.kind) {
    case "network":
      return errorsTh.network;
    case "throttled":
      // The countdown UI (ThrottleBanner, F-001) owns the real presentation;
      // this is the text-only fallback.
      return errorsTh.network;
    case "auth-expired":
      // Screens route to /login on this kind; the copy lives in authTh.
      return errorsTh.server;
    case "org-access-denied":
      return errorsTh.orgAccessDenied.withoutName;
    case "forbidden":
      return errorsTh.forbidden;
    case "entitlement":
      return errorsTh.forbidden;
    case "validation":
      // ORG_MISMATCH / ORG_CONTEXT_REQUIRED are client bugs, not the user's
      // fault — neutral wording, and NOT "check your input".
      return failure.code === ERROR_CODE.ORG_MISMATCH ||
        failure.code === ERROR_CODE.ORG_CONTEXT_REQUIRED
        ? errorsTh.clientBug
        : errorsTh.validation;
    case "busy":
      return errorsTh.busy;
    case "conflict":
      return errorsTh.conflict;
    case "not-found":
      return errorsTh.notFound;
    case "server":
      return errorsTh.server;
    default: {
      const exhaustive: never = failure;
      return exhaustive;
    }
  }
}

/**
 * True when retrying the very same request could plausibly succeed without
 * the user changing anything. `busy` is the case this was written for
 * (ux-wireframe §1.4: the form keeps its values and the user may press again
 * immediately); a plain `conflict` is NOT retryable — the data really did
 * change underneath.
 */
export function isRetryable(failure: ApiFailure): boolean {
  return failure.kind === "busy" || failure.kind === "network" || failure.kind === "server";
}

/**
 * True when the failure means "you are no longer in this shop", i.e. the app
 * must leave the org context. Deliberately NOT `kind === "forbidden"` — see
 * the note at the top of this file.
 */
export function isOrgAccessDenied(failure: ApiFailure): failure is { kind: "org-access-denied" } {
  return failure.kind === "org-access-denied";
}
