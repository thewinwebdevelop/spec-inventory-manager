// F-002 · T-002-02 — REAL organizationId scoping (replaces the F-000
// pass-through stub). Authoritative spec: docs/features/F-002/architecture.md
// §2.1–§2.4. Tests: tenancy.test.ts (args contract, U-DB-01..07) +
// tenancy.db.test.ts (M-9 — what Postgres actually does).
//
// This is the layer that makes golden rule 3 ("every domain query filters
// organizationId") TRUE instead of aspirational. ~40 features will inherit it,
// so its design bias is: FAIL LOUD, NEVER GUESS.
//   - unknown operation                → throw (no default pass-through, ever)
//   - unregistered model               → throw (org-models.ts must classify it)
//   - no org context                   → throw (an unscoped query is a leak)
//   - caller-supplied organizationId that does not match the context → throw
//     (silently overriding it would hide the bug that wrote it)
//   - an org filter/value shape we cannot PROVE equals the context → throw
//
// WHAT IT CANNOT DO (architecture §2.2, C-3 — read this before trusting it):
// a client extension only sees the TOP-LEVEL model+operation. Queries that start
// at an org-agnostic model (`User`/`RefreshToken`/`Channel`/`PlanDefinition`),
// and relation walks nested inside `select`/`include`, are NOT scoped — not
// because of an oversight but because the seam has no visibility there. Those
// are closed by rule + `USER_SELECT` (see ./user-select.ts) + grep gates + the
// int-test kit, and are pinned by tests here so the gap stays known.
//
// Back-office exception (docs/02-architecture.md §5): the cross-org admin path
// is a SEPARATE seam (`/admin/...` + super-admin guard), never this one.
import { Prisma } from "../generated/client";
import { isOrgScopedModel, ORGANIZATION_MODEL, ORG_AGNOSTIC_MODELS } from "./org-models";

/**
 * The organization-scoping context every domain query needs. In apps/api it is
 * produced by `OrgContextMiddleware` and read from AsyncLocalStorage
 * (`OrgContextStore`) — see architecture §1.3/§2.1.
 */
export interface OrgScopeContext {
  organizationId: string;
}

/**
 * Structural constraint for `withOrgScope`'s generic parameter.
 *
 * Deliberately NOT `T extends PrismaClient`: the app's real client is
 * `new PrismaClient().$extends(ledgerGuardExtension)` (see
 * apps/api/src/prisma/prisma.service.ts, T-000-05's `GuardedPrismaClient`),
 * and `$extends`'s return type does not structurally extend `PrismaClient`
 * (it drops/reshapes members like `$on`/`$use`). Constraining to the bare
 * `PrismaClient` class type would make the documented F-002 call site —
 * `withOrgScope(prismaService.client, ctx)` — fail to typecheck (TS2345),
 * even though a guarded client is exactly what every real caller passes.
 *
 * `$extends` is the one shape every Prisma client (bare or extended) is
 * guaranteed to expose, so we constrain on that instead: "anything
 * `$extends`-able" is precisely "a Prisma client this seam can wrap."
 *
 * NOTE on the `(extension: any) => any` shape: this must stay `any` in, `any`
 * out (not `unknown`/a fixed return type) so that when TypeScript resolves
 * `prisma.$extends(...)` at a `T extends OrgScopeCompatibleClient` call site,
 * it dispatches through `T`'s OWN (precise, overloaded) `$extends` member —
 * not through this interface's member — preserving the real extended-client
 * return type (model accessors etc.) end to end. Narrowing this to `unknown`
 * would make every call site's result collapse to `unknown` (pinned by the
 * compile-only test tenancy.compile-test.ts — do not "tighten" this without
 * re-checking that test).
 */
export interface OrgScopeCompatibleClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $extends: (extension: any) => any;
}

// ── errors ──────────────────────────────────────────────────────────────────

/** No org context was available — the query is refused rather than run unscoped. */
export class MissingOrgContextError extends Error {
  constructor(
    readonly model: string | undefined,
    readonly operation: string,
  ) {
    super(
      `missing organization context: ${model ?? "?"}.${operation} was called through an org-scoped ` +
        `client with no organizationId. A query without a tenant is never safe — resolve the org ` +
        `first (OrgContextStore.run / OrgContextMiddleware). See F-002 architecture §2.1.`,
    );
    this.name = "MissingOrgContextError";
  }
}

