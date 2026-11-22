// design-system §9.1 lists `EmptyState` (icon `size.icon.xl` + heading + body +
// 0–2 actions) and it had never been built — S1's empty state was a bare
// heading and paragraph. D-038 ③ (manual pass, D3).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the icon at size.icon.xl in text.muted, decorative", () => {
    const { container } = render(<EmptyState icon="store" title="ว่าง" body="ยังไม่มีอะไร" />);
    const svg = container.querySelector("svg")!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("class")).toContain("--size-icon-xl");
    // §1.6.3: EmptyState is one of the two places an icon names its own colour.
    expect(svg.getAttribute("class")).toContain("text-text-muted");
    // The heading already says it; the icon must not be read out twice.
    expect(svg).toHaveAttribute("aria-hidden", "true");
    // and at xl the stroke drops to 1.5 (§1.2).
    expect(svg).toHaveAttribute("stroke-width", "1.5");
  });

  it("gives the title a heading and the body as text, at the level asked for", () => {
    render(<EmptyState icon="store" title="ว่าง" body="ยังไม่มีอะไร" headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2, name: "ว่าง" })).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มีอะไร")).toBeInTheDocument();
  });

  it("renders its actions under the body, and nothing when there are none", () => {
    const { rerender, container } = render(
      <EmptyState icon="store" title="ว่าง" actions={<button>ทำเลย</button>} />,
    );
    expect(screen.getByRole("button", { name: "ทำเลย" })).toBeInTheDocument();
    rerender(<EmptyState icon="store" title="ว่าง" />);
    expect(container.querySelector("[data-empty-actions]")).toBeNull();
  });
});
