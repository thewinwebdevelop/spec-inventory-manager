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
  reopenMembers,
  resetIpThrottle,
  ROLE_WRITES_ON,
  shopNav,
  signUpAndLogin,
} from "./helpers";
import { expectResponsive } from "./responsive";

/**
 * EW3 (R4 / R5) — T-003-W08 + T-003-W09 against the REAL server
 * (`ROLE_WRITES_ENABLED=true`). Every reason below is produced by the server
 * from a shop arranged here — nothing is routed or faked.
 *
 * Use cases (each at chromium 1280 + tablet 768):
 *  - R4 · role_locked: the Owner opens "เจ้าของร้าน" → Badge "ล็อก", the
 *    locked banner, the single full_access card; no clone, no delete, no
 *    "การจัดการอื่น".
 *  - R4 · exceeds_your_permissions (EW3-03): an Admin opens a role holding
 *    manage_billing → its banner, a read LIST (✓ / "ไม่ได้ให้", no checkbox),
 *    no clone, no delete.
 *  - R4 · equal_permissions_in_use (EW3-04): two Admins — "ผู้ดูแล" is
 *    read-only for one of them, with the clone button INSIDE the banner, and
 *    it really clones.
 *  - R4 · in_use_requires_manage_members (EW3-05): a viewer with manage_roles
 *    but not manage_members opens a role somebody else holds → that banner +
 *    clone; and on a role held only by an open invitation, R5 (ข) shows no
 *    links to R6 but the "คนที่จัดการสมาชิกได้…" line.
 *  - R5 (ก): delete a free role — "ไม่ลบ" and Escape send NOTHING; "ลบบทบาท"
 *    sends ONE DELETE → R1 + toast, the row is gone.
 *  - R5 (ข) (EW3-07): a role in use by members → the delete button is disabled
 *    with the counts under it, and "ดูสมาชิกที่ใช้บทบาทนี้ (n)" opens R6
 *    filtered by that role; same for a role held only by an open invitation
 *    ("ดูคำเชิญที่ใช้บทบาทนี้ (m)").
 *  - R5 · 409 ROLE_IN_USE race: the dialog is open, somebody invites into the
 *    role in another tab, confirm → the dialog turns into (ข) with the
 *    server's numbers.
 *
 * Not here (unit-tested in RoleReadOnlyDelete.test.tsx — the shared :3000 runs
 * with writes ON and a 500-deletion history ceiling): writes_disabled on R4,
 * history_limit_reached / ROLE_HISTORY_LIMIT_REACHED.
 *
 * Screenshots (D-038 ③) only when `W0809_SHOTS_DIR` is set, from the chromium
 * project, at 1280 / 768 / 390.
 */
test.describe.configure({ mode: "serial" });
test.skip(!ROLE_WRITES_ON, "needs a server with ROLE_WRITES_ENABLED=true (E2E_ROLE_WRITES=on)");

let ownerPage: Page;
let adminAPage: Page;
let adminBPage: Page;
let orgId = "";
const adminAEmail = freshEmail("w08-admin-a");
const adminBEmail = freshEmail("w08-admin-b");
const pendingEmail = freshEmail("w09-pending");
const raceEmail = freshEmail("w09-race");
const ROLE_PATH = /\/orgs\/[^/]+\/roles\/[^/?]+$/;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = process.env.W0809_SHOTS_DIR;
  if (!dir || test.info().project.name !== "chromium") return;
  const original = page.viewportSize()!;
  for (const [w, h] of [
    [1280, 800],
    [768, 1024],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${dir}/${name}-${w}.png`, fullPage: !/dialog/.test(name) });
  }
  await page.setViewportSize(original);
  await page.waitForTimeout(250);
}

/** Every DELETE to a role this page sends from now on. */
function countDeletes(page: Page): Request[] {
  const out: Request[] = [];
  page.on("request", (r) => {
    if (r.method() === "DELETE" && ROLE_PATH.test(r.url())) out.push(r);
  });
  return out;
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
  await expect(page.getByRole("heading", { level: 2, name: "สิทธิ์ของบทบาทนี้" })).toBeVisible({
    timeout: 20_000,
  });
}

async function createRole(page: Page, name: string, labels: string[]): Promise<void> {
  await openRoles(page);
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

async function joinAs(page: Page, email: string, link: string): Promise<void> {
  await resetIpThrottle();
  await signUpAndLogin(page, email);
  await acceptInvite(page, link);
  await page.getByRole("link", { name: "เริ่มใช้งานร้านนี้" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${orgId}`), { timeout: 20_000 });
}

const inUsePanel = (page: Page) =>
  page.getByRole("group", { name: "ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่" });
