/**
 * T-003-W09 — a refused `DELETE /orgs/{orgId}/roles/{roleId}` → what R5 shows
 * and what it re-reads (ux-wireframe R5 + §E "Route บทบาท (R3/R4/R5)").
 *
 * Pure. Copy comes from `../role-copy` (ux-owned) — never the server's
 * `message`. The codes R3 shares (403 refusals that STAY on the screen,
 * `ROLE_WRITES_DISABLED`, `ROLE_LOCKED`, busy, 429, FORBIDDEN) reuse
 * {@link classifyRoleWriteFailure}; only the generic sentence differs
 * ("ลบบทบาทไม่สำเร็จ…" instead of "บันทึกบทบาทไม่สำเร็จ…").
 */
import { ApiRequestError, toApiFailure } from "../../../lib/api/error";
import { roleFormErrorMessage } from "../role-copy";
import { classifyRoleWriteFailure, type RoleRefetchTarget } from "./role-write-failure";

export interface RoleUsageCounts {
  readonly activeMembers: number;
  readonly pendingInvitations: number;
}

export type RoleDeleteFailure =
  /** `409 ROLE_IN_USE` → R5 (ข). `usage` null = `details` unusable (no invented numbers). */
  | { kind: "in-use"; usage: RoleUsageCounts | null }
  /** `409 ROLE_HISTORY_LIMIT_REACHED` → in the dialog, confirm disabled. */
  | { kind: "history-limit"; message: string }
  /** `404` → "บทบาทนี้ถูกลบไปแล้ว" + R1. */
  | { kind: "gone" }
  | { kind: "banner"; message: string; refetch: RoleRefetchTarget[] }
  | { kind: "throttled"; seconds: number }
  | { kind: "forbidden" };

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

export function classifyRoleDeleteFailure(err: unknown): RoleDeleteFailure {
  const failure = toApiFailure(err);
  const details = err instanceof ApiRequestError ? err.details : undefined;
  const code = "code" in failure ? failure.code : undefined;
  const generic: RoleDeleteFailure = {
    kind: "banner",
    message: roleFormErrorMessage("__unmapped__", { action: "delete" }),
    refetch: [],
  };

  if (failure.kind === "conflict" && code === "ROLE_IN_USE") {
    const usage =
      isCount(details?.activeMembers) && isCount(details?.pendingInvitations)
        ? { activeMembers: details.activeMembers, pendingInvitations: details.pendingInvitations }
        : null;
    return { kind: "in-use", usage };
  }
  if (failure.kind === "conflict" && code === "ROLE_HISTORY_LIMIT_REACHED") {
    const limit = typeof details?.limit === "number" ? details.limit : null;
    return { kind: "history-limit", message: roleFormErrorMessage(code, { limit }) };
  }

  const shared = classifyRoleWriteFailure(err);
  switch (shared.kind) {
    case "not-found":
      return { kind: "gone" };
    case "forbidden":
      return { kind: "forbidden" };
    case "throttled":
      return shared;
    case "banner": {
      // classifyRoleWriteFailure's own fallback is the SAVE sentence; a known
      // code keeps its message, anything it did not recognise gets ours.
      const known =
        failure.kind === "busy" ||
        code === "ROLE_LOCKED" ||
        code === "ROLE_EXCEEDS_ACTOR" ||
        code === "TARGET_NOT_BELOW_ACTOR" ||
        code === "ROLE_HELD_REQUIRES_MANAGE_MEMBERS" ||
        code === "ROLE_WRITES_DISABLED";
      return known ? { kind: "banner", message: shared.message, refetch: shared.refetch } : generic;
    }
    default:
      // "field" / "role-changed" cannot come from a DELETE — treat as generic.
      return generic;
  }
}
