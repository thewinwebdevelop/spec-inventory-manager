// F-003 · T-003-QA03 — G-12 scanner: `Role.key` never decides a permission.
//
// Pure functions, no vitest import: the gate test drives them against the real
// tree AND against fixtures (red shapes + green controls), and the SQL expiry is
// judged against a `now` passed in (the clock seam), never `Date.now()` here.
//
// ⚠️ WHAT THE REGEXES CANNOT SEE — by design, not by oversight. The behavioural
// layer is I3-56 / I-45 (swap `key` on a real DB; permissions must not move —
// architecture §14). This file is the fast layer only. Known blind spots:
//   · a key carried away through a variable that is NOT assigned on one line
//     from the key (`let k; … k = x`, `const k = role.key ?? "staff"`, spread,
//     `Object.values(role)`, a Map built at runtime and read with that variable)
//   · a key passed to a callee in LABEL_CALLEES (display only, exempt by name)
//   · `({ key }: Role) => …` parameter destructuring — caught only when that
//     `key` is then compared to a literal / a named constant / switched on
//   · Dart enum `.name` mirroring the key, extension getters
//   · TS regex literal after a keyword (`return /a\/*b/`) is read as division;
//     only a `/*` inside such a literal could desync the comment stripper
//   · SQL: a function whose body is `BEGIN ATOMIC` (no `$$`) makes the parser
//     THROW (loud, not silent) · a `DROP FUNCTION` issued as dynamic SQL inside
//     a `$q$…$q$` string in a DO block is counted as a real drop
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ── code (TS + Dart) ────────────────────────────────────────────────────────

export const CODE_RULE_IDS = [
  "TS-1",
  "TS-2",
  "TS-3",
  "TS-4",
  "TS-5",
  "TS-6",
  "TS-7",
  "TS-8",
  "DART-1",
  "DART-2",
  "DART-3",
  "DART-4",
] as const;
export type CodeRuleId = (typeof CODE_RULE_IDS)[number];

export interface CodeHit {
  readonly file: string;
  readonly line: number;
  readonly rule: CodeRuleId;
  readonly text: string;
}

/**
 * A presentation-only file (label map) that may read a key for display.
 * Pinned per LINE: `lines` is the exact trimmed text of every line allowed to
 * hit. A new key read in the same file is red until reviewed and pinned; a
 * pinned line that no longer hits is stale (also red).
 */
export interface PresentationAllowance {
  readonly file: string;
  readonly reason: string;
  readonly lines: readonly string[];
}

/** Display helpers that may take a role key as an argument (exempt from TS-7/DART-4 "argument"). */
export const LABEL_CALLEES: readonly string[] = ["roleLabel"];

const SYS = "(?:owner|admin|staff)";
// `(` right after the callee, or `,` inside its argument list.
const NOT_ARG_OF_LABEL = `(?<!\\b(?:${LABEL_CALLEES.join("|")})\\s*(?:\\([^()]*)?)`;

// Operands. `[\w$?.!]*[rR]ole` catches role / targetRole / membership.role;
// `?.`, `!.` and a trailing `!` are TS/Dart spellings of the same read.
const TS_ROLE_DOT_KEY = "[\\w$]*[rR]ole\\??\\.key\\b!?";
const TS_ROLE_KEY = "[\\w$]*[rR]oleKey\\b!?";
const TS_EQ = "(?:===|!==|==|!=)";
const TS_OP = `(?:[\\w$?.!]*[rR]ole\\??\\.key\\b|[\\w$?.!]*[rR]oleKey\\b)!?`;
// No backreferences: `re()` joins alternatives, which renumbers capture groups.
const TS_LIT = `(?:"${SYS}"|'${SYS}'|\`${SYS}\`)`;

const DART_ROLE_DOT_KEY = "[\\w$]*[rR]ole[?!]?\\.key\\b!?";
const DART_ROLE_KEY = "[\\w$]*[rR]oleKey\\b!?";
const DART_EQ = "(?:==|!=)";
const DART_OP = `(?:[\\w$?!.]*[rR]ole[?!]?\\.key\\b|[\\w$?!.]*[rR]oleKey\\b)!?`;
const DART_LIT = `(?:"${SYS}"|'${SYS}')`;

