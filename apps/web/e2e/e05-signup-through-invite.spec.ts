import { expect, test, type Page } from "@playwright/test";
import {
  PASSWORD,
  createShop,
  freshEmail,
  invite,
  login,
  openMembers,
  readShared,
  resetIpThrottle,
} from "./helpers";

/**
 * E-05 and E-12 (test-plan §12.1) — the invitee who does NOT have an account,
 * and what the `/invite` screen does with the token while they get one.
 *
 * One file because they are the same screen and the same link: E-12 is the ★
 * security row (the token must leave the URL and be stored nowhere), and E-05
 * is the journey that takes the reader away from that screen and back again —
 * which is precisely the journey that would tempt somebody to persist it.
 */
test.describe.configure({ mode: "serial" });

let ownerPage: Page;
let visitorPage: Page;
let orgId = "";
let shopName = "";
let inviteUrl = "";
const invitee = freshEmail("newcomer");

test.beforeAll(async ({ browser }) => {
  await resetIpThrottle();
  ownerPage = await browser.newContext().then((c) => c.newPage());
  visitorPage = await browser.newContext().then((c) => c.newPage());

  await login(ownerPage, readShared().email);
  shopName = `ร้านมือใหม่ ${Date.now()}`;
  orgId = await createShop(ownerPage, shopName);
  await openMembers(ownerPage, orgId);
  inviteUrl = await invite(ownerPage, invitee, "พนักงาน");
});

test.afterAll(async () => {
  await ownerPage.close();
  await visitorPage.close();
});

test("E-12 ★ · the token leaves the URL, the history and the browser's storage", async () => {
  const token = new URL(inviteUrl).searchParams.get("token");
  expect(token, "the invite link carried no token").toBeTruthy();

  await visitorPage.goto(new URL(inviteUrl).pathname + new URL(inviteUrl).search);
  await expect(visitorPage.getByRole("heading", { name: "คำเชิญเข้าร่วมร้าน" })).toBeVisible({
    timeout: 20_000,
  });

  // ── out of the address bar ───────────────────────────────────────────────
  // Stripped in a LAYOUT effect, before the first paint (`use-invite-token`),
  // so there is no frame where a screenshot or a screenshare would catch it.
  expect(visitorPage.url(), "the token is still in the address bar").not.toContain(token!);
  expect(visitorPage.url()).not.toContain("token=");

  // ── and out of storage ───────────────────────────────────────────────────
  // The token lives in a ref for the life of the component and nowhere else.
  // Asserted over EVERY key rather than a known one: a leak nobody intended
  // will not be called "inviteToken".
  const stored = await visitorPage.evaluate(() => ({
    local: JSON.stringify(window.localStorage),
    session: JSON.stringify(window.sessionStorage),
  }));
  expect(stored.local, "the token is in localStorage").not.toContain(token!);
  expect(stored.session, "the token is in sessionStorage").not.toContain(token!);

  // ── nor rendered into the page ───────────────────────────────────────────
  // A hidden input or a `href` carrying it back would defeat all of the above.
  const html = await visitorPage.content();
  expect(html, "the token is somewhere in the DOM").not.toContain(token!);

  // ── and not one Back press away, which is the half people forget ─────────
  // The strip uses `replaceState`; `pushState` would leave the token-bearing
  // entry in history, where Back — or a restored session — brings it straight
  // back. If there is nothing to go back to, `goBack()` returns null and the
  // URL does not move, which is also the right answer.
  await visitorPage.goBack().catch(() => null);
  expect(visitorPage.url(), "Back restored the token-bearing URL").not.toContain("token=");
});

