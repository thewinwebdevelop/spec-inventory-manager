import { type Locator, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  acceptInvite,
  createShop,
  freshEmail,
  invite,
  openMembers,
  reopenMembers,
  resetIpThrottle,
  ROLE_WRITES_ON,
  shopNav,
  signUpAndLogin,
} from "./helpers";
import { expectResponsive } from "./responsive";

/**
 * EW3-04 / EW3-07 — R7 and R6 on web (T-003-QA08), against the REAL server
 * (`ROLE_WRITES_ENABLED=true`). Every verdict and every number below comes from
 * the server for a shop arranged here; nothing is routed or faked.
 *
 * What e23 already proves and this file does NOT repeat: R4 for an Admin on
 * "ผู้ดูแล" (equal_permissions_in_use + clone in the banner — the role half of
 * EW3-04), R5 (ข) for a role held only by members (2 Admins) and only by an
 * invitation, and the 409 ROLE_IN_USE race.
 *
 * Here (each at chromium 1280 + tablet 768):
 *  - EW3-04 (R7, the member-row half · AC-5.4b client side): an Admin on the
 *    members screen — the other Admin's row has NO change-role / remove (and no
 *    reset — not a web action in F-003) and says why; the Owner's row says why;
 *    a Staff row still has both (control); an invitation into a role with a
 *    capability the Admin lacks has no reissue / cancel + its reason, while a
 *    Staff invitation keeps both (control).
 *  - EW3-07 (R5 → R6): the Owner opens "พนักงาน", held by a member AND an open
 *    invitation — delete disabled, both counts, both links; each link lands on
 *    R6 narrowed to that role (banner, both sections, nobody else's rows), and
 *    "กลับไปที่บทบาท" goes back.
 *  - R6 drained: on R6 the Owner moves the member out and cancels the
 *    invitation → each section's empty line, then the "nobody left" banner,
 *    whose button leads to a role whose delete is now enabled. "แสดงทั้งหมด"
 *    clears the filter.
 *  - R6 with a roleId the shop does not have (unknown, and another shop's real
 *    role — golden rule 3 at the screen): the "บทบาทที่เลือก" banner, no way back
 *    to a role, and none of the other shop's people.
 */
test.describe.configure({ mode: "serial" });
test.skip(!ROLE_WRITES_ON, "needs a server with ROLE_WRITES_ENABLED=true (E2E_ROLE_WRITES=on)");

let ownerPage: Page;
let adminAPage: Page;
let orgId = "";
let otherShopRoleId = "";
const ownerEmail = freshEmail("qa08-owner");
const adminAEmail = freshEmail("qa08-admin-a");
const adminBEmail = freshEmail("qa08-admin-b");
const staffEmail = freshEmail("qa08-staff");
const staffInviteEmail = freshEmail("qa08-staff-inv");
const billingInviteEmail = freshEmail("qa08-billing-inv");
const otherShopStaffEmail = freshEmail("qa08-other-staff");

const EQUAL = "คนนี้มีสิทธิ์เท่ากับคุณ — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก";
const OWNER_ONLY = "เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนบทบาทหรือถอดเจ้าของร้านคนอื่นได้";
const INVITE_EXCEEDS =
  "คำเชิญนี้ให้บทบาทที่มีสิทธิ์ที่คุณไม่มี — ให้เจ้าของร้านยกเลิกหรือออกลิงก์ใหม่";

const row = (page: Page, email: string): Locator => page.locator("li", { hasText: email });

async function createRole(page: Page, name: string, labels: string[]): Promise<void> {
  const nav = await shopNav(page);
  await nav.getByRole("link", { name: "บทบาทและสิทธิ์" }).click();
  await expect(page.getByText(/^ใช้ไป \d+ จาก/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "สร้างบทบาท" }).click();
  const dialog = page.getByRole("dialog", { name: "สร้างบทบาทใหม่" });
  await dialog.getByRole("radio", { name: /^เริ่มจากว่าง/ }).check();
  await dialog.getByRole("button", { name: "ถัดไป" }).click();
  await page.getByRole("textbox", { name: "ชื่อบทบาท" }).fill(name);
  for (const label of labels) {
    await page.getByRole("checkbox", { name: new RegExp(`^${label}`) }).click();
  }
  await page.getByRole("button", { name: "สร้างบทบาท" }).click();
  await expect(page.getByText(`สร้างบทบาท "${name}" แล้ว`)).toBeVisible({ timeout: 20_000 });
}

