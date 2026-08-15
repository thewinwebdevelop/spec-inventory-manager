import { expect, test } from "@playwright/test";
import { createShop, freshEmail, signUpAndLogin } from "./helpers";

/**
 * E-02 (test-plan §12.1) — one person, two shops, and no bleed between them.
 *
 * The assertion that matters is not "the switcher works". It is that after
 * switching, what is on screen belongs to the shop in the URL — web.md §3.2
 * puts the org in the path precisely so two tabs can hold two shops, and the
 * failure this catches is a query cache keyed without the org id, which looks
 * perfect until the second shop shows the first one's data.
 */
test("E-02 · switching shops changes the URL and the data with it", async ({ page }) => {
  await signUpAndLogin(page, freshEmail("two-shops"));

  const nameA = `ร้าน ก ${Date.now()}`;
  const orgA = await createShop(page, nameA);
  const nameB = `ร้าน ข ${Date.now()}`;
  const orgB = await createShop(page, nameB);

  expect(orgA, "the two shops must be different").not.toBe(orgB);

  // Created second, so this is where `createShop` left us.
  await expect(page).toHaveURL(new RegExp(`/o/${orgB}`));
  await expect(page.getByText(nameB).first()).toBeVisible();

  // ── switch back to the first ──────────────────────────────────────────────
  // The switcher is a LIST in the sidebar, not a menu that opens: on web the
  // shop is in the URL (web.md §3.2), so switching is following a link. The
  // bottom-sheet-on-tap shape is mobile's (§13).
  await page.getByRole("link", { name: new RegExp(nameA) }).click();

  await expect(page).toHaveURL(new RegExp(`/o/${orgA}`));
  await expect(page.getByText(nameA).first()).toBeVisible();

  // ★ The bleed check: the shop we left must not still be on screen anywhere.
  // A cache keyed by query name alone would leave B's profile rendered under
  // A's URL, and every screenshot would look correct.
  await expect(page.getByText(nameB)).toHaveCount(0);

  // ── and the URL is the source of truth, not the click ────────────────────
  // Navigating straight to B — a bookmark, a second tab, a shared link — must
  // land in B, not in whatever the app happened to remember.
  await page.goto(`/o/${orgB}`);
  await expect(page.getByText(nameB).first()).toBeVisible();
  await expect(page.getByText(nameA)).toHaveCount(0);
});

test("E-02b · the switcher lists both shops and marks the current one in WORDS", async ({
  page,
}) => {
  // §14: never colour or a tick alone. A screen reader user picks the shop
  // they are already in by reading, or not at all.
  await signUpAndLogin(page, freshEmail("switcher"));
  const nameA = `ร้านหนึ่ง ${Date.now()}`;
  await createShop(page, nameA);
  const nameB = `ร้านสอง ${Date.now()}`;
  await createShop(page, nameB);

  await expect(page.getByRole("link", { name: new RegExp(nameA) })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(nameB) })).toBeVisible();
  // The current shop carries the words, next to the name — not a tick, not a
  // colour (§14).
  await expect(page.getByText("(ร้านที่ใช้อยู่)")).toBeVisible();
});
