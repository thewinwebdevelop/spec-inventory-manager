import { type Page, type Request } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  acceptInvite,
  createShop,
  freshEmail,
  invite,
  login,
  openMembers,
  readShared,
  resetIpThrottle,
  ROLE_WRITES_ON,
  shopNav,
  signUpAndLogin,
} from "./helpers";
import { expectResponsive } from "./responsive";

/**
 * EW3 (R3a / R3b) — T-003-W07 against the REAL server (`ROLE_WRITES_ENABLED=true`).
 *
 * Use cases (each at chromium 1280 + tablet 768):
 *  - R3a · EW3-01 (dialog half) · AC-3.11: the Owner changes the capabilities
 *    of "ผู้ดูแล" → the dialog lists เพิ่ม / เอาออก and the impact, with N and M
 *    taken from the server's `usage` (1 member + 1 open invitation, arranged
 *    here); "แก้ต่อ" and Escape send NOTHING; "บันทึก" sends exactly ONE PATCH.
 *  - R3b · EW3-08 · AC-3.12 · SR-14: two real sessions — the other saves first,
 *    this one gets a real 409 ROLE_CHANGED → banner with MY diff, the latest
 *    version in the form; "ใส่การแก้ของฉันกลับเข้าไป" refills it and sends
 *    nothing; saving again is a new press through R3a → one more PATCH, which
 *    the server accepts (the other person's rename is kept).
 *  - R3a · AC-3.10: an Admin edits their OWN role and loses something other
 *    than manage_roles → warning + "ถ้าต้องการคืน…", stays on the form.
 *  - R3a · EW3-06 · AC-3.10: the Admin removes manage_roles from their own role
 *    → warning + "กลับมาแก้เองไม่ได้" → redirect to ข้อมูลร้าน + toast, the
 *    menu entry is gone, and the roles URL now answers forbidden.
 *
 * Screenshots (D-038 ③) are written only when `W07_SHOTS_DIR` is set, from the
 * chromium project, at 1280 / 768 / 390.
 */
test.describe.configure({ mode: "serial" });
test.skip(!ROLE_WRITES_ON, "needs a server with ROLE_WRITES_ENABLED=true (E2E_ROLE_WRITES=on)");

let ownerPage: Page;
let adminPage: Page;
let orgId = "";
const adminEmail = freshEmail("w07-admin");
const pendingEmail = freshEmail("w07-pending");
const ROLE_PATH = /\/orgs\/[^/]+\/roles\/[^/?]+$/;

const nameBox = (page: Page) => page.getByRole("textbox", { name: "ชื่อบทบาท" });
const row = (page: Page, label: string) =>
  page.getByRole("checkbox", { name: new RegExp(`^${label}`) });
const saveButton = (page: Page) =>
  page.getByRole("button", { name: "บันทึก", exact: true }).first();
const confirmDialog = (page: Page) =>
  page.getByRole("alertdialog", { name: /^บันทึกการเปลี่ยนสิทธิ์ของ/ });

/** Every PATCH to a role this page sends from now on. */
function countPatches(page: Page): Request[] {
  const out: Request[] = [];
  page.on("request", (r) => {
    if (r.method() === "PATCH" && ROLE_PATH.test(r.url())) out.push(r);
  });
  return out;
}

async function shoot(page: Page, name: string): Promise<void> {
  const dir = process.env.W07_SHOTS_DIR;
  if (!dir || test.info().project.name !== "chromium") return;
  const original = page.viewportSize()!;
  for (const [w, h] of [
    [1280, 800],
    [768, 1024],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    // Viewport only: a full-page capture shades just the first screen of a `fixed` scrim.
    await page.screenshot({ path: `${dir}/w07-${name}-${w}.png` });
  }
  await page.setViewportSize(original);
  await page.waitForTimeout(250);
}

async function openRoles(page: Page): Promise<void> {
  const nav = await shopNav(page);
  await nav.getByRole("link", { name: "บทบาทและสิทธิ์" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "บทบาทและสิทธิ์" })).toBeVisible();
  await expect(page.getByText(/^ใช้ไป \d+ จาก/)).toBeVisible({ timeout: 20_000 });
}

