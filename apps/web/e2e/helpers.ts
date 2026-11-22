import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import Redis from "ioredis";

/**
 * The journeys every §12.1 row starts from.
 *
 * Kept as functions rather than a fixture on purpose: a fixture that silently
 * "arranges" a signed-in owner with a shop would hide the very steps E-01
 * exists to prove, and the day one of them breaks, every spec would fail at a
 * line nobody wrote. These read as what a person does, and each one asserts it
 * actually happened.
 */

export const PASSWORD = "E2e-passphrase-8Kx!";

/**
 * Clears F-001's per-IP pre-auth counter for this runner.
 *
 * ⚠️ WHAT THIS IS AND IS NOT. It is a test-only reset of an abuse counter this
 * lane does not test, and it touches no production code. It exists because the
 * counter is per IP and per five minutes (`IP_WINDOW_MAX = 20`, a hard-coded
 * constant), every full page load spends a slot through `POST /auth/refresh`,
 * and a whole browser suite runs from one address inside one window. Without
 * it the lane's capacity is about three files, and every file added after that
 * fails with "ลองเข้าสู่ระบบถี่เกินไป" — the throttle being right about a
 * situation that only exists in CI.
 *
 * It is NOT a way to avoid the finding: an office behind one NAT hits the same
 * wall, and that belongs to backend-api and the security reviewer (see
 * tasks.md). A suite that tested the throttle would obviously not call this.
 *
 * No-ops without `E2E_REDIS_URL`, so a local run against somebody's own stack
 * cannot quietly wipe keys they meant to keep.
 */
export async function resetIpThrottle(): Promise<void> {
  const url = process.env.E2E_REDIS_URL;
  if (!url) return;

  const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    const keys = await redis.keys("throttle:ip:*");
    if (keys.length > 0) await redis.del(...keys);
  } finally {
    redis.disconnect();
  }
}

/**
 * The Owner + shop `auth.setup.ts` created for THIS viewport project (one per
 * project — see auth.setup.ts for the per-user shop-creation limit). Must be
 * called inside a test or hook, where `test.info()` knows the project.
 */
export function readShared(): { email: string; orgId: string; shopName: string } {
  const project = test.info().project.name;
  return JSON.parse(readFileSync(`e2e/.auth/shared-${project}.json`, "utf8"));
}

