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

const OPEN = "([{";
const CLOSE = ")]}";

/** Text inside the bracket that opens at `open` ("(", "[" or "{"). */
export function balancedArgs(text: string, open: number): string {
  if (!OPEN.includes(text[open])) throw new Error(`balancedArgs: expected a bracket at ${open}`);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (OPEN.includes(text[i])) depth++;
    else if (CLOSE.includes(text[i]) && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}

/**
 * Top-level `key: value` entries of an object literal's inner text (shorthand
 * `{ create }` yields value = the key). Nested brackets are skipped whole.
 */
export function topLevelEntries(inner: string): { key: string; value: string }[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    if (OPEN.includes(inner[i])) depth++;
    else if (CLOSE.includes(inner[i])) depth--;
    else if (inner[i] === "," && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .map((p) => {
      const m = /^([\w$]+)\s*:\s*([\s\S]*)$/.exec(p);
      return m ? { key: m[1], value: m[2].trim() } : { key: p, value: p };
    });
}

/** A value that is one object or an array of them → each element's text. */
export function elements(value: string): string[] {
  if (!value.startsWith("[")) return [value];
  return topLevelEntries(balancedArgs(value, 0)).map((e) => e.value);
}

/** Inner text of an object-literal value, or null when it is not a literal. */
export const objectInner = (value: string): string | null =>
  value.startsWith("{") ? balancedArgs(value, 0) : null;

// ── AST helpers (F-003 · T-003-B15 fix round 1) — method-scoped, not file-wide ──

const parse = (text: string): ts.SourceFile =>
  ts.createSourceFile("s.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** A class method DECLARATION (never a call site that happens to share its name). */
export interface MethodSpan {
  readonly name: string; // `Class.method`
  readonly start: number;
  readonly end: number;
  readonly node: ts.MethodDeclaration;
  readonly sf: ts.SourceFile;
}

/** Every `Class.method` declared in `text`, from the TypeScript AST. */
export function classMethods(text: string): MethodSpan[] {
  const sf = parse(text);
  const out: MethodSpan[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isMethodDeclaration(node) && ts.isClassDeclaration(node.parent) && node.parent.name) {
      out.push({
        name: `${node.parent.name.text}.${node.name.getText(sf)}`,
        start: node.getStart(sf),
        end: node.getEnd(),
        node,
        sf,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** `Class.method` whose declaration encloses `pos`, or `<module>`. */
export function enclosingMethod(text: string, pos: number): string {
  const inner = classMethods(text)
    .filter((m) => pos >= m.start && pos < m.end)
    .sort((a, b) => b.start - a.start)[0];
  return inner?.name ?? "<module>";
}

/** One `runInOrgLockTransaction(client, callback, { operation })` inside a method. */
export interface LockCall {
  /** `[start, end)` of the callback argument — the only place the lock is held. */
  readonly callback: readonly [number, number] | null;
  /** The string literal passed as `operation`, or null when absent / not a literal. */
  readonly operation: string | null;
}

/** Every `runInOrgLockTransaction(…)` call in `method`'s OWN body. */
export function lockCallsIn(method: MethodSpan): LockCall[] {
  const out: LockCall[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      /(?:^|\.)runInOrgLockTransaction$/.test(node.expression.getText(method.sf))
    ) {
      const cb = node.arguments[1];
      const opts = node.arguments[2];
      let operation: string | null = null;
      if (opts && ts.isObjectLiteralExpression(opts)) {
        for (const p of opts.properties) {
          if (
            ts.isPropertyAssignment(p) &&
            p.name.getText(method.sf) === "operation" &&
            ts.isStringLiteralLike(p.initializer)
          )
            operation = p.initializer.text;
        }
      }
      out.push({
        callback:
          cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))
            ? [cb.getStart(method.sf), cb.getEnd()]
            : null,
        operation,
      });
    }
    ts.forEachChild(node, visit);
  };
  if (method.node.body) visit(method.node.body);
  return out;
}
