// F-002 · T-002-01 — the tenancy REGISTER: which Prisma models are org-scoped,
// which are deliberately org-agnostic, and which one is the tenant root.
//
// Golden rule 3 ("every domain query filters organizationId") needs a single
// authoritative answer to "is this model tenant data?". Until now that answer
// lived in three places that could silently disagree: the schema, the AC
// verifier's allowlist (src/verify-ac.ts) and whatever the next feature assumed.
// This file is that answer, and `org-models.test.ts` proves it still matches the
// real schema — add a model with an `organizationId` and forget to register it
// here and the unit test goes red before the query layer ever sees it.
//
// SCOPE: data only, on purpose. The runtime enforcement that consumes this list
// (injecting `where: { organizationId }` into every query) is T-002-02's
// `withOrgScope`; see ./tenancy.ts. Keeping the list separate from the
// interceptor means the "what" can be verified against the schema without
// booting the enforcement machinery.

/**
 * The tenant root. Satisfies golden rule 3 through its own `id` rather than an
 * `organizationId` column, so it belongs to neither list below.
 */
export const ORGANIZATION_MODEL = "Organization" as const;

/**
 * Models that carry an `organizationId` column. Every query against these MUST
 * be filtered by the caller's organization.
 *
 * Two-sided invariant (pinned by org-models.test.ts): this is exactly the set of
 * models whose Prisma datamodel has an `organizationId` field — no more, no
 * less.
 */
export const ORG_SCOPED_MODELS = [
  "Membership",
  "Role",
  "Invitation",
  "Product",
  "SellableSku",
  "InventoryItem",
  "BundleComponent",
  "Warehouse",
  "StockLevel",
  "StockMovement",
  "ChannelAccount",
  "ChannelListing",
  "OrgEntitlement",
  "UsageEvent",
] as const;

/**
 * Models that intentionally have NO `organizationId`, with the reason each one
 * is allowed to. This is an ALLOWLIST: a model is org-agnostic only because a
 * decision says so, never because someone forgot the column.
 *
 *  - `User` / `RefreshToken` — authentication is org-agnostic by design
 *    (docs/01 §2, F-001 as-built): one account can belong to many orgs, and a
 *    session is not scoped to one of them (D-018 discussion, DECISIONS §316).
 *  - `Channel` / `PlanDefinition` — system-level catalogs shared by all tenants.
 *
 * ⚠️ Rule C-3 (F-002 data-model §3.5): never START a query from a model in this
 * list, and never traverse THROUGH one back down into an org-scoped model
 * (`user: { select: { memberships: … } }` returns other orgs' rows). Org scoping
 * cannot be injected into a query that never mentions an org-scoped model.
 */
export const ORG_AGNOSTIC_MODELS = ["User", "RefreshToken", "Channel", "PlanDefinition"] as const;

export type OrgScopedModel = (typeof ORG_SCOPED_MODELS)[number];
export type OrgAgnosticModel = (typeof ORG_AGNOSTIC_MODELS)[number];

const ORG_SCOPED_SET: ReadonlySet<string> = new Set<string>(ORG_SCOPED_MODELS);

/** Is this Prisma model name org-scoped (i.e. does it require an org filter)? */
export function isOrgScopedModel(model: string): model is OrgScopedModel {
  return ORG_SCOPED_SET.has(model);
}
