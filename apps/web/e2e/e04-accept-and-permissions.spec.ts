import { expect, test, type Page } from "@playwright/test";
import {
  acceptInvite,
  createShop,
  freshEmail,
  invite,
  login,
  openMembers,
  readShared,
  signUpAndLogin,  resetIpThrottle,
} from "./helpers";

/**
 * E-04, E-08 and E-13 (test-plan §12.1), in one file because they share a cast:
 * an Owner and the Staff member they invite. Building that cast is two signups
 * and two logins, and F-001's per-IP pre-auth throttle is a hard-coded 20 per
 * five minutes — see the note in e02. One cast, three questions.
 *
 * Ordered, because each answer depends on the one before: you cannot ask what a
 * Staff member sees until somebody has become one.
 */
test.describe.configure({ mode: "serial" });

let ownerPage: Page;
let staffPage: Page;
let orgId = "";
let shopName = "";
const staffEmail = freshEmail("staff");

test.beforeAll(async ({ browser }) => {
  await resetIpThrottle();
  // The Owner is the lane's shared account; only the Staff member has to be a
  // real new signup, because "somebody who has an account accepts an
  // invitation" is the branch §11.2 describes.
  ownerPage = await browser.newContext().then((c) => c.newPage());
  staffPage = await browser.newContext().then((c) => c.newPage());

  // A login, not a restored cookie: refresh tokens rotate, so replaying one
  // saved state from several contexts is reuse — and F-001 revokes the family
  // for exactly that.
  await login(ownerPage, readShared().email);
  shopName = `ร้านสิทธิ์ ${Date.now()}`;
  orgId = await createShop(ownerPage, shopName);

  // The invitee needs an account before they can accept (Phase 0 has no
  // signup-through-invite path — §11.2 is the "already has an account" branch).
  await signUpAndLogin(staffPage, staffEmail);
});

test.afterAll(async () => {
  await ownerPage.close();
  await staffPage.close();
});

