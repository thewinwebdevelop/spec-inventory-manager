// B-10 — how this API is started, and the two ways that used to be broken.
//
// ⚠️ THIS FILE HAS BEEN INVERTED ONCE, on purpose. Its first version required
// `tsx dist/main.js` and BANNED `node dist/main.js`, because the packages the
// API imports shipped TypeScript source and plain Node died on the first
// `export` it met. The comment then said the real repair was packaging. That
// repair has landed: `@omnistock/config` and `@omnistock/db` now emit `dist/`
// like `core-domain` and `connectors` always did, and `node dist/main.js`
// loads the whole application — it stops at "DATABASE_URL is required", which
// is a configured-application failure, not a loader failure.
//
// What stays banned is `tsx src/main.ts`, and that one is not about packaging:
// it boots, and then every typed constructor parameter Nest injects is
// `undefined`, because esbuild does not emit `design:paramtypes`. The first
// request dies on `Cannot read properties of undefined (reading 'checkIp')`.
// The repo already knows — `vitest.config.ts` runs the test lane through SWC
// precisely to get that metadata, and names the same bug.
//
// So: compiled entry, plain Node, no TypeScript loader in the boot path.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Repo root, from `apps/api`. */
const REPO_ROOT = join(process.cwd(), "..", "..");

/**
 * The workspace packages this API LOADS AT RUNTIME.
 *
 * `@omnistock/contracts` is deliberately absent: the API imports it with
 * `import type` only, so it never reaches the runtime and may keep shipping
 * source. Naming the runtime set explicitly is the point — the guard below is
 * about what plain Node has to be able to `require`.
 */
const RUNTIME_PACKAGES = ["config", "db", "core-domain"] as const;

/** cwd is `apps/api` under vitest. */
const PACKAGE_JSON = join(process.cwd(), "package.json");

interface PackageJson {
  readonly scripts: Readonly<Record<string, string>>;
}

const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as PackageJson;

/** A script that runs the app, as opposed to building or testing it. */
export function bootScripts(scripts: Readonly<Record<string, string>>): [string, string][] {
  return Object.entries(scripts).filter(([name]) => name === "start" || name.startsWith("dev"));
}

export function brokenBootCommands(scripts: Readonly<Record<string, string>>): string[] {
  const problems: string[] = [];
  for (const [name, command] of bootScripts(scripts)) {
    if (/tsx[^&|]*\bsrc\/main\.ts/.test(command)) {
      problems.push(
        `${name}: \`tsx src/main.ts\` gives Nest no \`design:paramtypes\`, so DI injects undefined`,
      );
    }
    // A TypeScript loader in the boot path at all: the packaging fix removed
    // the need for one, and keeping it would hide the next package that
    // regresses to shipping source.
    if (/\btsx\b/.test(command)) {
      problems.push(
        `${name}: no TypeScript loader belongs in the boot path — the workspace packages emit dist/ now`,
      );
    }
  }
  return problems;
}

describe("B-10 · the API's boot scripts avoid the two ways that do not work", () => {
  it("the scripts were actually read", () => {
    expect(Object.keys(pkg.scripts)).toContain("start");
    expect(bootScripts(pkg.scripts).length).toBeGreaterThan(1);
  });

  it("SELF-CHECK: the DI trap and the loader are both recognised", () => {
    expect(brokenBootCommands({ dev: "tsx watch src/main.ts" })).toHaveLength(2);
    // The old workaround is now itself a finding: it means somebody needed a
    // loader again, which means a package went back to shipping source.
    expect(brokenBootCommands({ start: "tsx dist/main.js" })).toHaveLength(1);
    // What must pass.
    expect(brokenBootCommands({ start: "node dist/main.js" })).toEqual([]);
    expect(brokenBootCommands({ dev: "tsc -p tsconfig.json && node dist/main.js" })).toEqual([]);
    // …and a build step is not a boot command.
    expect(brokenBootCommands({ build: "tsc -p tsconfig.json" })).toEqual([]);
  });

  it("★ `start` and every `dev*` script boot the compiled entry with plain node", () => {
    expect(
      brokenBootCommands(pkg.scripts),
      "see this file's header — the packaging fix is what makes plain node correct here",
    ).toEqual([]);
  });

  it("★ every package the API loads at runtime ships COMPILED output", () => {
    // The cause behind the symptom. `node dist/main.js` failed for months
    // because `@omnistock/config` (and `@omnistock/db`) had
    // `"main": "src/index.ts"` — plain Node reaching a TypeScript `export` and
    // stopping. Banning the tsx workaround above without guarding this would
    // just move the failure: the next package to regress to source would break
    // the boot again, and the message would again look like an app bug.
    const shippingSource: string[] = [];
    for (const name of RUNTIME_PACKAGES) {
      const manifest = JSON.parse(
        readFileSync(join(REPO_ROOT, "packages", name, "package.json"), "utf8"),
      ) as { main?: string; types?: string };
      if (!manifest.main?.endsWith(".js")) {
        shippingSource.push(`@omnistock/${name}: "main" is ${manifest.main} — not compiled output`);
      }
    }
    expect(
      shippingSource,
      "plain `node` cannot load TypeScript; a package in the runtime path must emit dist/",
    ).toEqual([]);
  });

  it("`start` is the exact command the CI lanes run", () => {
    // If these drift apart, CI stops proving anything about the command a
    // person actually types.
    expect(pkg.scripts.start).toBe("node dist/main.js");
  });
});
