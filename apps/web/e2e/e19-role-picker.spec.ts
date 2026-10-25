import { expect, test, type Page } from "@playwright/test";
import {
  acceptInvite,
  createShop,
  freshEmail,
  invite,
  login,
  openMembers,
  readShared,
  reopenMembers,
  resetIpThrottle,
  signUpAndLogin,
} from "./helpers";

/**
 * EW3 (R8 + R9) - T-003-W11.
 *
 * R8: an Admin opens the invite dialog. The Owner role is SHOWN and DISABLED
 * with the server's reason (`viewerCanAssign=false`, `owner_only`), the other
 * system roles are enabled - nothing is filtered out.
 *
 * R9 (D-035): an invitation issued by the Admin is accepted AFTER the Owner
 * demoted that Admin. The inviter re-check cancels it server-side, and the
 * invitee sees the one copy shared with a shop-cancelled invitation - the
 * reason is never named.
 *
 * `ROLE_WRITES_ENABLED` is irrelevant here: invite and change-role are
 * F-002 routes.
 */
test.describe.configure({ mode: "serial" });

let ownerPage: Page;
let adminPage: Page;
let inviteePage: Page;
let orgId = "";
const adminEmail = freshEmail("picker-admin");
const inviteeEmail = freshEmail("picker-invitee");

test.beforeAll(async ({ browser }) => {
  await resetIpThrottle();
  ownerPage = await browser.newContext().then((c) => c.newPage());
  adminPage = await browser.newContext().then((c) => c.newPage());
  inviteePage = await browser.newContext().then((c) => c.newPage());
  await login(ownerPage, readShared().email);
  orgId = await createShop(ownerPage, `ร้านตัวเลือก ${Date.now()}`);
  await signUpAndLogin(adminPage, adminEmail);
  await signUpAndLogin(inviteePage, inviteeEmail);
});

test.afterAll(async () => {
  await ownerPage.close();
  await adminPage.close();
  await inviteePage.close();
});

test("EW3 R8 - an Admin sees the Owner role disabled WITH the reason, not hidden", async () => {
  await openMembers(ownerPage, orgId);
  const link = await invite(ownerPage, adminEmail, "ผู้ดูแล");
  await ownerPage
    .getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" })
    .getByRole("button", { name: "เสร็จแล้ว" })
    .click();
  await acceptInvite(adminPage, link);
  await expect(adminPage.getByRole("link", { name: "เริ่มใช้งานร้านนี้" })).toBeVisible({
    timeout: 20_000,
  });
  await adminPage.getByRole("link", { name: "เริ่มใช้งานร้านนี้" }).click();
  await openMembers(adminPage, orgId);

  await adminPage.getByRole("button", { name: "เชิญสมาชิก" }).first().click();
  const dialog = adminPage.getByRole("dialog", { name: "เชิญสมาชิก" });
  await expect(dialog.getByRole("radio", { name: "เจ้าของร้าน" })).toBeDisabled();
  await expect(
    dialog.getByText("เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้"),
  ).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "พนักงาน" })).toBeEnabled();
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();
});

test("EW3 R9 - accepting after the inviter lost standing shows the cancelled state, with no reason", async () => {
  // The Admin issues a link to the invitee...
  const link = await invite(adminPage, inviteeEmail, "พนักงาน");
  await adminPage
    .getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" })
    .getByRole("button", { name: "เสร็จแล้ว" })
    .click();

  // ...then the Owner demotes that Admin to Staff.
  await reopenMembers(ownerPage, orgId);
  const row = ownerPage.locator("li", { hasText: adminEmail });
  await row.getByRole("button", { name: "เปลี่ยนบทบาท" }).click();
  const change = ownerPage.getByRole("dialog", { name: /เปลี่ยนบทบาทของ/ });
  await change.getByRole("radio", { name: "พนักงาน" }).check();
  await change.getByRole("button", { name: "บันทึกบทบาท" }).click();
  await expect(change).toBeHidden({ timeout: 20_000 });

  // The invitee accepts: B19 answers 409 INVITATION_CANCELLED.
  await acceptInvite(inviteePage, link);
  await expect(inviteePage.getByRole("heading", { name: "คำเชิญนี้ถูกยกเลิกแล้ว" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    inviteePage.getByText("ถ้าคุณยังต้องการเข้าร่วม ให้ขอลิงก์คำเชิญใหม่จากเจ้าของร้าน"),
  ).toBeVisible();
  await expect(inviteePage.getByText(/ผู้เชิญ|สิทธิ์|ขออภัย/)).toHaveCount(0);
  await expect(inviteePage.getByRole("button", { name: /กลับหน้าแรก/ })).toBeVisible();
});
