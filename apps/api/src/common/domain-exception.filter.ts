// R1 (refactor-plan §4) — global exception filter (backend.md §3.5).
//
// The single wire-envelope authority. Every thrown error becomes
// `{ error: { code, message, details?, fieldErrors?, traceId } }`:
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
// ── traceId (F-002 architecture §15 row 2 · security-review NEW-7 · qa Q12) ──
// The SERVER issues the trace id, on EVERY error response, for EVERY status
// (401/403/404/409/415/422/429/500). Three properties are load-bearing:
//
//   * random opaque UUID v4 (`crypto.randomUUID`) — never a counter, timestamp,
//     hash of the request, or anything derived from request data. A guessable or
//     ordered id leaks traffic volume and lets one tenant guess another tenant's
//     trace id (NEW-7).
//   * never client-controlled. The previous implementation echoed the client's
//     `x-request-id`/`x-trace-id` back into the body — that is now gone. The
//     response header `X-Request-Id` carries the SERVER-issued value; it is not
//     a reflection of what the client sent.
//   * whatever the client did send is kept as `upstreamRequestId` in the LOG
//     ONLY (validated shape, so a hostile header cannot forge a log line), so
//     a gateway trace can still be joined without giving the client any say in
//     what we emit on the wire.
//
// Every error also emits exactly ONE log line containing the trace id, the code
// and the status, so ops/QA can join a user-reported traceId to the server log
// (4xx at `warn`, 5xx at `error` + stack).
//
// ⚠️ Wire behaviour change that `oasdiff` cannot see: `traceId` stays OPTIONAL in
// the schema, but error bodies are no longer byte-identical to F-001's — any
// test comparing a whole error body (or two error bodies to each other) must
// normalize `traceId` away first (test-plan §9.3 R-01/R-02, I-08).
import { randomUUID } from "node:crypto";
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
import { describeOrgBusy } from "../prisma/org-busy";
import { DomainException, type DomainErrorBody } from "./domain-exception";

/** Wire envelope shape — `traceId` is always present on an error response. */
interface WireEnvelope {
  error: DomainErrorBody & { traceId: string };
}

/** Header carrying the server-issued trace id back to the caller. */
const REQUEST_ID_HEADER = "X-Request-Id";

/**
 * Shape an upstream correlation id must have before it is allowed anywhere near
 * a log line. It is NEVER emitted on the wire, so this is purely a log-injection
 * / log-flood guard: no CRLF, no unbounded length, no control characters.
 * Gateway-style ids (UUID, hex, dotted) all fit; anything else is dropped whole.
 */
const UPSTREAM_REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Read the caller's correlation id (`x-request-id` / `x-trace-id`) for LOGGING
 * ONLY. This value never reaches the response body or headers — see the header
 * note above. Returns undefined when absent, `"<rejected>"` when present but
 * malformed (worth knowing that a gateway sent something we refused, without
 * ever writing the raw bytes into the log).
 */
export function extractUpstreamRequestId(req: Request | undefined): string | undefined {
  if (!req?.headers) return undefined;
  const raw = req.headers["x-request-id"] ?? req.headers["x-trace-id"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null || value === "") return undefined;
  return UPSTREAM_REQUEST_ID_PATTERN.test(value) ? value : "<rejected>";
}

