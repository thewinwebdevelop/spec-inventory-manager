// F-002 · T-002-04 — the `ORG_PRISMA` provider (architecture §2.1).
//
// A SINGLETON Proxy, deliberately not `Scope.REQUEST`: request scope in Nest
// "infects" the whole DI chain above it (every controller/service that injects
// it becomes request-scoped too — a real perf cost), and it is a trap the day
// the same service runs inside a BullMQ worker, where there is no request at
// all. Instead the proxy reads the ALS context on every property access and
// memoizes ONE `$extends`-ed client per context object, i.e. once per request.
//
// With no context it does NOT fall back to an unscoped client: `withOrgScope`
// throws `MissingOrgContextError` on the first operation (§1.4 last row). That
// is the desired outcome on `@Public()`/`@UserScoped()` routes — a bug in our
// code fails loudly instead of quietly serving another tenant's rows (I-3).
import { withOrgScope, type OrgScopeCompatibleClient } from "@omnistock/db";
import type { OrgContextStore } from "./org-context";

/**
 * Builds the `ORG_PRISMA` value. `base` is the ledger-guarded client from
 * `PrismaService`; `store` is the single org-context ALS accessor.
 */
export function createOrgPrismaProxy(base: OrgScopeCompatibleClient, store: OrgContextStore): unknown {
  // Keyed by the context OBJECT, so it dies with the request. `runWithOrgContext`
  // stores one frozen object per scope, which makes the identity stable.
  const perContext = new WeakMap<object, object>();
  let unscoped: object | undefined;

  const scopedClient = (): object => {
    const ctx = store.get();
    if (!ctx) return (unscoped ??= withOrgScope(base, undefined) as object);
    let client = perContext.get(ctx);
    if (!client) {
      client = withOrgScope(base, ctx) as object;
      perContext.set(ctx, client);
    }
    return client;
  };

  return new Proxy(Object.create(null) as object, {
    get(_target, property) {
      const client = scopedClient() as Record<PropertyKey, unknown>;
      const value = client[property];
      // Bind methods to the SCOPED client: `orgPrisma.$transaction(fn)` must run
      // with `this` = the extended client, otherwise the transaction client the
      // callback receives would not inherit the org scope (§2.2 last rows).
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
    },
    has(_target, property) {
      return property in scopedClient();
    },
    ownKeys() {
      return Reflect.ownKeys(scopedClient());
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(scopedClient(), property);
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
  });
}
