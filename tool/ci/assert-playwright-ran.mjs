#!/usr/bin/env node
/**
 * F-002 · T-002-Q5 — "the browser lane actually ran cases", for `e2e-web`.
 *
 * Sibling of `assert-tests-ran.mjs`, which does the same job for the vitest
 * lanes: a suite that silently matches no files is the failure mode I-37
 * exists to catch, and it looks identical to success from the outside.
 *
 * ⚠️ WHY IT READS JSON. The first version of this check grepped Playwright's
 * HTML report for case ids and failed a run in which all six tests passed —
 * the HTML report keeps its data in a packed payload, so the count was always
 * zero. A guard that reddens a green suite is worse than no guard: the next
 * person deletes it, and the real gap it was watching reopens silently.
 */
import { readFileSync } from "node:fs";

const [, , reportPath] = process.argv;
if (!reportPath) {
  console.error("usage: assert-playwright-ran.mjs <playwright-results.json>");
  process.exit(2);
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} catch (error) {
  console.error(`::error::could not read ${reportPath}: ${error.message}`);
  process.exit(1);
}

const stats = report.stats ?? {};
const expected = stats.expected ?? 0;
const unexpected = stats.unexpected ?? 0;
const flaky = stats.flaky ?? 0;
const skipped = stats.skipped ?? 0;

console.log(
  `playwright: expected=${expected} unexpected=${unexpected} flaky=${flaky} skipped=${skipped}`,
);

if (expected < 1) {
  console.error(
    "::error::the Playwright run contains no passing cases. A `testDir` typo, a filter " +
      "that matched nothing, or a suite that failed to load all look exactly like this — " +
      "and all three leave the lane green if nobody counts.",
  );
  process.exit(1);
}

// Not a second opinion on pass/fail — the runner's own exit code owns that.
// This only refuses the shape where a run "succeeds" having proven nothing.
console.log(`the browser lane ran ${expected} passing case(s).`);
