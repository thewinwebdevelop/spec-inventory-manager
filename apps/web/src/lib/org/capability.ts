/**
 * ★ T-002-Q5 — the ONE place the web app asks "may this person do X".
 *
 * It exists because the answer is not `set.has(x)`, and getting that wrong is
 * invisible in every unit test that supplies its own capability list.
 *
 * `full_access` is a WILDCARD (core-domain `hasCapability`, and the server's
 * `CapabilityGuard` honours it). A system Owner's role carries `full_access`
 * and NOTHING else — `SYSTEM_ROLE_BLUEPRINT` grants no `manage_members`, no
 * `manage_org_settings` — so a membership test written as `has("manage_x")`
 * answers "no" for the one person who may do everything. What that looks like
 * to the user is a shop owner who cannot see their own members menu, cannot
 * declare their shop's tax identity, cannot rename their shop, and is never
 * shown the backup-owner nudge that is defined for exactly their situation.
 *
 * All of those were real (tasks.md, 2026-08-15/16). Each one was a separate
 * `.has()` written by somebody who had no reason to suspect the rule was more
 * than set membership — which is the argument for having no second copy of it.
 *
 * The set→array hop is deliberate: `hasCapability` is shared with the server
 * and takes an array, and this app stores capabilities in a `Set`. Converting
 * here, in one function over a handful of strings, is cheaper than a second
 * implementation of the rule.
 */
import {
  hasCapability,
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_MEMBERS,
  CAPABILITY_MANAGE_ORG_SETTINGS,
} from "@omnistock/core-domain";

export function can(capabilities: ReadonlySet<string>, capability: string): boolean {
  return hasCapability([...capabilities], capability);
}

/**
 * The NAMES, from the same place as the rule.
 *
 * They were declared five separate times across the two client trees —
 * `CAPABILITY_FULL_ACCESS` twice on web alone — each a hand-typed copy of a
 * string the server defines and this app already depends on. Identical values,
 * so nothing was broken; a second copy of a capability fact is simply how the
 * wildcard bug reached six call sites, and the argument against it does not
 * get weaker because this instance happened to agree.
 *
 * The guard in `capability-lint.test.ts` now fails on a sixth copy.
 */
export { CAPABILITY_FULL_ACCESS, CAPABILITY_MANAGE_MEMBERS, CAPABILITY_MANAGE_ORG_SETTINGS };
