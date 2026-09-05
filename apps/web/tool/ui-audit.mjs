/**
 * §8.4 items 1–2, as a command instead of an intention.
 *
 * design-system.md §8.4 requires, before any mockup sign-off:
 *   1. responsive checked at ≥2 points (desktop + tablet)
 *   2. EVERY tap target counted against `size.tap-target.min` (44px) —
 *      "นับจริง ไม่ใช่กะด้วยตา", because the first round of F-002 missed 27
 *      of them by eyeballing
 *
 * Nobody could run that, so nobody did. This does, and it found real ones on
 * 2026-09-01: an 18px "ย้อนกลับ", three onboarding CTAs at 17–18px living
 * inside sentences where they could never be 44px tall, and a 22px retry.
 *
 * It is NOT wired into CI: it needs a booted stack and a seeded account, the
 * same as the browser lane. Run it by hand before a UI sign-off:
 *
 *   ORG=<orgId> node apps/web/tool/ui-audit.mjs
 *
 * ⚠️ Three things this harness got WRONG before it got them right, all of
 * which produced confident numbers about the wrong page:
 *   · it measured at a fixed 1200ms and caught the 401→refresh→retry mid-flight;
 *   · it measured bare <input>s instead of the <label> that is actually the
 *     hit area, reporting violations a user cannot experience;
 *   · it logged in often enough to trip F-001's per-IP throttle (counter hit
 *     38) and then measured the login page for every screen.
 * The `bounced to /login` guard exists because of the third one: a measurement
 * tool that cannot tell you it measured the wrong thing is worse than none.
 */
// §8.4 item 2 — COUNT every tap target, at both breakpoints, on every screen.
import { chromium } from '@playwright/test';
import Redis from 'ioredis';

/**
 * Clear F-001's per-IP pre-auth counter between passes — the same thing
 * `e2e/helpers.ts` does between spec files, and the reason `ioredis` is a dev
 * dependency. Without it this audit logs in often enough to throttle ITSELF,
 * every screen bounces to /login, and the run reports a page it never meant to
 * measure. (Which it did, twice, before I looked at the counter: it was 38.)
 */
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:56379');
const clearThrottle = async () => {
  const keys = await redis.keys('throttle:*');
  if (keys.length) await redis.del(...keys);
};
const ORG = process.env.ORG;
const BASE = 'http://localhost:3001';
const SCREENS = [
  ['S1 เลือกร้าน', '/select-org', null],
  ['S2 สร้างร้าน', '/orgs/new', null],
  ['S4 ข้อมูลร้าน', `/o/${ORG}`, null],
  ['S5 ฟอร์มภาษี', `/o/${ORG}`, 'แก้ไข'],
  ['S6 สมาชิก', `/o/${ORG}/settings/members`, null],
  ['S7 เชิญสมาชิก', `/o/${ORG}/settings/members`, 'เชิญสมาชิก'],
  ['ความปลอดภัย', '/settings/security', null],
  ['S11 /invite', '/invite?token=not-a-real-token', null],
];
const AUDIT = () => {
  const bad = []; let n = 0;
  document.querySelectorAll('button,a[href],input,select,summary,[role=button]').forEach((el) => {
    // The EFFECTIVE target: a radio or checkbox wrapped in a <label> is hit
    // anywhere in the label, which is how RadioCardGroup gets its 44px.
    // Measuring the bare <input> reported a violation that a user cannot
    // experience.
    const hit = (el.tagName === 'INPUT' && (el.type === 'radio' || el.type === 'checkbox') && el.closest('label')) || el;
    const r = hit.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    n++;
    if (r.height < 44) bad.push({ t: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 26), h: Math.round(r.height) });
  });
  const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  // §8.4 item 3 is about the theme actually CHANGING — a dark pass that paints
  // the light palette passes every other check while proving nothing.
  const cs = getComputedStyle(document.body);
  return { n, bad, overflow, sw: document.documentElement.scrollWidth, iw: window.innerWidth,
           bg: cs.backgroundColor, fg: cs.color };
};
/**
 * §8.4 item 1 — desktop + tablet, "+ ~390px ถ้าเป็น route ตาม §8.3".
 * §8.3 puts only PUBLIC routes opened from a chat link (`/invite`) in phone
 * scope; a logged-in route on a phone is out of scope and only has to not
 * break badly, which here means no horizontal scroll.
 * §8.4 item 3 — BOTH themes. `colorScheme` drives `prefers-color-scheme`.
 */
const PASSES = [
  [1280, 'light', 'desktop ≥lg'],
  [820, 'light', 'tablet md'],
  [390, 'light', 'phone 390 (§8.3: /invite in scope; rest must merely not break)'],
  [1280, 'dark', 'desktop ≥lg · DARK'],
  [390, 'dark', 'phone 390 · DARK'],
];
const browser = await chromium.launch();
for (const [w, scheme, label] of PASSES) {
  await clearThrottle();
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', 'owner@omnistock.test');
  await page.fill('input[type=password]', 'dogfood-pass-2026');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  console.log(`\n===== ${label} (${w}px) =====`);
  for (const [name, path, opener] of SCREENS) {
    await clearThrottle();
    await page.goto(BASE + path).catch(() => {});
    // Wait for the network to SETTLE, not a guessed number of milliseconds:
    // a cold load answers 401 -> /auth/refresh -> retry (F-001's designed
    // flow), and measuring at a fixed 1200ms caught the error state mid-retry
    // and reported it as the screen. Three harness bugs in a row now, all of
    // them producing confident wrong numbers.
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(400);
    if (opener) {
      const btn = page.locator(`button:has-text("${opener}")`).first();
      if (await btn.count()) { await btn.click().catch(()=>{}); await page.waitForTimeout(900); }
    }
    const r = await page.evaluate(AUDIT);
    if (page.url().includes('/login')) { console.log(`  ${name.padEnd(18)} \u26a0\ufe0f  bounced to /login \u2014 NOT MEASURED`); continue; }
    const flags = [];
    if (r.bad.length) flags.push(`❌ ${r.bad.length} tap<44`);
    if (r.overflow) flags.push(`❌ h-scroll ${r.sw}>${r.iw}`);
    console.log(`  ${name.padEnd(18)} targets=${String(r.n).padStart(3)}  bg=${r.bg.replace(/\s/g, '')}  ${flags.length ? flags.join(' · ') : '✅'}`);
    r.bad.forEach((b) => console.log(`      ↳ ${b.h}px  "${b.t}"`));
  }
  await ctx.close();
}
await browser.close();
await redis.quit();
