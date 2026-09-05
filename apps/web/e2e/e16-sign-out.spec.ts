/**
 * ★ B-16 — signing out, walked by a browser.
 *
 * The control did not exist until the §12.2 manual pass went looking for it:
 * `orgTh.shell.nav.logout` sat in the dictionary with no consumer, and the
 * only way to end a session was "ออกจากระบบทุกอุปกรณ์", which ends every
 * session on every device the person owns.
 *
 * The component test next to `AppShell` proves the right function is called.
 * It cannot prove the SESSION ended — that lives in an httpOnly cookie this
 * process never sees, and the only honest way to ask is to reload the app and
 * see where it lands. B-14 is the neighbouring lesson: `/` now decides from
 * the bootstrapped session, so it answers this question exactly.
 */
import { expect, test } from "@playwright/test";
import { createShop, freshEmail, resetIpThrottle, signUpAndLogin } from "./helpers";

test.beforeEach(async () => {
  await resetIpThrottle();
});

test("E-16 · signing out ends the session — a reload does not walk back in", async ({ page }) => {
  await signUpAndLogin(page, freshEmail("e16"));
  await createShop(page, `ร้านออกจากระบบ ${Date.now()}`);

  await page.getByRole("button", { name: "ออกจากระบบ" }).first().click();
  await expect(page).toHaveURL(/\/login/);

  // ⛔ The half that matters. Clearing the in-memory access token would get
  // this far on its own; the refresh cookie is what decides whether the app
  // quietly signs the person back in on the next load.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
});
