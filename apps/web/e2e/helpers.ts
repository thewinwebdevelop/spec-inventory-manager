import { expect, type Page } from "@playwright/test";

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
export async function openSwitcher(page: Page): Promise<void> {
  const summary = page.locator("details > summary").first();
  if (!(await page.locator("details[open]").count())) {
    await summary.click();
  }
  await expect(page.getByText("สลับร้าน")).toBeVisible();
}

export async function openMembers(page: Page, orgId: string): Promise<void> {
  // Same reason as `createShop`: follow the nav entry when it is on screen.
  const nav = page.getByRole("navigation", { name: "เมนูของร้าน" });
  const entry = nav.getByRole("link", { name: "สมาชิก" });
  if (await entry.count()) {
    await entry.click();
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
