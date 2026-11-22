import { test as base, expect } from "@playwright/test";
import { expectResponsive, measureResponsive } from "./responsive";

/** Routes designed for phone width: the public invite page (§8.3) and the auth card (§8.2). */
const PHONE_DESIGNED_ROUTES = /^\/(invite|login|signup)(\/|$)/;

/**
 * The lane's `test` — identical to Playwright's, plus one automatic check
 * (D-038 ②): when a journey PASSES, the screen it ended on must not scroll
 * sideways and must have no tap target under 44px, at whatever width the
 * project runs (chromium 1280 · tablet 768 · phone 390).
 *
 * Most journeys here drive several people at once through their own
 * `browser.newPage()` (owner + invitee …), not the `page` fixture — so the
 * guard checks EVERY page still open in the browser, not just `page`.
 *
 * Specs still call `expectResponsive` on the screens in between that matter;
 * this guard only makes sure no journey can finish without the check at all.
 * A failed journey is not re-judged here (its own failure is the signal), and
 * pages that never left about:blank (API-only specs) are skipped.
 */
export const test = base.extend<{ responsiveGuard: void }>({
  responsiveGuard: [
    async ({ browser }, use, testInfo) => {
      await use();
      if (testInfo.status !== testInfo.expectedStatus) return;
      const phone = testInfo.project.name === "phone";
      const pages = browser.contexts().flatMap((c) => c.pages());
      for (const p of pages) {
        if (p.isClosed() || p.url() === "about:blank") continue;
        const path = new URL(p.url()).pathname;
        const where = `final screen of "${testInfo.title}" [${testInfo.project.name}] ${path}`;
        // design-system §8.1/§8.3: at phone width only the public + auth routes
        // are designed for; a logged-in route there must merely not break.
        if (phone && !PHONE_DESIGNED_ROUTES.test(path)) {
          const r = await measureResponsive(p);
          expect(r.horizontalOverflowPx, `${where}: page scrolls sideways`).toBe(0);
          continue;
        }
        await expectResponsive(p, where);
      }
    },
    { auto: true },
  ],
});

export { expect };
