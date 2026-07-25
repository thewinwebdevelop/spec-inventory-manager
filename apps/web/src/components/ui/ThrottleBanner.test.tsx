import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThrottleBanner } from "./ThrottleBanner";

describe("ThrottleBanner (D-005 + tabular-nums, ux-wireframe §3.2)", () => {
  it("renders the short-form countdown copy", () => {
    render(<ThrottleBanner remainingSeconds={45} />);
    expect(screen.getByText(/เหลือ 45 วินาที/)).toBeInTheDocument();
  });

  it("renders the long-form mm:ss copy above 60s", () => {
    render(<ThrottleBanner remainingSeconds={107} />);
    expect(screen.getByText(/เหลือ 01:47 นาที/)).toBeInTheDocument();
  });

  it("renders the helper line explaining the auto-recovery (anti-anxiety copy)", () => {
    render(<ThrottleBanner remainingSeconds={30} />);
    expect(
      screen.getByText("เพื่อความปลอดภัยของบัญชีคุณ ระบบจะให้ลองใหม่ได้เองเมื่อครบเวลา"),
    ).toBeInTheDocument();
  });

  it("uses the tabular-nums class on the countdown text (no layout jitter)", () => {
    render(<ThrottleBanner remainingSeconds={45} />);
    const banner = screen.getByTestId("throttle-banner");
    const tabularEl = banner.querySelector(".tabular-nums");
    expect(tabularEl).not.toBeNull();
    expect(tabularEl?.textContent).toMatch(/เหลือ 45 วินาที/);
  });

  it("never renders forbidden lockout language", () => {
    render(<ThrottleBanner remainingSeconds={45} />);
    const banner = screen.getByTestId("throttle-banner");
    expect(banner.textContent).not.toMatch(/ล็อก|ระงับ|แบน/);
  });

  it("uses role=status (not role=alert — this is a calm/warning state, not danger)", () => {
    render(<ThrottleBanner remainingSeconds={45} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
