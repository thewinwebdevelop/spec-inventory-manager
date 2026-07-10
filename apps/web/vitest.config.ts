import { defineConfig } from "vitest/config";

// apps/web tests run under jsdom (component tests need a DOM) with the
// React plugin disabled (we don't need JSX fast-refresh here) — vitest's
// esbuild transform handles .tsx fine for plain rendering tests via
// testing-library. D-014: pure logic (throttle countdown, refresh/retry,
// CSRF header, validation) lives in src/lib/**/*.test.ts; component states
// live in src/components/**/*.test.tsx.
export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./test-setup/vitest-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
