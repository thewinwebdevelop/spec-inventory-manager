import { test, expect } from "@playwright/test";
import { measureResponsive } from "./responsive";

/**
 * Self-test for the responsive checker (D-038 ②). A checker that never finds
 * anything passes every screen — so it must be shown to catch both defects on a
 * page built to have them, and to stay quiet on a page built not to.
 * No server needed: `setContent` only.
 */
test.describe("responsive checker self-test", () => {
  test("catches body horizontal scroll and a sub-44px button", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.setContent(`
      <body style="margin:0">
        <div style="width:900px;height:10px">too wide</div>
        <button style="width:120px;height:30px">เล็กไป</button>
        <button style="width:120px;height:44px">พอดี</button>
      </body>`);
    const r = await measureResponsive(page);
    expect(r.horizontalOverflowPx).toBeGreaterThan(0);
    expect(r.smallTargets).toEqual([expect.stringContaining("เล็กไป")]);
  });

  test("control: wide content inside its own overflow-x box, all targets ≥44px → clean", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.setContent(`
      <body style="margin:0">
        <div style="overflow-x:auto;width:100%"><div style="width:1400px;height:10px">table</div></div>
        <a href="#" style="display:inline-block;min-height:44px;min-width:44px">ลิงก์</a>
        <input aria-label="ชื่อ" style="height:44px;width:200px" />
        <input type="hidden" />
        <button style="display:none">ซ่อน</button>
      </body>`);
    const r = await measureResponsive(page);
    expect(r).toEqual({ horizontalOverflowPx: 0, smallTargets: [] });
  });
});
