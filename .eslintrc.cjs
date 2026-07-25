// Root ESLint config — extends the shared base from packages/config.
// Rule content lives in packages/config/eslint/base.js (T-000-01); this file
// only wires it up so `eslint` (invoked by lint-staged, T-000-03) can run
// against the whole repo without duplicating rule content here.
module.exports = {
  root: true,
  extends: ["./packages/config/eslint/base.js"],
  ignorePatterns: [
    "dist",
    ".next",
    ".turbo",
    "coverage",
    "node_modules",
    "packages/db/src/generated",
    "packages/contracts/src/generated",
    // apps/mobile/api_client (relocated from apps/mobile/lib/generated/api, D-015) is a Dart
    // package — ESLint never lints .dart files, so no ignore entry is needed here.
    // Next.js's own auto-generated stub (apps/web) — its header says "should
    // not be edited"; the triple-slash reference it emits is Next.js's
    // required convention, not something we can fix in our source.
    "apps/web/next-env.d.ts",
  ],
};
