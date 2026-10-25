import { defineConfig } from "vitest/config";

// Full tier (test-plan F-003 §7): only `*.full.test.ts`, excluded from the
// default run (vitest.config.ts). Run: `pnpm --filter @omnistock/core-domain test:full`.
// CI node-ci runs it with a JSON report and tool/ci/assert-tests-ran.mjs, so a
// skipped/renamed/emptied full test is red, not a silent green.
export default defineConfig({
  test: {
    include: ["src/**/*.full.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
