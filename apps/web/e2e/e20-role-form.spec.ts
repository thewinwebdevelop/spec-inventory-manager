import { type Page, type Request } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  acceptInvite,
  createShop,
  freshEmail,
  invite,
  login,
  openMembers,
  readShared,
  resetIpThrottle,
  ROLE_WRITES_ON,
  shopNav,
  signUpAndLogin,
} from "./helpers";
import { expectResponsive } from "./responsive";

/**
 * EW3 (R3) — T-003-W06: the role form in its three modes against the REAL
 * server with `ROLE_WRITES_ENABLED=true`.
 *
 * Use cases (each at chromium 1280 + tablet 768):
 *  - EW3-01 (R3 half) clone from the menu: R1 → R2 template "พนักงาน" → R3
 *    prefilled ("สำเนาของ พนักงาน", the source's ticks, no full_access /
 *    access_accounting row, "เร็ว ๆ นี้" badges) → create → R1 + toast
 *  - create from blank: client checks, then the server's name refusals
 *    (reserved label 409 ROLE_NAME_TAKEN, invisible character 422
 *    VALIDATION_FAILED) under the field, then success
 *  - edit name only → the PATCH body has no `capabilities`
 *  - edit capabilities only on "ผู้ดูแล" (a TRANSLATED name) → the PATCH body
 *    has no `name` (ux R3 ⚠️)
 *  - imply-lock (catalog with an injected imply pair — see that test)
 *  - leave with unsaved edits: ← link, sidebar menu, ยกเลิก
 *  - 409 ROLE_CHANGED: another session saves first → banner + latest version,
 *    the PATCH was sent exactly once (SR-14)
 *  - an Admin: a capability they lack is disabled with the reason
 *  - ?from= the Owner role (not cloneable) → blank form + banner
 *  - a role the viewer may not edit (Owner, role_locked) → read-only, no save
 *
 * ⚠️ Needs the API booted with ROLE_WRITES_ENABLED=true AND
 * E2E_ROLE_WRITES=on in the runner's env; otherwise the whole file is skipped
 * (the writes-off half is e21). The two must agree — a mismatch fails loudly
 * on the first create.
 */
test.describe.configure({ mode: "serial" });
test.skip(!ROLE_WRITES_ON, "needs a server with ROLE_WRITES_ENABLED=true (E2E_ROLE_WRITES=on)");

let ownerPage: Page;
let adminPage: Page;
let orgId = "";
const adminEmail = freshEmail("form-admin");
const ROLES_PATH = /\/orgs\/[^/]+\/roles\/[^/?]+$/;

type RoleWrite = { method: string; path: string; body: Record<string, unknown> | null };

/**
 * What the APP sent on each role write. The org client sends a cloned
 * `Request` whose body is a stream, which Chromium does not expose as
 * `request.postData()` — so the page's own `fetch` is wrapped (before any
 * script runs) and each role write's body is read from a clone. Read-only:
 * the request goes out unchanged.
 */
async function recordRoleWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __roleWrites: unknown[]; fetch: typeof fetch };
    const original = w.fetch.bind(window);
    w.__roleWrites = [];
    w.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const req = input instanceof Request ? input : new Request(input, init);
        const path = new URL(req.url, location.href).pathname;
        if (req.method !== "GET" && /\/orgs\/[^/]+\/roles(\/[^/]+)?$/.test(path)) {
          const text = await req.clone().text();
          w.__roleWrites.push({ method: req.method, path, body: text ? JSON.parse(text) : null });
        }
      } catch {
        /* recording must never break the app */
      }
      return original(input as RequestInfo, init);
    };
  });
}

async function lastRoleWrite(page: Page, method: string): Promise<RoleWrite> {
  const all = (await page.evaluate(
    () => (window as unknown as { __roleWrites: unknown[] }).__roleWrites,
  )) as RoleWrite[];
  const hit = all.filter((w) => w.method === method).at(-1);
  expect(hit, `no ${method} role write was recorded`).toBeTruthy();
  return hit!;
}

test.beforeAll(async ({ browser }) => {
  await resetIpThrottle();
  ownerPage = await browser.newContext().then((c) => c.newPage());
  await recordRoleWrites(ownerPage);
  adminPage = await browser.newContext().then((c) => c.newPage());
  await login(ownerPage, readShared().email);
  orgId = await createShop(ownerPage, `ร้านฟอร์มบทบาท ${Date.now()}`);
});

test.afterAll(async () => {
  await ownerPage.close();
  await adminPage.close();
});

