// ★ A path in backticks is a promise that a file is there.
//
// Docs and comments in this repo navigate by path constantly, and the paths rot
// silently: nothing compiles a sentence. Three refactors moved files out from
// under their own documentation —
//
//   · D-023 moved `lib/auth/**` to `lib/features/auth/**` and `lib/theme` to
//     `lib/core/theme`, leaving F-001's log pointing at gone files;
//   · the M-07 review moved the capability rule to `core/session/capabilities.
//     dart`, which is what made the capability tripwire's allow-list stale;
//   · B-10 moved the Prisma client out of `src/generated/`, and F-000's
//     architecture doc still described the old output path.
//
// The one that actually cost something was in CODE, not docs: `MainActivity.kt`
// and `AppDelegate.swift` each named the Dart file behind their MethodChannel,
// and both named a path that had moved. Nothing links the two ends of a channel
// but its name and that comment — no compiler checks the pair — so the comment
// is the whole map, and it pointed at nothing.
//
// SCOPE, deliberately narrow: only prefixes that CANNOT also be
// workspace-relative — `apps/`, `packages/`, `docs/`, `.github/`. Prose writes
// workspace-relative paths all the time — `test/orgs.e2e.int.test.ts` means
// `apps/api/test/…` to a reader and is ambiguous to a scanner — and a lint that
// guessed at those would cry wolf and be deleted.
//
// `tool/` and `infra/` are excluded for exactly that reason, and I learned it
// from this guard's first run: it flagged `tool/check_boundaries.dart`, cited
// by mobile's CLAUDE.md and its own test. There IS a `tool/` at the repo root,
// so the path reads as qualified — but the file meant is
// `apps/mobile/tool/check_boundaries.dart`, and the citation is correct in the
// workspace it was written in. A prefix that exists at two levels cannot carry
// this rule.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** cwd is `apps/api` under vitest. */
const REPO_ROOT = join(process.cwd(), "..", "..");
const SCAN_ROOTS = ["docs", "apps", "packages", "tool", "infra", ".github"];
/**
 * This file quotes a moved path on purpose, in its own self-check. Scanning it
 * would make the guard fail on its own fixture — the scanner's equivalent of a
 * comment being read as code.
 */
const SELF = "apps/api/test/cited-paths.test.ts";
const SKIP_DIRS = new Set([
  "node_modules",
  "generated",
  "api_client",
  ".next",
  "dist",
  "build",
  ".dart_tool",
  ".fvm",
]);
const SCAN_EXT = /\.(md|ts|tsx|dart|kt|swift|yaml|yml|mjs)$/;

/** A backticked path that names its own workspace. */
const CITED = /`((?:apps|packages|docs|\.github)\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,6})`/g;

/**
 * Paths that are SUPPOSED not to exist yet, with the reason.
 *
 * These are architecture documents describing target state — the repo's own
 * convention (see the "ยังไม่มีของจริง" tables in the workspace CLAUDE.md files),
 * and worth keeping legible rather than silencing. This list is therefore also
 * the inventory of "designed, not built".
 */
const NOT_YET_BUILT: ReadonlyMap<string, string> = new Map([
  ["packages/db/src/ledger-write.ts", "the ledger write primitive — F-011, backend.md §3.1"],
]);

/**
 * Paths that are gone and whose citation is HISTORY, not navigation.
 *
 * A build log describing where a file was in July is not wrong; rewriting it
 * would falsify the record. Kept explicit so the next person can tell an
 * archived reference from a broken one.
 *
 * ⚠️ This list exempts PROSE ONLY. A `.md` may name a moved file — that is what
 * a log is for, and the entry describing the very fix below quotes both old
 * paths in order to say they were wrong. A CODE comment may not: it is
 * navigation, someone follows it, and the whole reason this guard exists is
 * that two native files pointed at a Dart path that had moved. So a dead
 * citation from a `.kt`, `.swift`, `.ts` or `.dart` file fails whatever is on
 * this list.
 *
 * (Found by the guard failing CI on the tasks.md entry I wrote to describe its
 * own first fix — after I had run the suite locally and before I wrote the
 * prose. Green locally, red everywhere else, for the usual reason.)
 */
const PROSE = /\.md$/;

