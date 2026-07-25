// apps/api architectural boundary gate — dependency-cruiser config set #3
// (backend.md §5.2 item 3, refactor-plan R1). Sibling of the core-domain purity
// config; same style, same location. Encodes the §2.2 intra-app dependency
// rules that are enforceable on TODAY's module set (auth/health/prisma/tenancy/
// common) and stay valid as the backlog modules land.
//
// Run via the `omnistock-api-boundaries` bin (packages/config), which does a
// clean scan (must be 0) + a negative-fixture scan (must fire) — same
// self-proving shape as the purity gate, so the gate is live, not decorative.

const DB_TARGETS = [
  // @omnistock/db (Prisma client re-export). List every shape depcruise may
  // report in `resolved`: the workspace source path (pnpm symlink resolves the
  // specifier to the real package src), the node_modules path, and the bare
  // specifier — same dual/triple-shape approach as the core-domain purity config.
  "^packages/db(/|$)",
  "^@omnistock/db(/|$)",
  "node_modules/@omnistock/db",
  // Prisma client directly
  "^@prisma/client(/|$)",
  "node_modules/@prisma/client",
  "^\\.prisma(/|$)",
  "node_modules/\\.prisma",
];

// Feature modules (§2.2 map). Middle-layer code (common/tenancy/prisma/jobs)
// must never import these — dependencies point leaf-ward only.
const FEATURE_MODULES =
  "^apps/api/src/(auth|orgs|rbac|entitlements|settings|audit|catalog|inventory" +
  "|channels|sync|orders|dashboard|documents|accounting|ops|notifications|bulk" +
  "|billing|metering|admin)/";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "api-leafward-only",
      comment:
        "Middle-layer modules (common/, tenancy/, prisma/, jobs/) are shared " +
        "infra used BY features — they must not import a feature module back " +
        "(backend.md §2.2 rule 2). Dependencies point leaf-ward only.",
      severity: "error",
      from: { path: "^apps/api/src/(common|tenancy|prisma|jobs)/" },
      to: { path: FEATURE_MODULES },
    },
    {
      name: "api-connectors-scoped",
      comment:
        "@omnistock/connectors may only be imported by the modules that talk " +
        "to a real platform: channels/, sync/, ops/ (backend.md §2.2 rule 3). " +
        "Everything else sees normalized types re-exported through channels/.",
      severity: "error",
      from: { pathNot: "^apps/api/src/(channels|sync|ops)/" },
      to: {
        path: [
          "^packages/connectors(/|$)",
          "^@omnistock/connectors(/|$)",
          "node_modules/@omnistock/connectors",
        ],
      },
    },
    {
      name: "api-db-client-allowlisted",
      comment:
        "The Prisma client (@omnistock/db / @prisma/client) may only be " +
        "imported from the allowlist prisma/, tenancy/, health/, auth/ " +
        "(backend.md §3.3). Feature modules inject a scoped provider, never the " +
        "raw client. Test files are exempt (they seed fixtures directly).",
      severity: "error",
      from: {
        path: "^apps/api/src/",
        pathNot: [
          "^apps/api/src/(prisma|tenancy|health|auth)/",
          "\\.(test|int\\.test)\\.ts$",
        ],
      },
      to: { path: DB_TARGETS },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // Catch type-only imports too — `import type { PrismaClient }` still couples
    // the layer. The TS parser resolves bare specifiers on its own (no path
    // aliases in apps/api tsconfig), same as the purity config.
    tsPreCompilationDeps: true,
  },
};
