// R1 (refactor-plan §4) — global exception filter (backend.md §3.5).
//
// The single wire-envelope authority. Every thrown error becomes
// `{ error: { code, message, details?, fieldErrors?, traceId? } }`:
//
//   1. `DomainException`      → its registry code/status/message + any
//                               details/fieldErrors + response headers it carries.
//   2. other `HttpException`  → if it already carries our envelope (F-001's guards
//                               / ValidationPipe / RateLimitedException) reuse it
//                               verbatim; a foreign one (no envelope) is mapped by
//                               status (defensive — nothing in F-001 hits this).
//   3. anything else (unknown)→ 500 `INTERNAL`, full detail logged server-side,
//                               ZERO internals leaked to the client.
//
// `traceId` is additive + OPTIONAL (§3.5): it is emitted only when the request
// carries an upstream correlation id (`x-request-id` / `x-trace-id`, the gateway
// convention) — so error responses for existing traffic stay byte-identical
// (status/code/message/headers) while support correlation works when a gateway
// injects the id.
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ERROR_CODES, codeForStatus } from "./error-codes";
import { DomainException, type DomainErrorBody } from "./domain-exception";

/** Wire envelope shape (the `error` object may carry the optional §3.5 fields). */
interface WireEnvelope {
  error: DomainErrorBody & { traceId?: string };
}

/**
 * Correlation ids are echoed back into error bodies, so an unvalidated header
 * would let any client stuff arbitrary-length noise into every error response
 * (★ sanity-pass finding, 2026-07-11). Gateway-style ids (UUID, hex, dotted)
 * all fit this shape; anything else is dropped, not truncated.
 */
const TRACE_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/** Read an upstream correlation id, if any. Returns undefined when absent/invalid. */
export function extractTraceId(req: Request | undefined): string | undefined {
  if (!req?.headers) return undefined;
  const raw = req.headers["x-request-id"] ?? req.headers["x-trace-id"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && TRACE_ID_PATTERN.test(value) ? value : undefined;
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const traceId = extractTraceId(req);

    // ── 1. Our typed error ────────────────────────────────────────────────
    if (exception instanceof DomainException) {
      this.applyHeaders(res, exception.responseHeaders);
      this.send(res, exception.getStatus(), {
        code: exception.code,
        message: this.messageOf(exception),
        details: exception.details,
        fieldErrors: exception.fieldErrors,
        traceId,
      });
      return;
    }

    // ── 2. Other framework HttpException ──────────────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const envelope = this.fromHttpException(body, status);
      this.send(res, status, { ...envelope, traceId });
      return;
    }

    // ── 3. Unknown → 500 INTERNAL, log full, leak nothing ─────────────────
    this.logger.error(
      "Unhandled non-HTTP exception surfaced to the filter",
      exception instanceof Error ? exception.stack : String(exception),
    );
    this.send(res, HttpStatus.INTERNAL_SERVER_ERROR, {
      code: ERROR_CODES.INTERNAL.code,
      message: ERROR_CODES.INTERNAL.message,
      traceId,
    });
  }

  /** Pull the message out of a DomainException's envelope response. */
  private messageOf(ex: DomainException): string {
    const body = ex.getResponse();
    if (isEnvelope(body)) return body.error.message;
    return ERROR_CODES.INTERNAL.message;
  }

  /**
   * Coerce a framework HttpException's response into our envelope. F-001's
   * guards / pipe / RateLimitedException already carry `{ error: { code,
   * message, ... } }` → reused verbatim. A foreign exception (Nest default
   * `{ statusCode, message, error }`) is mapped by status so nothing leaks.
   */
  private fromHttpException(
    body: unknown,
    status: number,
  ): DomainErrorBody {
    if (isEnvelope(body)) {
      const e = body.error;
      const out: DomainErrorBody = { code: e.code, message: e.message };
      if (e.details) out.details = e.details;
      if (e.fieldErrors) out.fieldErrors = e.fieldErrors;
      return out;
    }
    return {
      code: codeForStatus(status),
      message:
        status >= 500
          ? ERROR_CODES.INTERNAL.message
          : extractPlainMessage(body) ?? ERROR_CODES.INTERNAL.message,
    };
  }

  private applyHeaders(res: Response, headers?: Record<string, string>): void {
    if (!headers) return;
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
  }

  private send(res: Response, status: number, error: DomainErrorBody & { traceId?: string }): void {
    const envelope: WireEnvelope = { error: stripUndefined(error) };
    res.status(status).json(envelope);
  }
}

/** Type guard: is `x` our `{ error: { code, message } }` envelope? */
function isEnvelope(x: unknown): x is { error: DomainErrorBody } {
  if (typeof x !== "object" || x === null) return false;
  const err = (x as { error?: unknown }).error;
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { code?: unknown }).code === "string" &&
    typeof (err as { message?: unknown }).message === "string"
  );
}

/** Best-effort human message from a foreign Nest response (never leaks stack). */
function extractPlainMessage(body: unknown): string | undefined {
  if (typeof body === "string") return body;
  if (typeof body === "object" && body !== null) {
    const msg = (body as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg) && msg.every((m) => typeof m === "string")) return msg.join(", ");
  }
  return undefined;
}

/** Drop undefined optional fields so the emitted JSON omits them entirely. */
function stripUndefined(
  error: DomainErrorBody & { traceId?: string },
): DomainErrorBody & { traceId?: string } {
  const out: DomainErrorBody & { traceId?: string } = {
    code: error.code,
    message: error.message,
  };
  if (error.details !== undefined) out.details = error.details;
  if (error.fieldErrors !== undefined) out.fieldErrors = error.fieldErrors;
  if (error.traceId !== undefined) out.traceId = error.traceId;
  return out;
}
