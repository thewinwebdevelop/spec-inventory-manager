// F-003 · T-003-QA03 — G-12 scanner: `Role.key` never decides a permission.
//
// Pure functions, no vitest import: the gate test drives them against the real
// tree AND against fixtures (red shapes + green controls), and the SQL expiry is
// judged against a `now` passed in (the clock seam), never `Date.now()` here.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ── code (TS + Dart) ────────────────────────────────────────────────────────

export const CODE_RULE_IDS = ["TS-1", "TS-2", "TS-3", "TS-4", "TS-5", "DART-1", "DART-2"] as const;
export type CodeRuleId = (typeof CODE_RULE_IDS)[number];

export interface CodeHit {
  readonly file: string;
  readonly line: number;
  readonly rule: CodeRuleId;
  readonly text: string;
}

/** A presentation-only file (label map) that may branch on a key. Per file. */
export interface PresentationAllowance {
  readonly file: string;
  readonly reason: string;
  /**
   * Exactly how many hits the file is allowed today. A ratchet: a NEW key read
   * in an allowlisted file is red until someone reviews it and bumps this.
   */
  readonly hits: number;
}

const SYS = "(?:owner|admin|staff)";

// TS operands. `[\w$]*[rR]ole` catches role / targetRole / membership.role;
// `?.` and a trailing `!` are TS spellings of the same read.
const TS_ROLE_DOT_KEY = "[\\w$]*[rR]ole\\??\\.key\\b!?";
const TS_ROLE_KEY = "[\\w$]*[rR]oleKey\\b!?";
const TS_EQ = "(?:===|!==|==|!=)";
const TS_EITHER = `(?:[\\w$?.]*[rR]ole\\??\\.key|[\\w$?.]*[rR]oleKey)!?`;

// Dart operands: `?.`, `!.` and postfix `!`.
const DART_ROLE_DOT_KEY = "[\\w$]*[rR]ole[?!]?\\.key\\b!?";
const DART_ROLE_KEY = "[\\w$]*[rR]oleKey\\b!?";
const DART_EQ = "(?:==|!=)";
const DART_EITHER = `(?:[\\w$?!.]*[rR]ole[?!]?\\.key|[\\w$?!.]*[rR]oleKey)!?`;

const both = (operand: string, eq: string) => `${operand}\\s*${eq}|${eq}\\s*${operand}`;

const TS_RULES: ReadonlyArray<readonly [CodeRuleId, RegExp]> = [
  // 1. role.key === / !== / == / != (either side)
  ["TS-1", new RegExp(both(TS_ROLE_DOT_KEY, TS_EQ))],
  // 2. roleKey === … (either side)
  ["TS-2", new RegExp(both(TS_ROLE_KEY, TS_EQ))],
  // 3. <any>key === "owner"|'admin'|`staff` (either side) — catches `{ key }` destructuring
  [
    "TS-3",
    new RegExp(
      `\\bkey\\s*${TS_EQ}\\s*(["'\`])${SYS}\\1|(["'\`])${SYS}\\2\\s*${TS_EQ}\\s*(?:[\\w$]+\\??\\.)*key\\b`,
      "i",
    ),
  ],
  // 4. [...].includes(role.key) / set.has(roleKey)
  ["TS-4", new RegExp(`\\.(?:includes|has)\\(\\s*${TS_EITHER}\\s*\\)`)],
  // 5. switch (roleKey) / switch (role.key)
  ["TS-5", new RegExp(`\\bswitch\\s*\\(\\s*${TS_EITHER}\\s*\\)`)],
];

