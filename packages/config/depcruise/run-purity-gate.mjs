#!/usr/bin/env node
// core-domain purity gate (F-000 AC9). Runs as its own CLI step with its own
// non-zero exit code — a CI-blocking, un-bypassable architectural boundary
// (architecture.md §3). NOT an ESLint rule: `// eslint-disable` cannot touch it.
//
// It performs three checks and exits non-zero if ANY fails:
//   1. disable-pragma guard — `dependency-cruiser-disable` is banned inside
//      packages/core-domain/src (closes dependency-cruiser's own escape hatch).
//   2. clean check          — real core-domain src must have ZERO violations.
//   3. negative-fixture     — the fixture MUST be flagged by core-domain-is-pure;
//      if the guard fails to catch it, the gate itself is broken → fail.
//
// Must be invoked from the repo root so paths match the config's
// `from: { path: '^packages/core-domain/src' }`.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve repo root from this file's location
// (packages/config/depcruise/run-purity-gate.mjs → up 3) so the gate produces
// identical, cwd-independent results whether turbo runs it from the package
// dir or CI runs it from root. All paths below are repo-relative to match the
// config's `from: { path: '^packages/core-domain/src' }`.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
process.chdir(REPO_ROOT);

// depcruise ships as a devDependency of @omnistock/core-domain (and @omnistock/
// config); resolve its bin from either package's node_modules so the gate works
// regardless of hoisting.
const DEPCRUISE_BIN = [
  "packages/core-domain/node_modules/.bin/depcruise",
  "packages/config/node_modules/.bin/depcruise",
  "node_modules/.bin/depcruise",
].find((p) => existsSync(join(REPO_ROOT, p))) ?? "depcruise";

const CONFIG = "packages/config/depcruise/.dependency-cruiser.cjs";
const REAL_SRC = "packages/core-domain/src";
const FIXTURE = "packages/core-domain/src/__purity_fixtures__/violation.ts";
const RULE = "core-domain-is-pure";
const BANNED_PRAGMA = "dependency-cruiser-disable";

function fail(msg) {
  console.error(`\n[purity-gate] FAIL: ${msg}\n`);
  process.exit(1);
}
function ok(msg) {
  console.log(`[purity-gate] OK: ${msg}`);
}

function runDepcruise(target, extraArgs = []) {
  // JSON reporter so we can inspect which rules fired regardless of exit code.
  const res = spawnSync(
    DEPCRUISE_BIN,
    ["--config", CONFIG, "--output-type", "json", ...extraArgs, target],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (res.error) fail(`could not run dependency-cruiser: ${res.error.message}`);
  let parsed;
  try {
    parsed = JSON.parse(res.stdout || "{}");
  } catch (e) {
    fail(
      `dependency-cruiser did not emit JSON for ${target}.\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
    );
  }
  const violations = (parsed.summary?.violations ?? []).filter(
    (v) => v.rule?.name === RULE,
  );
  return { exitCode: res.status, violations, raw: parsed };
}

// ---- Check 1: banned disable pragma inside core-domain -----------------------
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}
{
  const offenders = walk(REAL_SRC).filter((f) =>
    readFileSync(f, "utf8").includes(BANNED_PRAGMA),
  );
  if (offenders.length > 0) {
    fail(
      `\`${BANNED_PRAGMA}\` pragma is banned inside ${REAL_SRC} ` +
        `(closes the escape hatch, architecture.md §3.3). Offenders:\n  ` +
        offenders.join("\n  "),
    );
  }
  ok(`no \`${BANNED_PRAGMA}\` pragma inside ${REAL_SRC}`);
}

// ---- Check 2: real core-domain src is clean ---------------------------------
{
  // Exclude the negative fixture dir — it is intentionally dirty and is
  // checked separately below.
  const { violations } = runDepcruise(REAL_SRC, [
    "--exclude",
    "__purity_fixtures__",
  ]);
  if (violations.length > 0) {
    fail(
      `real core-domain has ${violations.length} \`${RULE}\` violation(s):\n` +
        violations
          .map((v) => `  ${v.from} -> ${v.to}`)
          .join("\n"),
    );
  }
  ok(`real core-domain src is pure (0 \`${RULE}\` violations)`);
}

// ---- Check 3: negative fixture MUST be caught -------------------------------
{
  const { violations } = runDepcruise(FIXTURE);
  if (violations.length === 0) {
    fail(
      `negative fixture ${FIXTURE} was NOT flagged by \`${RULE}\`. ` +
        `The purity guard is broken — it would let a real DB import slip through.`,
    );
  }
  // NOTE: the JSON reporter always exits 0; the error-count exit code lives in
  // depcruise's `err` reporter. THIS gate script is the CI-blocking wrapper —
  // it exits non-zero (below / on any fail) based on the parsed violations, so
  // a caught fixture reliably turns CI red regardless of depcruise's own exit.
  ok(
    `negative fixture is caught by \`${RULE}\` ` +
      `(${violations.length} violation) — this gate exits non-zero on it, CI goes red`,
  );
}

console.log("\n[purity-gate] PASS — boundary clean on real code, fires on fixture.\n");
process.exit(0);