async function inviteAndClose(page: Page, email: string, roleName: string): Promise<string> {
  const link = await invite(page, email, roleName);
  await page
    .getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" })
    .getByRole("button", { name: "เสร็จแล้ว" })
    .click();
  return link;
}

async function joinAs(page: Page, email: string, link: string, shop: string): Promise<void> {
  await resetIpThrottle();
  await signUpAndLogin(page, email);
  await acceptInvite(page, link);
  await page.getByRole("link", { name: "เริ่มใช้งานร้านนี้" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${shop}`), { timeout: 20_000 });
}

async function openRole(page: Page, name: RegExp): Promise<void> {
  const nav = await shopNav(page);
  await nav.getByRole("link", { name: "บทบาทและสิทธิ์" }).click();
  await expect(page.getByText(/^ใช้ไป \d+ จาก/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 2, name: "สิทธิ์ของบทบาทนี้" })).toBeVisible({
    timeout: 20_000,
  });
}

const inUsePanel = (page: Page) =>
  page.getByRole("group", { name: "ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่" });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(420_000);
  await resetIpThrottle();
  ownerPage = await browser.newContext().then((c) => c.newPage());
  adminAPage = await browser.newContext().then((c) => c.newPage());
  const adminBPage = await browser.newContext().then((c) => c.newPage());
  const staffPage = await browser.newContext().then((c) => c.newPage());
  const otherStaffPage = await browser.newContext().then((c) => c.newPage());

  // A fresh Owner (not the shared one): this file creates two shops.
  await signUpAndLogin(ownerPage, ownerEmail);
  // Shop B first — a REAL role id that belongs to another shop, held by somebody.
  const otherShop = await createShop(ownerPage, `ร้านอื่น ${Date.now()}`);
  await openMembers(ownerPage, otherShop);
  const otherLink = await inviteAndClose(ownerPage, otherShopStaffEmail, "พนักงาน");
  await joinAs(otherStaffPage, otherShopStaffEmail, otherLink, otherShop);
  await openRole(ownerPage, /^พนักงาน/);
  otherShopRoleId = /\/roles\/([^/?#]+)/.exec(ownerPage.url())![1]!;

  await ownerPage.goto("/orgs/new");
  orgId = await createShop(ownerPage, `ร้านสมาชิกตามบทบาท ${Date.now()}`);
  await createRole(ownerPage, "บัญชีภายนอก", ["จัดการแพ็กเกจและการชำระเงิน"]);
  await createRole(ownerPage, "ย้ายไป", ["จัดการสต๊อก"]);
  await openMembers(ownerPage, orgId);
  const linkA = await inviteAndClose(ownerPage, adminAEmail, "ผู้ดูแล");
  const linkB = await inviteAndClose(ownerPage, adminBEmail, "ผู้ดูแล");
  const linkS = await inviteAndClose(ownerPage, staffEmail, "พนักงาน");
  await inviteAndClose(ownerPage, staffInviteEmail, "พนักงาน");
  await inviteAndClose(ownerPage, billingInviteEmail, "บัญชีภายนอก");
  await joinAs(adminAPage, adminAEmail, linkA, orgId);
  await joinAs(adminBPage, adminBEmail, linkB, orgId);
  await joinAs(staffPage, staffEmail, linkS, orgId);
  for (const p of [adminBPage, staffPage, otherStaffPage]) await p.context().close();
});

test.afterAll(async () => {
  await ownerPage?.context().close();
  await adminAPage?.context().close();
});

test("EW3-04 · R7: an Admin sees the other Admin's and the Owner's rows with a reason and no action; a Staff row keeps both", async () => {
  const page = adminAPage;
  await reopenMembers(page, orgId);
  await expect(row(page, adminBEmail)).toBeVisible({ timeout: 20_000 });

  for (const [email, reason] of [
    [adminBEmail, EQUAL],
    [ownerEmail, OWNER_ONLY],
  ] as const) {
    const r = row(page, email);
    await expect(r.getByText(reason)).toBeVisible();
    await expect(r.getByRole("button")).toHaveCount(0); // no change-role, no remove, no reset
  }
  // Control — the server said yes for a Staff member below the Admin.
  const staff = row(page, staffEmail);
  await expect(staff.getByRole("button", { name: "เปลี่ยนบทบาท" })).toBeEnabled();
  await expect(staff.getByRole("button", { name: "ถอดออกจากร้าน" })).toBeEnabled();
  await expect(staff.getByText(EQUAL)).toHaveCount(0);
  // The Admin's own row: leave is still there (D-029).
  await expect(row(page, adminAEmail).getByRole("button", { name: "ออกจากร้านนี้" })).toBeVisible();
  // No reset-password action anywhere on web in F-003.
  await expect(page.getByRole("button", { name: /รีเซ็ต/ })).toHaveCount(0);

  // Invitation rows (R7): a role with manage_billing is closed to the Admin; Staff's is not.
  const billing = row(page, billingInviteEmail);
  await expect(billing.getByText(INVITE_EXCEEDS)).toBeVisible();
  await expect(billing.getByRole("button", { name: "ออกลิงก์ใหม่" })).toHaveCount(0);
  await expect(billing.getByRole("button", { name: "ยกเลิกคำเชิญ" })).toHaveCount(0);
  const staffInvite = row(page, staffInviteEmail);
  await expect(staffInvite.getByRole("button", { name: "ออกลิงก์ใหม่" })).toBeVisible();
  await expect(staffInvite.getByRole("button", { name: "ยกเลิกคำเชิญ" })).toBeVisible();
  await expect(staffInvite.getByText(INVITE_EXCEEDS)).toHaveCount(0);
  await expectResponsive(page, "R7 members (Admin)");
});

test("EW3-07 · 'พนักงาน' held by a member AND an invitation: both counts, both links → R6 narrowed to the role, and back", async () => {
  const page = ownerPage;
  await openRole(page, /^พนักงาน/);
  const roleUrl = page.url();
  await expect(page.getByRole("button", { name: "ลบบทบาทนี้" })).toBeDisabled();
  const panel = inUsePanel(page);
  // One line, both numbers (ux R5 ข) — from the server's usage.
  await expect(
    panel.getByText("สมาชิก 1 คน · คำเชิญที่ยังไม่ปิด 1 ใบ", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole("link")).toHaveCount(2);
  await expectResponsive(page, "R5 in use (members + invitation)");

  await panel.getByRole("link", { name: "ดูสมาชิกที่ใช้บทบาทนี้ (1)" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${orgId}/settings/members\\?roleId=`));
  await expect(page.getByText('กำลังแสดงเฉพาะคนที่ใช้บทบาท "พนักงาน"')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: "สมาชิกที่ใช้บทบาทนี้ (1)" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: "คำเชิญที่ใช้บทบาทนี้ (1)" })).toBeVisible();
  await expect(row(page, staffEmail)).toBeVisible();
  await expect(row(page, staffInviteEmail)).toBeVisible();
  // Nobody of another role — the Owner, the Admins, the billing invitation.
  for (const email of [ownerEmail, adminAEmail, adminBEmail, billingInviteEmail]) {
    await expect(row(page, email)).toHaveCount(0);
  }
  await expectResponsive(page, "R6 (members + invitation)");

  await page.getByRole("button", { name: 'กลับไปที่บทบาท "พนักงาน"' }).click();
  await expect(page).toHaveURL(roleUrl);
  await inUsePanel(page).getByRole("link", { name: "ดูคำเชิญที่ใช้บทบาทนี้ (1)" }).click();
  await expect(page).toHaveURL(/\/settings\/members\?roleId=[^#]+#role-invitations$/);
  await expect(row(page, staffInviteEmail)).toBeVisible({ timeout: 20_000 });
});

