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
 *
 * ⚠️ AND WHY THERE IS A FLOOR. The first version only asked for "at least one"
 * — which meant that after the lane grew to 26 cases, deleting five spec files
 * would still have been green. "At least one" is the right question for a
 * suite that might legitimately be empty; it is the wrong question for a lane
 * whose whole job is covering §12.1's fourteen rows. The floor is passed in by
 * the workflow so that adding cases and raising it is one visible edit, the
 * same discipline the vitest lanes already use with `--require file=N`.
 */
import { readFileSync } from "node:fs";

const [, , reportPath, minExpectedArg] = process.argv;
if (!reportPath) {
  console.error("usage: assert-playwright-ran.mjs <playwright-results.json> [min-expected]");
  process.exit(2);
}

const minExpected = Number(minExpectedArg ?? 1);
if (!Number.isInteger(minExpected) || minExpected < 1) {
  console.error(`::error::min-expected must be a positive integer, got "${minExpectedArg}"`);
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

if (expected < minExpected) {
  console.error(
    `::error::the browser lane passed ${expected} case(s) but the floor is ${minExpected}. ` +
      "Cases do not disappear by accident: a spec file was deleted, renamed out of the " +
      "`testDir`, or skipped. If the removal is intended, lower the floor in the workflow " +
      "in the same commit — that edit is the review.",
  );
  process.exit(1);
}

// Not a second opinion on pass/fail — the runner's own exit code owns that.
// This only refuses the shape where a run "succeeds" having proven nothing.
console.log(`the browser lane ran ${expected} passing case(s) (floor ${minExpected}).`);