/**
 * The caller tried to reach outside its organization — explicitly (a foreign
 * `organizationId`), or in a shape we cannot prove stays inside it.
 * Deliberately loud: the alternative (silently rewriting the value) would hide
 * the bug that produced it.
 */
export class OrgScopeViolationError extends Error {
  constructor(
    readonly model: string,
    readonly operation: string,
    detail: string,
  ) {
    super(
      `org scope violation on ${model}.${operation}: ${detail}. The org filter is injected from the ` +
        `request context — do not pass one yourself (golden rule 3, F-002 architecture §2.2).`,
    );
    this.name = "OrgScopeViolationError";
  }
}

/**
 * The operation has no declared org-scoping behaviour — fail closed. A new
 * Prisma version adding an operation must be an explicit decision in
 * architecture §2.2, not an unnoticed hole (U-DB-07 turns it into a red test).
 */
export class UnsupportedOrgScopeOperationError extends Error {
  constructor(
    readonly model: string,
    readonly operation: string,
    reason: string,
  ) {
    super(`unsupported org-scoped operation ${model}.${operation}: ${reason}`);
    this.name = "UnsupportedOrgScopeOperationError";
  }
}

/**
 * The model is in neither register (org-scoped / org-agnostic / tenant root), so
 * nobody has decided whether it holds tenant data. Refuse it.
 */
export class UnregisteredOrgScopeModelError extends Error {
  constructor(
    readonly model: string,
    readonly operation: string,
  ) {
    super(
      `model ${model} is not classified in packages/db/src/org-models.ts, so ${model}.${operation} ` +
        `cannot be org-scoped. Register it as org-scoped or org-agnostic (with a reason).`,
    );
    this.name = "UnregisteredOrgScopeModelError";
  }
}

// ── the operation → strategy table (architecture §2.2) ─────────────────────

/**
 * How each Prisma model operation gets scoped:
 *
 *  - `filterWhere`     — AND the org column into a normal `where` filter.
 *  - `uniqueWhere`     — put the org column into an extendedWhereUnique `where`
 *                        (Prisma ≥ 5; another org's row then behaves exactly
 *                        like a row that does not exist → P2025 → 404).
 *  - `createData`      — inject the org column into `data`.
 *  - `createManyData`  — inject it into EVERY row of `data`.
 *  - `upsert`          — both: the `where` lookup and the `create` fallback.
 *  - `reject`          — declared and deliberately refused (see notes below).
 *
 * This map is the single source of truth for "which operations exist". U-DB-07
 * enumerates the generated client and fails if anything is missing — so a Prisma
 * upgrade that adds an operation goes red instead of leaking silently.
 */
export const ORG_SCOPE_OPERATION_STRATEGY = Object.freeze({
  // reads
  findMany: "filterWhere",
  findFirst: "filterWhere",
  findFirstOrThrow: "filterWhere",
  count: "filterWhere",
  aggregate: "filterWhere",
  groupBy: "filterWhere",
  findUnique: "uniqueWhere",
  findUniqueOrThrow: "uniqueWhere",
  // writes
  create: "createData",
  createMany: "createManyData",
  createManyAndReturn: "createManyData",
  update: "uniqueWhere",
  delete: "uniqueWhere",
  updateMany: "filterWhere",
  deleteMany: "filterWhere",
  upsert: "upsert",
  // Declared AHEAD of Prisma: not present in 5.22. Kept in the table so the
  // policy is explicit ("rejected until implemented"); U-DB-07 goes red the day
  // an upgrade adds it, forcing a decision instead of a silent pass-through.
  updateManyAndReturn: "reject",
  // MongoDB-only. Unreachable on Postgres.
  //
  // ★ B-7 — this used to add "$queryRaw/$executeRaw are handled by the grep
  // gate". There was no grep gate. Raw SQL genuinely cannot be scoped by this
  // seam (it carries no model and no `where` to extend), so a `$queryRaw`
  // through an org-scoped client runs UNSCOPED and does not throw — verified
  // against Postgres. The confident sentence was the danger: it invited the
  // next person wanting a fast aggregate to write raw SQL and assume something
  // was watching. The gate now exists —
  // `apps/api/src/orgs/system/raw-sql-allowlist.test.ts` — and it is a textual
  // allowlist with a self-check, not this comment.
  findRaw: "reject",
  aggregateRaw: "reject",
} as const);

export type OrgScopeOperation = keyof typeof ORG_SCOPE_OPERATION_STRATEGY;
export type OrgScopeStrategy = (typeof ORG_SCOPE_OPERATION_STRATEGY)[OrgScopeOperation];

