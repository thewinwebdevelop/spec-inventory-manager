import { expect, test, type Page } from "@playwright/test";
import { createShop, landOnPicker, openSwitcher } from "./helpers";

/**
 * ONE account and ONE page for the whole file, in order.
 *
 * Not a style choice: F-001 throttles pre-auth endpoints per IP
 * (`IP_WINDOW_MAX = 20` per 5 minutes, a hard-coded constant — auth.constants).
 * The whole browser lane runs from one address, so a suite that signs up and
 * logs in per test spends its budget on authentication and then starts failing
 * with "ลองเข้าสู่ระบบถี่เกินไป" — which is the throttle working exactly as
 * designed. Two auth calls per file keeps the lane inside it.
 */
test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  // Signed in already, from the lane's shared state — this file is about
  // switching between shops, not about how somebody signs in.
  page = await browser
    .newContext({ storageState: "e2e/.auth/owner.json" })
    .then((c) => c.newPage());
  await landOnPicker(page);
});

test.afterAll(async () => {
  await page.close();
});

/**
 * E-02 (test-plan §12.1) — one person, two shops, and no bleed between them.
 *
 * The assertion that matters is not "the switcher works". It is that after
 * switching, what is on screen belongs to the shop in the URL — web.md §3.2
 * puts the org in the path precisely so two tabs can hold two shops, and the
 * failure this catches is a query cache keyed without the org id, which looks
 * perfect until the second shop shows the first one's data.
 */
let nameA = "";
let nameB = "";

test("E-02 · switching shops changes the URL and the data with it", async () => {
  nameA = `ร้าน ก ${Date.now()}`;
  const orgA = await createShop(page, nameA);
  nameB = `ร้าน ข ${Date.now()}`;
  const orgB = await createShop(page, nameB);

  expect(orgA, "the two shops must be different").not.toBe(orgB);

  // Created second, so this is where `createShop` left us.
  await expect(page).toHaveURL(new RegExp(`/o/${orgB}`));
  await expect(page.getByRole("main").getByText(nameB).first()).toBeVisible();

  // ── switch back to the first ──────────────────────────────────────────────
  // The switcher is a LIST in the sidebar, not a menu that opens: on web the
  // shop is in the URL (web.md §3.2), so switching is following a link. The
  // bottom-sheet-on-tap shape is mobile's (§13).
  await openSwitcher(page);
  await page.getByRole("link", { name: new RegExp(nameA) }).click();

  await expect(page).toHaveURL(new RegExp(`/o/${orgA}`));
  await expect(page.getByRole("main").getByText(nameA).first()).toBeVisible();

  // ★ The bleed check, scoped to the CONTENT.
  //
  // Not the whole page: the switcher legitimately lists every shop this person
  // belongs to, so B's name is on screen by design while A is open. My first
  // version asserted over the whole document and failed on the switcher — a
  // false positive that would have taught the next reader to weaken the check.
  // What must never happen is B's DATA rendering under A's URL, which is what
  // a query cache keyed without the org id produces.
  await expect(page.getByRole("main").getByText(nameB)).toHaveCount(0);

  // ── and the URL is the source of truth, not the click ────────────────────
  // Navigating straight to B — a bookmark, a second tab, a shared link — must
  // land in B, not in whatever the app happened to remember.
  await page.goto(`/o/${orgB}`);
  await expect(page.getByRole("main").getByText(nameB).first()).toBeVisible();
  await expect(page.getByRole("main").getByText(nameA)).toHaveCount(0);
});

test("E-02b · the switcher lists both shops and marks the current one in WORDS", async () => {
  // §14: never colour or a tick alone. A screen reader user picks the shop
  // they are already in by reading, or not at all. Runs after E-02, which
  // left two shops on this account.
  await openSwitcher(page);

  await expect(page.getByRole("link", { name: new RegExp(nameA) })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(nameB) })).toBeVisible();
  // The current shop carries the words, next to the name — not a tick, not a
  // colour (§14).
  await expect(page.getByText("(ร้านที่ใช้อยู่)")).toBeVisible();
});