test("E-05 · somebody with no account can read the invitation, and is told what to do", async () => {
  // ★ The preview is PUBLIC — no session, no organisation header — so this is
  // the one screen a stranger holding the link can read. What it may say is
  // therefore the whole question: the shop and the role, because that is what
  // the decision needs, and the address only masked.
  //
  // Re-opened because E-12 ended on Back. Cheap: the preview quota is 30/hour
  // per IP (invitation-redemption.controller) and this lane is nowhere near it.
  await visitorPage.goto(new URL(inviteUrl).pathname + new URL(inviteUrl).search);
  await expect(visitorPage.getByRole("heading", { name: "คำเชิญเข้าร่วมร้าน" })).toBeVisible({
    timeout: 20_000,
  });

  await expect(visitorPage.getByText(shopName)).toBeVisible();
  await expect(visitorPage.getByText('ชวนคุณเข้าร่วมเป็น "พนักงาน"')).toBeVisible();

  const masked = visitorPage.getByText(/คำเชิญนี้ออกให้/);
  await expect(masked).toBeVisible();
  await expect(
    visitorPage.getByText(invitee, { exact: false }),
    "the full address of the invitee is on a page anybody holding the link can open",
  ).toHaveCount(0);

  // Not offered "join": there is nobody to join as. §11.1 gives the reader the
  // two doors and says which address to use — without that sentence, somebody
  // signs up with the address they normally use and the invitation will not
  // match it.
  await expect(visitorPage.getByRole("button", { name: "เข้าร่วมร้านนี้" })).toHaveCount(0);
  await expect(visitorPage.getByRole("button", { name: "สมัครบัญชีใหม่" })).toBeVisible();
  await expect(visitorPage.getByText("ใช้อีเมลเดียวกับที่ถูกเชิญเท่านั้น")).toBeVisible();
});

test("E-05 · they sign up with the invited address and join — the link is needed twice", async () => {
  // ⚠️ THE DEVIATION, and it is deliberate on the app's side.
  //
  // §12.1 words E-05 as "holds the token through the whole flow". It does not:
  // the token lives in a ref inside the `/invite` tree, so walking to /signup
  // destroys it — which is exactly the property E-12 above just asserted. The
  // two rows cannot both be satisfied by storing it; keeping the token through
  // a signup means putting it in `sessionStorage` or in the URL of the signup
  // page, and both are the leak.
  //
  // So the person opens the link again, which is what somebody who received it
  // over LINE actually does. Filed in tasks.md for product/ux: the outcome of
  // AC-4.2 is reached, the wording of §12.1 is not.
  await visitorPage.getByRole("button", { name: "สมัครบัญชีใหม่" }).click();
  await expect(visitorPage).toHaveURL(/\/signup/);

  await visitorPage.getByLabel("อีเมล").fill(invitee);
  await visitorPage.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await visitorPage.getByRole("button", { name: "สมัครใช้งาน" }).click();

  await expect(visitorPage).toHaveURL(/\/login/);
  await visitorPage.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await visitorPage.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  // ★ A member of NOTHING yet. Signing up with an invited address must not
  // join anything on its own — the invitation is accepted by a person, not by
  // an address matching (AC-4.2 auto-links on ACCEPT, D-012 has no email step
  // that could have confirmed anything).
  await expect(visitorPage).toHaveURL(/\/select-org/);
  await expect(visitorPage.getByRole("main").getByText(shopName)).toHaveCount(0);

  // Back through the link they still have.
  await visitorPage.goto(new URL(inviteUrl).pathname + new URL(inviteUrl).search);
  await visitorPage.getByRole("button", { name: "เข้าร่วมร้านนี้" }).click();

  await expect(
    visitorPage.getByRole("heading", { name: new RegExp(`เข้าร่วม .*${shopName}`) }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(visitorPage.getByText("สิทธิ์ของคุณ: พนักงาน")).toBeVisible();

  await visitorPage.getByRole("link", { name: "เริ่มใช้งานร้านนี้" }).click();
  await expect(visitorPage).toHaveURL(new RegExp(`/o/${orgId}`), { timeout: 20_000 });

  // …and the account created through this door is a Staff member, not an
  // Owner: the role comes from the invitation, not from who signed up.
  await expect(
    visitorPage
      .getByRole("navigation", { name: "เมนูของร้าน" })
      .getByRole("link", { name: "สมาชิก" }),
  ).toHaveCount(0);
});
