import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox, CheckboxRow } from "./Checkbox";

describe("Checkbox (ui.md §2.1, F-003)", () => {
  it("renders a real checkbox input, unchecked", () => {
    render(<Checkbox checked={false} onChange={() => {}} />);
    const input = screen.getByRole("checkbox");
    expect(input).not.toBeChecked();
  });

  it("renders checked", () => {
    render(<Checkbox checked onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("checked+enabled box border uses color.primary, not btn.bg (design-system.md §1.3/§9.1 — the two tokens diverge in dark theme, so border-btn-bg would blend into the fill)", () => {
    render(<Checkbox checked onChange={() => {}} />);
    const box = screen.getByRole("checkbox").nextElementSibling;
    expect(box?.getAttribute("class")).toMatch(/\bborder-primary\b/);
    expect(box?.getAttribute("class")).not.toMatch(/\bborder-btn-bg\b/);
  });

  it("calls onChange with the new value when toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("disabled state stays focusable (aria-disabled, not the native attribute)", () => {
    render(<Checkbox checked={false} disabled onChange={() => {}} />);
    const input = screen.getByRole("checkbox");
    expect(input).not.toBeDisabled();
    expect(input).toHaveAttribute("aria-disabled", "true");
    input.focus();
    expect(input).toHaveFocus();
  });

  it("disabled blocks the change even though it is still clickable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox checked={false} disabled onChange={onChange} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("never uses opacity on the visible box to express disabled (⛔ ui.md §2.1 — the reason text next to it must stay fully legible)", () => {
    render(<Checkbox checked disabled onChange={() => {}} />);
    // The decorative box (aria-hidden sibling) carries the visible state —
    // the native input's own `opacity-0` is an unrelated a11y-hiding
    // technique (a real control under a custom-painted box), not a
    // state-communicating opacity, so it is deliberately out of scope here.
    const box = screen.getByRole("checkbox").nextElementSibling;
    expect(box?.getAttribute("class")).not.toMatch(/opacity-/);
  });
});

describe("CheckboxRow (ui.md §2.1, F-003)", () => {
  it("is at least the list-row tap target and the whole row is the label", () => {
    render(<CheckboxRow id="team-a" checked={false} label="ทีม A" onChange={() => {}} />);
    const label = screen.getByText("ทีม A").closest("label");
    expect(label).not.toBeNull();
    expect(label?.className).toContain("min-h-[var(--size-list-row-min-h)]");
  });

  it("clicking the row (not just the box) toggles the checkbox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CheckboxRow id="team-b" checked={false} label="ทีม B" onChange={onChange} />);
    await user.click(screen.getByText("ทีม B"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders description, badge and a lock-icon reason line", () => {
    render(
      <CheckboxRow
        id="team-c"
        checked={false}
        disabled
        label="ทีม C"
        description="คำอธิบาย"
        badge={<span>เร็ว ๆ นี้</span>}
        reason="คุณไม่มีสิทธิ์นี้"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("คำอธิบาย")).toBeInTheDocument();
    expect(screen.getByText("เร็ว ๆ นี้")).toBeInTheDocument();
    expect(screen.getByText("คุณไม่มีสิทธิ์นี้")).toBeInTheDocument();
  });

  it("label text keeps color.text (not muted) even when the row is disabled", () => {
    render(<CheckboxRow id="team-d" checked={false} disabled label="ทีม D" onChange={() => {}} />);
    const labelSpan = screen.getByText("ทีม D");
    expect(labelSpan.className).not.toMatch(/text-text-muted/);
  });

  it("ties the description and reason to the input via aria-describedby", () => {
    render(
      <CheckboxRow
        id="team-e"
        checked={false}
        label="ทีม E"
        description="คำอธิบาย E"
        reason="เหตุผล E"
        onChange={() => {}}
      />,
    );
    const input = screen.getByRole("checkbox");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBe("team-e-description team-e-reason");
  });
});