const both = (operand: string, eq: string) => `${operand}\\s*${eq}|${eq}\\s*${operand}`;
const re = (parts: readonly string[], flags = "") => new RegExp(parts.join("|"), flags);

/** The key goes somewhere a later decision can read it. */
const indirection = (op: string, aliasDecl: string): string[] => [
  `\\[\\s*${op}\\s*\\]`, // POLICY[role.key] · {'owner': 9}[roleKey]
  `[rR]ole[?!]?\\.key\\s*[?!]?\\.\\s*[\\w$]+\\s*\\(`, // role.key.toLowerCase()
  `[rR]oleKey\\s*[?!]?\\.\\s*[\\w$]+\\s*\\(`, // roleKey.trim()
  `${NOT_ARG_OF_LABEL}[(,]\\s*${op}\\s*[,)]`, // String(role.key) · can(role.key, …) · indexOf(roleKey)
  `\\b${aliasDecl}\\s+[\\w$]+(?:\\s*:\\s*[^=]+)?\\s*(?<![=!<>])=(?!=)\\s*${op}\\s*(?:;|$)`, // const k = role.key;
  `\\{[^}]*\\bkey\\b[^}]*\\}\\s*=\\s*[\\w$?!.]*[rR]ole\\b`, // const { key } = membership.role
];

/** `key` against a named constant (r.key === OWNER) · bare `switch (key)`. */
const namedConstant = (eq: string): string[] => [
  `\\bkey\\s*${eq}\\s*[\\w$.]*?(?:owner|admin|staff)[\\w$]*`,
  `[\\w$.]*(?:owner|admin|staff)[\\w$]*\\s*${eq}\\s*(?:[\\w$]+[?!]?\\.)*key\\b`,
  `\\bswitch\\s*\\(\\s*key\\s*\\)`,
];

const TS_RULES: ReadonlyArray<readonly [CodeRuleId, RegExp]> = [
  // 1. role.key === / !== / == / != (either side)
  ["TS-1", re([both(TS_ROLE_DOT_KEY, TS_EQ)])],
  // 2. roleKey === … (either side)
  ["TS-2", re([both(TS_ROLE_KEY, TS_EQ)])],
  // 3. <any>key === "owner"|'admin'|`staff` (either side)
  [
    "TS-3",
    re(
      [
        `\\bkey\\s*${TS_EQ}\\s*(["'\`])${SYS}\\1`,
        `(["'\`])${SYS}\\2\\s*${TS_EQ}\\s*(?:[\\w$]+\\??\\.)*key\\b`,
      ],
      "i",
    ),
  ],
  // 4. [...].includes(role.key) / set.has(roleKey)
  ["TS-4", re([`\\.(?:includes|has)\\(\\s*${TS_OP}\\s*\\)`])],
  // 5. switch (roleKey) / switch (role.key)
  ["TS-5", re([`\\bswitch\\s*\\(\\s*${TS_OP}\\s*\\)`])],
  // 6. ANY value compared to / cased on a system-role literal (k === "owner", case "admin":)
  [
    "TS-6",
    re([`${TS_EQ}\\s*${TS_LIT}`, `${TS_LIT}\\s*${TS_EQ}`, `\\bcase\\s+${TS_LIT}\\s*:`], "i"),
  ],
  // 7. indirection: index · method on the key · key as an argument · alias · destructure
  ["TS-7", re(indirection(TS_OP, "(?:const|let|var)"))],
  // 8. key vs a named constant · bare switch (key)
  ["TS-8", re(namedConstant(TS_EQ), "i")],
];

