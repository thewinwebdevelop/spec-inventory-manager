import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Negative purity fixture is never run/imported — it exists only to be
    // caught by the dependency-cruiser boundary check.
    // `*.full.test.ts` = full tier (test-plan F-003 §7): exhaustive runs that
    // would slow every unit run. They run via `test:full` (vitest.full.config.ts)
    // in CI node-ci, behind the assert-tests-ran guard — excluded here, not skipped.
    exclude: ["src/__purity_fixtures__/**", "src/**/*.full.test.ts", "node_modules/**", "dist/**"],
  },
});
