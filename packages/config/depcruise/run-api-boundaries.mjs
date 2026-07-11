#!/usr/bin/env node
// apps/api boundary gate (backend.md §5.2 item 3). Its own CLI step with its own
// non-zero exit — a CI-blocking architectural boundary, NOT an ESLint rule.
// Same self-proving shape as the core-domain purity gate:
//   1. clean check    — real apps/api src (minus the fixture dir) has ZERO
//                       boundary violations.
//   2. negative fixture — __boundary_fixtures__/db-leak.ts MUST be flagged; if
//                       the gate stops catching it, the gate itself is broken.
// Invoked from repo root so paths match the config's `^apps/api/src` anchors.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
process.chdir(REPO_ROOT);

// Resolve the depcruise bin from whichever package hoisted it.
const DEPCRUISE_BIN =
  [
    "apps/api/node_modules/.bin/depcruise",
    "packages/config/node_modules/.bin/depcruise",
    "packages/core-domain/node_modules/.bin/depcruise",
    "node_modules/.bin/depcruise",
  ].find((p) => existsSync(join(REPO_ROOT, p))) ?? "depcruise";

const CONFIG = "packages/config/depcruise/.dependency-cruiser.api.cjs";
const SRC = "apps/api/src";
const FIXTURE = "apps/api/src/__boundary_fixtures__/db-leak.ts";
const FIXTURE_DIR_EXCLUDE = "^apps/api/src/__boundary_fixtures__/";
const RULE_NAMES = new Set([
  "api-leafward-only",
  "api-connectors-scoped",
  "api-db-client-allowlisted",
]);

function fail(msg) {
  console.error(`\n[api-boundaries] FAIL: ${msg}\n`);
  process.exit(1);
}
function ok(msg) {
  console.log(`[api-boundaries] OK: ${msg}`);
}

function runDepcruise(target, extraArgs = []) {
  const res = spawnSync(
    DEPCRUISE_BIN,
    ["--config", CONFIG, "--output-type", "json", ...extraArgs, target],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (res.error) fail(`could not run dependency-cruiser: ${res.error.message}`);
  let parsed;
  try {
    parsed = JSON.parse(res.stdout || "{}");
  } catch {
    fail(`dependency-cruiser did not emit JSON for ${target}.\nstderr:\n${res.stderr}`);
  }
  const violations = (parsed.summary?.violations ?? []).filter((v) =>
    RULE_NAMES.has(v.rule?.name),
  );
  return violations;
}

// ---- Check 1: real apps/api src is clean ------------------------------------
{
  const violations = runDepcruise(SRC, ["--exclude", FIXTURE_DIR_EXCLUDE]);
  if (violations.length > 0) {
    fail(
      `apps/api has ${violations.length} boundary violation(s):\n` +
        violations.map((v) => `  [${v.rule.name}] ${v.from} -> ${v.to}`).join("\n"),
    );
  }
  ok("real apps/api src has 0 boundary violations");
}

// ---- Check 2: negative fixture MUST be caught -------------------------------
{
  const violations = runDepcruise(FIXTURE);
  if (violations.length === 0) {
    fail(
      `negative fixture ${FIXTURE} was NOT flagged. The boundary gate is broken ` +
        `— a raw Prisma-client import outside the allowlist could slip through.`,
    );
  }
  ok(
    `negative fixture is caught by \`${violations[0].rule.name}\` ` +
      `(${violations.length} violation) — this gate exits non-zero on it, CI goes red`,
  );
}

console.log("\n[api-boundaries] PASS — boundaries clean on real code, fires on fixture.\n");
process.exit(0);
