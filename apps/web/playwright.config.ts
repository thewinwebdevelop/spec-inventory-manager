import { defineConfig, devices } from "@playwright/test";

/**
 * F-002 · T-002-Q5 — the browser lane test-plan §12.1 has been specified
 * against since Gate 2 and which did not exist.
 *
 * WHAT THIS LANE IS FOR, and what it is not. The component suite (vitest +
 * jsdom, 300 cases) already proves what a screen renders and what it sends.
 * A browser adds exactly three things no amount of jsdom can: a real URL bar
 * and history, real storage across a real reload, and a REAL SERVER on the
 * other end of every request. Cases that do not need one of those three belong
 * in the component suite, where they run in milliseconds — §12.1's rows earn
 * their place here because they cross the whole stack.
 *
 * ⚠️ NO `webServer` BLOCK ON PURPOSE. Playwright can boot a server for you, and
 * that is the wrong shape here: this suite needs Postgres, Redis, the API and
 * the web server, in that order, with migrations and a seeded plan in between —
 * `POST /organizations` answers 503 without a `PlanDefinition` row (§6.2). CI
 * owns that sequence (`e2e-web`), so the config's job is only to talk to what
 * is already up, and a run against nothing fails loudly rather than starting
 * half a stack behind your back.
 */
export default defineConfig({
  testDir: "./e2e",
  // One worker: every spec signs somebody up and creates a shop, and the org
  // cap is per user, not per run. Parallel workers would also interleave rows
  // in one database for no gain — this lane is about correctness across the
  // stack, not throughput.
  workers: 1,
  fullyParallel: false,
  // A retry hides exactly the flake this lane exists to find (a race between
  // the client's cache and the server's state). If a case is genuinely flaky,
  // that is a defect to file, not a number to raise (test-plan §16).
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never" }],
        // Machine-readable, for the lane's own "did anything actually run"
        // check. The HTML report is for humans: its cases live in a packed
        // payload, not as greppable text, which the first version of that
        // check learned by failing a green suite.
        ["json", { outputFile: "playwright-results.json" }],
      ]
    : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    // Kept only for the failures: a passing run of this size would otherwise
    // write hundreds of megabytes of video nobody opens.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
  },
  projects: [
    // Creates the shared Owner + shop once (see auth.setup.ts for why the
    // lane's real budget is pre-auth requests per five minutes, not time).
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
