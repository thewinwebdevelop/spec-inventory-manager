/**
 * T-002-W1 — query keys, namespaced by organization.
 *
 * web.md §3.2 leans on one property for tenant safety in the CACHE: every
 * org-scoped key contains the orgId, so switching shops is a navigation that
 * changes every key rather than a state mutation that has to invalidate
 * things. Nothing keyed for `org_1` can ever be read while the URL says
 * `org_2`, because no query asks for it.
 *
 * TypeScript cannot force a feature to include the orgId in a key it writes
 * by hand (web.md admits as much). What it CAN do is make the correct thing
 * the shortest thing to type, which is what `orgKey` is for. `test/`'s
 * boundary check is the backstop; this is the ergonomics.
 */

/** Root of every org-scoped key. Invalidate this to drop one shop's cache. */
export function orgRootKey(orgId: string): readonly [string, string] {
  return ["org", orgId];
}

/**
 * `orgKey(orgId, "members", { cursor })` → `["org", orgId, "members", {…}]`.
 * Use this rather than assembling an array literal — an assembled one is how
 * an orgId goes missing.
 */
export function orgKey(orgId: string, ...rest: readonly unknown[]): readonly unknown[] {
  return [...orgRootKey(orgId), ...rest];
}

/** The caller's own org list. NOT org-scoped — it spans every shop. */
export const MY_ORGANIZATIONS_KEY: readonly unknown[] = ["me", "organizations"];
