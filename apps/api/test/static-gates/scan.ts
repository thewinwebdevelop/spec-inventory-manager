// F-003 · T-003-QA02 — shared plumbing for the static gates (G-06 · G-09 · G-11).
//
// Every gate here reads the SAME production tree with the SAME comment
// stripping, so "the gate is green" always means the same set of files was
// looked at. Comments are blanked with the TypeScript parser (not a regex), so
// prose that explains a rule is never reported as breaking it, strings and
// regex literals are never mistaken for comments, and line numbers survive.
//
// Fixtures live in `__gate_fixtures__/` with a `.fixture` extension: tsc,
// eslint and vitest never pick them up, and no scan root below contains them.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import * as ts from "typescript";

export const REPO = resolve(process.cwd(), "../..");
if (!existsSync(join(REPO, "pnpm-workspace.yaml"))) {
  throw new Error(
    `static gates must run from apps/api (resolved repo root ${REPO} has no pnpm-workspace.yaml)`,
  );
}

export interface Violation {
  gate: string;
  rule: string;
  file: string;
  line: number;
  snippet: string;
}

/** What ships: `apps/api` and every workspace package whose code it runs. */
export const PRODUCTION_ROOTS: readonly string[] = [
  "apps/api/src",
  "apps/api/scripts",
  "packages/core-domain/src",
  "packages/db/src",
  "packages/db/prisma",
  "packages/config/src",
  "packages/contracts/src",
];

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "generated",
  "__boundary_fixtures__",
  "__purity_fixtures__",
  "__gate_fixtures__",
]);
const SOURCE = /\.(?:ts|mts|cts|js|mjs|cjs)$/;
const NOT_PRODUCTION =
  /(?:\.test|\.spec|\.int\.test|\.db\.test|\.compile-test)\.[cm]?[jt]s$|\.d\.ts$/;
const FIXTURES = join(REPO, "apps/api/test/static-gates/__gate_fixtures__");

function walk(dir: string, keep: (f: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full, keep, out);
    } else if (keep(full)) {
      out.push(relative(REPO, full).split(sep).join("/"));
    }
  }
  return out;
}

/** Repo-relative paths of every production source file, sorted. Throws if a root vanished. */
export function productionFiles(): string[] {
  return PRODUCTION_ROOTS.flatMap((root) => {
    const abs = join(REPO, root);
    if (!existsSync(abs))
      throw new Error(`scan root ${root} is gone — update PRODUCTION_ROOTS, do not skip it`);
    return walk(abs, (f) => SOURCE.test(f) && !NOT_PRODUCTION.test(f));
  }).sort();
}

export function sqlMigrationFiles(): string[] {
  return walk(join(REPO, "packages/db/prisma/migrations"), (f) => f.endsWith(".sql")).sort();
}

/** Replace every comment with spaces (newlines kept), using the TS parser. */
export function blankComments(text: string): string {
  const sf = ts.createSourceFile("scan.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const chars = text.split("");
  const seen = new Set<number>();
  const blank = (pos: number) => {
    if (seen.has(pos)) return;
    seen.add(pos);
    const ranges = [
      ...(ts.getLeadingCommentRanges(text, pos) ?? []),
      ...(ts.getTrailingCommentRanges(text, pos) ?? []),
    ];
    for (const r of ranges)
      for (let i = r.pos; i < r.end; i++) if (chars[i] !== "\n") chars[i] = " ";
  };
  const visit = (node: ts.Node) => {
    blank(node.getFullStart());
    blank(node.getEnd());
    for (const child of node.getChildren(sf)) visit(child);
  };
  visit(sf);
  return chars.join("");
}

export const readRaw = (rel: string): string => readFileSync(join(REPO, rel), "utf8");
const codeCache = new Map<string, string>();
export function readCode(rel: string): string {
  if (!codeCache.has(rel)) codeCache.set(rel, blankComments(readRaw(rel)));
  return codeCache.get(rel)!;
}

/** SQL with `--` and block comments blanked (a migration's prose is not a write). */
export function sqlCode(rel: string): string {
  return readRaw(rel)
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/--[^\n]*/g, (c) => " ".repeat(c.length));
}

export const fixture = (name: string): string =>
  blankComments(readFileSync(join(FIXTURES, name), "utf8"));
export const fixtureNames = (prefix: string): string[] =>
  readdirSync(FIXTURES)
    .filter((f) => f.startsWith(prefix))
    .sort();

export const lineOf = (text: string, index: number): number =>
  text.slice(0, index).split("\n").length;

/** Text inside the parentheses that open at `open` (which must be a "("). */
export function balancedArgs(text: string, open: number): string {
  if (text[open] !== "(") throw new Error(`balancedArgs: expected "(" at ${open}`);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}
