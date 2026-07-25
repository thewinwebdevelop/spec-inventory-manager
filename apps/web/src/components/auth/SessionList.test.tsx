import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionList } from "./SessionList";
import * as authClient from "../../lib/auth-client";
import { SessionExpiredError, ApiError } from "../../lib/auth-client";

vi.mock("../../lib/auth-client", async () => {
  const actual = await vi.importActual<typeof import("../../lib/auth-client")>(
    "../../lib/auth-client",
  );
  return {
    ...actual,
    getSessions: vi.fn(),
    logoutDevice: vi.fn(),
    logoutAll: vi.fn(),
  };
});

const sampleSessions = {
  sessions: [
    {
      familyId: "fam-current",
      deviceId: "chrome-desktop",
      createdAt: "2026-07-01T00:00:00.000Z",
      lastUsedAt: "2026-07-06T14:30:00.000Z",
      current: true,
    },
    {
      familyId: "fam-other",
      deviceId: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      lastUsedAt: "2026-07-05T14:32:00.000Z",
      current: false,
    },
  ],
};

/** Stubs `window.location.href` assignment so we can assert whether a
 * redirect happened without actually navigating jsdom. */
function stubLocationHref() {
  const original = window.location;
  let assignedHref: string | undefined;
  // jsdom's window.location isn't directly reassignable in all versions —
  // redefine the property instead.
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

describe("SessionList — 4 UI states (design-system.md §2)", () => {
  beforeEach(() => {
    vi.mocked(authClient.getSessions).mockReset();
    vi.mocked(authClient.logoutDevice).mockReset();
    vi.mocked(authClient.logoutAll).mockReset();
  });

  it("loading state: shows the skeleton shimmer while the request is pending", () => {
    vi.mocked(authClient.getSessions).mockReturnValue(new Promise(() => {})); // never resolves
    render(<SessionList />);
    expect(screen.getAllByTestId("skeleton-row").length).toBeGreaterThan(0);
  });

  it("error state: shows the load-failed message + retry button on failure", async () => {
    vi.mocked(authClient.getSessions).mockRejectedValue(new Error("boom"));
    render(<SessionList />);
    await waitFor(() => expect(screen.getByText("โหลดรายการอุปกรณ์ไม่สำเร็จ")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "ลองใหม่" })).toBeInTheDocument();
  });

  it("success/data state: renders every session row with the current badge on the right one", async () => {
    vi.mocked(authClient.getSessions).mockResolvedValue(sampleSessions);
    render(<SessionList />);
    await waitFor(() => expect(screen.getByText("chrome-desktop")).toBeInTheDocument());
    expect(screen.getByText("อุปกรณ์นี้")).toBeInTheDocument();
    expect(screen.getByText("อุปกรณ์ไม่ทราบชื่อ")).toBeInTheDocument();
  });

  it("current-device row has no logout button; other rows do", async () => {
    vi.mocked(authClient.getSessions).mockResolvedValue(sampleSessions);
    render(<SessionList />);
    await waitFor(() => expect(screen.getByText("chrome-desktop")).toBeInTheDocument());
    const logoutButtons = screen.getAllByRole("button", { name: "ออกจากอุปกรณ์นี้" });
    expect(logoutButtons).toHaveLength(1); // only the non-current row
  });

  it("clicking logout-device opens a confirm dialog before calling the API", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.getSessions).mockResolvedValue(sampleSessions);
    render(<SessionList />);
    await waitFor(() => expect(screen.getByText("chrome-desktop")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "ออกจากอุปกรณ์นี้" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(authClient.logoutDevice).not.toHaveBeenCalled();
  });

  it("retry button re-invokes getSessions after a failure", async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.getSessions).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(authClient.getSessions).mockResolvedValueOnce(sampleSessions);
    render(<SessionList />);
    await waitFor(() => expect(screen.getByText("โหลดรายการอุปกรณ์ไม่สำเร็จ")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "ลองใหม่" }));
    await waitFor(() => expect(screen.getByText("chrome-desktop")).toBeInTheDocument());
  });

  describe("getSessions session-expiry (client-security review Important #4)", () => {
    it("redirects to /login?sessionExpired=1 instead of showing a retry-forever error banner", async () => {
      const location = stubLocationHref();
      try {
        vi.mocked(authClient.getSessions).mockRejectedValue(new SessionExpiredError());
        render(<SessionList />);
        await waitFor(() => expect(location.getAssignedHref()).toBe("/login?sessionExpired=1"));
        // must NOT render the generic "โหลดรายการอุปกรณ์ไม่สำเร็จ" + retry loop
        expect(screen.queryByText("โหลดรายการอุปกรณ์ไม่สำเร็จ")).not.toBeInTheDocument();
      } finally {
        location.restore();
      }
    });
  });

  describe("logout-all (client-security review Important #3)", () => {
    it("on success (204): redirects to /login", async () => {
      const location = stubLocationHref();
      try {
        vi.mocked(authClient.getSessions).mockResolvedValue(sampleSessions);
        vi.mocked(authClient.logoutAll).mockResolvedValue(undefined);
        render(<SessionList />);
        await waitFor(() => expect(screen.getByText("chrome-desktop")).toBeInTheDocument());

        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "ออกจากระบบทุกอุปกรณ์" }));
        // confirm dialog's confirm button carries the same visible label
        const dialogConfirm = screen.getAllByRole("button", { name: "ออกจากระบบทุกอุปกรณ์" })[1];
        await user.click(dialogConfirm);

        await waitFor(() => expect(location.getAssignedHref()).toBe("/login"));
      } finally {
        location.restore();
      }
    });

    it("on failure (network/500): stays on the page, shows a danger banner, does NOT redirect", async () => {
      const location = stubLocationHref();
      try {
        vi.mocked(authClient.getSessions).mockResolvedValue(sampleSessions);
        vi.mocked(authClient.logoutAll).mockRejectedValue(new ApiError(500, null));
        render(<SessionList />);
        await waitFor(() => expect(screen.getByText("chrome-desktop")).toBeInTheDocument());

        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "ออกจากระบบทุกอุปกรณ์" }));
        const dialogConfirm = screen.getAllByRole("button", { name: "ออกจากระบบทุกอุปกรณ์" })[1];
        await user.click(dialogConfirm);

        await waitFor(() =>
          expect(screen.getByText("ออกจากระบบทุกอุปกรณ์ไม่สำเร็จ ลองใหม่อีกครั้ง")).toBeInTheDocument(),
        );
        // critically: no redirect happened — the failure must be visible, not silently treated as success
        expect(location.getAssignedHref()).toBeUndefined();
        // session rows are still on screen — the user was NOT bounced to /login
        expect(screen.getByText("chrome-desktop")).toBeInTheDocument();
      } finally {
        location.restore();
      }
    });

    it("on SessionExpiredError: redirects to /login?sessionExpired=1 (the access token is already dead either way)", async () => {
      const location = stubLocationHref();
      try {
        vi.mocked(authClient.getSessions).mockResolvedValue(sampleSessions);
        vi.mocked(authClient.logoutAll).mockRejectedValue(new SessionExpiredError());
        render(<SessionList />);
        await waitFor(() => expect(screen.getByText("chrome-desktop")).toBeInTheDocument());

        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "ออกจากระบบทุกอุปกรณ์" }));
        const dialogConfirm = screen.getAllByRole("button", { name: "ออกจากระบบทุกอุปกรณ์" })[1];
        await user.click(dialogConfirm);

        await waitFor(() => expect(location.getAssignedHref()).toBe("/login?sessionExpired=1"));
      } finally {
        location.restore();
      }
    });
  });
});
