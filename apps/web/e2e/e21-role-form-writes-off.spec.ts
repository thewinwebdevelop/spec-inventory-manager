import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { createShop, login, readShared, resetIpThrottle, ROLE_WRITES_ON, shopNav } from "./helpers";
import { expectResponsive } from "./responsive";

/**
 * EW3-09 (R3 half) — T-003-W06: with `ROLE_WRITES_ENABLED` OFF (the default),
 * every write on R3 is disabled by ONE reason, `writes_disabled`, shown once at
 * the top (ux §0.3 (ก)) — the server's verdict, never a client guess.
 *
 *  - `/roles/new`: banner on top, "สร้างบทบาท" disabled (canCreate)
 *  - `/roles/{id}` of an ordinary role: read-only (canEdit=false), the same
 *    banner with `icon.info`, no name field, no save, no clone
 *
 * Skipped when the API under test has the flag on (E2E_ROLE_WRITES=on) — e20
 * is the writes-on half.
 */
test.describe.configure({ mode: "serial" });
test.skip(ROLE_WRITES_ON, "needs a server with ROLE_WRITES_ENABLED off");

let page: Page;
let orgId = "";

test.beforeAll(async ({ browser }) => {
  await resetIpThrottle();
  page = await browser.newContext().then((c) => c.newPage());
  await login(page, readShared().email);
  orgId = await createShop(page, `ร้านปิดเขียนบทบาท ${Date.now()}`);
});

test.afterAll(async () => {
  await page.close();
});

const WRITES_OFF_TITLE = "ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้";

test("EW3-09 · /roles/new with writes off: one banner on top, create disabled", async () => {
  await page.goto(`/o/${orgId}/settings/roles/new`);
  await expect(page.getByRole("heading", { level: 1, name: "สร้างบทบาทใหม่" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(WRITES_OFF_TITLE)).toHaveCount(1);
  await expect(page.getByRole("button", { name: "สร้างบทบาท" })).toBeDisabled();
  await expectResponsive(page, "R3 create, writes off");
});

test("EW3-09 · an ordinary role with writes off is read-only with the same single reason", async () => {
  const nav = await shopNav(page);
  // The page above is clean (nothing typed) — leaving it does not prompt.
  await nav.getByRole("link", { name: "บทบาทและสิทธิ์" }).click();
  await expect(page.getByText(/^ใช้ไป \d+ จาก/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: /^พนักงาน/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "พนักงาน" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(WRITES_OFF_TITLE)).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "ชื่อบทบาท" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "บันทึก", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "ทำสำเนาเป็นบทบาทใหม่" })).toHaveCount(0);
  // What the role grants is still readable (ux: "ดูรายละเอียดได้ตามปกติ").
  await expect(page.getByText("จัดการสต๊อก")).toBeVisible();
  await expectResponsive(page, "R4 interim, writes off");
});