async function openRoles(page: Page): Promise<void> {
  const nav = await shopNav(page);
  await nav.getByRole("link", { name: "บทบาทและสิทธิ์" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "บทบาทและสิทธิ์" })).toBeVisible();
  await expect(page.getByText(/^ใช้ไป \d+ จาก/)).toBeVisible({ timeout: 20_000 });
}

async function openRole(page: Page, name: RegExp): Promise<void> {
  await openRoles(page);
  await page.getByRole("link", { name }).click();
  // R3 (a name field) or R4 (no field — a "สิทธิ์ของบทบาทนี้" heading either way).
  await expect(page.getByRole("heading", { level: 2, name: "สิทธิ์ของบทบาทนี้" })).toBeVisible({
    timeout: 20_000,
  });
}

const nameBox = (page: Page) => page.getByRole("textbox", { name: "ชื่อบทบาท" });
/** R3a (W07): the confirm dialog's own save button. */
async function confirmSave(page: Page): Promise<void> {
  const dialog = page.getByRole("alertdialog", { name: /^บันทึกการเปลี่ยนสิทธิ์ของ/ });
  await dialog.getByRole("button", { name: /^บันทึก/ }).click();
}
const row = (page: Page, label: string) =>
  page.getByRole("checkbox", { name: new RegExp(`^${label}`) });

test("EW3-01 · clone from the menu: R2 template → R3 prefilled → create → R1 + toast", async () => {
  const page = ownerPage;
  await openRoles(page);
  await page.getByRole("button", { name: "สร้างบทบาท" }).click();
  const dialog = page.getByRole("dialog", { name: "สร้างบทบาทใหม่" });
  await dialog.getByRole("radio", { name: /^พนักงาน/ }).check();
  await dialog.getByRole("button", { name: "ถัดไป" }).click();

  await expect(page).toHaveURL(new RegExp(`/o/${orgId}/settings/roles/new\\?from=`));
  await expect(page.getByRole("heading", { level: 1, name: "สร้างบทบาทใหม่" })).toBeVisible();
  await expect(page.getByText('เริ่มจากสำเนาของ "พนักงาน"')).toBeVisible();
  await expect(nameBox(page)).toHaveValue("สำเนาของ พนักงาน");
  // Staff = manage_products + manage_stock + manage_orders (system blueprint).
  await expect(row(page, "จัดการสินค้า")).toBeChecked();
  await expect(row(page, "จัดการสต๊อก")).toBeChecked();
  await expect(row(page, "จัดการออเดอร์และการแพ็ค")).toBeChecked();
  await expect(page.getByText("เลือกแล้ว 3 จาก")).toBeVisible();
  // AC-7.4 / §0.4: never offered — full_access (selectable=false), access_accounting (tier full, hidden).
  await expect(page.getByRole("checkbox", { name: /ทำได้ทุกอย่าง/ })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /เข้าถึงระบบบัญชี/ })).toHaveCount(0);
  await expect(page.getByText("เร็ว ๆ นี้", { exact: true }).first()).toBeVisible();
  await expectResponsive(page, "R3 clone");

  await row(page, "ดูต้นทุนและกำไร").click();
  await page.getByRole("button", { name: "สร้างบทบาท" }).click();
  await expect(page.getByText('สร้างบทบาท "สำเนาของ พนักงาน" แล้ว')).toBeVisible({
    timeout: 20_000,
  });
  expect((await lastRoleWrite(page, "POST")).body).toEqual({
    name: "สำเนาของ พนักงาน",
    capabilities: ["manage_orders", "manage_products", "manage_stock", "view_financials"],
  });
  await expect(page).toHaveURL(new RegExp(`/o/${orgId}/settings/roles$`));
  const created = page.getByRole("link", { name: /สำเนาของ พนักงาน/ });
  await expect(created).toContainText("ยังไม่มีสมาชิกใช้");
  await expect(page.getByText("ใช้ไป 4 จาก")).toBeVisible();
});

