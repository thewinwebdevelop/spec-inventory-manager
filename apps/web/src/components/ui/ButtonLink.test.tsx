// D-038 ② found it: every "go somewhere" button was `<Link><Button/></Link>` —
// a <button> inside an <a> (interactive content inside interactive content:
// invalid HTML, announced as two controls), with an inline <a> 18px tall.
// A navigation that looks like a button must be ONE element: the link,
// carrying the button's look and its 44px tap target.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ButtonLink } from "./ButtonLink";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("ButtonLink", () => {
  it("is ONE link — no <button> inside it", () => {
    const { container } = render(<ButtonLink href="/o/org_1">กลับหน้าแรกของร้าน</ButtonLink>);
    const link = screen.getByRole("link", { name: "กลับหน้าแรกของร้าน" });
    expect(link).toHaveAttribute("href", "/o/org_1");
    expect(container.querySelector("a button, button a")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("carries the button look AND the 44px tap target on the link itself", () => {
    render(
      <ButtonLink href="/x" variant="secondary" fullWidth>
        ไป
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "ไป" });
    expect(link.className).toContain("min-h-[var(--size-tap-target-min)]");
    expect(link.className).toContain("inline-flex");
    expect(link.className).toContain("bg-surface"); // secondary
    expect(link.className).toContain("w-full");
  });

  it("passes link props through (onClick still fires)", () => {
    const onClick = vi.fn();
    render(
      <ButtonLink href="/login" onClick={onClick}>
        เข้าสู่ระบบ
      </ButtonLink>,
    );
    screen.getByRole("link", { name: "เข้าสู่ระบบ" }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
