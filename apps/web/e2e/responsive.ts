import { expect, type Page } from "@playwright/test";

/**
 * D-038 ② — the two responsive rules a browser can check mechanically
 * (design-system §8.2 / §8.4):
 *  - "ทุกจอห้าม body scroll แนวนอน" — wide content (tables, code) scrolls inside
 *    its own `overflow-x:auto` box, never the page.
 *  - "tap target ≥ 44px" (`size.tap-target.min`) — counted, not eyeballed;
 *    F-002's first pass missed 27 of these because nobody counted.
 *
 * Layout taste (padding, alignment, Thai wrapping) is NOT checkable here —
 * that is the manual pass, WEB_TEAM §3.6.1 ③.
 */
export interface ResponsiveReport {
  /** How far the document is wider than the viewport, in px (0 = fine). */
  horizontalOverflowPx: number;
  /** Visible interactive elements under 44×44px, as `tag "label" WxH`. */
  smallTargets: string[];
}

export const TAP_TARGET_MIN = 44;

export async function measureResponsive(page: Page): Promise<ResponsiveReport> {
  return page.evaluate((min) => {
    const doc = document.scrollingElement ?? document.documentElement;
    const horizontalOverflowPx = Math.max(0, doc.scrollWidth - doc.clientWidth);

    const selector = [
      "button",
      "a[href]",
      "[role=button]",
      "[role=link]",
      "[role=tab]",
      "[role=menuitem]",
      "[role=checkbox]",
      "[role=radio]",
      "input:not([type=hidden])",
      "select",
      "textarea",
      "summary",
    ].join(",");

    const smallTargets: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const own = el.getBoundingClientRect();
      if (own.width === 0 && own.height === 0) continue; // not rendered
      // A native checkbox/radio sits inside a ≥44px label row; the row is what
      // a finger hits, so judge the label.
      const target =
        el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")
          ? ((el.closest("label") as HTMLElement | null) ?? el)
          : el;
      const box = target.getBoundingClientRect();
      if (Math.round(box.width) < min || Math.round(box.height) < min) {
        const label = (
          target.getAttribute("aria-label") ??
          target.textContent ??
          target.getAttribute("name") ??
          ""
        )
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 40);
        smallTargets.push(
          `${target.tagName.toLowerCase()} "${label}" ${Math.round(box.width)}x${Math.round(box.height)}`,
        );
      }
    }
    return { horizontalOverflowPx, smallTargets };
  }, TAP_TARGET_MIN);
}

/** Assert both rules on whatever screen the page shows now. */
export async function expectResponsive(page: Page, screen: string): Promise<void> {
  const r = await measureResponsive(page);
  expect(r.horizontalOverflowPx, `${screen}: page scrolls sideways`).toBe(0);
  expect(r.smallTargets, `${screen}: tap targets under ${TAP_TARGET_MIN}px`).toEqual([]);
}
