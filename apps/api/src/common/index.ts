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
export { DomainExceptionFilter, extractTraceId } from "./domain-exception.filter";
