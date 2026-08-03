// F-002 · T-002-15 ★ — the `SYSTEM_PRISMA` file-level allowlist, enforced.
// architecture §2.1 (M-1) · §2.4 · `tenancy/prisma-tokens.ts`.
//
// `SYSTEM_PRISMA` is the Prisma client with NO tenant filter. The design says it
// may be injected only from `auth/`, `orgs/system/`, `tenancy/`, `health/` and
// `prisma/` — and until this file existed, that sentence was a comment. A
// comment does not fail CI when the fourth feature module decides its query is
// "a special case".
//
// The scan is textual on purpose (there is no import graph that can express
// "which file may ask the injector for this token") and it is anchored to a
// SELF-CHECK: the last case proves the scanner detects a violation, so a broken
// regex cannot make this suite pass by finding nothing.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// `process.cwd()` is `apps/api` under `pnpm --filter api test` (and under
// vitest's own root). `import.meta.url` would be nicer but this project compiles
// to CommonJS, so it does not typecheck. The existence check below turns a wrong
// cwd into a loud failure instead of a scan that finds nothing and passes.
const SRC = join(process.cwd(), "src");

/**
 * Directories allowed to inject the unfiltered client (architecture §2.1).
 * `admin/` joins the list at F-085 — adding it early would be an allowance for
 * code nobody has reviewed yet.
 */
const ALLOWED_PREFIXES = ["auth/", "orgs/system/", "tenancy/", "health/", "prisma/"] as const;

/** The token as it appears at an injection site. */
const SYSTEM_PRISMA_TOKEN = /\bSYSTEM_PRISMA\b/;

/**
 * Strip comments before matching. Files that EXPLAIN the rule ("this service
 * uses ORG_PRISMA, never SYSTEM_PRISMA") must not be reported as breaking it —
 * a gate that punishes documentation gets the documentation deleted.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/** Does this file's CODE (not its comments) name the unfiltered client? */
const SYSTEM_PRISMA_USE = { test: (source: string): boolean => SYSTEM_PRISMA_TOKEN.test(code(source)) };

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

function isAllowed(relPath: string): boolean {
  const posix = relPath.split(sep).join("/");
  return ALLOWED_PREFIXES.some((prefix) => posix.startsWith(prefix));
}

describe("SYSTEM_PRISMA is confined to the §2.1 allowlist", () => {
  const files = walk(SRC)
    .map((f) => relative(SRC, f))
    .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".int.test.ts"));

  it("the scan is not vacuous — it walked the real source tree", () => {
    expect(existsSync(SRC), `expected the api source tree at ${SRC}`).toBe(true);
    expect(files.length).toBeGreaterThan(20);
    expect(files.map((f) => f.split(sep).join("/"))).toContain("orgs/orgs.module.ts");
  });

  it("★ every file naming SYSTEM_PRISMA is inside the allowlist", () => {
    const offenders = files.filter(
      (file) => SYSTEM_PRISMA_USE.test(readFileSync(join(SRC, file), "utf8")) && !isAllowed(file),
    );
    expect(
      offenders,
      `these files reach for the UNFILTERED Prisma client from outside the allowlist ` +
        `(${ALLOWED_PREFIXES.join(", ")}). Every query they make must carry its own ` +
        `organizationId/userId filter, which is exactly the thing nobody notices is missing. ` +
        `Inject ORG_PRISMA, or move the code into orgs/system/ where the constraint is reviewed.`,
    ).toEqual([]);
  });

  it("★ the org feature module holds it in `system/` ONLY", () => {
    const orgFiles = files.filter((f) => f.split(sep).join("/").startsWith("orgs/"));
    const withToken = orgFiles.filter((file) =>
      SYSTEM_PRISMA_USE.test(readFileSync(join(SRC, file), "utf8")),
    );
    // Non-vacuous: the jail is not empty, so "none found" cannot be a pass.
    expect(withToken.length).toBeGreaterThan(0);
    for (const file of withToken) {
      expect(file.split(sep).join("/")).toMatch(/^orgs\/system\//);
    }
  });

  it("★ exactly the three §2.4 operations hold it — no fourth without a review", () => {
    const jail = files
      .map((f) => f.split(sep).join("/"))
      .filter((f) => f.startsWith("orgs/system/"))
      .filter((f) => SYSTEM_PRISMA_USE.test(readFileSync(join(SRC, f), "utf8")))
      .sort();
    expect(jail).toEqual([
      "orgs/system/my-organizations.service.ts",
      "orgs/system/org-provisioning.service.ts",
      "orgs/system/plan-provisioning.service.ts",
    ]);
  });

  it("SELF-CHECK: the matcher really does detect the token", () => {
    expect(SYSTEM_PRISMA_USE.test("@Inject(SYSTEM_PRISMA) private readonly p: X")).toBe(true);
    expect(SYSTEM_PRISMA_USE.test("@Inject(ORG_PRISMA) private readonly p: X")).toBe(false);
    // …and it reads CODE, not prose about the rule.
    expect(SYSTEM_PRISMA_USE.test("// uses ORG_PRISMA, never SYSTEM_PRISMA")).toBe(false);
    expect(SYSTEM_PRISMA_USE.test("/* SYSTEM_PRISMA is jailed in system/ */")).toBe(false);
    expect(isAllowed("orgs/org-profile.service.ts")).toBe(false);
    expect(isAllowed("orgs/system/org-provisioning.service.ts")).toBe(true);
  });
});
