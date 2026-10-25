import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Disclosure } from "./Disclosure";

describe("Disclosure (ui.md §2.2, F-003)", () => {
  it("whole heading row is one button, ≥56px", () => {
    render(
      <Disclosure
        id="team"
        title="ทีมงาน"
        selectedCount={0}
        totalCount={2}
        open
        onOpenChange={() => {}}
      >
        เนื้อหา
      </Disclosure>,
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("min-h-[var(--size-list-row-min-h)]");
  });

  it("exposes aria-expanded matching the open prop", () => {
    render(
      <Disclosure
        id="team"
        title="ทีมงาน"
        selectedCount={0}
        totalCount={2}
        open={false}
        onOpenChange={() => {}}
      >
        เนื้อหา
      </Disclosure>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("accessible name combines the title and the n-of-m count (ui.md §2.2)", () => {
    render(
      <Disclosure
        id="team"
        title="ทีมงาน"
        selectedCount={1}
        totalCount={3}
        open
        onOpenChange={() => {}}
      >
        เนื้อหา
      </Disclosure>,
    );
    expect(screen.getByRole("button", { name: "ทีมงาน, เลือก 1 จาก 3" })).toBeInTheDocument();
  });

  it("calls onOpenChange with the flipped state when clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Disclosure
        id="team"
        title="ทีมงาน"
        selectedCount={0}
        totalCount={2}
        open={false}
        onOpenChange={onOpenChange}
      >
        เนื้อหา
      </Disclosure>,
    );
    await user.click(screen.getByRole("button"));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("hides the panel content when closed", () => {
    render(
      <Disclosure
        id="team"
        title="ทีมงาน"
        selectedCount={0}
        totalCount={2}
        open={false}
        onOpenChange={() => {}}
      >
        <div>เนื้อหาที่ซ่อน</div>
      </Disclosure>,
    );
    expect(screen.getByText("เนื้อหาที่ซ่อน")).not.toBeVisible();
  });

  it("rotates the chevron -90deg when closed and 0 when open", () => {
    const { rerender } = render(
      <Disclosure
        id="team"
        title="ทีมงาน"
        selectedCount={0}
        totalCount={2}
        open={false}
        onOpenChange={() => {}}
      >
        เนื้อหา
      </Disclosure>,
    );
    let icon = screen.getByRole("button").querySelector("svg");
    expect(icon?.getAttribute("class")).toMatch(/-rotate-90/);

    rerender(
      <Disclosure
        id="team"
        title="ทีมงาน"
        selectedCount={0}
        totalCount={2}
        open
        onOpenChange={() => {}}
      >
        เนื้อหา
      </Disclosure>,
    );
    icon = screen.getByRole("button").querySelector("svg");
    expect(icon?.getAttribute("class")).toMatch(/rotate-0/);
  });

  it("respects prefers-reduced-motion (no transition class kept active)", () => {
    render(
      <Disclosure
        id="team"
        title="ทีมงาน"
        selectedCount={0}
        totalCount={2}
        open
        onOpenChange={() => {}}
      >
        เนื้อหา
      </Disclosure>,
    );
    const icon = screen.getByRole("button").querySelector("svg");
    expect(icon?.getAttribute("class")).toMatch(/motion-reduce:transition-none/);
  });
});