/** Unique per call — one database serves the whole run. */
export function freshEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@omnistock.test`;
}

/** Signup → login. Ends on `/select-org`, which is where ux §1.1 sends it. */
export async function signUpAndLogin(page: Page, email: string): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "สมัครใช้งาน" }).click();

  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/select-org/);
}

/**
 * Lands on the shop picker and waits for the app to be READY, not merely
 * rendered.
 *
 * A page load leaves the app with a refresh cookie and no access token — that
 * lives in memory by design — so the first thing it does is bootstrap. Acting
 * before that settles sends a request with no credential, and the server
 * answers `401 UNAUTHENTICATED`, which the screen reports as
 * "สร้างร้านไม่สำเร็จ". That is not a bug in the app: a real person cannot
 * click before the page has drawn. Waiting for the picker's own heading is the
 * same signal they use.
 */
export async function landOnPicker(page: Page): Promise<void> {
  await page.goto("/select-org");
  await expect(page.getByRole("heading", { name: "เลือกร้านที่จะเข้าใช้งาน" })).toBeVisible();
}

/** Signs an EXISTING account in. */
export async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/select-org/);
}

/**
 * Creates a shop from wherever the picker is, and returns its id.
 *
 * ⚠️ NAVIGATES BY CLICKING, not by `goto`. Every full page load bootstraps the
 * session with a `POST /auth/refresh`, and that endpoint shares F-001's per-IP
 * pre-auth budget with login and signup (`checkIp`, auth.controller) — 20 per
 * five minutes, hard-coded. A suite that `goto`s everywhere spends its budget
 * on page loads and then fails with "ลองเข้าสู่ระบบถี่เกินไป", which is the
 * throttle working correctly. Clicking is also what a person does.
 */
export async function createShop(page: Page, name: string): Promise<string> {
  if (!/\/orgs\/new/.test(page.url())) {
    const link = page.getByRole("link", { name: "สร้างร้านใหม่" }).first();
    if (await link.count()) {
      await link.click();
    } else {
      await page.goto("/orgs/new");
    }
  }
  await page.getByLabel("ชื่อร้าน").fill(name);
  await page.getByRole("button", { name: "สร้างร้าน", exact: true }).click();

  await expect(page).toHaveURL(/\/o\/[A-Za-z0-9_-]+/, { timeout: 20_000 });
  const orgId = /\/o\/([A-Za-z0-9_-]+)/.exec(page.url())?.[1];
  expect(orgId, `could not read an org id out of ${page.url()}`).toBeTruthy();
  return orgId!;
}

/**
 * Opens the shop switcher.
 *
 * It is a `<details>/<summary>` disclosure on web — the shop lives in the URL
 * (web.md §3.2), so the list inside is links, and it is collapsed until asked
 * for. Mobile's tap-the-AppBar bottom sheet is the other shape (§13).
 */
/**
 * Below lg (1024px) the shell's nav — shop switcher, menu, sign-out — lives in
 * a drawer behind "เปิดเมนู" (design-system §8.2); at ≥lg it is the permanent
 * sidebar. Opens the drawer when there is one, the way a person on a tablet
 * would, and is a no-op on desktop. D-038 ② runs every journey at both.
 */
export async function openNav(page: Page): Promise<void> {
  // `exact`: role names match by SUBSTRING by default, and "เปิดเมนู" contains
  // "ปิดเมนู" — the open button would also answer to the close button's name.
  const show = page.getByRole("button", { name: "เปิดเมนู", exact: true });
  const sidebar = page.getByRole("navigation", { name: "เมนูของร้าน" }).filter({ visible: true });
  // Wait for the SHELL first: `isVisible()` does not wait, and asked during the
  // first render it answers "no toggle" on a tablet and leaves the drawer shut.
  await expect(show.or(sidebar).first()).toBeVisible();
  const hide = page.getByRole("button", { name: "ปิดเมนู", exact: true });
  // Already open: the toggle is still "visible" UNDER the scrim, and clicking
  // it would land on the drawer instead.
  if (await hide.isVisible()) return;
  if (await show.isVisible()) {
    await show.click();
    await expect(hide).toBeVisible();
  }
}

/**
 * The shop's nav ("เมนูของร้าน") as a person can reach it at the current width:
 * opens the drawer below lg first, then returns the VISIBLE nav — at tablet
 * width the permanent sidebar is still in the DOM, just hidden.
 */
export async function shopNav(page: Page): Promise<Locator> {
  await openNav(page);
  return page.getByRole("navigation", { name: "เมนูของร้าน" }).filter({ visible: true });
}

export async function openSwitcher(page: Page): Promise<void> {
  await openNav(page);
  const summary = page.locator("details > summary").filter({ visible: true }).first();
  if (!(await page.locator("details[open]").count())) {
    await summary.click();
  }
  await expect(page.getByText("สลับร้าน").filter({ visible: true })).toBeVisible();
}

export async function openMembers(page: Page, orgId: string): Promise<void> {
  // Same reason as `createShop`: follow the nav entry when it is on screen.
  const nav = await shopNav(page);
  const entry = nav.getByRole("link", { name: "สมาชิก" });
  // WAIT for the entry, never sample it: `count()` right after opening the
  // tablet drawer could read 0 before the drawer rendered and fall back to a
  // full `goto` — a different code path (and a second session bootstrap). CI
  // run on b779675 (e20, tablet) ended with the page still on R3 and no clue
  // which path ran; now each step fails on its own line.
  const reachable = await entry
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (reachable) {
    await entry.click();
    await expect(page, "clicking the สมาชิก menu entry did not navigate").toHaveURL(
      new RegExp(`/o/${orgId}/settings/members`),
      { timeout: 20_000 },
    );
  } else {
    await page.goto(`/o/${orgId}/settings/members`);
  }
  // `exact` matters: "สมาชิกในร้าน (n)" is a heading on this page too.
  await expect(page.getByRole("heading", { name: "สมาชิก", exact: true })).toBeVisible();
}

/**
 * Invites somebody and returns the one-time link.
 *
 * `roleName` is the Thai label as rendered (เจ้าของร้าน / ผู้ดูแล / พนักงาน) —
 * the dialog offers roles by name, and which ones it offers depends on the
 * caller's own capabilities (D-028/C-1), so passing the label is closer to
 * what the person actually picks than an id would be.
 */
/**
 * Leaves the members screen and comes back — the way a person does.
 *
 * ⚠️ WHY THIS EXISTS AND `openMembers` IS NOT ENOUGH. `openMembers` clicks the
 * nav entry, and when the page is ALREADY on that route the click changes
 * nothing: no unmount, no mount, no query. B-7 made the two lists refetch when
 * the screen is opened (`staleTime: 0`), and "opened" means MOUNTED. A test
 * that clicks a link to the page it is already on proves nothing about that,
 * and the first run after the fix said so — the snapshot still read
 * "คำเชิญที่รอตอบรับ (1)" over "สมาชิกในร้าน (1)".
 *
 * The round trip through another screen is what an Owner actually does between
 * sending a link and checking whether it was accepted. Switching to LINE and
 * back is the other one, and that path works too now: `refetchOnWindowFocus`
 * was already on, but the 30s freshness used to swallow it.
 */
export async function reopenMembers(page: Page, orgId: string): Promise<void> {
  const nav = await shopNav(page);
  await nav.getByRole("link", { name: "ข้อมูลร้าน" }).click();
  await expect(page.getByRole("heading", { name: "ข้อมูลร้าน" })).toBeVisible({ timeout: 20_000 });
  await openMembers(page, orgId);
}

export async function invite(page: Page, email: string, roleName: string): Promise<string> {
  await page.getByRole("button", { name: "เชิญสมาชิก" }).first().click();

  const dialog = page.getByRole("dialog", { name: "เชิญสมาชิก" });
  await dialog.getByLabel("อีเมลของคนที่จะเชิญ").fill(email);
  await dialog.getByRole("radio", { name: roleName }).check();
  await dialog.getByRole("button", { name: "สร้างลิงก์คำเชิญ" }).click();

  // S8 — the link is shown ONCE, so it is read here and nowhere else.
  const panel = page.getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" });
  await expect(panel).toBeVisible({ timeout: 20_000 });
  const url = await panel.getByRole("textbox", { name: "ลิงก์คำเชิญพร้อมแล้ว" }).inputValue();
  expect(url, "the panel showed no invite URL").toContain("/invite?token=");
  return url;
}

/** Accepts an invitation as the CURRENTLY signed-in account. */
export async function acceptInvite(page: Page, inviteUrl: string): Promise<void> {
  // The link carries the token in the URL — that is D-012's whole shape — and
  // the screen strips it on arrival (I-6).
  await page.goto(new URL(inviteUrl).pathname + new URL(inviteUrl).search);
  await page.getByRole("button", { name: "เข้าร่วมร้านนี้" }).click();
}

/**
 * F-003 role writes are behind `ROLE_WRITES_ENABLED` on the API. The runner
 * cannot ask the server which way it was booted without a request, so the
 * lane says so explicitly: `E2E_ROLE_WRITES=on` ⇔ the API under test has the
 * flag on. Specs for one mode skip in the other; a mismatch fails at the first
 * assertion on the server's verdict (create enabled / writes_disabled banner).
 */
export const ROLE_WRITES_ON = process.env.E2E_ROLE_WRITES === "on";