const deleteButton = (page: Page) => page.getByRole("button", { name: "ลบบทบาทนี้" });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  await resetIpThrottle();
  ownerPage = await browser.newContext().then((c) => c.newPage());
  adminAPage = await browser.newContext().then((c) => c.newPage());
  adminBPage = await browser.newContext().then((c) => c.newPage());
  await login(ownerPage, readShared().email);
  orgId = await createShop(ownerPage, `ร้านดูและลบบทบาท ${Date.now()}`);

  await createRole(ownerPage, "บัญชีภายนอก", ["จัดการแพ็กเกจและการชำระเงิน"]);
  await createRole(ownerPage, "ชั่วคราว", ["จัดการสต๊อก"]);
  await createRole(ownerPage, "รอเชิญ", ["จัดการสต๊อก"]);
  await createRole(ownerPage, "แข่งลบ", ["จัดการสต๊อก"]);
  await createRole(ownerPage, "นับสต๊อก", ["จัดการสต๊อก"]);
  await createRole(ownerPage, "ออกแบบบทบาท", ["จัดการบทบาทและสิทธิ์", "จัดการสต๊อก"]);

  // Two Admins (equal_permissions_in_use) + one open invitation into "รอเชิญ".
  await openMembers(ownerPage, orgId);
  const linkA = await inviteAndClose(ownerPage, adminAEmail, "ผู้ดูแล");
  const linkB = await inviteAndClose(ownerPage, adminBEmail, "ผู้ดูแล");
  await inviteAndClose(ownerPage, pendingEmail, "รอเชิญ");
  await joinAs(adminAPage, adminAEmail, linkA);
  await joinAs(adminBPage, adminBEmail, linkB);
});

test.afterAll(async () => {
  await ownerPage.close();
  await adminAPage.close();
  await adminBPage.close();
});

test("R4 · role_locked: the Owner role — Badge 'ล็อก', locked banner, one full_access card, no clone/delete", async () => {
  const page = ownerPage;
  await openRole(page, /^เจ้าของร้าน/);
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toContainText("เจ้าของร้าน");
  await expect(h1.getByText("ล็อก", { exact: true })).toBeVisible();
  const banner = page.getByRole("status").filter({ hasText: "บทบาทเจ้าของร้านถูกล็อกไว้" });
  await expect(banner).toBeVisible();
  await expect(page.getByText("ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "ชื่อบทบาท" })).toHaveCount(0);
  await expect(page.getByText("ทำสำเนาเป็นบทบาทใหม่")).toHaveCount(0);
  await expect(deleteButton(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "การจัดการอื่น" })).toHaveCount(0);
  await expectResponsive(page, "R4 Owner");
  await shoot(page, "w08-owner-role-locked");
});

test("R4 · exceeds_your_permissions (EW3-03): an Admin opens a role with manage_billing — a read list, no clone/delete", async () => {
  const page = adminAPage;
  await openRole(page, /^บัญชีภายนอก/);
  await expect(
    page.getByRole("status").filter({ hasText: "ดูได้อย่างเดียว — บทบาทนี้มีสิทธิ์ที่คุณไม่มี" }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "ชื่อบทบาท" })).toHaveCount(0);
  const granted = page.getByRole("listitem").filter({ hasText: "จัดการแพ็กเกจและการชำระเงิน" });
  await expect(granted).not.toContainText("ไม่ได้ให้");
  await expect(granted).toContainText("เร็ว ๆ นี้");
  await expect(page.getByRole("listitem").filter({ hasText: "จัดการสต๊อก" })).toContainText(
    "ไม่ได้ให้",
  );
  await expect(page.getByText("ทำสำเนาเป็นบทบาทใหม่")).toHaveCount(0);
  await expect(deleteButton(page)).toHaveCount(0);
  await expectResponsive(page, "R4 exceeds");
  await shoot(page, "w08-exceeds-your-permissions");
});

test("R4 · equal_permissions_in_use (EW3-04): 'ผู้ดูแล' is read-only for an Admin; clone sits in the banner and clones", async () => {
  const page = adminAPage;
  await openRole(page, /^ผู้ดูแล/);
  const banner = page
    .getByRole("status")
    .filter({ hasText: "ดูได้อย่างเดียว — มีคนที่สิทธิ์เท่าคุณใช้บทบาทนี้อยู่" });
  await expect(banner).toBeVisible();
  await expect(page.getByText("สมาชิก 2 คน (รวมคุณ)")).toBeVisible();
  await expect(deleteButton(page)).toHaveCount(0);
  await expectResponsive(page, "R4 equal");
  await shoot(page, "w08-equal-permissions-in-use");

  await banner.getByRole("link", { name: "ทำสำเนาเป็นบทบาทใหม่" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${orgId}/settings/roles/new\\?from=`));
  await expect(page.getByRole("textbox", { name: "ชื่อบทบาท" })).toHaveValue("สำเนาของ ผู้ดูแล");
  // Nothing typed — leaving does not prompt.
  await page.getByRole("button", { name: "ยกเลิก" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${orgId}/settings/roles$`));
});

