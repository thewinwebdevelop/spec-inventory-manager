// D-038 ③ manual pass (W06): with unsaved edits on the role form, the sidebar
// "ออกจากระบบ" signed out at once — the guard only intercepted `<a href>`, and
// sign-out is a button. An action that LEAVES the page opts in with
// `data-leave-guard="<where it goes>"`; the guard asks first and replays the
// original click only after the person confirms.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

import { useLeaveGuard } from "./use-leave-guard";

function Page({ dirty, onSignOut }: { dirty: boolean; onSignOut: () => void }) {
  const guard = useLeaveGuard(dirty);
  return (
    <div>
      <button type="button" data-leave-guard="/login" onClick={onSignOut}>
        ออกจากระบบ
      </button>
      {guard.pendingHref !== null && (
        <div role="dialog">
          <span>pending:{guard.pendingHref}</span>
          <button type="button" onClick={guard.confirmLeave}>
            ทิ้งการแก้ไข
          </button>
          <button type="button" onClick={guard.cancelLeave}>
            แก้ต่อ
          </button>
        </div>
      )}
    </div>
  );
}

describe("useLeaveGuard · actions that leave the page (data-leave-guard)", () => {
  it("dirty: the click is held and the prompt shown; nothing runs until confirmed", async () => {
    const onSignOut = vi.fn();
    render(<Page dirty onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole("button", { name: "ออกจากระบบ" }));
    expect(onSignOut).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("pending:/login");

    await userEvent.click(screen.getByRole("button", { name: "ทิ้งการแก้ไข" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("dirty + แก้ต่อ: the action never runs", async () => {
    const onSignOut = vi.fn();
    render(<Page dirty onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole("button", { name: "ออกจากระบบ" }));
    await userEvent.click(screen.getByRole("button", { name: "แก้ต่อ" }));
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it("clean: the action runs straight away, no prompt", async () => {
    const onSignOut = vi.fn();
    render(<Page dirty={false} onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole("button", { name: "ออกจากระบบ" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