async function openRole(page: Page, name: RegExp): Promise<void> {
  await openRoles(page);
  await page.getByRole("link", { name }).click();
  await expect(nameBox(page)).toBeVisible({ timeout: 20_000 });
}

test.beforeAll(async ({ browser }) => {
  await resetIpThrottle();
  ownerPage = await browser.newContext().then((c) => c.newPage());
  adminPage = await browser.newContext().then((c) => c.newPage());
  await login(ownerPage, readShared().email);
  orgId = await createShop(ownerPage, `ร้านยืนยันบทบาท ${Date.now()}`);

  // "ผู้ดูแล" gets one active member (the Admin) and one open invitation.
  await openMembers(ownerPage, orgId);
  const link = await invite(ownerPage, adminEmail, "ผู้ดูแล");
  const done = () =>
    ownerPage
      .getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" })
      .getByRole("button", { name: "เสร็จแล้ว" })
      .click();
  await done();
  await invite(ownerPage, pendingEmail, "ผู้ดูแล");
  await done();
  await resetIpThrottle();
  await signUpAndLogin(adminPage, adminEmail);
  await acceptInvite(adminPage, link);
  await adminPage.getByRole("link", { name: "เริ่มใช้งานร้านนี้" }).click();
  await expect(adminPage).toHaveURL(new RegExp(`/o/${orgId}`), { timeout: 20_000 });
});

test.afterAll(async () => {
  await ownerPage.close();
  await adminPage.close();
});

test("R3a · the Owner edits 'ผู้ดูแล': diff + impact from the server; แก้ต่อ / Escape send nothing; บันทึก sends ONE PATCH", async () => {
  const page = ownerPage;
  await openRole(page, /^ผู้ดูแล/);
  await expect(page.getByText("สมาชิก 1 คน · คำเชิญที่ยังไม่ปิด 1 ใบ")).toBeVisible();
  const patches = countPatches(page);

  await row(page, "เชื่อมต่อช่องทางขาย").click();
  await row(page, "จัดการแพ็กเกจและการชำระเงิน").click();
  await saveButton(page).click();

  const d = confirmDialog(page);
  await expect(d).toBeVisible();
  await expect(
    d.getByRole("heading", { name: 'บันทึกการเปลี่ยนสิทธิ์ของ "ผู้ดูแล"?' }),
  ).toBeVisible();
  await expect(
    d
      .locator("section")
      .filter({ hasText: /^เพิ่ม/ })
      .getByRole("listitem"),
  ).toHaveText(["จัดการแพ็กเกจและการชำระเงิน"]);
  await expect(
    d
      .locator("section")
      .filter({ hasText: /^เอาออก/ })
      .getByRole("listitem"),
  ).toHaveText(["เชื่อมต่อช่องทางขาย"]);
  await expect(d.getByText("มีผลกับสมาชิก 1 คนทันที ไม่ต้องออกจากระบบ")).toBeVisible();
  await expect(d.getByText("คำเชิญที่ยังไม่ปิด 1 ใบ จะได้สิทธิ์ชุดใหม่เมื่อกดรับ")).toBeVisible();
  // Not the Owner's own role → no self-loss warning.
  await expect(d.getByText("คุณจะเสียสิทธิ์เหล่านี้ทันที")).toHaveCount(0);
  await expectResponsive(page, "R3a dialog");
  await shoot(page, "r3a-dialog");

  // แก้ต่อ → nothing sent, edits kept.
  await d.getByRole("button", { name: "แก้ต่อ" }).click();
  await expect(d).toHaveCount(0);
  await expect(row(page, "จัดการแพ็กเกจและการชำระเงิน")).toBeChecked();
  // Escape → nothing sent either.
  await saveButton(page).click();
  await expect(d).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(d).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(patches).toHaveLength(0);

  // บันทึก → exactly one PATCH.
  await saveButton(page).click();
  await d.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText('บันทึกบทบาท "ผู้ดูแล" แล้ว')).toBeVisible({ timeout: 20_000 });
  await expect(d).toHaveCount(0);
  await page.waitForTimeout(1_000);
  expect(patches).toHaveLength(1);
  // The server saved it: a fresh load shows the new ticks.
  await page.reload();
  await expect(row(page, "จัดการแพ็กเกจและการชำระเงิน")).toBeChecked({ timeout: 20_000 });
  await expect(row(page, "เชื่อมต่อช่องทางขาย")).not.toBeChecked();
});