test("R3 create from blank · client checks, then the server's name refusals under the field, then success", async () => {
  const page = ownerPage;
  await openRoles(page);
  await page.getByRole("button", { name: "สร้างบทบาท" }).click();
  const dialog = page.getByRole("dialog", { name: "สร้างบทบาทใหม่" });
  await dialog.getByRole("radio", { name: /^เริ่มจากว่าง/ }).check();
  await dialog.getByRole("button", { name: "ถัดไป" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${orgId}/settings/roles/new$`));
  await expect(nameBox(page)).toHaveValue("");
  await expect(nameBox(page)).toHaveAttribute("placeholder", "เช่น พนักงานแพ็คของ");
  await expect(page.getByText("เลือกแล้ว 0 จาก")).toBeVisible();

  // Client checks — nothing is sent.
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/orgs\/[^/]+\/roles$/.test(r.url())) posts++;
  });
  await page.getByRole("button", { name: "สร้างบทบาท" }).click();
  await expect(page.getByText("กรอกชื่อบทบาท")).toBeVisible();
  await expect(page.getByText("เลือกสิทธิ์อย่างน้อย 1 อย่าง")).toBeVisible();
  expect(posts).toBe(0);

  // 409 ROLE_NAME_TAKEN — "ผู้ดูแล" is a reserved system label.
  await nameBox(page).fill("ผู้ดูแล");
  await row(page, "จัดการสต๊อก").click();
  await page.getByRole("button", { name: "สร้างบทบาท" }).click();
  await expect(page.getByText(/ชื่อนี้ใช้ไม่ได้ เพราะซ้ำกับบทบาทที่มีอยู่แล้ว/)).toBeVisible();
  await expect(nameBox(page)).toBeFocused();

  // 422 VALIDATION_FAILED fieldErrors.name — a zero-width space (Cf) pasted in.
  await nameBox(page).fill("แพ็ค​ของ");
  await page.getByRole("button", { name: "สร้างบทบาท" }).click();
  await expect(page.getByText(/อักขระที่มองไม่เห็น/)).toBeVisible();
  expect(posts).toBe(2);
  await expectResponsive(page, "R3 create with field errors");

  await nameBox(page).fill("แพ็คของ");
  await page.getByRole("button", { name: "สร้างบทบาท" }).click();
  await expect(page.getByText('สร้างบทบาท "แพ็คของ" แล้ว')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: /แพ็คของ/ })).toBeVisible();
});

test("R3 edit · a rename sends `name` only — no `capabilities`", async () => {
  const page = ownerPage;
  await openRole(page, /^แพ็คของ/);
  await expect(page.getByRole("heading", { level: 1, name: "แพ็คของ" })).toBeVisible();
  await expect(page.getByText("เปลี่ยนชื่อได้ ชื่อใหม่จะแสดงแทนชื่อเดิมทุกหน้าจอ")).toBeVisible();
  const save = page.getByRole("button", { name: "บันทึก", exact: true });
  await expect(save).toBeDisabled();
  await expectResponsive(page, "R3 edit");

  await nameBox(page).fill("พนักงานแพ็คของ");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('บันทึกบทบาท "พนักงานแพ็คของ" แล้ว')).toBeVisible({
    timeout: 20_000,
  });
  expect((await lastRoleWrite(page, "PATCH")).body).toEqual({
    version: expect.any(Number),
    name: "พนักงานแพ็คของ",
  });
  await expect(page.getByRole("heading", { level: 1, name: "พนักงานแพ็คของ" })).toBeVisible();
  await expect(page.getByText(/^แก้ไขล่าสุดโดยคุณ · /)).toBeVisible();
  await expect(save).toBeDisabled();
});

test("R3 edit · capabilities only on 'ผู้ดูแล' — the translated name is NOT sent back (ux R3 ⚠️)", async () => {
  const page = ownerPage;
  await openRole(page, /^ผู้ดูแล/);
  await expect(nameBox(page)).toHaveValue("ผู้ดูแล");
  // Take one away: afterwards the Admin lacks manage_channels AND manage_billing
  // (used by the Admin test below).
  await row(page, "เชื่อมต่อช่องทางขาย").click();
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  // R3a (W07) asks first for a capability change — e22 covers the dialog itself.
  await confirmSave(page);
  await expect(page.getByText('บันทึกบทบาท "ผู้ดูแล" แล้ว')).toBeVisible({ timeout: 20_000 });
  const body = (await lastRoleWrite(page, "PATCH")).body!;
  expect(Object.keys(body).sort()).toEqual(["capabilities", "version"]);
  expect(body.capabilities).not.toContain("manage_channels");
  await expect(row(page, "เชื่อมต่อช่องทางขาย")).not.toBeChecked();
  // Still the translation — the role was not marked renamed.
  await expect(page.getByRole("heading", { level: 1, name: "ผู้ดูแล" })).toBeVisible();
});

test("R3 · imply-lock: ticking manage_X locks view_X; unticking manage_X unlocks it but keeps it ticked", async () => {
  // ⚠️ The production registry has NO imply pair yet (every `implies` is []),
  // so the real server cannot produce this state. The catalog READ is taken
  // from the real server and ONE edge is added (manage_products → manage_stock)
  // to drive the UI; nothing is submitted, so no server behaviour is faked.
  const page = ownerPage;
  await page.route(/\/orgs\/[^/]+\/capabilities$/, async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    for (const item of json.items) {
      if (item.key === "manage_products") item.implies = ["manage_stock"];
    }
    await route.fulfill({ response: res, json });
  });
  try {
    // A full load: the catalog is cached per shop for the session, so an
    // in-app navigation would never ask for it again.
    await resetIpThrottle();
    await page.goto(`/o/${orgId}/settings/roles/new`);
    await expect(page.getByText("เลือกแล้ว 0 จาก")).toBeVisible({ timeout: 20_000 });

    await row(page, "จัดการสินค้า").click();
    const stock = row(page, "จัดการสต๊อก");
    await expect(stock).toBeChecked();
    await expect(stock).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("มาพร้อมสิทธิ์จัดการ")).toBeVisible();
    // A click on the locked row changes nothing.
    await stock.click({ force: true });
    await expect(stock).toBeChecked();

    await row(page, "จัดการสินค้า").click();
    await expect(stock).toBeChecked();
    await expect(stock).not.toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("มาพร้อมสิทธิ์จัดการ")).toHaveCount(0);
    await expectResponsive(page, "R3 imply-lock");

    // Leave without saving (the prompt is covered in its own test).
    await page.getByRole("button", { name: "ยกเลิก" }).click();
    await page.getByRole("button", { name: "ทิ้งการแก้ไข" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${orgId}/settings/roles$`));
  } finally {
    await page.unroute(/\/orgs\/[^/]+\/capabilities$/);
  }
});