const REJECT_REASON: Record<string, string> = {
  updateManyAndReturn:
    "not available in Prisma 5.22 — declared ahead of time as rejected; implement AND where.organizationId when the upgrade lands (§2.2)",
  findRaw: "MongoDB-only raw operation; raw queries cannot be org-scoped by this extension",
  aggregateRaw: "MongoDB-only raw operation; raw queries cannot be org-scoped by this extension",
};

// ── pure core (golden rule 6: framework-free, directly unit-testable) ───────

type AnyArgs = Record<string, unknown>;

export interface ApplyOrgScopeParams {
  /** Prisma model name (PascalCase), as the extension reports it. */
  model: string;
  /** Prisma operation name, e.g. `findMany`. */
  operation: string;
  /** The caller's arguments (may be undefined for `count()` / `deleteMany()`). */
  args: unknown;
  /** The organization from the request context. */
  organizationId: string;
}

/**
 * The whole decision, as a pure function: given (model, operation, args, org),
 * return the args that must actually be sent — or throw. The client extension
 * below is a thin wrapper around this so the rules can be tested without a
 * client, a connection, or a request.
 */
export function applyOrgScope({ model, operation, args, organizationId }: ApplyOrgScopeParams): unknown {
  const strategy = (ORG_SCOPE_OPERATION_STRATEGY as Record<string, OrgScopeStrategy | undefined>)[operation];
  if (strategy === undefined) {
    throw new UnsupportedOrgScopeOperationError(
      model,
      operation,
      "no org-scoping behaviour is declared for this operation. Decide it in F-002 architecture §2.2 " +
        "and add it to ORG_SCOPE_OPERATION_STRATEGY — never let an undeclared operation through unscoped",
    );
  }
  if (strategy === "reject") {
    throw new UnsupportedOrgScopeOperationError(model, operation, REJECT_REASON[operation] ?? "explicitly rejected");
  }

  // C-3: org-agnostic models are forwarded untouched — there is nothing to
  // filter on. This is a documented gap, closed by rule + USER_SELECT + gates.
  if ((ORG_AGNOSTIC_MODELS as readonly string[]).includes(model)) return args;

  if (model === ORGANIZATION_MODEL) return scopeTenantRoot(model, operation, strategy, args, organizationId);
  if (isOrgScopedModel(model)) return scopeByColumn(model, operation, strategy, args, organizationId, "organizationId");

  throw new UnregisteredOrgScopeModelError(model, operation);
}

/**
 * `Organization` carries no `organizationId` — it IS the tenant, scoped through
 * its own `id`. §2.2 does not spell this row out (it lists the models that have
 * the column), but leaving the tenant root unscoped would mean
 * `orgPrisma.organization.findMany()` returns every tenant in the database, so
 * the fail-closed reading applies: scope reads/updates/deletes by `id`, and
 * refuse to CREATE a tenant here — org creation happens before any context
 * exists and belongs to `SYSTEM_PRISMA` (§2.4).
 */
function scopeTenantRoot(
  model: string,
  operation: string,
  strategy: Exclude<OrgScopeStrategy, "reject">,
  args: unknown,
  organizationId: string,
): unknown {
  if (strategy === "createData" || strategy === "createManyData" || strategy === "upsert") {
    throw new UnsupportedOrgScopeOperationError(
      model,
      operation,
      "creating a tenant root through an org-scoped client is not possible — there is no organization " +
        "to scope it to yet. Use SYSTEM_PRISMA inside the creation transaction (F-002 architecture §2.4)",
    );
  }
  return scopeByColumn(model, operation, strategy, args, organizationId, "id");
}