test("R3b · a real 409 ROLE_CHANGED: banner with MY diff, re-apply refills without sending, saving again = one more PATCH via R3a", async ({
  browser,
}) => {
  const page = ownerPage;
  await openRole(page, /^พนักงาน/);
  await expect(nameBox(page)).toHaveValue("พนักงาน");

  // A second session of the same Owner renames it first.
  await resetIpThrottle();
  const other = await browser.newContext().then((c) => c.newPage());
  try {
    await login(other, readShared().email);
    await other.goto(`/o/${orgId}/settings/roles`);
    await expect(other.getByText(/^ใช้ไป \d+ จาก/)).toBeVisible({ timeout: 20_000 });
    await other.getByRole("link", { name: /^พนักงาน/ }).click();
    await nameBox(other).fill("พนักงานหน้าร้าน");
    await saveButton(other).click(); // a rename alone: no dialog
    await expect(other.getByText('บันทึกบทบาท "พนักงานหน้าร้าน" แล้ว')).toBeVisible({
      timeout: 20_000,
    });
  } finally {
    await other.close();
  }

  const patches = countPatches(page);
  await row(page, "ดูต้นทุนและกำไร").click();
  await saveButton(page).click();
  await confirmDialog(page).getByRole("button", { name: "บันทึก", exact: true }).click();

  const banner = page.getByRole("status").filter({ hasText: "มีคนแก้บทบาทนี้ไปก่อนคุณ" });
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(
    banner.getByText("หน้านี้แสดงฉบับล่าสุดแล้ว สิ่งที่คุณแก้ไว้ยังไม่ถูกบันทึก:"),
  ).toBeVisible();
  await expect(banner.getByRole("listitem")).toHaveText(["เพิ่ม: ดูต้นทุนและกำไร"]);
  await expect(nameBox(page)).toHaveValue("พนักงานหน้าร้าน");
  await expect(row(page, "ดูต้นทุนและกำไร")).not.toBeChecked();
  await expectResponsive(page, "R3b banner");
  await shoot(page, "r3b-banner");

  // Re-apply: fills the form, sends nothing.
  await banner.getByRole("button", { name: "ใส่การแก้ของฉันกลับเข้าไป" }).click();
  await expect(row(page, "ดูต้นทุนและกำไร")).toBeChecked();
  await expect(nameBox(page)).toHaveValue("พนักงานหน้าร้าน");
  await expect(banner.getByRole("button", { name: "ใส่การแก้ของฉันกลับเข้าไป" })).toHaveCount(0);
  await page.waitForTimeout(1_500);
  expect(patches).toHaveLength(1);
  await shoot(page, "r3b-reapplied");

  // Saving again is a new press, through R3a, on the latest version.
  await saveButton(page).click();
  await confirmDialog(page).getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText('บันทึกบทบาท "พนักงานหน้าร้าน" แล้ว')).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForTimeout(1_000);
  expect(patches).toHaveLength(2);
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(row(page, "ดูต้นทุนและกำไร")).toBeChecked({ timeout: 20_000 });
  await expect(nameBox(page)).toHaveValue("พนักงานหน้าร้าน");

  // ปิด: another conflict, dismissed → the latest version, nothing to save.
  await resetIpThrottle();
  const third = await browser.newContext().then((c) => c.newPage());
  try {
    await login(third, readShared().email);
    await third.goto(`/o/${orgId}/settings/roles`);
    await expect(third.getByText(/^ใช้ไป \d+ จาก/)).toBeVisible({ timeout: 20_000 });
    await third.getByRole("link", { name: /^พนักงานหน้าร้าน/ }).click();
    await nameBox(third).fill("พนักงานกะดึก");
    await saveButton(third).click();
    await expect(third.getByText('บันทึกบทบาท "พนักงานกะดึก" แล้ว')).toBeVisible({
      timeout: 20_000,
    });
  } finally {
    await third.close();
  }
  await nameBox(page).fill("พนักงานกะเช้า");
  await saveButton(page).click(); // rename only → no dialog → 409
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(banner.getByRole("listitem")).toHaveText([
    'ชื่อ: "พนักงานหน้าร้าน" → "พนักงานกะเช้า"',
  ]);
  await banner.getByRole("button", { name: "ปิด" }).click();
  await expect(banner).toHaveCount(0);
  await expect(nameBox(page)).toHaveValue("พนักงานกะดึก");
  await expect(saveButton(page)).toBeDisabled();
  expect(patches).toHaveLength(3);
});

