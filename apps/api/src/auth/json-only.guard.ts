// F-001 · T-001-07 — strict Content-Type: application/json guard (L-2, api-spec
// §3). Every /auth/* POST must carry application/json; any other content-type
// (form-urlencoded / multipart / text) → 415 UNSUPPORTED_MEDIA_TYPE BEFORE any
// credential processing (login-CSRF defense — an HTML form cannot set JSON, and
// a cross-origin scripted fetch trips a CORS preflight the API won't allow).
//
// Runs as the FIRST guard on auth POST handlers so the 415 short-circuits ahead
// of validation, user lookup, and verify (I5c.1 — no throttle increment, no
// credential work on the rejected path).
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { domainError } from "../common/domain-exception";

@Injectable()
export class JsonOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const contentType = req.headers["content-type"] ?? "";
    // Accept `application/json` optionally with parameters (e.g. charset).
    const isJson = /^application\/json\b/i.test(contentType.trim());
    if (!isJson) {
      // R1: typed error via the central registry (DomainException extends
      // HttpException → still 415 + `{ error: { code, message } }`).
      throw domainError("UNSUPPORTED_MEDIA_TYPE");
    }
    return true;
  }
}
