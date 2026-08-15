import { expect, test, type Page } from "@playwright/test";
import { createShop, freshEmail, invite, openMembers, signUpAndLogin } from "./helpers";

/**
 * One account, one page, in order — see the note in e02: F-001's per-IP
 * pre-auth throttle (`IP_WINDOW_MAX = 20` / 5 min) is a hard-coded constant,
 * and a lane that authenticates per test spends the budget on logins.
 */
test.describe.configure({ mode: "serial" });

let page: Page;
let orgId = "";

test.beforeAll(async ({ browser }) => {
  page = await browser.newContext().then((c) => c.newPage());
  await signUpAndLogin(page, freshEmail("inviter"));
  orgId = await createShop(page, `ร้านเชิญ ${Date.now()}`);
});

test.afterAll(async () => {
  await page.close();
});

/**
 * E-03 (test-plan §12.1) — invite → copy the link → invite the same person
 * again → reissue.
 *
 * §15 calls this Track 2's most valuable flow, for a reason that is not about
 * pixels: it is the one place F-002 deliberately breaks a user's expectation.
 * The link somebody already sent over LINE stops working the moment a new one
 * is issued (D-027), and every guard rail around that — the show-once warning,
 * the confirmation, the wording — exists because of it.
 */
test("E-03 · the link shows once, a duplicate invite offers a way out, and reissuing warns first", async () => {
  await openMembers(page, orgId);

  const guest = freshEmail("guest");

  // ── the one-time link ────────────────────────────────────────────────────
  const firstUrl = await invite(page, guest, "ผู้ดูแล");

  const panel = page.getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" });
  // The single guard rail ux settled on (§9.1, user decision 2026-07-28): a
  // warning strip, no dialog blocking the close.
  await expect(panel.getByText(/แสดงครั้งเดียว/)).toBeVisible();
  // The deadline is REAL — read from `expiresAt`, never printed as "7 วัน".
  await expect(panel.getByText(/ลิงก์ใช้ได้ถึง/)).toBeVisible();
  await expect(panel.getByText("7 วัน")).toHaveCount(0);

  await panel.getByRole("button", { name: "เสร็จแล้ว" }).click();
  await expect(panel).toBeHidden();

  // …and it is gone. Nothing on the page still holds the token: closing the
  // panel is the moment D-018 becomes visible to the user.
  await expect(page.getByText(firstUrl)).toHaveCount(0);

  // ── inviting the same address again must not dead-end (D-027) ────────────
  await page.getByRole("button", { name: "เชิญสมาชิก" }).first().click();
  const dialog = page.getByRole("dialog", { name: "เชิญสมาชิก" });
  await dialog.getByLabel("อีเมลของคนที่จะเชิญ").fill(guest);
  await dialog.getByRole("radio", { name: "ผู้ดูแล" }).check();
  await dialog.getByRole("button", { name: "สร้างลิงก์คำเชิญ" }).click();

  // The refusal names the situation and points at what to do about it — the
  // AC forbids leaving the person stuck retyping the address.
  await expect(dialog.getByText(/มีคำเชิญของอีเมลนี้ค้างอยู่แล้ว/)).toBeVisible();
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();

  // ── reissue asks BEFORE it breaks the link that was already sent ─────────
  // Scoped to the row: `.first()` would be a coin flip the moment a second
  // invitation exists, and this shop is about to have one.
  const row = page.locator("li", { hasText: guest });
  await row.getByRole("button", { name: "ออกลิงก์ใหม่" }).click();

  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText(/ลิงก์เดิมที่ส่งไปแล้วจะใช้ไม่ได้ทันที/)).toBeVisible();
  // It says WHOSE invitation, so the reader can check before agreeing.
  await expect(confirm.getByText(new RegExp(guest.replace(/[.+]/g, "\\$&")))).toBeVisible();

  await confirm.getByRole("button", { name: "ออกลิงก์ใหม่" }).click();

  // ── the new link is a DIFFERENT link ─────────────────────────────────────
  const reissued = page.getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" });
  await expect(reissued).toBeVisible({ timeout: 20_000 });
  const secondUrl = await reissued
    .getByRole("textbox", { name: "ลิงก์คำเชิญพร้อมแล้ว" })
    .inputValue();

  expect(
    secondUrl,
    "reissue returned the same token — D-027 says the previous link dies, which " +
      "is only true if a new one was actually minted",
  ).not.toBe(firstUrl);
});

test("E-03b · the old link is DEAD the moment a new one exists", async ({ browser }) => {
  // The half a screenshot cannot show. Everything above is about what the
  // inviter is told; this is whether it is true for the person holding the
  // first link.
  await openMembers(page, orgId);

  const guest = freshEmail("guest");
  const firstUrl = await invite(page, guest, "พนักงาน");
  await page.getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" }).getByRole("button", { name: "เสร็จแล้ว" }).click();

  await page.locator("li", { hasText: guest }).getByRole("button", { name: "ออกลิงก์ใหม่" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ออกลิงก์ใหม่" }).click();
  await expect(page.getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" })).toBeVisible({
    timeout: 20_000,
  });

  // A separate browser context: the invitee is a different person on a
  // different machine, holding the link that was sent before the reissue.
  const invitee = await browser.newContext();
  const inviteePage = await invitee.newPage();
  const link = new URL(firstUrl);
  await inviteePage.goto(`${link.pathname}${link.search}`);

  // The screen must say the link is unusable — not offer to join, and not
  // crash. `INVITATION_INVALID` is a 404, and §11.4 gives it its own copy.
  //
  // Pinned to the exact heading rather than a loose /ลิงก์|คำเชิญ/: that
  // pattern matched the heading AND the explanation under it, and a message
  // this specific is worth asserting by its words. It is what the person
  // holding a dead link actually reads.
  await expect(inviteePage.getByRole("button", { name: "เข้าร่วมร้านนี้" })).toHaveCount(0);
  await expect(
    inviteePage.getByRole("heading", { name: "ลิงก์คำเชิญนี้ใช้ไม่ได้" }),
  ).toBeVisible();
  // …and it says what to do next, which is the half that keeps it from being
  // a dead end (§11.4).
  await expect(inviteePage.getByText(/ขอลิงก์ใหม่จากเจ้าของร้าน/)).toBeVisible();
  await invitee.close();
});
