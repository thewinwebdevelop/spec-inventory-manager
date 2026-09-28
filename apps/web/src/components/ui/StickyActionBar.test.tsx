import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StickyActionBar } from "./StickyActionBar";

describe("StickyActionBar (ui.md §2.3, F-003)", () => {
  it("renders its children (the action buttons)", () => {
    render(
      <StickyActionBar>
        <button type="button">ยกเลิก</button>
        <button type="button">บันทึก</button>
      </StickyActionBar>,
    );
    expect(screen.getByText("ยกเลิก")).toBeInTheDocument();
    expect(screen.getByText("บันทึก")).toBeInTheDocument();
  });

  it("is sticky to the bottom of its own column, not fixed to the viewport", () => {
    const { container } = render(
      <StickyActionBar>
        <button type="button">บันทึก</button>
      </StickyActionBar>,
    );
    const bar = container.firstElementChild;
    expect(bar?.className).toMatch(/\bsticky\b/);
    expect(bar?.className).toMatch(/\bbottom-0\b/);
    expect(bar?.className).not.toMatch(/\bfixed\b/);
  });

  it("never sets its own z-index (ui.md: DOM order, not z)", () => {
    const { container } = render(
      <StickyActionBar>
        <button type="button">บันทึก</button>
      </StickyActionBar>,
    );
    expect(container.innerHTML).not.toMatch(/\bz-/);
  });

  it("carries no shadow utility (ui.md: ไม่มีเงา)", () => {
    const { container } = render(
      <StickyActionBar>
        <button type="button">บันทึก</button>
      </StickyActionBar>,
    );
    expect(container.innerHTML).not.toMatch(/shadow-/);
  });

  it("bottom padding sums space.3 with the safe-area inset", () => {
    const { container } = render(
      <StickyActionBar>
        <button type="button">บันทึก</button>
      </StickyActionBar>,
    );
    const bar = container.firstElementChild;
    expect(bar?.className).toMatch(/pb-\[calc\(12px\+env\(safe-area-inset-bottom\)\)\]/);
  });
});
