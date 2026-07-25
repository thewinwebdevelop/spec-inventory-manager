import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

// apps/api tests run under vitest. NestJS type-based DI needs emitted decorator
// metadata (`design:paramtypes`), which esbuild/tsx do NOT produce — so we
// transform TS via SWC (unplugin-swc) with decorator metadata on. Without this,
// full-module @nestjs/testing builds inject `undefined` for typed constructor
// params (the ThrottleService-into-controller bug). Plain unit tests that
// `new` their subject directly don't need it, but this keeps both paths working.
export default defineConfig({
  test: {
    include: ["src/**/*.{test,int.test}.ts"],
    exclude: ["node_modules/**", "dist/**"],
    // Integration/E2E specs (*.int.test.ts) hit a real Postgres/Redis and can be
    // slower; give them headroom.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        target: "es2022",
        transform: { legacyDecorator: true, decoratorMetadata: true },
        keepClassNames: true,
      },
    }),
  ],
});
