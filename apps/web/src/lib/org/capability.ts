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
import { hasCapability } from "@omnistock/core-domain";

export function can(capabilities: ReadonlySet<string>, capability: string): boolean {
  return hasCapability([...capabilities], capability);
}
