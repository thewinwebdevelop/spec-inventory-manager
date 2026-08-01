// F-002 · T-002-04 — route tier markers (architecture §1.1).
//
// Org-scoped is the DEFAULT: a route says nothing → it demands an org context.
// The whole point is "ลืมแล้วพัง ไม่ใช่ลืมแล้วรั่ว" — a new endpoint that forgets
// to declare its tier fails loudly (401/422/403) instead of quietly serving data
// without a tenant filter.
//
// These are metadata-only (SetMetadata). All logic lives in `OrgScopeGuard`, so
// a decorator can never be "half applied".
import { SetMetadata, type CustomDecorator } from "@nestjs/common";

/** Reflector key carrying the route tier. */
export const ROUTE_SCOPE_KEY = "omnistock:route-scope";

/**
 * The three non-default tiers (architecture §1.1). The default — org-scoped —
 * is deliberately NOT a value you can write: it is the absence of a mark.
 */
export type RouteScope = "public" | "user" | "system";

/**
 * No token required (still rate-limited). **No org context is created**, and
 * `X-Organization-Id` is ignored entirely (I-3). e.g. `GET /health`, `/auth/*`,
 * `POST /invitations/preview`.
 */
export const Public = (): CustomDecorator<string> => SetMetadata(ROUTE_SCOPE_KEY, "public");

/**
 * Valid access token required, but the request is about the USER, not one org:
 * `POST /organizations`, `GET /me/organizations`, `POST /invitations/accept`.
 *
 * **No org context is created** even if the caller sends `X-Organization-Id`
 * (I-3): otherwise the caller would choose which tenant our writes land in. A
 * handler here that legitimately needs a context (accept) opens its own via
 * `OrgContextStore.run(...)` after reading the row that PROVES the org.
 */
export const UserScoped = (): CustomDecorator<string> => SetMetadata(ROUTE_SCOPE_KEY, "user");

/**
 * Cross-org back-office (`/admin/**`, F-085). Declared here because §1.1
 * declares the tier — but until F-085 wires `SuperAdminGuard` + `@Audited`,
 * `OrgScopeGuard` REFUSES these routes (403). A tier with no enforcement behind
 * it must never be the permissive one.
 */
export const SystemScoped = (): CustomDecorator<string> => SetMetadata(ROUTE_SCOPE_KEY, "system");
