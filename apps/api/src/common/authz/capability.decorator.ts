// F-002 · T-002-05 ★ — capability markers (architecture §3.1, security-review I-2).
//
// The first draft made this a helper the service had to call on its own first
// line (`requireCapability(ctx, cap)`). I-2 killed it, correctly: forgetting to
// call it breaks NOTHING and leaks EVERYTHING — Staff `DELETE`s the second Owner
// and gets a 200. So authorization is declared as METADATA and enforced by a
// global guard: a handler cannot "half apply" a decorator, and a route that
// declares nothing is refused (`CapabilityGuard`), not waved through.
//
// These two are the ONLY ways an org-scoped route may declare itself. There is
// deliberately no third, looser option.
import { SetMetadata, type CustomDecorator } from "@nestjs/common";

/** Reflector key carrying the required capability (a string). */
export const CAPABILITY_KEY = "omnistock:required-capability";

/** Reflector key carrying the "no capability needed" marker (`true`). */
export const ANY_ACTIVE_MEMBER_KEY = "omnistock:any-active-member";

/**
 * This route requires `capability` of the caller's role IN THE CURRENT ORG.
 * Metadata only — `CapabilityGuard` does the work with `hasCapability()` from
 * `@omnistock/core-domain` (so `full_access` keeps meaning "everything", in one
 * place, for F-001, F-002 and F-003 alike).
 *
 * May be applied to a handler or to a controller class; a handler-level
 * declaration overrides the class-level one.
 */
export const RequireCapability = (capability: string): CustomDecorator<string> => {
  // Fail at import time, not at request time: `@RequireCapability("")` or a
  // typo'd constant that evaluates to `undefined` would otherwise become a
  // route nobody can call — or, worse, one whose check is vacuous.
  if (typeof capability !== "string" || capability.trim() === "") {
    throw new Error(
      "@RequireCapability() needs a non-empty capability string " +
        "(use the constants from @omnistock/core-domain)",
    );
  }
  return SetMetadata(CAPABILITY_KEY, capability);
};

/**
 * This route is open to ANY `active` member of the org — a positive statement
 * ("no capability is needed here"), never the absence of one.
 *
 * It is the weakest layer in a default-deny system, so it is not a shortcut:
 * every route wearing it must also appear in `ANY_ACTIVE_MEMBER_ROUTES`
 * (architecture §3.1), and @qa's G-13 compares that allowlist per tier. Adding
 * this decorator without editing the list turns CI red on purpose — otherwise
 * "forgot to declare = red" would quietly become "declare the loosest thing = green".
 */
export const AnyActiveMember = (): CustomDecorator<string> =>
  SetMetadata(ANY_ACTIVE_MEMBER_KEY, true);