function scopeByColumn(
  model: string,
  operation: string,
  strategy: Exclude<OrgScopeStrategy, "reject">,
  args: unknown,
  organizationId: string,
  column: "organizationId" | "id",
): unknown {
  const input = (args ?? {}) as AnyArgs;

  switch (strategy) {
    case "filterWhere":
      return {
        ...input,
        where: scopedWhere(model, operation, input.where, organizationId, column),
        ...(hasKey(input, "data") ? { data: guardWriteData(model, operation, input.data, organizationId, column) } : {}),
      };

    case "uniqueWhere": {
      if (!isPlainObject(input.where)) {
        throw new OrgScopeViolationError(
          model,
          operation,
          `${operation} requires a \`where\` with a unique key; got ${describe(input.where)}`,
        );
      }
      return {
        ...input,
        where: scopedWhere(model, operation, input.where, organizationId, column),
        ...(hasKey(input, "data") ? { data: guardWriteData(model, operation, input.data, organizationId, column) } : {}),
      };
    }

    case "createData":
      return { ...input, data: scopedCreateData(model, operation, input.data, organizationId, column) };

    case "createManyData": {
      const data = input.data;
      if (Array.isArray(data)) {
        return { ...input, data: data.map((row) => scopedCreateData(model, operation, row, organizationId, column)) };
      }
      return { ...input, data: scopedCreateData(model, operation, data, organizationId, column) };
    }

    case "upsert": {
      if (!isPlainObject(input.where)) {
        throw new OrgScopeViolationError(
          model,
          operation,
          `upsert requires a \`where\` with a unique key; got ${describe(input.where)}`,
        );
      }
      return {
        ...input,
        where: scopedWhere(model, operation, input.where, organizationId, column),
        create: scopedCreateData(model, operation, input.create, organizationId, column),
        ...(hasKey(input, "update")
          ? { update: guardWriteData(model, operation, input.update, organizationId, column) }
          : {}),
      };
    }
  }
}

/**
 * Add the org column to a `where`, verifying (never overriding) whatever the
 * caller already put there.
 *
 * Only the TOP LEVEL is inspected on purpose: a foreign org id nested under
 * `OR`/`NOT` cannot widen the result set, because the injected top-level
 * condition is ANDed with everything else — it can only produce fewer rows.
 */
function scopedWhere(
  model: string,
  operation: string,
  where: unknown,
  organizationId: string,
  column: string,
): AnyArgs {
  if (where !== undefined && !isPlainObject(where)) {
    throw new OrgScopeViolationError(model, operation, `\`where\` must be an object; got ${describe(where)}`);
  }
  const base = (where ?? {}) as AnyArgs;
  if (hasKey(base, column)) {
    assertMatchesContext(model, operation, `where.${column}`, base[column], organizationId, "filter");
  }
  return { ...base, [column]: organizationId };
}

/**
 * `create`/`upsert.create` payload: inject the org column, or verify what the
 * caller wrote. The relation form (`organization: { connect: { id } }`) is
 * accepted only when it provably points at the context org — Prisma rejects
 * having both the scalar and the relation, so we must not inject on top of it.
 */
function scopedCreateData(
  model: string,
  operation: string,
  data: unknown,
  organizationId: string,
  column: string,
): AnyArgs {
  if (!isPlainObject(data)) {
    throw new OrgScopeViolationError(model, operation, `\`data\` must be an object; got ${describe(data)}`);
  }
  if (hasKey(data, column)) {
    assertMatchesContext(model, operation, `data.${column}`, data[column], organizationId, "write");
    return { ...data, [column]: organizationId };
  }
  if (column === "organizationId" && hasKey(data, "organization")) {
    const connectId = readConnectId(data.organization);
    if (connectId !== organizationId) {
      throw new OrgScopeViolationError(
        model,
        operation,
        connectId === undefined
          ? "`data.organization` uses a relation form this seam cannot verify (only " +
            "`{ connect: { id } }` is supported) — set nothing and let the org be injected"
          : `\`data.organization.connect.id\` is ${JSON.stringify(connectId)}, not the context org`,
      );
    }
    return data; // already correct; injecting the scalar too would be a Prisma error
  }
  return { ...data, [column]: organizationId };
}

/**
 * `update`/`updateMany`/`upsert.update` payload: nothing is injected (the row is
 * already located by a scoped `where`), but moving a row to another tenant is
 * refused.
 */
/**
 * Prisma verbs that only ever appear inside a NESTED RELATION write.
 *
 * `set` is deliberately absent: a scalar list uses it too (`capabilities:
 * { set: [...] }` on Role), and refusing that would break legitimate writes to
 * catch a shape that is not valid for a to-one relation anyway.
 */
const RELATION_WRITE_VERBS = [
  "connect",
  "connectOrCreate",
  "disconnect",
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
] as const;

function isRelationWrite(value: unknown): boolean {
  return isPlainObject(value) && RELATION_WRITE_VERBS.some((verb) => hasKey(value, verb));
}