test("R5 (ก) · delete a free role: 'ไม่ลบ' and Escape send nothing; 'ลบบทบาท' sends ONE DELETE → R1 + toast", async () => {
  const page = ownerPage;
  const deletes = countDeletes(page);
  await openRole(page, /^ชั่วคราว/);
  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: "การจัดการอื่น" }),
  });
  await expect(section.getByRole("button", { name: "ลบบทบาทนี้" })).toBeEnabled();

  await deleteButton(page).click();
  const dialog = page.getByRole("alertdialog", { name: 'ลบบทบาท "ชั่วคราว"?' });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(
      "ลบแล้วเอาคืนไม่ได้ ถ้าต้องใช้อีกต้องสร้างใหม่ ประวัติเดิม (สมาชิกที่ถูกถอด คำเชิญเก่า) ยังแสดงชื่อบทบาทนี้ได้ตามเดิม",
    ),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "ไม่ลบ" })).toBeFocused();
  await expectResponsive(page, "R5 confirm");
  await shoot(page, "w09-confirm-dialog");

  await dialog.getByRole("button", { name: "ไม่ลบ" }).click();
  await expect(dialog).toHaveCount(0);
  await deleteButton(page).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(deletes).toHaveLength(0);

  await deleteButton(page).click();
  await dialog.getByRole("button", { name: "ลบบทบาท" }).click();
  await expect(page.getByText('ลบบทบาท "ชั่วคราว" แล้ว')).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(new RegExp(`/o/${orgId}/settings/roles$`));
  await expect(page.getByText(/^ใช้ไป \d+ จาก/)).toBeVisible();
  await expect(page.getByRole("link", { name: /^ชั่วคราว/ })).toHaveCount(0);
  expect(deletes).toHaveLength(1);
});