const DART_RULES: ReadonlyArray<readonly [CodeRuleId, RegExp]> = [
  // 1. equality in any spelling: role.key == · roleKey != · key == 'owner' (either side)
  [
    "DART-1",
    re(
      [
        both(DART_ROLE_DOT_KEY, DART_EQ),
        both(DART_ROLE_KEY, DART_EQ),
        `\\bkey\\s*${DART_EQ}\\s*(["'])${SYS}\\1`,
        `(["'])${SYS}\\2\\s*${DART_EQ}\\s*(?:[\\w$]+[?!]?\\.)*key\\b`,
      ],
      "i",
    ),
  ],
  // 2. switch (roleKey) (statement or expression) · .contains(role.key)
  ["DART-2", re([`\\bswitch\\s*\\(\\s*${DART_OP}\\s*\\)`, `\\.contains\\(\\s*${DART_OP}\\s*\\)`])],
  // 3. system-role literal: compared · `case 'owner'` · `'owner' =>` arm · `{'owner': …}` key
  [
    "DART-3",
    re(
      [
        `${DART_EQ}\\s*${DART_LIT}`,
        `${DART_LIT}\\s*${DART_EQ}`,
        `\\bcase\\s+${DART_LIT}`,
        `${DART_LIT}\\s*=>`,
        `${DART_LIT}\\s*:`,
      ],
      "i",
    ),
  ],
  // 4. indirection (as TS-7) · named constant · bare switch (key)
  [
    "DART-4",
    re([...indirection(DART_OP, "(?:final|var|const|String\\??)"), ...namedConstant(DART_EQ)], "i"),
  ],
];

type Lang = "ts" | "dart";

function languageOf(file: string): Lang | null {
  const path = file.replace(/\.fixture$/, "");
  if (/\.(ts|tsx)$/.test(path)) return "ts";
  if (/\.dart$/.test(path)) return "dart";
  return null;
}

