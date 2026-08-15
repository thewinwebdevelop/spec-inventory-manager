import { test as setup } from "@playwright/test";
import { createShop, freshEmail, signUpAndLogin, resetIpThrottle } from "./helpers";

/**
 * One Owner ACCOUNT for the whole browser lane — credentials, not a session.
 *
 * WHY THIS EXISTS, and it is not speed. `POST /auth/refresh` shares F-001's
 * per-IP pre-auth budget with login and signup (`checkIp`), and the session
 * provider refreshes on every full page load — so the lane's real currency is
 * "pre-auth requests per five minutes", capped at 20 for the whole runner. A
 * suite where every file signs somebody up spends that on plumbing and then
 * fails with "ลองเข้าสู่ระบบถี่เกินไป", which is the throttle being right.
 *
 * So the ACCOUNT is created once and every file signs into it — one login
 * each, instead of a signup and a login each.
 *
 * ⚠️ NOT a saved `storageState`, and that is the interesting part. Refresh
 * tokens ROTATE (F-001), so a state file captured once and restored by three
 * contexts replays the same token three times — which is precisely what reuse
 * detection exists to catch. The server was right to answer
 * `401 INVALID_REFRESH`; the suite was wrong to look like a stolen cookie.
 * Each context logs in and gets its own family.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const SHARED_FIXTURE = "e2e/.auth/shared.json";

setup("create the shared Owner and shop", async ({ page }) => {
  await resetIpThrottle();
  const email = freshEmail("shared-owner");
  await signUpAndLogin(page, email);

  const shopName = `ร้านหลัก ${Date.now()}`;
  const orgId = await createShop(page, shopName);

  // Written to disk, not exported as module state: each project runs in its
  // own worker process, so a shared object would be empty everywhere else.
  mkdirSync(dirname(SHARED_FIXTURE), { recursive: true });
  writeFileSync(SHARED_FIXTURE, JSON.stringify({ email, orgId, shopName }, null, 2));
});
