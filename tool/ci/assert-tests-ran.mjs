#!/usr/bin/env node
// F-002 · T-002-D1b — LANE-ENABLED GUARD (test-plan I-37).
//
// WHY: DB-backed suites gate themselves on `TEST_DATABASE_URL` /
// `TEST_REDIS_URL` and turn into `describe.skip` when those are missing. A
// skipped suite still exits 0, so a lane that lost its database (or its env
// block, or its filename convention) goes GREEN while proving nothing. That is
// exactly the F-001 lesson "green locally != tested", and qa wrote it up as the
// #1 risk to the verdict (test-plan §1 item 11, §19.1 item 4, I-37).
//
// WHAT: reads a vitest JSON report and fails the job unless the tests that the
// lane exists to run ACTUALLY RAN AND PASSED. It is deliberately not a test —
// it is a gate on the test run itself.
//
// USAGE
//   vitest run --reporter=default --reporter=json --outputFile.json=<report>
//   node tool/ci/assert-tests-ran.mjs \
//     --report <report> \
//     --lane   "<human name shown in the failure>" \
//     --require "src/tenancy.db.test.ts=15" [--require ...] \
//     [--min-passed 100] [--max-skipped 0]
//
// CHECKS (all must hold)
//   1. the report exists and parses            → catches "vitest died before writing"
//   2. report.success === true                 → belt-and-braces over vitest's exit code
//   3. skipped + todo <= --max-skipped (def 0) → catches `describe.skip` / `it.skip`
//   4. every --require file is present in the report and contributed >= N PASSED
//      cases                                   → catches renamed/unmatched test files
//      and "someone deleted cases to make it green"
//   5. total passed >= --min-passed (optional) → catches a filter that matches nothing
//
// Raising a --require count is fine (more proof). LOWERING one is a visible,
// reviewable diff in this repo — which is the point (test-plan §1 "no test is
// skipped/removed/weakened without a written reason + reviewer sign-off").

import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";

/** @returns {{report?:string, lane:string, require:Array<{file:string,min:number}>, minPassed:number, maxSkipped:number}} */
function parseArgs(argv) {
  const out = { lane: "unnamed lane", require: [], minPassed: 0, maxSkipped: 0 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) die(`missing value for ${arg}`);
      return v;
    };
    if (arg === "--report") out.report = next();
    else if (arg === "--lane") out.lane = next();
    else if (arg === "--min-passed") out.minPassed = Number(next());
    else if (arg === "--max-skipped") out.maxSkipped = Number(next());
    else if (arg === "--require") {
      const spec = next();
      const at = spec.lastIndexOf("=");
      if (at < 1) die(`--require expects "<path-fragment>=<min cases>", got "${spec}"`);
      const min = Number(spec.slice(at + 1));
      if (!Number.isInteger(min) || min < 1)
        die(`--require min must be a positive integer, got "${spec}"`);
      out.require.push({ file: spec.slice(0, at), min });
    } else die(`unknown argument "${arg}"`);
  }
  if (!out.report) die("--report <vitest-json-report> is required");
  return out;
}

function die(msg) {
  // `::error::` renders as an annotation on GitHub Actions and as plain text elsewhere.
  console.error(`::error::[lane-enabled guard] ${msg}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const fail = (msg) => die(`${args.lane}: ${msg}`);

let report;
try {
  report = JSON.parse(readFileSync(args.report, "utf8"));
} catch (err) {
  fail(
    `could not read the vitest JSON report at "${args.report}" (${err.message}). ` +
      `The test step must run with --reporter=json --outputFile.json=<path>; if vitest crashed before ` +
      `writing it, that crash — not this guard — is the real failure.`,
  );
}

const files = (report.testResults ?? []).map((suite) => {
  const counts = { passed: 0, failed: 0, skipped: 0, todo: 0, other: 0 };
  for (const a of suite.assertionResults ?? []) {
    if (a.status in counts) counts[a.status]++;
    else if (a.status === "pending") counts.skipped++;
    else counts.other++;
  }
  return { name: suite.name, short: relative(process.cwd(), suite.name) || suite.name, counts };
});

const total = {
  tests: report.numTotalTests ?? 0,
  passed: report.numPassedTests ?? 0,
  failed: report.numFailedTests ?? 0,
  skipped: (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0),
};

console.log(`[lane-enabled guard] ${args.lane}`);
for (const f of files) {
  const c = f.counts;
  console.log(
    `  ${c.skipped > 0 || c.failed > 0 ? "x" : "-"} ${f.short}: ${c.passed} passed, ${c.failed} failed, ${c.skipped} skipped`,
  );
}
console.log(
  `  total: ${total.passed} passed / ${total.failed} failed / ${total.skipped} skipped (of ${total.tests})`,
);

const problems = [];

if (report.success !== true || total.failed > 0) {
  problems.push(
    `the suite itself did not pass (${total.failed} failed) — fix the tests, not this guard`,
  );
}

if (files.length === 0) {
  problems.push(
    `vitest reported ZERO test files. The filename filter matched nothing, or the run never started.`,
  );
}

if (total.skipped > args.maxSkipped) {
  const culprits = files
    .filter((f) => f.counts.skipped > 0)
    .map((f) => `${f.short} (${f.counts.skipped})`)
    .join(", ");
  problems.push(
    `${total.skipped} test case(s) were SKIPPED (allowed: ${args.maxSkipped}) in: ${culprits}. ` +
      `DB-backed suites self-skip when TEST_DATABASE_URL / TEST_REDIS_URL are unset — check this job's ` +
      `env: block and its service containers. A skipped proof is not a proof (I-37).`,
  );
}

for (const req of args.require) {
  const needle = req.file.split("/").join(sep);
  const matches = files.filter((f) => f.name.endsWith(needle) || f.name.includes(needle));
  if (matches.length === 0) {
    problems.push(
      `required test file "${req.file}" did not run at all. It was renamed/moved/deleted, or the vitest ` +
        `filename filter in this job no longer matches it.`,
    );
    continue;
  }
  const passed = matches.reduce((n, m) => n + m.counts.passed, 0);
  if (passed < req.min) {
    problems.push(
      `"${req.file}" contributed only ${passed} PASSED case(s); this lane requires >= ${req.min}. ` +
        `Either the suite was skipped, or cases were removed/disabled.`,
    );
  }
}

if (total.passed < args.minPassed) {
  problems.push(`only ${total.passed} case(s) passed; this lane requires >= ${args.minPassed}.`);
}

if (problems.length > 0) {
  for (const p of problems) console.error(`::error::[lane-enabled guard] ${args.lane}: ${p}`);
  process.exit(1);
}

console.log(`[lane-enabled guard] OK — the required suites really ran.`);
