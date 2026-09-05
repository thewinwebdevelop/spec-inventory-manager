import { expect, test, type Page } from "@playwright/test";
import {
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
 * E-06 (test-plan §12.1) — somebody opens an invitation while signed in as a
 * DIFFERENT account.
 *
 * The interesting assertion is not the refusal. It is what the refusal is
 * allowed to say: AC-4.4 / D-027 hold that the screen may show `u***@…` and
 * never the whole address, because whoever is reading is, by definition, not
 * the person the invitation was for. A link forwarded in a group chat must not
 * turn into a way to learn a colleague's address.
 *
 * So this file watches BOTH surfaces — the rendered page and every response
 * body that reached the browser. A masked label over a JSON payload carrying
 * the real address would look correct in a screenshot and leak in devtools.
 */
test.describe.configure({ mode: "serial" });

let ownerPage: Page;
let strangerPage: Page;
let inviteUrl = "";
let shopName = "";
const invitee = freshEmail("intended");
const stranger = freshEmail("stranger");

/** Every API response body this browser received, for the leak assertion. */
const bodies: string[] = [];

test.beforeAll(async ({ browser }) => {
  await resetIpThrottle();
  ownerPage = await browser.newContext().then((c) => c.newPage());
  strangerPage = await browser.newContext().then((c) => c.newPage());

  // Recorded from the moment the stranger's browser exists, so nothing that
  // happens before the assertion escapes it.
  strangerPage.on("response", async (response) => {
    try {
      const type = response.headers()["content-type"] ?? "";
      if (type.includes("json") || type.includes("text")) bodies.push(await response.text());
    } catch {
      // A body that cannot be read (redirect, aborted) carries nothing to leak.
    }
  });

  await login(ownerPage, readShared().email);
  shopName = `ร้านคนละบัญชี ${Date.now()}`;
  const orgId = await createShop(ownerPage, shopName);
  await openMembers(ownerPage, orgId);
  inviteUrl = await invite(ownerPage, invitee, "ผู้ดูแล");

  // A real second account, not a logged-out browser: E-05 covers the stranger
  // with no account. This is the one who IS signed in, as somebody else.
  await signUpAndLogin(strangerPage, stranger);
});

test.afterAll(async () => {
  await ownerPage.close();
  await strangerPage.close();
});

test("E-06 · the invitation is readable, but the address it was issued to is masked", async () => {
  await strangerPage.goto(new URL(inviteUrl).pathname + new URL(inviteUrl).search);
  await expect(strangerPage.getByRole("heading", { name: "คำเชิญเข้าร่วมร้าน" })).toBeVisible({
    timeout: 20_000,
  });

  // The shop and the role ARE shown — a person deciding whether to join needs
  // both, and both are things the inviter chose to share by sending the link.
  await expect(strangerPage.getByText(shopName)).toBeVisible();
  await expect(strangerPage.getByText(/คำเชิญนี้ออกให้/)).toBeVisible();

  // ★ The address is not.
  await expect(
    strangerPage.getByText(invitee, { exact: false }),
    "the invited person's full address is on screen for somebody who is not them",
  ).toHaveCount(0);
});

test("E-06 · joining as the wrong account is refused, and the refusal offers the way out", async () => {
  await strangerPage.getByRole("button", { name: "เข้าร่วมร้านนี้" }).click();

  // `403 INVITATION_EMAIL_MISMATCH` — a distinct outcome from "this link is
  // dead" (E-03b), because the answer is different: the link is fine, the
  // account is not, and the fix is to sign in as somebody else.
  await expect(strangerPage.getByRole("heading", { name: "บัญชีไม่ตรงกับคำเชิญ" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(strangerPage.getByText("กรุณาเข้าสู่ระบบด้วยบัญชีที่ถูกเชิญ")).toBeVisible();

  // ★ AND IT NAMES THE ACCOUNT (B-8, fixed 2026-08-18).
  //
  // This assertion did not exist when the case was written: the refusal used to
  // say "sign in with the invited account" one step after the screen that had
  // shown WHICH account, and expected the reader to remember. The server had
  // been sending `details.emailMasked` all along for exactly this (§3.15) and
  // web dropped `details` for every `forbidden`.
  await expect(
    strangerPage.getByText(/คำเชิญนี้ออกให้/),
    "the refusal does not say which account to switch to — B-8 has regressed",
  ).toBeVisible();

  // …still MASKED, which is the other half. Naming the account must not turn
  // into disclosing it: the reader is, by definition, not that person.
  await expect(strangerPage.getByText(invitee, { exact: false })).toHaveCount(0);
  // A dead end here would be cruel: they cannot fix this from this screen
  // without an account switch, so the screen has to offer one.
  await expect(
    strangerPage.getByRole("link", { name: "ออกจากระบบแล้วเข้าด้วยบัญชีนั้น" }),
  ).toBeVisible();

  // …and they did not get in by asking.
  await expect(strangerPage).not.toHaveURL(/\/o\//);
});

test("E-06 ★ · the address never reached this browser at all", async () => {
  // The half a screenshot cannot show. The screen above is masked; this asks
  // whether the masking is a rendering decision or a real boundary. If the
  // preview response carries the whole address, anybody who can read devtools
  // — or an extension, or an error reporter — has it.
  expect(bodies.length, "no response bodies were captured — this assertion is vacuous").toBeGreaterThan(0);

  const leaked = bodies.filter((body) => body.includes(invitee));
  expect(
    leaked,
    `${leaked.length} response(s) carried the invited address in full: ${leaked
      .map((b) => b.slice(0, 200))
      .join(" | ")}`,
  ).toHaveLength(0);
});
