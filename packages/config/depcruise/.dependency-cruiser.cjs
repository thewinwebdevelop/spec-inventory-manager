// Architectural boundary gate (golden rule 6, DECISIONS.md D-002, F-000 AC9).
//
// core-domain must stay framework/DB-free. This runs as its OWN CLI step
// (`depcruise`) with its own non-zero exit — it is NOT an ESLint rule, so it
// cannot be silenced by an inline `// eslint-disable` (architecture.md §3.1).
//
// The dependency-cruiser inline escape hatch (`dependency-cruiser-disable`)
// is separately banned inside packages/core-domain by a grep guard in the
// `depcruise` script (architecture.md §3.3) so the boundary is un-bypassable.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-domain-is-pure",
      comment:
        "core-domain must stay framework/DB-free (golden rule 6, D-002). " +
        "It operates on plain value objects, not Prisma models — declare a " +
        "local interface instead of importing @omnistock/db or a framework.",
      severity: "error",
      from: { path: "^packages/core-domain/src" },
      // `to.path` is matched against dependency-cruiser's `resolved` field.
      // We list BOTH shapes: (a) the resolved on-disk path when the dep is
      // installed/reachable (`node_modules/...`, `^packages/db`) AND (b) the
      // bare module specifier as it appears when the dep is NOT installed in
      // core-domain (which is the healthy state — purity means these are never
      // deps). The bare-specifier patterns are what actually fire in a pure
      // package, so a forbidden import is caught even before anyone installs it.
      to: {
        path: [
          // @omnistock/db (the DB package) — resolved path or bare specifier
          "^packages/db(/|$)",
          "^@omnistock/db(/|$)",
          "node_modules/@omnistock/db",
          // Prisma
          "^@prisma/client(/|$)",
          "^prisma(/|$)",
          "^\\.prisma(/|$)",
          "node_modules/@prisma/client",
          "node_modules/\\.prisma",
          "node_modules/prisma",
          // NestJS
          "^@nestjs/",
          "node_modules/@nestjs",
          // web/queue/infra frameworks
          "^express(/|$)",
          "^bullmq(/|$)",
          "^ioredis(/|$)",
          "node_modules/express",
          "node_modules/bullmq",
          "node_modules/ioredis",
        ],
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // Catch type-only imports too — `import type { PrismaClient }` still
    // couples core-domain to the DB layer (architecture.md §3.2). No tsConfig
    // is wired because core-domain uses no TS path aliases; the TS parser
    // resolves plain module specifiers on its own. (Pointing at the bare shared
    // base tsconfig makes tsc glob an empty dir → TS18003; not needed here.)
    tsPreCompilationDeps: true,
  },
};
