// S8 ★ — the one-time link, rendered. `member-actions.test.ts` proves the
// state machine; this proves the panel uses it, and that the guard rail §9.1
// settled on is actually on screen.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyLinkPanel } from "./CopyLinkPanel";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import { openInviteLink, INVITE_LINK_CLOSED, type InviteLinkState } from "../invite-link";
import { Button } from "../../../components/ui/Button";
import { copyLinkTh } from "../i18n";

const URL_WITH_TOKEN = "https://app.omnistock.co/invite?token=9f2b7c";

function renderPanel(over: Partial<Parameters<typeof CopyLinkPanel>[0]> = {}) {
  const state =
    over.state ??
    openInviteLink({
      inviteUrl: URL_WITH_TOKEN,
      email: "malee@shop.com",
      // Far enough out that the relative text is stable across a slow run.
      expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
    });
  const onStateChange = vi.fn();
  const onClose = vi.fn();
  const writeClipboard = over.writeClipboard ?? vi.fn(async () => undefined);
  render(
    <ToastProvider>
      <CopyLinkPanel
        state={state}
        onStateChange={onStateChange}
        onClose={onClose}
        writeClipboard={writeClipboard}
      />
    </ToastProvider>,
  );
  return { state, onStateChange, onClose, writeClipboard };
}

describe("CopyLinkPanel", () => {
  it("shows the link and who it is for", () => {
    renderPanel();
    expect(screen.getByDisplayValue(URL_WITH_TOKEN)).toBeInTheDocument();
    expect(screen.getByText(copyLinkTh.description("malee@shop.com"))).toBeInTheDocument();
  });

  it("★ the once-only warning is present, in warning tone, above the close button", () => {
    // §9.1 dropped the confirm-before-close dialog on the grounds that this
    // warning already sits in the reader's path to the exit. If it moves below
    // the button — or turns into faint helper text — the guard rail is gone
    // and nothing replaced it.
    renderPanel();
    const warning = screen.getByRole("note");
    expect(warning).toHaveTextContent(copyLinkTh.onceOnly);
    expect(warning.className).toContain("warning");

    const closeButton = screen.getByRole("button", { name: copyLinkTh.close });
    // `compareDocumentPosition` — DOCUMENT_POSITION_FOLLOWING (4) means the
    // button comes after the warning.
    expect(warning.compareDocumentPosition(closeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  /**
   * Both of these ask "which VARIANT is this button", so they compare against
   * what `<Button variant="primary">` actually renders instead of naming a
   * class. They asserted `bg-primary` until 2026-09-01, when the primary
   * variant correctly moved onto the `btn.*` tokens (§1.1c: on a dark ground
   * a link must be light and a button must be deep, so `color.primary` and
   * `btn.bg` cannot be the same token) — and a test that spells out today's
   * class name fails on a rename that changed nothing it cares about.
   */
  const primaryButtonClass = () => {
    const { container, unmount } = render(<Button>x</Button>);
    const cls = (container.querySelector("button") as HTMLButtonElement).className;
    unmount();
    return cls;
  };
  const looksPrimary = (el: HTMLElement) => {
    const primary = primaryButtonClass();
    const bg = primary.split(" ").find((c) => c.startsWith("bg-")) as string;
    return el.className.includes(bg);
  };

  it("★ the close button is SECONDARY before copying", () => {
    renderPanel();
    const close = screen.getByRole("button", { name: copyLinkTh.close });
    // The primary variant paints with the brand colour; secondary does not.
    expect(looksPrimary(close)).toBe(false);
  });

  it("★ …and PRIMARY once the link has been copied", () => {
    const copied: InviteLinkState = {
      status: "open",
      inviteUrl: URL_WITH_TOKEN,
      email: "malee@shop.com",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      copied: true,
    };
    renderPanel({ state: copied });
    expect(looksPrimary(screen.getByRole("button", { name: copyLinkTh.close }))).toBe(true);
  });

  it("copying writes the URL and reports it upward", async () => {
    const { writeClipboard, onStateChange } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: copyLinkTh.copy }));
    expect(writeClipboard).toHaveBeenCalledWith(URL_WITH_TOKEN);
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ copied: true }));
  });

  it("★ a refused clipboard is not a dead end — the link stays selectable and says so", async () => {
    // §9.1: the clipboard API can be denied outright. Failing silently would
    // leave somebody believing they hold a link they do not.
    renderPanel({ writeClipboard: vi.fn(async () => Promise.reject(new Error("denied"))) });
    await userEvent.click(screen.getByRole("button", { name: copyLinkTh.copy }));

    expect(await screen.findByRole("alert")).toHaveTextContent(copyLinkTh.copyFailed);
    expect(screen.getByDisplayValue(URL_WITH_TOKEN)).toBeInTheDocument();
  });

  it("★ renders NOTHING when the panel is closed — no leftover token in the DOM", () => {
    renderPanel({ state: INVITE_LINK_CLOSED });
    expect(document.body.textContent).not.toContain("9f2b7c");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("★ the expiry is rendered from `expiresAt`, not as a fixed duration", () => {
    // D-027: the TTL depends on the invited role and is recomputed on every
    // reissue. A screen printing "7 วัน" is wrong the first time an Owner
    // invitation is reissued — in the direction that says a dead link is live.
    renderPanel();
    expect(screen.getByText(/ลิงก์ใช้ได้ถึง/)).toHaveTextContent(/อีกประมาณ/);
  });
});
