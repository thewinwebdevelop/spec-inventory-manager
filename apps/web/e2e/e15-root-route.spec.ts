/**
 * ★ B-14 — what `/` does, walked by a browser.
 *
 * `/` sat on T-000-09's placeholder for months because NO TEST EVER OPENED IT.
 * B-6 was the identical defect one route over (the post-login redirect also
 * still pointed at an F-000 placeholder) and was caught the day E-01 walked
 * login→shop as one journey. This file is that journey for the domain root, so
 * the next person to leave a placeholder there hears about it.
 *
 * Destination decided by the user, 2026-09-01: mirror login and go to the
 * picker. `web.md` had said `/o/[defaultOrg]`, and no such field exists.
 */
import { expect, test } from "@playwright/test";
import { login, readShared, resetIpThrottle } from "./helpers";

test.beforeEach(async () => {
  await resetIpThrottle();
});

test("E-15 · `/` sends a signed-OUT visitor to login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
});

test("E-15b · `/` sends a signed-IN visitor to the shop picker", async ({ page }) => {
  const { email } = readShared();
  await login(page, email);

  await page.goto("/");

  await expect(page).toHaveURL(/\/select-org/);
  await expect(page.getByRole("heading", { name: "เลือกร้านที่จะเข้าใช้งาน" })).toBeVisible();
  // ⛔ The placeholder must be gone, not merely covered: this exact string is
  // what `/` served before B-14, and asserting the URL alone would still pass
  // if a redirect were bolted on top of a page that still renders it.
  await expect(page.getByText("apps/web placeholder shell")).toHaveCount(0);
});
