// R1 — public surface of the cross-cutting `common/` layer (backend.md §2.2).
// Feature modules import error primitives from here, not from deep files.
export {
  ERROR_CODES,
  codeForStatus,
  type ErrorCodeDef,
  type ErrorCodeKey,
} from "./error-codes";
export {
  DomainException,
  domainError,
  type DomainErrorBody,
  type DomainExceptionOptions,
} from "./domain-exception";
// `extractTraceId` is gone on purpose (F-002 §15 row 2 / NEW-7): the trace id is
// server-issued, never read from the request. What the caller sent is only an
// upstream correlation id, and it is used for logging.
export { DomainExceptionFilter, extractUpstreamRequestId } from "./domain-exception.filter";
