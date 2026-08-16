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
 * ⚠️ THE REVOKE IS AN API CALL, and that is faithful rather than convenient:
 * §12.1 words this row as "ยิง revoke จาก session อื่น" — another session, not
 * this browser. It is also the only way today: W-17 (tasks.md) — the member row
 * renders its actions as `<span>`, so the web UI has no clickable remove. When
 * W-17 lands, the Owner's half becomes a click here and the assertions below do
 * not change.
 */
test.describe.configure({ mode: "serial" });

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3000";

let ownerPage: Page;
let staffPage: Page;
let api: APIRequestContext;
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

  api = await request.newContext({ baseURL: API_ORIGIN });
});

test.afterAll(async () => {
  await api.dispose();
  await ownerPage.close();
  await staffPage.close();
});

test("E-07 · removed while inside the shop: refused at once, and sent to the picker — not to /login", async () => {
  // ── the other session does the removing ─────────────────────────────────
  // A body-transport login (the mobile shape): an access token in the response
  // and no cookies, so this context is a genuinely separate session rather
  // than a copy of the browser's.
  const auth = await api.post("/auth/login", {
    data: { email: readShared().email, password: PASSWORD, tokenTransport: "body" },
  });
  expect(auth.ok(), `the API refused the owner's login: ${auth.status()}`).toBeTruthy();
  const { accessToken } = (await auth.json()) as { accessToken: string };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-Organization-Id": orgId,
  };

  const list = await api.get(`/orgs/${orgId}/members`, { headers });
  expect(list.ok(), `could not read the member list: ${list.status()}`).toBeTruthy();
  const { items } = (await list.json()) as {
    items: { userId: string; email: string; status: string }[];
  };
  const target = items.find((m) => m.email === staffEmail);
  expect(target, `${staffEmail} is not in the member list: ${JSON.stringify(items)}`).toBeTruthy();

  const removed = await api.delete(`/orgs/${orgId}/members/${target!.userId}`, { headers });
  expect(removed.ok(), `the remove was refused: ${removed.status()}`).toBeTruthy();

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
