// F-002 · T-002-05 ★ — the capability layer (architecture §1.3/§1.4 rows 6–7/§3.1).
//
// THE PRINCIPLE IT MAKES TRUE: "ลืมประกาศ = พัง" — forgetting to declare breaks
// the route, it does not open it to everyone. Security-review I-2 showed why a
// helper the service calls itself cannot do this (forget the call → silent
// leak), and NEW-3 showed why covering only mutating verbs cannot either: the
// most expensive surface of F-002 is a READ (`GET /orgs/{id}/members` = every
// email in the org). A refactor that drops the decorator off a `GET` would
// otherwise demote it to "any active member" without a single signal.
//
// So: EVERY org-scoped route, EVERY verb — GET and HEAD included — must declare
// `@RequireCapability(...)` or `@AnyActiveMember()`. Nothing declared → 403 plus
// a `capability_metadata_missing` error log. There is deliberately no method
// test anywhere on that path.
//
// ORDER: registered after `OrgScopeGuard`, which has already established that
// the caller is an `active` member of this org and answered `ORG_ACCESS_DENIED`
// otherwise. The two 403s stay separate on purpose (I-5): `ORG_ACCESS_DENIED`
// sends the client back to the org picker, `FORBIDDEN` keeps it on the page with
// a toast. Merging them guarantees the client does the wrong one.
//
// The capabilities come from the ALS context the middleware filled — never a
// second DB read (§1.5: one indexed membership read per request, no cache).
import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { hasCapability } from "@omnistock/core-domain";
import { domainError } from "../domain-exception";
import { OrgContextStore } from "../../tenancy/org-context";
import { normalizePath } from "../../tenancy/route-scope.registry";
import { ROUTE_SCOPE_KEY, type RouteScope } from "../../tenancy/route-scope.decorator";
import { ANY_ACTIVE_MEMBER_KEY, CAPABILITY_KEY } from "./capability.decorator";
import {
  CAPABILITY_DENIED_EVENT,
  CAPABILITY_EVENT_SINK,
  type CapabilityEventSink,
} from "./capability-events";

/** Whatever `Reflector.get` accepts — a handler function or a controller class. */
type MetadataTarget = Parameters<Reflector["get"]>[1];

/** What a route says about itself, as the decorators declare it. */
type Declaration =
  | { readonly kind: "capability"; readonly capability: string }
  | { readonly kind: "any-active-member" }
  | { readonly kind: "conflict" }
  | { readonly kind: "invalid" }
  | { readonly kind: "none" };

@Injectable()
export class CapabilityGuard implements CanActivate {
  private readonly logger = new Logger(CapabilityGuard.name);

