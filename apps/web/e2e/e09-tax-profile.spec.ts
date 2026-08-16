import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  PASSWORD,
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
 * E-09 and E-14 ★ (test-plan §12.1) — the shop's tax identity: declaring it,
 * getting it wrong, and looking at it.
 *
 * These thirteen digits are the most sensitive value F-002 stores. For a
 * บุคคลธรรมดา taxpayer they ARE the owner's national ID, which is why §3.16
 * gives them their own endpoint, their own capability and their own audit
 * record rather than riding along in the org profile.
 *
 * So the questions here are not "does the form save". They are: does a wrong
 * number get corrected at the field instead of as a banner, does the revealed
 * number actually GO when the person hides it, and is any of it reachable by a
 * colleague who is merely staff.
 */
test.describe.configure({ mode: "serial" });

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3000";

/** Checksum-valid (mod-11, weights 13…2) and its off-by-one neighbour. */
const VALID_TAX_ID = "0105560123454";
const WRONG_CHECKSUM = "0105560123455";

let ownerPage: Page;
let staffPage: Page;
let api: APIRequestContext;
let orgId = "";
const staffEmail = freshEmail("tax-staff");

/** Every response body the OWNER's browser received — for the (ง) assertion. */
const ownerBodies: { url: string; body: string }[] = [];

test.beforeAll(async ({ browser }) => {
  await resetIpThrottle();
  ownerPage = await browser.newContext().then((c) => c.newPage());
  staffPage = await browser.newContext().then((c) => c.newPage());

  ownerPage.on("response", async (response) => {
    try {
      const type = response.headers()["content-type"] ?? "";
      if (type.includes("json") || type.includes("text")) {
        ownerBodies.push({ url: response.url(), body: await response.text() });
      }
    } catch {
      // Unreadable bodies carry nothing.
    }
  });

  await login(ownerPage, readShared().email);
  orgId = await createShop(ownerPage, `ร้านภาษี ${Date.now()}`);
  await openMembers(ownerPage, orgId);
  const link = await invite(ownerPage, staffEmail, "พนักงาน");
  await ownerPage
    .getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" })
    .getByRole("button", { name: "เสร็จแล้ว" })
    .click();

  await signUpAndLogin(staffPage, staffEmail);
  await acceptInvite(staffPage, link);
  await staffPage.getByRole("link", { name: "เริ่มใช้งานร้านนี้" }).click();
  await expect(staffPage).toHaveURL(new RegExp(`/o/${orgId}`), { timeout: 20_000 });

  api = await request.newContext({ baseURL: API_ORIGIN });
});

test.afterAll(async () => {
  await api.dispose();
  await ownerPage.close();
  await staffPage.close();
});

test("E-09 · a wrong checksum is corrected AT THE FIELD, and the fix goes through", async () => {
  await ownerPage
    .getByRole("navigation", { name: "เมนูของร้าน" })
    .getByRole("link", { name: "ข้อมูลร้าน" })
    .click();

  await ownerPage.getByRole("button", { name: "กรอกข้อมูลผู้เสียภาษี" }).click();
  const dialog = ownerPage.getByRole("dialog", { name: "ข้อมูลผู้เสียภาษี" });
  await expect(dialog).toBeVisible();

  // The default is นิติบุคคล, not บุคคลธรรมดา — my assumption was the other
  // way round and the first run said so. It is the better default: a shop
  // declaring a tax identity is usually a company, and the personal branch is
  // the one that needs a warning, so it should be chosen deliberately.
  await dialog.getByRole("radio", { name: "บุคคลธรรมดา" }).check();

  // …and choosing it says what those digits are, WHILE they are typed rather
  // than after saving (§6): for a personal taxpayer this field is a national
  // ID, and somebody typing it deserves to know who will be able to see it.
  await expect(dialog.getByText(/คือเลขบัตรประชาชนของเจ้าของกิจการ/)).toBeVisible();

  const field = dialog.getByLabel("เลขประจำตัวผู้เสียภาษี (13 หลัก)");
  await field.fill(WRONG_CHECKSUM);
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();

  // ★ AT THE FIELD. `422 TAX_ID_INVALID` arrives with `fieldErrors.taxId`, and
  // a banner would make the person hunt for which of the four inputs is wrong
  // — the whole reason the envelope has a field-level channel (D-025).
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(
    dialog.getByText(/เลขผู้เสียภาษีไม่ถูกต้อง/),
    "the rejection did not name the last digit — the person cannot tell a typo from a policy",
  ).toBeVisible();

  // The dialog STAYS, with what they typed still in it: closing it would throw
  // away twelve correct digits over one wrong one.
  await expect(field).toHaveValue(WRONG_CHECKSUM);

  // ── and the fix ─────────────────────────────────────────────────────────
  await field.fill(VALID_TAX_ID);
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
});

