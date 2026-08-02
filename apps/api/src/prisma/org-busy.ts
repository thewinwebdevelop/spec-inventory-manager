// F-002 · T-002-09 — the adapter that lets the wire layer answer 409 busy
// without knowing anything about Postgres.
//
// WHY THIS FILE EXISTS AT ALL
// `DomainExceptionFilter` lives in `common/`, and `common/` may not import
// `@omnistock/db` — the boundary gate (`api-db-client-allowlisted`) allows that
// only from `prisma/`, `tenancy/`, `health/`, `auth/`. The first attempt put
// `instanceof OrgBusyError` straight in the filter and the gate refused it,
// correctly: a shared middle layer that imports the DB package today is a
// shared middle layer that reaches for `PrismaClient` tomorrow.
//
// So the knowledge stays here, next to the database layer, and what crosses the
// boundary is a plain description with no Prisma types in it. `packages/db`
// already decided the status/code/details (§5.2); this only carries the verdict.
import { toOrgBusyError } from "@omnistock/db";

/** A contention verdict, in terms the wire layer can render on its own. */
export interface OrgBusyDescription {
  readonly status: number;
  readonly code: string;
  /** `{ reason: "busy" }` — the client's cue to retry. */
  readonly details: Readonly<Record<string, unknown>>;
  /**
   * `true` ⇒ log at `error`. §5.1's uniform lock order means a deadlock or
   * serialization failure is somebody's off-policy transaction, i.e. a bug —
   * not load to ride out.
   */
  readonly alert: boolean;
  /** SQLSTATE / Prisma code. LOG ONLY — must never reach a response body. */
  readonly diagnostic: Readonly<Record<string, unknown>>;
  readonly summary: string;
}

/**
 * Describe `error` when it is lock/transaction contention, else `null`.
 *
 * `55P03` (lock_timeout), `40P01` (deadlock), `40001` (serialization) and
 * Prisma's `P2028` / pool timeout are the database telling us to back off. Left
 * unclassified they surface as 500s: on-call paged for ordinary contention, and
 * — on admin-reset — a status that stands out against an otherwise uniform 404.
 */
export function describeOrgBusy(error: unknown): OrgBusyDescription | null {
  const busy = toOrgBusyError(error);
  if (!busy) return null;
  return {
    status: busy.httpStatus,
    code: busy.errorCode,
    details: busy.details,
    alert: busy.alert,
    diagnostic: busy.diagnostic,
    summary: `${busy.name}: ${busy.message}`,
  };
}
