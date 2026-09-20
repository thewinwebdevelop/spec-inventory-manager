// F-002 · T-002-21 — the bundle must be in step with its sources.
//
// `openapi/openapi.yaml` is GENERATED from `openapi/root.yaml` + `paths/*` +
// `components/*`, and it is also the file every consumer reads: `redocly lint`,
// `openapi-typescript`, the Dart generator, `oasdiff`, and the router↔spec
// parity gate in apps/api.
//
// So a source file edited without re-bundling would leave every one of those
// tools looking at yesterday's contract while the reviewer reads today's. The
// `contracts-drift` CI job catches MOST of that (it re-bundles, regenerates and
// fails on a diff) — but only when the change happens to alter the generated
// clients. A description-only edit would slip through, and descriptions are the
// contract's documentation.
//
// This test closes the gap by asking the direct question: bundle the sources
// again and compare byte for byte with what is committed.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * The package root, found by walking up from vitest's cwd until `openapi/` is
 * there. Not `import.meta.url`: `tsc -p tsconfig.json` compiles this package
 * with a CommonJS module target and rejects it.
 */
const PACKAGE_ROOT = (() => {
  let dir = resolve(process.cwd());
  for (;;) {
    if (existsSync(join(dir, "openapi", "root.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`bundle-freshness: no openapi/root.yaml found above ${process.cwd()}`);
    }
    dir = parent;
  }
})();
const BUNDLE = join(PACKAGE_ROOT, "openapi", "openapi.yaml");
const ROOT = join(PACKAGE_ROOT, "openapi", "root.yaml");
const REDOCLY = join(PACKAGE_ROOT, "node_modules", ".bin", "redocly");

describe("openapi bundle freshness", () => {
  it("★ openapi.yaml equals a fresh bundle of root.yaml — run `pnpm --filter @omnistock/contracts bundle`", () => {
    const dir = mkdtempSync(join(tmpdir(), "omnistock-bundle-"));
    const fresh = join(dir, "openapi.yaml");
    try {
      execFileSync(REDOCLY, ["bundle", ROOT, "-o", fresh, "--ext", "yaml"], {
        cwd: PACKAGE_ROOT,
        stdio: "pipe",
      });
      const committed = readFileSync(BUNDLE, "utf8");
      const regenerated = readFileSync(fresh, "utf8");
      // Not a hash comparison: when this fails, the reviewer wants to see WHICH
      // line moved, and vitest prints the diff of two strings.
      expect(regenerated).toBe(committed);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it("the committed bundle really is bundled — no unresolved external $ref survives", () => {
    // A `$ref` pointing outside the document means the file is a source, not a
    // bundle, and every consumer would resolve it differently (or not at all).
    const committed = readFileSync(BUNDLE, "utf8");
    const external = committed
      .split("\n")
      .filter((line) => /\$ref:/.test(line) && !/\$ref:\s*['"]?#\//.test(line));
    expect(external).toEqual([]);
  });
});
