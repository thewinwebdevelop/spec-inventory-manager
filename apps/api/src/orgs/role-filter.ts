// F-003 · T-003-B22 — `?roleId=` on `GET /members` and `GET /invitations`
// (api-spec §3.1 "กรองตาม role" · §4.2b). A filter on the stored column only —
// no Role read, so a soft-deleted role still filters (its holders' history) and
// another shop's role id simply matches nothing under `ORG_PRISMA` (200, empty
// page — not an existence oracle).
import { domainError } from "../common";

/** OpenAPI `maxLength` of the param. */
export const ROLE_ID_FILTER_MAX_LENGTH = 64;
export const ROLE_ID_FILTER_INVALID_MESSAGE = "ตัวกรองบทบาทไม่ถูกต้อง";

/** Absent/empty → no filter. Repeated (array) or over-long → `422 VALIDATION_FAILED`. */
export function resolveRoleIdFilter(raw: unknown): string | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string" || raw.length > ROLE_ID_FILTER_MAX_LENGTH) {
    throw domainError("VALIDATION_FAILED", {
      fieldErrors: { roleId: ROLE_ID_FILTER_INVALID_MESSAGE },
    });
  }
  return raw;
}
