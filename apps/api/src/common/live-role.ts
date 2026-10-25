// F-003 · T-003-B15 — the ONE filter that makes a `Role` read "live" (data-model §2.2).
//
// D-036: deleting a role is a soft delete (`deletedAt` set). The row stays so
// history (a revoked member, an accepted invitation) can still show the role's
// last name — which means every read that offers or resolves a role for USE
// must leave the deleted rows out. Each of those reads spreads this constant
// into its `where`; reads that must see deleted rows carry a
// `// role-read: history — <reason>` comment instead. Gate G3-04
// (test/static-gates/g3-04-live-role-where.test.ts) fails any `Role` read that
// has neither.
//
// Lives in `common/` (not `orgs/`) because `auth/` reads roles too and may not
// import a feature module (depcruise `api-leafward-only`).

/** Spread into a `Role` `where`: `{ id, ...LIVE_ROLE_WHERE }`. */
export const LIVE_ROLE_WHERE = Object.freeze({ deletedAt: null }) as { readonly deletedAt: null };