test("R6 drained: move the member out, cancel the invitation → empty lines, 'nobody left' banner → the role can be deleted; 'แสดงทั้งหมด' clears", async () => {
  const page = ownerPage;
  await openRole(page, /^พนักงาน/);
  await inUsePanel(page).getByRole("link", { name: "ดูสมาชิกที่ใช้บทบาทนี้ (1)" }).click();
  await expect(page.getByRole("heading", { name: "สมาชิกที่ใช้บทบาทนี้ (1)" })).toBeVisible({
    timeout: 20_000,
  });
  await row(page, staffEmail).getByRole("button", { name: "เปลี่ยนบทบาท" }).click();
  const change = page.getByRole("dialog", { name: /เปลี่ยนบทบาทของ/ });
  await change.getByRole("radio", { name: "ย้ายไป" }).check();
  await change.getByRole("button", { name: "บันทึกบทบาท" }).click();
  await expect(change).toBeHidden({ timeout: 20_000 });
  await expect(row(page, staffEmail)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByText("ไม่มีสมาชิกที่ใช้บทบาทนี้แล้ว")).toBeVisible();
  await expect(page.getByText("ไม่มีใครใช้บทบาทนี้แล้ว — กลับไปลบบทบาทได้เลย")).toHaveCount(0);

  await row(page, staffInviteEmail).getByRole("button", { name: "ยกเลิกคำเชิญ" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(staffInviteEmail);
  await confirm.getByRole("button", { name: "ยกเลิกคำเชิญ" }).click();
  await expect(page.getByText("ยกเลิกคำเชิญแล้ว")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("ไม่มีคำเชิญที่ใช้บทบาทนี้แล้ว")).toBeVisible({ timeout: 20_000 });
  const nobody = page.getByText("ไม่มีใครใช้บทบาทนี้แล้ว — กลับไปลบบทบาทได้เลย");
  await expect(nobody).toBeVisible();
  await expectResponsive(page, "R6 drained");

  // The success banner's own way back (two identical buttons: info + success banner).
  await page.getByRole("button", { name: 'กลับไปที่บทบาท "พนักงาน"' }).last().click();
  await expect(page).toHaveURL(/\/settings\/roles\/[^/?#]+$/);
  await expect(page.getByRole("button", { name: "ลบบทบาทนี้" })).toBeEnabled({ timeout: 20_000 });
  await expect(inUsePanel(page)).toHaveCount(0);

  // Browser back → still R6, still drained; "แสดงทั้งหมด" drops the filter and everyone is back.
  await page.goBack();
  await expect(nobody).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "แสดงทั้งหมด" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${orgId}/settings/members$`));
  await expect(row(page, adminAEmail)).toBeVisible({ timeout: 20_000 });
  await expect(row(page, staffEmail)).toBeVisible();
  await expect(page.getByText(/กำลังแสดงเฉพาะคนที่ใช้บทบาท/)).toHaveCount(0);
});

test("R6 with a roleId this shop does not have — unknown, or another shop's real role: generic banner, no way back, nobody shown", async () => {
  const page = ownerPage;
  for (const roleId of ["qa08-no-such-role", otherShopRoleId]) {
    await resetIpThrottle();
    await page.goto(`/o/${orgId}/settings/members?roleId=${encodeURIComponent(roleId)}`);
    await expect(page.getByText("กำลังแสดงเฉพาะคนที่ใช้บทบาทที่เลือก")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "สมาชิกที่ใช้บทบาทนี้ (0)" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "คำเชิญที่ใช้บทบาทนี้ (0)" })).toBeVisible();
    // The LOADED empty state (rendered only once every page is read) — the "(0)"
    // headings alone are also what the screen shows while it is still loading.
    await expect(page.getByText("ไม่มีสมาชิกที่ใช้บทบาทนี้แล้ว")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("ไม่มีคำเชิญที่ใช้บทบาทนี้แล้ว")).toBeVisible();
    for (const email of [ownerEmail, adminAEmail, adminBEmail, billingInviteEmail]) {
      await expect(row(page, email)).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: /^กลับไปที่บทบาท/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "แสดงทั้งหมด" })).toBeVisible();
    // Golden rule 3 at the screen: the other shop's member is nowhere on it.
    await expect(row(page, otherShopStaffEmail)).toHaveCount(0);
    await expect(page.getByText(otherShopStaffEmail)).toHaveCount(0);
  }
  await expectResponsive(page, "R6 unknown role");
});
