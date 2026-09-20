import { expect, test } from "@playwright/test";

/**
 * N-2 (qa, 2026-09-20) — the `Referrer-Policy` on `/invite`, proven by a server
 * that actually serves it.
 *
 * The unit test reads `next.config.mjs` itself, which is the right thing for
 * the CONFIG, and its own header says why it is not enough: vitest never boots
 * Next, so it cannot see whether Next serves what `headers()` returns. Until
 * now the only proof that it does was a one-off `curl` pasted into a report —
 * and "config that was never served" is a failure mode this project has
 * already met (B-17: a `--dart-define` that only the test files read).
 *
 * This lane boots a real production Next server every run, so the proof costs
 * one request and no login budget: `/invite` is public by design (api-spec
 * §3.14), which is the whole reason the header matters there.
 *
 * Why the header at all: the token is stripped from the URL before first
 * paint (E-12), but the FIRST document load still carries
 * `/invite?token=…` in `location.href` — so anything requested during that
 * paint could put a bearer credential for shop membership into a `Referer`.
 */
test("N-2 ★ · the server really sends Referrer-Policy: no-referrer on /invite", async ({ page }) => {
  const response = await page.goto("/invite?token=probe-not-a-real-token");

  expect(response, "no response for /invite").not.toBeNull();
  expect(response!.headers()["referrer-policy"]).toBe("no-referrer");
});

test("N-2 · and the scope is real — /login does not carry it", async ({ page }) => {
  // The control. Without it, a blanket header (or a wildcard `source`) would
  // pass the test above while being a different decision from the one
  // `next.config.mjs` documents — devops scoped this to the one route whose
  // URL carries a credential, and that scoping is the part worth pinning.
  const response = await page.goto("/login");

  expect(response).not.toBeNull();
  expect(response!.headers()["referrer-policy"]).toBeUndefined();
});
