import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordField } from "./PasswordField";

describe("PasswordField", () => {
  it("renders as type=password by default (hidden)", () => {
    render(<PasswordField label="รหัสผ่าน" value="" onChange={() => {}} />);
    const input = screen.getByLabelText("รหัสผ่าน") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("toggles to type=text when the show/hide button is clicked", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="รหัสผ่าน" value="hunter2" onChange={() => {}} />);
    const toggle = screen.getByRole("button", { name: "แสดงรหัสผ่าน" });
    await user.click(toggle);
    const input = screen.getByLabelText("รหัสผ่าน") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: "ซ่อนรหัสผ่าน" })).toBeInTheDocument();
  });

  it("calls onChange with the typed value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PasswordField label="รหัสผ่าน" value="" onChange={onChange} />);
    const input = screen.getByLabelText("รหัสผ่าน");
    await user.type(input, "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("shows helper text when provided and no error", () => {
    render(
      <PasswordField
        label="รหัสผ่าน"
        value=""
        onChange={() => {}}
        helperText="ใช้ตัวอักษร ตัวเลข หรือวลีที่จำง่าย"
      />,
    );
    expect(screen.getByText("ใช้ตัวอักษร ตัวเลข หรือวลีที่จำง่าย")).toBeInTheDocument();
  });

  it("shows error text instead of helper text when errorText is set", () => {
    render(
      <PasswordField
        label="รหัสผ่าน"
        value=""
        onChange={() => {}}
        helperText="helper"
        errorText="รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร"
      />,
    );
    expect(screen.getByText("รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร")).toBeInTheDocument();
    expect(screen.queryByText("helper")).not.toBeInTheDocument();
  });

  it("sets aria-invalid when there is an error", () => {
    render(<PasswordField label="รหัสผ่าน" value="" onChange={() => {}} errorText="ผิดพลาด" />);
    const input = screen.getByLabelText("รหัสผ่าน");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("disables the input and toggle when disabled (throttle state)", () => {
    render(<PasswordField label="รหัสผ่าน" value="" onChange={() => {}} disabled />);
    expect(screen.getByLabelText("รหัสผ่าน")).toBeDisabled();
    expect(screen.getByRole("button", { name: "แสดงรหัสผ่าน" })).toBeDisabled();
  });
});