function guardWriteData(
  model: string,
  operation: string,
  data: unknown,
  organizationId: string,
  column: string,
): unknown {
  if (!isPlainObject(data)) return data;

  // ★ B-1 (second half) — a nested relation write can move the org column
  // WITHOUT ever naming it, so the check below would never see it.
  //
  // Concretely, once `Membership.role` references `Role(organizationId, id)`,
  // `data: { role: { connect: { id: <other org's role> } } }` makes Prisma set
  // BOTH columns from the connected row — the membership lands in the other
  // organization entirely, and `data.organizationId` was never present for
  // `assertMatchesContext` to reject. The composite foreign key cannot help:
  // the resulting pair is perfectly valid, it just belongs to somebody else.
  //
  // Refused rather than interpreted. Verifying a nested write means knowing,
  // per model and per relation, which of them carry the org column and what
  // each verb does to it — a table that has to be right forever. "Probably
  // fine" is not a tenancy guarantee (the rule this seam already states about
  // filters), and nothing in the app writes this way: there are zero nested
  // relation writes in apps/api. A future caller that needs one states its
  // own scoped intent instead of asking the seam to guess.
  for (const key of Object.keys(data)) {
    if (key === column) continue;
    if (!isRelationWrite(data[key])) continue;
    throw new OrgScopeViolationError(
      model,
      operation,
      `\`data.${key}\` is a nested relation write, which this seam cannot verify — ` +
        `a relation that carries \`${column}\` (a composite foreign key) would move the row ` +
        `to another tenant without ever naming the column. Write the scalar foreign key ` +
        `instead, after resolving it through a scoped read.`,
    );
  }

  if (!hasKey(data, column)) return data;
  assertMatchesContext(model, operation, `data.${column}`, data[column], organizationId, "write");
  return { ...data, [column]: organizationId };
}

/**
 * Accept only values we can PROVE equal the context org:
 *   filter: `"org_x"` or `{ equals: "org_x" }`
 *   write:  `"org_x"` or `{ set: "org_x" }`
 * Everything else (`{ in: [...] }`, `{ not }`, null, undefined, nested filters)
 * is a violation — "probably fine" is not a tenancy guarantee.
 */
function assertMatchesContext(
  model: string,
  operation: string,
  path: string,
  value: unknown,
  organizationId: string,
  kind: "filter" | "write",
): void {
  const wrapper = kind === "filter" ? "equals" : "set";
  let literal: unknown = value;
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    literal = keys.length === 1 && keys[0] === wrapper ? (value as AnyArgs)[wrapper] : undefined;
  }
  if (literal === organizationId) return;

  throw new OrgScopeViolationError(
    model,
    operation,
    `${path} = ${describe(value)} cannot be proven to equal the context organization ` +
      `(${JSON.stringify(organizationId)})`,
  );
}

function readConnectId(relation: unknown): string | undefined {
  if (!isPlainObject(relation)) return undefined;
  const keys = Object.keys(relation);
  if (keys.length !== 1 || keys[0] !== "connect") return undefined;
  const connect = relation.connect;
  if (!isPlainObject(connect)) return undefined;
  const id = connect.id;
  return typeof id === "string" ? id : undefined;
}

function isPlainObject(value: unknown): value is AnyArgs {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKey(value: AnyArgs, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function describe(value: unknown): string {
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

// ── the seam itself ────────────────────────────────────────────────────────

/**
 * Wrap a Prisma client so every query is confined to one organization.
 *
 * `ctx` may be null/undefined: the failure then happens at QUERY time
 * (`MissingOrgContextError`), not at construction time, because the `ORG_PRISMA`
 * provider builds this client per context (architecture §2.1) and a constructor
 * that throws would turn "no context" into a DI-time crash far from the query
 * that caused it — and, worse, tempt someone into a fallback client.
 */
export function withOrgScope<T extends OrgScopeCompatibleClient>(
  prisma: T,
  ctx: OrgScopeContext | null | undefined,
) {
  return prisma.$extends(
    Prisma.defineExtension({
      name: "omnistock-org-scope",
      query: {
        $allModels: {
          $allOperations({ model, operation, args, query }) {
            const organizationId = ctx?.organizationId?.trim();
            if (!organizationId) throw new MissingOrgContextError(model, operation);
            // `$allModels` never fires without a model, but the callback's type
            // allows `undefined`; an empty name would fall through to
            // UnregisteredOrgScopeModelError, i.e. still fail closed.
            // (The local alias keeps TS from narrowing `query` to `never`
            // through the correlated union of the callback's parameters.)
            const modelName: string = model ?? "";
            return query(applyOrgScope({ model: modelName, operation, args, organizationId }) as typeof args);
          },
        },
      },
    }),
  );
}
