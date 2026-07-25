import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangePasswordForm } from "./ChangePasswordForm";
import * as authClient from "../../lib/auth-client";
import { ApiError, SessionExpiredError } from "../../lib/auth-client";

vi.mock("../../lib/auth-client", async () => {
  const actual = await vi.importActual<typeof import("../../lib/auth-client")>(
    "../../lib/auth-client",
  );
  return {
    ...actual,
    changePassword: vi.fn(),
  };
});

function stubLocationHref() {
  const original = window.location;
  let assignedHref: string | undefined;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...original,
      set href(value: string) {
        assignedHref = value;
      },
      get href() {
        return assignedHref ?? original.href;
      },
    },
  });
  return {
    getAssignedHref: () => assignedHref,
    restore: () => {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    },
  };
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("รหัสผ่านปัจจุบัน"), "oldpassword1");
  await user.type(screen.getByLabelText("รหัสผ่านใหม่"), "newpassword1");
  await user.click(screen.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" }));
}

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    vi.mocked(authClient.changePassword).mockReset();
  });

  it("success/data state: clears both fields and calls onSuccess", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.changePassword).mockResolvedValue({ ok: true });
    const onSuccess = vi.fn();
    render(<ChangePasswordForm onSuccess={onSuccess} />);

    await fillAndSubmit(user);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect((screen.getByLabelText("รหัสผ่านปัจจุบัน") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("รหัสผ่านใหม่") as HTMLInputElement).value).toBe("");
  });

  it("error state: wrong current password shows the field-level error, not the generic banner", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.changePassword).mockRejectedValue(
      new ApiError(401, { error: { code: "INVALID_CREDENTIALS", message: "..." } }),
    );
    render(<ChangePasswordForm onSuccess={() => {}} />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByText("รหัสผ่านปัจจุบันไม่ถูกต้อง")).toBeInTheDocument(),
    );
  });

  it("throttle state: 429 renders ThrottleBanner instead of the ErrorBanner", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.changePassword).mockRejectedValue(
      new ApiError(429, { error: { code: "RATE_LIMITED", message: "..." } }, 45),
    );
    render(<ChangePasswordForm onSuccess={() => {}} />);

    await fillAndSubmit(user);

    await waitFor(() => expect(screen.getByTestId("throttle-banner")).toBeInTheDocument());
  });

  it("session-expiry (client-security review Important #4): redirects to /login instead of showing any inline error", async () => {
    const location = stubLocationHref();
    try {
      const user = userEvent.setup();
      vi.mocked(authClient.changePassword).mockRejectedValue(new SessionExpiredError());
      render(<ChangePasswordForm onSuccess={() => {}} />);

      await fillAndSubmit(user);

      await waitFor(() => expect(location.getAssignedHref()).toBe("/login?sessionExpired=1"));
      // must NOT render any of the normal inline error states for this case
      expect(screen.queryByText("รหัสผ่านปัจจุบันไม่ถูกต้อง")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      location.restore();
    }
  });
});
