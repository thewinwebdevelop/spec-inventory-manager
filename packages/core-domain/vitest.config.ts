import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Negative purity fixture is never run/imported — it exists only to be
    // caught by the dependency-cruiser boundary check.
    exclude: ["src/__purity_fixtures__/**", "node_modules/**", "dist/**"],
  },
});