const DART_RULES: ReadonlyArray<readonly [CodeRuleId, RegExp]> = [
  // 1. equality in any spelling: role.key == · roleKey != · key == 'owner' (either side)
  [
    "DART-1",
    new RegExp(
      [
        both(DART_ROLE_DOT_KEY, DART_EQ),
        both(DART_ROLE_KEY, DART_EQ),
        `\\bkey\\s*${DART_EQ}\\s*(["'])${SYS}\\1`,
        `(["'])${SYS}\\2\\s*${DART_EQ}\\s*(?:[\\w$]+[?!]?\\.)*key\\b`,
      ].join("|"),
      "i",
    ),
  ],
  // 2. branching / membership: switch (roleKey) (statement or expression) · .contains(role.key)
  [
    "DART-2",
    new RegExp(`\\bswitch\\s*\\(\\s*${DART_EITHER}\\s*\\)|\\.contains\\(\\s*${DART_EITHER}\\s*\\)`),
  ],
];

type Lang = "ts" | "dart";

function languageOf(file: string): Lang | null {
  const path = file.replace(/\.fixture$/, "");
  if (/\.(ts|tsx)$/.test(path)) return "ts";
  if (/\.dart$/.test(path)) return "dart";
  return null;
}

/**
 * Blank out comments (TS and Dart share `//`, `///`, `/* *\/`) while keeping
 * every newline, so line numbers survive. String literals are tracked so a
 * `"src/**\/*.ts"` glob cannot open a fake block comment and hide real code;
 * single-line strings reset at newline so a desync cannot spread.
 */
export function stripComments(source: string, lang: Lang): string {
  let out = "";
  let i = 0;
  let quote: string | null = null; // ', ", `, ''' or """
  while (i < source.length) {
    const ch = source[i]!;
    if (quote) {
      if (ch === "\\") {
        out += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (source.startsWith(quote, i)) {
        out += quote;
        i += quote.length;
        quote = null;
        continue;
      }
      if (ch === "\n" && quote.length === 1 && quote !== "`") quote = null;
      out += ch;
      i += 1;
      continue;
    }
    if (source.startsWith("//", i)) {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    if (lang === "dart" && (source.startsWith("'''", i) || source.startsWith('"""', i))) {
      quote = source.slice(i, i + 3);
      out += quote;
      i += 3;
      continue;
    }
    if (ch === "'" || ch === '"' || (lang === "ts" && ch === "`")) quote = ch;
    out += ch;
    i += 1;
  }
  return out;
}

export function scanCode(file: string, source: string): CodeHit[] {
  const lang = languageOf(file);
  if (!lang) return [];
  const rules = lang === "ts" ? TS_RULES : DART_RULES;
  const raw = source.split("\n");
  const hits: CodeHit[] = [];
  stripComments(source, lang)
    .split("\n")
    .forEach((line, i) => {
      for (const [rule, re] of rules) {
        if (re.test(line)) hits.push({ file, line: i + 1, rule, text: raw[i]!.trim() });
      }
    });
  return hits;
}

export function codeOffenders(
  hits: readonly CodeHit[],
  allowlist: readonly PresentationAllowance[],
): CodeHit[] {
  const allowed = new Set(allowlist.map((a) => a.file));
  return hits.filter((h) => !allowed.has(h.file));
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".dart_tool",
  "__fixtures__",
  "__tests__",
]);
const TEST_FILE = /\.(test|spec)\.tsx?$|_test\.dart$/;

/** Production TS/TSX/Dart under `repo/root`, paths repo-relative with `/`. */
export function collectCodeFiles(repo: string, root: string): { path: string; source: string }[] {
  const out: { path: string; source: string }[] = [];
  const walk = (rel: string): void => {
    for (const entry of readdirSync(join(repo, rel))) {
      const next = `${rel}/${entry}`;
      if (statSync(join(repo, next)).isDirectory()) {
        if (!SKIP_DIRS.has(entry)) walk(next);
      } else if (languageOf(entry) && !entry.endsWith(".fixture") && !TEST_FILE.test(entry)) {
        out.push({ path: next, source: readFileSync(join(repo, next), "utf8") });
      }
    }
  };
  if (existsSync(join(repo, root))) walk(root);
  return out;
}

// ── SQL (migrations) ────────────────────────────────────────────────────────

export const MAX_REMOVE_BY_WINDOW_DAYS = 60;

/** A DB function allowed to read `Role.key` until `removeBy` (inclusive, UTC). */
export interface SqlAllowance {
  /** migration directory name, e.g. `20261001000000_f003_backfill_manage_roles` */
  readonly migration: string;
  readonly fn: string;
  readonly owner: string;
  readonly reason: string;
  /** YYYY-MM-DD — merge date of the PR that added it */
  readonly addedOn: string;
  /** YYYY-MM-DD — last day it may still be live; ≤ addedOn + 60 days */
  readonly removeBy: string;
}

export interface Migration {
  readonly name: string;
  readonly sql: string;
}

export interface SqlFunctionCreate {
  readonly migration: string;
  readonly fn: string;
  readonly line: number;
  readonly offset: number;
  readonly readsRoleKey: boolean;
}

export interface SqlFunctionDrop {
  readonly migration: string;
  readonly fn: string;
  readonly offset: number;
}

export function loadMigrations(dir: string): Migration[] {
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, "migration.sql")))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name, "migration.sql"), "utf8") }));
}

