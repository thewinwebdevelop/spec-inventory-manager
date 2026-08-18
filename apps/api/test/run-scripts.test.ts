// B-10 — the two ways of starting this API that do not work.
//
// Both were found by booting the stack for the browser lane, and both look
// like the app being broken rather than the command being wrong:
//
//   `node dist/main.js` — dies immediately with `SyntaxError: Unexpected token
//   'export'` inside `packages/config/src/index.ts`. Three of the four
//   workspace packages the API depends on (`config`, `contracts`, `db`) ship
//   TypeScript SOURCE (`"main": "src/index.ts"`), which plain Node cannot
//   load. `tsx` resolves them.
//
//   `tsx src/main.ts` — boots, and then every typed constructor parameter Nest
//   injects is `undefined`, because esbuild does not emit `design:paramtypes`.
//   The first request dies on `Cannot read properties of undefined (reading
//   'checkIp')`. This repo already knows: `vitest.config.ts` runs the test
//   lane through SWC precisely to get that metadata, and names the same bug.
//
// So the working combination is the compiled entry loaded through tsx — the
// one CI has been running green — and this test keeps the scripts on it.
//
// ⚠️ WHAT THIS DOES NOT FIX. The real repair is packaging: those three
// packages should emit `dist/` like `core-domain` and `connectors` already do,
// after which plain `node dist/main.js` works and the tsx dependency at
// runtime goes away. That is devops + backend-api's call and is filed as B-10;
// this test only stops the two traps being re-entered by hand.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
    if (/\bnode\s+dist\/main\.js/.test(command)) {
      problems.push(
        `${name}: plain \`node\` cannot load @omnistock/config — it ships TypeScript source`,
      );
    }
    if (/tsx[^&|]*\bsrc\/main\.ts/.test(command)) {
      problems.push(
        `${name}: \`tsx src/main.ts\` gives Nest no \`design:paramtypes\`, so DI injects undefined`,
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

  it("SELF-CHECK: both traps are recognised, and the working command is not", () => {
    expect(brokenBootCommands({ start: "node dist/main.js" })).toHaveLength(1);
    expect(brokenBootCommands({ dev: "tsx watch src/main.ts" })).toHaveLength(1);
    // The combination CI proves every day.
    expect(brokenBootCommands({ start: "tsx dist/main.js" })).toEqual([]);
    // …and a build step is not a boot command.
    expect(brokenBootCommands({ build: "tsc -p tsconfig.json" })).toEqual([]);
  });

  it("★ `start` and every `dev*` script boot the compiled entry through tsx", () => {
    expect(
      brokenBootCommands(pkg.scripts),
      "see this file's header — both alternatives fail, in different ways, at different times",
    ).toEqual([]);
  });

  it("`start` is the exact command the CI lanes run", () => {
    // If these drift apart, CI stops proving anything about the command a
    // person actually types.
    expect(pkg.scripts.start).toBe("tsx dist/main.js");
  });
});
