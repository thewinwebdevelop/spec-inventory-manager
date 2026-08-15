import { test as setup } from "@playwright/test";
import { createShop, freshEmail, signUpAndLogin } from "./helpers";

/**
 * One signed-in Owner for the whole browser lane, saved as a storage state.
 *
 * WHY THIS EXISTS, and it is not speed. `POST /auth/refresh` shares F-001's
 * per-IP pre-auth budget with login and signup (`checkIp`), and the session
 * provider refreshes on every full page load — so the lane's real currency is
 * "pre-auth requests per five minutes", capped at 20 for the whole runner. A
 * suite where every file signs somebody up spends that on plumbing and then
 * fails with "ลองเข้าสู่ระบบถี่เกินไป", which is the throttle being right.
 *
 * So the cast is created ONCE. Only the specs whose subject IS the signup
 * journey opt out (`test.use({ storageState: … })` with an empty state) — E-01
 * must still walk it for real, because that is what E-01 is.
 *
 * ⚠️ The saved state carries `omni_rt` (httpOnly, Path=/auth) and nothing else
 * that matters: the access token lives in memory by design (token-store.ts), so
 * a restored context still has to rebuild it — which is exactly the path E-01b
 * proves works.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const OWNER_STATE = "e2e/.auth/owner.json";
export const SHARED_FIXTURE = "e2e/.auth/shared.json";

setup("create the shared Owner and shop", async ({ page }) => {
  const email = freshEmail("shared-owner");
  await signUpAndLogin(page, email);

  const shopName = `ร้านหลัก ${Date.now()}`;
  const orgId = await createShop(page, shopName);

  // Written to disk, not exported as module state: each project runs in its
  // own worker process, so a shared object would be empty everywhere else.
  mkdirSync(dirname(SHARED_FIXTURE), { recursive: true });
  writeFileSync(SHARED_FIXTURE, JSON.stringify({ email, orgId, shopName }, null, 2));

  await page.context().storageState({ path: OWNER_STATE });
});