const HISTORICAL: ReadonlySet<string> = new Set([
  "apps/mobile/lib/auth/screenshot_guard.dart",
  "packages/db/tenancy.ts",
  "apps/mobile/lib/auth/auth_client.dart",
  "apps/mobile/lib/auth/auth_flow.dart",
  "apps/mobile/lib/i18n/auth_th.dart",
  "apps/mobile/lib/theme/app_theme.dart",
  "apps/web/src/i18n/auth.ts",
  "apps/api/src/orgs/zz-jail-probe.service.ts",
  "apps/back-office/CLAUDE.md",
  "docs/features/F-021/tasks.md",
  "apps/api/src/common/authz/org-lock-operations.ts",
  ".claude/commands/setup-workflow.md",
  ".claude/skills/ux-mockup/SKILL.md",
]);

export interface DeadCitation {
  readonly path: string;
  readonly citedBy: readonly string[];
}

export function findDeadCitations(
  files: readonly { path: string; source: string }[],
  exists: (p: string) => boolean,
): DeadCitation[] {
  const dead = new Map<string, Set<string>>();
  for (const { path, source } of files) {
    for (const match of source.matchAll(CITED)) {
      const cited = match[1];
      if (cited.includes("{") || cited.includes("*") || cited.includes("F-XXX")) continue;
      if (exists(cited)) continue;
      const set = dead.get(cited) ?? new Set<string>();
      set.add(path);
      dead.set(cited, set);
    }
  }
  return [...dead.entries()]
    .map(([path, citedBy]) => ({ path, citedBy: [...citedBy].sort() }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (SCAN_EXT.test(full)) out.push(full);
  }
  return out;
}

describe("★ a cited path points at a file that is there", () => {
  const files = SCAN_ROOTS.flatMap((root) => walk(join(REPO_ROOT, root)))
    .map((path) => ({
      path: relative(REPO_ROOT, path).split(sep).join("/"),
      source: readFileSync(path, "utf8"),
    }))
    .filter((f) => f.path !== SELF);

  const dead = findDeadCitations(files, (p) => existsSync(join(REPO_ROOT, p)));

  it("the scan reached the docs AND the code", () => {
    expect(files.length).toBeGreaterThan(300);
    expect(files.some((f) => f.path.startsWith("docs/"))).toBe(true);
    expect(files.some((f) => f.path.endsWith(".kt"))).toBe(true);
    expect(files.some((f) => f.path.endsWith(".swift"))).toBe(true);
  });

  it("SELF-CHECK: it catches a moved file and spares a live one and a relative one", () => {
    const found = findDeadCitations(
      [
        {
          path: "MainActivity.kt",
          source: "// backs `apps/mobile/lib/auth/screenshot_guard.dart`'s channel",
        },
        { path: "a.md", source: "see `apps/api/test/cited-paths.test.ts` for the rule" },
        // Workspace-relative prose is out of scope on purpose.
        { path: "b.md", source: "see `test/orgs.e2e.int.test.ts`" },
      ],
      (p) => p === "apps/api/test/cited-paths.test.ts",
    );
    expect(found.map((d) => d.path)).toEqual(["apps/mobile/lib/auth/screenshot_guard.dart"]);
    expect(found[0].citedBy).toEqual(["MainActivity.kt"]);
  });

  it("★ no dead citation outside the two declared lists", () => {
    const unexplained = dead.filter((d) => {
      if (NOT_YET_BUILT.has(d.path)) return false;
      // The history exemption is for prose. Code that names a moved file is
      // the defect itself.
      if (HISTORICAL.has(d.path)) return d.citedBy.some((f) => !PROSE.test(f));
      return true;
    });
    expect(
      unexplained.map((d) => `${d.path}  ← ${d.citedBy.join(", ")}`),
      "a doc or comment names a file that is not there. Fix the path, or declare it in " +
        "NOT_YET_BUILT (designed, not built) or HISTORICAL (a log describing where it was).",
    ).toEqual([]);
  });

  it("both lists are honest — nothing on them exists after all", () => {
    // The mirror failure: a file gets built, or a log is rewritten, and the
    // list keeps claiming a gap that closed.
    const stale = [...NOT_YET_BUILT.keys(), ...HISTORICAL].filter((p) =>
      existsSync(join(REPO_ROOT, p)),
    );
    expect(stale, "these exist now — take them off the list").toEqual([]);
  });
});
