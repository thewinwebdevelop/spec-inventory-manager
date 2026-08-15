import { expect, test } from "@playwright/test";
import { resetIpThrottle } from "./helpers";

/**
 * E-01 (test-plan §12.1) — signup → create a shop → land inside it.
 *
 * The first case of the browser lane, and deliberately the widest: it crosses
 * signup, login, the org list, provisioning and the shell, against a real
 * Postgres. If the wiring between web and API is broken anywhere — the
 * same-origin `/auth/*` rewrite, the cookie path, the access token in memory,
 * the org header — this is where it shows, and it shows as a failed step
 * rather than as a subtle mock that agreed with the code.
 *
 * The assertion that matters is the last one: after creating a shop the person
 * is INSIDE it. api-spec Q5 says `POST /organizations` answers with enough to
 * enter without a second round trip, and a client that re-fetched
 * `/me/organizations` to find the shop it just made would pass every unit test
 * and still be wrong about the contract.
 */

/** Unique per run: the database is shared across a CI run's specs. */
function freshEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@omnistock.test`;
}

const PASSWORD = "E2e-passphrase-8Kx!";

test.beforeEach(async () => {
  await resetIpThrottle();
});

test("E-01 · signs up, creates a shop, and is inside it", async ({ page }) => {
  const email = freshEmail();

  // ── signup ────────────────────────────────────────────────────────────
  await page.goto("/signup");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "สมัครใช้งาน" }).click();

  // Signup does NOT auto-login (locked in api-spec §4 open item 1): it lands
  // on /login with the address carried over, so the person types one thing.
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("อีเมล")).toHaveValue(email);

  // ── login ─────────────────────────────────────────────────────────────
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  // ── a member of nothing yet: S1's empty state, which must offer the way
  //    out rather than just report the absence ─────────────────────────────
  await expect(page).toHaveURL(/\/select-org/);
  await expect(page.getByText("คุณยังไม่ได้อยู่ในร้านไหน")).toBeVisible();

  // ★ The session's ONLY durable half. The access token lives in memory and
  // dies with the tab; `omni_rt` (httpOnly, Path=/auth) is what rebuilds it.
  // Asserted here rather than left implicit because the first run of this lane
  // reached `/o/{id}` and was then bounced to /login by `401 NO_REFRESH_TOKEN`
  // — the browser had no cookie to send, and every screen before this point
  // worked anyway on the in-memory token. This is the assertion that tells the
  // two apart.
  const cookies = await page.context().cookies();
  expect(
    cookies.map((c) => c.name),
    `no refresh cookie after login — the session cannot survive anything. Cookies: ${JSON.stringify(cookies)}`,
  ).toContain("omni_rt");

  // ── create the shop ───────────────────────────────────────────────────
  // The empty state renders `<Link><Button>สร้างร้านใหม่</Button></Link>`, so
  // both roles carry that name — the LINK is the one that navigates.
  await page.getByRole("link", { name: "สร้างร้านใหม่" }).click();
  await expect(page).toHaveURL(/\/orgs\/new/);

  const shopName = `ร้านทดสอบ ${Date.now()}`;
  await page.getByLabel("ชื่อร้าน").fill(shopName);
  await page.getByRole("button", { name: "สร้างร้าน", exact: true }).click();

  // ── THE ASSERTION: inside the new shop, by URL and by what is on screen ──
  await expect(page).toHaveURL(/\/o\/[A-Za-z0-9_-]+/, { timeout: 20_000 });
  await expect(page.getByText(shopName).first()).toBeVisible();
});

test("E-01b · the shop persists across a reload — the session survives", async ({ page }) => {
  // A separate case because it proves something different: the first one could
  // pass on a client that holds everything in memory and forgets it on F5. The
  // refresh cookie is `Path=/auth`, so this also exercises the rewrite that
  // makes that scope work (infra/gateway/README.md).
  const email = freshEmail();

  await page.goto("/signup");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "สมัครใช้งาน" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/select-org/);

  await page.getByRole("link", { name: "สร้างร้านใหม่" }).click();
  const shopName = `ร้านค้าง ${Date.now()}`;
  await page.getByLabel("ชื่อร้าน").fill(shopName);
  await page.getByRole("button", { name: "สร้างร้าน", exact: true }).click();
  await expect(page).toHaveURL(/\/o\/[A-Za-z0-9_-]+/, { timeout: 20_000 });

  const insideTheShop = page.url();
  await page.reload();

  // Still inside, not bounced to /login: the access token is gone from memory
  // and has to be rebuilt from the refresh cookie.
  await expect(page).toHaveURL(insideTheShop, { timeout: 20_000 });
  await expect(page.getByText(shopName).first()).toBeVisible();
});
