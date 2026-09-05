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
import { OrgBusyError, toOrgBusyError } from "@omnistock/db";

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
 *
 * ⚠️ TWO INPUT SHAPES, AND THE SECOND ONE IS THE COMMON ONE (T-002-18).
 * `toOrgBusyError` classifies a RAW driver error. But every §5 write goes
 * through `runInOrgLockTransaction`, which classifies the error ITSELF and
 * rethrows a ready-made `OrgBusyError` — an object that carries no `code` and no
 * `meta`, so re-classifying it returns `null`. Handling only the raw shape meant
 * every real contention on a membership/invitation write reached the filter's
 * fallback and was rendered `500 INTERNAL`: exactly the outcome architecture
 * §5.2 and @qa's I-C-10 forbid, and invisible until an endpoint that actually
 * takes the lock existed to prove it.
 */
export function describeOrgBusy(error: unknown): OrgBusyDescription | null {
  const busy = asOrgBusyError(error) ?? toOrgBusyError(error);
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

/**
 * An error that IS already an `OrgBusyError`, or `null`.
 *
 * `instanceof` first (the normal case: one `@omnistock/db` instance in the
 * process), then a structural check — the fields it needs are exactly the ones
 * the class exposes, and if `packages/db` is ever loaded twice (two resolutions,
 * a bundled worker) a failed `instanceof` would silently turn every contention
 * back into a 500. Falling back on shape keeps the wire answer right in a
 * situation nobody would think to test.
 */
function asOrgBusyError(error: unknown): OrgBusyError | null {
  if (error instanceof OrgBusyError) return error;
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as Partial<OrgBusyError>;
  const looksRight =
    candidate.name === "OrgBusyError" &&
    typeof candidate.httpStatus === "number" &&
    typeof candidate.errorCode === "string" &&
    typeof candidate.details === "object" &&
    candidate.details !== null;
  return looksRight ? (error as OrgBusyError) : null;
}
