// F-003 · T-003-B03 — canonical form + "what would I lose" (api-spec §2 ·
// architecture §1 · AC-3.10).
import { CAPABILITY_REGISTRY, type RegistryLike } from "./registry";
import { byKey, expandCapabilities } from "./expand";

/**
 * The stored form of a role's capabilities (api-spec §2):
 * `sort_by_key(dedupe(S) \ { v | ∃k ∈ S, k ≠ v, v ∈ implies[k] })`.
 *
 * Unknown keys are kept — rejecting them is `validateRoleCapabilities`' job,
 * never a silent drop here. Expansion is unchanged by canonicalization, so any
 * ⊆ comparison gives the same answer before and after (U-RB-05).
 */
export function canonicalizeCapabilities(
  capabilities: readonly string[],
  registry: RegistryLike = CAPABILITY_REGISTRY,
): string[] {
  const implies = new Map(registry.map((c) => [c.key, c.implies]));
  const set = new Set(capabilities);
  const implied = new Set<string>();
  for (const k of set) for (const v of implies.get(k) ?? []) if (v !== k) implied.add(v);
  return [...set].filter((k) => !implied.has(k)).sort(byKey);
}

/**
 * Capabilities the holder of a role would lose if it changed from `before` to
 * `after`: `expand(before) \ expand(after)`, sorted by key (AC-3.10). Used by
 * web directly and ported to Dart for mobile; both are pinned by
 * `fixtures/lost-capabilities.vectors.json` (U-RB-09 · CW3-01 · CM3-01).
 */
export function lostCapabilities(
  before: readonly string[],
  after: readonly string[],
  registry: RegistryLike = CAPABILITY_REGISTRY,
): string[] {
  const kept = new Set(expandCapabilities(after, registry));
  return expandCapabilities(before, registry).filter((k) => !kept.has(k));
}
