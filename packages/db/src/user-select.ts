// F-002 · T-002-02 — `USER_SELECT`: the ONLY projection of `User` a feature
// module may use. Spec: architecture.md §2.2 (C-4 + NEW-8, rule 4).
//
// `User` is org-agnostic on purpose (one account, many orgs), which makes it the
// one model `withOrgScope` cannot help with — the extension sees only the
// TOP-LEVEL operation, so any relation walk that goes through `User` escapes org
// scoping entirely:
//
//   membership.findMany({ select: { user: { select: { memberships: true } } } })
//   //  ↑ starts org-scoped …          ↑ …walks through User…  ↑ …and comes back
//   //    down into OTHER orgs' rows (NEW-8). No filter is applied to it.
//
// A grep gate alone cannot stop that (`const S = USER_SELECT; { ...S, memberships: true }`
// slips through textual matching), so the projection is a frozen constant with
// no relation keys: the leaking shape becomes unexpressible rather than merely
// discouraged. It also closes C-4 — `passwordHash` (argon2) can never be
// selected, so no mapper can spread it onto the wire.
//
// Changing this constant changes what every endpoint exposes about a person.
// U-DB-11 pins the exact shape, the freeze, and the "no relation of User"
// invariant against the real datamodel — widening it must be argued in a PR.

/**
 * Prisma `select` for `User`, everywhere. Use as
 * `select: { user: { select: USER_SELECT } }` — never an inline `select`, never
 * `include: { user: true }`.
 */
export const USER_SELECT = Object.freeze({
  id: true,
  email: true,
  createdAt: true,
} as const);

export type UserSelect = typeof USER_SELECT;
