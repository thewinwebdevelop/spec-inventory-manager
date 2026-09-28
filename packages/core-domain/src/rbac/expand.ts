// F-003 · T-003-B03 — capability expansion (architecture §1 · AC-7.2/7.3).
// Every comparison of capability sets in F-003 runs on EXPANDED sets.
import { CAPABILITY_FULL_ACCESS, CAPABILITY_REGISTRY, type RegistryLike } from "./registry";

/**
 * Expand a stored capability list to everything it grants, sorted by key.
 *
 * - `full_access` → every key in the registry (upcoming and tier `full`
 *   included). A key added to the registry later is therefore granted to the
 *   Owner automatically and to nobody else (AC-7.2 default deny).
 * - each key → + its `implies` (`manage_X → view_X`, AC-7.3).
 * - unknown keys are KEPT, never dropped (SR-11 fail-closed): a key the registry
 *   does not know makes a ⊆ check fail rather than disappear. `full_access` does
 *   NOT cover unknown keys — the Owner passes those via an explicit bypass in
 *   the rule that needs one, not by expansion.
 */
export function expandCapabilities(
  capabilities: readonly string[],
  registry: RegistryLike = CAPABILITY_REGISTRY,
): string[] {
  const implies = new Map(registry.map((c) => [c.key, c.implies]));
  const out = new Set<string>(capabilities);
  if (out.has(CAPABILITY_FULL_ACCESS)) for (const c of registry) out.add(c.key);
  // Closure (a registry is one level deep by invariant, so this runs once; the
  // loop keeps the result idempotent even for a fixture that breaks the rule).
  const queue = [...out];
  while (queue.length > 0) {
    for (const target of implies.get(queue.pop()!) ?? []) {
      if (!out.has(target)) {
        out.add(target);
        queue.push(target);
      }
    }
  }
  return [...out].sort(byKey);
}

/**
 * Does a role's capability list grant `required`? Runs through
 * {@link expandCapabilities}, so `full_access` grants every registered key and
 * `manage_X` grants `view_X` at the guard (AC-7.3).
 *
 * Signature is the one `CapabilityGuard` and the F-001/F-002 call sites use;
 * `registry` is optional and exists for fixture tests.
 */
export function hasCapability(
  capabilities: readonly string[],
  required: string,
  registry: RegistryLike = CAPABILITY_REGISTRY,
): boolean {
  return expandCapabilities(capabilities, registry).includes(required);
}

/** Sort by key in code-unit order — deterministic across JS and Dart, unlike localeCompare. */
export function byKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