  // Explicit @Inject on every param — see the note in org-context.middleware.ts
  // (tsx emits no decorator metadata, so type-based DI resolves `undefined` in
  // dev only, which is the worst possible place to find out).
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(OrgContextStore) private readonly store: OrgContextStore,
    @Optional()
    @Inject(CAPABILITY_EVENT_SINK)
    private readonly events?: CapabilityEventSink,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") {
      // Workers open their own context with `OrgContextStore.run(...)` and never
      // pass through guards. A new transport must be designed, not defaulted open.
      this.logger.error(`refused a non-HTTP execution context (${context.getType()})`);
      throw domainError("FORBIDDEN");
    }

    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();
    const route = `${method} ${normalizePath(req.originalUrl ?? req.url)}`;

    // Not org-scoped ⇒ no org, no membership, no capabilities to check. These
    // tiers are `OrgScopeGuard`'s business (401 for @UserScoped, 403 for
    // @SystemScoped until F-085) and this layer must not double-answer them.
    const declaredScope = this.reflector.getAllAndOverride<RouteScope | undefined>(
      ROUTE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (declaredScope) return true;

    // ── org-scoped: every verb from here, no exceptions (NEW-3) ─────────────
    const declaration = this.readDeclaration(context);

    switch (declaration.kind) {
      case "conflict":
        // Both layers on the same target. Picking the looser one silently is
        // exactly how "@AnyActiveMember everywhere" becomes the easy path —
        // and picking the stricter one hides a contradiction the author must
        // resolve. So: fail loud, 500, our bug, never a 200.
        this.logger.error(
          `capability_metadata_conflict on ${route}: @RequireCapability and ` +
            `@AnyActiveMember are declared at the same level — pick one`,
        );
        throw domainError("INTERNAL");

      case "invalid":
        this.logger.error(
          `capability_metadata_invalid on ${route}: @RequireCapability carries a ` +
            `non-string/empty capability`,
        );
        throw domainError("INTERNAL");

      case "none":
        // ⛔ Do not reintroduce a `method` test here. The amend #3 draft had
        // `if (!MUTATING.includes(method)) return true;` on this line, which is
        // precisely the hole NEW-3 closed: `GET /orgs/{id}/members` would fall
        // back to "any active member" the moment its decorator went missing.
        // I-2 + NEW-3. `FORBIDDEN` (not INTERNAL) because a caller must not be
        // able to tell "we forgot" from "you may not" — while the log line says
        // exactly which it was, for us.
        this.logger.error(
          `capability_metadata_missing on ${route}: an org-scoped route must declare ` +
            `@RequireCapability(...) or @AnyActiveMember() — refusing`,
        );
        throw domainError("FORBIDDEN");

      case "any-active-member":
        // A positive declaration, not an omission. `OrgScopeGuard` already
        // proved the caller is an ACTIVE member of this org.
        this.requireContext(route);
        return true;

      case "capability": {
        const ctx = this.requireContext(route);
        // `hasCapability` from core-domain — `full_access` is a wildcard there,
        // in ONE place, shared with F-001's inline check and F-003's registry.
        if (hasCapability(ctx.capabilities ?? [], declaration.capability)) return true;

        this.events?.emit(CAPABILITY_DENIED_EVENT, {
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          route,
          requiredCapability: declaration.capability,
          reason: "missing_capability",
        });
        throw domainError("FORBIDDEN");
      }
    }
  }

  /**
   * The org context, which MUST exist: `OrgScopeGuard` only lets an org-scoped
   * request through with `orgOutcome === 'ok'`, and that is the branch where the
   * middleware opened the ALS. Missing ⇒ the chain is mis-wired ⇒ fail loud
   * rather than evaluate a capability against an empty list.
   */
  private requireContext(route: string) {
    const ctx = this.store.get();
    if (!ctx) {
      this.logger.error(
        `capability_context_missing on ${route}: org-scoped route reached ` +
          `CapabilityGuard with no org context — OrgScopeGuard is not wired before it`,
      );
      throw domainError("INTERNAL");
    }
    return ctx;
  }

  /**
   * Read the declaration, handler first then class (Nest's normal override
   * order). `getAllAndOverride` is NOT usable here: it would merge the two KEYS
   * across levels, so a class-level `@AnyActiveMember()` plus a handler-level
   * `@RequireCapability()` would read as a conflict instead of an override. We
   * therefore resolve level by level and only call it a conflict when both
   * markers sit on the SAME target.
   */
  private readDeclaration(context: ExecutionContext): Declaration {
    const atHandler = this.declarationOn(context.getHandler());
    return atHandler.kind === "none" ? this.declarationOn(context.getClass()) : atHandler;
  }

  private declarationOn(target: MetadataTarget): Declaration {
    const capability = this.reflector.get<unknown>(CAPABILITY_KEY, target);
    const anyActiveMember = this.reflector.get<unknown>(ANY_ACTIVE_MEMBER_KEY, target);
    const hasCapabilityMark = capability !== undefined;
    const hasAnyMark = anyActiveMember === true;

    if (hasCapabilityMark && hasAnyMark) return { kind: "conflict" };
    if (hasCapabilityMark) {
      return typeof capability === "string" && capability.trim() !== ""
        ? { kind: "capability", capability }
        : { kind: "invalid" };
    }
    if (hasAnyMark) return { kind: "any-active-member" };
    return { kind: "none" };
  }
}