/** Fresh random opaque trace id (UUID v4). One per error response. */
function newTraceId(): string {
  return randomUUID();
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    // Server-issued, per-response, unconditional. Not derived from the request.
    const traceId = newTraceId();
    const upstreamRequestId = extractUpstreamRequestId(req);

    // ── 1. Our typed error ────────────────────────────────────────────────
    if (exception instanceof DomainException) {
      this.applyHeaders(res, exception.responseHeaders);
      this.send(res, exception.getStatus(), {
        error: {
          code: exception.code,
          message: this.messageOf(exception),
          details: exception.details,
          fieldErrors: exception.fieldErrors,
          traceId,
        },
        upstreamRequestId,
      });
      return;
    }

    // ── 1b. Lock/transaction contention → 409 busy, never 500 ─────────────
    // architecture §5.2 / §15 row 6b: `55P03` (lock_timeout), `40P01`
    // (deadlock), `40001` (serialization) and Prisma's `P2028`/pool timeout are
    // "the database made us stop", not "we are broken". `packages/db` already
    // classifies them and packages the decided status/code/details; rendering
    // is all that was missing, so every one of them surfaced as a 500 —
    // paging on-call for ordinary contention, and standing out against the
    // uniform 404 on admin-reset.
    //
    // Rendered here rather than at each call site so a service only has to
    // `rethrowOrgLockError(err, op)`; every org-locked write in F-002 and after
    // gets the same wire answer without repeating this mapping. The Postgres
    // knowledge stays in `prisma/org-busy.ts` — `common/` must not import
    // `@omnistock/db` (boundary gate `api-db-client-allowlisted`).
    const busy = describeOrgBusy(exception);
    if (busy) {
      if (busy.alert) {
        this.logger.error(`${busy.summary} — off-policy lock order? ${JSON.stringify(busy.diagnostic)}`);
      } else {
        this.logger.warn(busy.summary);
      }
      this.send(res, busy.status, {
        error: {
          code: busy.code,
          message: ERROR_CODES.CONFLICT.message,
          // `{ reason: "busy" }` — the client's cue to retry. `diagnostic`
          // (SQLSTATE, Prisma code) is deliberately NOT here: it is log-only.
          details: busy.details,
          traceId,
        },
        upstreamRequestId,
      });
      return;
    }

    // ── 2. Other framework HttpException ──────────────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const envelope = this.fromHttpException(exception.getResponse(), status);
      this.send(res, status, {
        error: { ...envelope, traceId },
        upstreamRequestId,
      });
      return;
    }

    // ── 3. Unknown → 500 INTERNAL, log full, leak nothing ─────────────────
    this.send(res, HttpStatus.INTERNAL_SERVER_ERROR, {
      error: {
        code: ERROR_CODES.INTERNAL.code,
        message: ERROR_CODES.INTERNAL.message,
        traceId,
      },
      upstreamRequestId,
      stack: exception instanceof Error ? exception.stack : String(exception),
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

  /**
   * The single choke point for every error response: stamps the server-issued
   * trace id on the header, writes the body, and emits the one log line that
   * carries the same trace id. Nothing may write an error response around it —
   * that is what makes "traceId on EVERY error, in body AND log" structural.
   */
  private send(
    res: Response,
    status: number,
    out: {
      error: DomainErrorBody & { traceId: string };
      upstreamRequestId?: string;
      stack?: string;
    },
  ): void {
    // Set AFTER applyHeaders so an exception-carried header can never override
    // the trace id, and so the value echoed is always the one we just issued.
    res.setHeader(REQUEST_ID_HEADER, out.error.traceId);
    const envelope: WireEnvelope = { error: stripUndefined(out.error) };
    this.log(status, out.error, out.upstreamRequestId, out.stack);
    res.status(status).json(envelope);
  }

  /** One line, one trace id — the join key ops/QA get from a user report. */
  private log(
    status: number,
    error: DomainErrorBody & { traceId: string },
    upstreamRequestId?: string,
    stack?: string,
  ): void {
    const line =
      `error status=${status} code=${error.code} traceId=${error.traceId}` +
      (upstreamRequestId ? ` upstreamRequestId=${upstreamRequestId}` : "");
    if (status >= 500) {
      // 5xx keeps the full server-side detail (stack), still never on the wire.
      this.logger.error(line, stack);
      return;
    }
    this.logger.warn(line);
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
  error: DomainErrorBody & { traceId: string },
): DomainErrorBody & { traceId: string } {
  // Key order matches the documented envelope: traceId stays last.
  const out: DomainErrorBody & { traceId?: string } = {
    code: error.code,
    message: error.message,
  };
  if (error.details !== undefined) out.details = error.details;
  if (error.fieldErrors !== undefined) out.fieldErrors = error.fieldErrors;
  out.traceId = error.traceId;
  return out as DomainErrorBody & { traceId: string };
}
