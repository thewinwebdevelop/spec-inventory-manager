import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "./AuthForm";

const baseProps = {
  title: "เข้าสู่ระบบ",
  email: "",
  onEmailChange: () => {},
  password: "",
  onPasswordChange: () => {},
  submitLabel: "เข้าสู่ระบบ",
  submitLoadingLabel: "กำลังเข้าสู่ระบบ...",
  loading: false,
  onSubmit: () => {},
};

describe("AuthForm — 4 UI states (design-system.md §2)", () => {
  it("success/data state: renders the plain form with title", () => {
    render(<AuthForm {...baseProps} />);
    expect(screen.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "เข้าสู่ระบบ" })).toBeEnabled();
  });

  it("loading state: submit button shows the loading label and is disabled", () => {
    render(<AuthForm {...baseProps} loading />);
    expect(screen.getByRole("button", { name: "กำลังเข้าสู่ระบบ..." })).toBeDisabled();
  });

  it("error state: renders the ErrorBanner with the given message", () => {
    render(<AuthForm {...baseProps} bannerError="เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" />);
    expect(screen.getByRole("alert")).toHaveTextContent("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
  });

  it("error state: field-level error renders under the relevant field and disables nothing else", () => {
    render(<AuthForm {...baseProps} emailError="รูปแบบอีเมลไม่ถูกต้อง" />);
    expect(screen.getByText("รูปแบบอีเมลไม่ถูกต้อง")).toBeInTheDocument();
  });

  it("throttle state: renders ThrottleBanner INSTEAD of the error banner, and disables the whole form", () => {
    render(
      <AuthForm
        {...baseProps}
        bannerError="this should be suppressed while throttled"
        throttleRemainingSeconds={45}
      />,
    );
    expect(screen.getByTestId("throttle-banner")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "เข้าสู่ระบบ" })).toBeDisabled();
    expect(screen.getByLabelText("อีเมล")).toBeDisabled();
  });

  it("calls onSubmit when the form is submitted and not disabled/throttled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AuthForm {...baseProps} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onSubmit while throttled (form is a no-op until countdown clears)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AuthForm {...baseProps} onSubmit={onSubmit} throttleRemainingSeconds={30} />);
    const button = screen.getByRole("button", { name: "เข้าสู่ระบบ" });
    expect(button).toBeDisabled();
    await user.click(button).catch(() => {});
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders the footer slot (e.g. links to signup/forgot-password)", () => {
    render(<AuthForm {...baseProps} footer={<span>footer-content</span>} />);
    expect(screen.getByText("footer-content")).toBeInTheDocument();
  });
});
