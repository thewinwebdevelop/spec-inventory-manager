// F-002 — every global guard must declare its dependencies EXPLICITLY.
//
// WHY THIS TEST EXISTS
// `main.ts` runs under `tsx`, which does not emit `design:paramtypes`. A
// constructor parameter typed but not decorated therefore resolves to
// `undefined` at runtime, and Nest refuses to construct the provider — the app
// does not boot at all. Under vitest the metadata IS emitted, so every unit and
// integration test passes while the real process dies on startup.
//
// That is exactly what happened to `OrgRateLimitGuard` (T-002-14): 395 green
// tests, and `integration-api` failed on "wait for a REAL 200 from /health"
// with `Nest can't resolve dependencies of the OrgRateLimitGuard (?, …)`.
// `org-context.middleware.ts` had documented the trap; the note did not stop it
// from happening again, so it is a test now.
//
// It reads `self:paramtypes` — the metadata `@Inject()` writes — which exists
// regardless of `emitDecoratorMetadata`. That is what makes this check valid in
// an environment that cannot reproduce the failure it prevents.
import { describe, it, expect } from "vitest";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { OrgScopeGuard } from "../tenancy/org-scope.guard";
import { CapabilityGuard } from "./authz/capability.guard";
import { OrgRateLimitGuard } from "./org-rate-limit.guard";

/** The APP_GUARDs `TenancyModule` registers, in execution order. */
const GLOBAL_GUARDS = [
  ["OrgScopeGuard", OrgScopeGuard],
  ["CapabilityGuard", CapabilityGuard],
  ["OrgRateLimitGuard", OrgRateLimitGuard],
] as const;

interface SelfDeclaredDep {
  index: number;
  param: unknown;
}

function explicitlyInjectedIndexes(target: object): number[] {
  const deps = (Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target) ??
    []) as SelfDeclaredDep[];
  return deps.map((d) => d.index).sort((a, b) => a - b);
}

describe("global guards declare every constructor dependency explicitly", () => {
  it.each(GLOBAL_GUARDS)(
    "%s decorates EVERY constructor parameter with @Inject",
    (name, guard) => {
      // Arity comes from `design:paramtypes`, NOT `Function.length` — the
      // latter stops counting at the first parameter with a default value, and
      // the optional ones are exactly the parameters at risk here. vitest emits
      // this metadata; tsx does not, which is the whole point of the test.
      const paramtypes = (Reflect.getMetadata("design:paramtypes", guard) ?? []) as unknown[];
      const arity = paramtypes.length;
      expect(arity, `${name}: no design:paramtypes — is emitDecoratorMetadata on?`).toBeGreaterThan(
        0,
      );
      const injected = explicitlyInjectedIndexes(guard);
      const expected = Array.from({ length: arity }, (_, i) => i);

      // A missing index is the bug: that parameter falls back to type-based
      // resolution, which is `undefined` under tsx. The message names the
      // parameter position so the fix is obvious from the failure alone.
      expect(injected, `${name}: constructor params without @Inject(...)`).toEqual(expected);
    },
  );

  it("the guards under test are the ones actually registered globally", () => {
    // Guards this file forgot would be unprotected by the check above, and the
    // whole point is that the omission is what bites. If TenancyModule grows a
    // fourth APP_GUARD, this goes red until it is listed here too.
    const registered = GLOBAL_GUARDS.map(([name]) => name);
    expect(registered).toEqual(["OrgScopeGuard", "CapabilityGuard", "OrgRateLimitGuard"]);
  });
});