test("E-04 · an invited person with an account joins, and appears in the list", async () => {
  await openMembers(ownerPage, orgId);
  const link = await invite(ownerPage, staffEmail, "พนักงาน");
  await ownerPage
    .getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" })
    .getByRole("button", { name: "เสร็จแล้ว" })
    .click();

  // The invitee opens the link the inviter would have sent over LINE.
  await acceptInvite(staffPage, link);

  // Accepting does NOT teleport them into the shop: §11.2 confirms what just
  // happened and which role they got, then offers the way in. I had assumed a
  // redirect — the screen is better, because "you are now a พนักงาน of X" is
  // exactly what somebody who clicked a link from a chat needs to read before
  // anything else changes.
  await expect(
    staffPage.getByRole("heading", { name: new RegExp(`เข้าร่วม .*${shopName}`) }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(staffPage.getByText("สิทธิ์ของคุณ: พนักงาน")).toBeVisible();

  await staffPage.getByRole("link", { name: "เริ่มใช้งานร้านนี้" }).click();
  await expect(staffPage).toHaveURL(new RegExp(`/o/${orgId}`), { timeout: 20_000 });
  await expect(staffPage.getByRole("main").getByText(shopName).first()).toBeVisible();

  // …and the Owner sees them, with the role the invitation carried — not a
  // default, and not the inviter's own.
  await openMembers(ownerPage, orgId);

  // ⚠️ A RELOAD, and it is not padding — it is the one trigger that exists.
  //
  // Org queries stay fresh for 30s (`staleTime`, query-client.ts), so coming
  // back to a screen visited a moment ago serves the CACHED list. On this
  // screen that means the invitation still reads "รอตอบรับ" and the person who
  // just joined is missing — the snapshot from the run that caught this shows
  // exactly that: "คำเชิญที่รอตอบรับ (1)" over "สมาชิกในร้าน (1)". Nothing in
  // this tab can know better: the accept happened in a different browser, so
  // no mutation invalidated anything here and `refetchOnWindowFocus` never
  // fires either.
  //
  // Not overridden in the app from a test: 30s was chosen deliberately and the
  // window self-heals. The user-visible consequence is filed in tasks.md for
  // ux/frontend. Reloading is what the puzzled Owner does, and it is honest
  // about what it takes to see the truth.
  await ownerPage.reload();
  await expect(
    ownerPage.getByRole("heading", { name: "สมาชิก", exact: true }),
  ).toBeVisible({ timeout: 20_000 });

  const row = ownerPage.locator("li", { hasText: staffEmail });
  await expect(row).toBeVisible();
  await expect(row.getByText("พนักงาน")).toBeVisible();
  await expect(row.getByText("ใช้งานอยู่")).toBeVisible();
});

test("E-08 · a Staff member is not offered the members screen, and is not thrown out of the shop", async () => {
  // ux Q13: HIDE the entry rather than disable it — a disabled item raises a
  // question the person cannot answer.
  await staffPage.goto(`/o/${orgId}/settings/org`);
  await expect(staffPage.getByRole("navigation", { name: "เมนูของร้าน" })).toBeVisible();
  await expect(
    staffPage.getByRole("navigation", { name: "เมนูของร้าน" }).getByRole("link", { name: "สมาชิก" }),
  ).toHaveCount(0);

  // ★ And the part that matters more: typing the URL anyway must NOT evict
  // them. `403 FORBIDDEN` and `403 ORG_ACCESS_DENIED` are different answers
  // (I-5) — one means "not this page", the other means "not this shop", and a
  // client that merges them logs somebody out for opening the wrong page.
  await staffPage.goto(`/o/${orgId}/settings/members`);

  await expect(staffPage).not.toHaveURL(/\/login/);
  await expect(staffPage).not.toHaveURL(/\/select-org/);
  await expect(staffPage).toHaveURL(new RegExp(`/o/${orgId}`));
});

test("E-08b · the Owner, unlike the Staff member, IS offered the members entry", async () => {
  // The counterpart to E-08, and a check on the client's own copy of the
  // capabilities: the nav hides "สมาชิก" without `manage_members`, so an Owner
  // who cannot see it would mean the client lost capabilities the server still
  // honours — the kind of mismatch that looks like a permissions bug to the
  // person and like nothing at all to the API.
  await expect(
    ownerPage.getByRole("navigation", { name: "เมนูของร้าน" }).getByRole("link", { name: "สมาชิก" }),
  ).toBeVisible();
});

test("E-13 · the last Owner cannot leave, and is told what to do instead", async () => {
  // AC-5.7 / D-029. The refusal is the interesting half: `409 LAST_OWNER` has
  // to arrive as a sentence that names the way out, because F-002 has no
  // "delete shop" — an Owner who cannot leave and cannot delete is stuck with
  // a shop forever if the message just says "conflict".
  await ownerPage
    .getByRole("navigation", { name: "เมนูของร้าน" })
    .getByRole("link", { name: "ข้อมูลร้าน" })
    .click();
  await ownerPage.getByRole("button", { name: "ออกจากร้านนี้" }).click();

  // `alertdialog`, not `dialog` — LeaveOrgDialog uses the assertive role
  // (ui.md §6: it asks before something irreversible).
  const dialog = ownerPage.getByRole("alertdialog", { name: new RegExp(`ออกจาก${shopName}`) });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "ออกจากร้านนี้" }).click();

  // The dialog STAYS OPEN with the reason inside it — closing it would leave
  // the person on a screen that looks like nothing happened.
  await expect(
    dialog.getByText(/คุณเป็นเจ้าของร้านคนเดียวของร้านนี้/),
  ).toBeVisible();
  await expect(dialog.getByText(/ตั้งคนอื่นเป็นเจ้าของร้านก่อน/)).toBeVisible();

  // Still in the shop, still the Owner.
  await expect(ownerPage).toHaveURL(new RegExp(`/o/${orgId}`));
});

test("E-13b · a Staff member CAN leave, and the shop disappears from their list", async () => {
  // The other side of D-029: leaving needs no capability, and Staff cannot even
  // open the members screen — which is why the affordance lives on the shop's
  // own page and not there.
  await staffPage
    .getByRole("navigation", { name: "เมนูของร้าน" })
    .getByRole("link", { name: "ข้อมูลร้าน" })
    .click();
  await staffPage.getByRole("button", { name: "ออกจากร้านนี้" }).click();

  const dialog = staffPage.getByRole("alertdialog", { name: new RegExp(`ออกจาก${shopName}`) });
  await dialog.getByRole("button", { name: "ออกจากร้านนี้" }).click();

  // Out of the shop and back at the picker, which must no longer offer it.
  await expect(staffPage).toHaveURL(/\/select-org/, { timeout: 20_000 });
  await expect(staffPage.getByRole("main").getByText(shopName)).toHaveCount(0);
});
