import { expect, test, type Page } from "@playwright/test";
import {
  acceptInvite,
  createShop,
  freshEmail,
  invite,
  login,
  openMembers,
  readShared,
  resetIpThrottle,
  signUpAndLogin,
} from "./helpers";

/**
 * EW3-11 ★ (R1 half) — the roles screen is REACHABLE: the menu takes a
 * `manage_roles` holder there, a plain Staff member sees no menu entry, and
 * typing the URL as Staff gives the forbidden panel (repo lesson "unreachable
 * but tested").
 *
 * Also the R1 read against the real server. `ROLE_WRITES_ENABLED` is off in
 * this lane (default), so the create button is DISABLED by the server's
 * `writes_disabled` verdict — which is what is asserted. The R2 dialog is
 * therefore covered by the component suite (RolesScreen.test.tsx) until the
 * flag is on in E2E (B23).
 */
test.describe.configure({ mode: "serial" });

let ownerPage: Page;
let staffPage: Page;
let orgId = "";
const staffEmail = freshEmail("roles-staff");

test.beforeAll(async ({ browser }) => {
  await resetIpThrottle();
  ownerPage = await browser.newContext().then((c) => c.newPage());
  staffPage = await browser.newContext().then((c) => c.newPage());
  await login(ownerPage, readShared().email);
  orgId = await createShop(ownerPage, `ร้านบทบาท ${Date.now()}`);
  await signUpAndLogin(staffPage, staffEmail);
});

test.afterAll(async () => {
  await ownerPage.close();
  await staffPage.close();
});

test("EW3-11 · the Owner reaches the roles list from the menu and reads the three system roles", async () => {
  const nav = ownerPage.getByRole("navigation", { name: "เมนูของร้าน" });
  await nav.getByRole("link", { name: "บทบาทและสิทธิ์" }).click();
  await expect(ownerPage).toHaveURL(new RegExp(`/o/${orgId}/settings/roles$`));
  await expect(ownerPage.getByRole("heading", { level: 1, name: "บทบาทและสิทธิ์" })).toBeVisible();

  await expect(ownerPage.getByText("ใช้ไป 3 จาก")).toBeVisible({ timeout: 20_000 });
  const owner = ownerPage.getByRole("link", { name: /เจ้าของร้าน/ });
  await expect(owner).toContainText("ล็อก");
  await expect(owner).toContainText("สมาชิก 1 คน (รวมคุณ)");
  await expect(owner).toContainText("ค่าเริ่มต้นของระบบ");
  await expect(ownerPage.getByRole("link", { name: /ผู้ดูแล/ })).toBeVisible();
  await expect(ownerPage.getByRole("link", { name: /พนักงาน/ })).toBeVisible();
});

test("R1 · role writes are off in this lane: banner on top and the create button disabled by the verdict", async () => {
  await expect(ownerPage.getByText("ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้")).toBeVisible();
  await expect(ownerPage.getByRole("button", { name: "สร้างบทบาท" })).toBeDisabled();
});

test("EW3-11 · a Staff member has no menu entry and the URL gives the forbidden panel", async () => {
  await openMembers(ownerPage, orgId);
  const link = await invite(ownerPage, staffEmail, "พนักงาน");
  await ownerPage
    .getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" })
    .getByRole("button", { name: "เสร็จแล้ว" })
    .click();
  await acceptInvite(staffPage, link);
  await staffPage.getByRole("link", { name: "เริ่มใช้งานร้านนี้" }).click();
  await expect(staffPage).toHaveURL(new RegExp(`/o/${orgId}`), { timeout: 20_000 });

  const nav = staffPage.getByRole("navigation", { name: "เมนูของร้าน" });
  await expect(nav.getByRole("link", { name: "ข้อมูลร้าน" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "บทบาทและสิทธิ์" })).toHaveCount(0);

  await staffPage.goto(`/o/${orgId}/settings/roles`);
  await expect(
    staffPage.getByRole("heading", { name: "หน้านี้สำหรับคนที่จัดการบทบาทได้" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(staffPage.getByRole("button", { name: "กลับไปหน้าข้อมูลร้าน" })).toBeVisible();
});