test("R5 (ข) · EW3-07: a role in use by members — delete disabled, counts under it, link opens R6 filtered by the role", async () => {
  const page = ownerPage;
  await openRole(page, /^ผู้ดูแล/);
  await expect(deleteButton(page)).toBeDisabled();
  const panel = inUsePanel(page);
  await expect(panel.getByText("ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่")).toBeVisible();
  await expect(panel.getByText("สมาชิก 2 คน", { exact: true })).toBeVisible();
  await expect(
    panel.getByText("ย้ายสมาชิกไปบทบาทอื่นและยกเลิกคำเชิญเหล่านี้ก่อน แล้วค่อยลบ"),
  ).toBeVisible();
  await expect(panel.getByRole("link", { name: /ดูคำเชิญ/ })).toHaveCount(0);
  await expectResponsive(page, "R5 in use (members)");
  await shoot(page, "w09-in-use-members");

  await panel.getByRole("link", { name: "ดูสมาชิกที่ใช้บทบาทนี้ (2)" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${orgId}/settings/members\\?roleId=`));
  await expect(page.getByText('กำลังแสดงเฉพาะคนที่ใช้บทบาท "ผู้ดูแล"')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: "สมาชิกที่ใช้บทบาทนี้ (2)" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("li", { hasText: adminAEmail })).toBeVisible();
  await expect(page.locator("li", { hasText: adminBEmail })).toBeVisible();
  await shoot(page, "w09-r6-members");
});

test("R5 (ข) · a role held only by an open invitation — 'ดูคำเชิญที่ใช้บทบาทนี้ (1)' opens R6's invitation section", async () => {
  const page = ownerPage;
  await openRole(page, /^รอเชิญ/);
  // R3 (the Owner may edit it) — the delete control sits in "การจัดการอื่น".
  await expect(page.getByRole("textbox", { name: "ชื่อบทบาท" })).toBeVisible();
  await expect(deleteButton(page)).toBeDisabled();
  const panel = inUsePanel(page);
  await expect(panel.getByText("คำเชิญที่ยังไม่ปิด 1 ใบ", { exact: true })).toBeVisible();
  await expect(panel.getByRole("link", { name: /ดูสมาชิก/ })).toHaveCount(0);
  await expectResponsive(page, "R5 in use (invitation)");
  await panel.getByRole("link", { name: "ดูคำเชิญที่ใช้บทบาทนี้ (1)" }).click();
  await expect(page).toHaveURL(/\/settings\/members\?roleId=[^#]+#role-invitations$/);
  await expect(page.getByRole("heading", { name: "คำเชิญที่ใช้บทบาทนี้ (1)" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("li", { hasText: pendingEmail })).toBeVisible();
});

test("R5 · 409 ROLE_IN_USE race: an invitation lands while the dialog is open → (ข) with the server's numbers", async () => {
  const page = ownerPage;
  const deletes = countDeletes(page);
  await openRole(page, /^แข่งลบ/);
  await deleteButton(page).click();
  const confirm = page.getByRole("alertdialog", { name: 'ลบบทบาท "แข่งลบ"?' });
  await expect(confirm).toBeVisible();

  // Meanwhile, another tab of the same Owner invites somebody into the role.
  await resetIpThrottle();
  const other = await page.context().newPage();
  try {
    await other.goto(`/o/${orgId}/settings/members`);
    await expect(other.getByRole("heading", { name: "สมาชิก", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await inviteAndClose(other, raceEmail, "แข่งลบ");
  } finally {
    await other.close();
  }

  await confirm.getByRole("button", { name: "ลบบทบาท" }).click();
  const inUse = page.getByRole("alertdialog", { name: "ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่" });
  await expect(inUse).toBeVisible({ timeout: 20_000 });
  await expect(inUse.getByText("คำเชิญที่ยังไม่ปิด 1 ใบ", { exact: true })).toBeVisible();
  await expect(inUse.getByRole("link", { name: "ดูคำเชิญที่ใช้บทบาทนี้ (1)" })).toBeVisible();
  await expect(inUse.getByRole("button", { name: "ลบบทบาท" })).toHaveCount(0);
  await expectResponsive(page, "R5 in-use dialog");
  await shoot(page, "w09-in-use-dialog");
  await inUse.getByRole("button", { name: "ปิด" }).click();
  await expect(inUse).toHaveCount(0);
  // The role was re-read: the page now says it too, and the button is closed.
  await expect(deleteButton(page)).toBeDisabled();
  await expect(inUsePanel(page)).toBeVisible();
  expect(deletes).toHaveLength(1);
  await expect(page).toHaveURL(/\/settings\/roles\/[^/]+$/);
});

test("R4 · in_use_requires_manage_members (EW3-05) + R5 (ข) for a viewer without manage_members: no links, the 'คนที่จัดการสมาชิกได้…' line", async () => {
  // Owner: Admin B → "นับสต๊อก", Admin A → "ออกแบบบทบาท" (manage_roles + manage_stock).
  await reopenMembers(ownerPage, orgId);
  for (const [email, roleName] of [
    [adminBEmail, "นับสต๊อก"],
    [adminAEmail, "ออกแบบบทบาท"],
  ] as const) {
    const row = ownerPage.locator("li", { hasText: email });
    await row.getByRole("button", { name: "เปลี่ยนบทบาท" }).click();
    const change = ownerPage.getByRole("dialog", { name: /เปลี่ยนบทบาทของ/ });
    await change.getByRole("radio", { name: roleName }).check();
    await change.getByRole("button", { name: "บันทึกบทบาท" }).click();
    await expect(change).toBeHidden({ timeout: 20_000 });
  }

  // Admin A re-reads who they are (a full load) and opens a role B holds.
  const page = adminAPage;
  await resetIpThrottle();
  await page.goto(`/o/${orgId}/settings/roles`);
  await expect(page.getByText(/^ใช้ไป \d+ จาก/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: /^นับสต๊อก/ }).click();
  const banner = page
    .getByRole("status")
    .filter({ hasText: "ดูได้อย่างเดียว — มีสมาชิกคนอื่นใช้บทบาทนี้อยู่" });
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(banner.getByRole("link", { name: "ทำสำเนาเป็นบทบาทใหม่" })).toBeVisible();
  await expect(deleteButton(page)).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "ชื่อบทบาท" })).toHaveCount(0);
  await expectResponsive(page, "R4 needs manage_members");
  await shoot(page, "w08-in-use-requires-manage-members");

  // "รอเชิญ": editable for A (⊆ A, no other active holder), delete blocked by the invitation.
  await openRole(page, /^รอเชิญ/);
  await expect(page.getByRole("textbox", { name: "ชื่อบทบาท" })).toBeVisible();
  await expect(deleteButton(page)).toBeDisabled();
  const panel = inUsePanel(page);
  await expect(panel.getByText("คำเชิญที่ยังไม่ปิด 1 ใบ", { exact: true })).toBeVisible();
  await expect(panel.getByRole("link")).toHaveCount(0);
  await expect(
    panel.getByText("คนที่จัดการสมาชิกได้ (เช่น เจ้าของร้าน) ต้องเป็นคนย้ายสมาชิกหรือยกเลิกคำเชิญ"),
  ).toBeVisible();
  await expectResponsive(page, "R5 in use, no manage_members");
  await shoot(page, "w09-in-use-no-manage-members");
});