/** A `/` right after one of these starts a TS regex literal, not a division. */
const REGEX_PRECEDER = /[(,=:[!&|?{};+\-*%<>~^]/;

/**
 * Blank out comments (TS and Dart share `//`, `///`, block comments) while
 * keeping every newline, so line numbers survive. String literals — and, in
 * TS, regex literals like `/a\/*b/` — are tracked so neither a glob
 * `"src/**\/*.ts"` nor a regex can open a fake block comment and hide real
 * code. Single-line strings/regexes reset at newline so a desync cannot spread.
 */
export function stripComments(source: string, lang: Lang): string {
  let out = "";
  let i = 0;
  let quote: string | null = null; // ' " ` ''' """ or "/" (regex literal)
  let inClass = false; // inside [...] of a regex literal
  let prev = ""; // last non-space char outside literals
  while (i < source.length) {
    const ch = source[i]!;
    if (quote) {
      if (ch === "\\") {
        out += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (quote === "/") {
        if (ch === "[") inClass = true;
        else if (ch === "]") inClass = false;
        else if ((ch === "/" && !inClass) || ch === "\n") quote = null;
        out += ch;
        i += 1;
        if (!quote) prev = "x";
        continue;
      }
      if (source.startsWith(quote, i)) {
        out += quote;
        i += quote.length;
        quote = null;
        prev = "x";
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
    if (lang === "ts" && ch === "/" && (prev === "" || REGEX_PRECEDER.test(prev))) {
      quote = "/";
      inClass = false;
      out += ch;
      i += 1;
      continue;
    }
    if (lang === "dart" && (source.startsWith("'''", i) || source.startsWith('"""', i))) {
      quote = source.slice(i, i + 3);
      out += quote;
      i += 3;
      continue;
    }
    if (ch === "'" || ch === '"' || (lang === "ts" && ch === "`")) quote = ch;
    if (!/\s/.test(ch)) prev = ch;
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
      for (const [rule, rx] of rules) {
        if (rx.test(line)) hits.push({ file, line: i + 1, rule, text: raw[i]!.trim() });
      }
    });
  return hits;
}

/** Hits not covered by a pinned line of their own file's entry. */
export function codeOffenders(
  hits: readonly CodeHit[],
  allowlist: readonly PresentationAllowance[],
): CodeHit[] {
  return hits.filter((h) => !allowlist.some((a) => a.file === h.file && a.lines.includes(h.text)));
}

/** Pinned lines that no longer produce a hit — re-pin or drop the entry. */
export function stalePins(
  hits: readonly CodeHit[],
  allowlist: readonly PresentationAllowance[],
): string[] {
  return allowlist.flatMap((a) =>
    a.lines
      .filter((line) => !hits.some((h) => h.file === a.file && h.text === line))
      .map((line) => `${a.file}: pinned line no longer hits — "${line}"`),
  );
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
  /** function name, optionally schema-qualified (default schema `public`) */
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
  /** `schema.name`, lower-case, unquoted */
  readonly fn: string;
  /** argument types (last token of each arg, lower-case) */
  readonly args: readonly string[];
  readonly line: number;
  readonly offset: number;
  readonly readsRoleKey: boolean;
}

export interface SqlFunctionDrop {
  readonly migration: string;
  readonly fn: string;
  /** null = `DROP FUNCTION f` without a signature (matches any overload) */
  readonly args: readonly string[] | null;
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

/** Replace the contents of every '…' literal with spaces (length kept). */
function blankSqlStrings(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'/g, (m) => `'${" ".repeat(m.length - 2)}'`);
}

const blank = (s: string) => s.replace(/[^\n]/g, " ");

/** `"Public"."Fn"` → `public.fn` · unqualified → `public.<name>` */
export const normalizeFn = (name: string): string => {
  const parts = name
    .replace(/"/g, "")
    .split(".")
    .map((p) => p.trim().toLowerCase());
  return parts.length === 1 ? `public.${parts[0]}` : `${parts[parts.length - 2]}.${parts.pop()}`;
};

/** `(p_id text, OUT x int, n character varying DEFAULT 'a')` → `["text","int","varying"]` */
function normalizeArgs(list: string): string[] {
  const trimmed = list.trim();
  if (!trimmed) return [];
  const args: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of trimmed) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      args.push(cur);
      cur = "";
    } else cur += ch;
  }
  args.push(cur);
  return args.map((a) => {
    const noDefault = a.split(/\s+DEFAULT\s+|\s*=\s*/i)[0]!.replace(/\([^)]*\)/g, "");
    const tokens = noDefault
      .replace(/"/g, "")
      .trim()
      .split(/\s+/)
      .filter((t) => !/^(IN|OUT|INOUT|VARIADIC)$/i.test(t));
    return (tokens[tokens.length - 1] ?? "").toLowerCase();
  });
}

/** Index just after the `)` matching the `(` at `open`. */
function closeParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    if (text[i] === ")" && --depth === 0) return i + 1;
  }
  return -1;
}

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

const NAME = `(?:"[^"]+"|[\\w$]+)(?:\\s*\\.\\s*(?:"[^"]+"|[\\w$]+))?`;
const CREATE_FN = new RegExp(
  `\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:FUNCTION|PROCEDURE)\\s+(${NAME})\\s*\\(`,
  "gi",
);
const DROP_FN = /\bDROP\s+(?:FUNCTION|PROCEDURE)\s+(?:IF\s+EXISTS\s+)?([^;]+);/gi;
const DROP_ITEM = new RegExp(`^\\s*(${NAME})\\s*(\\(([\\s\\S]*)\\))?\\s*$`);

/**
 * Only `CREATE … FUNCTION … $tag$ body $tag$` bodies count — not UPDATE, not DO.
 * Drops are read from a copy where function bodies and '…' literals are
 * blanked, so `RAISE NOTICE 'DROP FUNCTION f();'` or a drop written inside
 * another function's body does not retire anything.
 */
export function parseMigration(
  migration: string,
  sql: string,
): { creates: SqlFunctionCreate[]; drops: SqlFunctionDrop[] } {
  const text = stripSqlComments(sql);
  let dropText = text;
  const creates: SqlFunctionCreate[] = [];
  for (const m of text.matchAll(CREATE_FN)) {
    const argsOpen = m.index! + m[0].length - 1;
    const argsClose = closeParen(text, argsOpen);
    if (argsClose === -1) throw new Error(`G-12: ${migration}: unbalanced args for ${m[1]}`);
    const open = /\$([A-Za-z_]\w*)?\$/.exec(text.slice(argsClose));
    if (!open)
      throw new Error(
        `G-12: ${migration}: CREATE FUNCTION ${m[1]} has no $-quoted body — extend the parser`,
      );
    const bodyStart = argsClose + open.index + open[0].length;
    const bodyEnd = text.indexOf(open[0], bodyStart);
    if (bodyEnd === -1)
      throw new Error(`G-12: ${migration}: unterminated ${open[0]} body for ${m[1]}`);
    dropText =
      dropText.slice(0, bodyStart) +
      blank(text.slice(bodyStart, bodyEnd)) +
      dropText.slice(bodyEnd);
    creates.push({
      migration,
      fn: normalizeFn(m[1]!),
      args: normalizeArgs(text.slice(argsOpen + 1, argsClose - 1)),
      line: text.slice(0, m.index).split("\n").length,
      offset: m.index!,
      readsRoleKey: SQL_KEY_READ.test(text.slice(bodyStart, bodyEnd)),
    });
  }
  const drops: SqlFunctionDrop[] = [];
  for (const m of blankSqlStrings(dropText).matchAll(DROP_FN)) {
    const list = m[1]!.replace(/\b(CASCADE|RESTRICT)\s*$/i, "");
    const items: string[] = [];
    let depth = 0;
    let cur = "";
    for (const ch of list) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (ch === "," && depth === 0) {
        items.push(cur);
        cur = "";
      } else cur += ch;
    }
    items.push(cur);
    for (const item of items) {
      const parsed = DROP_ITEM.exec(item);
      if (!parsed)
        throw new Error(`G-12: ${migration}: cannot read DROP FUNCTION item "${item.trim()}"`);
      drops.push({
        migration,
        fn: normalizeFn(parsed[1]!),
        args: parsed[2] === undefined ? null : normalizeArgs(parsed[3]!),
        offset: m.index!,
      });
    }
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

const sameArgs = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Every reason the migrations break G-12, as messages. Empty = green.
 * `now` is the clock seam: the entry expires the UTC day AFTER `removeBy`.
 * A drop retires a create only if it comes LATER, names the same schema.name,
 * and either has no signature or the same argument types.
 */
export function sqlOffenders(
  migrations: readonly Migration[],
  allowlist: readonly SqlAllowance[],
  now: Date,
): string[] {
  const today = now.toISOString().slice(0, 10);
  const ordered = [...migrations].sort((a, b) => a.name.localeCompare(b.name));
  type Event = { seq: number } & (
    { kind: "create"; c: SqlFunctionCreate } | { kind: "drop"; d: SqlFunctionDrop }
  );
  const events: Event[] = [];
  ordered.forEach((m, mi) => {
    const { creates, drops } = parseMigration(m.name, m.sql);
    for (const c of creates) events.push({ seq: mi * 1e9 + c.offset, kind: "create", c });
    for (const d of drops) events.push({ seq: mi * 1e9 + d.offset, kind: "drop", d });
  });
  events.sort((a, b) => a.seq - b.seq);

  const problems: string[] = allowlist.flatMap(validateEntry);
  const covers = (e: SqlAllowance, c: SqlFunctionCreate) =>
    e.migration === c.migration && normalizeFn(e.fn) === c.fn;
  const keyed = events.flatMap((x) => (x.kind === "create" && x.c.readsRoleKey ? [x.c] : []));

  for (const c of keyed) {
    if (!allowlist.some((e) => covers(e, c))) {
      problems.push(
        `${c.migration}/migration.sql:${c.line} function ${c.fn} reads Role.key ('owner'|'admin'|'staff') ` +
          "and is not allowlisted — decide by capabilities, or add an entry with owner + removeBy",
      );
    }
  }
  for (const entry of allowlist) {
    const created = keyed.filter((c) => covers(entry, c));
    if (created.length === 0) {
      problems.push(
        `allowlist ${entry.migration}/${entry.fn} is stale: that migration creates no such key-reading function`,
      );
      continue;
    }
    if (!validDay(entry.removeBy) || today <= entry.removeBy) continue;
    for (const c of created) {
      const same = events.filter((x) =>
        x.kind === "create"
          ? x.c.fn === c.fn && sameArgs(x.c.args, c.args)
          : x.d.fn === c.fn && (x.d.args === null || sameArgs(x.d.args, c.args)),
      );
      const last = same[same.length - 1]!;
      if (last.kind === "create" && last.c.readsRoleKey) {
        problems.push(
          `function ${c.fn}(${c.args.join(", ")}) (owner ${entry.owner}) is past removeBy ${entry.removeBy} ` +
            `(today ${today} UTC) and no later migration drops it — ship the drop migration (data-model §4.2)`,
        );
      }
    }
  }
  return problems;
}
