/**
 * S2's error mapping, as a pure function (ux-wireframe §3 "States / error
 * mapping").
 *
 * Split out of the component so the table can be tested as a table. Five of
 * the six rows are distinguishable only by an error code or a `details` key,
 * which is exactly the kind of thing that rots silently inside JSX.
 */
import { toApiFailure, type ApiFailure } from "../../lib/api/error";
import { orgTh } from "./i18n";

export type CreateOrgError =
  /** Inline under the field, focus returns to it. */
  | { readonly kind: "field"; readonly field: "name"; readonly message: string }
  /** Banner above the form. `retry` decides whether it gets a retry button. */
  | { readonly kind: "banner"; readonly message: string; readonly retry: boolean }
  /** ThrottleBanner + the form disabled until the countdown ends. */
  | { readonly kind: "throttled"; readonly retryAfterSeconds: number };

export function toCreateOrgError(error: unknown): CreateOrgError {
  const failure: ApiFailure = toApiFailure(error);

  switch (failure.kind) {
    case "throttled":
      // D-005 forbids "ถูกล็อก/ถูกระงับ" wording; ThrottleBanner owns the copy.
      // Default to 60s when the server sent no Retry-After — a countdown that
      // ends instantly would invite an immediate second create.
      return { kind: "throttled", retryAfterSeconds: failure.retryAfterSeconds ?? 60 };

    case "validation":
      return {
        kind: "field",
        field: "name",
        // Prefer the server's own field message; fall back to ux's copy.
        message: failure.fieldErrors.name ?? orgTh.createOrg.error.name,
      };

    case "conflict":
      if (failure.code === "ORG_LIMIT_REACHED") {
        // `details.limit` carries the real number precisely so the UI never
        // hard-codes it (api-spec §3.1). If it is somehow missing we still
        // must not invent one, so fall back to the generic message.
        const limit = failure.details?.limit;
        return typeof limit === "number"
          ? { kind: "banner", message: orgTh.createOrg.error.limitReached(limit), retry: false }
          : { kind: "banner", message: orgTh.createOrg.error.generic, retry: true };
      }
      return { kind: "banner", message: orgTh.createOrg.error.generic, retry: true };

    case "busy":
      // Not expected on this route (no org lock is taken to create a shop),
      // but the taxonomy can produce it and the central copy is correct.
      return { kind: "banner", message: orgTh.createOrg.error.generic, retry: true };

    case "server":
      return failure.code === "ORG_PROVISIONING_UNAVAILABLE"
        ? // Explicitly "not your fault" — this is our missing plan config.
          { kind: "banner", message: orgTh.createOrg.error.provisioning, retry: true }
        : { kind: "banner", message: orgTh.createOrg.error.generic, retry: true };

    default:
      return { kind: "banner", message: orgTh.createOrg.error.generic, retry: true };
  }
}
