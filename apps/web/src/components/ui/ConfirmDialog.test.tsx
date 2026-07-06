import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog (ui.md §6 — destructive default focus = Cancel)", () => {
  it("renders nothing when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        title="t"
        body="b"
        cancelLabel="ยกเลิก"
        confirmLabel="ยืนยัน"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("renders title/body/buttons when open", () => {
    render(
      <ConfirmDialog
        open
        title="ออกจากอุปกรณ์นี้?"
        body="อุปกรณ์นี้จะต้องเข้าสู่ระบบใหม่อีกครั้ง"
        cancelLabel="ยกเลิก"
        confirmLabel="ออกจากอุปกรณ์นี้"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("ออกจากอุปกรณ์นี้?")).toBeInTheDocument();
    expect(screen.getByText("อุปกรณ์นี้จะต้องเข้าสู่ระบบใหม่อีกครั้ง")).toBeInTheDocument();
  });

  it("puts default focus on the Cancel button for the destructive variant (guards accidental Enter)", () => {
    render(
      <ConfirmDialog
        open
        title="t"
        body="b"
        cancelLabel="ยกเลิก"
        confirmLabel="ลบ"
        variant="destructive"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "ยกเลิก" })).toHaveFocus();
  });

  it("calls onConfirm when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        body="b"
        cancelLabel="ยกเลิก"
        confirmLabel="ยืนยัน"
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        body="b"
        cancelLabel="ยกเลิก"
        confirmLabel="ยืนยัน"
        onCancel={onCancel}
        onConfirm={() => {}}
      />,
    );
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
