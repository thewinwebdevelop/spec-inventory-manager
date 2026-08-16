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
 * E-07 (test-plan §12.1) — somebody is removed from the shop WHILE they are
 * using it (AC-5.1 / AC-5.2, D-027).
 *
 * Two things have to be true at once, and they pull in opposite directions:
 *
 *  - the very next request must be refused (`403 ORG_ACCESS_DENIED`), because
 *    the removal is immediate and there is no token to wait out; and
 *  - the SESSION must survive. Being removed from one shop is not being logged
 *    out — the person may belong to others, and dumping them at /login for
 *    something a colleague did in a different shop is the failure this row
 *    exists to prevent.
 *
 * The removal is driven through the OWNER'S BROWSER, which is what §12.1
 * means by "จาก session อื่น" — another session, not the one being removed.
 * It could not be written this way until now: the member row rendered its
 * actions as `<span>`s (W-17), so the first version of this file revoked over
 * the API instead. The assertions did not change when the button appeared,
 * which is the point of having written them about the removed person's screen
 * rather than about the click.
 *
 * It also covers S9 on the way past, because the cast is already assembled and
 * changing somebody's role is the other half of §7's row actions.
 */
test.describe.configure({ mode: "serial" });

let ownerPage: Page;
let staffPage: Page;
let orgId = "";
let shopName = "";
let ownOrgName = "";
const staffEmail = freshEmail("removed");

test.beforeAll(async ({ browser }) => {
  await resetIpThrottle();
  ownerPage = await browser.newContext().then((c) => c.newPage());
  staffPage = await browser.newContext().then((c) => c.newPage());

  await login(ownerPage, readShared().email);
  shopName = `ร้านถูกถอด ${Date.now()}`;
  orgId = await createShop(ownerPage, shopName);
  await openMembers(ownerPage, orgId);
  const link = await invite(ownerPage, staffEmail, "พนักงาน");
  await ownerPage
    .getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" })
    .getByRole("button", { name: "เสร็จแล้ว" })
    .click();

  await signUpAndLogin(staffPage, staffEmail);

  // ★ A shop of their OWN, created before they join the other one. Without it
  // this test cannot tell "sent back to the picker" from "logged out and the
  // picker happens to be empty" — and the difference is the whole AC.
  ownOrgName = `ร้านของฉัน ${Date.now()}`;
  await createShop(staffPage, ownOrgName);

  await acceptInvite(staffPage, link);
  await staffPage.getByRole("link", { name: "เริ่มใช้งานร้านนี้" }).click();
  await expect(staffPage).toHaveURL(new RegExp(`/o/${orgId}`), { timeout: 20_000 });
});

test.afterAll(async () => {
  await ownerPage.close();
  await staffPage.close();
});

test("S9 · the Owner changes the Staff member's role, and the list says so", async () => {
  // §10.1, through the button W-17 was missing. Runs first because it proves
  // the row's OTHER action reaches its mutation — and because a member whose
  // role just changed is a more interesting one to remove.
  await openMembers(ownerPage, orgId);
  const row = ownerPage.locator("li", { hasText: staffEmail });
  await row.getByRole("button", { name: "เปลี่ยนสิทธิ์" }).click();

  const dialog = ownerPage.getByRole("dialog", { name: new RegExp(`เปลี่ยนสิทธิ์ของ`) });
  await expect(dialog).toBeVisible();
  // The current role is stated in words, not implied by a filled radio (§14).
  await expect(dialog.getByText("(สิทธิ์ปัจจุบัน)")).toBeVisible();
  // Saving nothing is not an option: a write that changes nothing still writes
  // an audit row saying somebody did something they did not do.
  await expect(dialog.getByRole("button", { name: "บันทึกสิทธิ์" })).toBeDisabled();

  await dialog.getByRole("radio", { name: "ผู้ดูแล" }).check();
  await dialog.getByRole("button", { name: "บันทึกสิทธิ์" }).click();

  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(ownerPage.locator("li", { hasText: staffEmail }).getByText("ผู้ดูแล")).toBeVisible({
    timeout: 20_000,
  });
});