test("E-14 ★ · the number is masked until asked for, and the asking is announced first", async () => {
  // Nothing on the profile screen shows the digits by default — the card holds
  // a mask, and the reveal is a deliberate act with a recorded consequence.
  await expect(ownerPage.getByText(VALID_TAX_ID)).toHaveCount(0);

  // §5: "บอกก่อนกด ไม่ใช่แอบเก็บ" — the notice sits next to the button, BEFORE
  // the press, because a warning shown afterwards is not a choice.
  await expect(ownerPage.getByText("การกดดูเลขเต็มถูกบันทึกไว้เพื่อความปลอดภัยของร้าน")).toBeVisible();

  await ownerPage.getByRole("button", { name: "แสดงเลขเต็ม" }).click();
  await expect(ownerPage.getByText(VALID_TAX_ID)).toBeVisible({ timeout: 20_000 });
});

test("E-14 ★ · hiding DROPS the number — it is not merely off screen", async () => {
  await ownerPage.getByRole("button", { name: "ซ่อนเลข" }).click();

  // (ก) not in the DOM, hidden or otherwise. A `display:none` node still holds
  // the value for anything reading the page.
  await expect(ownerPage.getByText(VALID_TAX_ID)).toHaveCount(0);
  expect(await ownerPage.content(), "the revealed number is still in the DOM").not.toContain(
    VALID_TAX_ID,
  );

  // (ข) and in no storage the page can write to.
  const stored = await ownerPage.evaluate(() => ({
    local: JSON.stringify(window.localStorage),
    session: JSON.stringify(window.sessionStorage),
  }));
  expect(stored.local, "the tax id is in localStorage").not.toContain(VALID_TAX_ID);
  expect(stored.session, "the tax id is in sessionStorage").not.toContain(VALID_TAX_ID);

  // (ค) and a reload does not bring it back: seeing it again costs another
  // recorded reveal, which is what makes the audit trail mean anything.
  await ownerPage.reload();
  await expect(ownerPage.getByRole("button", { name: "แสดงเลขเต็ม" })).toBeVisible({
    timeout: 20_000,
  });
  expect(await ownerPage.content()).not.toContain(VALID_TAX_ID);
});

test("E-14 ★ · the profile endpoint never carried the number in the first place", async () => {
  // (ง) The masking is a boundary, not a rendering choice. `GET /orgs/{id}`
  // must not answer with the digits even for somebody who is allowed to see
  // them — U-API-12 keeps its test at the OLD leak site on purpose, and this
  // is the same rule observed from the browser's side.
  const profileResponses = ownerBodies.filter(({ url }) => /\/orgs\/[^/]+$/.test(url));
  expect(
    profileResponses.length,
    "no org-profile responses were captured — this assertion is vacuous",
  ).toBeGreaterThan(0);

  const leaked = profileResponses.filter(({ body }) => body.includes(VALID_TAX_ID));
  expect(
    leaked.map((r) => r.url),
    "GET /orgs/{id} answered with the full tax id",
  ).toHaveLength(0);

  // Exactly one endpoint may ever say it, and only when asked.
  const revealResponses = ownerBodies.filter(({ url }) => url.includes("/tax-profile/reveal"));
  expect(
    revealResponses.some(({ body }) => body.includes(VALID_TAX_ID)),
    "the reveal endpoint never returned the number — the test above proved nothing",
  ).toBe(true);
});

test("E-14 ★ · a Staff member sees no digits, no button, and gets 403 asking directly", async () => {
  // (จ) ux Q13 is STRICTER than §12.1's wording ("Staff เห็นเลข mask เท่านั้น"):
  // AC-7.4 and §3.16 settled on staff seeing no digits at all, not even the
  // last four, because four digits of a national ID plus a name is already
  // enough to be useful to somebody it should not be useful to.
  await staffPage.goto(`/o/${orgId}/settings/org`);
  await expect(staffPage.getByRole("heading", { name: "ข้อมูลผู้เสียภาษี" })).toBeVisible({
    timeout: 20_000,
  });

  await expect(staffPage.getByRole("button", { name: "แสดงเลขเต็ม" })).toHaveCount(0);
  await expect(staffPage.getByText("รายละเอียดเปิดให้เฉพาะผู้ที่ดูแลข้อมูลร้าน")).toBeVisible();

  const html = await staffPage.content();
  expect(html, "a staff member's page contains the tax id").not.toContain(VALID_TAX_ID);
  // Not even a fragment of it: the mask must be built server-side, not by
  // trimming a number the browser was given.
  expect(html, "a staff member's page contains part of the tax id").not.toContain(
    VALID_TAX_ID.slice(-4),
  );

  // ★ And the button being absent is a courtesy, not the control. The control
  // is the server refusing the call that the missing button would have made.
  const auth = await api.post("/auth/login", {
    data: { email: staffEmail, password: PASSWORD, tokenTransport: "body" },
  });
  expect(auth.ok(), `the API refused the staff login: ${auth.status()}`).toBeTruthy();
  const { accessToken } = (await auth.json()) as { accessToken: string };

  const reveal = await api.post(`/orgs/${orgId}/tax-profile/reveal`, {
    headers: { Authorization: `Bearer ${accessToken}`, "X-Organization-Id": orgId },
  });
  expect(reveal.status(), "a staff member could reveal the shop's tax id").toBe(403);
  expect(await reveal.text()).not.toContain(VALID_TAX_ID);
});
