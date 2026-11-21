/**
 * T-003-W06 — a refused POST/PATCH on a role → where R3 shows it and what it
 * re-reads (ux-wireframe §E "Route บทบาท (R3/R4/R5)").
 *
 * Pure: the screen performs the `refetch` list and renders by `kind`. Copy
 * comes from `../role-copy` (ux-owned) — never the server's `message`.
 *
 * ⛔ `role-changed` carries NOTHING to resubmit with. `details.currentVersion`
 * exists on the wire, and using it to retry is exactly the last-write-wins
 * AC-3.12 forbids (SR-14) — so it is deliberately not read here at all.
 */
import { ApiRequestError, toApiFailure } from "../../../lib/api/error";
import { bannerReasonCopy, roleFormErrorMessage, roleNameFieldErrorMessage } from "../role-copy";

export type RoleRefetchTarget = "role" | "catalog" | "list" | "profile";

export type RoleWriteFailure =
  | { kind: "role-changed" }
  | { kind: "field"; field: "name" | "capabilities"; message: string }
  | {
      kind: "banner";
      message: string;
      refetch: RoleRefetchTarget[];
      /** Keys to untick (`UNKNOWN_CAPABILITY.details.capabilities`). */
      untick?: string[];
    }
  | { kind: "throttled"; seconds: number }
  | { kind: "forbidden" }
  | { kind: "not-found" };

const DEFAULT_RETRY_AFTER_SECONDS = 60;

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function classifyRoleWriteFailure(err: unknown): RoleWriteFailure {
  const failure = toApiFailure(err);
  const details = err instanceof ApiRequestError ? err.details : undefined;
  const code = "code" in failure ? failure.code : undefined;
  const generic: RoleWriteFailure = {
    kind: "banner",
    message: roleFormErrorMessage("__unmapped__", { action: "save" }),
    refetch: [],
  };

  switch (failure.kind) {
    case "throttled":
      return {
        kind: "throttled",
        seconds: failure.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS,
      };
    case "busy":
      return { kind: "banner", message: roleFormErrorMessage("CONFLICT"), refetch: [] };
    case "not-found":
      return { kind: "not-found" };
    case "validation":
      if (code === "ROLE_EMPTY") {
        return {
          kind: "field",
          field: "capabilities",
          message: roleFormErrorMessage("ROLE_EMPTY"),
        };
      }
      if (code === "UNKNOWN_CAPABILITY") {
        return {
          kind: "banner",
          message: roleFormErrorMessage("UNKNOWN_CAPABILITY"),
          refetch: ["catalog"],
          untick: stringList(details?.capabilities),
        };
      }
      if (code === "FULL_ACCESS_RESERVED") {
        return { kind: "banner", message: roleFormErrorMessage(code), refetch: [] };
      }
      if (failure.fieldErrors.name !== undefined) {
        return { kind: "field", field: "name", message: roleNameFieldErrorMessage() };
      }
      return generic;
    case "conflict":
      if (code === "ROLE_CHANGED") return { kind: "role-changed" };
      if (code === "ROLE_NAME_TAKEN") {
        return { kind: "field", field: "name", message: roleFormErrorMessage(code) };
      }
      if (code === "ROLE_LIMIT_REACHED") {
        const limit = typeof details?.limit === "number" ? details.limit : null;
        return {
          kind: "banner",
          message: roleFormErrorMessage(code, { limit }),
          refetch: ["list"],
        };
      }
      if (code === "ROLE_LOCKED") {
        return { kind: "banner", message: roleFormErrorMessage(code), refetch: ["role", "list"] };
      }
      return generic;
    case "forbidden":
      if (code === "ROLE_EXCEEDS_ACTOR") {
        return {
          kind: "banner",
          message: roleFormErrorMessage(code),
          refetch: ["profile", "role", "list"],
        };
      }
      // Both STAY on the screen (unlike FORBIDDEN): re-read and the role shows
      // read-only with the matching reason (api-spec §5).
      if (code === "TARGET_NOT_BELOW_ACTOR" || code === "ROLE_HELD_REQUIRES_MANAGE_MEMBERS") {
        return { kind: "banner", message: roleFormErrorMessage(code), refetch: ["role", "list"] };
      }
      return { kind: "forbidden" };
    case "server":
      if (code === "ROLE_WRITES_DISABLED") {
        return {
          kind: "banner",
          message: bannerReasonCopy("writes_disabled").body,
          refetch: ["role", "list"],
        };
      }
      return generic;
    default:
      return generic;
  }
}