test("E-07 · removed while inside the shop: refused at once, and sent to the picker — not to /login", async () => {
  // ── the other session does the removing ─────────────────────────────────
  // The Owner's own browser, through S10 — a different session from the one
  // being removed, which is what the AC is about.
  await openMembers(ownerPage, orgId);
  await ownerPage
    .locator("li", { hasText: staffEmail })
    .getByRole("button", { name: "ถอดออกจากร้าน" })
    .click();

  // §10.2 (ux review item 8): four consequences, not "แน่ใจหรือไม่". The third
  // one is the one nobody predicts — removing somebody also cancels the
  // invitation sitting in their inbox (I-1).
  const confirm = ownerPage.getByRole("alertdialog", {
    name: new RegExp(`ถอด .*${staffEmail.replace(/[.+]/g, "\\$&")}`),
  });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText("เขาจะเข้าถึงข้อมูลของร้านนี้ไม่ได้ทันที")).toBeVisible();
  await expect(confirm.getByText("ประวัติการทำรายการที่เขาเคยทำไว้ยังอยู่ครบ")).toBeVisible();
  await expect(confirm.getByText("ถ้ามีคำเชิญของอีเมลนี้ค้างอยู่ ระบบจะยกเลิกให้ด้วย")).toBeVisible();
  await expect(confirm.getByText("ให้กลับเข้ามาใหม่ได้ด้วยการเชิญใหม่เท่านั้น")).toBeVisible();

  await confirm.getByRole("button", { name: "ถอดออกจากร้าน" }).click();
  await expect(confirm).toBeHidden({ timeout: 20_000 });
  // The default list is the ACTIVE members, so the row leaves it.
  await expect(ownerPage.locator("li", { hasText: staffEmail })).toHaveCount(0, {
    timeout: 20_000,
  });

  // ── the next thing the removed person does ──────────────────────────────
  //
  // A click first, because that is what a person in the middle of using the
  // shop actually does. It is NOT asserted on, and the reason is worth writing
  // down: org queries are fresh for 30s (`staleTime`, query-client.ts), so a
  // click inside the shop can be served entirely from cache — no request, no
  // 403, no eviction. What that costs is bounded (they see data they already
  // had; every WRITE is refused by the server, which is the control that
  // matters) but it is real, and it is the same staleness E-04 ran into.
  // Filed in tasks.md rather than asserted, because pinning it either way
  // would freeze a decision that belongs to ux/frontend.
  await staffPage
    .getByRole("navigation", { name: "เมนูของร้าน" })
    .getByRole("link", { name: "ข้อมูลร้าน" })
    .click();

  // The trigger the AC is actually about: a real request to the API. `403
  // ORG_ACCESS_DENIED` has to arrive and be acted on, not merely be received.
  await staffPage.reload();

  await expect(staffPage, "the removed member was left inside the shop").toHaveURL(
    /\/select-org/,
    { timeout: 20_000 },
  );

  // ★ Session intact. `403 ORG_ACCESS_DENIED` is not `401`, and a client that
  // treats them the same logs somebody out of an app they still have an
  // account in — their own shop is the proof they are still signed in.
  await expect(staffPage).not.toHaveURL(/\/login/);
  await expect(staffPage.getByRole("main").getByText(ownOrgName)).toBeVisible();
});

test("E-07 · the shop is gone from the picker, and typing its URL does not get back in", async () => {
  // AC-5.2 — "หายจาก switcher ทันที". The list is the person's own answer to
  // "which shops am I in", so a stale entry is an invitation to click on a
  // door that no longer opens.
  await expect(staffPage.getByRole("main").getByText(shopName)).toHaveCount(0);

  // …and the URL is not a back door. It is the same refusal, from a cold load
  // rather than from a live session.
  await staffPage.goto(`/o/${orgId}`);
  await expect(staffPage).toHaveURL(/\/select-org/, { timeout: 20_000 });
  await expect(staffPage).not.toHaveURL(/\/login/);
});