test("R3 · leaving with unsaved edits: ← link, the sidebar menu and ยกเลิก all ask first", async () => {
  const page = ownerPage;
  await openRole(page, /^พนักงานแพ็คของ/);
  await nameBox(page).fill("ชื่อที่ยังไม่บันทึก");

  // ← link
  await page.getByRole("link", { name: "บทบาทและสิทธิ์" }).first().click();
  const prompt = page.getByRole("alertdialog", { name: "ทิ้งการแก้ไขนี้?" });
  await expect(prompt).toBeVisible();
  await expect(
    prompt.getByText("สิ่งที่แก้ไว้ยังไม่ได้บันทึก ออกจากหน้านี้แล้วจะหายไป"),
  ).toBeVisible();
  await expect(prompt.getByRole("button", { name: "แก้ต่อ" })).toBeFocused();
  await expectResponsive(page, "R3 leave prompt");
  await prompt.getByRole("button", { name: "แก้ต่อ" }).click();
  await expect(prompt).toHaveCount(0);
  await expect(nameBox(page)).toHaveValue("ชื่อที่ยังไม่บันทึก");
  await expect(page).toHaveURL(/\/settings\/roles\/[^/]+$/);

  // sidebar menu (a drawer below lg)
  const nav = await shopNav(page);
  await nav.getByRole("link", { name: "ข้อมูลร้าน" }).click();
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "แก้ต่อ" }).click();
  await expect(page).toHaveURL(/\/settings\/roles\/[^/]+$/);
  const close = page.getByRole("button", { name: "ปิดเมนู", exact: true });
  if (await close.isVisible()) await close.click();

  // ยกเลิก → discard
  await page.getByRole("button", { name: "ยกเลิก" }).click();
  await prompt.getByRole("button", { name: "ทิ้งการแก้ไข" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${orgId}/settings/roles$`));
  await expect(page.getByRole("link", { name: /พนักงานแพ็คของ/ })).toBeVisible();
  await expect(page.getByText("ชื่อที่ยังไม่บันทึก")).toHaveCount(0);
});

test("R3 · 409 ROLE_CHANGED: someone saved first → latest version + banner, the PATCH was sent ONCE (SR-14)", async ({
  browser,
}) => {
  const page = ownerPage;
  await openRole(page, /^พนักงานแพ็คของ/);
  await expect(nameBox(page)).toHaveValue("พนักงานแพ็คของ");

  // A second session of the same Owner saves first.
  await resetIpThrottle();
  const other = await browser.newContext().then((c) => c.newPage());
  try {
    await login(other, readShared().email);
    await other.goto(`/o/${orgId}/settings/roles`);
    await expect(other.getByText(/^ใช้ไป \d+ จาก/)).toBeVisible({ timeout: 20_000 });
    await other.getByRole("link", { name: /พนักงานแพ็คของ/ }).click();
    await nameBox(other).fill("แพ็คของรอบเช้า");
    await other.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(other.getByText('บันทึกบทบาท "แพ็คของรอบเช้า" แล้ว')).toBeVisible({
      timeout: 20_000,
    });
  } finally {
    await other.close();
  }

  // Now the first session saves on the version it loaded.
  const patches: Request[] = [];
  page.on("request", (r) => {
    if (r.method() === "PATCH" && ROLES_PATH.test(r.url())) patches.push(r);
  });
  await row(page, "ดูต้นทุนและกำไร").click();
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await confirmSave(page);

  await expect(page.getByText("มีคนแก้บทบาทนี้ไปก่อนคุณ")).toBeVisible({ timeout: 20_000 });
  await expect(nameBox(page)).toHaveValue("แพ็คของรอบเช้า");
  await expect(row(page, "ดูต้นทุนและกำไร")).not.toBeChecked();
  // Give any automatic resubmit every chance to happen — it must not.
  await page.waitForTimeout(1_500);
  expect(patches).toHaveLength(1);
  await expectResponsive(page, "R3 after ROLE_CHANGED");
});

test("R3 · an Admin sees a capability they lack disabled with the reason (the server still decides)", async () => {
  await openMembers(ownerPage, orgId);
  const link = await invite(ownerPage, adminEmail, "ผู้ดูแล");
  await ownerPage
    .getByRole("dialog", { name: "ลิงก์คำเชิญพร้อมแล้ว" })
    .getByRole("button", { name: "เสร็จแล้ว" })
    .click();
  await resetIpThrottle();
  await signUpAndLogin(adminPage, adminEmail);
  await acceptInvite(adminPage, link);
  await adminPage.getByRole("link", { name: "เริ่มใช้งานร้านนี้" }).click();
  await expect(adminPage).toHaveURL(new RegExp(`/o/${orgId}`), { timeout: 20_000 });

  await openRoles(adminPage);
  await adminPage.getByRole("button", { name: "สร้างบทบาท" }).click();
  const dialog = adminPage.getByRole("dialog", { name: "สร้างบทบาทใหม่" });
  await dialog.getByRole("radio", { name: /^เริ่มจากว่าง/ }).check();
  await dialog.getByRole("button", { name: "ถัดไป" }).click();

  // Admin now = blueprint minus manage_channels; never had manage_billing.
  const lacks = "คุณไม่มีสิทธิ์นี้ จึงให้บทบาทอื่นไม่ได้";
  for (const label of ["จัดการแพ็กเกจและการชำระเงิน", "เชื่อมต่อช่องทางขาย"]) {
    const r = row(adminPage, label);
    await expect(r).toHaveAttribute("aria-disabled", "true");
    await expect(r).toHaveAccessibleDescription(new RegExp(lacks));
    await r.click({ force: true });
    await expect(r).not.toBeChecked();
  }
  // Control: what the Admin holds stays tickable.
  const members = row(adminPage, "จัดการสมาชิกและคำเชิญ");
  await expect(members).not.toHaveAttribute("aria-disabled", "true");
  await members.click();
  await expect(members).toBeChecked();
  await expectResponsive(adminPage, "R3 as Admin");
});

test("R3 · ?from= the Owner role (not cloneable) → blank form + 'เริ่มจากว่างแทน' banner", async () => {
  const page = ownerPage;
  await openRoles(page);
  const ownerHref = await page.getByRole("link", { name: /^เจ้าของร้าน/ }).getAttribute("href");
  const ownerId = decodeURIComponent(ownerHref!.split("/").pop()!);
  await page.goto(`/o/${orgId}/settings/roles/new?from=${encodeURIComponent(ownerId)}`);
  await expect(page.getByText("ใช้บทบาทนี้เป็นต้นแบบไม่ได้แล้ว เริ่มจากว่างแทน")).toBeVisible({
    timeout: 20_000,
  });
  await expect(nameBox(page)).toHaveValue("");
  await expect(page.getByText("เลือกแล้ว 0 จาก")).toBeVisible();
});

test("R3/R4 · a role the viewer may not edit (Owner, role_locked) is read-only — no field, no save", async () => {
  const page = ownerPage;
  await openRole(page, /^เจ้าของร้าน/);
  await expect(page.getByText("บทบาทเจ้าของร้านถูกล็อกไว้")).toBeVisible();
  await expect(page.getByText("ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)")).toBeVisible();
  await expect(nameBox(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "บันทึก", exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expectResponsive(page, "R4 Owner (interim)");
});