test("R3a · AC-3.10: an Admin loses something from their OWN role (not manage_roles) → warning, stays on the form", async () => {
  const page = adminPage;
  await resetIpThrottle();
  await openRole(page, /^ผู้ดูแล/);
  await expect(page.getByText(/\(รวมคุณ\)/)).toBeVisible();
  const patches = countPatches(page);

  await row(page, "ดูต้นทุนและกำไร").click();
  await saveButton(page).click();
  const d = confirmDialog(page);
  const warn = d.getByRole("alert").filter({ hasText: "คุณจะเสียสิทธิ์เหล่านี้ทันที" });
  await expect(warn).toBeVisible();
  await expect(warn.getByRole("listitem")).toHaveText(["ดูต้นทุนและกำไร"]);
  await expect(warn.getByText("ถ้าต้องการคืน ให้เจ้าของร้านแก้ให้")).toBeVisible();
  await expect(d.getByRole("button", { name: "แก้ต่อ" })).toBeFocused();
  await expectResponsive(page, "R3a self-loss (other)");
  await shoot(page, "r3a-self-loss-other");

  await d.getByRole("button", { name: "บันทึก และยอมเสียสิทธิ์" }).click();
  await expect(page.getByText('บันทึกบทบาท "ผู้ดูแล" แล้ว')).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/settings\/roles\/[^/]+$/);
  await expect(row(page, "ดูต้นทุนและกำไร")).not.toBeChecked();
  // The re-read verdict still lets me edit (form, not read-only).
  await expect(nameBox(page)).toBeEnabled();
  expect(patches).toHaveLength(1);
});

test("R3a · EW3-06: the Admin removes manage_roles from their OWN role → warning → ข้อมูลร้าน + toast, menu entry gone, roles URL forbidden", async () => {
  const page = adminPage;
  await openRole(page, /^ผู้ดูแล/);
  const patches = countPatches(page);

  await row(page, "จัดการบทบาทและสิทธิ์").click();
  await saveButton(page).click();
  const d = confirmDialog(page);
  const warn = d.getByRole("alert").filter({ hasText: "คุณจะเสียสิทธิ์เหล่านี้ทันที" });
  await expect(warn.getByRole("listitem")).toHaveText(["จัดการบทบาทและสิทธิ์"]);
  await expect(
    warn.getByText("บันทึกแล้วคุณจะกลับมาแก้เองไม่ได้ ต้องให้เจ้าของร้านแก้คืน"),
  ).toBeVisible();
  await expect(d.getByRole("button", { name: "แก้ต่อ" })).toBeFocused();
  await expectResponsive(page, "R3a self-loss (manage_roles)");
  await shoot(page, "r3a-self-loss-manage-roles");

  await d.getByRole("button", { name: "บันทึก และยอมเสียสิทธิ์" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${orgId}/settings/org$`), { timeout: 20_000 });
  await expect(page.getByText("บันทึกแล้ว — ตอนนี้คุณไม่มีสิทธิ์จัดการบทบาทแล้ว")).toBeVisible();
  await expect(page.getByRole("heading", { name: "ข้อมูลร้าน" })).toBeVisible();
  await shoot(page, "after-losing-manage-roles");
  expect(patches).toHaveLength(1);

  const nav = await shopNav(page);
  await expect(nav.getByRole("link", { name: "บทบาทและสิทธิ์" })).toHaveCount(0, {
    timeout: 20_000,
  });
  const close = page.getByRole("button", { name: "ปิดเมนู", exact: true });
  if (await close.isVisible()) await close.click();

  await resetIpThrottle();
  await page.goto(`/o/${orgId}/settings/roles`);
  await expect(page.getByRole("link", { name: "กลับไปหน้าข้อมูลร้าน" })).toBeVisible({
    timeout: 20_000,
  });
});
