// ★ B-7 — the "grep gate" for raw SQL, which did not exist.
//
// `packages/db/src/tenancy.ts` says, next to the Mongo-only raw operations:
//
//     raw shapes cannot be scoped by this seam anyway
//     ($queryRaw/$executeRaw are handled by the grep gate)
//
// There was no grep gate. The reviewer searched `ci.yml`, `tool/`, the eslint
// config and the depcruise configs and found only `api-boundaries` (an
// IMPORT-level rule) and the core-domain purity gate. Nothing looked at raw
// SQL at all.
//
// Nothing is broken today — the four callers are `SYSTEM_PRISMA`/transaction
// clients with parameterised queries. The damage was the sentence: a developer
// who wants a fast aggregate reads it, writes `$queryRaw` on `ORG_PRISMA`, and
// believes something is watching. It is not, and the seam CANNOT watch: a raw
// query carries no model or `where` for `withOrgScope` to extend, so it runs
// unscoped and does not throw. Verified against Postgres: `$queryRaw` through
// an org-scoped client returned rows with no tenant filter applied.
//
// Same shape as `system-prisma-allowlist.test.ts`, which is the pattern that
// has worked on this codebase: a textual scan with an explicit allowlist and a
// self-check, so a broken matcher cannot pass by finding nothing.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");

/**
 * Files allowed to issue raw SQL, each for a stated reason.
 *
 * The bar is NOT "it is parameterised". It is "this query cannot be expressed
 * through the scoped client, and the file is one where tenant scoping is
 * reviewed" — the same bar as the `SYSTEM_PRISMA` allowlist, because it is the
 * same risk: a query nothing will add `organizationId` to.
 */
const ALLOWED_RAW_SQL_FILES: readonly string[] = Object.freeze([
  // Liveness probe — `SELECT 1`, no tenant concept.
  "prisma/prisma.service.ts",
  // F-001 refresh-token rotation: a conditional UPDATE whose atomicity is the
  // point (reuse detection). Keyed by token family, not by org.
  "auth/refresh-token.service.ts",
  // F-001 admin reset + login paths, on the SYSTEM client by design.
  "auth/auth.service.ts",
]);

/** Raw-SQL entry points on any Prisma client. */
const RAW_SQL = /\$(queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)\b/;

/** Strip comments so a file EXPLAINING the rule is not reported as breaking it. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

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

describe("raw SQL is confined to an allowlist (B-7)", () => {
  const files = walk(SRC)
    .map((f) => relative(SRC, f).split(sep).join("/"))
    .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".int.test.ts"))
    .filter((f) => !f.startsWith("__boundary_fixtures__/"));

  it("the scan walked the real source tree", () => {
    expect(existsSync(SRC), `expected the api source tree at ${SRC}`).toBe(true);
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain("orgs/invitations.service.ts");
  });

  it("★ no file outside the allowlist issues raw SQL", () => {
    const offenders = files.filter(
      (file) => RAW_SQL.test(code(readFileSync(join(SRC, file), "utf8"))) &&
        !ALLOWED_RAW_SQL_FILES.includes(file),
    );
    expect(
      offenders,
      "raw SQL cannot be tenant-scoped by `withOrgScope` — it carries no model " +
        "and no `where` for the seam to extend, so it runs UNSCOPED and does not " +
        "throw. Express the query through the scoped client, or add the file here " +
        "with a comment saying why it cannot be.",
    ).toEqual([]);
  });

  it("the allowlist has no stale entries (a file that no longer needs it)", () => {
    // An allowlist that outlives its reason is a permission nobody revisits.
    for (const file of ALLOWED_RAW_SQL_FILES) {
      expect(existsSync(join(SRC, file)), `${file} is allowlisted but does not exist`).toBe(true);
      expect(
        RAW_SQL.test(code(readFileSync(join(SRC, file), "utf8"))),
        `${file} is allowlisted for raw SQL but no longer uses any — remove it`,
      ).toBe(true);
    }
  });

  it("SELF-CHECK: the matcher detects every raw entry point, and reads code not prose", () => {
    for (const call of ["$queryRaw`SELECT 1`", "$queryRawUnsafe(sql)", "$executeRaw`x`", "$executeRawUnsafe(sql)"]) {
      expect(RAW_SQL.test(call), call).toBe(true);
    }
    expect(RAW_SQL.test("this.prisma.membership.count()")).toBe(false);
    // A file that documents the rule must not be flagged by it.
    expect(RAW_SQL.test(code("// never call $queryRaw on ORG_PRISMA"))).toBe(false);
    expect(RAW_SQL.test(code("/* $executeRaw is allowlisted only in auth/ */"))).toBe(false);
  });
});