/** Remove `--` and block comments outside '…' strings; keep newlines. */
function stripSqlComments(sql: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < sql.length) {
    const ch = sql[i]!;
    if (inString) {
      out += ch;
      if (ch === "'") inString = false; // '' re-opens on the next char — same result
      i += 1;
      continue;
    }
    if (sql.startsWith("--", i)) {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      continue;
    }
    if (sql.startsWith("/*", i)) {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      out += sql.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    if (ch === "'") inString = true;
    out += ch;
    i += 1;
  }
  return out;
}

const normalizeFn = (name: string): string =>
  name.replace(/"/g, "").split(".").pop()!.trim().toLowerCase();

const KEY = `(?<![\\w$])"?key"?(?![\\w$])`;
const LIT = `'${SYS}'`;
const SQL_KEY_READ = new RegExp(
  [
    `${KEY}\\s*(?:=|<>|!=|IS\\s+(?:NOT\\s+)?DISTINCT\\s+FROM)\\s*${LIT}`,
    `${LIT}\\s*(?:=|<>|!=)\\s*(?:[\\w"]+\\s*\\.\\s*)?${KEY}`,
    `${KEY}\\s+(?:NOT\\s+)?IN\\s*\\([^)]*${LIT}`,
    `CASE\\s+(?:[\\w"]+\\s*\\.\\s*)?${KEY}\\s+WHEN\\s+${LIT}`,
  ].join("|"),
  "i",
);

const CREATE_FN =
  /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+((?:"[^"]+"|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|[\w$]+))?)\s*\(/gi;
const DROP_FN = /\bDROP\s+(?:FUNCTION|PROCEDURE)\s+(?:IF\s+EXISTS\s+)?([^;]+);/gi;

/** Only `CREATE … FUNCTION … $tag$ body $tag$` bodies count — not UPDATE, not DO. */
export function parseMigration(
  migration: string,
  sql: string,
): { creates: SqlFunctionCreate[]; drops: SqlFunctionDrop[] } {
  const text = stripSqlComments(sql);
  const creates: SqlFunctionCreate[] = [];
  for (const m of text.matchAll(CREATE_FN)) {
    const after = m.index! + m[0].length;
    const open = /\$([A-Za-z_]\w*)?\$/.exec(text.slice(after));
    if (!open)
      throw new Error(
        `G-12: ${migration}: CREATE FUNCTION ${m[1]} has no $-quoted body — extend the parser`,
      );
    const bodyStart = after + open.index + open[0].length;
    const bodyEnd = text.indexOf(open[0], bodyStart);
    if (bodyEnd === -1)
      throw new Error(`G-12: ${migration}: unterminated ${open[0]} body for ${m[1]}`);
    creates.push({
      migration,
      fn: normalizeFn(m[1]!),
      line: text.slice(0, m.index).split("\n").length,
      offset: m.index!,
      readsRoleKey: SQL_KEY_READ.test(text.slice(bodyStart, bodyEnd)),
    });
  }
  const drops: SqlFunctionDrop[] = [];
  for (const m of text.matchAll(DROP_FN)) {
    const names = m[1]!
      .replace(/\([^)]*\)/g, "")
      .replace(/\b(CASCADE|RESTRICT)\b/gi, "")
      .split(",")
      .map(normalizeFn)
      .filter(Boolean);
    for (const fn of names) drops.push({ migration, fn, offset: m.index! });
  }
  return { creates, drops };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (s: string): boolean =>
  ISO_DAY.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const daysBetween = (a: string, b: string): number =>
  (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;

function validateEntry(e: SqlAllowance): string[] {
  const id = `allowlist ${e.migration}/${e.fn}`;
  const errs: string[] = [];
  if (!e.owner.trim()) errs.push(`${id}: owner is required`);
  if (!e.reason.trim()) errs.push(`${id}: reason is required`);
  if (!validDay(e.addedOn)) errs.push(`${id}: addedOn "${e.addedOn}" is not YYYY-MM-DD`);
  if (!validDay(e.removeBy)) errs.push(`${id}: removeBy "${e.removeBy}" is not YYYY-MM-DD`);
  if (validDay(e.addedOn) && validDay(e.removeBy)) {
    const days = daysBetween(e.addedOn, e.removeBy);
    if (days < 0 || days > MAX_REMOVE_BY_WINDOW_DAYS) {
      errs.push(
        `${id}: window addedOn→removeBy is ${days} days (allowed 0..${MAX_REMOVE_BY_WINDOW_DAYS})`,
      );
    }
  }
  return errs;
}

/**
 * Every reason the migrations break G-12, as messages. Empty = green.
 * `now` is the clock seam: the entry expires the UTC day AFTER `removeBy`.
 */
export function sqlOffenders(
  migrations: readonly Migration[],
  allowlist: readonly SqlAllowance[],
  now: Date,
): string[] {
  const today = now.toISOString().slice(0, 10);
  const ordered = [...migrations].sort((a, b) => a.name.localeCompare(b.name));
  type Event = { kind: "create"; c: SqlFunctionCreate } | { kind: "drop"; d: SqlFunctionDrop };
  const events: Array<{ fn: string; seq: number; e: Event }> = [];
  ordered.forEach((m, mi) => {
    const { creates, drops } = parseMigration(m.name, m.sql);
    for (const c of creates)
      events.push({ fn: c.fn, seq: mi * 1e9 + c.offset, e: { kind: "create", c } });
    for (const d of drops)
      events.push({ fn: d.fn, seq: mi * 1e9 + d.offset, e: { kind: "drop", d } });
  });
  events.sort((a, b) => a.seq - b.seq);

  const problems: string[] = allowlist.flatMap(validateEntry);
  const covers = (e: SqlAllowance, c: SqlFunctionCreate) =>
    e.migration === c.migration && normalizeFn(e.fn) === c.fn;
  const keyed = events.flatMap((x) => (x.e.kind === "create" && x.e.c.readsRoleKey ? [x.e.c] : []));

  for (const c of keyed) {
    if (!allowlist.some((e) => covers(e, c))) {
      problems.push(
        `${c.migration}/migration.sql:${c.line} function ${c.fn} reads Role.key ('owner'|'admin'|'staff') ` +
          "and is not allowlisted — decide by capabilities, or add an entry with owner + removeBy",
      );
    }
  }
  for (const entry of allowlist) {
    if (!keyed.some((c) => covers(entry, c))) {
      problems.push(
        `allowlist ${entry.migration}/${entry.fn} is stale: that migration creates no such key-reading function`,
      );
      continue;
    }
    if (!validDay(entry.removeBy) || today <= entry.removeBy) continue;
    const last = events.filter((x) => x.fn === normalizeFn(entry.fn)).pop()!;
    if (last.e.kind === "create" && last.e.c.readsRoleKey) {
      problems.push(
        `function ${entry.fn} (owner ${entry.owner}) is past removeBy ${entry.removeBy} (today ${today} UTC) ` +
          "and no later migration drops it — ship the drop migration (data-model §4.2)",
      );
    }
  }
  return problems;
}
